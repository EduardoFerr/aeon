import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { subir, item } from './ajuda.js';
import { abrirBanco } from '../src/db.js';

const T = (min) => new Date(Date.parse('2026-11-12T10:00:00Z') + min * 60000).toISOString();
const entrada = (nota = '') => ({ id: 'x', t: T(0), tipo: 'leitura', cartas: [{ order: 1, pos: 'passado' }], nota });
const como = (conta) => (conta ? { 'X-Aeon-Conta': String(conta) } : {});
const enviar = (s, cookie, itens, conta) => s.chamar('POST', '/v1/sync', { cookie, cabecalhos: como(conta), corpo: { desde: 0, itens } });
const ler = (s, cookie, conta) => s.chamar('GET', '/v1/sync?desde=0', { cookie, cabecalhos: como(conta) });

async function anonimo(s, aparelho = 'Aparelho') {
    s.avancar(31 * 60 * 1000); // o servidor so cria uma conta anonima por IP a cada 30 minutos
    const r = await s.chamar('POST', '/v1/auth/anonimo', { corpo: { aparelho } });
    assert.equal(r.status, 201);
    return { cookie: r.setCookie.split(';')[0], id: r.json.usuario.id, chave: r.json.chave };
}

/** Pede o código e confirma. Devolve a resposta; `codigoAnterior` permite reusar um código já enviado. */
async function loginCom(s, cookie, emailUsuario, { modo, conta, codigo } = {}) {
    if (!codigo) {
        await s.chamar('POST', '/v1/auth/pedir', { corpo: { email: emailUsuario } });
        await s.app.ocioso();
        codigo = /é (\d{6})\./.exec(s.enviados[s.enviados.length - 1].texto)[1];
    }
    const r = await s.chamar('POST', '/v1/auth/confirmar', { cookie, cabecalhos: como(conta), corpo: { email: emailUsuario, codigo, aparelho: 'X', modo } });
    r.codigo = codigo;
    return r;
}

test('migrações: v1 vira a versão atual sem perder usuários, itens nem sessões, e aceita e-mail nulo', async () => {
    const caminho = join(mkdtempSync(join(tmpdir(), 'aeon-')), 'm.db');
    const v1 = abrirBanco(caminho, { ateVersao: 1 });
    v1.prepare("INSERT INTO usuarios (email, criado_em, ultimo_acesso, seq) VALUES ('a@b.com', 'x', 'x', 1)").run();
    v1.prepare("INSERT INTO itens (usuario_id, tipo, id, dados, atualizado_em, seq, apagado) VALUES (1, 'diario', 'd', '{}', 'x', 1, 0)").run();
    v1.prepare("INSERT INTO sessoes (id, token_hash, usuario_id, aparelho, criada_em, ultimo_uso) VALUES ('s', 'h', 1, 'a', 'x', 'x')").run();
    v1.close();
    const v3 = abrirBanco(caminho);
    assert.equal(v3.prepare('PRAGMA user_version').get().user_version, 5);
    assert.equal(v3.prepare('SELECT COUNT(*) AS n FROM itens').get().n, 1);
    assert.equal(v3.prepare('SELECT COUNT(*) AS n FROM sessoes').get().n, 1);
    assert.deepEqual({ ...v3.prepare('SELECT sessao_id, usuario_id FROM sessao_contas').get() }, { sessao_id: 's', usuario_id: 1 });
    assert.equal(v3.prepare('SELECT email FROM usuarios WHERE id = 1').get().email, 'a@b.com');
    v3.prepare("INSERT INTO usuarios (email, criado_em, ultimo_acesso) VALUES (NULL, 'x', 'x')").run();
    assert.equal(v3.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    v3.close();
});

test('migração 3 a partir de um banco já na versão 2 mantém a ligação da sessão', () => {
    const caminho = join(mkdtempSync(join(tmpdir(), 'aeon-')), 'm.db');
    const v2 = abrirBanco(caminho, { ateVersao: 2 });
    v2.prepare("INSERT INTO usuarios (email, criado_em, ultimo_acesso) VALUES (NULL, 'x', 'x')").run();
    v2.prepare("INSERT INTO sessoes (id, token_hash, usuario_id, aparelho, criada_em, ultimo_uso) VALUES ('s', 'h', 1, 'a', 'x', 'x')").run();
    v2.close();
    const v3 = abrirBanco(caminho);
    assert.equal(v3.prepare('SELECT COUNT(*) AS n FROM sessao_contas').get().n, 1);
    v3.close();
});

test('conta anônima: nasce sem e-mail, sincroniza e /v1/eu mostra id, anonimato e a lista de contas', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const a = await anonimo(s);
    const eu = await s.chamar('GET', '/v1/eu', { cookie: a.cookie });
    assert.equal(eu.json.email, null);
    assert.equal(eu.json.anonimo, true);
    assert.equal(eu.json.id, a.id);
    assert.equal(typeof a.chave, 'string');
    assert.deepEqual(eu.json.contas, [{ id: a.id, email: null, anonimo: true, tem_chave: true }]);
    assert.equal((await enviar(s, a.cookie, [item('diario', 'd1', entrada('oi'), T(1))])).json.aplicados, 1);
});

