import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularMapa } from '../../src/astro/mapa.js';
import { CORPOS } from '../../src/astro/constantes.js';
import { horizons, swiss, cartas, dif } from './util.js';

const SP = { lat: -23.5475, lon: -46.6361, tz: 'America/Sao_Paulo' };
const BSB = { lat: -15.7939, lon: -47.8828, tz: 'America/Sao_Paulo' };

function conferePlanetas(mapa, iso) {
  const ref = horizons.valores[iso];
  assert.ok(ref, 'sem referencia do Horizons para ' + iso);
  for (const c of CORPOS) {
    const d = dif(mapa.pontos[c.id].lon, ref[c.id]);
    assert.ok(d < 0.02, `${c.id} em ${iso}: ${d.toFixed(4)} graus`);
  }
}
function confereAngulos(mapa, utc) {
  const s = swiss.casos.find((c) => c.utc === utc && Math.abs(c.lat - mapa.entrada.local.lat) < 0.01);
  assert.ok(s, 'sem referencia do Swiss para ' + utc);
  assert.ok(dif(mapa.pontos.asc.lon, s.asc) < 0.005, 'Ascendente');
  assert.ok(dif(mapa.pontos.mc.lon, s.mc) < 0.005, 'Meio do Ceu');
  mapa.casas.cuspides.forEach((c, i) => assert.ok(dif(c.lon, s.cuspides[i]) < 0.005, `casa ${i + 1}`));
  assert.ok(dif(mapa.pontos.nodo_norte.lon, s.nodoMedio) < 0.01, 'nodo norte');
}

test('mapa 1, Brasil: Sao Paulo, 18/04/1990 21:00 (UTC-3, sem verao)', () => {
  const m = calcularMapa({ data: '1990-04-18', hora: '21:00', local: SP, cartas });
  assert.equal(m.instanteUtc, '1990-04-19T00:00:00.000Z');
  assert.equal(m.hora.estado, 'normal');
  conferePlanetas(m, '1990-04-19T00:00:00Z');
  confereAngulos(m, '1990-04-19T00:00:00Z');
  // posicoes conhecidas: Sol 28 graus de Aries (decano 3), Lua em Aquario, Saturno em Capricornio
  assert.equal(m.pontos.sol.signoNome, 'Áries');
  assert.equal(m.pontos.sol.decano, 3);
  assert.equal(m.pontos.lua.signoNome, 'Aquário');
  assert.equal(m.pontos.saturno.signoNome, 'Capricórnio');
  assert.equal(m.pontos.sol.ponte.cartaDecano.nome, 'Quatro de Bastões');
  assert.equal(m.pontos.sol.ponte.cartaSigno.nome, 'O Imperador');
  assert.equal(m.avisos.length, 0);
  assert.equal(m.casas.sistema, 'placidus');
});

test('mapa 2, antes de 1980: Brasilia, 15/06/1975 12:00 (sem horario de verao)', () => {
  const m = calcularMapa({ data: '1975-06-15', hora: '12:00', local: BSB, cartas });
  assert.equal(m.instanteUtc, '1975-06-15T15:00:00.000Z');
  conferePlanetas(m, '1975-06-15T15:00:00Z');
  confereAngulos(m, '1975-06-15T15:00:00Z');
  assert.equal(m.pontos.sol.signoNome, 'Gêmeos');
  assert.equal(m.hora.estado, 'normal');
});

test('mapa 3, virada do horario de verao: 17/02/2018 23:30 em Sao Paulo e ambiguo, com as duas possibilidades', () => {
  const m = calcularMapa({ data: '2018-02-17', hora: '23:30', local: SP, cartas });
  assert.equal(m.hora.estado, 'ambigua');
  assert.ok(m.avisos.some((a) => a.codigo === 'hora_ambigua'), 'o aviso precisa existir');
  assert.deepEqual(m.hora.opcoes.map((o) => o.utc), ['2018-02-18T01:30:00.000Z', '2018-02-18T02:30:00.000Z']);
  for (const o of m.hora.opcoes) {
    assert.ok(o.resumo.sol && o.resumo.lua && o.resumo.asc && o.resumo.mc, 'cada possibilidade traz Sol, Lua, Asc e MC');
  }
  // possibilidade 0 = verao (UTC-2): 01:30Z
  conferePlanetas(m, '2018-02-18T01:30:00Z');
  confereAngulos(m, '2018-02-18T01:30:00Z');
  const m2 = calcularMapa({ data: '2018-02-17', hora: '23:30', local: SP, cartas, escolhaHora: 1 });
  assert.equal(m2.instanteUtc, '2018-02-18T02:30:00.000Z');
  conferePlanetas(m2, '2018-02-18T02:30:00Z');
  confereAngulos(m2, '2018-02-18T02:30:00Z');
  assert.equal(m2.hora.escolhida, 1);
  // o resumo da possibilidade nao escolhida confere com o mapa completo dessa possibilidade
  assert.ok(dif(m.hora.opcoes[1].resumo.asc.lon, m2.pontos.asc.lon) < 1e-9);
  // as duas possibilidades dao Asc diferentes (e o motivo do aviso)
  assert.ok(dif(m.pontos.asc.lon, m2.pontos.asc.lon) > 5);
});

