# Deferred Items — Phase 03

## Pre-existing TypeScript Errors (Out of Scope)

### JobsManager.tsx scalar field references

**Found during:** 03-02, Task 1

**Issue:** `src/components/JobsManager.tsx` line 217 references `job.filamentId` and `job.filamentGrams` which were removed from `PrintJob` in Phase 01. The `PrintJob` type now uses `filaments: FilamentUsage[]`.

**Why deferred:** `JobsManager.tsx` is not in the `files_modified` list for plans 03-02 or 03-03. This is a pre-existing inconsistency introduced when Phase 01 updated `PrintJob` without updating all consumers. Plan 03-03 (or a follow-up) should fix `JobsManager.tsx` to use `job.filaments[0]?.filamentId` etc.

**Files affected:** `src/components/JobsManager.tsx`
