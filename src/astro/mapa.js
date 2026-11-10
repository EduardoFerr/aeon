import { CORPOS, ORBES_PADRAO, PROCEDENCIA, SISTEMAS_CASAS, NOMES_PONTOS, SIGNOS } from './constantes.js';
import { posicaoZodiacal, indexarCartas, ponteDaLongitude, cartaDoPlaneta, norm360, difAngular } from './zodiaco.js';
import { parseData, parseHora, paredeMs, resolverHoraLocal, erro } from './tempo.js';
import { calcularCorpos, nodoNorteMedio, velocidadeNodoMedio, longitudeCorpo } from './corpos.js';
import { calcularAngulos, calcularCasas, casaDaLongitude } from './casas.js';
import { calcularAspectos } from './aspectos.js';

const HORA_MS = 3600e3;

function validarLocal(local) {
  const { lat, lon, tz } = local || {};
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) throw erro('local_invalido', 'Latitude inválida (de -90 a 90).');
  if (typeof lon !== 'number' || !Number.isFinite(lon) || lon < -180 || lon > 180) throw erro('local_invalido', 'Longitude inválida (de -180 a 180, leste positivo).');
  if (typeof tz !== 'string' || !tz) throw erro('local_invalido', 'Fuso horário (IANA) ausente.');
  return { lat, lon, tz };
}

function ponto(id, lon, extra = {}) {
  const p = posicaoZodiacal(lon);
  return {
    id,
    nome: NOMES_PONTOS[id],
    lon: p.lon,
    signo: p.signo,
    signoNome: p.signoNome,
    grau: p.grau,
    grauInteiro: p.grauInteiro,
    minuto: p.minuto,
    decano: p.decano,
    regenteDecano: p.regenteDecano,
    ...extra,
  };
}

function resumoPonto(p) {
  return { lon: p.lon, signo: p.signo, signoNome: p.signoNome, grauInteiro: p.grauInteiro, minuto: p.minuto };
}

/** Posicoes dos pontos que dependem do instante (sem casas), para resumos de alternativas. */
function resumoInstante(utcMs, local, hora) {
  const d = new Date(utcMs);
  const r = {
    sol: resumoPonto(ponto('sol', longitudeCorpo('Sun', d))),
    lua: resumoPonto(ponto('lua', longitudeCorpo('Moon', d))),
  };
  if (hora) {
    const a = calcularAngulos(d, local.lat, local.lon);
    r.asc = resumoPonto(ponto('asc', a.asc));
    r.mc = resumoPonto(ponto('mc', a.mc));
  }
  return r;
}

/** Faixa de variacao ao longo do dia local (00:00 a 24:00), para o modo sem hora. */
function faixaDoDia(dataObj, tz, lonDe) {
  const ini = resolverHoraLocal(paredeMs(dataObj), tz).opcoes[0].utcMs;
  const proximo = new Date(paredeMs(dataObj) + 24 * HORA_MS);
  const dataSeguinte = { ano: proximo.getUTCFullYear(), mes: proximo.getUTCMonth() + 1, dia: proximo.getUTCDate() };
  const fim = resolverHoraLocal(paredeMs(dataSeguinte), tz).opcoes[0].utcMs;
  const passos = 24;
  const lons = [];
  for (let i = 0; i <= passos; i++) lons.push(lonDe(new Date(ini + ((fim - ini) * i) / passos)));
  let acum = lons[0];
  let min = acum;
  let max = acum;
  for (let i = 1; i < lons.length; i++) {
    acum += difAngular(lons[i], lons[i - 1]);
    min = Math.min(min, acum);
    max = Math.max(max, acum);
  }
  const signos = [];
  for (let v = Math.floor(min / 30); v <= Math.floor(max / 30); v++) {
    signos.push(SIGNOS[((v % 12) + 12) % 12].nome);
  }
  return {
    de: norm360(lons[0]),
    ate: norm360(lons[lons.length - 1]),
    minimo: norm360(min),
    maximo: norm360(max),
    amplitude: max - min,
    signos,
    mudaDeSigno: signos.length > 1,
  };
}

