import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { IconArrowRight } from "@/components/marks";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { pageHead } from "@/lib/seo";
import { submitApplication } from "@/lib/intake";

export const Route = createFileRoute("/careers")({
  head: () =>
    pageHead({
      path: "/careers",
      title: "Careers · Join GivenTake Devs",
      description:
        "Build with GivenTake Devs. We're a lean, AI-assisted development studio hiring people who want ownership and a direct line to the founder. See open roles and apply.",
    }),
  component: CareersPage,
});

// Where applications are delivered. Change to careers@giventakedevs.com once that
// alias exists; build@ is the monitored inbox today.
const CAREERS_EMAIL = "build@giventakedevs.com";

type Role = {
  slug: string;
  title: string;
  type: string;
  location: string;
  summary: string;
  /** External job-board apply link (e.g. ZipRecruiter). Empty => use the on-page form. */
  applyUrl: string;
  sections: { heading: string; body?: string; bullets?: string[] }[];
};

// Roles we are actively interviewing for today.
const ROLES: Role[] = [
  {
    slug: "digital-sales-closer",
    title: "Digital Sales Closer",
    type: "Hiring now · Contract or Full-Time",
    location: "Remote · United States",
    summary:
      "Own revenue for a lean, AI-assisted dev studio. You bring in the business; the founder builds and delivers.",
    applyUrl: "", // TODO: paste the ZipRecruiter job posting URL here
    sections: [
      {
        heading: "About the role",
        body: "You are the person who brings in business. You'll own the full sales cycle: find the prospect, run the call, scope the need, present the offer, and close. Our founder handles building and delivery, so you focus on selling and keeping clients happy. This is a high-ownership seat with a direct line to the founder and real room to grow as we scale.",
      },
      {
        heading: "What you'll do",
        bullets: [
          "Build pipeline through outbound (email, LinkedIn, calls) and work inbound leads",
          "Run discovery calls with founders and business owners to understand what they need",
          "Translate that into the right GivenTake service or product and present it",
          "Send proposals, handle objections, negotiate, and close deals",
          "Hand off signed work cleanly to delivery and stay the client's point of contact",
          "Keep your pipeline clean and up to date in our CRM",
          "Hit monthly revenue targets",
        ],
      },
      {
        heading: "What we're looking for",
        bullets: [
          "1 to 3+ years of B2B sales experience, ideally services, software, agency, or SaaS",
          "Comfortable selling to founders and small-business owners over video and phone",
          "Strong written and verbal communication; you can run a sales call solo",
          "Self-directed and organized; you prospect daily without being managed",
          "Enough curiosity about web/app/AI development to sell it credibly (we train the value prop; you don't need to code)",
          "Reliable internet and your own computer",
        ],
      },
      {
        heading: "Nice to have",
        bullets: [
          "An existing network of small businesses, founders, or agencies",
          "Experience selling development, design, marketing, or software subscriptions",
          "Familiarity with AI tools and automation",
        ],
      },
    ],
  },
];

// Roles we expect to open as the studio grows. No applications yet: listing them
// is a signal about direction, not a posting.
const FUTURE_ROLES = [
  {
    title: "Junior developer",
    body: "As project volume grows, we'll bring on a junior developer to build alongside the founder, with real code review and real ownership rather than ticket shuffling.",
  },
  {
    title: "Additional sales roles",
    body: "Once the first closer seat is proven, we'll add to the sales side. Likely a second closer, and eventually someone owning outbound.",
  },
];

const WHY_POINTS = [
  {
    title: "Ground-floor ownership",
    body: "You'd be our first dedicated sales hire. You own revenue and help shape how we sell, not a cog in a bloated sales org.",
  },
  {
    title: "Direct line to the founder",
    body: "No layers, no red tape. You work with the founder and your ideas actually get implemented.",
  },
  {
    title: "Sell work that ships",
    body: "Our AI-assisted build process means we deliver fast and deliver what we promise. You're never selling vaporware or apologizing for slow timelines.",
  },
  {
    title: "Real, in-demand work",
    body: "Websites, web apps, MVPs, automations, and AI tools, sold to founders and businesses across every industry. No two deals look the same.",
  },
];

