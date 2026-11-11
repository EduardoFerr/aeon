import {spawn} from 'node:child_process';
import fs from 'node:fs';
const S='/private/tmp/claude-501/-Users-eduardo-Workspace-dev-ticketandgo--claude-worktrees-beautiful-bohr-0baea3/26b9a6ff-4b1e-4e34-b03e-e35c19c6f6bf/scratchpad/';
const OUT=S+'visual/sa-leitura/'+(process.argv[5]||'x')+'/';
fs.mkdirSync(OUT,{recursive:true});
const base='http://localhost:5303';
const PROF='/private/tmp/claude-501/aeon-sa-leitura-test/prof-'+process.pid;
const port=9353;
const widths=(process.argv[2]||'390').split(',').map(Number);
const themes=(process.argv[3]||'crepusculo,aurora').split(',');
const shots=process.argv[4]==='shots';
const ch=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-port='+port,'--user-data-dir='+PROF,'--no-first-run','--no-default-browser-check','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws,id=0;const pend={};
async function conn(){await sleep(2500);const tabs=await (await fetch(`http://127.0.0.1:${port}/json`)).json();ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend[m.id]){pend[m.id](m.result??m.error);delete pend[m.id];}};}
const send=(method,params={})=>new Promise(r=>{pend[++id]=r;ws.send(JSON.stringify({id,method,params}));});
const ev=async(e)=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)return {erro:r.exceptionDetails.exception?.description||'erro'};return r.result?.value;};
const click=async(sel)=>ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;e.click();return true})()`);
const nav=async(p)=>{await ev(`document.querySelector('.mainnav a[data-page="${p}"]').click()`);await sleep(900);};
const key=async(k,code,vk)=>{for(const t of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type:t,key:k,code:code||k,windowsVirtualKeyCode:vk||0,text:t==='keyDown'&&k.length===1?k:undefined});await sleep(120);};
const TAB=()=>key('Tab','Tab',9), ENTER=()=>key('Enter','Enter',13), SPACE=()=>key(' ','Space',32), RIGHT=()=>key('ArrowRight','ArrowRight',39);
const full=async(nome)=>{if(!shots)return;const h=await ev('document.documentElement.scrollHeight');const w=await ev('innerWidth');
 const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:w,height:Math.min(h,6000),scale:1}});fs.writeFileSync(OUT+nome+'.png',Buffer.from(s.data,'base64'));};
const view=async(nome)=>{if(!shots)return;const s=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(OUT+nome+'.png',Buffer.from(s.data,'base64'));};
const SEED=`(()=>{const agora=Date.now();
 localStorage.setItem('aeon:v2:perfil',JSON.stringify({v:2,apelido:'Lia',mapas:[{id:'mapa-a',rotulo:'Meu mapa',data:'1990-05-14',hora:'09:30',local:{nome:'São Paulo, SP',lat:-23.55,lon:-46.63,tz:'America/Sao_Paulo'},principal:true,escolha:0,casas:'placidus',criado:new Date(agora-5e6).toISOString()}]}));
})()`;
// auditoria por tela
const AUD=`(()=>{
 const vis=e=>{const r=e.getBoundingClientRect();const cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&!e.closest('[hidden],[inert]')&&cs.opacity!=='0';};
 const root=document.querySelector('.tarot-card-info:not([hidden])')?document.querySelector('.tarot-card-info'):document.querySelector('#app')||document.body;
 const bts=[...document.querySelectorAll('#app .btn, .tarot-card-info .btn, .sob .btn')].filter(vis);
 const btn=bts.map(b=>{const r=b.getBoundingClientRect();const a=getComputedStyle(b,'::after');return {t:b.textContent.trim().slice(0,22),p:b.classList.contains('btn-primary'),h:+r.height.toFixed(1),hit:+(r.height+ (parseFloat(a.top)||0)*0).toFixed(1)}});
 const ctx=document.createElement('canvas').getContext('2d');
 const par=[];
 for(const p of root.querySelectorAll('p, li, span#card-description, #card-description, .leitura-texto')){
   if(!vis(p))continue;const tx=p.innerText.trim();if(tx.length<45)continue;
   if(p.closest('.sr'))continue;
   const cs=getComputedStyle(p);ctx.font=cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;
   const w=ctx.measureText(tx).width/tx.length;
   const pad=parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight);
   const cw=p.getBoundingClientRect().width-pad;
   const lh=parseFloat(cs.lineHeight)/parseFloat(cs.fontSize);
   par.push({t:tx.slice(0,28),cpl:Math.round(cw/w),lh:+lh.toFixed(2)});}
 // maior vazio vertical sem conteudo (entre elementos visiveis, folhas), na pagina inteira
 const folhas=[];
 for(const e of document.querySelectorAll('#app *, .tarot-card-info .info-body *')){
   if(!vis(e))continue;
   const cs=getComputedStyle(e);const r=e.getBoundingClientRect();
   const temTexto=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
   const caixa=e.matches('img,svg,canvas,button,input,textarea,tarot-card,.leitura-verso')||temTexto||(cs.borderTopWidth!=='0px'&&cs.borderTopStyle!=='none')||(cs.backgroundColor!=='rgba(0, 0, 0, 0)');
   if(caixa&&r.height>0)folhas.push([r.top+scrollY,r.bottom+scrollY]);}
 folhas.sort((a,b)=>a[0]-b[0]);let fim=0,gap=0,gapAt=0;for(const [t,b] of folhas){if(t-fim>gap&&fim>0){gap=t-fim;gapAt=fim;}fim=Math.max(fim,b);}
 return {iw:innerWidth,sw:document.documentElement.scrollWidth,prim:btn.filter(b=>b.p).length,btn,par:par.slice(0,12),gap:Math.round(gap),gapAt:Math.round(gapAt),h:document.documentElement.scrollHeight};})()`;
const linhas=[];const falhas=[];
const audit=async(tag,tela,w)=>{const a=await ev(AUD);if(!a||a.erro){linhas.push(`${tag} ${tela}: ERRO ${JSON.stringify(a)}`);return a;}
 const ruimBtn=a.btn.filter(b=>b.h!==40);const cplMax=Math.max(0,...a.par.map(p=>p.cpl));const lhMin=Math.min(9,...a.par.map(p=>p.lh));const lhMax=Math.max(0,...a.par.map(p=>p.lh));
 const probs=[];if(a.prim>1)probs.push('primarias='+a.prim);if(ruimBtn.length)probs.push('alturaBtn:'+ruimBtn.map(b=>b.t+'='+b.h));if(a.sw>a.iw)probs.push('overflow '+a.sw+'>'+a.iw);if(a.iw!==w)probs.push('iw '+a.iw);
 if(a.par.length&&(cplMax>68))probs.push('cpl>68:'+a.par.filter(p=>p.cpl>68).map(p=>p.t+'='+p.cpl).join('; '));
 if(a.par.length&&(lhMin<1.6||lhMax>1.7))probs.push('lh:'+a.par.filter(p=>p.lh<1.6||p.lh>1.7).map(p=>p.t+'='+p.lh).join('; '));
 if(a.gap>120)probs.push('vazio '+a.gap+'px em y='+a.gapAt);
 linhas.push(`${tag} ${tela}: btn=${a.btn.length} prim=${a.prim} alt=${[...new Set(a.btn.map(b=>b.h))]} par=${a.par.length} cpl<=${cplMax} lh=${a.par.length?lhMin+'-'+lhMax:'-'} vazio=${a.gap} iw=${a.iw}/${a.sw}${probs.length?'  !! '+probs.join(' | '):''}`);
 if(probs.length)falhas.push(`${tag} ${tela}`);return a;};
await conn();await send('Page.enable');
const cenarios=(process.argv[6]||'home,cartas,leitura,teclado').split(',');
for(const theme of themes)for(const w of widths){
 const tag=`${theme}-${w}`;const desk=w>=900;
 await send('Emulation.setDeviceMetricsOverride',{width:w,height:desk?900:812,deviceScaleFactor:desk?1:3,mobile:!desk});
 const fresh=async(rota='/')=>{await send('Page.navigate',{url:base+'/'});await sleep(1200);await ev(`localStorage.clear();sessionStorage.clear();localStorage.setItem('aeon-theme','${theme}');`);await ev(SEED);await send('Page.navigate',{url:base+rota});await sleep(1700);await ev(`document.documentElement.setAttribute('data-theme','${theme}')`);await sleep(300);};
 await fresh();
 if(cenarios.includes('home')){
  await audit(tag,'home-fechada',w);await full(`${tag}-home-fechada`);
  await ev(`document.querySelector('carta-do-dia tarot-card').click()`);await sleep(1500);
  await audit(tag,'home-aberta',w);await full(`${tag}-home-aberta`);
 }
 if(cenarios.includes('cartas')){
  await nav('all-cards');await sleep(600);
  await audit(tag,'cartas',w);await view(`${tag}-cartas-topo`);
  await ev(`(()=>{const i=document.querySelector('#grade-busca');i.value='rei';i.dispatchEvent(new Event('input',{bubbles:true}))})()`);await sleep(600);
  await audit(tag,'cartas-busca',w);await view(`${tag}-cartas-busca`);
  await ev(`(()=>{const i=document.querySelector('#grade-busca');i.value='zzz';i.dispatchEvent(new Event('input',{bubbles:true}))})()`);await sleep(600);
  await audit(tag,'cartas-vazio',w);await view(`${tag}-cartas-vazio`);
  await click('.grade-limpar');await sleep(300);
  await click('[data-grupo="bastoes"]');await sleep(600);await audit(tag,'cartas-filtro',w);await view(`${tag}-cartas-filtro`);
  await ev(`document.querySelector('#all-cards tarot-card:not([hidden])').click()`);await sleep(900);
  const d=await ev(`!!document.querySelector('.tarot-card-info:not([hidden])')`);
  if(!d){await ev(`document.querySelector('#all-cards tarot-card:not([hidden])').focus()`);await ENTER();await sleep(900);}
  await audit(tag,'detalhe',w);await view(`${tag}-detalhe-topo`);
  await ev(`document.querySelector('.info-content').scrollTop=700`);await sleep(300);await view(`${tag}-detalhe-meio`);
  await ev(`document.querySelector('.info-content').scrollTop=1500`);await sleep(300);await view(`${tag}-detalhe-meio2`);
  await ev(`document.querySelector('.info-content').scrollTop=99999`);await sleep(300);await view(`${tag}-detalhe-fim`);
  await full(`${tag}-detalhe-inteiro`);
 }
 if(cenarios.includes('leitura')){
  await fresh();await nav('three-card-game');await sleep(500);
  await audit(tag,'leitura-pergunta',w);await full(`${tag}-leitura-1-pergunta`);
  await ev(`(()=>{const t=document.querySelector('#leitura-pergunta');t.value='O que preciso ver agora?';t.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await click('[data-acao="embaralhar"]');await sleep(700);await full(`${tag}-leitura-2-embaralhar`);await sleep(1400);
  await audit(tag,'leitura-escolher',w);await full(`${tag}-leitura-3-escolher`);
  for(const i of [1,4,7]){await click(`.leitura-carta[data-i="${i}"]`);await sleep(250);}
  await audit(tag,'leitura-escolhidas',w);await full(`${tag}-leitura-4-escolhidas`);
  await click('[data-acao="ver"]');await sleep(900);
  await audit(tag,'leitura-revelar',w);await full(`${tag}-leitura-5-revelar`);
  await ev(`document.querySelector('.leitura-slot tarot-card').click()`);await sleep(1300);
  await audit(tag,'leitura-uma',w);await full(`${tag}-leitura-6-uma`);
  await click('[data-acao="revelar-todas"]');await sleep(3200);
  await audit(tag,'leitura-final',w);await full(`${tag}-leitura-7-final`);await view(`${tag}-leitura-7-final-vista`);
  await ev(`window.scrollTo(0,99999)`);await sleep(300);await view(`${tag}-leitura-7-final-fim`);
 }
}
console.log(linhas.join('\n'));console.log('\nFALHAS: '+(falhas.length?falhas.length+'\n'+falhas.join('\n'):'nenhuma'));
try{ws.close()}catch(e){}ch.kill();await sleep(800);fs.rmSync(PROF,{recursive:true,force:true});process.exit(0);
