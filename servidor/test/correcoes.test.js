import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { subir, item, ORIGEM } from './ajuda.js';
import { chaveIp, baseDoEmail } from '../src/ip.js';

const MIN = 60 * 1000;
const HORA = 60 * MIN;
const T = (min) => new Date(Date.parse('2026-11-12T10:00:00Z') + min * MIN).toISOString();
const codigoDoEmail = (s, i = s.enviados.length - 1) => /é (\d{6})\./.exec(s.enviados[i].texto)[1];
const errado = (c) => (c === '000000' ? '000001' : '000000');

test('URL malformada não derruba o processo (GET //[ por socket cru)', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const porta = new URL(s.base).port;
    const resposta = await new Promise((ok, falha) => {
        const c = net.connect(Number(porta), '127.0.0.1', () => c.write('GET //[ HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'));
        let dado = '';
        c.on('data', (d) => (dado += d));
        c.on('close', () => ok(dado));
        c.on('error', falha);
    });
    assert.match(resposta, /^HTTP\/1\.1 400/);
    assert.equal((await s.chamar('GET', '/v1/saude')).status, 200); // continua no ar
});

test('% malformado em /aparelhos/:id dá 404, não 500', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const c = await s.entrar();
    assert.equal((await s.chamar('DELETE', '/v1/aparelhos/%', { cookie: c, corpo: {} })).status, 404);
});

test('pedir de novo dentro da validade reenvia o MESMO código e não devolve as tentativas', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    await s.chamar('POST', '/v1/auth/pedir', { corpo: { email: 'ana@exemplo.com' } });
    await s.app.ocioso();
    const c1 = codigoDoEmail(s);
    for (let i = 0; i < 3; i++) await s.chamar('POST', '/v1/auth/confirmar', { corpo: { email: 'ana@exemplo.com', codigo: errado(c1) } });
    s.avancar(31 * 1000);
    await s.chamar('POST', '/v1/auth/pedir', { corpo: { email: 'ana@exemplo.com' } });
    await s.app.ocioso();
    assert.equal(codigoDoEmail(s), c1);
    for (let i = 0; i < 2; i++) await s.chamar('POST', '/v1/auth/confirmar', { corpo: { email: 'ana@exemplo.com', codigo: errado(c1) } });
    // 3 + 2 = 5 erros no total: o código morreu mesmo com o pedido no meio
    const r = await s.chamar('POST', '/v1/auth/confirmar', { corpo: { email: 'ana@exemplo.com', codigo: c1 } });
    assert.equal(r.status, 400);
});

test('5 erros bloqueiam o e-mail por 6 horas: sem código novo e sem aceitar o certo; depois volta', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    await s.chamar('POST', '/v1/auth/pedir', { corpo: { email: 'ana@exemplo.com' } });
    await s.app.ocioso();
    const c1 = codigoDoEmail(s);
    for (let i = 0; i < 5; i++) await s.chamar('POST', '/v1/auth/confirmar', { corpo: { email: 'ana@exemplo.com', codigo: errado(c1) } });
    s.avancar(31 * 1000);
    const pedido = await s.chamar('POST', '/v1/auth/pedir', { corpo: { email: 'ana@exemplo.com' } });
    assert.equal(pedido.status, 429);
    assert.ok(Number(pedido.cabecalhos.get('retry-after')) > 5 * 3600);
    assert.equal((await s.chamar('POST', '/v1/auth/confirmar', { corpo: { email: 'ana@exemplo.com', codigo: c1 } })).status, 400);
    s.avancar(6 * HORA + 1000);
    s.app.limpar();
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM bloqueios').get().n, 0);
    const livre = await s.chamar('POST', '/v1/auth/pedir', { corpo: { email: 'ana@exemplo.com' } });
    assert.equal(livre.status, 202);
    await s.app.ocioso();
    const ok = await s.chamar('POST', '/v1/auth/confirmar', { corpo: { email: 'ana@exemplo.com', codigo: codigoDoEmail(s) } });
    assert.equal(ok.status, 200);
});

test('o código não fica no banco, só a semente', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    await s.chamar('POST', '/v1/auth/pedir', { corpo: { email: 'ana@exemplo.com' } });
    await s.app.ocioso();
    const c = codigoDoEmail(s);
    const linha = JSON.stringify(s.app.db.prepare('SELECT * FROM codigos').get());
    assert.ok(!linha.includes(`"${c}"`));
    assert.match(linha, /semente/);
});

test('o limite por e-mail ignora +etiqueta e a chave de IP agrupa o /64 do IPv6', () => {
    assert.equal(baseDoEmail('v+1@gmail.com'), 'v@gmail.com');
    assert.equal(baseDoEmail('v+x+y@gmail.com'), 'v@gmail.com');
    assert.equal(baseDoEmail('v@gmail.com'), 'v@gmail.com');
    assert.equal(chaveIp('2001:db8:1:2:aaaa:bbbb:cccc:dddd'), chaveIp('2001:db8:1:2:1::9'));
    assert.notEqual(chaveIp('2001:db8:1:2::1'), chaveIp('2001:db8:1:3::1'));
    assert.equal(chaveIp('::ffff:203.0.113.7'), '203.0.113.7');
    assert.equal(chaveIp('203.0.113.7'), '203.0.113.7');
    assert.equal(chaveIp('2001:db8::1'), chaveIp('2001:0db8:0:0:5::1'));
});

