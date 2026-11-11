import test from 'node:test';
import assert from 'node:assert/strict';
import { mensagemCodigo, mensagemContaApagada } from '../src/email.js';

test('o e-mail do código tem texto simples e HTML, os dois com o código', () => {
    const m = mensagemCodigo('645527');
    assert.equal(m.assunto, 'Seu código do Aeon: 645527');
    assert.match(m.texto, /é 645527\./);
    assert.match(m.html, /<!doctype html>/);
    assert.match(m.html, /lang="pt-BR"/);
    assert.match(m.html, />645527</);
    assert.match(m.html, /Seu código é 645527\. Vale por 10 minutos\./); // texto de prévia na caixa de entrada
});

test('o HTML não tem link, imagem, script nem formulário (o acesso é só pelo código digitado)', () => {
    for (const m of [mensagemCodigo('123456'), mensagemContaApagada()]) {
        assert.doesNotMatch(m.html, /<a\s|href=|<img|<script|<form|<iframe|https?:\/\//i);
        assert.doesNotMatch(m.texto, /https?:\/\//);
    }
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

test('o aviso de conta apagada tem as duas versões e pede resposta, que agora chega numa caixa lida', () => {
    const m = mensagemContaApagada();
    assert.match(m.assunto, /apagados/);
    assert.match(m.texto, /responda este e-mail/);
    assert.match(m.html, /responda este e-mail/);
});
