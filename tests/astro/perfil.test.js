import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// localStorage de mentira, antes de importar o modulo (ele le o armazenamento a cada chamada)
const arm = new Map();
globalThis.localStorage = {
    getItem: (k) => (arm.has(k) ? arm.get(k) : null),
    setItem: (k, v) => void arm.set(k, String(v)),
    removeItem: (k) => void arm.delete(k),
};
const P = await import('../../src/utils/perfil.js');

const SP = { nome: 'São Paulo, SP', lat: -23.55, lon: -46.63, tz: 'America/Sao_Paulo' };
const RIO = { nome: 'Rio de Janeiro, RJ', lat: -22.91, lon: -43.17, tz: 'America/Sao_Paulo' };
const base = { data: '1990-04-15', hora: '09:40', local: SP, escolha: 0 };

beforeEach(() => arm.clear());

test('primeiro preenchimento cria e guarda o mapa principal com o apelido', () => {
    assert.equal(P.principal(), null);
    const r = P.salvarMeusDados({ ...base, apelido: '  Lia  ' });
    assert.equal(r.ok, true);
    assert.equal(r.criado, true);
    const p = P.principal();
    assert.equal(p.id, r.id);
    assert.equal(p.rotulo, 'Meu mapa');
    assert.equal(p.principal, true);
    assert.equal(p.data, '1990-04-15');
    assert.equal(p.hora, '09:40');
    assert.equal(P.apelido(), 'Lia');
    assert.equal(P.listar().length, 1);
});

test('nao sei a hora guarda hora nula', () => {
    P.salvarMeusDados({ ...base, hora: null });
    assert.equal(P.principal().hora, null);
});

test('editar a hora recalcula o principal sem duplicar e zera casas (dados mudaram)', () => {
    const { id } = P.salvarMeusDados(base);
    P.definirPreferencias(id, { casas: 'igual' });
    const r = P.salvarMeusDados({ ...base, hora: '10:15' });
    assert.equal(r.id, id);
    assert.equal(r.criado, undefined);
    assert.equal(P.listar().length, 1);
    assert.equal(P.principal().hora, '10:15');
    assert.equal(P.principal().casas, 'placidus');
});

test('editar so o apelido preserva a escolha da hora ambigua e as casas', () => {
    const amb = { data: '2018-02-17', hora: '23:30', local: SP, escolha: 1 };
    const { id } = P.salvarMeusDados(amb);
    P.definirPreferencias(id, { casas: 'igual' });
    // o formulario manda escolha 0 quando nao pergunta de novo: a gravada vale
    P.salvarMeusDados({ ...amb, escolha: 0, apelido: 'Nova' });
    const p = P.principal();
    assert.equal(p.escolha, 1);
    assert.equal(p.casas, 'igual');
    assert.equal(P.apelido(), 'Nova');
});

test('mudar a cidade: a escolha vem da entrada e as casas voltam ao padrao', () => {
    const { id } = P.salvarMeusDados({ ...base, escolha: 1 });
    P.definirPreferencias(id, { casas: 'igual' });
    P.salvarMeusDados({ ...base, local: RIO, escolha: 0 });
    const p = P.principal();
    assert.equal(p.local.nome, RIO.nome);
    assert.equal(p.escolha, 0);
    assert.equal(p.casas, 'placidus');
});

test('apelido vazio remove; apelido longo e limpo e cortado', () => {
    P.salvarMeusDados({ ...base, apelido: 'x'.repeat(80) + '\u0000' });
    assert.equal(P.apelido().length, P.LIMITE_APELIDO);
    P.salvarMeusDados({ ...base, apelido: '   ' });
    assert.equal(P.apelido(), '');
});

test('dados invalidos nao criam nada', () => {
    for (const ruim of [{ ...base, data: '1990-02-31' }, { ...base, hora: '25:00' }, { ...base, local: { ...SP, lat: 120 } }, { ...base, local: { ...SP, tz: 'Nao/Existe' } }]) {
        const r = P.salvarMeusDados({ ...ruim, apelido: 'Zé' });
        assert.equal(r.ok, false);
    }
    assert.equal(P.listar().length, 0);
    assert.equal(P.apelido(), '');
});

test('os mesmos dados ja guardados como outro mapa viram o principal, sem duplicar', () => {
    P.adicionar({ rotulo: 'Júlia', ...base, principal: false });
    const r = P.salvarMeusDados(base);
    assert.equal(r.ok, true);
    assert.equal(P.listar().length, 1);
    assert.equal(P.principal().rotulo, 'Meu mapa');
});

test('outra pessoa nunca mexe no principal', () => {
    const { id } = P.salvarMeusDados(base);
    const o = P.adicionar({ rotulo: 'Mãe', data: '1960-01-02', hora: null, local: RIO, principal: true });
    assert.equal(o.ok, true);
    assert.equal(P.principal().id, id);
    assert.equal(P.listar().length, 2);
});

test('exportar traz o apelido e importar nao duplica', () => {
    P.salvarMeusDados({ ...base, apelido: 'Lia' });
    const arquivo = JSON.stringify(P.exportar());
    assert.equal(JSON.parse(arquivo).perfil.apelido, 'Lia');
    const r = P.importar(arquivo);
    assert.equal(r.mapas, 0);
    assert.equal(r.repetidos, 1);
    assert.equal(P.listar().length, 1);
    arm.clear();
    const r2 = P.importar(arquivo);
    assert.equal(r2.mapas, 1);
    assert.equal(P.apelido(), 'Lia');
    assert.equal(P.principal().data, '1990-04-15');
});

test('importacao hostil: lixo, proto, tipos errados, dois principais', () => {
    assert.equal(P.importar('nao json').ok, false);
    assert.equal(P.importar('[]').ok, false);
    assert.equal(P.importar(JSON.stringify({ app: 'outro', formato: 1 })).ok, false);
    assert.equal(P.importar('x'.repeat(P.LIMITE_ARQUIVO + 1)).ok, false);
    const mapa = (id, extra = {}) => ({ id, rotulo: '<img src=x onerror=1>', data: '1991-05-05', hora: '08:00', local: SP, principal: true, ...extra });
    const hostil = JSON.stringify({
        app: 'aeon', formato: 1,
        perfil: {
            apelido: { toString: 1 },
            mapas: [
                mapa('a'), mapa('b', { data: '1992-06-06' }), mapa('../c', { data: '1993-01-01' }),
                { ...mapa('d', { data: '1994-01-01' }), __proto__: { x: 1 }, constructor: 1 },
                mapa('e', { data: '2999-01-01' }), mapa('f', { hora: 7 }), mapa('g', { local: { ...SP, lat: NaN } }), 42, null,
            ],
        },
        diario: 'texto',
    });
    const r = P.importar(hostil);
    assert.equal(r.mapas, 2);
    assert.ok(r.ignorados >= 5);
    assert.equal(P.listar().filter((m) => m.principal).length, 1);
    assert.equal(P.apelido(), '');
    assert.equal({}.x, undefined);
});
