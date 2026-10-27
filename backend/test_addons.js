// backend/test_addons.js  (needs Node 18 or newer)
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const lat = process.argv[2] || '19.9975';
const lng = process.argv[3] || '73.7898';
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log('PASS', name);
  } catch (e) {
    failed++;
    console.log('FAIL', name, '-', e.message);
  }
}

const get = async (p) => {
  const r = await fetch(BASE + p);
  return { r, j: await r.json() };
};

const post = async (p, b) => {
  const r = await fetch(BASE + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(b)
  });
  return { r, j: await r.json() };
};

(async () => {
  await check('travel modes load', async () => {
    const { r, j } = await get('/api/cost/modes');
    if (!r.ok || !j.length) throw new Error('no modes');
  });

  await check('cost compare works', async () => {
    const { r, j } = await get(`/api/cost/compare?lat=${lat}&lng=${lng}&category=Consultation&mode=bus`);
    if (!r.ok || !Array.isArray(j.government)) throw new Error(JSON.stringify(j));
  });

  await check('cost compare rejects bad mode', async () => {
    const { r } = await get(`/api/cost/compare?lat=${lat}&lng=${lng}&category=Consultation&mode=rocket`);
    if (r.status !== 400) throw new Error('expected 400, got ' + r.status);
  });

  await check('cost compare rejects missing location', async () => {
    const { r } = await get('/api/cost/compare?category=Consultation');
    if (r.status !== 400) throw new Error('expected 400');
  });

  await check('feedback saves once, rejects duplicate', async () => {
    const body = {
      phcId: 1,
      doctorPresent: 'YES',
      medicineAvailable: 'YES',
      visitDate: new Date().toISOString().slice(0, 10),
      deviceId: 'test-' + Date.now()
    };
    const a = await post('/api/feedback', body);
    if (a.r.status !== 201) throw new Error('first save failed: ' + JSON.stringify(a.j));
    const b = await post('/api/feedback', body);
    if (b.r.status !== 409) throw new Error('duplicate not blocked');
  });

  await check('feedback rejects old visit date', async () => {
    const { r } = await post('/api/feedback', {
      phcId: 1,
      doctorPresent: 'NO',
      visitDate: '2020-01-01',
      deviceId: 'x'
    });
    if (r.status !== 400) throw new Error('expected 400');
  });

  await check('feedback summary loads', async () => {
    const { r, j } = await get('/api/feedback/summary/1');
    if (!r.ok || typeof j.enough !== 'boolean') throw new Error(JSON.stringify(j));
  });

  await check('fallback rejects missing ids', async () => {
    const { r } = await get('/api/medicine-fallback');
    if (r.status !== 400) throw new Error('expected 400');
  });

  await check('fallback returns alternatives and safety note', async () => {
    const { r, j } = await get(`/api/medicine-fallback?phcId=1&medicineId=1&lat=${lat}&lng=${lng}`);
    if (!r.ok || !j.safetyNote) throw new Error(JSON.stringify(j));
  });

  console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})();
