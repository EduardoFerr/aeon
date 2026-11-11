import test from 'node:test';
import assert from 'node:assert/strict';
import { subir, item } from './ajuda.js';

const T = (min) => new Date(Date.parse('2026-11-12T10:00:00Z') + min * 60000).toISOString();
const entrada = (nota = '') => ({ id: 'x', t: T(0), tipo: 'leitura', cartas: [{ order: 1, pos: 'passado' }], nota });
const enviar = (s, cookie, itens, desde = 0) => s.chamar('POST', '/v1/sync', { cookie, corpo: { desde, itens } });

async function dois(t) {
    const s = await subir();
    t.after(() => s.fechar());
    const a = await s.entrar('ana@exemplo.com', 'Celular');
    s.avancar(31 * 1000);
    const b = await s.entrar('ana@exemplo.com', 'Notebook');
    return { s, a, b };
}

test('um aparelho envia e o outro recebe tudo, com o conteúdo legível no banco', async (t) => {
    const { s, a, b } = await dois(t);
    const r = await enviar(s, a, [
        item('perfil', 'perfil', { nome: 'Ana' }, T(1)),
        item('diario', 'leitura-1', entrada('nota boa'), T(2)),
        item('mapa', 'm1', { nascimento: { data: '1990-05-01', hora: '08:30', local: 'São Paulo' } }, T(3)),
    ]);
    assert.equal(r.status, 200);
    assert.equal(r.json.aplicados, 3);
    assert.equal(r.json.itens.length, 0); // o que o próprio aparelho mandou não volta
    const l = await s.chamar('GET', '/v1/sync?desde=0', { cookie: b });
    assert.equal(l.json.itens.length, 3);
    assert.deepEqual(l.json.itens.map((i) => i.seq), [1, 2, 3]);
    assert.equal(l.json.itens.find((i) => i.tipo === 'mapa').dados.nascimento.local, 'São Paulo');
    const cru = s.app.db.prepare("SELECT dados FROM itens WHERE tipo = 'mapa'").get().dados;
    assert.match(cru, /São Paulo/); // texto legível, como decidido
});

test('só o que é novo chega: o cursor funciona', async (t) => {
    const { s, a, b } = await dois(t);
    const r1 = await enviar(s, a, [item('diario', 'd1', entrada(), T(1))]);
    const r2 = await enviar(s, a, [item('diario', 'd2', entrada(), T(2))], r1.json.seq);
    assert.equal(r2.json.seq, 2);
    const l = await s.chamar('GET', `/v1/sync?desde=${r1.json.seq}`, { cookie: b });
    assert.deepEqual(l.json.itens.map((i) => i.id), ['d2']);
    const vazio = await s.chamar('GET', '/v1/sync?desde=2', { cookie: b });
    assert.equal(vazio.json.itens.length, 0);
});

test('conflito: vale a edição mais recente; empate e mais antiga não mudam nada', async (t) => {
    const { s, a, b } = await dois(t);
    await enviar(s, a, [item('diario', 'd1', entrada('v1'), T(10))]);
    const antiga = await enviar(s, b, [item('diario', 'd1', entrada('antiga'), T(5))]);
    assert.equal(antiga.json.aplicados, 0);
    assert.equal(antiga.json.itens[0].dados.nota, 'v1'); // o aparelho recebe a versão que ganhou
    const empate = await enviar(s, b, [item('diario', 'd1', entrada('empate'), T(10))]);
    assert.equal(empate.json.aplicados, 0);
    assert.equal(empate.json.itens[0].dados.nota, 'v1');
    const nova = await enviar(s, b, [item('diario', 'd1', entrada('v2'), T(20))]);
    assert.equal(nova.json.aplicados, 1);
    const l = await s.chamar('GET', '/v1/sync?desde=0', { cookie: a });
    assert.equal(l.json.itens[0].dados.nota, 'v2');
});

test('apagar: a marca chega ao outro aparelho, sem conteúdo; edição mais nova traz de volta', async (t) => {
    const { s, a, b } = await dois(t);
    await enviar(s, a, [item('diario', 'd1', entrada('segredo'), T(1))]);
    await enviar(s, a, [item('diario', 'd1', null, T(5), true)]);
    const l = await s.chamar('GET', '/v1/sync?desde=0', { cookie: b });
    assert.equal(l.json.itens.length, 1);
    assert.equal(l.json.itens[0].apagado, true);
    assert.equal(l.json.itens[0].dados, null);
    const linha = s.app.db.prepare("SELECT dados, apagado FROM itens WHERE id = 'd1'").get();
    assert.equal(linha.dados, '');
    assert.equal(linha.apagado, 1);
    const velha = await enviar(s, b, [item('diario', 'd1', entrada('velha'), T(3))]);
    assert.equal(velha.json.aplicados, 0);
    assert.equal(velha.json.itens[0].apagado, true);
    const volta = await enviar(s, b, [item('diario', 'd1', entrada('voltou'), T(9))]);
    assert.equal(volta.json.aplicados, 1);
    const ex = await s.chamar('GET', '/v1/exportar', { cookie: a });
    assert.equal(ex.json.itens[0].dados.nota, 'voltou');
});

