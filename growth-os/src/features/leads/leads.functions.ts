import { createServerFn } from "@tanstack/react-start";
import {
  leadIdInputSchema,
  leadListInputSchema,
  reopenLeadInputSchema,
  revenueInputSchema,
  statusChangeSchema,
} from "./lead.schemas";

export const listLeads = createServerFn({ method: "GET" })
  .validator((input: unknown) => leadListInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { listLeads: loadLeads } = await import("./leads.server");
    return loadLeads(data);
  });

export const getLead = createServerFn({ method: "GET" })
  .validator((input: unknown) => leadIdInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { getLead: loadLead } = await import("./leads.server");
    return loadLead(data);
  });

export const changeLeadStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) => statusChangeSchema.parse(input))
  .handler(async ({ data }) => {
    const { changeLeadStatus: changeStatus } = await import("./leads.server");
    return changeStatus(data);
  });

export const reopenLead = createServerFn({ method: "POST" })
  .validator((input: unknown) => reopenLeadInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { reopenLead: reopen } = await import("./leads.server");
    return reopen(data);
  });

export const recordRevenue = createServerFn({ method: "POST" })
  .validator((input: unknown) => revenueInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { recordRevenue: saveRevenue } = await import("./leads.server");
    return saveRevenue(data);
  });
