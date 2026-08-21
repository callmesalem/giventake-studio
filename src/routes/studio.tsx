import { FormEvent, useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LoaderCircle, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";

import {
  approveStudioEdit,
  approveStudioStoryboard,
  createStudioCampaign,
  handoffStudioExport,
  listStudioCampaigns,
  planStudioCampaign,
  renderStudioCampaign,
} from "@/lib/studio/actions";
import type { CampaignRecord } from "@/lib/studio/types";

export const Route = createFileRoute("/studio")({ component: StudioPage });

const tenantId = "giventake-devs";
const fieldClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100";
const primaryButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60";

const defaultForm = {
  name: "",
  goal: "Generate qualified project inquiries",
  offer: "Agentic development and AI automation",
  audience: "Owners with manual workflows",
  callToAction: "Book a discovery call",
  budgetDollars: "25",
};

function actionLabel(status: CampaignRecord["status"]): string {
  if (status === "draft") return "Plan storyboard";
  if (status === "awaiting_storyboard_approval") return "Approve storyboard";
  if (status === "approved_for_generation") return "Render fixture";
  if (status === "awaiting_edit_approval") return "Approve edit";
  if (status === "exported") return "Send to marketing drafts";
  if (status === "handed_off") return "Handed off";
  return status.replaceAll("_", " ");
}

function statusTone(status: CampaignRecord["status"]): string {
  if (status === "handed_off" || status === "exported") return "bg-emerald-100 text-emerald-900";
  if (status === "failed") return "bg-rose-100 text-rose-900";
  return "bg-cyan-100 text-cyan-950";
}

function StudioPage() {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await listStudioCampaigns({ data: {} });
    setCampaigns(next);
  }, []);

  useEffect(() => {
    void refresh().catch(() => setMessage("Studio data is unavailable."));
  }, [refresh]);

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await createStudioCampaign({
        data: {
          input: {
            tenantId,
            name: form.name.trim(),
            goal: form.goal.trim(),
            offer: form.offer.trim(),
            audience: form.audience.trim(),
            callToAction: form.callToAction.trim(),
            budgetCents: Math.round(Number(form.budgetDollars) * 100),
          },
        },
      });
      setForm(defaultForm);
      await refresh();
      setMessage("Campaign created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Campaign could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function advanceCampaign(campaign: CampaignRecord) {
    setBusy(true);
    setMessage(null);
    try {
      const data = { campaignId: campaign.id };
      if (campaign.status === "draft") await planStudioCampaign({ data });
      if (campaign.status === "awaiting_storyboard_approval") {
        await approveStudioStoryboard({ data });
      }
      if (campaign.status === "approved_for_generation") await renderStudioCampaign({ data });
      if (campaign.status === "awaiting_edit_approval") await approveStudioEdit({ data });
      if (campaign.status === "exported") await handoffStudioExport({ data });
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Campaign could not advance.");
    } finally {
      setBusy(false);
    }
  }

  if (!import.meta.env.DEV) {
    return <main className="min-h-screen bg-zinc-950" />;
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 md:px-8">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-cyan-800">
              <Sparkles className="size-4" /> GivenTake Devs
            </div>
            <h1 className="mt-1 text-2xl font-semibold">Video Agent Studio</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-600">
            <ShieldCheck className="size-4 text-emerald-700" /> Human approval required
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[21rem_minmax(0,1fr)] lg:px-8">
        <section className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Create campaign</h2>
          <form className="mt-5 space-y-4" onSubmit={createCampaign}>
            <Field label="Campaign name">
              <input
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Goal">
              <textarea
                required
                value={form.goal}
                onChange={(event) => setForm({ ...form, goal: event.target.value })}
                className={`${fieldClass} min-h-20`}
              />
            </Field>
            <Field label="Offer">
              <input
                required
                value={form.offer}
                onChange={(event) => setForm({ ...form, offer: event.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Audience">
              <input
                required
                value={form.audience}
                onChange={(event) => setForm({ ...form, audience: event.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="CTA">
              <input
                required
                value={form.callToAction}
                onChange={(event) => setForm({ ...form, callToAction: event.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Generation ceiling (USD)">
              <input
                required
                min="1"
                step="1"
                type="number"
                value={form.budgetDollars}
                onChange={(event) => setForm({ ...form, budgetDollars: event.target.value })}
                className={fieldClass}
              />
            </Field>
            <button disabled={busy} className={`${primaryButton} w-full`} type="submit">
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Create campaign
            </button>
          </form>
        </section>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Production queue</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Storyboard, review, render, export, handoff.
              </p>
            </div>
            <button
              className={secondaryButton}
              disabled={busy}
              onClick={() => void refresh()}
              type="button"
            >
              <RefreshCw className="size-4" /> Refresh
            </button>
          </div>

          {message ? (
            <p className="mt-5 border-l-4 border-cyan-600 bg-cyan-50 px-4 py-3 text-sm text-cyan-950">
              {message}
            </p>
          ) : null}

          <div className="mt-5 space-y-3">
            {campaigns.length === 0 ? (
              <p className="border border-dashed border-zinc-300 px-5 py-12 text-center text-sm text-zinc-600">
                Create a campaign to begin production.
              </p>
            ) : (
              campaigns.map((campaign) => (
                <article
                  key={campaign.id}
                  className="border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold">{campaign.name}</h3>
                      <p className="mt-1 text-sm text-zinc-600">{campaign.goal}</p>
                    </div>
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${statusTone(campaign.status)}`}
                    >
                      {campaign.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <dl className="mt-5 grid gap-4 border-y border-zinc-100 py-4 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-zinc-500">Offer</dt>
                      <dd className="mt-1 font-medium">{campaign.offer}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Audience</dt>
                      <dd className="mt-1 font-medium">{campaign.audience}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Ceiling</dt>
                      <dd className="mt-1 font-medium">
                        ${(campaign.budgetCents / 100).toFixed(2)}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-zinc-600">{campaign.callToAction}</p>
                    <button
                      className={primaryButton}
                      disabled={busy || campaign.status === "handed_off"}
                      onClick={() => void advanceCampaign(campaign)}
                      type="button"
                    >
                      {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
                      {actionLabel(campaign.status)}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-zinc-800">
      {label}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}
