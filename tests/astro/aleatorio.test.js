import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularMapa } from '../../src/astro/mapa.js';

// PRNG deterministico (mulberry32) para o teste ser reprodutivel.
function prng(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LUGARES = [
  { lat: -23.5475, lon: -46.6361, tz: 'America/Sao_Paulo' },
  { lat: -3.119, lon: -60.0217, tz: 'America/Manaus' },
  { lat: -9.9747, lon: -67.8243, tz: 'America/Rio_Branco' },
  { lat: 51.5074, lon: -0.1278, tz: 'Europe/London' },
  { lat: 40.7128, lon: -74.006, tz: 'America/New_York' },
  { lat: 35.6762, lon: 139.6503, tz: 'Asia/Tokyo' },
  { lat: -33.8688, lon: 151.2093, tz: 'Australia/Sydney' },
  { lat: 64.1466, lon: -21.9426, tz: 'Atlantic/Reykjavik' },
  { lat: 69.6492, lon: 18.9553, tz: 'Europe/Oslo' },
  { lat: 78.2232, lon: 15.6267, tz: 'Arctic/Longyearbyen' },
  { lat: -0.1807, lon: -78.4678, tz: 'America/Guayaquil' },
  { lat: 28.6139, lon: 77.209, tz: 'Asia/Kolkata' },
  { lat: -54.8019, lon: -68.303, tz: 'America/Argentina/Ushuaia' },
  { lat: 0, lon: 0, tz: 'UTC' },
];

function percorre(v, caminho, fn) {
  if (typeof v === 'number') fn(v, caminho);
  else if (Array.isArray(v)) v.forEach((x, i) => percorre(x, `${caminho}[${i}]`, fn));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) percorre(x, `${caminho}.${k}`, fn);
}

test('10 mil datas aleatorias entre 1900 e 2050: sem NaN, graus em [0,360), casas de 1 a 12', () => {
  const rnd = prng(20261110);
  const t0 = Date.UTC(1900, 0, 1);
  const t1 = Date.UTC(2050, 11, 31);
  let semHora = 0;
  let especiais = 0;
  for (let i = 0; i < 10000; i++) {
    const d = new Date(t0 + Math.floor(rnd() * (t1 - t0)));
    const data = d.toISOString().slice(0, 10);
    const sem = rnd() < 0.05;
    const hora = sem ? null : `${String(Math.floor(rnd() * 24)).padStart(2, '0')}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}`;
    const local = LUGARES[Math.floor(rnd() * LUGARES.length)];
    const casas = ['placidus', 'placidus', 'igual', 'signos-inteiros'][Math.floor(rnd() * 4)];
    let m;
    try {
      m = calcularMapa({ data, hora, local, casas });
    } catch (e) {
      assert.fail(`erro em ${data} ${hora} ${local.tz}: ${e.message}`);
    }
    if (sem) semHora++;
    if (m.hora.estado !== 'normal') especiais++;
    percorre(m, 'mapa', (n, c) => assert.ok(Number.isFinite(n), `${data} ${hora} ${local.tz}: ${c} = ${n}`));
    for (const [id, p] of Object.entries(m.pontos)) {
      assert.ok(p.lon >= 0 && p.lon < 360, `${data} ${id} lon ${p.lon}`);
      assert.ok(p.grau >= 0 && p.grau < 30, `${data} ${id} grau ${p.grau}`);
      assert.ok(p.decano >= 1 && p.decano <= 3);
      if (p.casa !== undefined) assert.ok(Number.isInteger(p.casa) && p.casa >= 1 && p.casa <= 12, `${data} ${id} casa ${p.casa}`);
    }
    if (m.casas) {
      assert.equal(m.casas.cuspides.length, 12);
      for (const c of m.casas.cuspides) assert.ok(c.lon >= 0 && c.lon < 360);
      if (Math.abs(local.lat) > 66) assert.equal(m.casas.sistema === 'placidus', false, 'sem Placidus acima de 66 graus');
    } else {
      assert.ok(sem);
    }
    for (const a of m.aspectos) assert.ok(a.orbe >= 0 && a.separacao >= 0 && a.separacao <= 180);
    assert.ok(['normal', 'ambigua', 'inexistente'].includes(m.hora.estado));
  }
  console.log(`  10000 mapas (${semHora} sem hora, ${especiais} com hora ambigua ou inexistente)`);
});
