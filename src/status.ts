import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight, type StatusCounts } from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

/** One night on the board. `counts` is null when the log cannot be read. */
export type NightOnBoard = {
  night: string;
  counts: StatusCounts | null;
};

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightOnBoard[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

function countsFor(runsDir: string, night: string): StatusCounts | null {
  try {
    return readNight(runsDir, night).counts;
  } catch {
    return null;
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((night) => ({
      night,
      counts: countsFor(config.runsDir, night),
    })),
  };
}
