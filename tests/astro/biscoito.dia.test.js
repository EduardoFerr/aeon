import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
const armazenamento = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
};
globalThis.localStorage = armazenamento;
const D = await import('../../src/utils/biscoitoDia.js');
const { hash } = await import('../../src/utils/cartaDoDia.js');

const lista = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, texto: `Frase número ${i + 1}.`, numeros: [1, 2, 3, 4, 5, 6] }));
const HOJE = '2026-11-11';
const AMANHA = '2026-11-12';

// gerador deterministico (xorshift) para os testes nao dependerem de sorte
function semente(s) {
    let x = s >>> 0 || 1;
    return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x; };
}

function limpar() {
    mem.clear();
    D.reiniciarMemoria();
    globalThis.localStorage = armazenamento;
}
const guardado = () => JSON.parse(mem.get(D.CHAVE_BISCOITO));

/* ---------- janela de ids vistos ---------- */

test('janela: 700 com 1000 frases, e sempre sobram ao menos 100 candidatas (ou metade, em lista pequena)', () => {
    assert.equal(D.janela(1000), 700);
    assert.equal(D.janela(5000), 700);
    assert.equal(D.janela(500), 400);
    assert.equal(D.janela(200), 100);
    assert.equal(D.janela(20), 10);
    assert.equal(D.janela(1), 1);
    for (const n of [2, 3, 10, 99, 100, 150, 1000]) assert.ok(n - D.janela(n) >= Math.min(100, Math.floor(n / 2)), `n=${n}`);
});

/* ---------- sorteio sem repeticao ---------- */

test('sem repetir: com 20 frases e 10 vistas recentes, so sai das outras 10', () => {
    limpar();
    const l = lista(20);
    mem.set(D.CHAVE_BISCOITO, JSON.stringify({ v: 1, dias: {}, vistos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }));
    const fonte = semente(7);
    const saiu = new Set();
    for (let i = 0; i < 200; i++) {
        limpar();
        mem.set(D.CHAVE_BISCOITO, JSON.stringify({ v: 1, dias: {}, vistos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }));
        saiu.add(D.quebrar(l, HOJE, fonte).item.id);
    }
    assert.ok([...saiu].every((id) => id > 10), `repetiu uma vista: ${[...saiu]}`);
    assert.ok(saiu.size >= 8);
});

test('depois de esgotar a janela volta a sortear sem erro, e vistos nunca passa da janela', () => {
    limpar();
    const l = lista(20);
    const fonte = semente(3);
    for (let d = 0; d < 30; d++) {
        const data = `2026-12-${String(d + 1).padStart(2, '0')}`;
        for (let k = 0; k < 3; k++) {
            const r = D.quebrar(l, data, fonte);
            assert.ok(r && r.item.id >= 1 && r.item.id <= 20);
        }
        assert.ok(guardado().vistos.length <= D.janela(20));
    }
});

test('nao repete frase nos 200 dias seguintes (1000 frases, 3 por dia)', () => {
    limpar();
    const l = lista(1000);
    const fonte = semente(11);
    const sequencia = [];
    for (let d = 0; d < 230; d++) {
        const data = new Date(2026, 0, 1 + d, 12);
        const txt = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
        for (let k = 0; k < 3; k++) sequencia.push(D.quebrar(l, txt, fonte).item.id);
    }
    // janela de 700 ids: nenhuma frase reaparece antes de 700 quebras
    for (let i = 0; i < sequencia.length; i++) {
        const antes = sequencia.slice(Math.max(0, i - 700), i);
        assert.ok(!antes.includes(sequencia[i]), `repetiu na posicao ${i}`);
    }
    assert.ok(guardado().vistos.length <= 700);
});

test('dois dias seguidos: seis frases diferentes entre si e o estado guarda os dois dias', () => {
    limpar();
    const l = lista(20);
    const fonte = semente(5);
    const ids = [];
    for (let k = 0; k < 3; k++) ids.push(D.quebrar(l, HOJE, fonte).item.id);
    for (let k = 0; k < 3; k++) ids.push(D.quebrar(l, AMANHA, fonte).item.id);
    assert.equal(new Set(ids).size, 6);
    assert.equal(D.lerHoje(HOJE).itens.length, 3);
    assert.equal(D.lerHoje(AMANHA).itens.length, 3);
});

/* ---------- limite diario ---------- */

test('3 quebras no mesmo dia dao 3 frases distintas e a 4a e recusada', () => {
    limpar();
    const l = lista(50);
    const fonte = semente(1);
    const r1 = D.quebrar(l, HOJE, fonte);
    const r2 = D.quebrar(l, HOJE, fonte);
    const r3 = D.quebrar(l, HOJE, fonte);
    assert.deepEqual([r1.indice, r2.indice, r3.indice], [1, 2, 3]);
    assert.deepEqual([r1.restantes, r2.restantes, r3.restantes], [2, 1, 0]);
    assert.equal(new Set([r1.item.id, r2.item.id, r3.item.id]).size, 3);
    assert.equal(D.restantes(HOJE), 0);
    assert.equal(D.quebrar(l, HOJE, fonte), null);
    assert.equal(D.lerHoje(HOJE).itens.length, 3); // a recusa nao gastou nem apagou nada
});

