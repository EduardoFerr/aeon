import test from 'node:test';
import assert from 'node:assert/strict';
import { longitudeCorpo, velocidadeCorpo, nodoNorteMedio } from '../../src/astro/corpos.js';
import { CORPOS } from '../../src/astro/constantes.js';
import { horizons, swiss, dif } from './util.js';

const TOLERANCIA = 0.02; // graus; o erro medido contra o Horizons e de ate 0,01

test('longitudes de Sol a Plutao contra o NASA/JPL Horizons', () => {
  let maior = 0;
  let n = 0;
  for (const [iso, vals] of Object.entries(horizons.valores)) {
    for (const c of CORPOS) {
      const d = dif(longitudeCorpo(c.engine, new Date(isoNormal(iso))), vals[c.id]);
      maior = Math.max(maior, d);
      n++;
      assert.ok(d < TOLERANCIA, `${c.id} em ${iso}: diferenca ${d.toFixed(4)} graus`);
    }
  }
  assert.ok(n >= 150, 'esperava varios instantes de referencia');
  console.log(`  maior diferenca contra o Horizons: ${maior.toFixed(4)} graus em ${n} valores`);
});

// "2022-12-01T24:00:00Z" nao e uma data valida em Date.parse: converte para o dia seguinte 00:00.
function isoNormal(iso) {
  const m = /^(\d{4}-\d{2}-\d{2})T24:00:00Z$/.exec(iso);
  if (!m) return iso;
  return new Date(Date.parse(m[1] + 'T00:00:00Z') + 86400000).toISOString();
}

test('retrogradacao por velocidade concorda com a diferenca de 24 h do Horizons', () => {
  // Pares de instantes (dia 00:00 e o mesmo dia 24:00) do horizons.json.
  const dias = Object.keys(horizons.valores).filter((k) => k.endsWith('T24:00:00Z')).map((k) => k.slice(0, 10));
  assert.ok(dias.length >= 4);
  let retrogrados = 0;
  let diretos = 0;
  for (const dia of dias) {
    const a = horizons.valores[`${dia}T00:00:00Z`];
    const b = horizons.valores[`${dia}T24:00:00Z`];
    const meio = new Date(Date.parse(`${dia}T12:00:00Z`));
    for (const c of CORPOS) {
      const refVel = ((b[c.id] - a[c.id] + 540) % 360) - 180;
      const vel = velocidadeCorpo(c.engine, meio);
      assert.ok(Math.abs(vel - refVel) < 0.02, `${c.id} ${dia}: ${vel.toFixed(4)} contra ${refVel.toFixed(4)} graus/dia`);
      assert.equal(vel < 0, refVel < 0, `${c.id} ${dia}: sinal da velocidade`);
      if (refVel < 0) retrogrados++; else diretos++;
    }
  }
  assert.ok(retrogrados >= 3, 'o conjunto de referencia deve incluir retrogradacoes');
  assert.ok(diretos >= 20);
});

test('Sol e Lua nunca sao retrogrados; Mercurio estava retrogrado em 2024-04-10', async () => {
  const { calcularCorpos } = await import('../../src/astro/corpos.js');
  const r = calcularCorpos(new Date('2024-04-10T12:00:00Z'));
  assert.equal(r.mercurio.retrogrado, true);
  assert.equal(r.sol.retrogrado, false);
  assert.equal(r.lua.retrogrado, false);
  assert.equal(r.venus.retrogrado, false);
});

test('nodo medio contra o Swiss Ephemeris (14 casos)', () => {
  for (const c of swiss.casos) {
    const d = dif(nodoNorteMedio(new Date(c.utc)), c.nodoMedio);
    assert.ok(d < 0.01, `${c.nome}: ${d.toFixed(5)} graus`);
  }
});
