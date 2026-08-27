import { createFileRoute, useRouter } from "@tanstack/react-router";
import { crmReferrals, savePartner, recordReferral, setReferralStatus } from "@/lib/crm-data";
import {
  PageHeader,
  Card,
  EmptyState,
  Badge,
  EntityForm,
  Disclosure,
  LinkedTable,
} from "@/components/crm/ui";

export const Route = createFileRoute("/crm/referrals")({
  loader: () => crmReferrals(),
  component: Referrals,
});

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// Exactly the values referral_set_status() accepts. Anything else raises
// "invalid status" at the database, so this list is not a UI preference - it is
// the contract, and it is copied from the function rather than guessed.
const STATUSES = ["received", "qualified", "converted", "declined"];

// Likewise referral_partner_upsert() validates kind.
const KINDS = ["individual", "firm", "partner"];

function Referrals() {
  const { partners, referrals } = Route.useLoaderData();
  const router = useRouter();
  const owed = referrals.filter((r) => r.status === "converted" && !r.paid_at);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Referrals"
        subtitle={`${partners.length} partner${partners.length === 1 ? "" : "s"} · ${referrals.length} referral${referrals.length === 1 ? "" : "s"}`}
        action={
          <Disclosure label="New partner" openLabel="New referral partner">
            <EntityForm
              fields={[
                { name: "name", label: "Name", required: true },
                {
                  name: "kind",
                  label: "Kind",
                  type: "select" as const,
                  options: KINDS.map((k) => ({ value: k, label: k })),
                },
                { name: "contactEmail", label: "Email", type: "email" },
                { name: "notes", label: "Notes", type: "textarea", rows: 2 },
              ]}
              submitLabel="Add partner"
              columns={2}
              onSubmit={(data) => savePartner({ data })}
            />
          </Disclosure>
        }
      />

      {/* Money you owe someone is the thing most worth surfacing: an unpaid
          reward is how a referral relationship quietly ends. */}
      {owed.length > 0 && (
        <Card title={`Reward owed (${owed.length})`}>
          <ul className="space-y-1.5 text-sm">
            {owed.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">
                  {r.company_name} &middot;{" "}
                  <span className="text-muted-foreground">{r.partner ?? "no partner"}</span>
                </span>
                <span className="flex-none tabular-nums">
                  {r.amount != null ? usd.format(r.amount) : "amount not set"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Partners">
        {partners.length === 0 ? (
          <EmptyState>
            No partners yet. Warm introductions are the channel the research called highest
            leverage.
          </EmptyState>
        ) : (
          <div className="space-y-4">
            {partners.map((p) => (
              <div key={p.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[p.kind, p.contact_email].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <Disclosure label="Record referral" openLabel={`Referral from ${p.name}`}>
                    <EntityForm
                      fields={[{ name: "companyName", label: "Company referred", required: true }]}
                      submitLabel="Record"
                      onSubmit={(data) => recordReferral({ data: { ...data, partnerId: p.id } })}
                    />
                  </Disclosure>
                </div>
                {p.notes && <p className="mt-2 text-sm text-muted-foreground">{p.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Referrals">
        {referrals.length === 0 ? (
          <EmptyState>Nothing recorded yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 text-left font-medium">Company</th>
                  <th className="py-2 text-left font-medium">Partner</th>
                  <th className="py-2 text-left font-medium">Status</th>
                  <th className="py-2 text-right font-medium">Reward</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-2">{r.company_name ?? "—"}</td>
                    <td className="py-2 text-muted-foreground">{r.partner ?? "—"}</td>
                    <td className="py-2">
                      <select
                        defaultValue={r.status ?? "received"}
                        onChange={async (event) => {
                          await setReferralStatus({
                            data: { id: r.id, status: event.target.value },
                          });
                          await router.invalidate();
                        }}
                        className="rounded border border-border bg-background px-2 py-1 text-xs"
                        aria-label={`Status for ${r.company_name ?? "referral"}`}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {r.amount != null ? usd.format(r.amount) : "—"}
                      {r.paid_at && (
                        <span className="ml-1 text-xs text-muted-foreground">paid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
