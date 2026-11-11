import { navigateTo, consumirEstado, focarCabecalho } from '../utils/navigation.js';
import { ic } from '../utils/glifos.js';
import { avisar } from './Sobreposicao.js';
import { loadCards } from '../utils/cardsUtil.js';
import { obter, principal, adicionar, atualizar, salvarMeusDados, mesmaDefinicao, apelido, LIMITE_APELIDO, persiste } from '../utils/perfil.js';
import { carregarTextos, carregarMotor, texto, esc, nomeMes, calcular, marcadoresHora, atribuicaoGeoNames } from '../utils/mapaComum.js';

/*
 * Formulario de mapa. No modo "Meus dados" (mapa principal) pede so o que muda o calculo: apelido, data, hora e cidade
 * (o fuso vem da cidade). Nome completo, sexo, estado civil, profissao e "signo que acha que e" ficam de fora de proposito:
 * nao alteram o mapa e seriam dado pessoal sem funcao.
 */

/* Textos que ainda nao tem id em textos.json (a interface criada para o formulario). */
const T = {
    novo: 'Nova pessoa',
    editar: 'Editar dados',
    nome: 'Nome do mapa',
    opcional: '(opcional)',
    exNome: 'Ex.: Mãe, Júlia',
    soVoce: 'Só você vê esse nome.',
    apelidoRotulo: 'Como quer ser chamado',
    data: 'Data de nascimento',
    dia: 'Dia', mes: 'Mês', ano: 'Ano',
    hora: 'Hora de nascimento',
    hh: 'Hora (0 a 23)', mm: 'Minutos',
    naoSei: 'Não sei a hora',
    local: 'Local de nascimento',
    buscar: 'Digite o nome da cidade',
    foraDoBrasil: 'Fora do Brasil, só cidades com mais de 15 mil habitantes. A busca é pelo início do nome.',
    coordenadas: 'Informar as coordenadas',
    lat: 'Latitude', lon: 'Longitude', fuso: 'Fuso horário (nome IANA)',
    dicaCoord: 'Latitude de −90 a 90 e longitude de −180 a 180. Sul e oeste levam o sinal de menos. No Brasil, as duas são negativas. O fuso é o nome da lista IANA, como America/Sao_Paulo.',
    voltarBusca: 'Voltar a buscar por cidade',
    privado: 'Os dados de nascimento ficam só neste aparelho.',
    naoAchouTitulo: 'Não encontramos esse local',
    usarHorario: 'Usar este horário',
    ambiguaTitulo: 'Esse horário aconteceu duas vezes',
    inexistenteTitulo: 'Essa hora não existiu',
    voltar: 'Voltar ao perfil',
    guardadoOk: 'Mapa guardado neste aparelho.',
    repetidoOk: 'Esse mapa já estava guardado. Nada foi duplicado.',
    erroRotulo: 'Dê um nome a este mapa, como Mãe ou Júlia.',
    erroData: 'Escolha o dia, o mês e o ano.',
    erroFuturo: 'A data de nascimento não pode estar no futuro.',
    erroHora: 'A hora vai de 0 a 23 e os minutos, de 0 a 59. Se não sabe, marque Não sei a hora.',
    erroLocal: 'Escolha o local na lista ou informe as coordenadas.',
    erroCoord: 'Confira as coordenadas: latitude de −90 a 90 e longitude de −180 a 180.',
    erroFuso: 'Informe o fuso no formato IANA, como America/Sao_Paulo.',
    erroRepetido: 'Já existe um mapa guardado com essa mesma data, hora e lugar.',
    erroLimite: 'O perfil guarda até 50 mapas. Apague algum para adicionar outro.',
    erroGuardar: 'Não foi possível guardar o mapa neste aparelho. O navegador pode estar bloqueando o armazenamento.',
    sugestoes: 'Locais encontrados',
    achados: (n) => `${n} ${n === 1 ? 'local encontrado' : 'locais encontrados'}.`,
};

const num = (v) => parseFloat(String(v).replace(',', '.').trim());
const fusoOk = (tz) => {
    if (typeof tz !== 'string' || !/^[A-Za-z0-9_+\-/]{1,64}$/.test(tz)) return false;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
    } catch (e) {
        return false;
    }
};

