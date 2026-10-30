import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { NightMissingError, readNight } from './digest/types.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    try {
      return c.json(readNight(config.runsDir, night));
    } catch (err) {
      if (err instanceof NightMissingError) return c.json({ error: 'not found' }, 404);
      throw err;
    }
  });

  return app;
}
