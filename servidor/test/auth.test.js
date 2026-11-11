import test from 'node:test';
import assert from 'node:assert/strict';
import { subir, ORIGEM } from './ajuda.js';

const MIN = 60 * 1000;

test('pedir código: responde 202, envia e-mail só com o código e sem link', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const r = await s.chamar('POST', '/v1/auth/pedir', { corpo: { email: 'Ana@Exemplo.com ' } });
    await s.app.ocioso();
    assert.equal(r.status, 202);
    assert.equal(s.enviados.length, 1);
    assert.equal(s.enviados[0].para, 'ana@exemplo.com');
    assert.match(s.enviados[0].assunto, /^Seu código do Aeon: \d{6}$/);
    assert.doesNotMatch(s.enviados[0].texto, /https?:\/\//);
});

test('e-mail inválido é recusado e nada é enviado', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    for (const e of ['', 'sem-arroba', 'a@b', 'a b@c.com', '"x"@c.com', 'a@b.com, c@d.com', 'a@b.com\r\nBcc: x@y.com', 12, null]) {
        const r = await s.chamar('POST', '/v1/auth/pedir', { corpo: { email: e } });
        assert.equal(r.status, 400, String(e));
    }
    await s.app.ocioso();
    assert.equal(s.enviados.length, 0);
});

test('reenviar em menos de 30 s dá 429; depois de 30 s gera código novo e o antigo morre', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    await s.chamar('POST', '/v1/auth/pedir', { corpo: { email: 'a@exemplo.com' } });
    const r = await s.chamar('POST', '/v1/auth/pedir', { corpo: { email: 'a@exemplo.com' } });
    assert.equal(r.status, 429);
    assert.ok(Number(r.cabecalhos.get('retry-after')) > 0);
    s.avancar(31 * 1000);
    await s.chamar('POST', '/v1/auth/pedir', { corpo: { email: 'a@exemplo.com' } });
    await s.app.ocioso();
    const [velho, novo] = s.enviados.map((m) => /é (\d{6})\./.exec(m.texto)[1]);
    if (velho !== novo) {
        const r2 = await s.chamar('POST', '/v1/auth/confirmar', { corpo: { email: 'a@exemplo.com', codigo: velho } });
        assert.equal(r2.status, 400);
    }
});

test('limite de pedidos: 5 por hora por e-mail e 20 por hora por IP', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    for (let i = 0; i < 5; i++) {
        const r = await s.chamar('POST', '/v1/auth/pedir', { corpo: { email: 'a@exemplo.com' } });
        assert.equal(r.status, 202, `pedido ${i + 1}`);
        s.avancar(31 * 1000);
    }
    assert.equal((await s.chamar('POST', '/v1/auth/pedir', { corpo: { email: 'a@exemplo.com' } })).status, 429);
    // outro e-mail do mesmo IP: o limite do IP (20) pega
    let ultimo;
    for (let i = 0; i < 20; i++) ultimo = await s.chamar('POST', '/v1/auth/pedir', { corpo: { email: `u${i}@exemplo.com` } });
    assert.equal(ultimo.status, 429);
});

test('confirmar com o código certo cria a sessão em cookie seguro e vale uma vez só', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    await s.chamar('POST', '/v1/auth/pedir', { corpo: { email: 'ana@exemplo.com' } });
    await s.app.ocioso();
    const codigo = /é (\d{6})\./.exec(s.enviados[0].texto)[1];
    const r = await s.chamar('POST', '/v1/auth/confirmar', { corpo: { email: 'ana@exemplo.com', codigo, aparelho: 'iPhone da Ana' } });
    assert.equal(r.status, 200);
    assert.equal(r.json.usuario.email, 'ana@exemplo.com');
    assert.match(r.setCookie, /^__Host-aeon=[A-Za-z0-9_-]{40,}/);
    for (const parte of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=31536000']) assert.ok(r.setCookie.includes(parte), parte);
    assert.ok(!/Domain=/i.test(r.setCookie));
    const de = await s.chamar('POST', '/v1/auth/confirmar', { corpo: { email: 'ana@exemplo.com', codigo } });
    assert.equal(de.status, 400);
    assert.equal(de.json.erro, 'codigo_invalido');
});

test('o token da sessão não fica no banco em texto, e o código também não', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const cookie = await s.entrar();
    const token = cookie.split('=')[1];
    const sess = s.app.db.prepare('SELECT token_hash FROM sessoes').all();
    assert.equal(sess.length, 1);
    assert.notEqual(sess[0].token_hash, token);
    const dump = JSON.stringify(s.app.db.prepare('SELECT * FROM codigos').all());
    assert.doesNotMatch(dump, /\d{6}"/);
});

