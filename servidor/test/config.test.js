import test from 'node:test';
import assert from 'node:assert/strict';
import { lerConfig } from '../src/config.js';
import { abrirBanco } from '../src/db.js';

const base = { NODE_ENV: 'production', SEGREDO: 'x'.repeat(40), SMTP_HOST: 'h', SMTP_USUARIO: 'u', SMTP_SENHA: 's', EMAIL_DE: 'atendimento@aeonfool.com' };

test('configuração mínima de produção vale e usa o padrão https://aeonfool.com', () => {
    const c = lerConfig(base);
    assert.deepEqual(c.origens, ['https://aeonfool.com']);
    assert.equal(c.cookieSeguro, true);
    assert.equal(c.host, '127.0.0.1');
});

test('recusa segredo curto, origem http, origem com caminho, e-mail de console em produção, SMTP incompleto', () => {
    assert.throws(() => lerConfig({ ...base, SEGREDO: 'curto' }), /SEGREDO/);
    assert.throws(() => lerConfig({ ...base, ORIGENS_PERMITIDAS: 'http://aeonfool.com' }), /https/);
    assert.throws(() => lerConfig({ ...base, ORIGENS_PERMITIDAS: 'https://aeonfool.com/' }), /sem barra/);
    assert.throws(() => lerConfig({ ...base, ORIGENS_PERMITIDAS: 'http://localhost:5173' }), /https/);
    assert.throws(() => lerConfig({ ...base, EMAIL_MODO: 'console' }), /produção/);
    assert.throws(() => lerConfig({ ...base, SMTP_SENHA: '' }), /SMTP/);
    assert.throws(() => lerConfig({ ...base, EMAIL_DE: 'ruim' }), /EMAIL_DE/);
});

test('fora de produção aceita localhost e e-mail no console', () => {
    const c = lerConfig({ NODE_ENV: 'development', SEGREDO: 'x'.repeat(40), EMAIL_MODO: 'console', ORIGENS_PERMITIDAS: 'http://localhost:5173' });
    assert.equal(c.cookieSeguro, false);
    assert.deepEqual(c.origens, ['http://localhost:5173']);
});

test('migrações rodam uma vez e o banco fica na versão certa', () => {
    const db = abrirBanco(':memory:');
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 3);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name IN ('usuarios','codigos','sessoes','itens')").get().n, 4);
});