test('virou o dia: a data nova devolve 3 de novo, e o dia antigo segue como estava', () => {
    limpar();
    const l = lista(50);
    for (let k = 0; k < 3; k++) D.quebrar(l, HOJE);
    assert.equal(D.restantes(HOJE), 0);
    assert.equal(D.restantes(AMANHA), 3);
    assert.ok(D.quebrar(l, AMANHA));
    assert.equal(D.restantes(AMANHA), 2);
    assert.equal(D.restantes(HOJE), 0);
});

test('o biscoito "de hoje" (o primeiro) nao muda entre leituras nem depois dos extras', () => {
    limpar();
    const l = lista(50);
    const primeiro = D.quebrar(l, HOJE).item;
    assert.deepEqual(D.primeiroDeHoje(HOJE), primeiro);
    assert.deepEqual(D.ultimoDeHoje(HOJE), primeiro);
    const segundo = D.quebrar(l, HOJE).item;
    assert.deepEqual(D.primeiroDeHoje(HOJE), primeiro);
    assert.deepEqual(D.ultimoDeHoje(HOJE), segundo);
    assert.deepEqual(D.lerHoje(HOJE).itens, [primeiro, segundo]);
    assert.equal(D.primeiroDeHoje(AMANHA), null);
    assert.equal(D.ultimoDeHoje(AMANHA), null);
});

test('lista vazia: nada e sorteado nem gasto', () => {
    limpar();
    assert.equal(D.quebrar([], HOJE), null);
    assert.equal(D.restantes(HOJE), 3);
});

test('o que e guardado tem so id, texto e numeros, e cabe em poucos KB', () => {
    limpar();
    const l = lista(1000);
    for (let d = 0; d < 10; d++) for (let k = 0; k < 3; k++) D.quebrar(l, `2026-11-${String(d + 1).padStart(2, '0')}`);
    const e = guardado();
    assert.equal(e.v, 1);
    for (const dia of Object.values(e.dias)) for (const x of dia.itens) assert.deepEqual(Object.keys(x).sort(), ['id', 'numeros', 'texto']);
    assert.ok(mem.get(D.CHAVE_BISCOITO).length < 8000);
});

test('poda: ficam so os ultimos 7 dias', () => {
    limpar();
    const l = lista(100);
    for (let d = 1; d <= 12; d++) D.quebrar(l, `2026-11-${String(d).padStart(2, '0')}`);
    const datas = Object.keys(guardado().dias).sort();
    assert.deepEqual(datas, ['2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12']);
});

/* ---------- sem armazenamento ---------- */

function semArmazenamento() {
    globalThis.localStorage = {
        getItem() { throw new Error('bloqueado'); },
        setItem() { throw new Error('bloqueado'); },
        removeItem() { throw new Error('bloqueado'); },
    };
}

test('sem armazenamento: o primeiro do dia sai da data (igual em duas visitas) e nada lanca', () => {
    limpar();
    semArmazenamento();
    const l = lista(1000);
    const a = D.quebrar(l, HOJE);
    assert.equal(a.persiste, false);
    assert.equal(a.item.id, l[hash(HOJE) % l.length].id);
    D.reiniciarMemoria(); // simula recarregar a pagina
    const b = D.quebrar(l, HOJE);
    assert.equal(b.item.id, a.item.id);
    D.reiniciarMemoria();
    assert.equal(D.quebrar(l, AMANHA).item.id, l[hash(AMANHA) % l.length].id);
});

test('sem armazenamento: os extras ficam em memoria, o limite de 3 vale na visita e o ultimo e o que a tela mostra', () => {
    limpar();
    semArmazenamento();
    const l = lista(1000);
    const r1 = D.quebrar(l, HOJE);
    const r2 = D.quebrar(l, HOJE);
    const r3 = D.quebrar(l, HOJE);
    assert.equal(new Set([r1.item.id, r2.item.id, r3.item.id]).size, 3);
    assert.equal(r1.item.id, l[hash(HOJE) % 1000].id); // o primeiro continua o da data
    assert.equal(D.quebrar(l, HOJE), null);
    assert.equal(D.restantes(HOJE), 0);
    assert.deepEqual(D.lerHoje(HOJE).itens.map((x) => x.id), [r1.item.id, r2.item.id, r3.item.id]);
    assert.deepEqual(D.ultimoDeHoje(HOJE), r3.item);
    assert.equal(D.lerHoje(HOJE).persiste, false);
});

test('quota cheia (leitura funciona, gravacao falha): mesmo caminho, sem excecao', () => {
    limpar();
    globalThis.localStorage = { getItem: () => null, setItem() { throw new Error('QuotaExceededError'); }, removeItem() {} };
    const l = lista(1000);
    const a = D.quebrar(l, HOJE);
    assert.equal(a.persiste, false);
    assert.equal(a.item.id, l[hash(HOJE) % 1000].id);
    assert.ok(D.quebrar(l, HOJE));
    assert.equal(D.restantes(HOJE), 1);
});

