import { navigateTo, consumirEstado, focarCabecalho } from '../utils/navigation.js';
import { gl, ic } from '../utils/glifos.js';
import { loadCards } from '../utils/cardsUtil.js';
import { obter, principal, listar, adicionar, apelido, persiste, definirPreferencias } from '../utils/perfil.js';
import { baixarBackup } from '../utils/backup.js';
import { criarMapa } from '../utils/diario.js';
import { carregarTextos, texto, esc, calcular, dataExtenso, grauTexto, casaDa, marcadoresHora, atribuicaoGeoNames, SIGNO_ELEMENTO } from '../utils/mapaComum.js';
import { montarLeitura, textoDaSecao } from '../utils/leituraMapa.js';
import { rodaSVG } from '../utils/roda.js';
import { carregarGlossario, linkarTermos } from '../utils/glossario.js';
import { abrirGlossario } from './GlossarioModal.js';
import { abrirResumoCarta } from './TarotCardInfo.js';
import { abrir, avisar, ehDesktop } from './Sobreposicao.js';
import { apagarMapaComDesfazer } from './desfazerMapa.js';

/**
 * Mapa astral em abas (Resumo, Leitura, Casas, Aspectos), direcao C do redesenho: a roda fica fixa na
 * coluna da esquerda no desktop; as acoes saem da pagina e vao para o menu lateral (celular) ou para
 * a barra de acoes (desktop). Compartilhar, trocar de mapa e apagar abrem sheet, dialogo ou modal.
 * Todo o estado fica em memoria: dados de nascimento nunca vao para URL, hash, query, console nem analytics.
 */
const T = {
    titulo: 'Seu mapa',
    eyebrow: 'Mapa astral',
    guardarPerfil: 'Guardar no perfil',
    guardarDiario: 'Guardar no diário',
    descartar: 'Descartar',
    naoGuardado: 'Não guardado',
    novoTitulo: 'Mapa ainda não guardado',
    novoTexto: 'Confira o resultado. Ele só entra no perfil se você tocar em Guardar no perfil.',
    escolhaGravada: 'Leitura guardada neste mapa.',
    guardadoVer: 'Guardado, ver no perfil',
    guardadoOk: 'Mapa guardado neste aparelho.',
    repetidoOk: 'Esse mapa já estava guardado. Nada foi duplicado.',
    erroGuardar: 'Não foi possível guardar o mapa agora.',
    semHoraTitulo: 'Mapa sem hora de nascimento',
    latAltaTitulo: 'Local em latitude alta',
    ambiguaTitulo: 'Essa hora aconteceu duas vezes',
    inexistenteTitulo: 'A hora informada não existiu',
    posicoes: 'Posições dos astros',
    legenda: 'Legenda da roda',
    corpo: 'Corpo',
    voltarPerfil: 'Voltar ao perfil',
    acoes: 'Ações',
    acoesTitulo: 'Ações do mapa',
    abas: 'Seções do mapa',
    secoesLeitura: 'Seções da leitura',
    compMapa: 'Compartilhar o mapa',
    compLeitura: 'Compartilhar esta leitura',
    copiar: 'Copiar texto',
    compartilhar: 'Compartilhar texto',
    cartao: 'Baixar cartão',
    ver: 'Ver o texto que será compartilhado',
    copiado: 'Texto copiado.',
    naoCopiou: 'Não foi possível copiar. Abra Ver o texto que será compartilhado e selecione.',
    semShare: 'Este aparelho não abre o compartilhamento. Use Copiar texto.',
    cartaoOk: 'Cartão baixado.',
    cartaoFazendo: 'Preparando o cartão…',
    cartaoErro: 'Não foi possível montar o cartão agora.',
    diarioOk: 'Guardado no diário.',
    diarioErro: 'Não foi possível guardar no diário agora.',
    backupOk: 'Backup baixado. Guarde o arquivo em um lugar seguro, ele traz datas, horas e lugares de nascimento.',
    backupErro: 'Não foi possível gerar o backup.',
    mostrando: 'Mostrando a leitura de',
    trocarTitulo: 'Trocar de mapa',
    trocarAberto: 'aberto',
    novoMapa: 'Novo mapa',
    apagar: 'Apagar',
    apagarBtn: 'Apagar o mapa agora',
    editar: 'Editar dados',
    exportar: 'Exportar',
    sistemaRot: 'Sistema de casas',
    sistemaAjuda: 'Placidus é o mais usado. Signos Inteiros faz de cada signo uma casa. Igual dá 30° a cada casa, a contar do Ascendente.',
    sistemaLatAlta: 'Em latitude alta, perto dos círculos polares, Placidus não existe: o mapa usa Signos Inteiros.',
    sistemaGravado: 'Sistema de casas guardado neste mapa.',
    semCasas: 'Sem a hora de nascimento não há Ascendente, Meio do Céu nem casas.',
    aspectosLegenda: 'Linhas dos aspectos na roda',
    mais: 'Mais',
};
const ABAS = [['resumo', 'Resumo'], ['leitura', 'Leitura'], ['casas', 'Casas'], ['aspectos', 'Aspectos']];
const CHIP_ROTULO = { sol: 'Sol', lua: 'Lua', asc: 'Ascendente', planetas: 'Planetas', nodos: 'Nodos', retro: 'Retrógrados', elementos: 'Elementos' };
const SISTEMAS = [['placidus', 'Placidus'], ['signos-inteiros', 'Signos Inteiros'], ['igual', 'Igual']];
const ORDEM_TAB = ['asc', 'mc', 'sol', 'lua', 'mercurio', 'venus', 'marte', 'jupiter', 'saturno', 'urano', 'netuno', 'plutao', 'nodo_norte'];
const GLIFO_DE = { nodo_norte: 'nodo' };
const LEGENDA = [
    ['r-opos', 'Oposição', 'tenso, linha cheia grossa'],
    ['r-quad', 'Quadratura', 'tenso, tracejada'],
    ['r-trig', 'Trígono', 'harmônico, linha fina cheia'],
    ['r-sext', 'Sextil', 'harmônico, pontilhada'],
];
const CORPOS_LEGENDA = [['sol', 'Sol'], ['lua', 'Lua'], ['mercurio', 'Mercúrio'], ['venus', 'Vênus'], ['marte', 'Marte'], ['jupiter', 'Júpiter'], ['saturno', 'Saturno'], ['urano', 'Urano'], ['netuno', 'Netuno'], ['plutao', 'Plutão'], ['nodo', 'Nodo Norte']];
const ROTULOS_PONTO = ['No signo', 'Na casa', 'No decano', 'Na carta da Corte', 'Em síntese', 'Perto da divisa'];
const mapaDe = (txt) => String(txt).split(/\n{2,}/).filter((x) => x.trim());
const img = (order) => `assets/cards/crowley-${String(order).padStart(2, '0')}.jpg`;
/* aba e secao lembradas so em memoria, por mapa guardado (nada de URL nem hash) */
const LEMBRADO = new Map();

