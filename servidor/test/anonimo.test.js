import test from 'node:test';
import assert from 'node:assert/strict';
import { subir, item } from './ajuda.js';
import { abrirBanco } from '../src/db.js';

const T = (min) => new Date(Date.parse('2026-11-12T10:00:00Z') + min * 60000).toISOString();
const entrada = (nota = '') => ({ id: 'x', t: T(0), tipo: 'leitura', cartas: [{ order: 1, pos: 'passado' }], nota });
const enviar = (s, cookie, itens, desde = 0) => s.chamar('POST', '/v1/sync', { cookie, corpo: { desde, itens } });

async function anonimo(s, aparelho = 'Aparelho') {
    const r = await s.chamar('POST', '/v1/auth/anonimo', { corpo: { aparelho } });
    assert.equal(r.status, 201);
    return r.setCookie.split(';')[0];
}

async function loginCom(s, cookie, emailUsuario) {
    await s.chamar('POST', '/v1/auth/pedir', { corpo: { email: emailUsuario } });
    await s.app.ocioso();
    const codigo = /é (\d{6})\./.exec(s.enviados[s.enviados.length - 1].texto)[1];
    return s.chamar('POST', '/v1/auth/confirmar', { cookie, corpo: { email: emailUsuario, codigo, aparelho: 'X' } });
}

test('migração de arquivo: v1 vira v2 sem perder nada e aceita e-mail nulo', async () => {
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const caminho = join(mkdtempSync(join(tmpdir(), 'aeon-')), 'm.db');
    const v1 = abrirBanco(caminho, { ateVersao: 1 });
    v1.prepare("INSERT INTO usuarios (email, criado_em, ultimo_acesso, seq) VALUES ('a@b.com', 'x', 'x', 1)").run();
    v1.prepare("INSERT INTO itens (usuario_id, tipo, id, dados, atualizado_em, seq, apagado) VALUES (1, 'diario', 'd', '{}', 'x', 1, 0)").run();
    v1.prepare("INSERT INTO sessoes (id, token_hash, usuario_id, aparelho, criada_em, ultimo_uso) VALUES ('s', 'h', 1, 'a', 'x', 'x')").run();
    v1.close();
    const v2 = abrirBanco(caminho);
    assert.equal(v2.prepare('PRAGMA user_version').get().user_version, 2);
    assert.equal(v2.prepare('SELECT COUNT(*) AS n FROM itens').get().n, 1);
    assert.equal(v2.prepare('SELECT COUNT(*) AS n FROM sessoes').get().n, 1);
    assert.equal(v2.prepare('SELECT email FROM usuarios WHERE id = 1').get().email, 'a@b.com');
    v2.prepare("INSERT INTO usuarios (email, criado_em, ultimo_acesso) VALUES (NULL, 'x', 'x')").run();
    assert.equal(v2.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    v2.close();
});

test('conta anônima: nasce sem e-mail, sincroniza e /v1/eu diz que é anônima', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const c = await anonimo(s);
    const eu = await s.chamar('GET', '/v1/eu', { cookie: c });
    assert.equal(eu.status, 200);
    assert.equal(eu.json.email, null);
    assert.equal(eu.json.anonimo, true);
    const r = await enviar(s, c, [item('diario', 'd1', entrada('oi'), T(1))]);
    assert.equal(r.json.aplicados, 1);
});

test('criar conta anônima tem limite por IP', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    let ultimo;
    for (let i = 0; i < 31; i++) ultimo = await s.chamar('POST', '/v1/auth/anonimo', { corpo: {} });
    assert.equal(ultimo.status, 429);
});

test('login numa conta anônima só associa o e-mail: os dados e o cookie continuam', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const c = await anonimo(s);
    await enviar(s, c, [item('diario', 'd1', entrada('guardada'), T(1))]);
    const r = await loginCom(s, c, 'ana@exemplo.com');
    assert.equal(r.status, 200);
    assert.equal(r.json.vinculou, true);
    assert.equal(r.setCookie, ''); // sessão mantida
    const eu = await s.chamar('GET', '/v1/eu', { cookie: c });
    assert.equal(eu.json.email, 'ana@exemplo.com');
    assert.equal(eu.json.anonimo, false);
    // outro aparelho, mesmo e-mail, sem conta anônima: entra e recebe os dados
    s.avancar(31 * 1000);
    const b = await s.entrar('ana@exemplo.com', 'Notebook');
    const l = await s.chamar('GET', '/v1/sync?desde=0', { cookie: b });
    assert.deepEqual(l.json.itens.map((i) => i.id), ['d1']);
});

test('login de um aparelho anônimo num e-mail que já tem conta funde os dados (vale a edição mais recente)', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const casa = await s.entrar('ana@exemplo.com', 'Casa');
    await enviar(s, casa, [item('diario', 'comum', entrada('antiga'), T(1)), item('diario', 'so-casa', entrada('c'), T(2))]);
    s.avancar(31 * 1000);
    const novo = await anonimo(s, 'Celular');
    await enviar(s, novo, [item('diario', 'comum', entrada('nova'), T(9)), item('diario', 'so-celular', entrada('p'), T(3))]);
    s.avancar(31 * 1000);
    const r = await loginCom(s, novo, 'ana@exemplo.com');
    assert.equal(r.status, 200);
    assert.equal(r.json.fundiu, true);
    const l = await s.chamar('GET', '/v1/sync?desde=0', { cookie: novo });
    const por = Object.fromEntries(l.json.itens.map((i) => [i.id, i.dados.nota]));
    assert.deepEqual(por, { comum: 'nova', 'so-casa': 'c', 'so-celular': 'p' });
    // a casa também enxerga tudo
    const lc = await s.chamar('GET', '/v1/sync?desde=0', { cookie: casa });
    assert.equal(lc.json.itens.length, 3);
    // a conta anônima sumiu e só sobrou um usuário
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n, 1);
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM sessoes').get().n, 2);
});

test('a fusão leva as marcas de exclusão também', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const casa = await s.entrar('ana@exemplo.com', 'Casa');
    await enviar(s, casa, [item('diario', 'd1', entrada('x'), T(1))]);
    s.avancar(31 * 1000);
    const novo = await anonimo(s);
    await enviar(s, novo, [item('diario', 'd1', null, T(5), true)]);
    s.avancar(31 * 1000);
    await loginCom(s, novo, 'ana@exemplo.com');
    const l = await s.chamar('GET', '/v1/sync?desde=0', { cookie: casa });
    assert.equal(l.json.itens.find((i) => i.id === 'd1').apagado, true);
});

test('limpeza apaga conta anônima sem sessão, e mantém a que tem sessão', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const c = await anonimo(s);
    await enviar(s, c, [item('diario', 'd1', entrada(), T(1))]);
    s.app.db.prepare('DELETE FROM sessoes').run();
    const c2 = await anonimo(s);
    s.app.auth.limpar();
    const restam = s.app.db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n;
    assert.equal(restam, 1);
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM itens').get().n, 0);
    assert.equal((await s.chamar('GET', '/v1/eu', { cookie: c2 })).status, 200);
});

test('apagar a conta anônima não envia e-mail', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const c = await anonimo(s);
    const antes = s.enviados.length;
    const r = await s.chamar('DELETE', '/v1/conta', { cookie: c, corpo: { confirmo: 'apagar' } });
    assert.equal(r.status, 200);
    await s.app.ocioso();
    assert.equal(s.enviados.length, antes);
    assert.equal((await s.chamar('GET', '/v1/eu', { cookie: c })).status, 401);
});
