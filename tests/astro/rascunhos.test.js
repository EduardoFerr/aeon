import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
};
const R = await import('../../src/utils/rascunhos.js');

test('o rascunho é guardado, lido e apagado; a nota salva não é tocada', () => {
    mem.clear();
    assert.equal(R.lerRascunho('leitura-1'), null);
    assert.equal(R.gravarRascunho('leitura-1', 'texto digitado'), true);
    assert.equal(R.lerRascunho('leitura-1'), 'texto digitado');
    assert.deepEqual(R.idsComRascunho(), ['leitura-1']);
    R.limparRascunho('leitura-1');
    assert.equal(R.lerRascunho('leitura-1'), null);
    assert.equal(mem.has(R.CHAVE_RASCUNHOS), false);
    assert.equal(mem.has('aeon:v2:diario'), false);
});

test('rascunho vazio vale: apagar tudo na caixa também fica guardado até Salvar ou Descartar', () => {
    mem.clear();
    R.gravarRascunho('a', '');
    assert.equal(R.lerRascunho('a'), '');
});

test('limites: texto de 2000 caracteres e 50 rascunhos (os mais antigos saem)', () => {
    mem.clear();
    R.gravarRascunho('grande', 'x'.repeat(5000));
    assert.equal(R.lerRascunho('grande').length, 2000);
    mem.clear();
    for (let i = 0; i < 55; i++) R.gravarRascunho(`e${i}`, 't', new Date(2026, 0, 1, 0, 0, i));
    const ids = R.idsComRascunho();
    assert.equal(ids.length, 50);
    assert.ok(!ids.includes('e0') && ids.includes('e54'));
});

test('dado corrompido ou hostil é ignorado', () => {
    mem.clear();
    mem.set(R.CHAVE_RASCUNHOS, '{quebrado');
    assert.equal(R.lerRascunho('a'), null);
    mem.set(R.CHAVE_RASCUNHOS, JSON.stringify({ v: 1, itens: { '__proto__': { texto: 'x' }, 'id ruim': { texto: 'x' }, ok: { texto: 'bom' }, num: { texto: 5 } } }));
    assert.deepEqual(R.idsComRascunho(), ['ok']);
    assert.equal(R.gravarRascunho('id ruim', 'x'), false);
});

test('limparTodosRascunhos apaga a chave', () => {
    mem.clear();
    R.gravarRascunho('a', 'x');
    R.limparTodosRascunhos();
    assert.equal(mem.has(R.CHAVE_RASCUNHOS), false);
});