export class MapaScreen extends HTMLElement {
    async connectedCallback() {
        const est = consumirEstado() || {};
        this.m = (est.id && obter(est.id)) || principal();
        this.salvo = !!(this.m && this.m.id);
        const lem = (this.salvo && LEMBRADO.get(this.m.id)) || {};
        this.aba = est.secao ? 'leitura' : lem.aba || 'resumo';
        this.secaoId = est.secao || lem.sec || 'sol';
        this.incluir = false;
        this.status = '';
        const titulo = document.querySelector('#page-title');
        if (titulo) titulo.textContent = T.titulo;
        const pt = document.querySelector('.page-title');
        if (pt) pt.classList.add('sr');
        if (!this.m) {
            navigateTo('perfil');
            return;
        }
        this.innerHTML = '<div class="mapa-tela" aria-busy="true"></div>';
        this.addEventListener('click', (e) => this.clique(e));
        this.addEventListener('change', (e) => this.mudou(e));
        this.addEventListener('keydown', (e) => this.teclou(e));
        try {
            [this.textos] = await Promise.all([carregarTextos(), loadCards(), carregarGlossario()]);
            this.escolha = this.m.escolha || 0;
            this.casas = this.m.casas || 'placidus';
            await this.recalcular();
        } catch (e) {
            this.calc = null;
            this.textos = this.textos || {};
        }
        if (!this.isConnected) return;
        this.desenhar('#mapa-h', true);
    }

    disconnectedCallback() {
        const t = document.querySelector('.page-title');
        if (t) t.classList.remove('sr');
        if (this.sobre && this.sobre.aberto) this.sobre.fechar(false);
    }

    t(id, vars, padrao) {
        return texto(this.textos, id, vars, padrao);
    }

    async recalcular() {
        this.calc = await calcular({ ...this.m, escolha: this.escolha, casas: this.casas });
        this.marc = this.calc.hora.estado !== 'normal' ? await marcadoresHora(this.calc, this.m.local.tz) : null;
        this.leit = montarLeitura(this.calc, this.textos);
    }

    secoes() {
        return this.leit.secoes;
    }

    secoesLeitura() {
        return this.secoes().filter((s) => s.id !== 'casas' && s.id !== 'aspectos');
    }

    nomeMapa() {
        const ap = apelido();
        return this.m.principal && ap ? ap : this.m.rotulo || '';
    }

    dadosLinha() {
        const m = this.m;
        return `${dataExtenso(m.data)}${m.hora ? `, ${m.hora}` : ''}, ${m.local.nome}`;
    }

    lembrar() {
        if (this.salvo) LEMBRADO.set(this.m.id, { aba: this.aba, sec: this.secaoId });
    }

    /* ---------- pecas ---------- */

    aviso(tipo, icone, titulo, corpo, extra = '') {
        return `<section class="aviso ${tipo}" role="${tipo === 'atencao' || tipo === 'erro' ? 'alert' : 'status'}">${ic(icone)}<h3>${esc(titulo)}</h3><div><p>${esc(corpo)}</p>${extra}</div></section>`;
    }

    latAlta() {
        const c = this.calc;
        return !!(c.casas && c.casas.sistema === 'signos-inteiros' && c.casas.solicitado !== 'signos-inteiros');
    }

