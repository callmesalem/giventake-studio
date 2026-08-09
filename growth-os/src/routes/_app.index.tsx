import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/")({
  component: GrowthOsHome,
});

function GrowthOsHome() {
  return (
    <main className="app-shell">
      <section className="workspace" aria-labelledby="page-title">
        <h1 id="page-title">Overview</h1>
        <p className="summary">No operational data is available.</p>
      </section>
    </main>
  );
}
