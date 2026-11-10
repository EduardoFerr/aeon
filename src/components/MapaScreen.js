import { navigateTo, consumirEstado } from '../utils/navigation.js';
import { gl, ic } from '../utils/glifos.js';
import { loadCards } from '../utils/cardsUtil.js';
import { obter, principal, adicionar, apelido, persiste, definirPreferencias } from '../utils/perfil.js';
import { criarMapa } from '../utils/diario.js';
import { carregarTextos, texto, esc, calcular, dataExtenso, grauTexto, casaDa, marcadoresHora, atribuicaoGeoNames, SIGNO_ELEMENTO } from '../utils/mapaComum.js';
import { montarLeitura, textoDaSecao } from '../utils/leituraMapa.js';
import { rodaSVG } from '../utils/roda.js';
import { carregarGlossario, linkarTermos } from '../utils/glossario.js';
import { abrirGlossario } from './GlossarioModal.js';
import('./TarotCardInfo.js');

/**
 * Resultado do mapa (roda do zodiaco acessivel + tabela) e leitura por secao, com compartilhar
 * (copiar, compartilhar texto, baixar cartao PNG) e guardar no perfil e no diario.
 * Todo o estado fica em memoria: dados de nascimento nunca vao para URL, hash, query, console nem analytics.
 */
const T = {
    titulo: 'Seu mapa',
    leitura: 'Leitura do mapa',
    eyebrow: 'Mapa astral',
    ler: 'Ler o meu mapa',
    guardarPerfil: 'Guardar no perfil',
    descartar: 'Descartar',
    novoTitulo: 'Mapa ainda não guardado',
    novoTexto: 'Confira o resultado. Ele só entra no perfil se você tocar em Guardar no perfil.',
    escolhaGravada: 'Leitura guardada neste mapa.',
    guardado: 'Guardado, ver no perfil',
    guardadoTitulo: 'Mapa guardado no perfil',
    guardadoTexto: 'Ele ficou só neste aparelho. Para levar a outro, use Exportar tudo no perfil.',
    repetidoTitulo: 'Esse mapa já estava guardado',
    repetidoTexto: 'Mesma data, hora e lugar: o mapa existente foi mantido, sem duplicar.',
    semHoraTitulo: 'Mapa sem hora de nascimento',
    latAltaTitulo: 'Local em latitude alta',
    ambiguaTitulo: 'Essa hora aconteceu duas vezes',
    inexistenteTitulo: 'A hora informada não existiu',
    roda: 'Roda',
    lista: 'Ver em lista',
    verComo: 'Ver o mapa como',
    legenda: 'Legenda',
    posicoes: 'Posições no mapa',
    voltarPerfil: 'Voltar ao perfil',
    nesta: 'Nesta leitura',
    de: 'de',
    anterior: 'Anterior',
    proximo: 'Próximo',
    aoMapa: 'Ao mapa',
    fim: 'Fim',
    perfil: 'Perfil',
    compMapa: 'Compartilhar o mapa',
    compLeitura: 'Compartilhar esta leitura',
    copiar: 'Copiar texto',
    compartilhar: 'Compartilhar texto',
    cartao: 'Baixar cartão',
    ver: 'Ver o texto que será compartilhado',
    copiado: 'Texto copiado.',
    naoCopiou: 'Não foi possível copiar. Selecione o texto em Ver o texto que será compartilhado.',
    semShare: 'Este aparelho não abre o compartilhamento. Use Copiar texto.',
    cartaoOk: 'Cartão baixado.',
    cartaoFazendo: 'Preparando o cartão…',
    cartaoErro: 'Não foi possível montar o cartão agora.',
    diarioOk: 'Guardado no diário.',
    diarioErro: 'Não foi possível guardar no diário agora.',
    escolha: 'Leitura em exibição',
    mostrando: 'Mostrando a leitura de',
    abrir: 'Abrir a carta',
    corpo: 'Corpo',
};
const ORDEM_TAB = ['asc', 'mc', 'sol', 'lua', 'mercurio', 'venus', 'marte', 'jupiter', 'saturno', 'urano', 'netuno', 'plutao', 'nodo_norte'];
const GLIFO_DE = { nodo_norte: 'nodo' };
const LEGENDA = [
    ['r-opos', 'Oposição', 'tenso, linha cheia grossa'],
    ['r-quad', 'Quadratura', 'tenso, tracejada'],
    ['r-trig', 'Trígono', 'harmônico, linha fina cheia'],
    ['r-sext', 'Sextil', 'harmônico, pontilhada'],
];
const CORPOS_LEGENDA = [['sol', 'Sol'], ['lua', 'Lua'], ['mercurio', 'Mercúrio'], ['venus', 'Vênus'], ['marte', 'Marte'], ['jupiter', 'Júpiter'], ['saturno', 'Saturno'], ['urano', 'Urano'], ['netuno', 'Netuno'], ['plutao', 'Plutão'], ['nodo', 'Nodo Norte']];
const mapaDe = (txt) => String(txt).split(/\n{2,}/).filter((x) => x.trim());
const img = (order) => `assets/cards/crowley-${String(order).padStart(2, '0')}.jpg`;

