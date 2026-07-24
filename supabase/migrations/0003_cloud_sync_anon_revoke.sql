-- Migration: 0003_cloud_sync_anon_revoke
-- Phase 47 (Cloud Sync) — repo reconciliation for two live follow-up
-- migrations applied directly to the eu-central-1 project during the
-- 47-02 Task 3 [BLOCKING] apply/deploy checkpoint. This file reproduces
-- those live statements verbatim so the migration chain in this repo
-- matches the live database exactly (no drift between `supabase
-- migration list` locally and the live project).
--
-- ROOT CAUSE (why 0002_cloud_sync.sql's revokes were insufficient):
-- Supabase projects ship a default-privileges rule —
--   alter default privileges in schema public
--     grant execute on functions to anon, authenticated, service_role;
-- — which grants `anon` EXECUTE explicitly, per-role, at the moment each
-- function is CREATEd. `revoke ... from public` (what 0002 issued) only
-- removes the PUBLIC pseudo-role grant; it does NOT touch a privilege
-- that was granted directly to the `anon` role by the default-privileges
-- trigger. The same mechanism also grants `anon` table-level TRUNCATE /
-- REFERENCES / TRIGGER / MAINTAIN privileges independently of the
-- select/insert/update/delete revokes 0002 already issued. Both residues
-- were found live during Task 3 verification (T-47-03 zero-anon-access)
-- and are closed here.
--
-- Practical risk of the residue: LOW. auth.uid() is NULL for the anon
-- role, so all three RPCs no-op or error under anon regardless of the
-- EXECUTE grant, and TRUNCATE/REFERENCES/TRIGGER/MAINTAIN are not
-- data-read/write privileges. Still fixed for defense-in-depth and to
-- keep the zero-anon-access invariant literally true, not just
-- practically true.
--
-- Applied live as two separate migrations during the Task 3 checkpoint
-- (`cloud_sync_anon_revoke`, `cloud_sync_anon_revoke_table_all`);
-- combined into one file here for the repo's migration history.

-- 1. Revoke the per-role anon EXECUTE grant on all three sync RPCs --------
-- (0002 only revoked from PUBLIC; the default-privileges trigger grants
-- anon EXECUTE directly at function-creation time, which survives a
-- `revoke ... from public`.)

revoke execute on function public.download_sync_blob() from anon;
revoke execute on function public.upload_sync_blob(text, bigint) from anon;
revoke execute on function public.reset_sync_blob() from anon;

-- 2. Revoke the residual anon table-level ACL on sync_blobs ---------------
-- 0002 revoked select/insert/update/delete from anon; the same
-- default-privileges mechanism also granted anon TRUNCATE/REFERENCES/
-- TRIGGER/MAINTAIN independently. `revoke all` closes every remaining
-- anon grant so sync_blobs carries zero anon ACL entries.

revoke all on table public.sync_blobs from anon;
