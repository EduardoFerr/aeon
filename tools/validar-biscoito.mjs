// Valida as frases do biscoito da sorte (public/data/biscoito.json). Sai com codigo 1 se algo estiver errado.
// Uso: npm run validar  (ou: node tools/validar-biscoito.mjs)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const caminho = path.join(raiz, "public/data/biscoito.json");

const TOTAL = 1000;
const MIN_TEXTO = 40;
const MAX_TEXTO = 110;

const erros = [];
const avisos = [];
const erro = (id, msg) => erros.push(`#${id}: ${msg}`);
const aviso = (id, msg) => avisos.push(`#${id}: ${msg}`);

// \b nao funciona com acentos; usa letras Unicode como fronteira.
const palavra = (p) => new RegExp(`(?<![\\p{L}\\p{N}])${p}(?![\\p{L}\\p{N}])`, "iu");
const VETOS = [
  ["travessao ou meia-risca", /[\u2014\u2013]/],
  ["a palavra mega", /mega/i],
];
// Palavras que o design evita, mas que nao travam o validar: viram aviso para quem escreve as frases decidir.
const EVITAR = [
  ["loteria", palavra("loteri\\p{L}*")],
  ["aposte", palavra("aposte")],
  ["dezenas", palavra("dezenas?")],
];

let lista;
try {
  lista = JSON.parse(readFileSync(caminho, "utf8"));
} catch (e) {
  console.error(`Nao foi possivel ler ${caminho}: ${e.message}`);
  process.exit(1);
}
if (!Array.isArray(lista)) {
  console.error("biscoito.json: a raiz precisa ser uma lista");
  process.exit(1);
}
if (lista.length !== TOTAL) erro("lista", `esperava ${TOTAL} itens, achei ${lista.length}`);

const ids = new Set();
const conjuntos = new Map();
const textos = new Map();

for (const x of lista) {
  const id = x && x.id;
  if (!x || typeof x !== "object") { erro("?", "item que nao e objeto"); continue; }
  const extra = Object.keys(x).filter((k) => !["id", "texto", "numeros"].includes(k));
  if (extra.length) erro(id, `campos desconhecidos: ${extra.join(", ")}`);

  if (!Number.isInteger(id) || id < 1 || id > TOTAL) erro(id, `id fora de 1..${TOTAL}`);
  else if (ids.has(id)) erro(id, "id repetido");
  else ids.add(id);

  const t = x.texto;
  if (typeof t !== "string") erro(id, "texto ausente ou nao e texto");
  else {
    if (t.length < MIN_TEXTO || t.length > MAX_TEXTO) erro(id, `texto com ${t.length} caracteres (de ${MIN_TEXTO} a ${MAX_TEXTO})`);
    if (t !== t.trim()) erro(id, "espaco nas pontas do texto");
    if (/\s{2,}/.test(t)) erro(id, "espaco duplo no texto");
    if (t !== t.normalize("NFC")) erro(id, "texto fora da normalizacao NFC");
    for (const [nome, re] of VETOS) if (re.test(t)) erro(id, `texto tem ${nome}`);
    for (const [nome, re] of EVITAR) if (re.test(t)) aviso(id, `texto tem "${nome}", que o design evita`);
    const chave = t.toLowerCase();
    if (textos.has(chave)) erro(id, `texto igual ao do #${textos.get(chave)}`);
    else textos.set(chave, id);
  }

  const n = x.numeros;
  if (!Array.isArray(n) || n.length !== 6) erro(id, "numeros precisa ter exatamente 6 itens");
  else {
    if (!n.every((v) => Number.isInteger(v) && v >= 1 && v <= 60)) erro(id, "numeros precisa ter inteiros de 1 a 60");
    else if (!n.every((v, i) => i === 0 || v > n[i - 1])) erro(id, "numeros precisa estar em ordem crescente e sem repetir");
    else {
      const chave = n.join(",");
      if (conjuntos.has(chave)) erro(id, `mesmo conjunto de numeros do #${conjuntos.get(chave)}`);
      else conjuntos.set(chave, id);
    }
  }
}

for (let i = 1; i <= TOTAL; i++) if (!ids.has(i)) { erro(i, "id ausente (os ids vao de 1 a " + TOTAL + " sem buracos)"); break; }

if (avisos.length) console.warn(`Avisos (${avisos.length}):\n${avisos.slice(0, 20).join("\n")}`);
if (erros.length) {
  console.error(`biscoito.json: ${erros.length} erro(s):\n${erros.slice(0, 40).join("\n")}${erros.length > 40 ? `\n... e mais ${erros.length - 40}` : ""}`);
  process.exit(1);
}
console.log(`biscoito.json ok: ${lista.length} frases, ids 1..${TOTAL}, ${conjuntos.size} conjuntos de numeros distintos.`);
