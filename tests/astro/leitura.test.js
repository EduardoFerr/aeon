import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcularMapa } from '../../src/astro/mapa.js';
import { montarLeitura, slugCarta, textoDaSecao } from '../../src/utils/leituraMapa.js';
import { rodaSVG } from '../../src/utils/roda.js';
import { citacao } from '../../src/utils/cartaoMapa.js';

const textos = JSON.parse(readFileSync(new URL('../../public/data/astro/textos.json', import.meta.url), 'utf8'));
const cartas = JSON.parse(readFileSync(new URL('../../public/data/cards.json', import.meta.url), 'utf8'));
const SP = { lat: -23.55, lon: -46.63, tz: 'America/Sao_Paulo' };

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

test('slugCarta gera os ids de gh.carta e gh.faixa', () => {
  assert.equal(slugCarta('Quatro de Bastões'), 'quatro-de-bastoes');
  assert.equal(slugCarta('Dois de Taças'), 'dois-de-tacas');
  assert.equal(slugCarta('Príncipe de Discos'), 'principe-de-discos');
});

test('leitura dos mapas de referencia: nenhum id falta, nenhum undefined, nenhum marcador solto', () => {
  const casos = [
    { data: '1990-04-15', hora: '09:40', local: SP },
    { data: '1990-04-15', hora: null, local: SP },
    { data: '2018-02-17', hora: '23:30', local: SP, escolhaHora: 0 },
    { data: '2018-02-17', hora: '23:30', local: SP, escolhaHora: 1 },
    { data: '1990-04-15', hora: '09:40', local: { lat: 69.65, lon: 18.96, tz: 'Europe/Oslo' } },
  ];
  for (const e of casos) {
    const { secoes, faltas } = montarLeitura(calcularMapa({ ...e, cartas }), textos);
    assert.deepEqual(faltas, [], JSON.stringify(e));
    assert.equal(secoes.length, 9);
    const todo = secoes.map(textoDaSecao).join('\n');
    assert.doesNotMatch(todo, /undefined|NaN|\{\w+\}/);
    for (const s of secoes) assert.ok(s.ponto || s.itens.length || s.notas.length, s.id);
  }
});

test('leitura de 300 mapas aleatorios (com e sem hora) nao deixa texto faltando', () => {
  const r = prng(42);
  for (let i = 0; i < 300; i++) {
    const ano = 1900 + Math.floor(r() * 150);
    const d = new Date(Date.UTC(ano, Math.floor(r() * 12), 1 + Math.floor(r() * 28)));
    const hora = i % 6 === 0 ? null : `${String(Math.floor(r() * 24)).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}`;
    const local = { lat: -60 + r() * 125, lon: -170 + r() * 340, tz: 'America/Sao_Paulo' };
    const calc = calcularMapa({ data: d.toISOString().slice(0, 10), hora, local, cartas });
    const { faltas } = montarLeitura(calc, textos);
    assert.deepEqual(faltas, []);
  }
});

test('concordancia: {planeta} entra sem artigo nem preposicao, entao Sol e Lua leem bem', () => {
  for (const id of Object.keys(textos).filter((k) => k.startsWith('gh.dec.') || k.startsWith('rg.asc.') || k.startsWith('ah.'))) {
    assert.doesNotMatch(textos[id], /\b(o|a|os|as|do|da|dos|das|pelo|pela|ao|à|de|por|com) \{planeta\}/i, id);
    assert.doesNotMatch(textos[id], /\{decano\}\s+de\s+\{signo\}/, id);
  }
});

test('roda em SVG: role img, titulo, descricao, todos os astros e retrogradacao', () => {
  const calc = calcularMapa({ data: '1990-04-15', hora: '09:40', local: SP, cartas });
  const svg = rodaSVG(calc, { id: 'x' });
  assert.match(svg, /role="img" aria-labelledby="x-t x-d"/);
  assert.match(svg, /<title id="x-t">/);
  assert.equal((svg.match(/class="gl r-glp"/g) || []).length, 11); // 10 corpos + Nodo Norte
  assert.match(svg, />AC<\/text>/);
  assert.match(svg, />MC<\/text>/);
  const sem = rodaSVG(calcularMapa({ data: '1990-04-15', hora: null, local: SP, cartas }));
  assert.doesNotMatch(sem, />AC<\/text>/);
  assert.doesNotMatch(sem, /r-casa/);
});

test('citacao do cartao: curta, termina em frase inteira ou reticencias', () => {
  assert.equal(citacao('Uma frase. Outra frase longa demais para caber junto com a primeira dentro do limite escolhido aqui.', 40), 'Uma frase.');
  assert.ok(citacao('x'.repeat(10) + ' ' + 'palavra '.repeat(40), 60).endsWith('…'));
});
