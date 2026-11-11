import test from 'node:test';
import assert from 'node:assert/strict';
import { subir, item } from './ajuda.js';
import { normalizarChave } from '../src/auth.js';
import { PALAVRAS } from '../src/palavras.js';

const T = (min) => new Date(Date.parse('2026-11-12T10:00:00Z') + min * 60000).toISOString();
const entrada = (nota = '') => ({ id: 'x', t: T(0), tipo: 'leitura', cartas: [{ order: 1, pos: 'passado' }], nota });
const como = (conta) => (conta ? { 'X-Aeon-Conta': String(conta) } : {});
const enviar = (s, cookie, itens, conta) => s.chamar('POST', '/v1/sync', { cookie, cabecalhos: como(conta), corpo: { desde: 0, itens } });
const ler = (s, cookie, conta) => s.chamar('GET', '/v1/sync?desde=0', { cookie, cabecalhos: como(conta) });

async function anonimo(s, aparelho = 'Aparelho') {
    s.avancar(31 * 60 * 1000); // o servidor so cria uma conta anonima por IP a cada 30 minutos
    const r = await s.chamar('POST', '/v1/auth/anonimo', { corpo: { aparelho } });
    return { cookie: r.setCookie.split(';')[0], id: r.json.usuario.id, chave: r.json.chave };
}
const comChave = (s, cookie, chave, { modo, conta } = {}) =>
    s.chamar('POST', '/v1/auth/chave', { cookie, cabecalhos: como(conta), corpo: { chave, modo, aparelho: 'Novo' } });

test('a lista tem 2048 palavras distintas, só letras minúsculas sem acento', () => {
    assert.equal(PALAVRAS.length, 2048);
    assert.equal(new Set(PALAVRAS).size, 2048);
    assert.ok(PALAVRAS.every((p) => /^[a-z]+$/.test(p)));
});

test('normalizarChave aceita maiúsculas, acento, vírgulas e hífens, e recusa o resto', () => {
    const base = PALAVRAS.slice(0, 12);
    const canonica = base.join(' ');
    assert.equal(normalizarChave(canonica), canonica);
    assert.equal(normalizarChave(base.join(' ').toUpperCase()), canonica);
    assert.equal(normalizarChave(base.join(', ')), canonica);
    assert.equal(normalizarChave(`  ${base.join('-')}  `), canonica);
    assert.equal(normalizarChave(base.slice(0, 11).join(' ')), null);
    assert.equal(normalizarChave([...base.slice(0, 11), 'xyzxyz'].join(' ')), null);
    assert.equal(normalizarChave(canonica + ' abacate'), null);
    assert.equal(normalizarChave(null), null);
    assert.equal(normalizarChave('a'.repeat(500)), null);
});

test('conta anônima nasce com chave de 12 palavras; o banco guarda só o hash', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const a = await anonimo(s);
    assert.equal(normalizarChave(a.chave), a.chave);
    const dump = JSON.stringify(s.app.db.prepare('SELECT * FROM usuarios').all());
    assert.ok(!dump.includes(a.chave.split(' ')[0] + ' ' + a.chave.split(' ')[1]));
    const eu = await s.chamar('GET', '/v1/eu', { cookie: a.cookie });
    assert.equal(eu.json.contas[0].tem_chave, true);
    assert.ok(!JSON.stringify(eu.json).includes(a.chave));
});

test('outro aparelho entra com a chave e recebe os dados; dois aparelhos, uma conta', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const a = await anonimo(s, 'Casa');
    await enviar(s, a.cookie, [item('diario', 'd1', entrada('guardada'), T(1))]);
    const r = await comChave(s, undefined, a.chave.toUpperCase());
    assert.equal(r.status, 200);
    assert.equal(r.json.acao, 'entrou');
    assert.equal(r.json.usuario.id, a.id);
    const cookie2 = r.setCookie.split(';')[0];
    assert.deepEqual((await ler(s, cookie2)).json.itens.map((i) => i.id), ['d1']);
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n, 1);
});

