/** Glifos (traco fino, viewBox 24) e icones de traco do Perfil e do Mapa astral. Sem fonte, sem Unicode que vire emoji. */
const G = {
      aries: '<path d="M12 20V10M12 10C12 5 8 4 6.5 6S7 10 8.5 9.5M12 10C12 5 16 4 17.5 6S17 10 15.5 9.5"/>',
      touro: '<circle cx="12" cy="15.2" r="5"/><path d="M5.5 4.5C5.5 9.5 8.5 10.2 12 10.2S18.5 9.5 18.5 4.5"/>',
      gemeos: '<path d="M8.2 6.5V17.5M15.8 6.5V17.5M4.8 4.8C9 7.4 15 7.4 19.2 4.8M4.8 19.2C9 16.6 15 16.6 19.2 19.2"/>',
      cancer: '<circle cx="7.6" cy="10.4" r="2.4"/><circle cx="16.4" cy="13.6" r="2.4"/><path d="M10 10.4C10.4 7 14 6 19.2 8.4M14 13.6C13.6 17 10 18 4.8 15.6"/>',
      leao: '<circle cx="8" cy="14.6" r="3.2"/><path d="M11 13.5C11.2 8 12 5 15 5C18.3 5 18.5 9.5 16 12C14 14 15.6 18 18.6 19"/>',
      virgem: '<path d="M4 6V17M4 8.2C4 5 9 5 9 8.2V17M9 8.2C9 5 14 5 14 8.2V15C14 18.6 17 20 19 17.6C20.6 15.4 18.4 12.6 14.2 16.4"/>',
      libra: '<path d="M4 18.6H20M4 14.4H8.6C6 12.6 6 6 12 6S18 12.6 15.4 14.4H20"/>',
      escorpiao: '<path d="M4 6V17M4 8.2C4 5 9 5 9 8.2V17M9 8.2C9 5 14 5 14 8.2V16.6C14 19.2 17 19.6 19.6 17.4M19.6 17.4L16.8 17.6M19.6 17.4L19.4 14.6"/>',
      sagitario: '<path d="M5 19L19 5M10.4 5H19V13.6M7.4 11.6L12.4 16.6"/>',
      capricornio: '<path d="M4 5C5 9 6 13 8 17L10.2 9C10.8 7 13 6.6 13 10V16C13 19 15 20.4 17 20.4C20 20.4 20.6 15 17 14.6C15.2 14.4 14 16 15.2 17.6"/>',
      aquario: '<path d="M3.5 10.2L7 7L10.5 10.2L14 7L17.5 10.2L21 7M3.5 17L7 13.8L10.5 17L14 13.8L17.5 17L21 13.8"/>',
      peixes: '<path d="M6 4C10.2 8 10.2 16 6 20M18 4C13.8 8 13.8 16 18 20M4 12H20"/>',
      sol: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
      lua: '<path d="M15.5 4C9.5 4.8 6.5 8.4 6.5 12C6.5 15.6 9.5 19.2 15.5 20C11.8 17.6 11 14.4 11 12C11 9.6 11.8 6.4 15.5 4Z"/>',
      mercurio: '<circle cx="12" cy="10.6" r="4"/><path d="M8.4 4.6C8.8 7 15.2 7 15.6 4.6M12 14.6V21M9 18H15"/>',
      venus: '<circle cx="12" cy="9" r="5"/><path d="M12 14V21M8.6 18H15.4"/>',
      marte: '<circle cx="10" cy="14" r="5"/><path d="M13.6 10.4L19.4 4.6M14 4.6H19.4V10"/>',
      jupiter: '<path d="M6.4 8C8 4 13 5 12 9.4C11.4 12 7 14 5 14H19.5M16 6V20"/>',
      saturno: '<path d="M8 3.6V12M5.4 6.4H10.6M8 9C13 7 16 10.6 16 14C16 17.4 13.4 19 11 17.4"/>',
      urano: '<path d="M7 4V14M17 4V14M7 9.2H17M12 4V16.6"/><circle cx="12" cy="19" r="2.2"/>',
      netuno: '<path d="M5 4C5 10.4 8 12 12 12S19 10.4 19 4M12 4V21M8.2 17.4H15.8"/>',
      plutao: '<path d="M7 4.8C7 11 17 11 17 4.8"/><circle cx="12" cy="6.4" r="2"/><path d="M12 11V21M8.6 17.4H15.4"/>',
      nodo: '<path d="M7.4 16.6C6.6 5 17.4 5 16.6 16.6"/><circle cx="6.4" cy="17.8" r="1.8"/><circle cx="17.6" cy="17.8" r="1.8"/>',
      retro: '<path d="M6 20V5M6 5H12C16 5 16 11 12 11H6M11.6 11L17 20M13.8 15L19 14.2"/>',
      asc: '<path d="M4 17H20M12 17V5M8 9L12 5L16 9"/>',
      mc: '<path d="M4 7H20M12 7V19M8 15L12 19L16 15"/>'
    };

