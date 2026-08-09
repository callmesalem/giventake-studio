import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthenticatedLayout } from "../../routes/_app";
import { LoginForm } from "../../routes/login";
import { TenantSelectionForm } from "../../routes/select-tenant";

describe("login route", () => {
  it("submits a magic-link request and shows a non-enumerating confirmation", async () => {
    const requestLink = vi.fn().mockResolvedValue({ accepted: true });
    render(<LoginForm requestLink={requestLink} />);

    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send sign-in link" }));

    await waitFor(() => expect(requestLink).toHaveBeenCalledWith({ email: "owner@example.com" }));
    expect(
      screen.getByText("If the address is eligible, a sign-in link is on its way."),
    ).toBeVisible();
  });
});

describe("tenant-selection route", () => {
  it("selects one of the authenticated user's available tenants", async () => {
    const chooseTenant = vi.fn().mockResolvedValue({ selected: true });
    render(
      <TenantSelectionForm
        tenants={[
          { id: TENANT_A, displayName: "GivenTake Devs", access: "client_owner" },
          { id: TENANT_B, displayName: "Pilot Adjusters", access: "client_owner" },
        ]}
        chooseTenant={chooseTenant}
        onSelected={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue with Pilot Adjusters" }));

    await waitFor(() => expect(chooseTenant).toHaveBeenCalledWith({ tenantId: TENANT_B }));
  });
});

describe("authenticated layout route", () => {
  it("signs out from the quiet application shell", async () => {
    const performSignOut = vi.fn().mockResolvedValue({ signedOut: true });
    render(
      <AuthenticatedLayout
        content={<p>Overview content</p>}
        performSignOut={performSignOut}
        onSignedOut={vi.fn()}
      />,
    );

    expect(screen.getByText("Overview content")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(performSignOut).toHaveBeenCalledOnce());
  });
});

const TENANT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
