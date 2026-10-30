// Morning digest §1. This file lands first so section 2 can start against it.

export type JobStatus = 'ok' | 'retry' | 'fail';

/** One job over one night. Times are the log's `at` strings, offset kept. */
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: JobStatus;
  lastError: string | null;
  first: string;
  last: string;
};

/** Counts of parsed lines, not of jobs. */
export type StatusCounts = {
  ok: number;
  retry: number;
  fail: number;
};

export type NightDigest = {
  /** Sorted by job. */
  rows: DigestRow[];
  /** Non-empty lines that did not parse. A trailing empty line is not counted. */
  badLines: number;
  counts: StatusCounts;
};

/** Thrown when `runs/<night>.jsonl` is not on disk. An empty file is not missing. */
export class NightMissingError extends Error {
  readonly night: string;

  constructor(night: string) {
    super(`no run log for ${night}`);
    this.name = 'NightMissingError';
    this.night = night;
  }
}

export function readNight(runsDir: string, night: string): NightDigest {
  void runsDir;
  void night;
  throw new Error('readNight is not implemented');
}