export class MapaScreen extends HTMLElement {
    async connectedCallback() {
        const est = consumirEstado() || {};
        this.m = (est.id && obter(est.id)) || est.entrada || principal();
        this.salvo = !!(this.m && this.m.id);
        this.novo = !this.salvo;
        this.estadoAviso = est.aviso || null;
        this.view = est.secao ? 'leitura' : 'resultado';
        this.secaoId = est.secao || 'sol';
        this.vista = 'roda';
        this.incluir = false;
        this.status = '';
        const titulo = document.querySelector('#page-title');
        if (titulo) titulo.textContent = T.titulo;
        if (!this.m) {
            navigateTo('perfil');
            return;
        }
        this.innerHTML = '<div class="mapa-tela" aria-busy="true"></div>';
        this.addEventListener('click', (e) => this.clique(e));
        this.addEventListener('change', (e) => this.mudou(e));
        try {
            [this.textos] = await Promise.all([carregarTextos(), loadCards(), carregarGlossario()]);
            this.escolha = this.m.escolha || 0;
            await this.recalcular();
        } catch (e) {
            this.calc = null;
            this.textos = this.textos || {};
        }
        if (!this.isConnected) return;
        this.desenhar();
    }

    disconnectedCallback() {
        const t = document.querySelector('.page-title');
        if (t) t.classList.remove('sr');
    }

    t(id, vars, padrao) {
        return texto(this.textos, id, vars, padrao);
    }

    async recalcular() {
        this.calc = await calcular({ ...this.m, escolha: this.escolha });
        this.marc = this.calc.hora.estado !== 'normal' ? await marcadoresHora(this.calc, this.m.local.tz) : null;
        this.leit = montarLeitura(this.calc, this.textos);
    }

    secoes() {
        return this.leit.secoes;
    }

    nomeMapa() {
        const ap = apelido();
        return this.m.principal && ap ? ap : this.m.rotulo || '';
    }

    dadosLinha() {
        const m = this.m;
        return `${dataExtenso(m.data)}${m.hora ? `, ${m.hora}` : ''}, ${m.local.nome}`;
    }

    /* ---------- pecas ---------- */

    aviso(tipo, icone, titulo, corpo, extra = '') {
        return `<section class="aviso ${tipo}" role="${tipo === 'atencao' || tipo === 'erro' ? 'alert' : 'status'}">${ic(icone)}<h3>${esc(titulo)}</h3><div><p>${esc(corpo)}</p>${extra}</div></section>`;
    }