    avisosHtml() {
        const c = this.calc;
        const aba = this.aba;
        let h = '';
        if (!this.salvo && aba === 'resumo') {
            h += this.aviso('info', 'info', T.novoTitulo, T.novoTexto, `<div class="btn-row"><button class="btn btn-primary" type="button" data-acao="guardar-perfil">${ic('guardar')}${T.guardarPerfil}</button></div>`);
        }
        if (c.semHora) h += this.aviso('atencao', 'relogio', T.semHoraTitulo, this.t('ui.aviso.semhora'));
        if (this.latAlta() && (aba === 'resumo' || aba === 'casas')) h += this.aviso('info', 'info', T.latAltaTitulo, this.t('ui.aviso.latalta'));
        if (this.marc) {
            const amb = c.hora.estado === 'ambigua';
            const nomes = [this.t('ui.hora.antes'), this.t('ui.hora.depois')];
            const corpo = this.t(amb ? 'ui.aviso.ambigua' : 'ui.aviso.inexistente', { hora1: this.marc.hora1, hora2: this.marc.hora2 });
            h += `<section class="aviso atencao" role="group" aria-labelledby="hora-t">${ic('relogio')}<h3 id="hora-t">${amb ? T.ambiguaTitulo : T.inexistenteTitulo}</h3><div><p>${esc(corpo)}</p>
                <fieldset class="campo" style="margin-top:8px"><legend class="rot-mini">${esc(this.t('ui.form.escolha-hora'))}</legend><div class="opcoes" role="radiogroup">
                ${this.marc.rotulos.map((r, i) => `<label class="opcao"><input type="radio" name="leitura-hora" value="${i}"${i === this.escolha ? ' checked' : ''}><span>${esc(r)}<small>${esc(nomes[i])}</small></span></label>`).join('')}</div></fieldset>
                <p class="mute" style="font-size:var(--fs-sm);margin-top:8px" role="status" aria-live="polite" data-status>${esc(this.status)}</p></div></section>`;
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
        const cx = (id, papel, glifo) => {
            const x = p[id];
            if (!x) return `<div><span class="papel">${papel}</span>${gl('asc')}<span class="sem">Sem a hora, não é calculado</span></div>`;
            return `<div class="el-${SIGNO_ELEMENTO[x.signo]}"><span class="papel">${papel}</span>${gl(glifo || id)}<span class="sg">${esc(x.signoNome)}</span><span class="gr">${grauTexto(x)}</span></div>`;
        };
        return `<div class="res-resumo" role="group" aria-label="Sol, Lua e Ascendente">${cx('sol', 'Sol')}${cx('lua', 'Lua')}${cx('asc', 'Asc', 'asc')}</div>`;
    }

    legendaCorpo() {
        const lg = (cls) => `<svg class="lg" viewBox="0 0 44 10" aria-hidden="true"><line class="${cls} r-asp" x1="3" y1="5" x2="41" y2="5"/></svg>`;
        return `<div class="legenda"><ul>
            ${LEGENDA.map(([cls, nome, d]) => `<li>${lg(cls)}<span><b style="font-weight:600">${nome}</b> <span class="l">${d}</span></span></li>`).join('')}
            <li><span class="lg-txt" aria-hidden="true">••</span><span><b style="font-weight:600">Conjunção</b> <span class="l">lado a lado, sem linha</span></span></li>
            ${this.calc.semHora ? '' : '<li><span class="lg-txt acc">AC MC</span><span class="l">Ascendente e Meio do Céu</span></li>'}
            <li><span class="lg-txt acc">R</span><span class="l">retrógrado</span></li></ul>
            <div class="gls">${CORPOS_LEGENDA.map(([k, n]) => `<span>${gl(k)}${n}</span>`).join('')}</div>
            <p class="nota-geonames">${esc(this.t('ui.legenda.aspectos'))}</p></div>`;
    }

    legendaLinhas() {
        const lg = (cls) => `<svg class="lg" viewBox="0 0 44 10" aria-hidden="true"><line class="${cls} r-asp" x1="3" y1="5" x2="41" y2="5"/></svg>`;
        return `<div class="legenda" role="group" aria-label="${T.aspectosLegenda}"><ul>${LEGENDA.map(([cls, nome, d]) => `<li>${lg(cls)}<span><b style="font-weight:600">${nome}</b> <span class="l">${d}</span></span></li>`).join('')}</ul></div>`;
    }

    roda(id) {
        const m = this.m;
        return rodaSVG(this.calc, { id, titulo: `Roda do zodíaco do mapa de ${m.rotulo}`, desc: `${this.t('ui.roda.alt')} ${this.descricao()}` });
    }

    descricao() {
        const p = this.calc.pontos;
        return `Sol em ${p.sol.signoNome}, Lua em ${p.lua.signoNome}${this.calc.semHora ? '' : `, Ascendente em ${p.asc.signoNome}`}.`;
    }

    acc(rotulo, corpo, aberto, sumario, extra = '') {
        return `<details class="acc"${extra}${aberto ? ' open' : ''}><summary>${sumario || `<span>${esc(rotulo)}</span>`}</summary><div class="corpo">${corpo}</div></details>`;
    }

    /* ---------- abas ---------- */

    painelResumo() {
        const tabela = `<div class="tabela-wrap"><table class="tabela-pos"><caption class="sr">${T.posicoes}</caption><thead><tr><th scope="col">${T.corpo}</th><th scope="col">Signo</th><th scope="col">Grau</th><th scope="col">Casa</th></tr></thead><tbody>
            ${ORDEM_TAB.map((id) => this.linhaTabela(id, ['asc', 'mc', 'sol', 'lua'].includes(id))).join('')}</tbody></table></div>`;
        return `<div class="mc-pilha">
            <div class="mc-so-cel mc-pilha"><div class="mc-roda">${this.roda('roda-m')}</div>${this.resumoTres()}</div>
            <div class="mc-acc">${this.acc(T.posicoes, tabela, false, '', ' data-desk-open')}${this.acc(T.legenda, this.legendaCorpo(), false, '', ' data-desk-open')}</div>
            <p class="nota-geonames">${atribuicaoGeoNames(this.textos)}</p></div>`;
    }

    painelLeitura() {
        const ss = this.secoesLeitura();
        let s = ss.find((x) => x.id === this.secaoId);
        if (!s) {
            s = ss[0];
            this.secaoId = s.id;
        }
        const chips = `<nav class="mc-chips" aria-label="${T.secoesLeitura}"><div class="chips">${ss.map((x) => `<button class="chip" type="button" data-sec="${x.id}"${x.id === s.id ? ' aria-current="true"' : ''}>${x.glifo ? gl(x.glifo) : ic('roda')}${esc(CHIP_ROTULO[x.id] || x.titulo)}</button>`).join('')}</div></nav>`;
        return `<div class="mc-pilha">${chips}<article class="mc-sec" aria-labelledby="leit-h">${this.corpoSecao(s)}</article></div>`;
    }

    painelCasas() {
        const c = this.calc;
        const s = this.secoes().find((x) => x.id === 'casas');
        const intro = s && s.intro && s.intro[0] ? `<p class="leit-intro">${linkarTermos(s.intro[0], new Set())}</p>` : '';
        if (c.semHora || !c.casas) return `<div class="mc-pilha"><h3 class="display mc-h3">Casas</h3>${intro}<p class="mute">${T.semCasas}</p></div>`;
        const alta = this.latAlta();
        const seletor = `<div class="campo seletor-casas"><label class="rot-mini" for="sel-casas">${T.sistemaRot}</label>
            <select class="entrada" id="sel-casas" data-casas aria-describedby="casas-aj">${SISTEMAS.map(([k, n]) => `<option value="${k}"${k === this.casas ? ' selected' : ''}>${n}</option>`).join('')}</select>
            <span class="dica" id="casas-aj">${T.sistemaAjuda}${alta ? ` ${T.sistemaLatAlta}` : ''}</span></div>`;
        const it = (s && s.itens) || [];
        const cards = c.casas.cuspides.map((cs, i) => {
            const astros = it[i] && /^Astros: /.test(it[i].linhas[1] || '') ? it[i].linhas[1].replace('Astros: ', '') : '';
            return `<li class="casa-c el-${SIGNO_ELEMENTO[cs.signo]}"><span class="n" aria-hidden="true">${cs.casa}</span>${gl(cs.signo)}<span><b><span class="sr">Casa ${cs.casa}, </span>${esc(cs.signoNome)}</b><small>${cs.grauInteiro}°${String(cs.minuto).padStart(2, '0')}′${astros ? ` · ${esc(astros)}` : ''}</small></span></li>`;
        }).join('');
        return `<div class="mc-pilha"><h3 class="display mc-h3">Casas</h3>${intro}${this.notas(s && s.notas)}${seletor}<ul class="casas-grid" aria-label="As doze casas">${cards}</ul></div>`;
    }

    painelAspectos() {
        const s = this.secoes().find((x) => x.id === 'aspectos');
        if (!s) return '';
        const usados = new Set();
        const itens = s.itens.map((it) => this.acc('', `<div class="leit-texto">${this.paragrafos(it.textos, usados)}</div>`, false, `<span class="sum-l">${gl(it.glifo)}${it.glifo2 ? gl(it.glifo2) : ''}<span>${esc(it.titulo)}<small>${esc((it.linhas || [])[0] || '')}</small></span></span>`)).join('');
        return `<div class="mc-pilha"><h3 class="display mc-h3">Aspectos</h3>${s.intro && s.intro[0] ? `<p class="leit-intro">${linkarTermos(s.intro[0], usados)}</p>` : ''}${this.notas(s.notas)}${this.legendaLinhas()}<div class="mc-acc">${itens || '<p class="mute">Nenhum aspecto com texto neste mapa.</p>'}</div></div>`;
    }

    painelAtual() {
        return { resumo: () => this.painelResumo(), leitura: () => this.painelLeitura(), casas: () => this.painelCasas(), aspectos: () => this.painelAspectos() }[this.aba]();
    }

    /* ---------- leitura ---------- */

    paragrafos(lista, usados) {
        return lista.flatMap(mapaDe).map((p) => `<p>${linkarTermos(p, usados)}</p>`).join('');
    }

    cartas3(cartas) {
        if (!cartas || !cartas.length) return '';
        return `<div class="cartas3">${cartas.map((c) => `<button class="carta-mini" type="button" data-carta="${c.order}" data-rotulo="${esc(c.rotulo)}"><img src="${img(c.order)}" alt="" width="274" height="410" loading="lazy" decoding="async"><span><small>${esc(c.rotulo)}</small><b>${esc(c.nome)}</b><span class="sr">. Abrir resumo da carta</span></span></button>`).join('')}</div>`;
    }

    cartasChips(cartas) {
        if (!cartas || !cartas.length) return '';
        return `<div class="chips-rel">${cartas.map((c) => `<button class="chip-carta" type="button" data-carta="${c.order}" data-rotulo="${esc(c.rotulo)}"><img src="${img(c.order)}" alt="" width="28" height="40" loading="lazy" decoding="async"><span><small>${esc(c.rotulo)}</small>${esc(c.nome)}</span></button>`).join('')}</div>`;
    }

    notas(notas) {
        return (notas || []).map((n) => `<section class="aviso ${n.tipo}" role="status">${ic(n.tipo === 'atencao' ? 'relogio' : 'info')}<h3 class="sr">${n.tipo === 'atencao' ? 'Atenção' : 'Nota'}</h3><div><p>${esc(n.texto)}</p></div></section>`).join('');
    }

    itensAcc(s, usados) {
        return s.itens.map((it, i) => {
            const sum = `<span class="sum-l">${it.glifo ? gl(it.glifo) : ic('roda')}<span>${esc(it.titulo)}${it.tag ? ` <span class="rx" aria-hidden="true">${it.tag}</span><span class="sr"> (${esc(it.tagTexto || '')})</span>` : ''}<small>${esc((it.linhas || []).join(' · '))}</small></span></span>`;
            const corpo = `${this.notas(it.notas)}${this.cartasChips(it.cartas)}${it.textos && it.textos.length ? `<div class="leit-texto">${this.paragrafos(it.textos, usados)}</div>` : ''}`;
            return this.acc('', corpo, i === 0 && s.id !== 'planetas', sum);
        }).join('');
    }

    corpoSecao(s) {
        const usados = new Set();
        let h = `<header class="mc-sec-cab"><h3 id="leit-h" class="display" tabindex="-1">${s.glifo ? gl(s.glifo) : ic('roda')}${esc(s.titulo)}</h3></header>`;
        if (s.intro && s.intro.length) h += `<p class="leit-intro">${linkarTermos(s.intro[0], usados)}</p>`;
        h += this.notas(s.notas);
        if (s.legenda) h += `<p class="leit-intro mute">${linkarTermos(s.legenda, usados)}</p>`;
        if (s.ponto) {
            const p = s.ponto;
            h += `<ul class="fatos" aria-label="Dados da posição">${p.fatos.map(([k, v]) => `<li><strong>${k === 'Casa' || k === 'Decano' ? `<button class="termo" type="button" data-termo="${k.toLowerCase()}" aria-label="O que é ${k.toLowerCase()}?">${k}</button>` : k}</strong>${esc(v)}</li>`).join('')}</ul>`;
            h += this.cartas3(p.cartas);
            const rot = !p.casa || s.id === 'asc' ? ROTULOS_PONTO.filter((x) => x !== 'Na casa') : ROTULOS_PONTO;
            h += `<div class="mc-acc">${p.paragrafos.map((txt, i) => this.acc(rot[i] || T.mais, `<div class="leit-texto">${this.paragrafos([txt], usados)}</div>`, i === 0)).join('')}</div>`;
        }
        if (s.introRegente) h += `<p class="leit-intro mute">${linkarTermos(s.introRegente, usados)}</p>`;
        if (s.itens.length) h += `<div class="mc-acc">${this.itensAcc(s, usados)}</div>`;
        return h;
    }

    /* ---------- acoes ---------- */

    grupos() {
        const g = [];
        const guardar = [this.salvo ? { id: 'perfil', rot: T.guardadoVer, ic: 'ok' } : { id: 'guardar-perfil', rot: T.guardarPerfil, ic: 'guardar' }, { id: 'diario', rot: T.guardarDiario, ic: 'diario' }];
        g.push(['Guardar', guardar]);
        g.push(['Compartilhar', [{ id: 'compartilhar', rot: 'Compartilhar', ic: 'compartilhar' }, { id: 'cartao', rot: T.cartao, ic: 'baixar' }]]);
        if (this.salvo) g.push(['Mapa', [{ id: 'editar', rot: T.editar, ic: 'editar' }, { id: 'trocar', rot: 'Trocar mapa', ic: 'trocar' }, { id: 'exportar', rot: T.exportar, ic: 'copiar' }]]);
        g.push(['', [this.salvo ? { id: 'apagar', rot: T.apagar, ic: 'lixo', perigo: true } : { id: 'descartar', rot: T.descartar, ic: 'lixo', perigo: true }]]);
        return g;
    }

    menuHtml() {
        return `<nav aria-label="${T.acoesTitulo}">${this.grupos().map(([titulo, itens]) => `${titulo ? `<p class="sob-grupo">${titulo}</p>` : '<div class="sob-sep"></div>'}${itens.map((a) => `<button class="sob-acao${a.perigo ? ' perigo' : ''}" type="button" data-exec="${a.id}">${ic(a.ic)}${esc(a.rot)}</button>`).join('')}`).join('')}</nav>`;
    }

    barraHtml() {
        const btn = (a, cls) => `<button class="btn ${cls}" type="button" data-exec="${a.id}">${ic(a.ic)}${esc(a.rot)}</button>`;
        const icone = (a, perigo) => `<button class="iconbtn round${perigo ? ' perigo' : ''}" type="button" data-exec="${a.id}" aria-label="${esc(a.rot)}" title="${esc(a.rot)}">${ic(a.ic)}</button>`;
        const salvo = this.salvo;
        return `${salvo ? btn({ id: 'perfil', rot: T.guardadoVer, ic: 'ok' }, 'btn-ghost') : btn({ id: 'guardar-perfil', rot: T.guardarPerfil, ic: 'guardar' }, 'btn-primary')}
            ${btn({ id: 'diario', rot: T.guardarDiario, ic: 'diario' }, 'btn-ghost')}${btn({ id: 'compartilhar', rot: 'Compartilhar', ic: 'compartilhar' }, 'btn-ghost')}${btn({ id: 'cartao', rot: T.cartao, ic: 'baixar' }, 'btn-ghost')}
            <span class="sep" aria-hidden="true"></span>
            ${salvo ? `${icone({ id: 'editar', rot: T.editar, ic: 'editar' })}${icone({ id: 'trocar', rot: 'Trocar mapa', ic: 'trocar' })}${icone({ id: 'exportar', rot: T.exportar, ic: 'copiar' })}${icone({ id: 'apagar', rot: T.apagar, ic: 'lixo' }, true)}` : icone({ id: 'descartar', rot: T.descartar, ic: 'lixo' }, true)}`;
    }

    abrirGaveta(botao) {
        botao.setAttribute('aria-expanded', 'true');
        const c = abrir({
            tipo: 'gaveta', titulo: T.acoesTitulo, gatilho: botao,
            contexto: `<b>${esc(this.nomeMapa() || T.titulo)}</b>${esc(this.dadosLinha())}`,
            corpo: this.menuHtml(),
            aoFechar: () => botao.setAttribute('aria-expanded', 'false'),
        });
        c.corpo.addEventListener('click', (e) => {
            const b = e.target.closest('[data-exec]');
            if (!b) return;
            const id = b.dataset.exec;
            c.fechar();
            this.executar(id, botao);
        });
        this.sobre = c;
    }

    executar(id, gatilho) {
        if (id === 'guardar-perfil') this.guardarNoPerfil();
        else if (id === 'perfil') navigateTo('perfil', this.m.id ? { selecionar: this.m.id } : null);
        else if (id === 'diario') this.guardarNoDiario();
        else if (id === 'compartilhar') this.abrirCompartilhar(gatilho);
        else if (id === 'cartao') this.baixarCartao(this.escopo());
        else if (id === 'editar') navigateTo('novo-mapa', { editar: this.m.id });
        else if (id === 'trocar') this.abrirTrocar(gatilho);
        else if (id === 'exportar') avisar(baixarBackup() ? T.backupOk : T.backupErro, { erro: false });
        else if (id === 'apagar') this.apagarEste();
        else if (id === 'descartar') navigateTo('perfil');
    }

    /* ---------- compartilhar ---------- */

    escopo() {
        return this.aba === 'leitura' ? this.secaoId : 'mapa';
    }

    cartaoDisponivel(escopo) {
        if (escopo === 'mapa') return true;
        const s = this.secoes().find((x) => x.id === escopo);
        return !!(s && s.ponto && s.ponto.cartaDecano);
    }

    abrirCompartilhar(gatilho) {
        const escopo = this.escopo();
        const mapa = escopo === 'mapa';
        const corpo = `<div class="sob-pilha"><label class="diario-marca"><input type="checkbox" data-incluir${this.incluir ? ' checked' : ''}><span>${esc(this.t('ui.compartilhar.marca', {}, 'Incluir data, hora e lugar de nascimento no texto'))}</span></label>
            <p class="sob-nota">${esc(this.t('ui.compartilhar.texto'))}</p>
            <button class="btn btn-ghost" type="button" data-acao="copiar">${ic('copiar')}${T.copiar}</button><button class="btn btn-ghost" type="button" data-acao="compartilhar">${ic('compartilhar')}${T.compartilhar}</button>${this.cartaoDisponivel(escopo) ? `<button class="btn btn-primary" type="button" data-acao="cartao">${ic('baixar')}${T.cartao}</button>` : ''}
            <p class="sob-nota" role="status" aria-live="polite" data-cp-status>&nbsp;</p>
            <details><summary>${T.ver}</summary><pre data-pre>${esc(this.textoCompartilhar(escopo))}</pre></details></div>`;
        const c = abrir({ tipo: 'sheet', titulo: mapa ? T.compMapa : T.compLeitura, gatilho, corpo, foco: '[data-incluir]' });
        c.corpo.addEventListener('change', (e) => {
            if (!e.target.matches('[data-incluir]')) return;
            this.incluir = e.target.checked;
            const pre = c.corpo.querySelector('[data-pre]');
            if (pre) pre.textContent = this.textoCompartilhar(escopo);
        });
        c.corpo.addEventListener('click', (e) => {
            const b = e.target.closest('[data-acao]');
            if (!b) return;
            if (b.dataset.acao === 'copiar') this.copiar(escopo);
            else if (b.dataset.acao === 'compartilhar') this.compartilharTexto(escopo);
            else if (b.dataset.acao === 'cartao') this.baixarCartao(escopo);
        });
        this.sobre = c;
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

    /** Mensagem do compartilhar: dentro do sheet quando aberto; confirmacao curta vira toast. */
    dizerCp(msg, { ok = false, erro = false } = {}) {
        const el = this.sobre && this.sobre.aberto ? this.sobre.corpo.querySelector('[data-cp-status]') : null;
        if (ok) {
            if (el) el.innerHTML = '&nbsp;';
            avisar(msg);
        } else if (el) el.textContent = msg;
        else if (erro) avisar(msg, { erro: true });
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
        this.dizerCp(ok ? T.copiado : T.naoCopiou, { ok, erro: !ok });
    }

    async compartilharTexto(escopo) {
        if (!navigator.share) return this.dizerCp(T.semShare, { erro: true });
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
            if (escopo === 'mapa' || !this.cartaoDisponivel(escopo)) cv = await mod.gerarCartaoMapa({ calc: this.calc, nome, dados });
            else {
                const s = this.secoes().find((x) => x.id === escopo);
                cv = await mod.gerarCartaoSecao({ secao: s, frase: mod.citacao(s.ponto.fraseCarta), nome, dados });
            }
            const ok = await mod.baixarPNG(cv, `aeon-mapa${escopo === 'mapa' ? '' : `-${escopo}`}.png`);
            this.dizerCp(ok ? T.cartaoOk : T.cartaoErro, { ok, erro: !ok });
        } catch (e) {
            this.dizerCp(T.cartaoErro, { erro: true });
        }
    }

    /* ---------- trocar e apagar ---------- */

    abrirTrocar(gatilho) {
        const lista = listar();
        const corpo = `<div class="sob-lista">${lista.map((x) => `<button class="sob-opcao" type="button" data-mapa="${esc(x.id)}"${x.id === this.m.id ? ' aria-current="true"' : ''}>${ic('roda')}<span><b>${esc(x.rotulo)}</b><small>${esc(dataExtenso(x.data))}${x.hora ? `, ${esc(x.hora)}` : ''} · ${esc(x.local.nome)}</small></span>${x.id === this.m.id ? `<span class="marca">${T.trocarAberto}</span>` : ''}</button>`).join('')}
            <button class="btn btn-ghost" type="button" data-novo>${ic('mais')}${T.novoMapa}</button></div>`;
        const c = abrir({ tipo: 'sheet', titulo: T.trocarTitulo, gatilho, corpo, foco: '[aria-current="true"]' });
        c.corpo.addEventListener('click', (e) => {
            const b = e.target.closest('[data-mapa]');
            if (b) {
                if (b.dataset.mapa !== this.m.id) {
                    c.fechar(false);
                    navigateTo('mapa', { id: b.dataset.mapa });
                } else c.fechar();
            } else if (e.target.closest('[data-novo]')) {
                c.fechar(false);
                navigateTo('novo-mapa');
            }
        });
        this.sobre = c;
    }

    apagarEste() {
        const id = this.m.id;
        if (!apagarMapaComDesfazer(id)) return;
        LEMBRADO.delete(id);
        navigateTo('perfil');
    }

    /* ---------- guardar ---------- */

    guardarNoPerfil() {
        const r = adicionar({ rotulo: this.m.rotulo, data: this.m.data, hora: this.m.hora, local: this.m.local, escolha: this.escolha, casas: this.casas, principal: !!this.m.principal });
        if (!r.id) {
            avisar(T.erroGuardar, { erro: true });
            return;
        }
        this.m = obter(r.id) || this.m;
        this.salvo = true;
        if (!r.ok) persiste();
        avisar(r.repetido ? T.repetidoOk : T.guardadoOk);
        this.desenhar(ehDesktop() ? '.mc-barra [data-exec="perfil"]' : '#abrir-acoes');
    }

    guardarNoDiario() {
        const p = this.calc.pontos;
        const cartas = [['sol', p.sol], ['lua', p.lua], ['asc', this.calc.semHora ? null : p.asc]]
            .filter(([, x]) => x && x.ponte && x.ponte.cartaDecano)
            .map(([pos, x]) => ({ order: Number(x.ponte.cartaDecano.order), pos }));
        const rotulo = ['sol', 'lua', 'asc'].filter((k) => p[k]).map((k) => p[k].signoNome).join(', ');
        const r = criarMapa(cartas, rotulo);
        if (r.ok) avisar(T.diarioOk);
        else avisar(T.diarioErro, { erro: true });
    }

    /* ---------- eventos ---------- */

    abrirCarta(order, origem, rotulo) {
        loadCards().then((lista) => {
            const carta = lista.find((c) => Number(c.order) === Number(order));
            if (!carta) return;
            const s = this.secoes().find((x) => x.id === this.secaoId);
            const dec = this.aba === 'leitura' && s && s.ponto && s.ponto.cartaDecano && Number(s.ponto.cartaDecano.order) === Number(order);
            abrirResumoCarta(carta, { frase: dec ? s.ponto.fraseCarta : '', rotulo, gatilho: origem });
        });
    }

    trocarAba(id, foco) {
        if (!ABAS.some(([k]) => k === id) || id === this.aba) return;
        this.aba = id;
        this.lembrar();
        this.querySelectorAll('.mc-tab').forEach((b) => {
            const sel = b.dataset.aba === id;
            b.setAttribute('aria-selected', String(sel));
            b.tabIndex = sel ? 0 : -1;
        });
        const painel = this.querySelector('#painel-mapa');
        painel.setAttribute('aria-labelledby', `t-${id}`);
        painel.innerHTML = this.painelAtual();
        this.querySelector('[data-avisos]').innerHTML = this.avisosHtml();
        this.querySelector('.mc').dataset.aba = id;
        this.ajustar();
        window.scrollTo(0, 0);
        if (foco) this.querySelector(`#t-${id}`).focus();
    }

    irParaSecao(id, foco) {
        this.secaoId = id;
        this.lembrar();
        this.querySelector('#painel-mapa').innerHTML = this.painelLeitura();
        this.ajustar();
        const chip = this.querySelector(`[data-sec="${CSS.escape(id)}"]`);
        if (chip) {
            if (foco) chip.focus({ preventScroll: true });
            const faixa = chip.closest('.chips');
            if (faixa && faixa.scrollWidth > faixa.clientWidth) faixa.scrollLeft = Math.max(0, chip.offsetLeft - (faixa.clientWidth - chip.offsetWidth) / 2);
        }
    }

    clique(e) {
        const termo = e.target.closest('.termo');
        if (termo) {
            abrirGlossario(termo.dataset.termo, termo);
            return;
        }
        const carta = e.target.closest('[data-carta]');
        if (carta) {
            this.abrirCarta(carta.dataset.carta, carta, carta.dataset.rotulo);
            return;
        }
        const aba = e.target.closest('.mc-tab');
        if (aba) {
            this.trocarAba(aba.dataset.aba);
            return;
        }
        const sec = e.target.closest('[data-sec]');
        if (sec) {
            this.irParaSecao(sec.dataset.sec, true);
            return;
        }
        const ac = e.target.closest('#abrir-acoes');
        if (ac) {
            this.abrirGaveta(ac);
            return;
        }
        const ex = e.target.closest('[data-exec]');
        if (ex) {
            this.executar(ex.dataset.exec, ex);
            return;
        }
        const b = e.target.closest('[data-acao]');
        if (!b) return;
        const a = b.dataset.acao;
        if (a === 'perfil') navigateTo('perfil', this.m.id ? { selecionar: this.m.id } : null);
        else if (a === 'guardar-perfil') this.guardarNoPerfil();
    }

    teclou(e) {
        const tab = e.target.closest && e.target.closest('.mc-tab');
        if (!tab) return;
        const abas = [...this.querySelectorAll('.mc-tab')];
        const i = abas.indexOf(tab);
        let j = -1;
        if (e.key === 'ArrowRight') j = (i + 1) % abas.length;
        else if (e.key === 'ArrowLeft') j = (i + abas.length - 1) % abas.length;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = abas.length - 1;
        if (j < 0) return;
        e.preventDefault();
        this.trocarAba(abas[j].dataset.aba, true);
    }

    async mudou(e) {
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
        if (e.target.matches('[data-casas]')) {
            this.casas = e.target.value;
            try {
                await this.recalcular();
            } catch (err) {
                return;
            }
            const gravou = this.salvo && this.m.id && definirPreferencias(this.m.id, { casas: this.casas });
            this.desenhar('#sel-casas');
            if (gravou) avisar(T.sistemaGravado);
        }
    }

    /* ---------- montagem ---------- */

    ajustar() {
        const desk = ehDesktop();
        this.querySelectorAll('details[data-desk-open]').forEach((d) => {
            if (desk && !d.dataset.tocado) d.open = true;
        });
        this.querySelectorAll('details[data-desk-open]').forEach((d) => {
            if (!d.dataset.liga) {
                d.dataset.liga = '1';
                d.addEventListener('toggle', () => {
                    d.dataset.tocado = '1';
                });
            }
        });
    }

    estrutura() {
        const nome = this.nomeMapa() || T.titulo;
        const guardarIcone = this.salvo ? '' : `<button class="iconbtn round mc-guardar" type="button" data-acao="guardar-perfil" aria-label="${T.guardarPerfil}" title="${T.guardarPerfil}">${ic('guardar')}</button>`;
        const abas = ABAS.map(([k, n]) => `<button class="mc-tab" type="button" role="tab" id="t-${k}" aria-selected="${k === this.aba}" aria-controls="painel-mapa" data-aba="${k}" tabindex="${k === this.aba ? 0 : -1}">${n}</button>`).join('');
        return `<div class="mapa-tela mc" data-aba="${this.aba}">
            <div class="mc-cab">
              <div class="mc-bar">
                <button class="iconbtn round mc-voltar" type="button" data-acao="perfil" aria-label="${T.voltarPerfil}" title="${T.voltarPerfil}">${ic('voltar')}</button>
                <div class="mc-tit"><h2 id="mapa-h" tabindex="-1">${esc(nome)}</h2>${this.salvo ? '' : `<span class="mc-estado">${T.naoGuardado}</span>`}<p class="mc-dados mc-so-desk">${esc(this.dadosLinha())}</p></div>
                <span class="mc-so-cel mc-bar-acoes">${guardarIcone}<button class="iconbtn" id="abrir-acoes" type="button" aria-haspopup="dialog" aria-expanded="false">${ic('maisv')}${T.acoes}</button></span>
              </div>
              <div class="mc-barra mc-so-desk" role="toolbar" aria-label="${T.acoesTitulo}">${this.barraHtml()}</div>
              <div class="mc-tabs" role="tablist" aria-label="${T.abas}">${abas}</div>
            </div>
            <aside class="mc-lado" aria-label="Roda do mapa e resumo"><div class="mc-roda">${this.roda('roda-d')}</div>${this.resumoTres()}</aside>
            <div class="mc-dir"><div data-avisos>${this.avisosHtml()}</div>
              <div id="painel-mapa" class="mc-painel" role="tabpanel" aria-labelledby="t-${this.aba}" tabindex="0">${this.painelAtual()}</div></div>
        </div>`;
    }

    desenhar(foco, inicio) {
        const titulo = document.querySelector('.page-title');
        const h1 = document.querySelector('#page-title');
        if (titulo) titulo.classList.add('sr');
        if (!this.calc) {
            if (h1) h1.textContent = T.eyebrow;
            this.innerHTML = `<div class="mapa-tela"><section class="aviso erro" role="alert">${ic('erro')}<h3 id="mapa-h" tabindex="-1">${T.eyebrow}</h3><div><p>${esc(this.t('ui.erro.geral', {}, 'Não foi possível montar o mapa agora.'))}</p></div></section></div>`;
            if (inicio) focarCabecalho('#mapa-h');
            return;
        }
        if (h1) h1.textContent = T.titulo;
        this.innerHTML = this.estrutura();
        this.ajustar();
        if (inicio) {
            focarCabecalho('#mapa-h');
            return;
        }
        if (foco) {
            const el = this.querySelector(foco);
            if (el) el.focus();
        }
    }
}

customElements.define('mapa-screen', MapaScreen);