test('criar conta anônima: 1 por IP a cada 30 minutos e 5 por dia', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const criar = () => s.chamar('POST', '/v1/auth/anonimo', { corpo: {} });
    assert.equal((await criar()).status, 201);
    const logo = await criar();
    assert.equal(logo.status, 429);
    assert.ok(Number(logo.cabecalhos.get('retry-after')) > 0);
    for (let i = 0; i < 4; i++) {
        s.avancar(31 * 60 * 1000);
        assert.equal((await criar()).status, 201);
    }
    s.avancar(31 * 60 * 1000);
    assert.equal((await criar()).status, 429); // a sexta no mesmo dia
    s.avancar(24 * 60 * 60 * 1000);
    assert.equal((await criar()).status, 201);
});

test('e-mail novo numa conta anônima: o e-mail passa a ser dela, com os dados e a mesma sessão', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const a = await anonimo(s);
    await enviar(s, a.cookie, [item('diario', 'd1', entrada('guardada'), T(1))]);
    const r = await loginCom(s, a.cookie, 'ana@exemplo.com');
    assert.equal(r.status, 200);
    assert.equal(r.json.acao, 'vinculou');
    assert.equal(r.setCookie, '');
    const eu = await s.chamar('GET', '/v1/eu', { cookie: a.cookie });
    assert.equal(eu.json.email, 'ana@exemplo.com');
    assert.equal(eu.json.anonimo, false);
    s.avancar(31 * 1000);
    const b = await s.entrar('ana@exemplo.com', 'Notebook');
    assert.deepEqual((await ler(s, b)).json.itens.map((i) => i.id), ['d1']);
});

test('conta atual com dados e e-mail que já tem conta: 409 sem gastar o código; depois vale com o modo', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    await s.entrar('ana@exemplo.com', 'Casa');
    s.avancar(31 * 1000);
    const novo = await anonimo(s, 'Celular');
    await enviar(s, novo.cookie, [item('diario', 'p', entrada('p'), T(1))]);
    const r1 = await loginCom(s, novo.cookie, 'ana@exemplo.com');
    assert.equal(r1.status, 409);
    assert.equal(r1.json.erro, 'conta_existente');
    const r2 = await loginCom(s, novo.cookie, 'ana@exemplo.com', { codigo: r1.codigo, modo: 'adicionar' });
    assert.equal(r2.status, 200);
    assert.equal(r2.json.acao, 'adicionar');
    assert.equal(r2.json.contas.length, 2);
});

test('modo inválido é recusado', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const a = await anonimo(s);
    assert.equal((await loginCom(s, a.cookie, 'ana@exemplo.com', { modo: 'apagar-tudo' })).status, 400);
});

test('conta atual vazia: o login da conta existente troca em silêncio e a vazia some', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const casa = await s.entrar('ana@exemplo.com', 'Casa');
    await enviar(s, casa, [item('diario', 'd1', entrada('a'), T(1))]);
    s.avancar(31 * 1000);
    const novo = await anonimo(s, 'Celular');
    const r = await loginCom(s, novo.cookie, 'ana@exemplo.com');
    assert.equal(r.status, 200);
    assert.equal(r.json.acao, 'descartar');
    assert.deepEqual(r.json.contas.map((c) => c.email), ['ana@exemplo.com']);
    assert.deepEqual((await ler(s, novo.cookie)).json.itens.map((i) => i.id), ['d1']);
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n, 1);
});

