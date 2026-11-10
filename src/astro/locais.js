/**
 * Busca de lugares na base local (GeoNames, CC BY 4.0), carregada sob demanda e sem rede externa.
 * Gerada por tools/gerar-locais.mjs em public/data/locais/: um indice.json (~11 KB) e um arquivo por
 * letra inicial; so o arquivo da letra digitada e baixado.
 *
 * A busca ignora acento e caixa e casa pelo INICIO do nome (ou do nome em portugues, para as cidades
 * mais buscadas). Nao ha busca por meio de nome: "janeiro" nao acha "Rio de Janeiro".
 */
export const ATRIBUICAO_LOCAIS = 'Dados de lugares: GeoNames (geonames.org), licença Creative Commons Atribuição 4.0.';

/** Minusculo, sem acento, so letras e numeros separados por um espaco. */
export function normalizarBusca(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const BASE_PADRAO = '/data/locais/';

function carregarPorFetch(base) {
  return async (arquivo) => {
    const r = await fetch(base + arquivo);
    if (!r.ok) throw new Error(`Não foi possível carregar ${arquivo} (${r.status}).`);
    return r.json();
  };
}

/**
 * Cria um buscador.
 * @param {(arquivo:string)=>Promise<any>} carregar devolve o JSON do arquivo (ex.: "indice.json", "s.json")
 */
export function criarBuscador(carregar) {
  const cache = new Map();
  const pega = (arq) => {
    if (!cache.has(arq)) {
      const p = Promise.resolve(carregar(arq)).catch((e) => {
        cache.delete(arq); // permite tentar de novo
        throw e;
      });
      cache.set(arq, p);
    }
    return cache.get(arq);
  };
  const chaves = new WeakMap();

  /**
   * @returns {Promise<Array<{nome:string, admin:string, pais:string, paisNome:string, lat:number, lon:number, tz:string, populacao:number, rotulo:string}>>}
   */
  async function buscar(texto, { limite = 8 } = {}) {
    const q = normalizarBusca(texto || '');
    if (q.length < 2) return [];
    const indice = await pega('indice.json');
    const inicial = /^[a-z]/.test(q[0]) ? q[0] : '_';
    const info = indice.shards[inicial];
    if (!info) return [];
    const linhas = await pega(info.arquivo);
    let ks = chaves.get(linhas);
    if (!ks) {
      ks = linhas.map((l) => l[7] || normalizarBusca(l[0]));
      chaves.set(linhas, ks);
    }
    const achados = [];
    const vistos = new Set();
    for (let i = 0; i < linhas.length; i++) {
      if (!ks[i].startsWith(q)) continue;
      const l = linhas[i];
      const id = `${l[0]}|${l[3]}|${l[4]}`;
      if (vistos.has(id)) continue;
      vistos.add(id);
      achados.push({ l, exato: ks[i] === q });
    }
    achados.sort((a, b) => (b.exato - a.exato) || (b.l[6] - a.l[6]));
    return achados.slice(0, limite).map(({ l }) => {
      const paisNome = indice.paises[l[2]] || l[2];
      return {
        nome: l[0],
        admin: l[1],
        pais: l[2],
        paisNome,
        lat: l[3],
        lon: l[4],
        tz: indice.fusos[l[5]],
        populacao: l[6],
        rotulo: [l[0], l[1], paisNome].filter(Boolean).join(', '),
      };
    });
  }
  return { buscar, atribuicao: ATRIBUICAO_LOCAIS };
}

let padrao = null;
/** Busca usando fetch em /data/locais/ (navegador). */
export function buscarLocais(texto, opcoes) {
  padrao ??= criarBuscador(carregarPorFetch(BASE_PADRAO));
  return padrao.buscar(texto, opcoes);
}
