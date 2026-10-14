-- Three functions were granted to crm_agent only, so agent_sami (the role Hermes
-- connects as) could not run the demo-site builder or read giveaway entries.
-- crm_agent keeps its grants until the cutover revokes it (audit §8 step 9).
grant execute on function
  public.demo_requests_pending(),
  public.demo_site_set_result(uuid, text, text, text),
  public.giveaway_entries_list()
  to agent_sami;
