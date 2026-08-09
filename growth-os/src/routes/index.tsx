import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: GrowthOsHome,
});

function GrowthOsHome() {
  return (
    <main className="app-shell">
      <section className="workspace" aria-labelledby="page-title">
        <p className="eyebrow">GivenTake</p>
        <h1 id="page-title">Growth OS</h1>
        <p className="summary">The secure workspace for lead, channel, and revenue operations.</p>
      </section>
    </main>
  );
}
