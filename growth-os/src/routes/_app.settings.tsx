import { createFileRoute } from "@tanstack/react-router";
import { Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { getBrand, updateBrand } from "@/features/branding/brand.functions";
import type { BrandInput } from "@/features/branding/brand.schemas";

type BrandSettingsFormProps = {
  brand: BrandInput;
  saveBrand?: (brand: BrandInput) => Promise<{ updated: true }>;
};

export function BrandSettingsForm({
  brand,
  saveBrand = (input) => updateBrand({ data: input }),
}: BrandSettingsFormProps) {
  const [draft, setDraft] = useState(brand);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  function updateField<Key extends keyof BrandInput>(key: Key, value: BrandInput[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    try {
      await saveBrand(draft);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form className="grid max-w-3xl gap-7" onSubmit={handleSubmit}>
      <div className="grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-800">
          Display name
          <input
            className="h-10 rounded border border-slate-300 bg-white px-3 font-normal text-slate-950 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
            maxLength={120}
            onChange={(event) => updateField("displayName", event.target.value)}
            required
            value={draft.displayName}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-800">
          Report name
          <input
            className="h-10 rounded border border-slate-300 bg-white px-3 font-normal text-slate-950 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
            maxLength={120}
            onChange={(event) => updateField("reportName", event.target.value)}
            required
            value={draft.reportName}
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-slate-800">
        Logo URL
        <input
          className="h-10 rounded border border-slate-300 bg-white px-3 font-normal text-slate-950 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
          onChange={(event) => updateField("logoUrl", event.target.value)}
          required
          type="url"
          value={draft.logoUrl}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        {(
          [
            ["primaryColor", "Primary color"],
            ["accentColor", "Accent color"],
            ["onPrimaryColor", "Text on primary"],
          ] as const
        ).map(([key, label]) => (
          <label className="grid gap-2 text-sm font-semibold text-slate-800" key={key}>
            {label}
            <span className="flex h-10 items-center gap-3 rounded border border-slate-300 bg-white px-2">
              <input
                aria-label={label}
                className="h-7 w-9 cursor-pointer border-0 bg-transparent p-0"
                onChange={(event) => updateField(key, event.target.value)}
                type="color"
                value={draft[key]}
              />
              <span className="font-mono text-xs font-normal text-slate-600">{draft[key]}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="flex items-center gap-4 border-t border-slate-200 pt-5">
        <button
          className="inline-flex h-10 items-center gap-2 rounded px-4 text-sm font-semibold disabled:cursor-wait disabled:bg-slate-400"
          disabled={status === "saving"}
          style={{ backgroundColor: draft.primaryColor, color: draft.onPrimaryColor }}
          type="submit"
        >
          <Save aria-hidden="true" size={16} />
          Save brand
        </button>
        {status === "saved" ? <p className="m-0 text-sm text-emerald-700">Saved.</p> : null}
        {status === "error" ? (
          <p className="m-0 text-sm text-red-700" role="alert">
            Brand settings could not be saved.
          </p>
        ) : null}
      </div>
    </form>
  );
}

function BrandSettingsRoute() {
  const brand = Route.useLoaderData();
  return (
    <section aria-labelledby="settings-title" className="border-t border-slate-300 pt-7">
      <h1 className="text-2xl" id="settings-title">
        Brand settings
      </h1>
      <BrandSettingsForm brand={brand} />
    </section>
  );
}

export const Route = createFileRoute("/_app/settings")({
  loader: () => getBrand(),
  component: BrandSettingsRoute,
});
