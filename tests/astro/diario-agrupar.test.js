import test from 'node:test';
import assert from 'node:assert/strict';
import { diaDaEntrada, agruparPorMes, rotuloMes } from '../../src/utils/diario.js';

const e = (id, tipo, t, extra = {}) => ({ id, tipo, t, cartas: [], nota: '', m: t, ...extra });

test('rotuloMes escreve o mes por extenso', () => {
    assert.equal(rotuloMes(2026, 11), 'novembro de 2026');
    assert.equal(rotuloMes(2026, 3), 'março de 2026');
});

test('a carta do dia usa a data do id, nao a hora gravada', () => {
    const d = diaDaEntrada(e('dia-2026-10-31', 'dia', '2026-11-01T02:00:00.000Z'));
    assert.equal(d.iso, '2026-10-31');
    assert.equal(d.chave, '2026-10');
    assert.equal(d.dia, 31);
});

test('leitura antiga sem data legivel cai em sem-data', () => {
    const d = diaDaEntrada(e('h-1', 'leitura', '2000-01-01T00:00:00.000Z', { rotulo: 'Leitura antiga' }));
    assert.equal(d.semData, true);
    assert.equal(d.chave, 'sem-data');
});

test('agruparPorMes junta por mes e mantem a ordem', () => {
    const lista = [
        e('a', 'leitura', '2026-11-09T15:00:00'),
        e('b', 'leitura', '2026-11-02T15:00:00'),
        e('c', 'leitura', '2026-10-20T15:00:00'),
        e('d', 'leitura', '2000-01-01T00:00:00.000Z', { rotulo: 'Antiga' }),
    ];
    const g = agruparPorMes(lista);
    assert.deepEqual(g.map((x) => [x.chave, x.itens.map((i) => i.id)]), [['2026-11', ['a', 'b']], ['2026-10', ['c']], ['sem-data', ['d']]]);
});

test('semana sai abreviada e sem ponto', () => {
    const d = diaDaEntrada(e('x', 'leitura', '2026-11-09T15:00:00'));
    assert.equal(d.semana, 'seg');
});
