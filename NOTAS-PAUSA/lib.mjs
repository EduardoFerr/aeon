import {spawn} from 'node:child_process';
import fs from 'node:fs';
export const S='/private/tmp/claude-501/-Users-eduardo-Workspace-dev-ticketandgo--claude-worktrees-beautiful-bohr-0baea3/26b9a6ff-4b1e-4e34-b03e-e35c19c6f6bf/scratchpad/';
export const OUT=S+'visual/sa-perfil/';
fs.mkdirSync(OUT,{recursive:true});
export const base='http://127.0.0.1:5301';
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const PROF='/private/tmp/claude-501/aeon-sa-perfil-test/prof-'+process.pid;
const port=9361+Math.floor(Math.random()*20);
let ws,id=0,ch;const pend={};
export async function abrir(){
  ch=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-port='+port,'--user-data-dir='+PROF,'--no-first-run','--no-default-browser-check','about:blank'],{stdio:'ignore'});
  await sleep(2500);
  const tabs=await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>ws.onopen=r);
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend[m.id]){pend[m.id](m.result??m.error);delete pend[m.id];}};
  await send('Page.enable');
}
export async function fechar(){try{ws.close()}catch(e){}ch.kill();await sleep(800);fs.rmSync(PROF,{recursive:true,force:true});}
export const send=(method,params={})=>new Promise(r=>{pend[++id]=r;ws.send(JSON.stringify({id,method,params}));});
export const ev=async(e)=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)return {erro:r.exceptionDetails.exception?.description||'erro'};return r.result?.value;};
export const shot=async(nome,full=false)=>{const p={format:'png'};if(full){const m=await send('Page.getLayoutMetrics');const h=Math.ceil(m.cssContentSize?.height||m.contentSize.height);const w=Math.ceil(m.cssContentSize?.width||m.contentSize.width);p.clip={x:0,y:0,width:w,height:Math.min(h,4000),scale:1};p.captureBeyondViewport=true;}const s=await send('Page.captureScreenshot',p);fs.writeFileSync(OUT+nome+'.png',Buffer.from(s.data,'base64'));};
export const click=async(sel)=>ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;e.click();return true})()`);
export const nav=async(p)=>{await ev(`document.querySelector('.mainnav a[data-page="${p}"]').click()`);await sleep(900);};
export const setv=(s,v)=>ev(`(()=>{const e=document.querySelector(${JSON.stringify(s)});if(!e)return false;e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
export async function dispositivo(w,theme){
  const desk=w>=900;
  await send('Emulation.setDeviceMetricsOverride',{width:w,height:desk?900:812,deviceScaleFactor:desk?1:3,mobile:!desk});
  await send('Page.navigate',{url:base+'/'});await sleep(1200);
  await ev(`localStorage.clear();localStorage.setItem('aeon-theme','${theme}')`);
}
export async function carregar(theme,seed){
  if(seed)await ev(seed);
  await send('Page.navigate',{url:base+'/'});await sleep(1800);
  await ev(`document.documentElement.setAttribute('data-theme','${theme}')`);await sleep(400);
}
const MAPA=(id,rot,data,hora,nome,lat,lon,tz,princ,extra='')=>`{id:'${id}',rotulo:'${rot}',data:'${data}',hora:${hora?`'${hora}'`:'null'},local:{nome:'${nome}',lat:${lat},lon:${lon},tz:'${tz}'},principal:${princ},escolha:0,casas:'placidus',criado:new Date(agora-${princ?5e6:4e6}).toISOString()${extra}}`;
export const SP=(p=true)=>MAPA('mapa-a','Meu mapa','1990-05-14','09:30','São Paulo, SP',-23.55,-46.63,'America/Sao_Paulo',p);
export const ANA=MAPA('mapa-b','Ana','1985-11-02',null,'Recife, PE',-8.05,-34.88,'America/Recife',false);
export const JU=MAPA('mapa-c','Júlia','1998-03-21','23:15','Rio de Janeiro, RJ',-22.91,-43.17,'America/Sao_Paulo',false);
export const seed=(mapas,ap='Lia')=>`(()=>{const agora=Date.now();localStorage.setItem('aeon:v2:perfil',JSON.stringify({v:2${ap?`,apelido:'${ap}'`:''},mapas:[${mapas.join(',')}]}));})()`;
export const MED=`(()=>{const out=[];for(const b of document.querySelectorAll('#app .btn, .sob .btn, .toast .btn')){if(!b.getClientRects().length||getComputedStyle(b).visibility==='hidden')continue;const r=b.getBoundingClientRect();if(!r.width)continue;const cs=getComputedStyle(b);const a=getComputedStyle(b,'::after');out.push({t:b.textContent.trim().slice(0,22),c:[...b.classList].filter(x=>x!=='btn').join('.')||'base',h:+r.height.toFixed(1),rad:cs.borderTopLeftRadius,fs:cs.fontSize,sh:cs.boxShadow,hit:+(r.height+(parseFloat(a.top)||0)*-1+(parseFloat(a.bottom)||0)*-1).toFixed(1),prim:b.classList.contains('btn-primary')});}
const ic=[...document.querySelectorAll('#app .iconbtn,#app .mc-tab,#app button.ver,#app [role=tab]')].filter(b=>b.getClientRects().length).map(b=>{const r=b.getBoundingClientRect();return {t:(b.getAttribute('aria-label')||b.textContent).trim().slice(0,20),w:Math.round(r.width),h:Math.round(r.height)};}).filter(x=>x.h<44||x.w<44);
return {iw:innerWidth,sw:document.documentElement.scrollWidth,n:out.length,prim:out.filter(x=>x.prim).length,b:out,pequenos:ic};})()`;
export const linhas=[];export const falhas=[];
export const medir=async(tag,tela,rad,maxBtn)=>{const m=await ev(MED);if(!m||m.erro){linhas.push(`${tag} ${tela}: ERRO ${JSON.stringify(m)}`);falhas.push(tag+' '+tela+' erro');return m;}
 const ruim=m.b.filter(x=>x.h!==40||x.rad!==rad||x.fs!=='14px'||x.sh!=='none'||x.hit<44);
 const iwok=m.sw<=m.iw;
 const pOk=m.prim<=1;
 linhas.push(`${tag} ${tela}: btn=${m.n} prim=${m.prim} alt=${[...new Set(m.b.map(x=>x.h))]} raio=${[...new Set(m.b.map(x=>x.rad))]} fonte=${[...new Set(m.b.map(x=>x.fs))]} toque=${[...new Set(m.b.map(x=>x.hit))]} iw=${m.iw} sw=${m.sw}${m.pequenos.length?' TOQUE<44:'+JSON.stringify(m.pequenos):''}${ruim.length?' FORA:'+JSON.stringify(ruim.slice(0,3)):''}`);
 if(ruim.length||!pOk||!iwok||m.pequenos.length)falhas.push(`${tag} ${tela}`);
 if(maxBtn!=null&&m.n>maxBtn){falhas.push(`${tag} ${tela} btn>${maxBtn}`);}
 return m;};
