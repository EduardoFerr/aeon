import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
};
const C = await import('../../src/utils/contas.js');
const D = await import('../../src/utils/diario.js');
const P = await import('../../src/utils/perfil.js');
const R = await import('../../src/utils/rascunhos.js');
const E = await import('../../src/utils/contaEstado.js');

const nunca = () => assert.fail('nao devia recarregar');
const mapa = (rotulo, data = '1990-05-01') => ({ rotulo, data, hora: '08:30', local: { nome: 'Sao Paulo', lat: -23.55, lon: -46.63, tz: 'America/Sao_Paulo' }, principal: true });
const cartas = [{ order: 1, pos: 'passado' }];

test('sem registro, a conta inicial usa os nomes antigos e nada e escrito', () => {
    mem.clear();
    assert.equal(C.contaAtiva(), 'c1');
    assert.equal(C.chaveDe('diario'), 'aeon:v2:diario');
    assert.equal(C.chaveDe('perfil'), 'aeon:v2:perfil');
    assert.equal(C.chaveDe('diario', 'c-abc'), 'aeon:v2:c:c-abc:diario');
    assert.equal(mem.has(C.CHAVE_REGISTRO), false);
});

test('quem ja tem dados nos nomes antigos continua vendo tudo na conta inicial', () => {
    mem.clear();
    const doc = { v: 2, entradas: [{ id: 'leitura-1', t: new Date().toISOString(), tipo: 'leitura', cartas, nota: 'antiga', m: new Date().toISOString() }], ocultos: [] };
    mem.set('aeon:v2:diario', JSON.stringify(doc));
    assert.deepEqual(D.listar().map((e) => e.id), ['leitura-1']);
});

test('cada conta tem diario, mapas, rascunhos e estado de sincronizacao proprios', () => {
    mem.clear();
    const id1 = D.criarLeitura(cartas, 'da conta 1');
    P.adicionar(mapa('Mapa da 1'));
    R.gravarRascunho('x', 'rascunho da 1');
    E.salvarEstado({ cursor: 7 });
    const c2 = C.criarContaLocal('Segunda');
    let recarregou = 0;
    assert.equal(C.trocarConta(c2, () => recarregou++), true);
    assert.equal(recarregou, 1);
    assert.equal(C.contaAtiva(), c2);
    assert.equal(D.listar().length, 0);
    assert.equal(P.listar().length, 0);
    assert.equal(R.lerRascunho('x'), null);
    assert.equal(E.lerEstado().cursor, 0);
    D.criarLeitura(cartas, 'da conta 2');
    P.adicionar(mapa('Mapa da 2', '1985-01-01'));
    assert.equal(D.listar().length, 1);
    assert.equal(P.listar()[0].rotulo, 'Mapa da 2');
    C.trocarConta('c1', () => {});
    assert.equal(D.listar().length, 1);
    assert.equal(D.listar()[0].pergunta, 'da conta 1');
    assert.equal(P.listar()[0].rotulo, 'Mapa da 1');
    assert.equal(R.lerRascunho('x'), 'rascunho da 1');
    assert.equal(E.lerEstado().cursor, 7);
    assert.ok(id1);
});

test('o historico antigo (tarotHistory) so aparece na conta inicial', () => {
    mem.clear();
    mem.set('tarotHistory', JSON.stringify([{ id: 1, date: '2025-02-01T10:00:00.000Z', cards: { passado: { order: 3 } } }]));
    const antes = D.listar().length;
    const c2 = C.criarContaLocal();
    C.trocarConta(c2, () => {});
    assert.equal(D.listar().length, 0);
    assert.equal(D.instantaneo().antigo, null);
    C.trocarConta('c1', () => {});
    assert.equal(D.listar().length, antes);
});

test('trocar para conta que nao existe nao muda nada', () => {
    mem.clear();
    assert.equal(C.trocarConta('nao-existe', nunca), false);
    assert.equal(C.contaAtiva(), 'c1');
});

test('remover uma conta apaga so os dados dela; se era a ativa, ativa outra e recarrega', () => {
    mem.clear();
    D.criarLeitura(cartas, 'da 1');
    const c2 = C.criarContaLocal();
    C.trocarConta(c2, () => {});
    D.criarLeitura(cartas, 'da 2');
    let recarregou = 0;
    const r = C.removerContaLocal(c2, () => recarregou++);
    assert.deepEqual(r, { ok: true, recarregou: true });
    assert.equal(recarregou, 1);
    assert.equal(C.contaAtiva(), 'c1');
    assert.deepEqual(C.listarContas().map((c) => c.id), ['c1']);
    assert.equal([...mem.keys()].some((k) => k.startsWith(`aeon:v2:c:${c2}:`)), false);
    assert.equal(D.listar()[0].pergunta, 'da 1');
});

test('remover uma conta que nao e a ativa nao recarrega a pagina', () => {
    mem.clear();
    const c2 = C.criarContaLocal();
    D.criarLeitura(cartas, 'da 1');
    const r = C.removerContaLocal(c2, nunca);
    assert.deepEqual(r, { ok: true, recarregou: false });
    assert.equal(D.listar().length, 1);
});

test('remover a unica conta apaga os dados e deixa uma conta vazia', () => {
    mem.clear();
    D.criarLeitura(cartas, 'x');
    P.adicionar(mapa('M'));
    let recarregou = 0;
    C.removerContaLocal('c1', () => recarregou++);
    assert.equal(recarregou, 1);
    assert.equal(C.listarContas().length, 1);
    assert.equal(D.listar().length, 0);
    assert.equal(P.listar().length, 0);
});

test('registro corrompido ou com ids ruins volta ao padrao sem quebrar', () => {
    mem.clear();
    mem.set(C.CHAVE_REGISTRO, '{quebrado');
    assert.equal(C.contaAtiva(), 'c1');
    mem.set(C.CHAVE_REGISTRO, JSON.stringify({ v: 1, ativa: '../x', lista: [{ id: '../x' }, { id: 'ok-1', rotulo: 'A\nB' }, { id: 'ok-1' }] }));
    assert.deepEqual(C.listarContas().map((c) => c.id), ['ok-1']);
    assert.equal(C.contaAtiva(), 'ok-1');
    assert.equal(C.listarContas()[0].rotulo, 'A B');
});

test('o aparelho aceita no maximo 10 contas', () => {
    mem.clear();
    for (let i = 0; i < 9; i++) assert.ok(C.criarContaLocal());
    assert.equal(C.listarContas().length, 10);
    assert.equal(C.criarContaLocal(), null);
});

test('renomear conta', () => {
    mem.clear();
    const c = C.criarContaLocal('Velha');
    assert.equal(C.renomearConta(c, '  Nova  '), true);
    assert.equal(C.listarContas().find((x) => x.id === c).rotulo, 'Nova');
    assert.equal(C.renomearConta('nao-existe', 'x'), false);
});