test('5 erros invalidam o código, mesmo que o certo venha depois', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    await s.chamar('POST', '/v1/auth/pedir', { corpo: { email: 'ana@exemplo.com' } });
    await s.app.ocioso();
    const certo = /é (\d{6})\./.exec(s.enviados[0].texto)[1];
    const errado = certo === '000000' ? '000001' : '000000';
    for (let i = 0; i < 5; i++) {
        const r = await s.chamar('POST', '/v1/auth/confirmar', { corpo: { email: 'ana@exemplo.com', codigo: errado } });
        assert.equal(r.status, 400);
    }
    const r = await s.chamar('POST', '/v1/auth/confirmar', { corpo: { email: 'ana@exemplo.com', codigo: certo } });
    assert.equal(r.status, 400);
});

test('código vence em 10 minutos', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    await s.chamar('POST', '/v1/auth/pedir', { corpo: { email: 'ana@exemplo.com' } });
    await s.app.ocioso();
    const codigo = /é (\d{6})\./.exec(s.enviados[0].texto)[1];
    s.avancar(10 * MIN + 1000);
    const r = await s.chamar('POST', '/v1/auth/confirmar', { corpo: { email: 'ana@exemplo.com', codigo } });
    assert.equal(r.status, 400);
});

test('conta existente ou não, a resposta de erro é idêntica', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    await s.entrar('existe@exemplo.com');
    const a = await s.chamar('POST', '/v1/auth/confirmar', { corpo: { email: 'existe@exemplo.com', codigo: '123456' } });
    const b = await s.chamar('POST', '/v1/auth/confirmar', { corpo: { email: 'nao-existe@exemplo.com', codigo: '123456' } });
    assert.equal(a.status, b.status);
    assert.deepEqual(a.json, b.json);
    const c = await s.chamar('POST', '/v1/auth/pedir', { corpo: { email: 'existe@exemplo.com' } });
    s.avancar(31 * 1000);
    const d = await s.chamar('POST', '/v1/auth/pedir', { corpo: { email: 'nao-existe@exemplo.com' } });
    assert.equal(c.status, d.status);
    assert.deepEqual(c.json, d.json);
});

test('limite de confirmações por IP: 10 a cada 15 minutos', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    let r;
    for (let i = 0; i < 11; i++) r = await s.chamar('POST', '/v1/auth/confirmar', { corpo: { email: `u${i}@exemplo.com`, codigo: '111111' } });
    assert.equal(r.status, 429);
});

test('sem cookie, rotas protegidas dão 401; cookie inventado também', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    assert.equal((await s.chamar('GET', '/v1/eu')).status, 401);
    assert.equal((await s.chamar('GET', '/v1/eu', { cookie: '__Host-aeon=' + 'a'.repeat(43) })).status, 401);
    assert.equal((await s.chamar('GET', '/v1/sync')).status, 401);
});

test('sessão: /eu, lista de aparelhos, sair e sair de todos', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const c1 = await s.entrar('ana@exemplo.com', 'Celular');
    s.avancar(31 * 1000);
    const c2 = await s.entrar('ana@exemplo.com', 'Notebook');
    const eu = await s.chamar('GET', '/v1/eu', { cookie: c1 });
    assert.equal(eu.json.email, 'ana@exemplo.com');
    const lista = await s.chamar('GET', '/v1/aparelhos', { cookie: c1 });
    assert.equal(lista.json.aparelhos.length, 2);
    assert.deepEqual(lista.json.aparelhos.map((a) => a.aparelho).sort(), ['Celular', 'Notebook']);
    assert.equal(lista.json.aparelhos.filter((a) => a.atual).length, 1);
    assert.equal(lista.json.aparelhos.find((a) => a.atual).aparelho, 'Celular');
    const outro = lista.json.aparelhos.find((a) => !a.atual);
    assert.equal((await s.chamar('DELETE', `/v1/aparelhos/${outro.id}`, { cookie: c1 })).status, 200);
    assert.equal((await s.chamar('GET', '/v1/eu', { cookie: c2 })).status, 401);
    assert.equal((await s.chamar('POST', '/v1/auth/sair', { cookie: c1, corpo: {} })).status, 200);
    assert.equal((await s.chamar('GET', '/v1/eu', { cookie: c1 })).status, 401);
    const c3 = await s.entrar('ana@exemplo.com', 'Tablet');
    s.avancar(31 * 1000);
    const c4 = await s.entrar('ana@exemplo.com', 'Outro');
    const todos = await s.chamar('POST', '/v1/auth/sair-todos', { cookie: c3, corpo: {} });
    assert.equal(todos.status, 200);
    assert.equal((await s.chamar('GET', '/v1/eu', { cookie: c4 })).status, 401);
});

