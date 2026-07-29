export function TrustedPartner() {
  const logos = ["Northlane", "Meridian", "Harbor & Co.", "Cedar", "Fieldwork", "Studio Ledger"];

  return (
    <section className="border-b border-hairline bg-paper">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <p className="text-center text-[12px] font-medium uppercase tracking-wider text-muted-ink">
          Trusted by teams shipping real software
        </p>
        <div className="mt-8 grid grid-cols-2 items-center gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-6">
          {logos.map((l) => (
            <div
              key={l}
              className="flex items-center justify-center text-[18px] font-semibold tracking-tight text-muted-ink/70 grayscale transition hover:text-ink hover:grayscale-0"
            >
              {l}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
