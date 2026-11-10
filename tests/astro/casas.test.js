import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularAngulos, cuspidesPlacidus, calcularCasas, casaDaLongitude, cuspidesSignosInteiros, cuspidesIguais } from '../../src/astro/casas.js';
import { swiss, dif } from './util.js';

// Fonte independente: Swiss Ephemeris (valores gravados em referencias/swiss.json, ver gerar-swiss.mjs).
test('Ascendente, Meio do Ceu e as 12 cuspides Placidus contra o Swiss Ephemeris', () => {
  let maior = 0;
  let n = 0;
  for (const c of swiss.casos) {
    const a = calcularAngulos(new Date(c.utc), c.lat, c.lon);
    assert.ok(dif(a.asc, c.asc) < 0.005, `${c.nome}: Asc ${a.asc} contra ${c.asc}`);
    assert.ok(dif(a.mc, c.mc) < 0.005, `${c.nome}: MC`);
    const cusp = cuspidesPlacidus(a, c.lat);
    assert.ok(cusp, `${c.nome}: Placidus deveria existir a ${c.lat} graus`);
    cusp.forEach((v, i) => {
      const d = dif(v, c.cuspides[i]);
      maior = Math.max(maior, d);
      n++;
      assert.ok(d < 0.005, `${c.nome}: casa ${i + 1} ${v.toFixed(4)} contra ${c.cuspides[i].toFixed(4)}`);
    });
  }
  console.log(`  maior diferenca de cuspide contra o Swiss: ${maior.toFixed(5)} graus em ${n} cuspides`);
});

test('latitude alta: Placidus cai em Signos Inteiros com aviso', () => {
  const a = calcularAngulos(new Date('1999-05-05T07:30:00Z'), 69.6492, 18.9553); // Tromso
  const r = calcularCasas(a, 69.6492, 'placidus');
  assert.equal(r.sistema, 'signos-inteiros');
  assert.equal(r.solicitado, 'placidus');
  assert.equal(r.avisos[0].codigo, 'latitude_alta');
  assert.equal(r.cuspides.length, 12);
  // 66 graus ainda e Placidus (limite documentado: acima de 66)
  const b = calcularAngulos(new Date('1999-05-05T07:30:00Z'), 65.9, 18.9553);
  assert.equal(calcularCasas(b, 65.9, 'placidus').sistema, 'placidus');
});

test('Signos Inteiros e Igual a partir do Ascendente', () => {
  const si = cuspidesSignosInteiros(63.2);
  assert.deepEqual(si.slice(0, 3), [60, 90, 120]);
  const ig = cuspidesIguais(63.2);
  assert.ok(Math.abs(ig[1] - 93.2) < 1e-9 && Math.abs(ig[11] - 33.2) < 1e-9);
});

test('casaDaLongitude cobre os 360 graus e respeita a virada de 0 Aries', () => {
  const c = cuspidesIguais(350); // cusp 1 = 350
  assert.equal(casaDaLongitude(c, 355), 1);
  assert.equal(casaDaLongitude(c, 5), 1);
  assert.equal(casaDaLongitude(c, 20), 2);
  assert.equal(casaDaLongitude(c, 349.99), 12);
  const contagem = new Set();
  for (let l = 0; l < 360; l += 0.5) contagem.add(casaDaLongitude(c, l));
  assert.equal(contagem.size, 12);
});
