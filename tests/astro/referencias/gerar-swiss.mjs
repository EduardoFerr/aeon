// Gera swiss.json: casas Placidus, Ascendente, Meio do Ceu e nodo medio segundo o Swiss Ephemeris
// (swisseph-wasm, arquivos SWIEPH), usados SO como fonte independente de conferencia nos testes.
//
// ATENCAO: o Swiss Ephemeris e AGPL (ou licenca paga). Ele NAO e dependencia do projeto, nao entra no
// bundle e nao esta no package.json: so os numeros resultantes ficam no repositorio. Para regenerar,
// instale o pacote FORA do repositorio e rode este arquivo de dentro dessa pasta:
//   mkdir /tmp/ref && cd /tmp/ref && npm init -y && npm i swisseph-wasm
//   cp <repo>/tests/astro/referencias/gerar-swiss.mjs . && node gerar-swiss.mjs <repo>/tests/astro/referencias/swiss.json
import SwissEph from 'swisseph-wasm';
import { writeFileSync } from 'node:fs';

const CASOS = [
  { nome: 'Sao Paulo 1990', utc: '1990-04-19T12:00:00Z', lat: -23.55, lon: -46.63 },
  { nome: 'Sao Paulo 1990-04-19 00h UTC', utc: '1990-04-19T00:00:00Z', lat: -23.5475, lon: -46.6361 },
  { nome: 'Sao Paulo 2018 virada, opcao 1 (verao)', utc: '2018-02-18T01:30:00Z', lat: -23.5475, lon: -46.6361 },
  { nome: 'Sao Paulo 2018 virada, opcao 2', utc: '2018-02-18T02:30:00Z', lat: -23.5475, lon: -46.6361 },
  { nome: 'Rio de Janeiro 2005', utc: '2005-11-02T05:20:00Z', lat: -22.9068, lon: -43.1729 },
  { nome: 'Brasilia 1975', utc: '1975-06-15T15:00:00Z', lat: -15.7939, lon: -47.8828 },
  { nome: 'Manaus 1987', utc: '1987-01-30T21:45:00Z', lat: -3.119, lon: -60.0217 },
  { nome: 'Porto Alegre 1999', utc: '1999-08-11T10:30:00Z', lat: -30.0346, lon: -51.2177 },
  { nome: 'Londres 1985', utc: '1985-12-24T03:15:00Z', lat: 51.5074, lon: -0.1278 },
  { nome: 'Nova York 1960', utc: '1960-07-04T18:00:00Z', lat: 40.7128, lon: -74.006 },
  { nome: 'Toquio 2010', utc: '2010-03-21T00:05:00Z', lat: 35.6762, lon: 139.6503 },
  { nome: 'Sydney 2000', utc: '2000-09-15T22:40:00Z', lat: -33.8688, lon: 151.2093 },
  { nome: 'Oslo 1978', utc: '1978-12-21T11:00:00Z', lat: 59.9139, lon: 10.7522 },
  { nome: 'Reykjavik 1999', utc: '1999-05-05T07:30:00Z', lat: 64.1466, lon: -21.9426 },
  { nome: 'Lisboa 1925', utc: '1925-02-03T13:10:00Z', lat: 38.7223, lon: -9.1393 },
  { nome: 'Cidade do Mexico 2023', utc: '2023-10-14T17:59:00Z', lat: 19.4326, lon: -99.1332 },
  { nome: 'Quito (equador) 2001', utc: '2001-04-30T14:30:00Z', lat: -0.1807, lon: -78.4678 },
];

const swe = new SwissEph();
await swe.initSwissEph();
const out = { fonte: 'Swiss Ephemeris via swisseph-wasm (SWIEPH), sistema de casas P (Placidus)', casos: [] };
for (const c of CASOS) {
  const d = new Date(c.utc);
  const jd = swe.julday(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours() + d.getUTCMinutes() / 60);
  const h = swe.houses(jd, c.lat, c.lon, 'P');
  out.casos.push({
    ...c,
    asc: h.ascmc[0],
    mc: h.ascmc[1],
    cuspides: Array.from({ length: 12 }, (_, i) => h.cusps[i + 1]),
    nodoMedio: swe.calc_ut(jd, 10, swe.SEFLG_SWIEPH)[0],
  });
}
writeFileSync(process.argv[2] || 'swiss.json', JSON.stringify(out, null, 1) + '\n');
console.log('ok', out.casos.length);
