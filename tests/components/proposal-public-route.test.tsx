import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const state = { data: null as unknown };
vi.mock("@/lib/proposal-public", () => ({ viewProposal: vi.fn(), decideProposal: vi.fn() }));
vi.mock("@/components/site-chrome", () => ({ SiteHeader: () => null, SiteFooter: () => null }));
vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<typeof import("@tanstack/react-router")>()),
  createFileRoute: () => (opts: Record<string, unknown>) => ({
    ...opts,
    useLoaderData: () => state.data,
    useParams: () => ({ code: "x".repeat(43) }),
  }),
}));

const { Route } = await import("../../src/routes/proposal.$code.tsx");
const ProposalPage = Route.component as () => React.JSX.Element;

const proposal = (overrides = {}) => ({
  id: "p",
  title: "Website",
  summary: "",
  timeline: "3 weeks",
  valid_until: "2099-01-01",
  state: "open",
  accepted_option: null,
  client: "Sample Roofing",
  lines: [
    {
      name: "Standard website",
      description: "",
      quantity: 1,
      unit: "each",
      unit_price_cents: 99900,
      recurring: false,
      price_is_from: false,
      includes: [],
      excludes: [],
      discount_reason: null,
    },
  ],
  ...overrides,
});

describe("public proposal page", () => {
  beforeEach(() => {
    state.data = null;
  });

  it("explains an invalid link", () => {
    render(<ProposalPage />);
    expect(screen.getByText(/isn.t valid/)).toBeTruthy();
  });

  it("shows the expired message with a contact link (Review Focus 3)", () => {
    state.data = proposal({ state: "expired" });
    render(<ProposalPage />);
    expect(screen.getByRole("status").textContent).toMatch(/expired/);
    expect(screen.getByRole("link", { name: "Contact us" })).toBeTruthy();
  });

  it("enables Accept only after option, name and consent", async () => {
    state.data = proposal();
    render(<ProposalPage />);
    const accept = screen.getByRole("button", { name: "Accept proposal" });
    expect((accept as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByText("Pay in full"));
    await userEvent.type(screen.getByLabelText(/full name/i), "Alex Fixture");
    expect((accept as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("checkbox"));
    expect((accept as HTMLButtonElement).disabled).toBe(false);
  });

  it("offers own-it for a $999 site", () => {
    state.data = proposal();
    render(<ProposalPage />);
    expect(screen.getByText("Own-it plan")).toBeTruthy();
  });
});
