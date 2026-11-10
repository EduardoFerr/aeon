// Gera horizons.json: longitude eclitica aparente (QUANTITIES=31) de cada corpo
// segundo o NASA/JPL Horizons (observador geocentrico, CENTER=500@399).
// Uso: node tests/astro/referencias/gerar-horizons.mjs
// Os instantes sao UTC; o Horizons recebe o JD correspondente.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const IDS = { sol: 10, lua: 301, mercurio: 199, venus: 299, marte: 499, jupiter: 599, saturno: 699, urano: 799, netuno: 899, plutao: 999 };
const INSTANTES = [
  "2000-01-01T12:00:00Z", "1990-04-19T00:00:00Z", "1975-06-15T15:00:00Z",
  "2018-02-18T01:30:00Z", "2018-02-18T02:30:00Z", "2007-09-23T08:00:00Z",
  // retrogradacao: cada instante com -12h e +12h para obter a velocidade
  "2024-04-10T00:00:00Z", "2024-04-10T24:00:00Z", "2024-03-10T00:00:00Z", "2024-03-10T24:00:00Z",
  "2024-08-01T00:00:00Z", "2024-08-01T24:00:00Z", "2024-03-01T00:00:00Z", "2024-03-01T24:00:00Z",
  "2022-12-01T00:00:00Z", "2022-12-01T24:00:00Z",
];
const jd = (iso) => {
  const [d, h] = iso.replace("Z", "").split("T");
  const [hh, mm, ss] = h.split(":").map(Number);
  return Date.parse(d + "T00:00:00Z") / 864e5 + 2440587.5 + (hh * 3600 + mm * 60 + ss) / 86400;
};
// O Horizons devolve as linhas em ordem cronologica, nao na ordem do TLIST:
// ordenar antes, senao os rotulos ficam trocados.
INSTANTES.sort((a, b) => jd(a) - jd(b));
const out = { fonte: "NASA/JPL Horizons API, QUANTITIES=31, CENTER=500@399", consultado: new Date().toISOString().slice(0, 10), valores: {} };
for (const [nome, id] of Object.entries(IDS)) {
  const tl = INSTANTES.map((i) => `'${jd(i)}'`).join(",");
  const url = `https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND='${id}'&OBJ_DATA=NO&MAKE_EPHEM=YES&EPHEM_TYPE=OBSERVER&CENTER='500@399'&TLIST=${encodeURIComponent(tl)}&TLIST_TYPE=JD&QUANTITIES='31'&ANG_FORMAT=DEG&CSV_FORMAT=YES`;
  const txt = await (await fetch(url)).text();
  const corpo = txt.split("$$SOE")[1]?.split("$$EOE")[0];
  if (!corpo) throw new Error("resposta inesperada para " + nome + ": " + txt.slice(0, 300));
  const linhas = corpo.trim().split("\n");
  if (linhas.length !== INSTANTES.length) throw new Error("linhas " + linhas.length);
  linhas.forEach((l, i) => {
    const c = l.split(",").map((s) => s.trim());
    // colunas: data, flags, flags, lon, lat
    const lon = parseFloat(c[c.length - 3]);
    (out.valores[INSTANTES[i]] ??= {})[nome] = lon;
  });
}
const dest = path.join(path.dirname(fileURLToPath(import.meta.url)), "horizons.json");
writeFileSync(dest, JSON.stringify(out, null, 1) + "\n");
console.log("ok", dest);
