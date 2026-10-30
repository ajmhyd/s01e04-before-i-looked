import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { NightDigest } from '../src/digest/types.js';

// U+2014. A hyphen or en dash is not the missing-owner mark.
const EM_DASH = '\u2014';

const MISSING_NIGHT = '1999-01-01';
const EMPTY_NIGHT = '1999-01-02';
const NIGHT = '1999-01-03';

const NIGHT_LOG = [
  '{"at":"2026-10-28T01:00:00+01:00","job":"a/ok","status":"ok","owner":"rook"}',
  '{"at":"2026-10-28T02:00:00+01:00","job":"b/none","status":"ok","owner":null}',
  '{"at":"2026-10-28T03:00:00+01:00","job":"c/fail","status":"fail","owner":"lane-07","error":"quota exceeded"}',
  '{"at":"2026-10-28T04:00:00+01:00","job":"d/retry","status":"retry","owner":"rook","error":"upstream 503"}',
  '{"at":"2026-10-28T04:01:00+01:00","job":"d/retry","status":"retry","owner":"rook","error":"upstream 503"}',
  '{"at":"2026-10-28T04:02:00+01:00","job":"d/retry","status":"retry","owner":"rook","error":"upstream 503"}',
  '{"at":"2026-10-28T04:03:00+01:00","job":"d/retry","status":"ok","owner":"rook"}',
  '{"at":"2026-10-28T05:00:00+01:00","job":"e/bad"',
].join('\n');

const NIGHT_DIGEST: NightDigest = {
  rows: [
    {
      job: 'a/ok',
      owner: 'rook',
      runs: 1,
      retries: 0,
      lastStatus: 'ok',
      lastError: null,
      first: '2026-10-28T01:00:00+01:00',
      last: '2026-10-28T01:00:00+01:00',
    },
    {
      job: 'b/none',
      owner: null,
      runs: 1,
      retries: 0,
      lastStatus: 'ok',
      lastError: null,
      first: '2026-10-28T02:00:00+01:00',
      last: '2026-10-28T02:00:00+01:00',
    },
    {
      job: 'c/fail',
      owner: 'lane-07',
      runs: 1,
      retries: 0,
      lastStatus: 'fail',
      lastError: 'quota exceeded',
      first: '2026-10-28T03:00:00+01:00',
      last: '2026-10-28T03:00:00+01:00',
    },
    {
      job: 'd/retry',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: null,
      first: '2026-10-28T04:00:00+01:00',
      last: '2026-10-28T04:03:00+01:00',
    },
  ],
  badLines: 1,
  counts: { ok: 3, retry: 3, fail: 1 },
};

function app(runsDir: string) {
  return createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
}

// Temp runs dir only. `runs/` is read-only and must not be written.
async function withRuns(files: Record<string, string>, run: (runsDir: string) => Promise<void>) {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  try {
    for (const [name, body] of Object.entries(files)) {
      writeFileSync(join(runsDir, name), body);
    }
    process.env.LANE_MARKER = 'TEST-MARKER';
    await run(runsDir);
  } finally {
    rmSync(runsDir, { recursive: true, force: true });
  }
}

function tableRow(html: string, job: string): string {
  const rows = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  const row = rows.find((candidate) => candidate.includes(job)) ?? '';
  expect(row).toContain(job);
  return row;
}

describe('digest routes', () => {
  it('returns 404 when the night file does not exist', async () => {
    await withRuns({}, async (runsDir) => {
      const rig = app(runsDir);
      expect((await rig.request(`/digest/${MISSING_NIGHT}`)).status).toBe(404);
      expect((await rig.request(`/api/digest/${MISSING_NIGHT}`)).status).toBe(404);
    });
  });

  it('renders an empty night as nothing ran', async () => {
    await withRuns({ [`${EMPTY_NIGHT}.jsonl`]: '' }, async (runsDir) => {
      const rig = app(runsDir);
      const page = await rig.request(`/digest/${EMPTY_NIGHT}`);
      const api = await rig.request(`/api/digest/${EMPTY_NIGHT}`);

      expect(page.status).toBe(200);
      expect(page.headers.get('content-type')).toContain('text/html');
      const html = await page.text();
      expect(html).toContain('nothing ran');
      expect(html).toContain('TEST-MARKER');

      expect(api.status).toBe(200);
      expect(api.headers.get('content-type')).toContain('application/json');
      expect(await api.json()).toEqual({
        rows: [],
        badLines: 0,
        counts: { ok: 0, retry: 0, fail: 0 },
      });
    });
  });

  it('returns the same jobs in order when a night has a bad line', async () => {
    await withRuns({ [`${NIGHT}.jsonl`]: NIGHT_LOG }, async (runsDir) => {
      const rig = app(runsDir);
      const page = await rig.request(`/digest/${NIGHT}`);
      const api = await rig.request(`/api/digest/${NIGHT}`);

      expect(page.status).toBe(200);
      expect(api.status).toBe(200);
      expect(page.headers.get('content-type')).toContain('text/html');
      expect(api.headers.get('content-type')).toContain('application/json');

      const html = await page.text();
      const body = (await api.json()) as NightDigest;
      expect(body).toEqual(NIGHT_DIGEST);
      expect(body.badLines).toBeGreaterThanOrEqual(1);

      const jobs = body.rows.map((row) => row.job);
      expect(jobs).toEqual(['a/ok', 'b/none', 'c/fail', 'd/retry']);
      let at = -1;
      for (const job of jobs) {
        const next = html.indexOf(job);
        expect(next).toBeGreaterThan(at);
        at = next;
      }
      expect(html).toContain('TEST-MARKER');

      for (const row of body.rows) {
        const htmlRow = tableRow(html, row.job);
        if (row.retries >= 3 || row.lastStatus === 'fail') expect(htmlRow).toContain('warn');
        else expect(htmlRow).not.toContain('warn');
        if (row.owner === null) expect(htmlRow).toContain(EM_DASH);
      }
    });
  });
});