test('aliases +etiqueta do mesmo e-mail compartilham o limite de 15 por hora', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    let status;
    for (let i = 0; i < 6; i++) {
        status = (await s.chamar('POST', '/v1/auth/pedir', { corpo: { email: `v+${i}@exemplo.com` } })).status;
    }
    assert.equal(status, 429); // 6º pedido da mesma caixa pelo mesmo IP (limite IP+caixa = 5)
});

test('a sessão mais antiga sai quando a conta passa de 20 aparelhos', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const primeira = await s.entrar('ana@exemplo.com', 'Primeiro');
    for (let i = 0; i < 20; i++) {
        s.avancar(31 * 1000);
        await s.entrar('ana@exemplo.com', `Aparelho ${i}`);
        s.avancar(HORA); // evita estourar o limite de pedidos por hora
    }
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM sessoes').get().n, 20);
    assert.equal((await s.chamar('GET', '/v1/eu', { cookie: primeira })).status, 401);
});

test('marcas de exclusão e itens vazios também contam: teto de 5000 linhas por usuário', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const c = await s.entrar();
    let r;
    for (let lote = 0; lote < 25; lote++) {
        r = await s.chamar('POST', '/v1/sync', { cookie: c, corpo: { desde: 0, itens: Array.from({ length: 200 }, (_, i) => item('mapa', `m${lote}-${i}`, null, T(1), true)) } });
        assert.equal(r.status, 200, `lote ${lote}`);
    }
    s.avancar(61 * 1000);
    r = await s.chamar('POST', '/v1/sync', { cookie: c, corpo: { desde: 0, itens: [item('mapa', 'a-mais', {}, T(2))] } });
    assert.equal(r.status, 413);
    assert.equal(r.json.erro, 'limite_de_itens');
    assert.equal(s.app.db.prepare('SELECT COUNT(*) AS n FROM itens').get().n, 5000);
});

test('/sync tem limite por usuário: 60 pedidos por minuto', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const c = await s.entrar();
    let r;
    for (let i = 0; i < 61; i++) r = await s.chamar('GET', '/v1/sync?desde=0', { cookie: c });
    assert.equal(r.status, 429);
    s.avancar(61 * 1000);
    assert.equal((await s.chamar('GET', '/v1/sync?desde=0', { cookie: c })).status, 200);
    for (let i = 0; i < 10; i++) await s.chamar('GET', '/v1/exportar', { cookie: c });
    assert.equal((await s.chamar('GET', '/v1/exportar', { cookie: c })).status, 429);
});

test('a limpeza apaga marcas de exclusão com mais de 1 ano e mantém as recentes', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const c = await s.entrar();
    const velha = new Date(s.agora() - 10 * 60 * 1000).toISOString();
    await s.chamar('POST', '/v1/sync', { cookie: c, corpo: { desde: 0, itens: [item('mapa', 'velha', null, velha, true), item('mapa', 'viva', { x: 1 }, velha)] } });
    s.avancar(366 * 24 * HORA);
    s.app.limpar();
    const restam = s.app.db.prepare('SELECT id FROM itens ORDER BY id').all().map((r) => r.id);
    assert.deepEqual(restam, ['viva']);
});

test('data no futuro tem tolerância de só 30 s', async (t) => {
    const s = await subir();
    t.after(() => s.fechar());
    const c = await s.entrar();
    const em2min = new Date(s.agora() + 2 * MIN).toISOString();
    await s.chamar('POST', '/v1/sync', { cookie: c, corpo: { desde: 0, itens: [item('diario', 'd1', {}, em2min)] } });
    assert.equal(s.app.db.prepare("SELECT atualizado_em FROM itens WHERE id = 'd1'").get().atualizado_em, new Date(s.agora()).toISOString());
});

test('erro de envio de e-mail vai para o log só com o código do erro, sem o endereço', async (t) => {
    const falha = Object.assign(new Error('550 5.1.1 <fulano@exemplo.com>: Recipient address rejected'), { code: 'EENVELOPE', responseCode: 550 });
    const s = await subir({ falhaEmail: falha });
    t.after(() => s.fechar());
    await s.chamar('POST', '/v1/auth/pedir', { corpo: { email: 'fulano@exemplo.com' } });
    await s.app.ocioso();
    const txt = JSON.stringify(s.logs);
    assert.match(txt, /email_falhou/);
    assert.match(txt, /EENVELOPE/);
    assert.doesNotMatch(txt, /fulano@exemplo|Recipient/);
});