const IC = {
    home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/>',
    cartas: '<rect x="4" y="3.5" width="10" height="15" rx="1.5"/><path d="M17 7.5l3 .8-3.6 11.7-5.4-1.5"/>',
    leitura: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    diario: '<path d="M6.5 3.5h10.5A1.5 1.5 0 0118.5 5v14a1.5 1.5 0 01-1.5 1.5H6.5z"/><path d="M6.5 3.5v17M10.5 8.5h4.5M10.5 12h4.5"/>',
    perfil: '<circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20c.6-3.8 3.4-6 7.2-6s6.6 2.2 7.2 6"/>',
    guia: '<path d="M5 4.5h11a3 3 0 013 3V20H8a3 3 0 01-3-3V4.5z"/><path d="M5 17a3 3 0 013-3h11M9.5 8.5h5"/>',
    tema: '<path d="M12 3.5a8.5 8.5 0 100 17c1.3 0 2-.8 2-1.8 0-1.5-1.3-1.7-1.3-3 0-1 .8-1.7 1.8-1.7H17a3.5 3.5 0 003.5-3.5C20.5 6.7 16.7 3.5 12 3.5z"/><circle cx="7.8" cy="11" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="14.8" cy="7.8" r="1"/>',
    nuvem: '<path d="M7 18h9.6a3.9 3.9 0 00.7-7.7 5.5 5.5 0 00-10.5 1.4A3.2 3.2 0 007 18z"/>',
    cadeado: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5"/>',
    mais: '<path d="M12 5v14M5 12h14"/>',
    lupa: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    pino: '<path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 10-13 0c0 5.4 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
    seta: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    voltar: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    copiar: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6A1.5 1.5 0 0014 4.5H6A1.5 1.5 0 004.5 6v8A1.5 1.5 0 006 15.5h2.5"/>',
    compartilhar: '<circle cx="6.5" cy="12" r="2.4"/><circle cx="17.5" cy="6" r="2.4"/><circle cx="17.5" cy="18" r="2.4"/><path d="M8.6 10.8l6.8-3.6M8.6 13.2l6.8 3.6"/>',
    baixar: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.2"/>',
    alerta: '<path d="M12 4.2L21 19.5H3L12 4.2z"/><path d="M12 10v4.5M12 17v.2"/>',
    ok: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.7 2.7L16.2 9.5"/>',
    erro: '<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/>',
    relogio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    editar: '<path d="M5 19l1-4L16.5 4.5a2 2 0 013 3L9 18z"/><path d="M14.5 6.5l3 3"/>',
    lixo: '<path d="M5 7h14M9.5 7V5h5v2M7 7l.8 12.5h8.4L17 7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    lista: '<path d="M8.5 7H20M8.5 12H20M8.5 17H20"/><circle cx="4.6" cy="7" r=".8"/><circle cx="4.6" cy="12" r=".8"/><circle cx="4.6" cy="17" r=".8"/>',
    roda: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M12 3.5V9M12 15v5.5M3.5 12H9M15 12h5.5"/>',
    guardar: '<path d="M7 4h10a1 1 0 011 1v15l-6-4-6 4V5a1 1 0 011-1z"/>',
    maisv: '<circle cx="12" cy="5.5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="18.5" r="1.3"/>',
    trocar: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
    subir: '<path d="M5 15l7-7 7 7"/>',
    descer: '<path d="M5 9l7 7 7-7"/>',
    baralho: '<rect x="3.5" y="6" width="9" height="13" rx="1.5"/><rect x="7.5" y="4" width="9" height="13" rx="1.5"/><rect x="11.5" y="6" width="9" height="13" rx="1.5"/>',
    biscoito: '<path d="M3.5 14c0-5.2 3.8-8.2 8.5-8.2s8.5 3 8.5 8.2c0 1.9-1.6 3-3.3 2.5-2.2-.6-3.5-2.2-5.2-2.2s-3 1.6-5.2 2.2c-1.7.5-3.3-.6-3.3-2.5z"/><path d="M12 14.3c-.2-2.6-1.9-4.6-4.8-5.4M12 14.3c.2-2.6 1.9-4.6 4.8-5.4"/>',
    estrela: '<path d="M12 3.5l2.2 6.3 6.3 2.2-6.3 2.2L12 20.5l-2.2-6.3L3.5 12l6.3-2.2z"/>'
  };

export const gl = (k, cls = '') => `<svg class="gl ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${G[k] || ''}</svg>`;
export const ic = (k, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${IC[k] || ''}</svg>`;

/** Tracos internos de um glifo (viewBox 24), para montar SVG proprio (roda e cartoes). */
export const glifoTracos = (k) => G[k] || '';
export const GLIFOS = Object.keys(G);
