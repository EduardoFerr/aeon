import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { raiz, lerJson } from './util.js';
import { layoutFrase, MEDIDAS } from '../../src/utils/cartaoBiscoito.js';
import { SVG_INTEIRO, SVG_METADE_ESQ, SVG_METADE_DIR, CORES_BISCOITO, svgComCores } from '../../src/utils/biscoitoArte.js';

// ctx de mentira: so font e measureText (largura proporcional ao corpo da fonte)
function ctxFalso(larguraEm = 0.5) {
    return {
        font: '',
        measureText(t) {
            const px = Number(/(\d+(?:\.\d+)?)px/.exec(this.font)[1]);
            return { width: t.length * px * larguraEm };
        },
    };
}
const fonteDe = (px) => `500 ${px}px "Cormorant Garamond"`;
const frases = lerJson('public/data/biscoito.json').map((x) => x.texto);

/* ---------- layout do cartao ---------- */

test('layout: toda frase cabe em ate 6 linhas, de 68 a 52 px, com a tirinha dentro da zona segura', () => {
    // 0,5 em de largura media por letra e pessimista para as duas familias do app
    for (const t of frases) {
        const L = layoutFrase(ctxFalso(0.5), t, fonteDe);
        assert.ok(L.linhas.length <= 6, `mais de 6 linhas: ${t}`);
        assert.ok(L.px >= 52 && L.px <= 68 && L.px % 4 === 0);
        const base = MEDIDAS.tirinhaTopo + L.altura;
        assert.ok(base <= MEDIDAS.tirinhaMax, `tirinha passa de ${MEDIDAS.tirinhaMax}: ${base}`);
        assert.ok(base + 64 <= MEDIDAS.zonaBase, 'a nota abaixo da tirinha sai da zona segura');
        assert.ok(MEDIDAS.tirinhaTopo >= MEDIDAS.zonaTopo);
        assert.equal(L.linhas.join(' '), t.trim().split(/\s+/).join(' ')); // nenhuma palavra se perde
    }
});

test('layout: frase curta usa o maior corpo; frase de 110 caracteres reduz, e a altura acompanha as linhas', () => {
    const curta = layoutFrase(ctxFalso(), 'A calma também é uma forma de coragem.', fonteDe);
    assert.equal(curta.px, 68);
    const longa = layoutFrase(ctxFalso(), 'palavra '.repeat(13).trim(), fonteDe);
    assert.ok(longa.px < 68);
    assert.ok(longa.altura > curta.altura - 1);
    for (const L of [curta, longa]) {
        assert.equal(L.lh, Math.round(L.px * 1.28));
        assert.ok(L.altura >= L.linhas.length * L.lh);
    }
});

test('layout: no caso extremo o menor corpo (52 px) e usado em vez de estourar', () => {
    const extremo = layoutFrase(ctxFalso(0.9), 'palavra '.repeat(14).trim(), fonteDe);
    assert.equal(extremo.px, 52);
});

/* ---------- arte ---------- */

test('svgComCores troca todas as variaveis pelas cores do tema, nos dois temas', () => {
    for (const svg of [SVG_INTEIRO, SVG_METADE_ESQ, SVG_METADE_DIR]) {
        assert.ok(svg.includes('var(--bsc-'));
        for (const tema of ['crepusculo', 'aurora']) {
            const s = svgComCores(svg, tema, 134, 170);
            assert.ok(!s.includes('var('), `sobrou var() no tema ${tema}`);
            assert.ok(s.includes('width="134" height="170"'));
            assert.equal((s.match(/xmlns=/g) || []).length, 1);
        }
    }
    assert.ok(svgComCores(SVG_INTEIRO, 'aurora', 240, 170).includes(CORES_BISCOITO.aurora.linha));
    assert.ok(svgComCores(SVG_INTEIRO, 'crepusculo', 240, 170).includes('rgba(11,8,16,.45)')); // valor com parenteses e virgulas
});