test('apagar um item que o servidor nunca viu também deixa a marca', async (t) => {
    const { s, a } = await dois(t);
    const r = await enviar(s, a, [item('mapa', 'm9', null, T(1), true)]);
    assert.equal(r.json.aplicados, 1);
});

test('relógio no futuro é limitado ao horário do servidor', async (t) => {
    const { s, a } = await dois(t);
    await enviar(s, a, [item('diario', 'd1', entrada('futuro'), '2099-01-01T00:00:00Z')]);
    const guardado = s.app.db.prepare("SELECT atualizado_em FROM itens WHERE id = 'd1'").get().atualizado_em;
    assert.equal(guardado, new Date(s.agora()).toISOString());
    // uma edição de verdade, feita depois, ainda vence
    s.avancar(60 * 1000);
    const r = await enviar(s, a, [item('diario', 'd1', entrada('agora'), new Date(s.agora()).toISOString())]);
    assert.equal(r.json.aplicados, 1);
});

test('itens inválidos recusam o pedido inteiro e não gravam nada', async (t) => {
    const { s, a } = await dois(t);
    const ruins = [
        item('outro', 'x', {}, T(1)),
        item('diario', 'id com espaço', {}, T(1)),
        item('diario', '../x', {}, T(1)),
        item('perfil', 'outro-id', {}, T(1)),
        item('diario', 'x', [], T(1)),
        item('diario', 'x', 'texto', T(1)),
        item('diario', 'x', null, T(1)),
        item('diario', 'x', {}, 'ontem'),
        item('diario', 'x', {}, '1999-01-01T00:00:00Z'),
        { tipo: 'diario', id: 'x', dados: {} },
        'string',
        null,
        { ...item('diario', 'x', {}, T(1)), apagado: 'sim' },
    ];
    for (const ruim of ruins) {
        const r = await enviar(s, a, [item('diario', 'bom', entrada(), T(1)), ruim]);
        assert.equal(r.status, 400, JSON.stringify(ruim));
        assert.equal(r.json.erro, 'item_invalido');
        assert.equal(r.json.posicao, 1);
    }
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM itens').get().n, 0);
    assert.equal((await enviar(s, a, 'nao-e-lista')).status, 400);
    assert.equal((await s.chamar('POST', '/v1/sync', { cookie: a, corpo: { desde: -1, itens: [] } })).status, 400);
    assert.equal((await s.chamar('GET', '/v1/sync?desde=abc', { cookie: a })).status, 400);
});

test('limites: item de 1 MB, 200 itens por pedido, 500 entradas de diário', async (t) => {
    const { s, a } = await dois(t);
    const grande = await enviar(s, a, [item('mapa', 'g', { lixo: 'x'.repeat(1024 * 1024) }, T(1))]);
    assert.equal(grande.status, 413);
    assert.equal(grande.json.erro, 'item_grande_demais');
    const muitos = await enviar(s, a, Array.from({ length: 201 }, (_, i) => item('diario', `d${i}`, entrada(), T(1))));
    assert.equal(muitos.status, 413);
    assert.equal(muitos.json.erro, 'itens_demais');
    for (let lote = 0; lote < 3; lote++) {
        const qtd = lote === 2 ? 100 : 200;
        const r = await enviar(s, a, Array.from({ length: qtd }, (_, i) => item('diario', `d${lote}-${i}`, entrada(), T(1))));
        assert.equal(r.status, 200, `lote ${lote}`);
    }
    const passou = await enviar(s, a, [item('diario', 'um-a-mais', entrada(), T(2))]);
    assert.equal(passou.status, 413);
    assert.equal(passou.json.erro, 'limite_do_diario');
    assert.equal(s.app.db.prepare("SELECT COUNT(*) AS n FROM itens WHERE tipo = 'diario'").get().n, 500);
});

test('limite de espaço por usuário (5 MB) desfaz o pedido', async (t) => {
    const { s, a } = await dois(t);
    const pedaco = (n) => ({ lixo: 'y'.repeat(900 * 1024), n });
    for (let i = 0; i < 5; i++) assert.equal((await enviar(s, a, [item('mapa', `m${i}`, pedaco(i), T(1))])).status, 200);
    const r = await enviar(s, a, [item('mapa', 'm5', pedaco(5), T(1)), item('mapa', 'm6', pedaco(6), T(1))]);
    assert.equal(r.status, 413);
    assert.equal(r.json.erro, 'limite_de_espaco');
    assert.equal(s.app.db.prepare("SELECT COUNT(*) AS n FROM itens WHERE tipo = 'mapa'").get().n, 5);
    assert.equal(s.app.db.prepare('SELECT seq FROM usuarios').get().seq, 5);
});

