-- supabase/migrations/20261017120000_price_book.sql
-- Price book: the building blocks proposals are priced from. Proposals snapshot
-- these values (20261017130000_proposals.sql), so an edit here never changes a
-- proposal already sent.

create table if not exists public.price_book_items (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]{1,59}$'),
  name text not null check (length(btrim(name)) between 1 and 120),
  description text not null default '' check (length(description) <= 600),
  category text not null check (category in ('website','addon','automation','monthly')),
  unit text not null check (unit in ('each','page','town','month')),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  recurring boolean not null default false,
  price_is_from boolean not null default false,
  includes text[] not null default '{}',
  excludes text[] not null default '{}',
  internal_hours numeric check (internal_hours is null or internal_hours >= 0),
  archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.price_book_items enable row level security;
alter table public.price_book_items force row level security;
revoke all on table public.price_book_items from public, anon, authenticated, service_role;
grant select on table public.price_book_items to service_role;

insert into public.price_book_items
  (key, name, description, category, unit, unit_price_cents, recurring, price_is_from, includes, excludes, sort_order)
values
  ('site_standard', 'Standard website', 'A custom site for your business, built around one clear action for visitors.', 'website', 'each', 99900, false, false,
   array['Up to 5 pages','CMS your team can edit','Mobile-first design','SEO fundamentals','Analytics with a compliant consent banner','30 days of tweaks after launch'],
   array['Copywriting','Photography and stock','Brand identity design','Domain and hosting costs'], 10),
  ('site_contractor', 'Contractor website', 'A site built to turn a search on a phone into a call or a quote request.', 'website', 'each', 199900, false, false,
   array['Everything in the standard website','Tap-to-call on every page','Quote request form','Service-area section','Job photo gallery','LocalBusiness schema','Google Business Profile links'],
   array['Paid ads and lead buying','Copywriting beyond core pages','Professional photography','Domain and hosting costs'], 20),
  ('extra_page', 'Extra page', 'An additional page beyond the five included.', 'addon', 'page', 14900, false, false, '{}', '{}', 30),
  ('town_page', 'Town / service-area page', 'A page for one town you serve.', 'addon', 'town', 9900, false, false, '{}', '{}', 40),
  ('copywriting', 'Copywriting', 'We write the words for a page.', 'addon', 'page', 14900, false, false, '{}', '{}', 50),
  ('quote_form', 'Quote form with photo upload', 'A short form that asks the right questions and accepts photos.', 'addon', 'each', 19900, false, false, '{}', '{}', 60),
  ('booking_embed', 'Booking embed', 'A Calendly-style booking widget on your site.', 'addon', 'each', 24900, false, false, '{}', array['Custom booking systems (priced separately)'], 70),
  ('online_payments', 'Online payments', 'Stripe checkout for deposits or payments.', 'addon', 'each', 39900, false, false, '{}', array['Payment processor fees'], 80),
  ('site_replacement', 'Replace an existing site', 'Redirects mapped so you keep the search traffic you already have.', 'addon', 'each', 29900, false, false, '{}', '{}', 90),
  ('gbp_setup', 'Google Business Profile setup', 'Profile created or cleaned up and linked to your site.', 'addon', 'each', 19900, false, false, '{}', '{}', 100),
  ('blog_setup', 'Blog setup', 'A blog section you can post to yourself.', 'addon', 'each', 29900, false, false, '{}', array['Writing blog posts'], 110),
  ('automation_audit', 'Automation audit', 'One process mapped end to end, with a written plan and fixed price. Credited in full toward the build if you sign within 30 days.', 'automation', 'each', 74900, false, false, '{}', '{}', 120),
  ('automation_build', 'Automation build', 'One repetitive process automated end to end.', 'automation', 'each', 399900, false, true, '{}', array['Licences for integrated systems','AI model usage costs'], 130),
  ('hosting', 'Hosting only', 'Hosting, SSL and backups.', 'monthly', 'month', 4900, true, false, array['Hosting','SSL','Backups'], array['Edits (priced per request)'], 140),
  ('care_plan', 'Care plan', 'Hosting, updates, small edits and a monthly report.', 'monthly', 'month', 9900, true, false, array['Hosting and security updates','Backups and uptime monitoring','A few small edits a month','Monthly report'], array['New pages','New features','Redesigns'], 150),
  ('automation_retainer', 'Automation retainer', 'Monitoring, fixes and small changes, about 4 hours a month.', 'monthly', 'month', 49900, true, true, '{}', '{}', 160)
on conflict (key) do nothing;

create or replace function public.price_book_upsert(
  p_id uuid, p_key text, p_name text, p_description text, p_category text, p_unit text,
  p_unit_price_cents bigint, p_recurring boolean, p_price_is_from boolean,
  p_includes text[], p_excludes text[], p_internal_hours numeric, p_archived boolean,
  p_sort_order integer
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  if p_id is null then
    insert into price_book_items (key, name, description, category, unit, unit_price_cents,
      recurring, price_is_from, includes, excludes, internal_hours, archived, sort_order)
    values (p_key, btrim(p_name), coalesce(p_description, ''), p_category, p_unit, p_unit_price_cents,
      coalesce(p_recurring, false), coalesce(p_price_is_from, false), coalesce(p_includes, '{}'),
      coalesce(p_excludes, '{}'), p_internal_hours, coalesce(p_archived, false), coalesce(p_sort_order, 0))
    returning id into v_id;
  else
    update price_book_items set
      key = p_key, name = btrim(p_name), description = coalesce(p_description, ''),
      category = p_category, unit = p_unit, unit_price_cents = p_unit_price_cents,
      recurring = coalesce(p_recurring, false), price_is_from = coalesce(p_price_is_from, false),
      includes = coalesce(p_includes, '{}'), excludes = coalesce(p_excludes, '{}'),
      internal_hours = p_internal_hours, archived = coalesce(p_archived, false),
      sort_order = coalesce(p_sort_order, 0), updated_at = now()
    where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'price book item not found: %', p_id; end if;
  end if;
  return v_id;
end $$;

revoke all on function public.price_book_upsert(uuid,text,text,text,text,text,bigint,boolean,boolean,text[],text[],numeric,boolean,integer) from public, anon, authenticated;
grant execute on function public.price_book_upsert(uuid,text,text,text,text,text,bigint,boolean,boolean,text[],text[],numeric,boolean,integer) to service_role;