    avisosTopo() {
        const c = this.calc;
        let h = '';
        if (this.novo && !this.salvo) h += this.aviso('info', 'info', T.novoTitulo, T.novoTexto);
        if (this.estadoAviso === 'guardado') h += this.aviso('ok', 'ok', T.guardadoTitulo, T.guardadoTexto);
        if (this.estadoAviso === 'repetido') h += this.aviso('info', 'info', T.repetidoTitulo, T.repetidoTexto);
        if (c.semHora) h += this.aviso('atencao', 'relogio', T.semHoraTitulo, this.t('ui.aviso.semhora'));
        if (c.casas && c.casas.sistema === 'signos-inteiros' && c.casas.solicitado !== 'signos-inteiros') h += this.aviso('info', 'info', T.latAltaTitulo, this.t('ui.aviso.latalta'));
        if (this.marc) {
            const amb = c.hora.estado === 'ambigua';
            const nomes = [this.t('ui.hora.antes'), this.t('ui.hora.depois')];
            const corpo = this.t(amb ? 'ui.aviso.ambigua' : 'ui.aviso.inexistente', { hora1: this.marc.hora1, hora2: this.marc.hora2 });
            h += `<section class="aviso atencao" role="group" aria-labelledby="hora-t">${ic('relogio')}<h3 id="hora-t">${amb ? T.ambiguaTitulo : T.inexistenteTitulo}</h3><div><p>${esc(corpo)}</p>
                <fieldset class="campo" style="margin-top:8px"><legend class="rot-mini">${esc(this.t('ui.form.escolha-hora'))}</legend><div class="opcoes" role="radiogroup">
                ${this.marc.rotulos.map((r, i) => `<label class="opcao"><input type="radio" name="leitura-hora" value="${i}"${i === this.escolha ? ' checked' : ''}><span>${esc(r)}<small>${esc(nomes[i])}</small></span></label>`).join('')}</div></fieldset></div></section>`;
        }
        return h;
    }

    linhaTabela(id, destaque) {
        const c = this.calc;
        const p = c.pontos[id];
        if (!p) return '';
        const casa = id === 'asc' ? 1 : id === 'mc' ? casaDa(p.lon, c.casas && c.casas.cuspides) : p.casa;
        const g = id === 'asc' || id === 'mc' ? id : GLIFO_DE[id] || id;
        return `<tr${destaque ? ' class="dest"' : ''}><th scope="row"><span style="display:inline-flex;align-items:center">${gl(g)}${esc(p.nome)}${p.retrogrado ? ' <span class="rx" aria-hidden="true">&nbsp;R</span><span class="sr"> retrógrado</span>' : ''}</span></th>
            <td class="el-${SIGNO_ELEMENTO[p.signo]}"><span class="sgc">${gl(p.signo)}${esc(p.signoNome)}</span></td><td>${grauTexto(p)}</td><td>${casa || '—'}</td></tr>`;
    }

    resumoTres() {
        const p = this.calc.pontos;
        const cx = (id, papel) => {
            const x = p[id];
            if (!x) return `<div><span class="papel">${papel}</span>${gl('asc')}<span class="sem">Sem a hora, não é calculado</span></div>`;
            return `<div class="el-${SIGNO_ELEMENTO[x.signo]}"><span class="papel">${papel}</span>${gl(id)}<span class="sg">${esc(x.signoNome)}</span><span class="gr">${grauTexto(x)}</span></div>`;
        };
        return `<div class="res-resumo">${cx('sol', 'Sol')}${cx('lua', 'Lua')}${cx('asc', 'Ascendente')}</div>`;
    }

    legenda() {
        const lg = (cls) => `<svg class="lg" viewBox="0 0 44 10" aria-hidden="true"><line class="${cls} r-asp" x1="3" y1="5" x2="41" y2="5"/></svg>`;
        return `<section class="legenda" aria-label="${T.legenda} da roda"><h3>${T.legenda}</h3><ul>
            ${LEGENDA.map(([cls, nome, d]) => `<li>${lg(cls)}<span><b style="font-weight:600">${nome}</b> <span class="l">${d}</span></span></li>`).join('')}
            <li><span class="lg-txt" aria-hidden="true">••</span><span><b style="font-weight:600">Conjunção</b> <span class="l">lado a lado, sem linha</span></span></li>
            ${this.calc.semHora ? '' : '<li><span class="lg-txt acc">AC MC</span><span class="l">Ascendente e Meio do Céu</span></li>'}
            <li><span class="lg-txt acc">R</span><span class="l">retrógrado</span></li></ul>
            <div class="gls">${CORPOS_LEGENDA.map(([k, n]) => `<span>${gl(k)}${n}</span>`).join('')}</div>
            <p class="nota-geonames">${esc(this.t('ui.legenda.aspectos'))}</p></section>`;
    }

