import { describe, test, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Timeline,
  EntityForm,
  Disclosure,
  OwnerPicker,
  Field,
  FieldList,
  LinkedTable,
  EmptyState,
} from "@/components/crm/ui";

/**
 * What only exists once React has rendered.
 *
 * The pure logic — sanitising, gates, money, the allowlist — is covered by the
 * node --test suite and needs no browser. These cover the things a user
 * actually meets: whether an empty list says something useful, whether a
 * failing save shows a message they can act on, whether a control that cannot
 * work is hidden rather than shown broken.
 */

describe("Timeline", () => {
  const event = (over = {}) => ({
    id: "1",
    at: "2026-08-21T12:00:00.000Z",
    kind: "agent",
    title: "Qualified",
    detail: "score 66",
    actor: "agent:piper",
    ...over,
  });

  test("says nothing has happened rather than rendering an empty list", () => {
    render(<Timeline events={[]} />);
    expect(screen.getByText(/nothing has happened here yet/i)).toBeTruthy();
  });

  test("shows the actor, so agent activity is distinguishable from human", () => {
    render(<Timeline events={[event()]} />);
    expect(screen.getByText("agent:piper")).toBeTruthy();
    expect(screen.getByText("Qualified")).toBeTruthy();
    expect(screen.getByText("score 66")).toBeTruthy();
  });

  test("renders an event with no detail or actor without inventing either", () => {
    render(<Timeline events={[event({ detail: null, actor: null })]} />);
    expect(screen.getByText("Qualified")).toBeTruthy();
    expect(screen.queryByText("agent:piper")).toBeNull();
  });

  test("omits the timestamp when there is none rather than showing Invalid Date", () => {
    const { container } = render(<Timeline events={[event({ at: null })]} />);
    expect(container.querySelector("time")).toBeNull();
    expect(container.textContent).not.toMatch(/invalid date/i);
  });

  // Phase 2: a contact's own deals now appear on the timeline as a distinct kind,
  // so a hire sees the person's pipeline. This proves the deal event renders and
  // is visually distinguishable (its own dot tone), not just that the shaper runs.
  test("renders a deal event with its own dot tone so pipeline stands apart", () => {
    const { container } = render(
      <Timeline
        events={[
          event({
            id: "dl-1",
            kind: "deal",
            title: "Website rebuild",
            detail: "Stage: Proposal sent · $12,000",
            actor: null,
          }),
        ]}
      />,
    );
    expect(screen.getByText("Website rebuild")).toBeTruthy();
    expect(screen.getByText("Stage: Proposal sent · $12,000")).toBeTruthy();
    expect(container.querySelector(".bg-fuchsia-500")).toBeTruthy();
  });
});

describe("Field", () => {
  test("renders an em dash for an empty value instead of a blank gap", () => {
    render(
      <FieldList>
        <Field label="Email">{null}</Field>
      </FieldList>,
    );
    expect(screen.getByText("—")).toBeTruthy();
  });

  test("renders the value when there is one", () => {
    render(
      <FieldList>
        <Field label="Email">salem@giventakedevs.com</Field>
      </FieldList>,
    );
    expect(screen.getByText("salem@giventakedevs.com")).toBeTruthy();
  });
});

describe("EntityForm", () => {
  const fields = [{ name: "name", label: "Name", required: true }];

  test("submits the typed values to the handler", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    render(<EntityForm fields={fields} submitLabel="Save" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/name/i), "Butterfly Support");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ name: "Butterfly Support" });
  });

  test("shows the failure message from the server, not a generic one", async () => {
    // The database says things like "cannot publish review without permission".
    // That sentence tells a user what to do; "something went wrong" does not.
    const onSubmit = vi.fn().mockRejectedValue(new Error("Amount must be a positive number"));
    render(<EntityForm fields={fields} submitLabel="Save" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/name/i), "x");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Amount must be a positive number");
  });

  test("re-enables the button after a failure so the user can retry", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("nope"));
    render(<EntityForm fields={fields} submitLabel="Save" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/name/i), "x");
    const button = screen.getByRole("button", { name: "Save" });
    await userEvent.click(button);

    await screen.findByRole("alert");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(false),
    );
  });

  test("marks a required field as required rather than relying on the server", () => {
    render(<EntityForm fields={fields} submitLabel="Save" onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/name/i).hasAttribute("required")).toBe(true);
  });

  test("renders a select with the given options", () => {
    render(
      <EntityForm
        fields={[
          {
            name: "stage",
            label: "Stage",
            type: "select",
            options: [
              { value: "a", label: "Lead arrives" },
              { value: "b", label: "Close" },
            ],
          },
        ]}
        submitLabel="Save"
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByRole("option", { name: "Lead arrives" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Close" })).toBeTruthy();
  });

  test("renders a checkbox unticked by default", () => {
    // Permission to publish, AI processing consent: both must start off.
    render(
      <EntityForm
        fields={[{ name: "permissionObtained", label: "Permission", type: "checkbox" }]}
        submitLabel="Save"
        onSubmit={vi.fn()}
      />,
    );
    const box = screen.getByLabelText(/permission/i) as HTMLInputElement;
    expect(box.type).toBe("checkbox");
    expect(box.checked).toBe(false);
  });
});

describe("Disclosure", () => {
  test("hides its contents until opened", async () => {
    render(
      <Disclosure label="Add note">
        <p>the form</p>
      </Disclosure>,
    );
    expect(screen.queryByText("the form")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Add note" }));
    expect(screen.getByText("the form")).toBeTruthy();
  });
});

describe("OwnerPicker", () => {
  const members = [
    { userId: "u1", email: "salem@giventakedevs.com", fullName: "Salem" },
    { userId: "u2", email: "awab@giventakedevs.com", fullName: "" },
  ];

  test("offers Unassigned as a real choice", () => {
    render(<OwnerPicker members={members} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("option", { name: "Unassigned" })).toBeTruthy();
  });

  test("falls back to the email when a member has no name", () => {
    render(<OwnerPicker members={members} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("option", { name: "awab@giventakedevs.com" })).toBeTruthy();
  });

  test("passes null when Unassigned is chosen, not an empty string", async () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    render(<OwnerPicker members={members} value="u1" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "");
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
  });

  test("surfaces a failed assignment instead of silently reverting", async () => {
    const onChange = vi.fn().mockRejectedValue(new Error("That record cannot be assigned"));
    render(<OwnerPicker members={members} value={null} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "u1");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("cannot be assigned");
  });
});

describe("LinkedTable", () => {
  test("says the list is empty rather than rendering a headed table with no rows", () => {
    render(<LinkedTable columns={["Name"]} rows={[]} />);
    expect(screen.getByText(/nothing here yet/i)).toBeTruthy();
  });

  test("links the first cell of each row to the record", () => {
    render(
      <LinkedTable
        columns={["Name", "Stage"]}
        rows={[{ href: "/crm/deals/abc", cells: ["Probe deal", "Close"] }]}
      />,
    );
    const link = screen.getByRole("link", { name: "Probe deal" });
    expect(link.getAttribute("href")).toBe("/crm/deals/abc");
  });
});

describe("EmptyState", () => {
  test("renders the explanation it is given", () => {
    render(<EmptyState>No clients yet.</EmptyState>);
    expect(screen.getByText("No clients yet.")).toBeTruthy();
  });
});