function CareersPage() {
  return (
    <div className="min-h-screen text-foreground antialiased">
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="border-b border-hairline">
          <div className="mx-auto max-w-3xl px-6 py-16 md:py-20">
            <p className="text-[13px] font-medium text-violet">Careers</p>
            <h1 className="mt-3 font-display text-[36px] font-medium leading-[1.05] tracking-[-0.03em] text-ink md:text-[48px]">
              Build with us.
            </h1>
            <p className="mt-5 text-[18px] leading-relaxed text-muted-ink">
              GivenTake Devs is a lean, AI-assisted development studio. We hire people who want real
              ownership, a direct line to the founder, and room to grow as we scale. If that's you,
              take a look below.
            </p>
            <a
              href="#roles"
              className="btn-icon-nudge mt-8 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[14px] font-medium text-white transition hover:opacity-90"
            >
              See open roles
              <IconArrowRight className="h-4 w-4" />
            </a>
          </div>
        </section>

        {/* Why work here */}
        <section className="border-b border-hairline">
          <div className="mx-auto max-w-3xl px-6 py-14">
            <h2 className="font-display text-[26px] font-medium tracking-[-0.02em] text-ink md:text-3xl">
              Why work at GivenTake Devs
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {WHY_POINTS.map((p) => (
                <div
                  key={p.title}
                  className="rounded-lg border border-hairline bg-secondary/30 p-5"
                >
                  <h3 className="text-[15px] font-semibold text-ink">{p.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted-ink">{p.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-[15px] leading-relaxed text-muted-ink">
              If you're a self-starter who wants ownership, direct access to leadership, and room to
              grow as the company grows, this is the kind of seat that turns into something bigger.
            </p>
          </div>
        </section>

        {/* Open roles */}
        <section id="roles" className="border-b border-hairline">
          <div className="mx-auto max-w-3xl px-6 py-14">
            <h2 className="font-display text-[26px] font-medium tracking-[-0.02em] text-ink md:text-3xl">
              Open roles
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-ink">
              Open means open: we are interviewing for this seat right now.
            </p>
            <div className="mt-8 space-y-8">
              {ROLES.map((role) => (
                <RoleCard key={role.slug} role={role} />
              ))}
            </div>
          </div>
        </section>

        {/* Future roles */}
        <section className="border-b border-hairline">
          <div className="mx-auto max-w-3xl px-6 py-14">
            <h2 className="font-display text-[26px] font-medium tracking-[-0.02em] text-ink md:text-3xl">
              Future roles
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-ink">
              We will post here when we are ready. No applications yet for these.
            </p>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {FUTURE_ROLES.map((r) => (
                <div
                  key={r.title}
                  className="rounded-lg border border-hairline bg-secondary/30 p-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-semibold text-ink">{r.title}</h3>
                    <span className="rounded-full border border-hairline bg-background px-2 py-0.5 text-[11px] font-medium text-muted-ink">
                      Not open yet
                    </span>
                  </div>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted-ink">{r.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Application form */}
        <ApplyForm />
      </main>
      <SiteFooter />
    </div>
  );
}

function RoleCard({ role }: { role: Role }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-hairline bg-background p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-[22px] font-medium tracking-[-0.02em] text-ink">
            {role.title}
          </h3>
          <p className="mt-1 text-[13px] text-muted-ink">
            {role.type} · {role.location}
          </p>
        </div>
        {role.applyUrl ? (
          <a
            href={role.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-icon-nudge inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13.5px] font-medium text-white transition hover:opacity-90"
          >
            Apply
            <IconArrowRight className="h-4 w-4" />
          </a>
        ) : (
          <a
            href="#apply"
            className="btn-icon-nudge inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13.5px] font-medium text-white transition hover:opacity-90"
          >
            Apply
            <IconArrowRight className="h-4 w-4" />
          </a>
        )}
      </div>

      <p className="mt-4 text-[15.5px] leading-relaxed text-muted-ink">{role.summary}</p>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-5 text-[13px] font-medium text-violet hover:underline"
      >
        {open ? "Hide details" : "View full description"}
      </button>

      {open && (
        <div className="mt-6 space-y-6 border-t border-hairline pt-6">
          {role.sections.map((s) => (
            <div key={s.heading}>
              <h4 className="text-[15px] font-semibold text-ink">{s.heading}</h4>
              {s.body && (
                <p className="mt-2 text-[15px] leading-relaxed text-muted-ink">{s.body}</p>
              )}
              {s.bullets && (
                <ul className="mt-2 space-y-1.5">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex gap-2.5 text-[15px] leading-relaxed text-muted-ink">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

function ApplyForm() {
  const [outcome, setOutcome] = useState<"idle" | "sent" | "mailto">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Fallback when no mail provider is configured, mirrors the contact form. */
  function mailtoFallback(d: Record<string, string>) {
    const subject = `Application · ${d.role || "General"} · ${d.name}`;
    const body = [
      `Name: ${d.name}`,
      `Email: ${d.email}`,
      d.phone ? `Phone: ${d.phone}` : null,
      d.role ? `Role: ${d.role}` : null,
      d.links ? `LinkedIn / portfolio: ${d.links}` : null,
      "",
      "Message:",
      d.message || "(none)",
    ]
      .filter(Boolean)
      .join("\n");
    window.location.href = `mailto:${CAREERS_EMAIL}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    setOutcome("mailto");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const d = Object.fromEntries(fd.entries()) as Record<string, string>;
    if (!d.name?.trim() || !d.email?.trim()) return;
    setError(null);

    // Optional résumé -> read as base64 for the email attachment.
    let resume: { filename: string; base64: string } | undefined;
    const file = fd.get("resume");
    if (file instanceof File && file.size > 0) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Résumé must be under 5 MB.");
        return;
      }
      try {
        resume = { filename: file.name, base64: await fileToBase64(file) };
      } catch {
        setError("Couldn't read that file. Try another, or leave it off.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const result = await submitApplication({
        data: {
          name: d.name,
          email: d.email,
          phone: d.phone || undefined,
          role: d.role || undefined,
          links: d.links || undefined,
          message: d.message || undefined,
          resume,
        },
      });
      if (result.status === "sent") setOutcome("sent");
      else mailtoFallback(d); // unconfigured or error -> hand off to the mail client
    } catch {
      mailtoFallback(d);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="apply" className="border-b border-hairline bg-secondary/50">
      <div className="mx-auto max-w-2xl px-6 py-14">
        <h2 className="font-display text-3xl font-medium tracking-[-0.03em] text-ink">Apply</h2>
        <p className="mt-4 text-[16px] leading-relaxed text-muted-ink">
          Tell us who you are and what you're after. Don't see the exact role? Apply anyway, we're
          always glad to meet strong people.
        </p>

        {outcome !== "idle" ? (
          <p className="mt-8 rounded-lg border border-hairline bg-background p-5 text-[15px] text-ink">
            {outcome === "sent"
              ? "Thanks, we've got your application and we'll be in touch."
              : "Your email draft is ready, just hit send and we'll be in touch."}
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input name="name" placeholder="Full name" required aria-label="Full name" />
              <Input name="email" type="email" placeholder="Email" required aria-label="Email" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input name="phone" placeholder="Phone (optional)" aria-label="Phone" />
              <Input
                name="role"
                placeholder="Role you're applying for"
                defaultValue="Digital Sales Closer"
                aria-label="Role"
              />
            </div>
            <Input
              name="links"
              placeholder="LinkedIn or portfolio URL (optional)"
              aria-label="LinkedIn or portfolio"
            />
            <Textarea
              name="message"
              rows={5}
              placeholder="A few lines on why you're a fit"
              aria-label="Message"
            />
            <div>
              <label htmlFor="resume" className="mb-2 block text-[13px] font-medium text-muted-ink">
                Résumé (PDF or Word, optional, max 5 MB)
              </label>
              <input
                id="resume"
                type="file"
                name="resume"
                accept=".pdf,.doc,.docx,application/pdf"
                className="block w-full text-[14px] text-muted-ink file:mr-4 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-[13px] file:font-medium file:text-white hover:file:opacity-90"
              />
            </div>
            {error && <p className="text-[13px] text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="btn-icon-nudge inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[14px] font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Send application"}
              <IconArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
