-- RECONCILIATION PLACEHOLDER (no-op on remote).
--
-- Migration version 20260822234428 was applied to the live giventake-studio
-- database from the VPS "home" checkout but its file never reached this laptop
-- checkout. Per the deploy record it added the pipeline tables + convert_won_deal.
--
-- This placeholder exists only so local migration history matches the remote
-- schema_migrations table (matched by version, not content), which unblocks
-- `supabase db push` for later migrations. Because 20260822234428 is already
-- recorded as applied on remote, push will NOT execute this file's contents.
--
-- TODO(Salem): backfill the real SQL for this version from the VPS checkout so a
-- clean `db reset` reproduces the pipeline/convert_won_deal objects.

select 1;
