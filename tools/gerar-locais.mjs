// Gera a base local de lugares (public/data/locais/) a partir do GeoNames.
//
// Fonte: https://download.geonames.org/export/dump/ (licenca Creative Commons Atribuicao 4.0,
// atribuicao obrigatoria: o site exibe o credito, ver ATRIBUICAO_LOCAIS em src/astro/locais.js).
// Nao usa Swiss Ephemeris nem qualquer codigo AGPL: sao so dados de lugares.
//
// Uso:
//   node tools/gerar-locais.mjs --baixar                 # baixa os arquivos do GeoNames para uma pasta temporaria
//   node tools/gerar-locais.mjs --fonte <pasta>          # usa arquivos ja baixados e descompactados
// Opcoes:
//   --min-pop 15000      populacao minima no mundo (cities15000.txt)
//   --br-min-pop 1000    populacao minima no Brasil (cities1000.txt), para cobrir quase todos os municipios
//   --saida public/data/locais
//
// Arquivos necessarios na pasta de fonte: cities15000.txt, cities1000.txt, admin1CodesASCII.txt, countryInfo.txt.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (nome, padrao) => {
  const i = args.indexOf('--' + nome);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : padrao;
};
const MIN_POP = Number(opt('min-pop', 15000));
const BR_MIN_POP = Number(opt('br-min-pop', 1000));
const SAIDA = path.resolve(opt('saida', 'public/data/locais'));

let fonte = opt('fonte', null);
if (args.includes('--baixar')) {
  fonte = mkdtempSync(path.join(tmpdir(), 'geonames-'));
  const base = 'https://download.geonames.org/export/dump/';
  for (const f of ['cities15000.zip', 'cities1000.zip', 'admin1CodesASCII.txt', 'countryInfo.txt']) {
    const r = await fetch(base + f);
    if (!r.ok) throw new Error(`falha ao baixar ${f}: ${r.status}`);
    writeFileSync(path.join(fonte, f), Buffer.from(await r.arrayBuffer()));
    if (f.endsWith('.zip')) execFileSync('unzip', ['-oq', f], { cwd: fonte });
  }
  console.log('baixado em', fonte);
}
if (!fonte || !existsSync(path.join(fonte, 'cities15000.txt'))) {
  console.error('Informe --fonte <pasta com os arquivos do GeoNames> ou use --baixar. Veja o cabecalho deste arquivo.');
  process.exit(1);
}