test('chave errada, malformada ou de conta inexistente dá a mesma resposta', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    await anonimo(s);
    const falsa = PALAVRAS.slice(100, 112).join(' ');
    const r1 = await comChave(s, undefined, falsa);
    const r2 = await comChave(s, undefined, 'abacate abaixo');
    const r3 = await comChave(s, undefined, 123);
    for (const r of [r1, r2, r3]) {
        assert.equal(r.status, 400);
        assert.equal(r.json.erro, 'chave_invalida');
    }
    assert.equal(r1.setCookie, '');
});

test('entrar com a chave tem limite por IP', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    let ultimo;
    for (let i = 0; i < 11; i++) ultimo = await comChave(s, undefined, PALAVRAS.slice(i, i + 12).join(' '));
    assert.equal(ultimo.status, 429);
});

test('aparelho com conta com dados: a chave pergunta (409) e depois vale com o modo, igual ao e-mail', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const casa = await anonimo(s, 'Casa');
    await enviar(s, casa.cookie, [item('diario', 'so-casa', entrada('c'), T(1))]);
    const cel = await anonimo(s, 'Celular');
    await enviar(s, cel.cookie, [item('diario', 'so-celular', entrada('p'), T(2))]);
    const r1 = await comChave(s, cel.cookie, casa.chave);
    assert.equal(r1.status, 409);
    assert.equal(r1.json.erro, 'conta_existente');
    const r2 = await comChave(s, cel.cookie, casa.chave, { modo: 'unir' });
    assert.equal(r2.status, 200);
    assert.equal(r2.json.acao, 'unir');
    assert.deepEqual((await ler(s, cel.cookie)).json.itens.map((i) => i.id).sort(), ['so-casa', 'so-celular']);
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n, 1);
});

test('conta atual vazia: a chave troca em silêncio; chave de uma conta que já está no aparelho não muda nada', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const casa = await anonimo(s, 'Casa');
    await enviar(s, casa.cookie, [item('diario', 'd1', entrada('c'), T(1))]);
    const cel = await anonimo(s, 'Celular');
    const r = await comChave(s, cel.cookie, casa.chave);
    assert.equal(r.status, 200);
    assert.equal(r.json.acao, 'descartar');
    const de_novo = await comChave(s, cel.cookie, casa.chave);
    assert.equal(de_novo.json.acao, 'ja_estava');
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n, 1);
});

test('chave nova: a antiga deixa de valer e a nova funciona', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const a = await anonimo(s);
    const r = await s.chamar('POST', '/v1/contas/chave', { cookie: a.cookie, corpo: {} });
    assert.equal(r.status, 200);
    assert.notEqual(r.json.chave, a.chave);
    assert.equal((await comChave(s, undefined, a.chave)).status, 400);
    assert.equal((await comChave(s, undefined, r.json.chave)).status, 200);
});

test('conta criada por e-mail não tem chave até pedir; depois pede e entra com ela', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const cookie = await s.entrar('ana@exemplo.com', 'Casa');
    const eu = await s.chamar('GET', '/v1/eu', { cookie });
    assert.equal(eu.json.contas[0].tem_chave, false);
    const r = await s.chamar('POST', '/v1/contas/chave', { cookie, corpo: {} });
    const entra = await comChave(s, undefined, r.json.chave);
    assert.equal(entra.status, 200);
    assert.equal(entra.json.usuario.email, 'ana@exemplo.com');
});

test('apagar a conta apaga a chave junto', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const a = await anonimo(s);
    await s.chamar('DELETE', '/v1/conta', { cookie: a.cookie, corpo: { confirmo: 'apagar' } });
    assert.equal((await comChave(s, undefined, a.chave)).status, 400);
});

test('conta anônima extra também recebe chave', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const a = await anonimo(s);
    s.avancar(31 * 60 * 1000);
    const nova = await s.chamar('POST', '/v1/contas/anonima', { cookie: a.cookie, corpo: {} });
    assert.equal(normalizarChave(nova.json.chave), nova.json.chave);
    assert.notEqual(nova.json.chave, a.chave);
});