    resultado() {
        const c = this.calc;
        const m = this.m;
        const roda = rodaSVG(c, { id: 'roda', titulo: `Roda do zodíaco do mapa de ${m.rotulo}`, desc: `${this.t('ui.roda.alt')} ${this.descricao()}` });
        const tabela = `<div class="tabela-wrap"><table class="tabela-pos"><caption>${T.posicoes}</caption><thead><tr><th scope="col">${T.corpo}</th><th scope="col">Signo</th><th scope="col">Grau</th><th scope="col">Casa</th></tr></thead><tbody>
            ${ORDEM_TAB.map((id) => this.linhaTabela(id, ['asc', 'mc', 'sol', 'lua'].includes(id))).join('')}</tbody></table></div>`;
        return `<div class="mapa-tela">
            <div class="res-topo"><span class="eyebrow">${T.eyebrow}</span><div class="meta"><span>${esc(m.rotulo)}</span><span>${esc(dataExtenso(m.data))}${m.hora ? `, ${m.hora}` : ', sem hora'}</span><span>${esc(m.local.nome)}</span></div></div>
            <div data-avisos>${this.avisosTopo()}</div>
            ${this.resumoTres()}
            <div class="vista-seg" role="group" aria-label="${T.verComo}"><button class="chip" type="button" data-vista="roda" aria-pressed="${this.vista === 'roda'}">${ic('roda')}${T.roda}</button><button class="chip" type="button" data-vista="lista" aria-pressed="${this.vista === 'lista'}">${ic('lista')}${T.lista}</button></div>
            <div class="res-grid" data-vista="${this.vista}"><div class="bloco-roda">${roda}${this.legenda()}</div><div class="bloco-lista">${tabela}</div></div>
            <div class="res-acoes"><button class="btn btn-primary" type="button" data-acao="ler">${T.ler}</button>${this.botaoPerfil()}<button class="btn btn-ghost" type="button" data-acao="diario">${ic('diario')}${esc(this.t('ui.btn.guardar', {}, 'Guardar este mapa no diário'))}</button></div>
            <p class="mute diario-aviso" role="status" aria-live="polite" data-status>${esc(this.status)}</p>
            ${this.painelCompartilhar('mapa')}
            <p class="nota-geonames">${atribuicaoGeoNames(this.textos)}</p>
            <div><button class="link-btn" type="button" data-acao="perfil">${ic('voltar')}${T.voltarPerfil}</button></div></div>`;
    }

    botaoPerfil() {
        return this.salvo
            ? `<button class="btn btn-ghost" type="button" data-acao="perfil">${ic('ok')}${T.guardado}</button>`
            : `<button class="btn btn-primary" type="button" data-acao="guardar-perfil">${ic('mais')}${T.guardarPerfil}</button><button class="btn btn-ghost" type="button" data-acao="descartar">${T.descartar}</button>`;
    }

    descricao() {
        const p = this.calc.pontos;
        return `Sol em ${p.sol.signoNome}, Lua em ${p.lua.signoNome}${this.calc.semHora ? '' : `, Ascendente em ${p.asc.signoNome}`}.`;
    }

    /* ---------- leitura ---------- */

    paragrafos(lista, usados) {
        return lista.flatMap(mapaDe).map((p) => `<p>${linkarTermos(p, usados)}</p>`).join('');
    }

    cartasChips(cartas) {
        if (!cartas || !cartas.length) return '';
        return `<div class="chips-rel">${cartas.map((c) => `<button class="chip-carta" type="button" data-carta="${c.order}"><img src="${img(c.order)}" alt="" width="28" height="40" loading="lazy" decoding="async"><span><small>${esc(c.rotulo)}</small>${esc(c.nome)}</span></button>`).join('')}</div>`;
    }