test('o SVG inline e decorativo: sem role nem aria-label proprios e com ids unicos entre as pecas', () => {
    const todos = [SVG_INTEIRO, SVG_METADE_ESQ, SVG_METADE_DIR];
    for (const s of todos) {
        assert.ok(s.includes('aria-hidden="true"'));
        assert.ok(!s.includes('role="img"') && !s.includes('aria-label'));
    }
    const ids = todos.flatMap((s) => [...s.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
    assert.equal(new Set(ids).size, ids.length);
});

/* ---------- regras de texto nos arquivos novos ---------- */

const ARQUIVOS = [
    'src/components/BiscoitoScreen.js', 'src/components/TiragensScreen.js', 'src/utils/biscoito.js', 'src/utils/biscoitoDia.js',
    'src/utils/biscoitoArte.js', 'src/utils/cartaoBiscoito.js', 'styles/biscoito.css', 'tools/validar-biscoito.mjs',
];

test('nenhum arquivo do biscoito tem travessao longo nem a marca de loteria', () => {
    const marca = new RegExp(['Me', 'ga'].join('') + '[- ]?Sena', 'i');
    for (const a of ARQUIVOS) {
        const t = readFileSync(path.join(raiz, a), 'utf8');
        assert.ok(!t.includes('—'), `${a} tem travessao longo`);
        assert.ok(!marca.test(t), `${a} cita a marca de loteria`);
    }
});

test('os textos da interface nao falam de onde o que e guardado nem de privacidade', () => {
    const proibidas = [/neste aparelho/i, /s[oó] no aparelho/i, /privacidade/i, /seguran[cç]a/i, /zera/i, /armazen/i, /fica guardad/i, /dados pessoais/i];
    for (const a of ['src/components/BiscoitoScreen.js', 'src/utils/cartaoBiscoito.js']) {
        // so as strings do objeto TEXTO (o resto e codigo e comentario)
        const t = readFileSync(path.join(raiz, a), 'utf8');
        const bloco = /const TEXTO = \{[\s\S]*?\n\};/.exec(t)[0];
        for (const re of proibidas) assert.ok(!re.test(bloco), `${a}: texto bate com ${re}`);
    }
});

test('a tela nao tem mais os textos do biscoito unico, nem "so por diversao"', () => {
    const velhos = [/diversão/i, /Quebrar outro/, /Mais um biscoito/, /acabaram/, /ainda pode quebrar/];
    for (const a of ['src/components/BiscoitoScreen.js', 'src/utils/cartaoBiscoito.js', 'src/components/TiragensScreen.js']) {
        const t = readFileSync(path.join(raiz, a), 'utf8');
        for (const re of velhos) assert.ok(!re.test(t), `${a} ainda tem ${re}`);
    }
});

test('a Home nao tem mais a faixa de atalhos nem o cartao do biscoito', () => {
    const home = readFileSync(path.join(raiz, 'src/components/HomeScreen.js'), 'utf8');
    for (const re of [/acao-card/, /home-acoes/, /data-ir/, /biscoito/i]) assert.ok(!re.test(home), `Home ainda tem ${re}`);
    assert.ok(/carta-do-dia/.test(home) && /home-sobre/.test(home));
});

test('Tiragens lista os cinco cartoes na ordem e o biscoito marca a aba Tiragens', () => {
    const t = readFileSync(path.join(raiz, 'src/components/TiragensScreen.js'), 'utf8');
    const ordem = ["op('cruz'", "op('three-card-game'", "op('templo'", "op(temMapa ?", "op('biscoito'"].map((x) => t.indexOf(x));
    assert.ok(ordem.every((i) => i > 0), 'falta um cartao');
    assert.deepEqual([...ordem].sort((a, b) => a - b), ordem);
    const nav = readFileSync(path.join(raiz, 'src/utils/navigation.js'), 'utf8');
    assert.ok(/const TIRAGENS = \[[^\]]*'biscoito'/.test(nav));
});

test('o JSON das frases nao entra no precache do service worker', () => {
    const cfg = readFileSync(path.join(raiz, 'vite.config.js'), 'utf8');
    assert.ok(/globPatterns:\s*\["\*\*\/\*\.\{js,css,html,ico,png,svg\}"\]/.test(cfg), 'o glob do precache mudou');
    assert.ok(!/globPatterns[^\n]*json/.test(cfg));
    assert.ok(readdirSync(path.join(raiz, 'public/data')).includes('biscoito.json'));
});