export class NovoMapaScreen extends HTMLElement {
    async connectedCallback() {
        const est = consumirEstado() || {};
        this.editando = est.editar ? obter(est.editar) : null;
        this.temPrincipal = !!principal();
        const m = this.editando;
        // "Meus dados": editar o mapa principal, ou o primeiro preenchimento vindo do convite do Perfil
        this.modoEu = !!(m ? m.principal : est.meusDados && !this.temPrincipal);
        this.st = {
            para: m ? (m.principal ? 'mim' : 'outra') : this.modoEu ? 'mim' : 'outra', // para si, so pela tela Meus dados
            rotulo: m ? m.rotulo : '',
            apelido: this.modoEu ? apelido() : '',
            dia: m ? String(Number(m.data.slice(8))) : '',
            mes: m ? String(Number(m.data.slice(5, 7))) : '',
            ano: m ? m.data.slice(0, 4) : '',
            hh: m && m.hora ? m.hora.slice(0, 2) : '',
            mm: m && m.hora ? m.hora.slice(3) : '',
            semHora: !!(m && !m.hora),
            local: m ? { ...m.local } : null,
            q: m ? m.local.nome : '',
            coord: false,
            lat: '', lon: '', tz: '',
            erros: {},
            pendente: null,
            escolha: 0,
            escolhido: false,
            achados: [],
            vazioBusca: false,
            ativo: -1,
            status: '',
        };
        document.querySelector('#page-title').textContent = this.modoEu ? 'Meus dados' : m ? T.editar : T.novo;
        const pt = document.querySelector('.page-title');
        if (pt) pt.classList.add('sr');
        this.innerHTML = '<div class="mapa-tela" aria-busy="true"></div>';
        try {
            this.textos = await carregarTextos();
        } catch (e) {
            this.textos = {};
        }
        if (!this.isConnected) return;
        if (this.modoEu) document.querySelector('#page-title').textContent = this.t('ui.meusdados.titulo', {}, 'Meus dados');
        this.token = 0;
        this.desenhar();
        focarCabecalho('#form-h');
    }

    disconnectedCallback() {
        const t = document.querySelector('.page-title');
        if (t) t.classList.remove('sr');
    }

    t(id, vars, padrao) {
        return texto(this.textos, id, vars, padrao);
    }

    /* ---------- desenho ---------- */

    err(k) {
        const e = this.st.erros[k];
        return e ? `<span class="erro-msg" id="e-${k}">${ic('erro')}<span>${esc(e)}</span></span>` : '';
    }

    inv(k) {
        return this.st.erros[k] ? ` aria-invalid="true" aria-describedby="e-${k}"` : '';
    }