    notas(notas) {
        return (notas || []).map((n) => `<section class="aviso ${n.tipo}" role="status">${ic(n.tipo === 'atencao' ? 'relogio' : 'info')}<h3 class="sr">${n.tipo === 'atencao' ? 'Atenção' : 'Nota'}</h3><div><p>${esc(n.texto)}</p></div></section>`).join('');
    }

    itens(s, usados) {
        if (!s.itens.length) return '';
        return `<ul class="leit-lista">${s.itens.map((it) => `<li>${it.glifo ? gl(it.glifo) : ic('roda')}<div><b>${esc(it.titulo)}${it.tag ? ` <span class="rx" aria-hidden="true">${it.tag}</span><span class="sr"> (${esc(it.tagTexto || '')})</span>` : ''}</b>
            ${it.linhas && it.linhas.length ? `<small class="meta-item">${it.linhas.map(esc).join(' · ')}</small>` : ''}
            ${this.notas(it.notas)}${it.textos && it.textos.length ? `<div class="leit-texto">${this.paragrafos(it.textos, usados)}</div>` : ''}${this.cartasChips(it.cartas)}</div></li>`).join('')}</ul>`;
    }

    corpoSecao(s, i) {
        const usados = new Set();
        const cab = `<header class="leit-cab"><span class="eyebrow">${i + 1} ${T.de} ${this.secoes().length}</span><h2 id="leit-h" tabindex="-1">${s.glifo ? gl(s.glifo) : ic('roda')}${esc(s.titulo)}</h2></header>`;
        const intro = s.intro && s.intro.length ? `<p class="leit-intro">${linkarTermos(s.intro[0], usados)}</p>` : '';
        let h = cab + intro + this.notas(s.notas);
        if (s.legenda) h += `<p class="leit-intro mute">${linkarTermos(s.legenda, usados)}</p>`;
        if (s.ponto) {
            const p = s.ponto;
            const [dc, sg, co] = p.cartas;
            h += `<ul class="fatos" aria-label="Dados da posição">${p.fatos.map(([k, v]) => `<li><strong>${k}</strong>${esc(v)}</li>`).join('')}</ul>`;
            if (dc) {
                h += `<section class="decano el-${p.elemento}" aria-label="Carta do decano"><button class="carta-btn" type="button" data-carta="${dc.order}" aria-label="Abrir a carta ${esc(dc.nome)}"><img src="${img(dc.order)}" alt="${esc(dc.nome)}, carta do ${p.decano}º decano" width="274" height="410"></button>
                    <div class="corpo"><span class="rotulo">${esc(dc.rotulo)}</span><h3 class="nome">${esc(dc.nome)}</h3><p class="faixa">${esc(p.signoNome)}, de ${(p.decano - 1) * 10}° a ${p.decano * 10}°</p><button class="btn btn-primary" type="button" data-carta="${dc.order}">${T.abrir}</button>
                    ${this.cartasChips([sg, co].filter(Boolean))}</div></section>`;
            }
            h += `<div class="leit-texto">${this.paragrafos(p.paragrafos, usados)}</div>`;
        }
        if (s.introRegente) h += `<p class="leit-intro mute">${linkarTermos(s.introRegente, usados)}</p>`;
        h += this.itens(s, usados);
        return h;
    }