test('modo adicionar: duas contas no aparelho, cada pedido escolhe a sua pelo cabeçalho, sem misturar', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const casa = await s.entrar('ana@exemplo.com', 'Casa');
    const idCasa = (await s.chamar('GET', '/v1/eu', { cookie: casa })).json.id;
    await enviar(s, casa, [item('diario', 'so-casa', entrada('c'), T(1))]);
    s.avancar(31 * 1000);
    const cel = await anonimo(s, 'Celular');
    await enviar(s, cel.cookie, [item('diario', 'so-celular', entrada('p'), T(2))]);
    const r = await loginCom(s, cel.cookie, 'ana@exemplo.com', { modo: 'adicionar' });
    assert.equal(r.status, 200);
    assert.equal((await ler(s, cel.cookie, cel.id)).json.itens.map((i) => i.id).join(), 'so-celular');
    assert.equal((await ler(s, cel.cookie, idCasa)).json.itens.map((i) => i.id).join(), 'so-casa');
    assert.equal((await s.chamar('GET', '/v1/eu', { cookie: cel.cookie, cabecalhos: como(idCasa) })).json.email, 'ana@exemplo.com');
    // sem cabeçalho vale a primeira conta (a anônima); conta que não é da sessão dá 403
    assert.equal((await s.chamar('GET', '/v1/eu', { cookie: cel.cookie })).json.id, cel.id);
    assert.equal((await ler(s, cel.cookie, 99999)).status, 403);
});

test('uma sessão não alcança a conta de outro aparelho pelo cabeçalho', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const a = await anonimo(s, 'A');
    const b = await anonimo(s, 'B');
    await enviar(s, a.cookie, [item('diario', 'segredo', entrada('so da A'), T(1))]);
    assert.equal((await ler(s, b.cookie, a.id)).status, 403);
});

test('modo unir: junta os dados (vale a edição mais recente, com exclusões) e a conta anônima some', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const casa = await s.entrar('ana@exemplo.com', 'Casa');
    await enviar(s, casa, [
        item('diario', 'comum', entrada('antiga'), T(1)), item('diario', 'so-casa', entrada('c'), T(2)), item('diario', 'apagar', entrada('z'), T(1)),
    ]);
    s.avancar(31 * 1000);
    const cel = await anonimo(s, 'Celular');
    await enviar(s, cel.cookie, [
        item('diario', 'comum', entrada('nova'), T(9)), item('diario', 'so-celular', entrada('p'), T(3)), item('diario', 'apagar', null, T(5), true),
    ]);
    const r = await loginCom(s, cel.cookie, 'ana@exemplo.com', { modo: 'unir' });
    assert.equal(r.json.acao, 'unir');
    const l = await ler(s, cel.cookie);
    const vivos = Object.fromEntries(l.json.itens.filter((i) => !i.apagado).map((i) => [i.id, i.dados.nota]));
    assert.deepEqual(vivos, { comum: 'nova', 'so-casa': 'c', 'so-celular': 'p' });
    assert.equal(l.json.itens.find((i) => i.id === 'apagar').apagado, true);
    assert.equal((await ler(s, casa)).json.itens.length, 4);
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n, 1);
});

test('modo descartar: apaga a conta anônima e não toca na existente', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const casa = await s.entrar('ana@exemplo.com', 'Casa');
    await enviar(s, casa, [item('diario', 'd1', entrada('c'), T(1))]);
    s.avancar(31 * 1000);
    const cel = await anonimo(s, 'Celular');
    await enviar(s, cel.cookie, [item('diario', 'perdido', entrada('p'), T(2))]);
    const r = await loginCom(s, cel.cookie, 'ana@exemplo.com', { modo: 'descartar' });
    assert.equal(r.json.acao, 'descartar');
    assert.deepEqual((await ler(s, cel.cookie)).json.itens.map((i) => i.id), ['d1']);
    assert.equal(s.app.db.prepare("SELECT COUNT(*) AS n FROM itens WHERE id = 'perdido'").get().n, 0);
});

