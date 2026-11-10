/**
 * Motor de mapa astral (puro, sem DOM). Importe sob demanda: import('./astro/index.js').
 */
export { calcularMapa } from './mapa.js';
export { posicaoZodiacal, regenteDoDecano, indexarCartas, ponteDaLongitude, parseFaixaCorte } from './zodiaco.js';
export { resolverHoraLocal } from './tempo.js';
export { calcularAspectos } from './aspectos.js';
export { SIGNOS, CORPOS, ASPECTOS, ORBES_PADRAO, SISTEMAS_CASAS } from './constantes.js';
export { buscarLocais, criarBuscador, normalizarBusca, ATRIBUICAO_LOCAIS } from './locais.js';