    leituraTela() {
        const ss = this.secoes();
        let i = ss.findIndex((x) => x.id === this.secaoId);
        if (i < 0) i = 0;
        const s = ss[i], ant = ss[i - 1], prox = ss[i + 1];
        const idx = `<nav class="idx" aria-label="Seções da leitura"><span class="idx-tit">${T.nesta}</span><div class="chips" id="idx-chips">${ss.map((x) => `<button class="chip" type="button" data-sec="${x.id}"${x.id === s.id ? ' aria-current="true"' : ''}>${x.glifo ? gl(x.glifo) : ic('roda')}${esc(x.titulo)}</button>`).join('')}</div></nav>`;
        const pager = `<nav class="pager" aria-label="Navegar entre seções">${ant
            ? `<button class="pg" type="button" data-sec="${ant.id}"><small>${ic('voltar')}${T.anterior}</small><b>${esc(ant.titulo)}</b></button>`
            : `<button class="pg" type="button" data-acao="ao-mapa"><small>${ic('voltar')}Voltar</small><b>${T.aoMapa}</b></button>`}${prox
            ? `<button class="pg prox" type="button" data-sec="${prox.id}"><small>${T.proximo}${ic('seta')}</small><b>${esc(prox.titulo)}</b></button>`
            : `<button class="pg prox" type="button" data-acao="perfil"><small>${T.fim}${ic('seta')}</small><b>${T.perfil}</b></button>`}</nav>`;
        const aviso = this.marc ? `<p class="mute leit-escolha">${T.escolha}: <strong>${esc(this.marc.rotulos[this.escolha])}</strong>. Para trocar, volte ao mapa.</p>` : '';
        return `<div class="prog" role="progressbar" aria-label="Progresso da leitura" aria-valuemin="1" aria-valuemax="${ss.length}" aria-valuenow="${i + 1}" aria-valuetext="Seção ${i + 1} de ${ss.length}: ${esc(s.titulo)}" style="--p:${((i + 1) / ss.length) * 100}%"><i></i></div>
            <div class="mapa-tela"><div class="leit-wrap">${idx}<article class="leit-sec" aria-labelledby="leit-h">${aviso}${this.corpoSecao(s, i)}
            <p class="mute diario-aviso" role="status" aria-live="polite" data-status>${esc(this.status)}</p>
            ${this.painelCompartilhar(s.id)}${pager}</article></div></div>`;
    }

    /* ---------- compartilhar ---------- */

    cartaoDisponivel(escopo) {
        if (escopo === 'mapa') return true;
        const s = this.secoes().find((x) => x.id === escopo);
        return !!(s && s.ponto && s.ponto.cartaDecano);
    }

    painelCompartilhar(escopo) {
        const mapa = escopo === 'mapa';
        return `<section class="painel compart" aria-labelledby="cp-t"><h3 id="cp-t">${mapa ? T.compMapa : T.compLeitura}</h3>
            <label class="diario-marca"><input type="checkbox" data-incluir${this.incluir ? ' checked' : ''}><span>${esc(this.t('ui.compartilhar.marca', {}, 'Incluir data, hora e lugar de nascimento no texto'))}</span></label>
            <p style="font-size:var(--fs-sm)">${esc(this.t('ui.compartilhar.texto'))}</p>
            <div class="btn-row"><button class="btn btn-ghost" type="button" data-acao="copiar" data-escopo="${escopo}">${ic('copiar')}${T.copiar}</button><button class="btn btn-ghost" type="button" data-acao="compartilhar" data-escopo="${escopo}">${ic('compartilhar')}${T.compartilhar}</button>${this.cartaoDisponivel(escopo) ? `<button class="btn btn-primary" type="button" data-acao="cartao" data-escopo="${escopo}">${ic('baixar')}${T.cartao}</button>` : ''}</div>
            <p class="mute" style="font-size:var(--fs-xs)" role="status" aria-live="polite" data-cp-status>&nbsp;</p>
            <details><summary>${T.ver}</summary><pre data-pre>${esc(this.textoCompartilhar(escopo))}</pre></details></section>`;
    }

