// Light load test — k6 run perf/load-test.k6.js   (BASE_URL defaults to the docker compose stack)
// Results: k6 prints p(95) latencies; add --summary-export=perf/results/k6-summary.json to keep them.
import http from 'k6/http';
import { check, sleep, group } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:8080';
export const options = {
  scenarios: {
    browse: { executor: 'ramping-vus', startVUs: 0, stages: [{ duration: '30s', target: 20 }, { duration: '1m', target: 20 }, { duration: '15s', target: 0 }] },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:list}': ['p(95)<400'],
    'http_req_duration{name:detail}': ['p(95)<300'],
    'http_req_duration{name:search}': ['p(95)<500'],
    'http_req_duration{name:login}': ['p(95)<800'],
  },
};

export function setup() {
  const r = http.get(`${BASE}/api/events?limit=20`);
  return { ids: r.json('items').map((e) => e.id) };
}

export default function ({ ids }) {
  group('visitor', () => {
    const list = http.get(`${BASE}/api/events?page=1&limit=12`, { tags: { name: 'list' } });
    check(list, { 'list 200': (r) => r.status === 200 });
    const id = ids[Math.floor(Math.random() * ids.length)];
    check(http.get(`${BASE}/api/events/${id}`, { tags: { name: 'detail' } }), { 'detail 200': (r) => r.status === 200 });
    check(http.get(`${BASE}/api/events?q=atelier&features=wheelchair&free=true`, { tags: { name: 'search' } }), { 'search 200': (r) => r.status === 200 });
  });
  if (__ITER % 10 === 0) {
    const login = http.post(`${BASE}/api/auth/login`, JSON.stringify({ email: 'user@inclusivenue.tn', password: 'Password123' }), { headers: { 'Content-Type': 'application/json' }, tags: { name: 'login' } });
    check(login, { 'login 200 or rate-limited': (r) => r.status === 200 || r.status === 429 });
  }
  sleep(1);
}
