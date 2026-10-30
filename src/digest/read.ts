import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NightMissingError, type DigestRow, type JobStatus, type NightDigest, type StatusCounts } from './types.js';

const STATUSES = new Set<JobStatus>(['ok', 'retry', 'fail']);

type ParsedLine = {
  at: string;
  job: string;
  status: JobStatus;
  owner: string | null;
  error: string | null;
};

function parseLine(raw: string): ParsedLine | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.at !== 'string' || row.at === '') return null;
  if (typeof row.job !== 'string' || row.job === '') return null;
  if (typeof row.status !== 'string' || !STATUSES.has(row.status as JobStatus)) return null;
  if (row.owner !== null && row.owner !== undefined && typeof row.owner !== 'string') return null;
  if (row.error !== undefined && typeof row.error !== 'string') return null;
  return {
    at: row.at,
    job: row.job,
    status: row.status as JobStatus,
    owner: typeof row.owner === 'string' ? row.owner : null,
    error: typeof row.error === 'string' ? row.error : null,
  };
}

export function readNight(runsDir: string, night: string): NightDigest {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) throw new NightMissingError(night);

  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') throw new NightMissingError(night);
    throw err;
  }

  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  let badLines = 0;
  const byJob = new Map<string, ParsedLine[]>();
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();

  for (const raw of lines) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (!line) {
      badLines += 1;
      continue;
    }
    counts[line.status] += 1;
    const events = byJob.get(line.job) ?? [];
    events.push(line);
    byJob.set(line.job, events);
  }

  const rows: DigestRow[] = [...byJob.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([job, events]) => {
      const ordered = [...events].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
      const first = ordered[0];
      const last = ordered[ordered.length - 1];
      return {
        job,
        owner: last.owner,
        runs: ordered.length,
        retries: ordered.filter((event) => event.status === 'retry').length,
        lastStatus: last.status,
        lastError: last.error,
        first: first.at,
        last: last.at,
      };
    });

  return { rows, badLines, counts };
}