test('quando o armazenamento volta a funcionar, a gravacao recomeca', () => {
    limpar();
    const l = lista(1000);
    globalThis.localStorage = { getItem: () => null, setItem() { throw new Error('cheio'); }, removeItem() {} };
    D.quebrar(l, HOJE);
    globalThis.localStorage = armazenamento;
    D.reiniciarMemoria();
    const r = D.quebrar(l, AMANHA);
    assert.equal(r.persiste, true);
    assert.equal(guardado().dias[AMANHA].itens.length, 1);
});

/* ---------- saneamento do estado ---------- */

const bom = { id: 5, texto: 'Uma frase boa.', numeros: [3, 9, 12, 33, 41, 60] };

test('JSON corrompido ou versao errada: estado vazio, sem quebrar, e a proxima quebra regrava limpo', () => {
    for (const bruto of ['{nao e json', '', 'null', '[]', '42', '{"v":2,"dias":{},"vistos":[]}', '{"dias":{}}']) {
        limpar();
        mem.set(D.CHAVE_BISCOITO, bruto);
        assert.deepEqual(D.lerHoje(HOJE).itens, [], bruto);
        assert.equal(D.restantes(HOJE), 3, bruto);
        const r = D.quebrar(lista(50), HOJE);
        assert.ok(r, bruto);
        assert.equal(guardado().v, 1);
    }
});

test('item invalido e descartado sem afetar os validos (ids como texto, numeros fora da faixa, texto de 500 caracteres)', () => {
    limpar();
    const ruins = [
        { id: '7', texto: 'x', numeros: [1, 2, 3, 4, 5, 6] },
        { id: 7, texto: 'x', numeros: [1, 2, 3, 4, 5] },
        { id: 7, texto: 'x', numeros: [1, 2, 3, 4, 5, 61] },
        { id: 7, texto: 'x', numeros: [6, 5, 4, 3, 2, 1] },
        { id: 7, texto: 'y'.repeat(500), numeros: [1, 2, 3, 4, 5, 6] },
        null, 'texto', 12,
    ];
    mem.set(D.CHAVE_BISCOITO, JSON.stringify({ v: 1, dias: { [HOJE]: { itens: [ruins[0], bom, ruins[1], ruins[2], ruins[3], ruins[4], ruins[5], ruins[6], ruins[7]] } }, vistos: [] }));
    const { itens, restantes } = D.lerHoje(HOJE);
    assert.deepEqual(itens, [bom]);
    assert.equal(restantes, 2);
});

test('dia com data invalida, itens que nao e lista e vistos com lixo: ignorados', () => {
    limpar();
    mem.set(D.CHAVE_BISCOITO, JSON.stringify({
        v: 1,
        dias: { 'ontem': { itens: [bom] }, [HOJE]: { itens: 'nada' }, '2026-11-10': { itens: [bom] }, '2026-11-09': 5 },
        vistos: [1, '2', 3.5, null, 4, -1, 0],
    }));
    assert.deepEqual(D.lerHoje(HOJE).itens, []);
    assert.deepEqual(D.lerHoje('2026-11-10').itens, [bom]);
    D.quebrar(lista(50), HOJE);
    const e = guardado();
    assert.deepEqual(Object.keys(e.dias).sort(), ['2026-11-10', HOJE]);
    assert.ok(e.vistos.slice(0, 2).every((x) => x === 1 || x === 4));
});

test('mais de 3 itens guardados no mesmo dia: so os 3 primeiros valem e a quebra e recusada', () => {
    limpar();
    const itens = [1, 2, 3, 4, 5].map((id) => ({ ...bom, id }));
    mem.set(D.CHAVE_BISCOITO, JSON.stringify({ v: 1, dias: { [HOJE]: { itens } }, vistos: [] }));
    assert.deepEqual(D.lerHoje(HOJE).itens.map((x) => x.id), [1, 2, 3]);
    assert.equal(D.quebrar(lista(50), HOJE), null);
});

test('ler nao grava: abrir a tela com um dia ja guardado nao mexe no armazenamento', () => {
    limpar();
    const l = lista(50);
    D.quebrar(l, HOJE);
    const antes = mem.get(D.CHAVE_BISCOITO);
    D.lerHoje(HOJE); D.restantes(HOJE); D.ultimoDeHoje(HOJE); D.primeiroDeHoje(HOJE);
    assert.equal(mem.get(D.CHAVE_BISCOITO), antes);
});

test('o estado e do aparelho: a chave nao leva o id da conta', () => {
    assert.equal(D.CHAVE_BISCOITO, 'aeon:v2:biscoito');
    limpar();
    D.quebrar(lista(50), HOJE);
    assert.deepEqual([...mem.keys()], ['aeon:v2:biscoito']);
});
