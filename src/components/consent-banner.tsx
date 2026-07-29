import { useEffect, useState } from "react";
import { useConsent, type ConsentCategory } from "@/lib/consent";
import { initTracking } from "@/lib/tracking";

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

  // Boot trackers with current state; they will re-apply on every change event.
  useEffect(() => {
    if (!ready) return;
    initTracking(() => state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      {!decided && !preferencesOpen && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Cookie and privacy notice"
          className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-3xl rounded-2xl border border-hairline bg-white/95 p-5 shadow-lift backdrop-blur-xl sm:inset-x-6 sm:bottom-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex-1">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-ink">
                Your privacy
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-ink">
                We use strictly necessary cookies to run the site. With your permission, we also use
                analytics and marketing cookies to measure how the site is used and to improve our ads.
                You can change or withdraw consent at any time from the footer.
              </p>
              <p className="mt-2 text-[12px] text-muted-ink">
                Read our{" "}
                <a href="/privacy" className="underline hover:text-ink">
                  Privacy Policy
                </a>{" "}
                and{" "}
                <a href="/cookies" className="underline hover:text-ink">
                  Cookie Policy
                </a>
                .
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
              <button
                type="button"
                onClick={acceptAll}
                className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={rejectAll}
                className="rounded-full border border-hairline bg-paper px-4 py-2 text-[13px] font-medium text-ink hover:bg-white"
              >
                Reject all
              </button>
              <button
                type="button"
                onClick={openPreferences}
                className="rounded-full px-4 py-2 text-[13px] font-medium text-muted-ink hover:text-ink"
              >
                Manage preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {preferencesOpen && (
        <PreferencesDialog
          initial={state}
          onCancel={closePreferences}
          onAcceptAll={acceptAll}
          onRejectAll={rejectAll}
          onSave={save}
        />
      )}

      {/* Persistent floating trigger so users can revoke consent at any time. */}
      {decided && !preferencesOpen && (
        <button
          type="button"
          onClick={openPreferences}
          aria-label="Manage cookie preferences"
          className="fixed bottom-4 left-4 z-40 hidden rounded-full border border-hairline bg-white/90 px-3 py-1.5 text-[11px] font-medium text-muted-ink shadow-soft backdrop-blur hover:text-ink md:inline-flex"
        >
          Cookie settings
        </button>
      )}
    </>
  );
}

function PreferencesDialog({
  initial,
  onCancel,
  onAcceptAll,
  onRejectAll,
  onSave,
}: {
  initial: Record<ConsentCategory, boolean>;
  onCancel: () => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onSave: (next: Partial<Record<ConsentCategory, boolean>>) => void;
}) {
  const [draft, setDraft] = useState(initial);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cookie preferences"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 p-3 backdrop-blur-sm sm:items-center sm:p-6"
    >
      <div className="w-full max-w-lg rounded-2xl border border-hairline bg-white p-6 shadow-lift">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-ink">
              Preferences
            </p>
            <h2 className="mt-1 font-display text-2xl font-medium tracking-tight text-ink">
              Cookie settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="rounded-full p-1 text-muted-ink hover:bg-paper hover:text-ink"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-muted-ink">
          Choose which categories you allow. You can change this any time from the "Cookie settings"
          link in the footer.
        </p>

        <div className="mt-5 divide-y divide-hairline rounded-xl border border-hairline">
          {CATEGORIES.map((c) => {
            const checked = c.required ? true : draft[c.key];
            return (
              <label
                key={c.key}
                className="flex cursor-pointer items-start gap-4 p-4 has-[:disabled]:cursor-not-allowed"
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-ink"
                  checked={checked}
                  disabled={c.required}
                  onChange={(e) => setDraft((d) => ({ ...d, [c.key]: e.target.checked }))}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-medium text-ink">{c.label}</span>
                    {c.required && (
                      <span className="rounded-full bg-paper px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-ink">
                        Always on
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted-ink">
                    {c.description}
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onRejectAll}
            className="rounded-full border border-hairline bg-paper px-4 py-2 text-[13px] font-medium text-ink hover:bg-white"
          >
            Reject all
          </button>
          <button
            type="button"
            onClick={onAcceptAll}
            className="rounded-full border border-hairline bg-paper px-4 py-2 text-[13px] font-medium text-ink hover:bg-white"
          >
            Accept all
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
          >
            Save choices
          </button>
        </div>
      </div>
    </div>
  );
}
