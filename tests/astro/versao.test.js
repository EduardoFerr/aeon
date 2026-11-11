import test from 'node:test';
import assert from 'node:assert/strict';
import {
    MS_DIA, lerData, temRegistros, precisaAvisoBackup, compararVersao, haVersaoNova, formatarBuild, rotuloVersao,
} from '../../src/utils/versao.js';

const AGORA = Date.parse('2026-11-11T15:00:00.000Z');
const antes = (dias) => new Date(AGORA - dias * MS_DIA).toISOString();
const base = { entradas: 5, mapas: 0, agora: AGORA };

/* ---------- regra do aviso de backup ---------- */

test('sem registros suficientes nao ha aviso (4 entradas e nenhum mapa)', () => {
    assert.equal(precisaAvisoBackup({ ...base, entradas: 4 }), false);
    assert.equal(precisaAvisoBackup({ ...base, entradas: 0 }), false);
});

test('5 entradas ou 1 mapa bastam, e nunca ter feito backup avisa', () => {
    assert.equal(precisaAvisoBackup({ ...base, entradas: 5 }), true);
    assert.equal(precisaAvisoBackup({ ...base, entradas: 0, mapas: 1 }), true);
    assert.equal(temRegistros({ entradas: 4, mapas: 0 }), false);
    assert.equal(temRegistros({ entradas: 4, mapas: 1 }), true);
});

test('backup de ate 30 dias esconde o aviso; com mais de 30 dias ele volta', () => {
    assert.equal(precisaAvisoBackup({ ...base, ultimoBackup: antes(1) }), false);
    assert.equal(precisaAvisoBackup({ ...base, ultimoBackup: antes(30) }), false);
    assert.equal(precisaAvisoBackup({ ...base, ultimoBackup: antes(30.01) }), true);
    assert.equal(precisaAvisoBackup({ ...base, ultimoBackup: antes(200) }), true);
});

test('dispensar esconde por 14 dias, depois o aviso volta', () => {
    const velho = antes(90);
    assert.equal(precisaAvisoBackup({ ...base, ultimoBackup: velho, dispensadoEm: antes(0) }), false);
    assert.equal(precisaAvisoBackup({ ...base, ultimoBackup: velho, dispensadoEm: antes(13.9) }), false);
    assert.equal(precisaAvisoBackup({ ...base, ultimoBackup: velho, dispensadoEm: antes(14) }), true);
    assert.equal(precisaAvisoBackup({ ...base, ultimoBackup: velho, dispensadoEm: antes(40) }), true);
});

test('dispensar nao vale se a pessoa ja fez backup recente (nada a mostrar de qualquer jeito)', () => {
    assert.equal(precisaAvisoBackup({ ...base, ultimoBackup: antes(2), dispensadoEm: antes(40) }), false);
});

test('data ilegivel ou no futuro (relogio errado) nao apaga o aviso para sempre', () => {
    assert.equal(lerData('lixo', AGORA), null);
    assert.equal(lerData(null, AGORA), null);
    assert.equal(lerData(42, AGORA), null);
    assert.equal(lerData(antes(-400), AGORA), null); // 400 dias no futuro
    assert.notEqual(lerData(antes(-0.5), AGORA), null); // ate 1 dia de folga de relogio
    assert.equal(precisaAvisoBackup({ ...base, ultimoBackup: 'lixo' }), true);
    assert.equal(precisaAvisoBackup({ ...base, ultimoBackup: antes(-400) }), true);
    assert.equal(precisaAvisoBackup({ ...base, ultimoBackup: antes(90), dispensadoEm: antes(-400) }), true);
});

/* ---------- comparacao de versao ---------- */

test('compararVersao ordena por numero, nao por texto', () => {
    assert.equal(compararVersao('1.0.0', '1.0.0'), 0);
    assert.equal(compararVersao('1.0.1', '1.0.0'), 1);
    assert.equal(compararVersao('1.0.0', '1.1.0'), -1);
    assert.equal(compararVersao('1.10.0', '1.9.0'), 1); // como texto, "1.10" < "1.9"
    assert.equal(compararVersao('2.0', '1.99.99'), 1);
    assert.equal(compararVersao('1.2', '1.2.0'), 0);
    assert.equal(compararVersao('v1.2.3', '1.2.3'), 0);
    assert.equal(compararVersao('1.2.3-beta', '1.2.3'), 0);
    assert.equal(compararVersao(undefined, '0.0.1'), -1);
});

test('haVersaoNova: numero maior vence, e com o mesmo numero vale a data do build', () => {
    const rodando = { versao: '1.0.0', build: '2026-11-11T10:00:00.000Z' };
    assert.equal(haVersaoNova(rodando, { versao: '1.0.1', build: '2026-01-01T00:00:00.000Z' }), true);
    assert.equal(haVersaoNova(rodando, { versao: '0.9.0', build: '2027-01-01T00:00:00.000Z' }), false);
    assert.equal(haVersaoNova(rodando, { versao: '1.0.0', build: '2026-11-11T11:00:00.000Z' }), true);
    assert.equal(haVersaoNova(rodando, { versao: '1.0.0', build: '2026-11-11T10:00:00.000Z' }), false);
    assert.equal(haVersaoNova(rodando, { versao: '1.0.0', build: '2026-11-11T09:00:00.000Z' }), false);
    assert.equal(haVersaoNova(rodando, { versao: '1.0.0' }), false); // sem data legivel: nao inventa versao nova
    assert.equal(haVersaoNova(rodando, null), false);
});

test('rotulo da versao com data e hora', () => {
    assert.equal(formatarBuild('2026-11-11T17:32:00.000Z', 'America/Sao_Paulo'), '11/11/2026 14:32');
    assert.equal(formatarBuild('nao e data'), '');
    assert.equal(rotuloVersao({ versao: '1.0.0', build: '2026-11-11T17:32:00.000Z' }, 'America/Sao_Paulo'), '1.0.0, gerada em 11/11/2026 14:32');
    assert.equal(rotuloVersao({ versao: '1.0.0', build: '' }), '1.0.0');
});
