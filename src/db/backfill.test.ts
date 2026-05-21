import { describe, it, expect } from 'vitest';
import { backfillTagsOnJob } from './backfill';

describe('backfillTagsOnJob', () => {
  it('sets tags=[] when the field is missing (most common v5 path)', () => {
    const job: Record<string, unknown> = { id: '1' };
    backfillTagsOnJob(job);
    expect(job.tags).toEqual([]);
  });

  it('preserves an existing array of tags (idempotency / re-run safety)', () => {
    const job: Record<string, unknown> = { id: '1', tags: ['a', 'b'] };
    backfillTagsOnJob(job);
    expect(job.tags).toEqual(['a', 'b']);
  });

  it('replaces a string tags value with [] (manually-edited IndexedDB corruption)', () => {
    const job: Record<string, unknown> = { id: '1', tags: 'oops' };
    backfillTagsOnJob(job);
    expect(job.tags).toEqual([]);
  });

  it('replaces null tags with [] (null-injected row)', () => {
    const job: Record<string, unknown> = { id: '1', tags: null };
    backfillTagsOnJob(job);
    expect(job.tags).toEqual([]);
  });

  it('replaces a number tags value with [] (broad Array.isArray guard)', () => {
    const job: Record<string, unknown> = { id: '1', tags: 42 };
    backfillTagsOnJob(job);
    expect(job.tags).toEqual([]);
  });
});
