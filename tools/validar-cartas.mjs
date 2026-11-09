// Valida public/data/cards.json. Sai com codigo 1 se algo estiver errado,
// para que o CI nao publique dados incompletos ou incoerentes.
// Uso: npm run validar
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cartas = JSON.parse(
  readFileSync(path.join(raiz, "public/data/cards.json"), "utf8")
);

const erros = [];
const erro = (carta, msg) => erros.push(`${carta?.name ?? "?"}: ${msg}`);

const NAIPES = ["Bastões", "Taças", "Espadas", "Discos"];
const PATENTES = ["Cavaleiro", "Rainha", "Príncipe", "Princesa"];
const PROIBIDOS = [/\bPaus\b/, /\bCopas\b/, /\bOuros\b/, /\bPajem\b/, /\bRei\b/];
const NOMES_WAITE = ["A Força", "A Justiça", "A Temperança", "O Julgamento", "O Mundo"];

if (cartas.length !== 78) erros.push(`esperadas 78 cartas, ha ${cartas.length}`);

const nomes = new Set();
const ordens = new Set();
for (const c of cartas) {
  const ord = Number(c.order);
  if (!Number.isInteger(ord) || ord < 0 || ord > 77) erro(c, `order invalida (${c.order})`);
  if (ordens.has(ord)) erro(c, `order repetida (${c.order})`);
  ordens.add(ord);

  if (nomes.has(c.name)) erro(c, "nome repetido");
  nomes.add(c.name);

  const arquivo = path.join(
    raiz,
    "public/assets/cards",
    `crowley-${String(ord).padStart(2, "0")}.jpg`
  );
  if (!existsSync(arquivo)) erro(c, `imagem ausente (${path.basename(arquivo)})`);

  for (const campo of [
    "name", "title", "element", "eighth_greater", "eighth_lesser",
    "description", "description_symbolic", "message_esoteric",
    "internal_alchemy", "magical_practice", "numeral",
  ]) {
    if (typeof c[campo] !== "string" || c[campo].trim() === "") erro(c, `campo vazio: ${campo}`);
  }
  if (!Array.isArray(c.meditation_reflection) || c.meditation_reflection.length !== 3)
    erro(c, "meditation_reflection deve ter 3 perguntas");
  for (const k of ["past", "present", "future"])
    if (!c.past_present_future?.[k]) erro(c, `past_present_future.${k} vazio`);

  if (NOMES_WAITE.includes(c.name)) erro(c, "nome de Waite no lugar do de Thoth");
  if (PROIBIDOS.some((r) => r.test(c.name) || r.test(c.suit ?? "")))
    erro(c, "nome ou naipe no padrao antigo (Rider-Waite/marselhes)");

  if (c.isMajorArcana) {
    if (!c.path?.number || !c.path?.from || !c.path?.to) erro(c, "arcano maior sem caminho");
    if (!c.hebrew_letter) erro(c, "arcano maior sem letra hebraica");
  } else {
    if (!NAIPES.includes(c.suit)) erro(c, `naipe invalido (${c.suit})`);
    if (!c.sephirah) erro(c, "sem sephirah");
    const n = c.number;
    if (n >= 2 && n <= 10) {
      if (!c.decan?.number || !c.decan?.planet || !c.decan?.sign || !c.sign || !c.planet)
        erro(c, "carta numerada sem decano, signo ou planeta");
    } else if (n >= 11) {
      if (!PATENTES.includes(c.court_rank)) erro(c, `patente invalida (${c.court_rank})`);
      if (!c.court_element) erro(c, "Corte sem elemento composto");
      if (c.court_rank !== "Princesa" && !c.zodiac_range) erro(c, "Corte sem faixa zodiacal");
    }
  }

  // Cartas ja reescritas na voz de tarot: nada de atribuicao constante a Crowley
  // e nada de tom de apoio ou terapia (o app e de tarot, nao de acolhimento).
  if (c.texto_thoth) {
    const textos = [
      c.description, c.description_symbolic, c.message_esoteric, c.eighth_greater,
      c.eighth_lesser, c.internal_alchemy, c.magical_practice,
      ...(c.meditation_reflection ?? []),
      ...Object.values(c.past_present_future ?? {}),
    ].filter(Boolean);
    const vetados = /Crowley|Harris|apoio profissional|apoio especializado|profissional de sa[uú]de|n[aã]o substitui|tratamento|terapia|\b180\b|sinal para observar/i;
    for (const t of textos) {
      const achado = t.match(vetados);
      if (achado) erro(c, `termo vetado no texto ("${achado[0]}")`);
    }
  }
}

// Glossario clicavel (opcional): integridade dos verbetes
const arquivoGlossario = path.join(raiz, "public/data/glossario.json");
if (existsSync(arquivoGlossario)) {
  const glossario = JSON.parse(readFileSync(arquivoGlossario, "utf8"));
  const ids = new Set();
  for (const v of glossario) {
    if (!v.id || !v.termo || !v.curto) erros.push(`glossario: verbete incompleto (${v.id ?? "?"})`);
    if (ids.has(v.id)) erros.push(`glossario: id repetido (${v.id})`);
    ids.add(v.id);
    if (v.curto?.length > 170) erros.push(`glossario: curto longo demais em ${v.id}`);
    if (v.mais?.length > 450) erros.push(`glossario: mais longo demais em ${v.id}`);
    if (v.auto && !(v.aliases?.length)) erros.push(`glossario: ${v.id} e automatico mas nao tem aliases`);
  }
  for (const v of glossario)
    for (const r of v.ver_tambem ?? [])
      if (!ids.has(r)) erros.push(`glossario: ${v.id} aponta para ver_tambem inexistente (${r})`);
  console.log(`validar-cartas: glossario com ${glossario.length} verbetes`);
}

if (erros.length) {
  console.error(`validar-cartas: ${erros.length} problema(s)`);
  for (const e of erros) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`validar-cartas: ${cartas.length} cartas, nenhum problema`);