test('conta com e-mail entrando com outro e-mail: as duas ficam no aparelho', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const a = await s.entrar('ana@exemplo.com', 'Casa');
    s.avancar(31 * 1000);
    const r = await loginCom(s, a, 'bia@exemplo.com');
    assert.equal(r.status, 200);
    assert.equal(r.json.acao, 'adicionou');
    assert.deepEqual(r.json.contas.map((c) => c.email), ['ana@exemplo.com', 'bia@exemplo.com']);
});

test('adicionar outra conta anônima e tirar contas do aparelho', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const a = await anonimo(s);
    s.avancar(31 * 60 * 1000);
    const nova = await s.chamar('POST', '/v1/contas/anonima', { cookie: a.cookie, corpo: {} });
    assert.equal(nova.status, 201);
    assert.equal(nova.json.contas.length, 2);
    const idNova = nova.json.usuario.id;
    await enviar(s, a.cookie, [item('diario', 'd', entrada(), T(1))], idNova);
    // tirar a conta anônima apaga os itens dela; a outra continua e o cookie também
    const tirar = await s.chamar('DELETE', `/v1/contas/${idNova}`, { cookie: a.cookie, corpo: {} });
    assert.equal(tirar.status, 200);
    assert.equal(tirar.setCookie, '');
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM itens').get().n, 0);
    assert.equal((await s.chamar('DELETE', `/v1/contas/${idNova}`, { cookie: a.cookie, corpo: {} })).status, 404);
    // tirar a última fecha a sessão e limpa o cookie
    const ultima = await s.chamar('DELETE', `/v1/contas/${a.id}`, { cookie: a.cookie, corpo: {} });
    assert.match(ultima.setCookie, /Max-Age=0/);
    assert.equal((await s.chamar('GET', '/v1/eu', { cookie: a.cookie })).status, 401);
});

test('tirar uma conta com e-mail do aparelho não a apaga: dá para entrar de novo', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const a = await s.entrar('ana@exemplo.com', 'Casa');
    const id = (await s.chamar('GET', '/v1/eu', { cookie: a })).json.id;
    await enviar(s, a, [item('diario', 'd1', entrada('c'), T(1))]);
    await s.chamar('DELETE', `/v1/contas/${id}`, { cookie: a, corpo: {} });
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM itens').get().n, 1);
    s.avancar(31 * 1000);
    const b = await s.entrar('ana@exemplo.com', 'Casa de novo');
    assert.deepEqual((await ler(s, b)).json.itens.map((i) => i.id), ['d1']);
});

test('limpeza apaga conta anônima sem sessão, e mantém a que tem sessão', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const c = await anonimo(s);
    await enviar(s, c.cookie, [item('diario', 'd1', entrada(), T(1))]);
    s.app.db.prepare('DELETE FROM sessoes').run();
    const c2 = await anonimo(s);
    s.app.auth.limpar();
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n, 1);
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM itens').get().n, 0);
    assert.equal((await s.chamar('GET', '/v1/eu', { cookie: c2.cookie })).status, 200);
});

test('apagar a conta anônima não envia e-mail; apagar uma das contas mantém o cookie da outra', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const a = await anonimo(s);
    s.avancar(31 * 60 * 1000);
    const nova = await s.chamar('POST', '/v1/contas/anonima', { cookie: a.cookie, corpo: {} });
    const antes = s.enviados.length;
    const r = await s.chamar('DELETE', '/v1/conta', { cookie: a.cookie, cabecalhos: como(nova.json.usuario.id), corpo: { confirmo: 'apagar' } });
    assert.equal(r.status, 200);
    assert.equal(r.setCookie, '');
    await s.app.ocioso();
    assert.equal(s.enviados.length, antes);
    assert.equal((await s.chamar('GET', '/v1/eu', { cookie: a.cookie })).json.id, a.id);
    const ultima = await s.chamar('DELETE', '/v1/conta', { cookie: a.cookie, corpo: { confirmo: 'apagar' } });
    assert.match(ultima.setCookie, /Max-Age=0/);
});

