import { test } from 'node:test';
import assert from 'node:assert';
process.env.JWT_SECRET = 'test';
const { default: app } = await import('../src/app.js');

test('GET /health', async () => {
  const s = app.listen(0);
  const res = await fetch(`http://localhost:${s.address().port}/health`);
  assert.equal((await res.json()).ok, true);
  s.close();
});
test('routes protégées refusent sans JWT', async () => {
  const s = app.listen(0);
  const res = await fetch(`http://localhost:${s.address().port}/api/bookings/mine`);
  assert.equal(res.status, 401);
  s.close();
});
