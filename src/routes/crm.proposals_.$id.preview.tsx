import { createFileRoute } from "@tanstack/react-router";
import { crmProposal } from "@/lib/crm-data";
import { ProposalDocument } from "@/components/proposal-document";
import { formatUsd, paymentOptions } from "@/lib/proposals";

export const Route = createFileRoute("/crm/proposals_/$id/preview")({
  loader: ({ params }) => crmProposal({ data: { id: params.id } }),
  component: Preview,
});

function Preview() {
  const p = Route.useLoaderData();
  const options = paymentOptions({ oneTimeCents: p.one_time_cents, monthlyCents: p.monthly_cents });
  return (
    <div>
      <p className="no-print mb-3 text-sm">
        Staff preview. Opening this does not mark the proposal as viewed.{" "}
        <button type="button" onClick={() => window.print()} className="underline">
          Download PDF
        </button>
      </p>
      <ProposalDocument
        title={p.title}
        client={p.deal_name}
        summary={p.summary}
        timeline={p.timeline}
        validUntil={p.valid_until}
        lines={p.lines}
      >
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Ways to pay</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {options.map((o) => (
              <li key={o.key}>
                <span className="font-medium">{o.label}:</span>{" "}
                {o.schedule
                  .map((s) => `${s.label} ${formatUsd(s.amountCents)} (${s.due})`)
                  .join("; ")}
              </li>
            ))}
          </ul>
        </section>
      </ProposalDocument>
    </div>
  );
}