    desenhar(foco) {
        const s = this.st;
        const erros = Object.entries(s.erros);
        const campoDe = { rotulo: 'c-rotulo', data: 'c-dia', hora: 'c-hh', local: s.coord ? 'c-lat' : 'c-q' };
        const resumo = erros.length
            ? `<section class="aviso erro resumo-erros" role="alert" tabindex="-1" id="resumo">${ic('erro')}<h3>Confira ${erros.length} ${erros.length === 1 ? 'campo' : 'campos'} antes de calcular</h3><div><ul>${erros.map(([k, v]) => `<li><a href="#" data-foco="${campoDe[k]}">${esc(v)}</a></li>`).join('')}</ul></div></section>`
            : '';
        const rotuloObrigatorio = s.para === 'outra';
        const titulo = this.modoEu ? this.t('ui.meusdados.titulo', {}, 'Meus dados') : this.editando ? T.editar : T.novo;
        const campoNome = this.modoEu
            ? `<div class="campo"><label class="rot" for="c-apelido">${T.apelidoRotulo} <span class="opc">${T.opcional}</span></label>
              <input class="entrada" id="c-apelido" maxlength="${LIMITE_APELIDO}" autocomplete="nickname" aria-describedby="d-apelido" value="${esc(s.apelido)}"><span class="dica" id="d-apelido">${esc(this.t('ui.meusdados.apelido.dica'))}</span></div>`
            : `<div class="campo"><label class="rot" for="c-rotulo">${T.nome}${rotuloObrigatorio ? '' : ` <span class="opc">${T.opcional}</span>`}</label>
              <input class="entrada" id="c-rotulo" maxlength="40" autocomplete="off" placeholder="${rotuloObrigatorio ? T.exNome : 'Meu mapa'}" value="${esc(s.rotulo)}"${this.inv('rotulo')}${rotuloObrigatorio ? ' aria-required="true"' : ''}>${this.err('rotulo')}<span class="dica">${T.soVoce}</span></div>`;
        const mesesOpt = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}"${String(i + 1) === s.mes ? ' selected' : ''}>${nomeMes(i + 1)[0].toUpperCase() + nomeMes(i + 1).slice(1)}</option>`).join('');
        const dis = s.semHora ? ' disabled' : '';
        const localHtml = s.coord
            ? `<div class="duo"><div><label class="rot-mini" for="c-lat">${T.lat}</label><input class="entrada" id="c-lat" inputmode="decimal" autocomplete="off" placeholder="-23,55" value="${esc(s.lat)}"${this.inv('local')}></div>
               <div><label class="rot-mini" for="c-lon">${T.lon}</label><input class="entrada" id="c-lon" inputmode="decimal" autocomplete="off" placeholder="-46,63" value="${esc(s.lon)}"${this.inv('local')}></div></div>
               <div><label class="rot-mini" for="c-tz">${T.fuso}</label><input class="entrada" id="c-tz" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="America/Sao_Paulo" value="${esc(s.tz)}"${this.inv('local')}></div>${this.err('local')}
               <span class="dica">${T.dicaCoord}</span><button class="link-btn" type="button" data-acao="cidade">${ic('lupa')}${T.voltarBusca}</button>`
            : `<div class="busca">${ic('lupa')}<input class="entrada" id="c-q" role="combobox" aria-expanded="false" aria-controls="sug" aria-autocomplete="list" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${T.buscar}" value="${esc(s.q)}" aria-describedby="d-local"${this.inv('local')}></div>${this.err('local')}
               <div id="sug-area"></div><p class="sr" role="status" aria-live="polite" id="sug-status"></p>
               ${s.local ? `<div class="local-ok">${ic('ok')}<span>${esc(s.local.nome)}</span></div>` : ''}
               <span class="dica" id="d-local">${esc(this.t('ui.form.local'))}</span><span class="dica">${T.foraDoBrasil}</span><button class="link-btn" type="button" data-acao="coord">${ic('pino')}${T.coordenadas}</button>`;
        this.innerHTML = `<div class="mapa-tela"><form class="form-mapa" id="form" novalidate aria-label="${esc(titulo)}">
            <div class="mc-bar form-cab"><button class="iconbtn round mc-voltar" type="button" data-acao="voltar" aria-label="${T.voltar}" title="${T.voltar}">${ic('voltar')}</button><div class="mc-tit"><h2 id="form-h" tabindex="-1">${esc(titulo)}</h2></div></div>
            ${resumo}<div id="pendente-area">${s.pendente ? this.htmlPendente() : ''}</div>
            ${campoNome}
            <fieldset class="campo" id="c-data" aria-describedby="d-data"><legend>${T.data}</legend><div class="trio">
              <div><label class="rot-mini" for="c-dia">${T.dia}</label><input class="entrada" id="c-dia" inputmode="numeric" maxlength="2" autocomplete="off" placeholder="DD" value="${esc(s.dia)}"${this.inv('data')}></div>
              <div><label class="rot-mini" for="c-mes">${T.mes}</label><select class="entrada" id="c-mes"${this.inv('data')}><option value="">${T.mes}</option>${mesesOpt}</select></div>
              <div><label class="rot-mini" for="c-ano">${T.ano}</label><input class="entrada" id="c-ano" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="AAAA" value="${esc(s.ano)}"${this.inv('data')}></div></div>${this.err('data')}<span class="dica" id="d-data">${esc(this.t('ui.form.data'))}</span></fieldset>
            <fieldset class="campo" id="c-hora"><legend>${T.hora}</legend><div class="duo">
              <div><label class="rot-mini" for="c-hh">${T.hh}</label><input class="entrada" id="c-hh" inputmode="numeric" maxlength="2" autocomplete="off" placeholder="HH" value="${esc(s.hh)}"${dis}${this.inv('hora')}></div>
              <div><label class="rot-mini" for="c-mm">${T.mm}</label><input class="entrada" id="c-mm" inputmode="numeric" maxlength="2" autocomplete="off" placeholder="MM" value="${esc(s.mm)}"${dis}${this.inv('hora')}></div></div>${this.err('hora')}
              <label class="diario-marca"><input type="checkbox" id="c-semhora" aria-describedby="d-hora"${s.semHora ? ' checked' : ''}><span>${T.naoSei}</span></label>
              <span class="dica" id="d-hora">${esc(s.semHora ? this.t('ui.form.semhora') : this.t('ui.form.hora'))}</span></fieldset>
            <div class="campo" id="c-local"><label class="rot" for="${s.coord ? 'c-lat' : 'c-q'}">${T.local}</label>${localHtml}</div>
            <div class="rodape-form"><button class="btn btn-primary" type="submit">${esc(this.modoEu && this.editando ? this.t('ui.meusdados.salvar') : this.t('ui.btn.calcular', {}, 'Montar o mapa astral'))}</button>
              <p class="nota-priv">${ic('cadeado')}<span>${this.modoEu ? esc(this.t('ui.meusdados.form.privado')) : T.privado}</span></p>
              <p class="sr" role="status" aria-live="polite" data-status>${esc(s.status)}</p>
              <p class="nota-geonames">${atribuicaoGeoNames(this.textos)}</p></div>
          </form></div>`;
        this.ligar();
        this.desenharSugestoes();
        if (erros.length && !foco) {
            const r = this.querySelector('#resumo');
            if (r) r.focus();
        }
        if (foco) {
            const el = this.querySelector(foco);
            if (el) el.focus();
        }
    }

    htmlPendente() {
        const p = this.st.pendente;
        const amb = p.estado === 'ambigua';
        const corpo = amb ? this.t('ui.aviso.ambigua', { hora1: p.marc.hora1, hora2: p.marc.hora2 }) : this.t('ui.aviso.inexistente', { hora1: p.marc.hora1, hora2: p.marc.hora2 });
        const nomes = [this.t('ui.hora.antes'), this.t('ui.hora.depois')];
        return `<section class="aviso atencao" role="group" aria-labelledby="pend-t" data-pendente>${ic('relogio')}<h3 id="pend-t" tabindex="-1">${amb ? T.ambiguaTitulo : T.inexistenteTitulo}</h3><div><p>${esc(corpo)}</p>
            <fieldset class="campo" style="margin-top:8px"><legend class="rot-mini">${esc(this.t('ui.form.escolha-hora'))}</legend><div class="opcoes" role="radiogroup">
            ${p.marc.rotulos.map((r, i) => `<label class="opcao"><input type="radio" name="amb" value="${i}"${i === this.st.escolha ? ' checked' : ''}><span>${esc(r)}<small>${esc(nomes[i])}</small></span></label>`).join('')}</div></fieldset></div>
            <div class="btn-row"><button class="btn btn-primary" type="button" data-acao="usar-horario">${T.usarHorario}</button></div></section>`;
    }

    desenharSugestoes() {
        const area = this.querySelector('#sug-area');
        const q = this.querySelector('#c-q');
        if (!area || !q) return;
        const s = this.st;
        const status = this.querySelector('#sug-status');
        if (s.achados.length) {
            const n = s.q.trim().length;
            area.innerHTML = `<ul class="sugestoes" id="sug" role="listbox" aria-label="${T.sugestoes}">${s.achados
                .map((l, i) => {
                    const pref = l.nome.slice(0, n);
                    const marca = pref ? `<mark>${esc(pref)}</mark>${esc(l.nome.slice(n))}` : esc(l.nome);
                    return `<li role="option" id="op${i}" data-i="${i}"${i === s.ativo ? ' aria-selected="true"' : ' aria-selected="false"'}>${ic('pino')}<span><b>${marca}${l.admin ? `, ${esc(l.admin)}` : ''}</b><small>${esc(l.paisNome)}</small></span></li>`;
                })
                .join('')}</ul>`;
            q.setAttribute('aria-expanded', 'true');
            if (s.ativo >= 0) q.setAttribute('aria-activedescendant', `op${s.ativo}`);
            else q.removeAttribute('aria-activedescendant');
            if (status) status.textContent = T.achados(s.achados.length);
        } else {
            q.setAttribute('aria-expanded', 'false');
            q.removeAttribute('aria-activedescendant');
            area.innerHTML = s.vazioBusca
                ? `<section class="aviso erro" role="status">${ic('erro')}<h3>${T.naoAchouTitulo}</h3><div><p>${esc(this.t('ui.form.busca-vazia'))}</p></div><div class="btn-row"><button class="btn btn-ghost" type="button" data-acao="coord">${ic('pino')}${T.coordenadas}</button></div></section>`
                : '';
            if (status) status.textContent = '';
        }
        area.querySelectorAll('[data-acao="coord"]').forEach((b) => b.addEventListener('click', () => this.irCoord()));
    }

    /* ---------- eventos ---------- */

    guardarCampos() {
        const v = (id) => {
            const e = this.querySelector(`#${id}`);
            return e ? e.value : null;
        };
        const s = this.st;
        const campos = { rotulo: 'c-rotulo', apelido: 'c-apelido', dia: 'c-dia', mes: 'c-mes', ano: 'c-ano', hh: 'c-hh', mm: 'c-mm', lat: 'c-lat', lon: 'c-lon', tz: 'c-tz' };
        Object.entries(campos).forEach(([k, id]) => {
            const x = v(id);
            if (x !== null) s[k] = x;
        });
    }

    irCoord() {
        this.guardarCampos();
        this.st.coord = true;
        this.st.local = null;
        this.st.achados = [];
        this.st.vazioBusca = false;
        this.desenhar('#c-lat');
    }

    invalidarPendente() {
        if (!this.st.pendente) return;
        this.st.pendente = null;
        this.st.escolhido = false;
        const a = this.querySelector('#pendente-area');
        if (a) a.innerHTML = '';
    }

    ligar() {
        const f = this.querySelector('#form');
        const s = this.st;
        f.addEventListener('submit', (e) => {
            e.preventDefault();
            this.enviar();
        });
        f.addEventListener('change', (e) => {
            if (e.target.id === 'c-semhora') {
                this.guardarCampos();
                s.semHora = e.target.checked;
                this.invalidarPendente();
                this.desenhar('#c-semhora');
            } else if (e.target.name === 'amb') {
                s.escolha = Number(e.target.value);
            } else if (e.target.id === 'c-mes') {
                this.invalidarPendente();
            }
        });
        f.addEventListener('input', (e) => {
            if (e.target.name === 'amb') return;
            if (['c-dia', 'c-mes', 'c-ano', 'c-hh', 'c-mm', 'c-lat', 'c-lon', 'c-tz'].includes(e.target.id)) this.invalidarPendente();
        });
        f.addEventListener('click', (e) => {
            const foco = e.target.closest('[data-foco]');
            if (foco) {
                e.preventDefault();
                const el = this.querySelector(`#${foco.dataset.foco}`);
                if (el) el.focus();
                return;
            }
            const li = e.target.closest('.sugestoes li');
            if (li) {
                this.escolher(Number(li.dataset.i));
                return;
            }
            const b = e.target.closest('[data-acao]');
            if (!b) return;
            if (b.dataset.acao === 'coord') this.irCoord();
            if (b.dataset.acao === 'cidade') {
                this.guardarCampos();
                s.coord = false;
                this.desenhar('#c-q');
            }
            if (b.dataset.acao === 'voltar') navigateTo('perfil', this.editando ? { selecionar: this.editando.id } : null);
            if (b.dataset.acao === 'usar-horario') {
                const r = this.querySelector('[name="amb"]:checked');
                s.escolha = r ? Number(r.value) : s.escolha;
                s.escolhido = true;
                this.enviar();
            }
        });
        f.addEventListener('mousedown', (e) => {
            if (e.target.closest('.sugestoes')) e.preventDefault(); // nao tira o foco do campo
        });
        const q = this.querySelector('#c-q');
        if (q) {
            q.addEventListener('input', () => {
                s.q = q.value;
                s.local = null;
                s.vazioBusca = false;
                s.ativo = -1;
                const ok = this.querySelector('.local-ok');
                if (ok) ok.remove();
                this.invalidarPendente();
                clearTimeout(this.espera);
                this.espera = setTimeout(() => this.buscar(), 160);
            });
            q.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && s.achados.length) {
                    e.preventDefault();
                    s.achados = [];
                    s.ativo = -1;
                    this.desenharSugestoes();
                    return;
                }
                if (!s.achados.length) {
                    // lista fechada pelo Esc: seta para baixo reabre a busca, como no padrao ARIA do combobox
                    if (e.key === 'ArrowDown' && !s.local && s.q.trim().length >= 2) {
                        e.preventDefault();
                        this.buscar().then(() => {
                            if (s.achados.length) {
                                s.ativo = 0;
                                this.desenharSugestoes();
                            }
                        });
                    }
                    return;
                }
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const n = s.achados.length;
                    s.ativo = (s.ativo + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
                    this.desenharSugestoes();
                } else if (e.key === 'Enter' && s.ativo >= 0) {
                    e.preventDefault();
                    this.escolher(s.ativo);
                }
            });
        }
    }

    async buscar() {
        const s = this.st;
        const q = s.q.trim();
        const minha = ++this.token;
        if (q.length < 2) {
            s.achados = [];
            s.vazioBusca = false;
            this.desenharSugestoes();
            return;
        }
        try {
            const motor = await carregarMotor();
            const r = await motor.buscarLocais(q, { limite: 6 });
            if (minha !== this.token || !this.isConnected) return;
            s.achados = r;
            s.vazioBusca = r.length === 0;
        } catch (e) {
            if (minha !== this.token) return;
            s.achados = [];
            s.vazioBusca = true;
        }
        this.desenharSugestoes();
    }

    escolher(i) {
        const s = this.st;
        const l = s.achados[i];
        if (!l) return;
        s.local = { nome: l.rotulo, lat: l.lat, lon: l.lon, tz: l.tz };
        s.q = l.rotulo;
        s.achados = [];
        s.ativo = -1;
        s.vazioBusca = false;
        delete s.erros.local;
        this.guardarCampos();
        this.desenhar('#c-q');
    }

    /* ---------- validacao e envio ---------- */

    validar() {
        const s = this.st;
        const er = {};
        const d = Number(s.dia);
        const m = Number(s.mes);
        const a = Number(s.ano);
        if (s.para === 'outra' && !s.rotulo.trim()) er.rotulo = T.erroRotulo;
        if (!/^\d{1,2}$/.test(String(s.dia).trim()) || !m || !/^\d{4}$/.test(String(s.ano).trim()) || !d) {
            er.data = T.erroData;
        } else if (a < 1800 || a > 2100) {
            er.data = this.t('ui.erro.data');
        } else {
            const dm = new Date(a, m, 0).getDate();
            if (d > dm) er.data = `Esse dia não existe em ${nomeMes(m)}. Confira o dia.`;
            else if (new Date(a, m - 1, d) > new Date()) er.data = T.erroFuturo;
        }
        if (!s.semHora) {
            const ok = /^\d{1,2}$/.test(String(s.hh).trim()) && /^\d{1,2}$/.test(String(s.mm).trim()) && Number(s.hh) <= 23 && Number(s.mm) <= 59;
            if (!ok) er.hora = T.erroHora;
        }
        if (s.coord) {
            const la = num(s.lat);
            const lo = num(s.lon);
            if (!(la >= -90 && la <= 90) || !(lo >= -180 && lo <= 180) || s.lat === '' || s.lon === '') er.local = T.erroCoord;
            else if (!fusoOk(String(s.tz).trim())) er.local = T.erroFuso;
        } else if (!s.local) {
            er.local = T.erroLocal;
        }
        return er;
    }

    async enviar() {
        this.guardarCampos();
        const s = this.st;
        s.erros = this.validar();
        if (Object.keys(s.erros).length) {
            this.desenhar();
            return;
        }
        const pad = (n) => String(Number(n)).padStart(2, '0');
        const local = s.coord
            ? { nome: `${num(s.lat).toFixed(2)}, ${num(s.lon).toFixed(2)}`, lat: num(s.lat), lon: num(s.lon), tz: s.tz.trim() }
            : s.local;
        const entrada = {
            rotulo: this.modoEu && this.editando ? this.editando.rotulo : s.rotulo.trim() || (s.para === 'mim' ? 'Meu mapa' : ''),
            data: `${String(s.ano).trim()}-${pad(s.mes)}-${pad(s.dia)}`,
            hora: s.semHora ? null : `${pad(s.hh)}:${pad(s.mm)}`,
            local,
            escolha: s.escolha,
            principal: s.para === 'mim',
        };
        // mesma data, hora e lugar: vale a escolha da hora ambigua que ja estava gravada, sem perguntar de novo
        if (this.editando && mesmaDefinicao(this.editando, entrada)) {
            s.escolha = this.editando.escolha;
            s.escolhido = true;
        }
        const botao = this.querySelector('[type="submit"]');
        if (botao) botao.disabled = true;
        const status = this.querySelector('[data-status]');
        if (status) status.textContent = this.t('ui.carregando');
        let calc;
        try {
            await loadCards();
            calc = await calcular({ ...entrada, escolha: s.escolhido ? s.escolha : 0 });
        } catch (e) {
            if (!this.isConnected) return;
            if (botao) botao.disabled = false;
            s.erros = {};
            this.desenhar();
            const st = this.querySelector('[data-status]');
            if (st) {
                st.classList.remove('sr');
                st.textContent = e && e.codigo === 'data_fora_do_intervalo' ? this.t('ui.erro.data') : this.t('ui.erro.geral');
            }
            return;
        }
        if (!this.isConnected) return;
        if (calc.hora.estado !== 'normal' && !s.escolhido) {
            const marc = await marcadoresHora(calc, entrada.local.tz);
            s.pendente = { estado: calc.hora.estado, marc };
            s.escolha = 1;
            s.erros = {};
            this.desenhar('#pend-t');
            return;
        }
        if (this.modoEu) {
            // Meus dados: a pessoa informa os proprios dados de proposito, entao guarda direto, sem a etapa "nao guardado"
            const r = salvarMeusDados({ ...entrada, escolha: s.escolhido ? s.escolha : 0, apelido: s.apelido });
            if (!r.id) {
                s.erros = { local: r.motivo === 'repetido' ? T.erroRepetido : r.motivo === 'limite' ? T.erroLimite : T.erroGuardar };
                this.desenhar();
                return;
            }
            if (!r.ok) persiste();
            if (this.editando) navigateTo('perfil', { selecionar: r.id, aviso: 'dados' });
            else navigateTo('mapa', { id: r.id });
            return;
        }
        if (!this.editando) {
            // mapa novo: guarda direto e abre o mapa guardado (apagar e reversivel, entao nao ha etapa "nao guardado")
            const n = adicionar({ ...entrada, escolha: s.escolhido ? s.escolha : 0 });
            if (!n.id) {
                s.erros = { local: n.motivo === 'limite' ? T.erroLimite : T.erroGuardar };
                this.desenhar();
                return;
            }
            if (!n.ok) persiste();
            navigateTo('mapa', { id: n.id });
            avisar(n.repetido ? T.repetidoOk : T.guardadoOk);
            return;
        }
        const r = atualizar(this.editando.id, entrada);
        if (!r.ok && !r.id) {
            s.erros = { local: r.motivo === 'repetido' ? T.erroRepetido : r.motivo === 'limite' ? T.erroLimite : T.erroGuardar };
            this.desenhar();
            return;
        }
        if (!r.ok) {
            // calculou e guardou em memoria, mas o navegador nao deixou gravar
            persiste();
        }
        navigateTo('perfil', { selecionar: r.id, aviso: r.repetido ? 'repetido' : 'guardado' });
    }
}

customElements.define('novo-mapa-screen', NovoMapaScreen);
