import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { criarBuscador, normalizarBusca, ATRIBUICAO_LOCAIS } from '../../src/astro/locais.js';
import { fusoValido } from '../../src/astro/tempo.js';
import { raiz } from './util.js';

const dir = path.join(raiz, 'public/data/locais');
const buscador = criarBuscador(async (arq) => JSON.parse(readFileSync(path.join(dir, arq), 'utf8')));

test('normalizarBusca tira acento, caixa e pontuacao', () => {
  assert.equal(normalizarBusca('  São  Paulo! '), 'sao paulo');
  assert.equal(normalizarBusca('Goiânia'), 'goiania');
  assert.equal(normalizarBusca('D\'Ávila-Sul'), 'd avila sul');
});

test('busca sem acento: "sao pau" e "São Pau" acham Sao Paulo com fuso e coordenadas', async () => {
  for (const q of ['sao pau', 'São Pau', 'SAO PAULO']) {
    const r = await buscador.buscar(q);
    assert.equal(r[0].nome, 'São Paulo', q);
    assert.equal(r[0].admin, 'SP');
    assert.equal(r[0].tz, 'America/Sao_Paulo');
    assert.ok(Math.abs(r[0].lat + 23.55) < 0.2 && Math.abs(r[0].lon + 46.63) < 0.2);
    assert.equal(r[0].rotulo, 'São Paulo, SP, Brasil');
  }
});

test('municipios pequenos do Brasil e cidades do mundo', async () => {
  assert.equal((await buscador.buscar('itapevi'))[0].admin, 'SP');
  assert.equal((await buscador.buscar('goiania'))[0].tz, 'America/Sao_Paulo');
  assert.equal((await buscador.buscar('rio branco'))[0].tz, 'America/Rio_Branco');
  assert.equal((await buscador.buscar('manaus'))[0].tz, 'America/Manaus');
  assert.equal((await buscador.buscar('tokyo'))[0].tz, 'Asia/Tokyo');
  assert.equal((await buscador.buscar('londres'))[0].pais, 'GB', 'exonimo em portugues');
  assert.equal((await buscador.buscar('lisboa'))[0].pais, 'PT');
});

test('busca curta, vazia ou sem resultado devolve lista vazia', async () => {
  assert.deepEqual(await buscador.buscar(''), []);
  assert.deepEqual(await buscador.buscar('s'), []);
  assert.deepEqual(await buscador.buscar('xqzxqz'), []);
});

test('o limite e respeitado e a cidade maior vem primeiro', async () => {
  const r = await buscador.buscar('santa', { limite: 3 });
  assert.equal(r.length, 3);
  assert.ok(r[0].populacao >= r[1].populacao);
});

test('todos os fusos do indice existem no Intl do ambiente', () => {
  const indice = JSON.parse(readFileSync(path.join(dir, 'indice.json'), 'utf8'));
  const ruins = indice.fusos.filter((tz) => !fusoValido(tz));
  assert.deepEqual(ruins, []);
});

test('atribuicao do GeoNames presente no indice e na API; tamanho carregado sob demanda', () => {
  const indice = JSON.parse(readFileSync(path.join(dir, 'indice.json'), 'utf8'));
  assert.match(indice.licenca, /Atribuição 4\.0/);
  assert.match(ATRIBUICAO_LOCAIS, /GeoNames/);
  assert.match(ATRIBUICAO_LOCAIS, /CC BY 4\.0|Atribuição 4\.0/);
  const maior = Math.max(...readdirSync(dir).map((f) => statSync(path.join(dir, f)).size));
  assert.ok(maior < 400 * 1024, 'nenhum arquivo da base passa de 400 KB (bruto)');
});

test('falha de rede nao envenena o cache: a segunda tentativa carrega', async () => {
  let n = 0;
  const b = criarBuscador(async (arq) => {
    if (n++ === 0) throw new Error('rede caiu');
    return JSON.parse(readFileSync(path.join(dir, arq), 'utf8'));
  });
  await assert.rejects(b.buscar('sao paulo'));
  assert.equal((await b.buscar('sao paulo'))[0].nome, 'São Paulo');
});
