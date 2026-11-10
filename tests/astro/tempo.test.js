import test from 'node:test';
import assert from 'node:assert/strict';
import { resolverHoraLocal, paredeMs, parseData, parseHora, deslocamentoSegundos } from '../../src/astro/tempo.js';

const r = (d, h, tz) => resolverHoraLocal(paredeMs(parseData(d), parseHora(h)), tz);

test('hora normal: Sao Paulo sem horario de verao (1990-04-19 09:00 = 12:00 UTC)', () => {
  const x = r('1990-04-19', '09:00', 'America/Sao_Paulo');
  assert.equal(x.estado, 'normal');
  assert.equal(x.opcoes.length, 1);
  assert.equal(x.opcoes[0].utc, '1990-04-19T12:00:00.000Z');
});

test('horario de verao: Sao Paulo em janeiro de 1990 e UTC-2', () => {
  const x = r('1990-01-15', '12:00', 'America/Sao_Paulo');
  assert.equal(x.opcoes[0].deslocamentoSeg, -7200);
});

test('antes de 1980 e sem verao: Brasilia, 1975-06-15 12:00 = 15:00 UTC', () => {
  assert.equal(r('1975-06-15', '12:00', 'America/Sao_Paulo').opcoes[0].utc, '1975-06-15T15:00:00.000Z');
});

test('antes dos fusos legais o deslocamento e a hora solar local (LMT)', () => {
  const x = r('1900-01-01', '12:00', 'America/Sao_Paulo');
  assert.equal(x.estado, 'normal');
  assert.equal(x.opcoes[0].deslocamentoSeg, -(3 * 3600 + 6 * 60 + 28));
});

test('hora AMBIGUA (fim do verao, 17/02/2018 23:30 em Sao Paulo) devolve as duas possibilidades', () => {
  const x = r('2018-02-17', '23:30', 'America/Sao_Paulo');
  assert.equal(x.estado, 'ambigua');
  assert.deepEqual(x.opcoes.map((o) => o.utc), ['2018-02-18T01:30:00.000Z', '2018-02-18T02:30:00.000Z']);
  assert.deepEqual(x.opcoes.map((o) => o.deslocamentoSeg), [-7200, -10800]);
});

test('hora INEXISTENTE (inicio do verao, 04/11/2018 00:30 em Sao Paulo) devolve as duas leituras', () => {
  const x = r('2018-11-04', '00:30', 'America/Sao_Paulo');
  assert.equal(x.estado, 'inexistente');
  assert.equal(x.opcoes.length, 2);
  assert.deepEqual(x.opcoes.map((o) => o.deslocamentoSeg), [-7200, -10800]);
});

test('o mesmo vale em outros paises (Nova York)', () => {
  assert.equal(r('2024-03-10', '02:30', 'America/New_York').estado, 'inexistente');
  assert.equal(r('2024-11-03', '01:30', 'America/New_York').estado, 'ambigua');
  assert.equal(r('2024-07-01', '12:00', 'America/New_York').opcoes[0].deslocamentoSeg, -14400);
});

test('Acre mudou de fuso em 2008 (UTC-5 ate junho, UTC-4 depois)', () => {
  assert.equal(deslocamentoSegundos(Date.parse('2008-06-01T12:00:00Z'), 'America/Rio_Branco'), -5 * 3600);
  assert.equal(deslocamentoSegundos(Date.parse('2008-07-01T12:00:00Z'), 'America/Rio_Branco'), -4 * 3600);
});

test('entradas invalidas viram erros com codigo', () => {
  assert.throws(() => parseData('2024-02-30'), { codigo: 'data_invalida' });
  assert.throws(() => parseData('1700-01-01'), { codigo: 'data_fora_do_intervalo' });
  assert.throws(() => parseHora('25:00'), { codigo: 'hora_invalida' });
  assert.throws(() => resolverHoraLocal(0, 'Marte/Olimpo'), { codigo: 'fuso_invalido' });
});