test('um usuário não encerra o aparelho de outro', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const ana = await s.entrar('ana@exemplo.com');
    const bia = await s.entrar('bia@exemplo.com');
    const idDaAna = (await s.chamar('GET', '/v1/aparelhos', { cookie: ana })).json.aparelhos[0].id;
    assert.equal((await s.chamar('DELETE', `/v1/aparelhos/${idDaAna}`, { cookie: bia })).status, 404);
    assert.equal((await s.chamar('GET', '/v1/eu', { cookie: ana })).status, 200);
});

test('a sessão renova o prazo com o uso e expira depois de 1 ano parada', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const cookie = await s.entrar();
    s.avancar(200 * 24 * 60 * MIN);
    const r = await s.chamar('GET', '/v1/eu', { cookie });
    assert.equal(r.status, 200);
    assert.match(r.setCookie, /Max-Age=31536000/); // cookie renovado junto
    s.avancar(200 * 24 * 60 * MIN); // 400 dias desde o login, 200 desde o último uso
    assert.equal((await s.chamar('GET', '/v1/eu', { cookie })).status, 200);
    s.avancar(366 * 24 * 60 * MIN);
    assert.equal((await s.chamar('GET', '/v1/eu', { cookie })).status, 401);
});

test('origem: preflight só para o app, e pedido que muda dados exige Origin permitido', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const ok = await s.chamar('OPTIONS', '/v1/sync', { origem: ORIGEM });
    assert.equal(ok.status, 204);
    assert.equal(ok.cabecalhos.get('access-control-allow-origin'), ORIGEM);
    assert.equal(ok.cabecalhos.get('access-control-allow-credentials'), 'true');
    assert.equal((await s.chamar('OPTIONS', '/v1/sync', { origem: 'https://malvado.com' })).status, 403);
    const corpo = { email: 'ana@exemplo.com' };
    assert.equal((await s.chamar('POST', '/v1/auth/pedir', { corpo, origem: 'https://malvado.com' })).status, 403);
    assert.equal((await s.chamar('POST', '/v1/auth/pedir', { corpo, semOrigem: true })).status, 403);
    assert.equal((await s.chamar('POST', '/v1/auth/pedir', { corpo, origem: 'http://aeonfool.com' })).status, 403);
    assert.equal((await s.chamar('POST', '/v1/auth/pedir', { corpo, origem: 'https://aeonfool.com.malvado.com' })).status, 403);
    const cookie = await s.entrar('bia@exemplo.com');
    const lido = await s.chamar('GET', '/v1/eu', { cookie, origem: 'https://malvado.com' });
    assert.equal(lido.status, 403);
    assert.equal(lido.cabecalhos.get('access-control-allow-origin'), null);
    assert.equal((await s.chamar('GET', '/v1/saude', { semOrigem: true })).status, 200);
});

test('cabeçalhos de segurança e nada de cache', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const r = await s.chamar('GET', '/v1/saude');
    assert.equal(r.cabecalhos.get('cache-control'), 'no-store');
    assert.equal(r.cabecalhos.get('x-content-type-options'), 'nosniff');
    assert.match(r.cabecalhos.get('strict-transport-security'), /max-age=31536000/);
    assert.match(r.cabecalhos.get('content-security-policy'), /default-src 'none'/);
});

test('corpo: tipo errado, JSON quebrado e corpo grande demais', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const f = (corpo, tipo) => fetch(s.base + '/v1/auth/pedir', { method: 'POST', headers: { Origin: ORIGEM, 'Content-Type': tipo }, body: corpo });
    assert.equal((await f('{"email":"a@b.com"}', 'text/plain')).status, 415);
    assert.equal((await f('{quebrado', 'application/json')).status, 400);
    assert.equal((await f('[1,2]', 'application/json')).status, 400);
    assert.equal((await f(JSON.stringify({ email: 'a@b.com', lixo: 'x'.repeat(20000) }), 'application/json')).status, 413);
});

test('rota inexistente 404, método errado 405', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    assert.equal((await s.chamar('GET', '/v1/nada')).status, 404);
    assert.equal((await s.chamar('GET', '/v1/auth/pedir')).status, 405);
});

test('os logs não têm e-mail, código, cookie nem dados', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const cookie = await s.entrar('ana@exemplo.com');
    await s.chamar('POST', '/v1/sync', { cookie, corpo: { desde: 0, itens: [{ tipo: 'perfil', id: 'perfil', dados: { nome: 'SEGREDO-DE-NASCIMENTO' }, atualizado_em: '2026-11-12T11:00:00Z' }] } });
    const texto = JSON.stringify(s.logs);
    assert.ok(s.logs.length >= 3);
    assert.doesNotMatch(texto, /ana@exemplo|SEGREDO-DE-NASCIMENTO|127\.0\.0\.1/);
    assert.doesNotMatch(texto, new RegExp(cookie.split('=')[1]));
    assert.doesNotMatch(texto, /\d{6}/);
});
