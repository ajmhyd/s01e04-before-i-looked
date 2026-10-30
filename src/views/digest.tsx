import type { DigestRow, NightDigest } from '../digest/types.js';

const MISSING = '—';

function marked(row: DigestRow): boolean {
  return row.retries >= 3 || row.lastStatus === 'fail';
}

function badLineNote(count: number): string {
  return count === 1 ? '1 bad line' : `${count} bad lines`;
}

export function DigestPage({ night, digest }: { night: string; digest: NightDigest }) {
  const quiet = digest.rows.length === 0 && digest.badLines === 0;
  return (
    <>
      <h1>digest {night}</h1>
      {quiet ? (
        <p>nothing ran</p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>job</th>
                <th>owner</th>
                <th>runs</th>
                <th>retries</th>
                <th>last status</th>
                <th>last error</th>
                <th>first</th>
                <th>last</th>
              </tr>
            </thead>
            <tbody>
              {digest.rows.map((row) => (
                <tr class={marked(row) ? 'warn' : undefined}>
                  <td>{row.job}</td>
                  <td>{row.owner ?? MISSING}</td>
                  <td>{row.runs}</td>
                  <td>{row.retries}</td>
                  <td>{row.lastStatus}</td>
                  <td>{row.lastError ?? MISSING}</td>
                  <td>{row.first}</td>
                  <td>{row.last}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {digest.badLines > 0 ? <p class="mute">{badLineNote(digest.badLines)}</p> : null}
        </>
      )}
    </>
  );
}
