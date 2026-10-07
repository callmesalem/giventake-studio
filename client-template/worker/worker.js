/* client-template lead endpoint (Cloudflare Worker).
 *
 * POST /api/lead  ->  validates, then calls the Supabase
 * capture_website_lead RPC (same envelope the studio's own site uses).
 *
 * Env (set via wrangler secret / vars; see wrangler.toml.example):
 *  SUPABASE_URL            e.g. https://xyz.supabase.co   (secret)
 *  SUPABASE_SERVICE_ROLE_KEY                              (secret)
 *  ALLOWED_ORIGIN          e.g. https://www.client.com    (var)
 *  SERVICES                JSON array of {slug, name}      (var)
 *
 * The RPC has a strict payload allowlist. Fields that are not allowed
 * (phone, request_id) are folded or kept out:
 *  - source:         "website"
 *  - source_detail:  service name (160 chars)
 *  - description:    message with phone + value-tool result prepended (1500)
 *  - origin:         "website_contact_form"
 *  - attribution:    UTM object from the landing page
 *  - consent:        { given: true, text: <checkbox wording> }
 *  - request_id:     NOT sent. Used only for the log line and response echo.
 *
 * Never logs PII. A CRM outage never fails the request visibly as a 500:
 * the visitor still gets success (the enquiry is also recoverable from the
 * notification path the studio wires per client).
 */

const CAPS = { name: 120, email: 160, phone: 40, service: 80, message: 1500, consentText: 300 };

function clean(v, cap) {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, cap);
}

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function corsHeaders(env, req) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGIN || '').trim();
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (allowed && origin === allowed) {
    headers['Access-Control-Allow-Origin'] = allowed;
  }
  return headers;
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers });
}

export default {
  async fetch(req, env) {
    const headers = corsHeaders(env, req);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }
    if (req.method !== 'POST' || !new URL(req.url).pathname.endsWith('/api/lead')) {
      return json({ ok: false, error: 'not_found' }, 404, headers);
    }

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return json({ ok: false, error: 'bad_json' }, 400, headers);
    }

    const requestId = clean(body.request_id, 80) || 'none';

    // Honeypot: silently succeed, store nothing.
    if (clean(body.company_website, 200)) {
      return json({ ok: true, request_id: requestId }, 200, headers);
    }

    const name = clean(body.name, CAPS.name);
    const email = clean(body.email, CAPS.email).toLowerCase();
    const phone = clean(body.phone, CAPS.phone);
    const serviceSlug = clean(body.service, CAPS.service);
    const message = clean(body.message, CAPS.message);
    const consentText = clean(body.consent_text, CAPS.consentText);

    if (!name || !isEmail(email) || !serviceSlug || !message) {
      return json({ ok: false, error: 'validation' }, 400, headers);
    }

    // Service must be one of the configured slugs. The form renders its
    // options from the same config, so anything else is tampering.
    let services = [];
    try { services = JSON.parse(env.SERVICES || '[]'); } catch (e) { services = []; }
    const service = services.find(s => s.slug === serviceSlug);
    if (!service) {
      return json({ ok: false, error: 'validation' }, 400, headers);
    }

    let valueTool = '';
    if (body.value_tool_result && typeof body.value_tool_result === 'object') {
      try { valueTool = JSON.stringify(body.value_tool_result).slice(0, 500); }
      catch (e) { valueTool = ''; }
    }

    const attribution = {};
    if (body.attribution && typeof body.attribution === 'object') {
      for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'referrer']) {
        const v = clean(body.attribution[k], 150);
        if (v) attribution[k] = v;
      }
    }

    const descriptionParts = [];
    if (phone) descriptionParts.push('Phone: ' + phone);
    if (valueTool) descriptionParts.push('Tool result: ' + valueTool);
    descriptionParts.push(message);
    const description = descriptionParts.join('\n').slice(0, 1500);

    const payload = {
      email,
      name,
      source: 'website',
      source_detail: clean(service.name, 160),
      description,
      origin: 'website_contact_form',
      attribution,
      consent: { given: true, text: consentText }
    };

    const url = (env.SUPABASE_URL || '').replace(/\/$/, '');
    const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!url || !key) {
      console.error('lead endpoint misconfigured', { request_id: requestId });
      return json({ ok: false, error: 'unconfigured' }, 503, headers);
    }

    try {
      const res = await fetch(url + '/rest/v1/rpc/capture_website_lead', {
        method: 'POST',
        headers: {
          'apikey': key,
          'authorization': 'Bearer ' + key,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ p_payload: payload })
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('crm rpc failed', { request_id: requestId, status: res.status, detail: text.slice(0, 200) });
        return json({ ok: false, error: 'crm' }, 502, headers);
      }
    } catch (e) {
      console.error('crm rpc threw', { request_id: requestId, error: String(e).slice(0, 200) });
      return json({ ok: false, error: 'crm' }, 502, headers);
    }

    return json({ ok: true, request_id: requestId }, 200, headers);
  }
};
