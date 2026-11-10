/**
 * Constantes do motor de mapa astral. Modulo puro (sem DOM, sem rede).
 * Longitudes sao eclipticas, em graus, de 0 (0 Aries) a 360, medidas para leste.
 */

export const SIGNOS = [
  { id: 'aries', nome: 'Áries', elemento: 'Fogo', modalidade: 'Cardinal' },
  { id: 'touro', nome: 'Touro', elemento: 'Terra', modalidade: 'Fixo' },
  { id: 'gemeos', nome: 'Gêmeos', elemento: 'Ar', modalidade: 'Mutável' },
  { id: 'cancer', nome: 'Câncer', elemento: 'Água', modalidade: 'Cardinal' },
  { id: 'leao', nome: 'Leão', elemento: 'Fogo', modalidade: 'Fixo' },
  { id: 'virgem', nome: 'Virgem', elemento: 'Terra', modalidade: 'Mutável' },
  { id: 'libra', nome: 'Libra', elemento: 'Ar', modalidade: 'Cardinal' },
  { id: 'escorpiao', nome: 'Escorpião', elemento: 'Água', modalidade: 'Fixo' },
  { id: 'sagitario', nome: 'Sagitário', elemento: 'Fogo', modalidade: 'Mutável' },
  { id: 'capricornio', nome: 'Capricórnio', elemento: 'Terra', modalidade: 'Cardinal' },
  { id: 'aquario', nome: 'Aquário', elemento: 'Ar', modalidade: 'Fixo' },
  { id: 'peixes', nome: 'Peixes', elemento: 'Água', modalidade: 'Mutável' },
];

/** Corpos calculados pelo astronomy-engine (ids estaveis, usados tambem no horizons.json). */
export const CORPOS = [
  { id: 'sol', nome: 'Sol', engine: 'Sun' },
  { id: 'lua', nome: 'Lua', engine: 'Moon' },
  { id: 'mercurio', nome: 'Mercúrio', engine: 'Mercury' },
  { id: 'venus', nome: 'Vênus', engine: 'Venus' },
  { id: 'marte', nome: 'Marte', engine: 'Mars' },
  { id: 'jupiter', nome: 'Júpiter', engine: 'Jupiter' },
  { id: 'saturno', nome: 'Saturno', engine: 'Saturn' },
  { id: 'urano', nome: 'Urano', engine: 'Uranus' },
  { id: 'netuno', nome: 'Netuno', engine: 'Neptune' },
  { id: 'plutao', nome: 'Plutão', engine: 'Pluto' },
];

export const NOMES_PONTOS = {
  ...Object.fromEntries(CORPOS.map((c) => [c.id, c.nome])),
  nodo_norte: 'Nodo Norte',
  nodo_sul: 'Nodo Sul',
  asc: 'Ascendente',
  mc: 'Meio do Céu',
};

/** Ordem caldeia (da orbita mais lenta a mais rapida), comecando por Marte em Aries 0-10. */
export const ORDEM_CALDEIA = ['Marte', 'Sol', 'Vênus', 'Mercúrio', 'Lua', 'Saturno', 'Júpiter'];

export const SISTEMAS_CASAS = ['placidus', 'signos-inteiros', 'igual'];

/** Acima desta latitude absoluta o Placidus nao e usado (nao existe perto dos circulos polares). */
export const LATITUDE_LIMITE_PLACIDUS = 66;

export const ASPECTOS = [
  { id: 'conjuncao', nome: 'Conjunção', angulo: 0 },
  { id: 'sextil', nome: 'Sextil', angulo: 60 },
  { id: 'quadratura', nome: 'Quadratura', angulo: 90 },
  { id: 'trigono', nome: 'Trígono', angulo: 120 },
  { id: 'oposicao', nome: 'Oposição', angulo: 180 },
];

/** Orbes padrao (graus), configuraveis em calcularMapa({ orbes }). */
export const ORBES_PADRAO = { conjuncao: 8, sextil: 5, quadratura: 7, trigono: 7, oposicao: 8 };

export const ANO_MINIMO = 1800;
export const ANO_MAXIMO = 2100;

export const PROCEDENCIA = {
  corpos: 'astronomy-engine 2.1 (licença MIT): posição aparente geocêntrica, eclíptica verdadeira da data. Erro máximo medido contra o NASA/JPL Horizons: 0,01 grau.',
  nodos: 'Nodo médio da Lua, fórmula polinomial de Meeus (Astronomical Algorithms, 2ª ed., cap. 47, eq. 47.7). O Nodo Sul é o ponto oposto.',
  angulos: 'Ascendente e Meio do Céu pela fórmula padrão com o tempo sideral aparente (astronomy-engine) e a obliquidade verdadeira.',
  casas: 'Placidus por semiarcos (iteração numérica); Signos Inteiros e Igual a partir do Ascendente.',
  fuso: 'Banco IANA do próprio navegador, via Intl.DateTimeFormat. Antes da adoção dos fusos legais o deslocamento é a hora solar local.',
  zodiaco: 'Zodíaco tropical. Decanos pela ordem caldeia a partir de Marte em Áries; cartas conforme public/data/cards.json.',
};