test('hora inexistente tambem e sinalizada, com as duas leituras', () => {
  const m = calcularMapa({ data: '2018-11-04', hora: '00:30', local: SP });
  assert.equal(m.hora.estado, 'inexistente');
  assert.ok(m.avisos.some((a) => a.codigo === 'hora_inexistente'));
  assert.equal(m.hora.opcoes.length, 2);
});

test('modo sem hora: sem Ascendente, MC, casas nem planeta em casa; Lua com faixa de incerteza', () => {
  const m = calcularMapa({ data: '2018-02-17', hora: null, local: SP, cartas });
  assert.equal(m.semHora, true);
  assert.equal(m.pontos.asc, undefined);
  assert.equal(m.pontos.mc, undefined);
  assert.equal(m.casas, null);
  for (const c of CORPOS) assert.equal(m.pontos[c.id].casa, undefined);
  assert.ok(m.avisos.some((a) => a.codigo === 'sem_hora'));
  const f = m.pontos.lua.faixaDia;
  assert.ok(f.amplitude > 11 && f.amplitude < 16, `amplitude da Lua ${f.amplitude}`);
  assert.ok(m.pontos.sol.faixaDia.amplitude < 1.1);
  assert.ok(!m.aspectos.some((a) => a.a === 'lua' || a.b === 'lua'));
  // uma data em que a Lua troca de signo ao longo do dia deve ser marcada
  let achou = false;
  for (let d = 1; d <= 28 && !achou; d++) {
    const x = calcularMapa({ data: `2024-03-${String(d).padStart(2, '0')}`, hora: null, local: SP });
    if (x.pontos.lua.faixaDia.mudaDeSigno) {
      achou = true;
      assert.equal(x.pontos.lua.faixaDia.signos.length, 2);
    }
  }
  assert.ok(achou, 'em um mes ha ao menos um dia com troca de signo da Lua');
});

test('latitude alta devolve aviso e Signos Inteiros', () => {
  const m = calcularMapa({ data: '1999-05-05', hora: '09:30', local: { lat: 69.6492, lon: 18.9553, tz: 'Europe/Oslo' } });
  assert.equal(m.casas.sistema, 'signos-inteiros');
  assert.ok(m.avisos.some((a) => a.codigo === 'latitude_alta'));
});

test('sistemas de casas alternativos e saida serializavel', () => {
  for (const sistema of ['igual', 'signos-inteiros', 'placidus']) {
    const m = calcularMapa({ data: '1990-04-18', hora: '21:00', local: SP, casas: sistema });
    assert.equal(m.casas.sistema, sistema);
    assert.deepEqual(JSON.parse(JSON.stringify(m)), m);
  }
  assert.throws(() => calcularMapa({ data: '1990-04-18', hora: '21:00', local: SP, casas: 'koch' }), { codigo: 'casas_invalidas' });
  assert.throws(() => calcularMapa({ data: '1990-04-18', hora: '21:00', local: { lat: 99, lon: 0, tz: 'UTC' } }), { codigo: 'local_invalido' });
});

test('aspectos: id estavel, orbes configuraveis, fase presente', () => {
  const m = calcularMapa({ data: '1990-04-18', hora: '21:00', local: SP });
  assert.ok(m.aspectos.length > 5);
  const ids = new Set(m.aspectos.map((a) => a.id));
  assert.equal(ids.size, m.aspectos.length, 'ids unicos');
  for (const a of m.aspectos) {
    assert.match(a.id, /^[a-z_]+-(conjuncao|sextil|quadratura|trigono|oposicao)-[a-z_]+$/);
    assert.ok(a.orbe <= m.orbes[a.tipo] + 1e-9);
    assert.ok(['aplicativo', 'separativo', 'exato'].includes(a.fase));
  }
  const m2 = calcularMapa({ data: '1990-04-18', hora: '21:00', local: SP });
  assert.deepEqual(m2.aspectos.map((a) => a.id), m.aspectos.map((a) => a.id), 'ids estaveis entre execucoes');
  const justos = calcularMapa({ data: '1990-04-18', hora: '21:00', local: SP, orbes: { conjuncao: 1, sextil: 1, quadratura: 1, trigono: 1, oposicao: 1 } });
  assert.ok(justos.aspectos.length < m.aspectos.length);
  assert.ok(justos.aspectos.every((a) => a.orbe <= 1));
});
