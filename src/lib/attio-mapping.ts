/**
 * Attio -> prospecting-layer mapping (pure, no I/O). Maps Attio record JSON into
 * the argument shapes for company_upsert / contact_upsert / deal_upsert.
 *
 * Attio shape: record.values[slug] is an ARRAY of value objects; we take the
 * first. Shapes vary by attribute type (verified against the live workspace):
 *  - text:      { value }
 *  - domain:    { domain, root_domain }
 *  - select:    { option: { title } }
 *  - location:  { locality, region, country_code, line_1... }
 *  - name:      { full_name, first_name, last_name }
 *  - email:     { email_address }
 *  - phone:     { phone_number, original_phone_number }
 *  - status:    { status: { title } }
 *  - currency:  { currency_value }
 *  - record ref:{ target_record_id }
 * Everything is defensive: missing/empty values return null/[] and never throw.
 */

type AttioRecord = { id?: { record_id?: string }; values?: Record<string, unknown[]> };

function first(record: AttioRecord, slug: string): Record<string, unknown> | null {
  const arr = record?.values?.[slug];
  return Array.isArray(arr) && arr.length ? (arr[0] as Record<string, unknown>) : null;
}
function textVal(record: AttioRecord, slug: string): string | null {
  const v = first(record, slug);
  return v && typeof v["value"] === "string" ? (v["value"] as string) : null;
}

export function attioRecordId(record: AttioRecord): string | null {
  return record?.id?.record_id ?? null;
}

export function mapAttioCompany(record: AttioRecord) {
  const dom = first(record, "domains");
  const loc = first(record, "primary_location");
  const cats = (record?.values?.["categories"] ?? [])
    .map((c) => (c as { option?: { title?: string } })?.option?.title ?? null)
    .filter((x): x is string => !!x);
  const emp = first(record, "employee_range") as { option?: { title?: string } } | null;
  const locStr = loc
    ? [loc["locality"], loc["region"], loc["country_code"]].filter(Boolean).join(", ") || null
    : null;
  return {
    sourceRecordId: attioRecordId(record),
    name: textVal(record, "name"),
    domain: (dom?.["domain"] as string) ?? (dom?.["root_domain"] as string) ?? null,
    description: textVal(record, "description"),
    categories: cats,
    employeeRange: emp?.option?.title ?? null,
    location: locStr,
    socials: {
      linkedin: textVal(record, "linkedin"),
      twitter: textVal(record, "twitter"),
      facebook: textVal(record, "facebook"),
      instagram: textVal(record, "instagram"),
    },
    metadata: {},
  };
}

export function mapAttioPerson(record: AttioRecord) {
  const nameObj = first(record, "name");
  const email = first(record, "email_addresses");
  const phone = first(record, "phone_numbers");
  const companyRef = first(record, "company");
  const joined = [nameObj?.["first_name"], nameObj?.["last_name"]].filter(Boolean).join(" ");
  const full = (nameObj?.["full_name"] as string) ?? (joined || null);
  return {
    sourceRecordId: attioRecordId(record),
    name: full,
    email: (email?.["email_address"] as string) ?? null,
    phone:
      (phone?.["phone_number"] as string) ?? (phone?.["original_phone_number"] as string) ?? null,
    jobTitle: textVal(record, "job_title"),
    companyRecordId: (companyRef?.["target_record_id"] as string) ?? null,
    socials: { linkedin: textVal(record, "linkedin") },
    metadata: {},
  };
}

export function mapAttioDeal(record: AttioRecord) {
  const val = first(record, "value");
  const stage = first(record, "stage") as { status?: { title?: string } } | null;
  const company = first(record, "associated_company");
  return {
    sourceRecordId: attioRecordId(record),
    name: textVal(record, "name"),
    stage: stage?.status?.title ?? null,
    valueUsd: (val?.["currency_value"] as number) ?? null,
    companyRecordId: (company?.["target_record_id"] as string) ?? null,
    metadata: {},
  };
}
