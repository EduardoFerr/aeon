import test from 'node:test';
import assert from 'node:assert/strict';
import { posicaoZodiacal, indexarCartas, ponteDaLongitude, cartaDeCorte, parseFaixaCorte, regenteDoDecano } from '../../src/astro/zodiaco.js';
import { SIGNOS } from '../../src/astro/constantes.js';
import { cartas } from './util.js';

const idx = indexarCartas(cartas);
const cartasDecano = cartas.filter((c) => c.decan);
const cartasCorte = cartas.filter((c) => c.zodiac_range);

test('cards.json tem 36 decanos, 12 cartas de Corte e 12 signos', () => {
  assert.equal(cartasDecano.length, 36);
  assert.equal(cartasCorte.length, 12);
  assert.equal(Object.keys(idx.porSigno).length, 12);
});

test('ordem caldeia a partir de Marte em Aries confere com os 36 decanos do cards.json', () => {
  for (const c of cartasDecano) {
    const si = SIGNOS.findIndex((s) => s.nome === c.decan.sign);
    assert.ok(si >= 0, c.name);
    assert.equal(regenteDoDecano(si, c.decan.number), c.decan.planet, `${c.name} (${c.decan.sign}, decano ${c.decan.number})`);
    // os graus textuais ("10 a 20 graus de Aries") batem com o decano
    const m = /^(\d+) a (\d+) graus de/.exec(c.decan.degrees);
    assert.equal(Number(m[1]), (c.decan.number - 1) * 10, c.name);
  }
});

test('qualquer longitude cai no decano certo e a ponte devolve a carta do cards.json', () => {
  for (const c of cartasDecano) {
    const si = SIGNOS.findIndex((s) => s.nome === c.decan.sign);
    for (const grau of [0, 0.0001, 5, 9.9999]) {
      const lon = si * 30 + (c.decan.number - 1) * 10 + grau;
      const p = posicaoZodiacal(lon);
      assert.equal(p.signoNome, c.decan.sign);
      assert.equal(p.decano, c.decan.number, `${c.name} a ${lon}`);
      assert.equal(p.regenteDecano, c.decan.planet);
      const ponte = ponteDaLongitude(idx, lon);
      assert.equal(ponte.cartaDecano.nome, c.name);
      assert.equal(ponte.regenteDecanoConfere, true);
    }
  }
});

test('os 360 graus: todo grau tem carta do signo, do decano e uma e so uma carta de Corte', () => {
  for (let lon = 0; lon < 360; lon += 0.25) {
    const p = ponteDaLongitude(idx, lon);
    assert.ok(p.cartaSigno, `signo em ${lon}`);
    assert.ok(p.cartaDecano, `decano em ${lon}`);
    assert.ok(p.cartaCorte, `corte em ${lon}`);
    const quantas = idx.corte.filter((f) => (f.inicio <= f.fim ? lon >= f.inicio && lon < f.fim : lon >= f.inicio || lon < f.fim)).length;
    assert.equal(quantas, 1, `faixas que cobrem ${lon}`);
  }
});

test('faixas de Corte: bordas pertencem a carta que comeca ali (intervalo [inicio, fim))', () => {
  for (const c of cartasCorte) {
    const f = parseFaixaCorte(c.zodiac_range);
    assert.ok(f, c.zodiac_range);
    assert.equal(cartaDeCorte(idx, f.inicio).name, c.name, `${c.name} no inicio`);
    assert.notEqual(cartaDeCorte(idx, f.fim).name, c.name, `${c.name} no fim (exclusivo)`);
    assert.notEqual(cartaDeCorte(idx, (f.inicio + 359.999) % 360).name, c.name, `${c.name} logo antes do inicio`);
  }
  // exemplos conferidos a mao: Sol a 29,17 Aries cai em "20 Aries a 20 Touro"
  assert.equal(cartaDeCorte(idx, 29.17).name, 'Príncipe de Discos');
  // faixa que cruza 0 Aries: "20 Peixes a 20 Aries"
  assert.equal(cartaDeCorte(idx, 350).name, 'Rainha de Bastões');
  assert.equal(cartaDeCorte(idx, 10).name, 'Rainha de Bastões');
  assert.equal(cartaDeCorte(idx, 20).name, 'Príncipe de Discos');
});

test('carta do signo: os 12 signos apontam para os Arcanos Maiores do cards.json', () => {
  assert.equal(ponteDaLongitude(idx, 5).cartaSigno.nome, 'O Imperador');
  assert.equal(ponteDaLongitude(idx, 335).cartaSigno.nome, 'A Lua');
});