function contagem(pontos) {
  const elementos = { Fogo: 0, Terra: 0, Ar: 0, Água: 0 };
  const modalidades = { Cardinal: 0, Fixo: 0, Mutável: 0 };
  for (const p of pontos) {
    const s = SIGNOS.find((x) => x.id === p.signo);
    elementos[s.elemento]++;
    modalidades[s.modalidade]++;
  }
  return { elementos, modalidades };
}

/**
 * Calcula um mapa natal.
 *
 * @param {object} entrada
 * @param {string} entrada.data "AAAA-MM-DD" (data local de nascimento)
 * @param {string|null} entrada.hora "HH:MM" local, ou null quando a pessoa nao sabe a hora
 * @param {{lat:number, lon:number, tz:string}} entrada.local lat norte+, lon leste+, tz id IANA
 * @param {'placidus'|'signos-inteiros'|'igual'} [entrada.casas='placidus']
 * @param {object} [entrada.orbes] orbes por aspecto (graus)
 * @param {Array} [entrada.cartas] conteudo de public/data/cards.json; quando presente, cada ponto traz a ponte com o tarot
 * @param {number} [entrada.escolhaHora=0] indice da possibilidade quando a hora local e ambigua ou inexistente
 * @param {{nodos?:boolean}} [entrada.aspectos] nodos: inclui o Nodo Norte nos aspectos
 * @returns {object} JSON serializavel
 */