test('contas anônimas novas têm teto por hora e por dia no servidor todo', async (t) => {
    const s = await subir({ env: { CONFIAR_PROXY: 'true' } });
    t.after(() => s.fechar());
    const criar = (i) => s.chamar('POST', '/v1/auth/anonimo', { corpo: {}, cabecalhos: { 'X-Forwarded-For': `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}` } });
    for (let i = 0; i < 200; i++) assert.equal((await criar(i)).status, 201, `pedido ${i}`);
    assert.equal((await criar(200)).status, 429); // 200 por hora
    let criadas = 200;
    let i = 1000;
    while (criadas < 2000) {
        s.avancar(61 * 60 * 1000);
        for (let k = 0; k < 150 && criadas < 2000; k++, i++, criadas++) assert.equal((await criar(i)).status, 201, `pedido ${criadas}`);
    }
    s.avancar(61 * 60 * 1000);
    assert.equal((await criar(99999)).status, 429); // 2000 por dia
    s.avancar(25 * 60 * 60 * 1000);
    assert.equal((await criar(99998)).status, 201); // no dia seguinte volta
});

test('conta anônima tem teto de espaço de 2 MB; a com e-mail continua com 5 MB', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const grande = (id) => item('mapa', id, { x: 'a'.repeat(900_000) }, T(1));
    const a = await anonimo(s);
    const r = await enviar(s, a.cookie, [grande('m1'), grande('m2'), grande('m3')]);
    assert.equal(r.status, 413);
    assert.equal(r.json.erro, 'limite_de_espaco');
    assert.equal(r.json.limite_bytes, 2 * 1024 * 1024);
    const ana = await s.entrar('ana@exemplo.com', 'Casa');
    assert.equal((await enviar(s, ana, [grande('m1'), grande('m2'), grande('m3')])).status, 200);
});

test('a limpeza apaga conta anônima vazia parada há 7 dias, e só ela', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const vazia = await anonimo(s, 'Vazia');
    const com = await anonimo(s, 'Com dados');
    await enviar(s, com.cookie, [item('diario', 'd1', entrada('x'), T(1))]);
    const email = await s.entrar('ana@exemplo.com', 'Casa');
    s.avancar(6 * 24 * 60 * 60 * 1000);
    s.app.auth.limpar();
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n, 3);
    s.avancar(2 * 24 * 60 * 60 * 1000);
    s.app.auth.limpar();
    const restam = s.app.db.prepare('SELECT id, email FROM usuarios ORDER BY id').all().map((u) => u.id);
    assert.ok(!restam.includes(vazia.id));
    assert.ok(restam.includes(com.id));
    assert.equal(restam.length, 2); // a anônima com dados e a do e-mail
    assert.ok(email);
});

test('outra conta anônima na sessão: 3 por dia por aparelho e o mesmo freio por IP', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const a = await anonimo(s);
    const criar = () => s.chamar('POST', '/v1/contas/anonima', { cookie: a.cookie, corpo: {} });
    assert.equal((await criar()).status, 429); // o IP acabou de criar uma
    for (let i = 0; i < 3; i++) {
        s.avancar(31 * 60 * 1000);
        assert.equal((await criar()).status, 201);
    }
    s.avancar(31 * 60 * 1000);
    assert.equal((await criar()).status, 429); // a quarta no dia
});

test('conta encerrada: a chave e o e-mail ficam livres e nenhuma limpeza a alcança', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const a = await anonimo(s);
    await enviar(s, a.cookie, [item('diario', 'd1', entrada('x'), T(1))]);
    await s.chamar('DELETE', '/v1/conta', { cookie: a.cookie, corpo: { confirmo: 'apagar' } });
    const resp = await s.chamar('POST', '/v1/auth/chave', { corpo: { chave: a.chave, aparelho: 'X' } });
    assert.equal(resp.status, 400); // a chave nao abre mais nada
    s.avancar(30 * 24 * 60 * 60 * 1000);
    s.app.auth.limpar();
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM usuarios WHERE desativada_em IS NOT NULL').get().n, 1);
    // o mesmo aparelho pode gerar outra conta do zero
    const b = await anonimo(s);
    assert.notEqual(b.id, a.id);
    assert.equal((await ler(s, b.cookie)).json.itens.length, 0);
});
