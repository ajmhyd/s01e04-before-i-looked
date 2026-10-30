import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NightMissingError, readNight } from '../src/digest/types.js';

const runsDir = join(import.meta.dirname, '..', 'runs');

describe('readNight', () => {
  it('reads 2026-10-28 as 5 jobs and 1 bad line', () => {
    const night = readNight(runsDir, '2026-10-28');
    expect(night.badLines).toBe(1);
    expect(night.rows.map((row) => row.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night.rows).toHaveLength(5);
    expect(night.counts).toEqual({ ok: 10, retry: 4, fail: 1 });

    const refresh = night.rows.find((row) => row.job === 'fixtures/refresh');
    expect(refresh).toMatchObject({
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: null,
      first: '2026-10-29T01:30:00+01:00',
      last: '2026-10-29T01:37:00+01:00',
    });

    const backup = night.rows.find((row) => row.job === 'notes/backup');
    expect(backup).toMatchObject({
      owner: 'lane-07',
      runs: 1,
      retries: 0,
      lastStatus: 'fail',
      lastError: 'quota exceeded',
    });

    const render = night.rows.find((row) => row.job === 'digest/render');
    expect(render?.owner).toBeNull();
  });
});

describe('readNight edges', () => {
  it('throws when the night file is missing', () => {
    expect(() => readNight(runsDir, '1999-01-01')).toThrow(NightMissingError);
  });
});