test('isolamento: cada usuário só vê os próprios itens, mesmo com o mesmo id', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const ana = await s.entrar('ana@exemplo.com');
    const bia = await s.entrar('bia@exemplo.com');
    await enviar(s, ana, [item('diario', 'mesmo-id', entrada('da Ana'), T(1))]);
    await enviar(s, bia, [item('diario', 'mesmo-id', entrada('da Bia'), T(1))]);
    const la = await s.chamar('GET', '/v1/sync?desde=0', { cookie: ana });
    const lb = await s.chamar('GET', '/v1/sync?desde=0', { cookie: bia });
    assert.equal(la.json.itens.length, 1);
    assert.equal(la.json.itens[0].dados.nota, 'da Ana');
    assert.equal(lb.json.itens[0].dados.nota, 'da Bia');
    assert.equal((await s.chamar('GET', '/v1/exportar', { cookie: bia })).json.itens.length, 1);
});

test('paginação: mais = true e o cursor continua de onde parou', async (t) => {
    const { s, a, b } = await dois(t);
    for (let lote = 0; lote < 3; lote++) {
        await enviar(s, a, Array.from({ length: 200 }, (_, i) => item('mapa', `m${lote}-${i}`, { n: i }, T(1))));
    }
    const p1 = await s.chamar('GET', '/v1/sync?desde=0', { cookie: b });
    assert.equal(p1.json.itens.length, 500);
    assert.equal(p1.json.mais, true);
    const p2 = await s.chamar('GET', `/v1/sync?desde=${p1.json.proximo}`, { cookie: b });
    assert.equal(p2.json.itens.length, 100);
    assert.equal(p2.json.mais, false);
    assert.equal(p2.json.proximo, 600);
});

test('cursor maior que o do servidor (conta refeita) reinicia do zero e avisa', async (t) => {
    const { s, a } = await dois(t);
    await enviar(s, a, [item('diario', 'd1', entrada(), T(1))]);
    const l = await s.chamar('GET', '/v1/sync?desde=999', { cookie: a });
    assert.equal(l.json.reinicio, true);
    assert.equal(l.json.itens.length, 1);
});

test('exportar devolve tudo em JSON legível e baixa como arquivo', async (t) => {
    const { s, a } = await dois(t);
    await enviar(s, a, [item('perfil', 'perfil', { nome: 'Ana' }, T(1)), item('diario', 'd1', entrada('oi'), T(2)), item('diario', 'd2', null, T(3), true)]);
    const r = await s.chamar('GET', '/v1/exportar', { cookie: a });
    assert.equal(r.status, 200);
    assert.match(r.cabecalhos.get('content-disposition'), /attachment/);
    assert.equal(r.json.usuario.email, 'ana@exemplo.com');
    assert.equal(r.json.itens.length, 2);
});

test('encerrar a conta: confirmação obrigatória, sai de todos os aparelhos, libera o e-mail e avisa', async (t) => {
    const { s, a, b } = await dois(t);
    await enviar(s, a, [item('perfil', 'perfil', { nome: 'Ana' }, T(1)), item('mapa', 'm1', { nascimento: { local: 'X' } }, T(2))]);
    assert.equal((await s.chamar('DELETE', '/v1/conta', { cookie: a, corpo: {} })).status, 400);
    assert.equal((await s.chamar('DELETE', '/v1/conta', { cookie: a, corpo: { confirmo: 'sim' } })).status, 400);
    const antes = s.enviados.length;
    const r = await s.chamar('DELETE', '/v1/conta', { cookie: a, corpo: { confirmo: 'apagar' } });
    assert.equal(r.status, 200);
    assert.match(r.setCookie, /Max-Age=0/);
    await s.app.ocioso();
    assert.equal(s.enviados.length, antes + 1);
    assert.match(s.enviados[s.enviados.length - 1].assunto, /encerrada/);
    for (const tabela of ['sessoes', 'sessao_contas', 'codigos']) {
        assert.equal(s.app.db.prepare(`SELECT COUNT(*) AS n FROM ${tabela}`).get().n, 0, tabela);
    }
    // a conta sai de circulacao: sem e-mail e sem chave (livres), marcada como encerrada, e nada a alcança mais
    const u = s.app.db.prepare('SELECT email, chave_hash, desativada_em FROM usuarios').get();
    assert.equal(u.email, null);
    assert.equal(u.chave_hash, null);
    assert.ok(u.desativada_em);
    s.app.auth.limpar(); // a limpeza nunca a trata como conta anonima abandonada
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n, 1);
    assert.equal((await s.chamar('GET', '/v1/eu', { cookie: a })).status, 401);
    assert.equal((await s.chamar('GET', '/v1/eu', { cookie: b })).status, 401);
    // pode criar a conta de novo, do zero
    s.avancar(31 * 1000);
    const c = await s.entrar('ana@exemplo.com');
    assert.equal((await s.chamar('GET', '/v1/sync?desde=0', { cookie: c })).json.itens.length, 0);
});

test('apagar a conta de um usuário não toca nos dados de outro', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const ana = await s.entrar('ana@exemplo.com');
    const bia = await s.entrar('bia@exemplo.com');
    await enviar(s, bia, [item('diario', 'd1', entrada('da Bia'), T(1))]);
    await s.chamar('DELETE', '/v1/conta', { cookie: ana, corpo: { confirmo: 'apagar' } });
    assert.equal((await s.chamar('GET', '/v1/sync?desde=0', { cookie: bia })).json.itens.length, 1);
});
