create function public.is_valid_brand_logo_url(input_value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  explicit_port text;
begin
  if char_length(coalesce(input_value, '')) not between 1 and 500
    or input_value !~* '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]]*)?$' then
    return false;
  end if;

  select matches[1]
  into explicit_port
  from regexp_match(
    input_value,
    '^https://[^/?#]+:([0-9]+)([/?#]|$)',
    'i'
  ) as matches;

  return explicit_port is null or explicit_port::integer between 1 and 65535;
exception when numeric_value_out_of_range then
  return false;
end;
$$;

alter table public.brands
drop constraint brands_logo_url_check;

alter table public.brands
add constraint brands_logo_url_check
check (public.is_valid_brand_logo_url(logo_url));

create or replace function public.update_tenant_brand(
  target_tenant uuid,
  brand_display_name text,
  brand_logo_url text,
  brand_primary_color text,
  brand_accent_color text,
  brand_on_primary_color text,
  brand_report_name text,
  event_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  canonical_display_name text := regexp_replace(
    coalesce(brand_display_name, ''),
    '^[[:space:]]+|[[:space:]]+$',
    '',
    'g'
  );
  canonical_logo_url text := btrim(coalesce(brand_logo_url, ''));
  canonical_primary_color text := lower(btrim(coalesce(brand_primary_color, '')));
  canonical_accent_color text := lower(btrim(coalesce(brand_accent_color, '')));
  canonical_on_primary_color text := lower(btrim(coalesce(brand_on_primary_color, '')));
  canonical_report_name text := regexp_replace(
    coalesce(brand_report_name, ''),
    '^[[:space:]]+|[[:space:]]+$',
    '',
    'g'
  );
  canonical_brand jsonb;
begin
  if actor_user_id is null or not public.is_client_owner(target_tenant) then
    raise exception using errcode = '42501', message = 'client owner required';
  end if;

  if not exists (
    select 1 from public.tenants where id = target_tenant and status = 'active'
  ) then
    raise exception using errcode = '23503', message = 'active tenant not found';
  end if;

  if char_length(coalesce(canonical_display_name, '')) not between 1 and 120
    or char_length(coalesce(canonical_report_name, '')) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'brand names must be 1-120 non-whitespace characters';
  end if;

  if not public.is_valid_brand_logo_url(canonical_logo_url) then
    raise exception using errcode = '22023', message = 'brand logo must be a valid HTTPS URL with port 1-65535';
  end if;

  if canonical_primary_color !~ '^[0-9a-f]{6}$'
    or canonical_accent_color !~ '^[0-9a-f]{6}$'
    or canonical_on_primary_color !~ '^[0-9a-f]{6}$' then
    raise exception using errcode = '22023', message = 'brand colors must be six-digit hex values';
  end if;

  if public.brand_contrast_ratio(canonical_primary_color, canonical_on_primary_color) < 4.5 then
    raise exception using errcode = '22023', message = 'brand contrast must be at least 4.5 to 1';
  end if;

  insert into public.brands (
    tenant_id, display_name, logo_url, primary_color, accent_color, on_primary_color, report_name
  )
  values (
    target_tenant, canonical_display_name, canonical_logo_url, canonical_primary_color,
    canonical_accent_color, canonical_on_primary_color, canonical_report_name
  )
  on conflict (tenant_id) do update
  set
    display_name = excluded.display_name,
    logo_url = excluded.logo_url,
    primary_color = excluded.primary_color,
    accent_color = excluded.accent_color,
    on_primary_color = excluded.on_primary_color,
    report_name = excluded.report_name,
    updated_at = now();

  perform public.write_audit_event(
    target_tenant,
    'brand.updated',
    'brand',
    target_tenant,
    event_request_id,
    jsonb_build_object('change_code', 'settings_saved'),
    actor_user_id
  );

  canonical_brand := jsonb_build_object(
    'display_name', canonical_display_name,
    'logo_url', canonical_logo_url,
    'primary_color', canonical_primary_color,
    'accent_color', canonical_accent_color,
    'on_primary_color', canonical_on_primary_color,
    'report_name', canonical_report_name
  );
  return canonical_brand;
end;
$$;

revoke all on function public.is_valid_brand_logo_url(text) from public, anon, authenticated;
grant execute on function public.is_valid_brand_logo_url(text) to service_role;
