import {iniciar,abrirApp,sleep} from './lib.mjs';
const widths=(process.argv[2]||'360,375,390,412,1280').split(',').map(Number);
const b=await iniciar();const out=[];const falhas=[];
const ok=(n,c,d='')=>{out.push((c?'OK    ':'FALHA ')+n+(d?'  '+d:''));if(!c)falhas.push(n);};
const TELAS=['home','all-cards','three-card-game','history','perfil'];
for(const th of ['crepusculo','aurora'])for(const w of widths){
 const tag=`${th}-${w}`;const desk=w>=900;
 await abrirApp(b,th,w);
 const iw=await b.ev('innerWidth');ok(`${tag} innerWidth==${w}`,iw===w,`iw=${iw}`);
 for(const p of TELAS){
  await b.nav(p);await sleep(300);
  const m=await b.ev(`(()=>{const de=document.documentElement;const app=document.getElementById('app').getBoundingClientRect();const tb=document.querySelector('.topbar').getBoundingClientRect();
   const pt=document.querySelector('.page-title');const ptv=pt&&!pt.hidden&&getComputedStyle(pt).display!=='none';
   const c=document.querySelector('main .container').getBoundingClientRect();const cs=getComputedStyle(document.querySelector('main .container'));
   const first=document.querySelector('#app')?.firstElementChild;const fr=first?first.getBoundingClientRect():null;
   const topo=ptv?pt.getBoundingClientRect().top:(fr?fr.top:null);
   return {sw:de.scrollWidth,appL:Math.round(app.left),appR:Math.round(innerWidth-app.right),padL:cs.paddingLeft,padR:cs.paddingRight,gap:topo==null?null:Math.round(topo-tb.bottom)}})()`);
  const g=m.padL===m.padR&&m.appL===m.appR;
  ok(`${tag} ${p} sem overflow horizontal`,m.sw<=w,`sw=${m.sw}`);
  ok(`${tag} ${p} margens laterais iguais`,g&&m.appL===(w>=600?24:16)||desk&&g,`L=${m.appL} R=${m.appR} pad=${m.padL}`);
  ok(`${tag} ${p} respiro abaixo da barra do topo >=12`,m.gap>=12,`gap=${m.gap}`);
 }
 if(!desk){
  const n=await b.ev(`(()=>{const a=[...document.querySelectorAll('.mainnav a')];const ul=document.querySelector('.mainnav ul').getBoundingClientRect();
   return {n:a.length,cortado:a.filter(x=>{const s=x.querySelector('span');return s.scrollWidth>x.clientWidth||x.getBoundingClientRect().right>innerWidth+0.5}).map(x=>x.textContent.trim()),minW:Math.min(...a.map(x=>x.getBoundingClientRect().width)),minH:Math.min(...a.map(x=>x.getBoundingClientRect().height)),l:Math.round(ul.left),r:Math.round(ul.right)}})()`);
  ok(`${tag} nav 5 itens sem corte e toque>=44`,n.n===5&&!n.cortado.length&&n.minH>=44&&n.minW>=44,JSON.stringify(n));
 }
 // voltar ao topo e rodape (cartas = pagina longa)
 await b.nav('all-cards');
 const topoInit=await b.ev(`(()=>{const s=document.getElementById('scrollToTop');return getComputedStyle(s).display})()`);
 ok(`${tag} voltar ao topo escondido no topo`,topoInit==='none');
 await b.ev('scrollTo(0,900)');await sleep(500);
 const v1=await b.ev(`(()=>{const s=document.getElementById('scrollToTop');const r=s.getBoundingClientRect();const nv=document.querySelector('.mainnav').getBoundingClientRect();return {d:getComputedStyle(s).display,bottom:Math.round(r.bottom),navTop:Math.round(nv.top),right:Math.round(innerWidth-r.right)}})()`);
 ok(`${tag} voltar ao topo aparece e fica acima da nav`,v1.d==='flex'&&(desk||v1.bottom<=v1.navTop-12),JSON.stringify(v1));
 await b.ev('scrollTo(0,document.documentElement.scrollHeight)');await sleep(500);
 const v2=await b.ev(`(()=>{const s=document.getElementById('scrollToTop');const r=s.getBoundingClientRect();const nv=document.querySelector('.mainnav').getBoundingClientRect();
  const alvos=[...document.querySelectorAll('footer p, footer a')].map(e=>e.getBoundingClientRect());
  const cobre=alvos.filter(a=>!(r.right<a.left||r.left>a.right||r.bottom<a.top||r.top>a.bottom)).length;
  const last=[...document.querySelectorAll('footer a')].map(a=>a.getBoundingClientRect().bottom);const lastB=Math.max(...last);
  const minH=Math.min(...[...document.querySelectorAll('footer a')].map(a=>a.getBoundingClientRect().height));
  return {d:getComputedStyle(s).display,cobre,folga:Math.round((desk?innerHeight:nv.top)-lastB),minH:Math.round(minH),bottom:Math.round(r.bottom),navTop:Math.round(nv.top)}})()`);
 ok(`${tag} voltar ao topo no fim nao cobre texto do rodape`,v2.cobre===0,JSON.stringify(v2));
 ok(`${tag} rodape: ultimo link com folga >=16 da nav e toque>=44`,v2.folga>=16&&v2.minH>=44,JSON.stringify(v2));
 await b.shot(`aud-${tag}-rodape`);
 await b.ev('scrollTo(0,0)');await sleep(300);
 // pagina curta: voltar ao topo escondido sem rolagem relevante
 await b.nav('three-card-game');await b.ev('scrollTo(0,400)');await sleep(300);
 const curta=await b.ev(`({alt:document.documentElement.scrollHeight,ih:innerHeight,d:getComputedStyle(document.getElementById('scrollToTop')).display})`);
 ok(`${tag} voltar ao topo respeita rolagem relevante (alt=${curta.alt}, tela=${curta.ih})`,curta.alt>curta.ih*1.5||curta.d==='none',JSON.stringify(curta));
 await b.ev('scrollTo(0,0)');
 // toast: diario apagar
 await b.nav('history');await sleep(500);
 await b.ev('scrollTo(0,500)');await sleep(300);
 await b.click('.diario-item [data-acao="apagar"]');await sleep(800);
 const t=await b.ev(`(()=>{const t=document.querySelector('.toast');const r=t.getBoundingClientRect();const nv=document.querySelector('.mainnav').getBoundingClientRect();const s=document.getElementById('scrollToTop');return {on:t.classList.contains('on'),bottom:Math.round(r.bottom),navTop:Math.round(nv.top),txt:t.textContent,topoVis:getComputedStyle(s).visibility}})()`);
 ok(`${tag} toast acima da nav (margem>=12) e voltar ao topo oculto enquanto isso`,t.on&&(desk||t.bottom<=t.navTop-12)&&t.topoVis==='hidden',JSON.stringify(t));
 await b.shot(`aud-${tag}-toast`);
 // abrir menu: toast some e nao herda
 if(desk)await b.click('.diario-barra [data-exec="apagar-tudo"]');else{await b.click('#abrir-acoes');}
 await sleep(900);
 const t2=await b.ev(`(()=>{const t=document.querySelector('.toast');return {on:t.classList.contains('on'),txt:t.textContent}})()`);
 ok(`${tag} abrir dialogo fecha o aviso anterior`,!t2.on&&t2.txt==='',JSON.stringify(t2));
 await b.key('Escape','Escape',27);await sleep(500);
 // janela de tema com teclado
 await b.ev(`document.querySelector('.topbar .themebtn').focus();document.querySelector('.topbar .themebtn').click()`);await sleep(900);
 const f0=await b.ev(`({foco:document.activeElement.dataset.t,sel:document.querySelector('.themeopt[aria-checked=true]').dataset.t,n:document.querySelectorAll('.themeopt').length})`);
 ok(`${tag} tema: foco abre no selecionado`,f0.foco===th&&f0.sel===th,JSON.stringify(f0));
 await b.shot(`aud-${tag}-tema`);
 const outro=th==='aurora'?'crepusculo':'aurora';
 await b.key(th==='aurora'?'ArrowLeft':'ArrowRight');await sleep(900);
 const f1=await b.ev(`({foco:document.activeElement.dataset.t,tema:document.documentElement.dataset.theme,sel:document.querySelector('.themeopt[aria-checked=true]').dataset.t,tab:[...document.querySelectorAll('.themeopt')].map(x=>x.tabIndex).join(',')})`);
 ok(`${tag} tema: seta aplica ao vivo e move o foco`,f1.foco===outro&&f1.tema===outro&&f1.sel===outro,JSON.stringify(f1));
 await b.key('Home','Home',36);await sleep(900);
 const f2=await b.ev(`document.documentElement.dataset.theme`);
 ok(`${tag} tema: Home vai ao primeiro (crepusculo)`,f2==='crepusculo',f2);
 await b.key('End','End',35);await sleep(900);
 ok(`${tag} tema: End vai ao ultimo (aurora)`,(await b.ev(`document.documentElement.dataset.theme`))==='aurora');
 await b.key(' ',' ',32);await sleep(300);
 await b.key('Tab','Tab',9);
 const f3=await b.ev(`document.activeElement.id`);
 ok(`${tag} tema: Tab leva ao botao fechar`,f3==='themeDlgFechar',f3);
 await b.key('Escape','Escape',27);await sleep(500);
 const f4=await b.ev(`({aberto:document.getElementById('themeDlg').open,foco:document.activeElement.className})`);
 ok(`${tag} tema: Esc fecha e devolve o foco ao botao Tema`,!f4.aberto&&/themebtn/.test(f4.foco),JSON.stringify(f4));
 // volta ao tema original para as proximas rodadas (cada rodada recarrega)
}
// contraste: fim
console.log(out.join('\n'));console.log('\nFALHAS: '+(falhas.length?'\n'+falhas.join('\n'):'nenhuma'));
await b.fim();process.exit(0);