    textoCompartilhar(escopo) {
        const c = this.calc;
        const ss = this.secoes();
        let corpo;
        if (escopo === 'mapa') {
            const p = c.pontos;
            const lin = (id, papel) => {
                const x = p[id];
                const cd = x.ponte && x.ponte.cartaDecano;
                return `${papel} em ${x.signoNome}, ${grauTexto(x)}${cd ? `, ${cd.nome}` : ''}`;
            };
            corpo = [this.incluir && this.nomeMapa() ? `Mapa astral de ${this.nomeMapa()}` : 'Mapa astral', lin('sol', 'Sol'), lin('lua', 'Lua'), c.semHora ? 'Ascendente: não calculado, sem a hora de nascimento' : lin('asc', 'Ascendente')].join('\n');
        } else {
            const s = ss.find((x) => x.id === escopo);
            corpo = s ? textoDaSecao(s) : '';
        }
        const dados = this.incluir ? `\n\nNascimento: ${this.dadosLinha()}` : '';
        return `${corpo}${dados}\n\naeonfool.com`;
    }

    dizerCp(msg) {
        const el = this.querySelector('[data-cp-status]');
        if (el) el.textContent = msg;
    }

    async copiar(escopo) {
        const t = this.textoCompartilhar(escopo);
        let ok = false;
        try {
            await navigator.clipboard.writeText(t);
            ok = true;
        } catch (e) {
            try {
                const ta = document.createElement('textarea');
                ta.value = t;
                ta.setAttribute('readonly', '');
                ta.style.cssText = 'position:fixed;opacity:0;top:0';
                document.body.appendChild(ta);
                ta.select();
                ok = document.execCommand('copy');
                ta.remove();
            } catch (e2) {
                ok = false;
            }
        }
        this.dizerCp(ok ? T.copiado : T.naoCopiou);
    }

    async compartilharTexto(escopo) {
        if (!navigator.share) return this.dizerCp(T.semShare);
        try {
            await navigator.share({ text: this.textoCompartilhar(escopo) });
        } catch (e) {
            /* cancelado: nada a dizer */
        }
        return undefined;
    }

    async baixarCartao(escopo) {
        this.dizerCp(T.cartaoFazendo);
        try {
            const mod = await import('../utils/cartaoMapa.js');
            const nome = this.incluir ? this.nomeMapa() : '';
            const dados = this.incluir ? this.dadosLinha().toUpperCase() : '';
            let cv;
            if (escopo === 'mapa') cv = await mod.gerarCartaoMapa({ calc: this.calc, nome, dados });
            else {
                const s = this.secoes().find((x) => x.id === escopo);
                cv = await mod.gerarCartaoSecao({ secao: s, frase: mod.citacao(s.ponto.fraseCarta), nome, dados });
            }
            const ok = await mod.baixarPNG(cv, `aeon-mapa${escopo === 'mapa' ? '' : `-${escopo}`}.png`);
            this.dizerCp(ok ? T.cartaoOk : T.cartaoErro);
        } catch (e) {
            this.dizerCp(T.cartaoErro);
        }
    }

    /* ---------- acoes ---------- */

    guardarNoPerfil() {
        const r = adicionar({ rotulo: this.m.rotulo, data: this.m.data, hora: this.m.hora, local: this.m.local, escolha: this.escolha, principal: !!this.m.principal });
        if (!r.id) {
            this.status = 'Não foi possível guardar o mapa agora.';
            this.desenhar();
            return;
        }
        this.m = obter(r.id) || this.m;
        this.salvo = true;
        this.estadoAviso = r.repetido ? 'repetido' : 'guardado';
        if (!r.ok) persiste();
        this.desenhar('[data-acao="perfil"]');
    }

    guardarNoDiario() {
        const p = this.calc.pontos;
        const cartas = [['sol', p.sol], ['lua', p.lua], ['asc', this.calc.semHora ? null : p.asc]]
            .filter(([, x]) => x && x.ponte && x.ponte.cartaDecano)
            .map(([pos, x]) => ({ order: Number(x.ponte.cartaDecano.order), pos }));
        const rotulo = ['sol', 'lua', 'asc'].filter((k) => p[k]).map((k) => p[k].signoNome).join(', ');
        const r = criarMapa(cartas, rotulo);
        this.status = r.ok ? this.t('ui.diario.nota', {}, T.diarioOk) : T.diarioErro;
        const el = this.querySelector('[data-status]');
        if (el) el.textContent = this.status;
    }

