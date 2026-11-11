import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
};
const P = await import('../../src/utils/contaPendente.js');
const K = await import('../../src/utils/contas.js');
const T0 = Date.parse('2026-11-12T12:00:00Z');

test('o login pendente volta enquanto o código vale (10 minutos) e some depois', () => {
    mem.clear();
    assert.equal(P.lerPendente(T0), null);
    assert.equal(P.guardarPendente({ email: 'ana@exemplo.com' }, T0), true);
    assert.deepEqual(P.lerPendente(T0 + 60 * 1000), { email: 'ana@exemplo.com', vincular: false, pedidoEm: T0 });
    assert.ok(P.lerPendente(T0 + 9 * 60 * 1000 + 59 * 1000));
    assert.equal(P.lerPendente(T0 + 10 * 60 * 1000 + 1), null);
});

test('limpar apaga; relógio errado ou dado ruim não valem', () => {
    mem.clear();
    P.guardarPendente({ email: 'ana@exemplo.com', vincular: true }, T0);
    assert.equal(P.lerPendente(T0).vincular, true);
    P.limparPendente();
    assert.equal(P.lerPendente(T0), null);
    P.guardarPendente({ email: 'a@b.com' }, T0 + 60 * 60 * 1000); // pedido "no futuro"
    assert.equal(P.lerPendente(T0), null);
    mem.set(P.CHAVE_PENDENTE, '{quebrado');
    assert.equal(P.lerPendente(T0), null);
    mem.set(P.CHAVE_PENDENTE, JSON.stringify({ email: 5, pedidoEm: T0 }));
    assert.equal(P.lerPendente(T0), null);
});

test('a pendência é da conta em uso: outra conta não a enxerga', () => {
    mem.clear();
    P.guardarPendente({ email: 'ana@exemplo.com' }, T0);
    const c2 = K.criarContaLocal();
    K.trocarConta(c2, () => {});
    assert.equal(P.lerPendente(T0), null);
    K.trocarConta('c1', () => {});
    assert.ok(P.lerPendente(T0));
});
