// Valida os textos do mapa astral (public/data/astro/textos.json) contra a
// lista de ids em tools/astro-ids.json. Sai com codigo 1 se algo estiver errado.
// Uso: npm run validar
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lista = JSON.parse(readFileSync(path.join(raiz, "tools/astro-ids.json"), "utf8"));
const textos = JSON.parse(readFileSync(path.join(raiz, "public/data/astro/textos.json"), "utf8"));

const erros = [];
const avisos = [];
const erro = (id, msg) => erros.push(`${id}: ${msg}`);
const aviso = (id, msg) => avisos.push(`${id}: ${msg}`);

const PISO = 0.55;
// \b nao funciona com acentos; usa letras Unicode como fronteira.
const palavra = (p) => new RegExp(`(?<![\\p{L}\\p{N}])${p}(?![\\p{L}\\p{N}])`, "iu");
const VETOS = [
  ["travessao", /[—–]/],
  ["sempre", palavra("sempre")],
  ["nunca", palavra("nunca")],
  ["vai", palavra("vai")],
  ["vão", palavra("v[aã]o")],
  ["pede", palavra("pede")],
  ["pedem", palavra("pedem")],
  ["pedir", palavra("pedir")],
  ["gesto", palavra("gestos?")],
  ["régua", palavra("r[eé]guas?")],
  ["travessia", palavra("travessias?")],
  ["atravess*", palavra("atravess\\p{L}*")],
  ["Crowley", palavra("Crowley")],
  ["você", palavra("voc[eê]s?")],
];

const idsLista = new Map();
for (const e of lista) {
  if (idsLista.has(e.id)) erro(e.id, "id repetido na lista");
  idsLista.set(e.id, e);
}

for (const id of idsLista.keys())
  if (!(id in textos)) erro(id, "texto ausente");
for (const id of Object.keys(textos))
  if (!idsLista.has(id)) erro(id, "id sobrando (nao esta na lista)");

const vistos = new Map();
for (const [id, e] of idsLista) {
  const t = textos[id];
  if (t === undefined) continue;
  if (typeof t !== "string" || t.trim() === "") {
    erro(id, "texto vazio");
    continue;
  }
  const n = [...t].length;
  if (n > e.limite) erro(id, `acima do limite (${n} > ${e.limite})`);
  else if (n < e.limite * PISO) aviso(id, `abaixo do piso de 55% (${n} < ${Math.ceil(e.limite * PISO)})`);

  for (const m of t.matchAll(/\{([^{}]*)\}/g))
    if (!e.marcadores.includes(m[1])) erro(id, `marcador nao permitido {${m[1]}}`);
  if (/[{}]/.test(t.replace(/\{[^{}]*\}/g, ""))) erro(id, "chave solta no texto");

  for (const [nome, re] of VETOS) {
    const a = t.match(re);
    if (a) erro(id, `termo vetado (${nome}: "${a[0]}")`);
  }

  const chave = t.trim().replace(/\s+/g, " ").toLowerCase();
  if (vistos.has(chave)) erro(id, `texto duplicado de ${vistos.get(chave)}`);
  else vistos.set(chave, id);
}

for (const a of avisos) console.warn(`  aviso: ${a}`);
if (erros.length) {
  console.error(`validar-astro: ${erros.length} problema(s)`);
  for (const e of erros) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `validar-astro: ${idsLista.size} textos, ${avisos.length} aviso(s) de piso, nenhum problema`
);
