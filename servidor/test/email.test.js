import test from 'node:test';
import assert from 'node:assert/strict';
import { mensagemCodigo, mensagemContaEncerrada } from '../src/email.js';

test('o e-mail do código tem texto simples e HTML, os dois com o código', () => {
    const m = mensagemCodigo('645527');
    assert.equal(m.assunto, 'Seu código do Aeon: 645527');
    assert.match(m.texto, /é 645527\./);
    assert.match(m.html, /<!doctype html>/);
    assert.match(m.html, /lang="pt-BR"/);
    assert.match(m.html, />645527</);
    assert.match(m.html, /Seu código é 645527\. Vale por 10 minutos\./); // texto de prévia na caixa de entrada
});

test('o HTML não tem link, script nem formulário (o acesso é só pelo código digitado)', () => {
    for (const m of [mensagemCodigo('123456'), mensagemContaEncerrada()]) {
        assert.doesNotMatch(m.html, /<a\s|href=|<script|<form|<iframe/i);
        assert.doesNotMatch(m.texto, /https?:\/\//);
    }
});

test('as únicas imagens são o topo e a carta, do próprio site, com endereço igual para todos (sem rastreio)', () => {
    for (const m of [mensagemCodigo('123456'), mensagemContaEncerrada()]) {
        const srcs = [...m.html.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)].map((x) => x[1]);
        assert.deepEqual(srcs, ['https://aeonfool.com/email/aeon-topo.png', 'https://aeonfool.com/email/aeon-carta.png']);
        assert.doesNotMatch(m.html, /src="[^"]*[?#]/);
    }
    // sem imagens (bloqueadas pelo leitor), o topo vira o texto "AEON" e a carta decorativa some sem deixar texto
    const { html } = mensagemCodigo('123456');
    assert.match(html, /alt="AEON"/);
    assert.match(html, /aeon-carta\.png"[^>]*alt=""/);
});

test('o HTML usa só estilos inline e as cores do app (tema Crepúsculo)', () => {
    const { html } = mensagemCodigo('123456');
    assert.doesNotMatch(html, /<style/i);
    for (const cor of ['#14101c', '#1e1828', '#f1e9e0', '#e8b7a0']) assert.ok(html.includes(cor), cor);
});

test('qualquer valor entra escapado no HTML', () => {
    const { html } = mensagemCodigo('<b>&"\'');
    assert.doesNotMatch(html, /<b>/);
    assert.match(html, /&lt;b&gt;&amp;&quot;&#39;/);
});

test('o aviso de conta encerrada tem as duas versões e pede resposta, que agora chega numa caixa lida', () => {
    const m = mensagemContaEncerrada();
    assert.match(m.assunto, /encerrada/);
    assert.match(m.texto, /responda este e-mail/);
    assert.match(m.html, /responda este e-mail/);
});
