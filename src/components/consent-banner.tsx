import { useEffect, useId, useState } from "react";
import { useConsent, type ConsentCategory } from "@/lib/consent";
import { initTracking } from "@/lib/tracking";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

type CategoryMeta = {
  key: ConsentCategory;
  label: string;
  required?: boolean;
  description: string;
};

const CATEGORIES: CategoryMeta[] = [
  {
    key: "necessary",
    label: "Strictly necessary",
    required: true,
    description:
      "Required for the site to function: security, load balancing, and remembering that you've reviewed this notice. Cannot be turned off.",
  },
  {
    key: "preferences",
    label: "Preferences",
    description:
      "Remembers UI choices like theme or language so the site looks the same on your next visit.",
  },
  {
    key: "analytics",
    label: "Analytics",
    description:
      "Google Analytics 4 with IP anonymization. Helps us understand which pages get read and where visitors drop off. Aggregated only.",
  },
  {
    key: "marketing",
    label: "Marketing",
    description:
      "Meta, TikTok, and LinkedIn pixels used to measure ad performance and show relevant content on those platforms. No sensitive categories are shared.",
  },
];

// Shared focus-visible ring for custom-styled buttons.
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-white";

export function ConsentBanner() {
  const {
    ready,
    decided,
    state,
    acceptAll,
    rejectAll,
    save,
    openPreferences,
    closePreferences,
    preferencesOpen,
  } = useConsent();

  const titleId = useId();
  const descId = useId();

  // Boot trackers with current state; they will re-apply on every change event.
  useEffect(() => {
    if (!ready) return;
    initTracking(() => state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready) return null;

  const showBanner = !decided && !preferencesOpen;

  return (
    <>
      {showBanner && (
        <section
          role="region"
          aria-labelledby={titleId}
          aria-describedby={descId}
          className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-3xl rounded-2xl border border-hairline bg-white/95 p-5 shadow-lift backdrop-blur-xl sm:inset-x-6 sm:bottom-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex-1">
              <h2
                id={titleId}
                className="text-[12px] font-semibold uppercase tracking-wider text-muted-ink"
              >
                Your privacy
              </h2>
              <p id={descId} className="mt-2 text-[14px] leading-relaxed text-ink">
                We use strictly necessary cookies to run the site. With your permission, we also use
                analytics and marketing cookies to measure how the site is used and to improve our
                ads. You can change or withdraw consent at any time from the footer.
              </p>
              <p className="mt-2 text-[12px] text-muted-ink">
                Read our{" "}
                <a href="/privacy" className={`underline hover:text-ink ${focusRing} rounded-sm`}>
                  Privacy Policy
                </a>{" "}
                and{" "}
                <a href="/cookies" className={`underline hover:text-ink ${focusRing} rounded-sm`}>
                  Cookie Policy
                </a>
                .
              </p>
            </div>
            <div
              className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch"
              role="group"
              aria-label="Consent choices"
            >
              <button
                type="button"
                onClick={acceptAll}
                className={`min-h-11 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 ${focusRing}`}
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={rejectAll}
                className={`min-h-11 rounded-full border border-hairline bg-paper px-4 py-2 text-[13px] font-medium text-ink hover:bg-white ${focusRing}`}
              >
                Reject all
              </button>
              <button
                type="button"
                data-consent-trigger="banner"
                onClick={openPreferences}
                className={`min-h-11 rounded-full px-4 py-2 text-[13px] font-medium text-muted-ink hover:text-ink ${focusRing}`}
              >
                Manage preferences
              </button>
            </div>
          </div>
        </section>
      )}

      <PreferencesDialog
        open={preferencesOpen}
        initial={state}
        onOpenChange={(open) => {
          if (!open) closePreferences();
        }}
        onAcceptAll={acceptAll}
        onRejectAll={rejectAll}
        onSave={save}
      />

      {/* Persistent trigger so users can revoke consent at any time. */}
      {decided && !preferencesOpen && (
        <button
          type="button"
          data-consent-trigger="persistent"
          onClick={openPreferences}
          aria-label="Manage cookie preferences"
          className={`fixed bottom-4 left-4 z-40 inline-flex min-h-9 items-center rounded-full border border-hairline bg-white/90 px-3 py-1.5 text-[11px] font-medium text-muted-ink shadow-soft backdrop-blur hover:text-ink ${focusRing}`}
        >
          Cookie settings
        </button>
      )}
    </>
  );
}

function PreferencesDialog({
  open,
  initial,
  onOpenChange,
  onAcceptAll,
  onRejectAll,
  onSave,
}: {
  open: boolean;
  initial: Record<ConsentCategory, boolean>;
  onOpenChange: (open: boolean) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onSave: (next: Partial<Record<ConsentCategory, boolean>>) => void;
}) {
  const [draft, setDraft] = useState(initial);

  // Reset draft to the latest saved state whenever the dialog reopens,
  // so a cancel doesn't leak into the next visit.
  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="max-w-lg rounded-2xl border border-hairline bg-white p-6 shadow-lift sm:rounded-2xl"
      >
        <DialogHeader className="text-left">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-ink">
            Preferences
          </p>
          <DialogTitle className="mt-1 font-display text-2xl font-medium tracking-tight text-ink">
            Cookie settings
          </DialogTitle>
          <DialogDescription className="mt-2 text-[13px] leading-relaxed text-muted-ink">
            Choose which categories you allow. You can change this any time from the "Cookie
            settings" link in the footer.
          </DialogDescription>
        </DialogHeader>

        <ul role="list" className="mt-5 divide-y divide-hairline rounded-xl border border-hairline">
          {CATEGORIES.map((c) => (
            <CategoryRow
              key={c.key}
              meta={c}
              checked={c.required ? true : draft[c.key]}
              onChange={(next) => setDraft((d) => ({ ...d, [c.key]: next }))}
            />
          ))}
        </ul>

        <div
          className="mt-5 flex flex-wrap justify-end gap-2"
          role="group"
          aria-label="Save cookie choices"
        >
          <button
            type="button"
            onClick={onRejectAll}
            className={`min-h-11 rounded-full border border-hairline bg-paper px-4 py-2 text-[13px] font-medium text-ink hover:bg-white ${focusRing}`}
          >
            Reject all
          </button>
          <button
            type="button"
            onClick={onAcceptAll}
            className={`min-h-11 rounded-full border border-hairline bg-paper px-4 py-2 text-[13px] font-medium text-ink hover:bg-white ${focusRing}`}
          >
            Accept all
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className={`min-h-11 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 ${focusRing}`}
          >
            Save choices
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategoryRow({
  meta,
  checked,
  onChange,
}: {
  meta: CategoryMeta;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const labelId = useId();
  const descId = useId();
  return (
    <li className="flex items-start gap-4 p-4">
      <Checkbox
        id={`consent-${meta.key}`}
        checked={checked}
        disabled={meta.required}
        onCheckedChange={(v) => onChange(v === true)}
        aria-labelledby={labelId}
        aria-describedby={descId}
        aria-required={meta.required || undefined}
        className="mt-0.5"
      />
      <label
        htmlFor={`consent-${meta.key}`}
        className={`flex-1 ${meta.required ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className="flex items-center gap-2">
          <span id={labelId} className="text-[14px] font-medium text-ink">
            {meta.label}
          </span>
          {meta.required && (
            <span className="rounded-full bg-paper px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-ink">
              Always on
            </span>
          )}
        </span>
        <span id={descId} className="mt-1 block text-[12.5px] leading-relaxed text-muted-ink">
          {meta.description}
        </span>
      </label>
    </li>
  );
}