export function normalizar(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const UF = {
  Acre: 'AC', Alagoas: 'AL', 'Amapá': 'AP', Amazonas: 'AM', Bahia: 'BA', 'Ceará': 'CE', 'Federal District': 'DF',
  'Espírito Santo': 'ES', 'Goiás': 'GO', 'Maranhão': 'MA', 'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS',
  'Minas Gerais': 'MG', 'Pará': 'PA', 'Paraíba': 'PB', 'Paraná': 'PR', Pernambuco: 'PE', 'Piauí': 'PI',
  'Rio de Janeiro': 'RJ', 'Rio Grande do Norte': 'RN', 'Rio Grande do Sul': 'RS', 'Rondônia': 'RO', Roraima: 'RR',
  'Santa Catarina': 'SC', 'São Paulo': 'SP', Sergipe: 'SE', Tocantins: 'TO',
};

// Exonimos em portugues das cidades mais buscadas (o GeoNames traz o nome local/ingles).
// Chave: "nome ascii do GeoNames|pais". O arquivo avisa se alguma chave nao casar.
const EXONIMOS_PT = {
  'Lisbon|PT': 'Lisboa', 'New York City|US': 'Nova York', 'London|GB': 'Londres', 'Rome|IT': 'Roma',
  'Naples|IT': 'Nápoles', 'Milan|IT': 'Milão', 'Turin|IT': 'Turim', 'Florence|IT': 'Florença', 'Venice|IT': 'Veneza',
  'Munich|DE': 'Munique', 'Koeln|DE': 'Colônia', 'Geneva|CH': 'Genebra', 'Zuerich|CH': 'Zurique',
  'Brussels|BE': 'Bruxelas', 'Vienna|AT': 'Viena', 'Prague|CZ': 'Praga', 'Warsaw|PL': 'Varsóvia',
  'Moscow|RU': 'Moscou', 'Athens|GR': 'Atenas', 'Copenhagen|DK': 'Copenhague', 'Stockholm|SE': 'Estocolmo',
  'Saint Petersburg|RU': 'São Petersburgo', 'Beijing|CN': 'Pequim', 'Tokyo|JP': 'Tóquio', 'Seoul|KR': 'Seul',
  'Jerusalem|IL': 'Jerusalém', 'Mexico City|MX': 'Cidade do México', 'Panama City|PA': 'Cidade do Panamá',
  'Asuncion|PY': 'Assunção', 'Marseille|FR': 'Marselha', 'Sevilla|ES': 'Sevilha', 'Edinburgh|GB': 'Edimburgo',
  'The Hague|NL': 'Haia', 'Bucharest|RO': 'Bucareste', 'Belgrade|RS': 'Belgrado', 'Kyiv|UA': 'Kiev',
  'Luanda|AO': 'Luanda', 'Maputo|MZ': 'Maputo', 'Damascus|SY': 'Damasco', 'Baghdad|IQ': 'Bagdá',
  'Tehran|IR': 'Teerã', 'Cairo|EG': 'Cairo', 'Havana|CU': 'Havana', 'Hanoi|VN': 'Hanói',
};

const paises = {};
const nomePais = new Intl.DisplayNames(['pt-BR'], { type: 'region' });
for (const l of readFileSync(path.join(fonte, 'countryInfo.txt'), 'utf8').split('\n')) {
  if (!l || l.startsWith('#')) continue;
  const c = l.split('\t');
  let n = c[4];
  try { n = nomePais.of(c[0]) || n; } catch { /* mantem ingles */ }
  paises[c[0]] = n;
}
const admin1 = {};
for (const l of readFileSync(path.join(fonte, 'admin1CodesASCII.txt'), 'utf8').split('\n')) {
  const c = l.split('\t');
  if (c[0]) admin1[c[0]] = c[1];
}

const linhas = (arq) => readFileSync(path.join(fonte, arq), 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t'));
const escolhidos = new Map();
for (const c of linhas('cities15000.txt')) if (Number(c[14]) >= MIN_POP) escolhidos.set(c[0], c);
for (const c of linhas('cities1000.txt')) if (c[8] === 'BR' && Number(c[14]) >= BR_MIN_POP) escolhidos.set(c[0], c);

const fusos = [];
const idxFuso = (tz) => {
  let i = fusos.indexOf(tz);
  if (i < 0) { fusos.push(tz); i = fusos.length - 1; }
  return i;
};
const shards = {};
const chaveShard = (k) => (/^[a-z]/.test(k[0] || '') ? k[0] : '_');
const usadosExonimos = new Set();
let nLinhas = 0;
for (const c of escolhidos.values()) {
  const [, nome, ascii, , lat, lon, , , pais, , a1, , , , pop, , , tz] = c;
  if (!tz) continue;
  const adm = pais === 'BR' ? UF[admin1[`BR.${a1}`]] || '' : admin1[`${pais}.${a1}`] || '';
  const base = [nome, adm, pais, Math.round(Number(lat) * 1e4) / 1e4, Math.round(Number(lon) * 1e4) / 1e4, idxFuso(tz), Number(pop)];
  const k = normalizar(nome);
  (shards[chaveShard(k)] ??= []).push(base);
  nLinhas++;
  const exo = EXONIMOS_PT[`${ascii}|${pais}`];
  if (exo) {
    usadosExonimos.add(`${ascii}|${pais}`);
    const ka = normalizar(exo);
    if (ka !== k) { (shards[chaveShard(ka)] ??= []).push([...base, ka]); nLinhas++; }
  }
}
for (const k of Object.keys(EXONIMOS_PT)) if (!usadosExonimos.has(k)) console.warn('exonimo sem correspondencia no GeoNames:', k);

rmSync(SAIDA, { recursive: true, force: true });
mkdirSync(SAIDA, { recursive: true });
const indice = {
  versao: 1,
  fonte: 'GeoNames (https://www.geonames.org)',
  licenca: 'Creative Commons Atribuição 4.0 (https://creativecommons.org/licenses/by/4.0/)',
  atribuicao: 'Dados de lugares: GeoNames (geonames.org), licença CC BY 4.0.',
  populacaoMinima: { mundo: MIN_POP, brasil: BR_MIN_POP },
  linha: ['nome', 'admin', 'pais', 'lat', 'lon', 'fuso', 'populacao', 'chaveAlternativa?'],
  fusos,
  paises: Object.fromEntries(Object.entries(paises).filter(([k]) => Object.values(shards).some((s) => s.some((r) => r[2] === k)))),
  shards: {},
};
for (const [k, rows] of Object.entries(shards).sort()) {
  rows.sort((x, y) => y[6] - x[6] || x[0].localeCompare(y[0]));
  const arq = `${k === '_' ? 'outros' : k}.json`;
  writeFileSync(path.join(SAIDA, arq), JSON.stringify(rows));
  indice.shards[k] = { arquivo: arq, n: rows.length };
}
writeFileSync(path.join(SAIDA, 'indice.json'), JSON.stringify(indice));
console.log(`${nLinhas} linhas (${escolhidos.size} lugares) em ${readdirSync(SAIDA).length} arquivos, saida: ${SAIDA}`);