export function calcularMapa(entrada) {
  const { data, hora = null, casas: sistemaPedido = 'placidus', orbes = {}, cartas = null, escolhaHora = 0 } = entrada || {};
  const local = validarLocal(entrada && entrada.local);
  if (!SISTEMAS_CASAS.includes(sistemaPedido)) throw erro('casas_invalidas', `Sistema de casas desconhecido: ${sistemaPedido}`);
  const dataObj = parseData(data);
  const semHora = hora === null || hora === undefined || hora === '';
  const horaObj = semHora ? { h: 12, mi: 0, s: 0 } : parseHora(hora);

  const avisos = [];
  const res = resolverHoraLocal(paredeMs(dataObj, horaObj), local.tz);
  const escolha = Math.min(Math.max(Number.isInteger(escolhaHora) ? escolhaHora : 0, 0), res.opcoes.length - 1);
  const opcao = res.opcoes[escolha];
  const instante = new Date(opcao.utcMs);

  const hora_ = {
    estado: res.estado,
    escolhida: escolha,
    opcoes: res.opcoes.map((o) => ({
      utc: o.utc,
      deslocamento: o.deslocamento,
      deslocamentoSeg: o.deslocamentoSeg,
      resumo: res.estado === 'normal' ? undefined : resumoInstante(o.utcMs, local, !semHora),
    })),
  };
  if (res.estado === 'normal') hora_.opcoes.forEach((o) => delete o.resumo);

  if (res.estado === 'ambigua') {
    avisos.push({ codigo: 'hora_ambigua', nivel: 'atencao', mensagem: 'Nesta data o relógio foi atrasado e essa hora aconteceu duas vezes (com e sem horário de verão). O mapa muda conforme a escolha; confira na certidão ou pergunte a quem estava lá.' });
  } else if (res.estado === 'inexistente') {
    avisos.push({ codigo: 'hora_inexistente', nivel: 'atencao', mensagem: 'Nesta data o relógio foi adiantado e essa hora não existiu. Provavelmente a hora anotada usa o relógio de antes ou de depois da virada; o mapa muda conforme a escolha.' });
  }

  // Corpos
  const corpos = calcularCorpos(instante);
  const nodoLon = nodoNorteMedio(instante);
  const nodoVel = velocidadeNodoMedio(instante);

  // Angulos e casas
  let angulos = null;
  let casasInfo = null;
  if (!semHora) {
    angulos = calcularAngulos(instante, local.lat, local.lon);
    casasInfo = calcularCasas(angulos, local.lat, sistemaPedido);
    for (const a of casasInfo.avisos) avisos.push({ ...a, nivel: 'atencao' });
  } else {
    avisos.push({ codigo: 'sem_hora', nivel: 'info', mensagem: 'Sem a hora de nascimento não há Ascendente, Meio do Céu nem casas. Os planetas foram calculados para o meio-dia local; a Lua anda cerca de 13 graus por dia e pode estar em outro signo.' });
  }

  const idxCartas = cartas ? indexarCartas(cartas) : null;
  const decora = (p) => {
    if (!semHora && casasInfo && p.id !== 'asc' && p.id !== 'mc') p.casa = casaDaLongitude(casasInfo.cuspides, p.lon);
    if (idxCartas) {
      p.ponte = ponteDaLongitude(idxCartas, p.lon);
      if (CORPOS.some((c) => c.id === p.id)) p.cartaPlaneta = cartaDoPlaneta(idxCartas, p.nome);
    }
    return p;
  };

  const pontos = {};
  for (const c of CORPOS) {
    const b = corpos[c.id];
    const p = ponto(c.id, b.lon, { velocidade: b.velocidade, retrogrado: b.retrogrado });
    if (semHora) {
      const e = c.engine;
      p.faixaDia = faixaDoDia(dataObj, local.tz, (d) => longitudeCorpo(e, d));
    }
    pontos[c.id] = decora(p);
  }
  pontos.nodo_norte = decora(ponto('nodo_norte', nodoLon, { velocidade: nodoVel, retrogrado: null }));
  pontos.nodo_sul = decora(ponto('nodo_sul', nodoLon + 180, { velocidade: nodoVel, retrogrado: null }));
  if (semHora) {
    pontos.nodo_norte.faixaDia = faixaDoDia(dataObj, local.tz, nodoNorteMedio);
    pontos.nodo_sul.faixaDia = { ...pontos.nodo_norte.faixaDia };
  }
  if (!semHora) {
    // velocidade dos angulos (graus/dia) para distinguir aplicativo de separativo
    const antes = calcularAngulos(new Date(instante.getTime() - HORA_MS / 2), local.lat, local.lon);
    const depois = calcularAngulos(new Date(instante.getTime() + HORA_MS / 2), local.lat, local.lon);
    pontos.asc = decora(ponto('asc', angulos.asc, { velocidade: difAngular(depois.asc, antes.asc) * 24 }));
    pontos.mc = decora(ponto('mc', angulos.mc, { velocidade: difAngular(depois.mc, antes.mc) * 24 }));
  }

  // Aspectos (sem hora, a Lua fica de fora: a incerteza dela e maior que qualquer orbe)
  const idsAspectos = CORPOS.map((c) => c.id).filter((id) => !(semHora && id === 'lua'));
  if (entrada.aspectos && entrada.aspectos.nodos) idsAspectos.push('nodo_norte');
  if (!semHora) idsAspectos.push('asc', 'mc');
  const aspectos = calcularAspectos(idsAspectos.map((id) => ({ id, lon: pontos[id].lon, velocidade: pontos[id].velocidade })), orbes);
  if (semHora) avisos.push({ codigo: 'aspectos_sem_lua', nivel: 'info', mensagem: 'Sem a hora, os aspectos da Lua não são calculados.' });

  const base = CORPOS.map((c) => pontos[c.id]).concat(semHora ? [] : [pontos.asc]);
  const resumo = { ...contagem(base), base: base.map((p) => p.id) };

  return {
    versao: 1,
    entrada: { data, hora: semHora ? null : hora, local: { ...local }, casas: sistemaPedido, escolhaHora: escolha },
    hora: hora_,
    instanteUtc: opcao.utc,
    semHora,
    pontos,
    casas: casasInfo
      ? {
          sistema: casasInfo.sistema,
          solicitado: casasInfo.solicitado,
          cuspides: casasInfo.cuspides.map((lon, i) => {
            const p = posicaoZodiacal(lon);
            return { casa: i + 1, lon: p.lon, signo: p.signo, signoNome: p.signoNome, grauInteiro: p.grauInteiro, minuto: p.minuto };
          }),
        }
      : null,
    aspectos,
    orbes: { ...ORBES_PADRAO, ...orbes },
    resumo,
    avisos,
    procedencia: { ...PROCEDENCIA },
  };
}