    abrirCarta(order, origem) {
        loadCards().then((lista) => {
            const carta = lista.find((c) => Number(c.order) === Number(order));
            const info = document.querySelector('tarot-card-info');
            if (carta && info && info.showInfo) info.showInfo(carta, origem);
        });
    }

    irParaSecao(id) {
        this.view = 'leitura';
        this.secaoId = id;
        this.status = '';
        this.desenhar('#leit-h');
        window.scrollTo(0, 0);
    }

    clique(e) {
        const termo = e.target.closest('.termo');
        if (termo) {
            abrirGlossario(termo.dataset.termo, termo);
            return;
        }
        const carta = e.target.closest('[data-carta]');
        if (carta) {
            this.abrirCarta(carta.dataset.carta, carta);
            return;
        }
        const sec = e.target.closest('[data-sec]');
        if (sec) {
            this.irParaSecao(sec.dataset.sec);
            return;
        }
        const vista = e.target.closest('[data-vista]');
        if (vista) {
            this.vista = vista.dataset.vista;
            this.querySelector('.res-grid').dataset.vista = this.vista;
            this.querySelectorAll('[data-vista].chip').forEach((b) => b.setAttribute('aria-pressed', String(b === vista)));
            return;
        }
        const b = e.target.closest('[data-acao]');
        if (!b) return;
        const a = b.dataset.acao;
        if (a === 'ler') this.irParaSecao('sol');
        else if (a === 'ao-mapa') {
            this.view = 'resultado';
            this.status = '';
            this.desenhar('.res-topo');
            window.scrollTo(0, 0);
        } else if (a === 'perfil') navigateTo('perfil', this.m.id ? { selecionar: this.m.id } : null);
        else if (a === 'guardar-perfil') this.guardarNoPerfil();
        else if (a === 'descartar') navigateTo('perfil');
        else if (a === 'diario') this.guardarNoDiario();
        else if (a === 'copiar') this.copiar(b.dataset.escopo);
        else if (a === 'compartilhar') this.compartilharTexto(b.dataset.escopo);
        else if (a === 'cartao') this.baixarCartao(b.dataset.escopo);
    }

    async mudou(e) {
        if (e.target.matches('[data-incluir]')) {
            this.incluir = e.target.checked;
            const pre = this.querySelector('[data-pre]');
            const escopo = this.view === 'leitura' ? this.secaoId : 'mapa';
            if (pre) pre.textContent = this.textoCompartilhar(escopo);
            return;
        }
        if (e.target.name === 'leitura-hora') {
            this.escolha = Number(e.target.value);
            try {
                await this.recalcular();
            } catch (err) {
                return;
            }
            this.status = `${T.mostrando} ${this.marc.rotulos[this.escolha]}.`;
            if (this.salvo && this.m.id && definirPreferencias(this.m.id, { escolha: this.escolha })) this.status += ` ${T.escolhaGravada}`;
            this.desenhar('input[name="leitura-hora"]:checked');
            return;
        }
    }

    /* ---------- montagem ---------- */

    desenhar(foco) {
        const titulo = document.querySelector('.page-title');
        const h1 = document.querySelector('#page-title');
        if (!this.calc) {
            if (h1) h1.textContent = T.eyebrow;
            this.innerHTML = `<div class="mapa-tela"><section class="aviso erro" role="alert">${ic('erro')}<h3>${T.eyebrow}</h3><div><p>${esc(this.t('ui.erro.geral', {}, 'Não foi possível montar o mapa agora.'))}</p></div></section><div><button class="btn btn-ghost" type="button" data-acao="perfil">${T.voltarPerfil}</button></div></div>`;
            return;
        }
        const leitura = this.view === 'leitura';
        if (h1) h1.textContent = leitura ? T.leitura : T.titulo;
        if (titulo) titulo.classList.toggle('sr', leitura);
        this.innerHTML = leitura ? this.leituraTela() : this.resultado();
        if (foco) {
            const el = this.querySelector(foco);
            if (el) el.focus();
        }
    }
}

customElements.define('mapa-screen', MapaScreen);
