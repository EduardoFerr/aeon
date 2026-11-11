import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
};
const C = await import('../../src/utils/convite.js');
const DIA = 24 * 60 * 60 * 1000;
const base = { ativa: true, fase: 'desligada', registros: 3, backupAtivo: false, dispensadoEm: null, agora: Date.parse('2026-11-12T12:00:00Z') };

test('aparece quando a sincronização existe, está desligada e há algo a proteger', () => {
    assert.equal(C.conviteAtivo(base), true);
});

test('não aparece sem sincronização no build, ligada, a meio caminho, ou sem registros', () => {
    assert.equal(C.conviteAtivo({ ...base, ativa: false }), false);
    assert.equal(C.conviteAtivo({ ...base, fase: 'ligada' }), false);
    assert.equal(C.conviteAtivo({ ...base, fase: 'juntar' }), false);
    assert.equal(C.conviteAtivo({ ...base, registros: 0 }), false);
});

test('um aviso por vez: com o lembrete de backup na tela, o convite espera', () => {
    assert.equal(C.conviteAtivo({ ...base, backupAtivo: true }), false);
});

test('"Agora não" esconde por 30 dias e depois volta', () => {
    const agora = base.agora;
    assert.equal(C.conviteAtivo({ ...base, dispensadoEm: new Date(agora - 1 * DIA).toISOString() }), false);
    assert.equal(C.conviteAtivo({ ...base, dispensadoEm: new Date(agora - 29 * DIA).toISOString() }), false);
    assert.equal(C.conviteAtivo({ ...base, dispensadoEm: new Date(agora - 30 * DIA).toISOString() }), true);
    assert.equal(C.conviteAtivo({ ...base, dispensadoEm: new Date(agora - 90 * DIA).toISOString() }), true);
});

test('data de dispensa inválida ou no futuro não esconde o convite para sempre', () => {
    assert.equal(C.conviteAtivo({ ...base, dispensadoEm: 'ontem' }), true);
    assert.equal(C.conviteAtivo({ ...base, dispensadoEm: '2099-01-01T00:00:00Z' }), true);
    assert.equal(C.conviteAtivo({ ...base, dispensadoEm: 42 }), true);
});

test('a dispensa é guardada e lida só como data; dado corrompido é ignorado', () => {
    mem.clear();
    assert.equal(C.lerDispensa(), null);
    assert.equal(C.dispensarConvite(new Date('2026-11-12T12:00:00Z')), true);
    assert.equal(C.lerDispensa(), '2026-11-12T12:00:00.000Z');
    mem.set(C.CHAVE_CONVITE, '{quebrado');
    assert.equal(C.lerDispensa(), null);
    mem.set(C.CHAVE_CONVITE, JSON.stringify({ dispensadoEm: { x: 1 } }));
    assert.equal(C.lerDispensa(), null);
});
