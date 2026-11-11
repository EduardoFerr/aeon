import {spawn} from 'node:child_process';
import fs from 'node:fs';
export const S='/private/tmp/claude-501/-Users-eduardo-Workspace-dev-ticketandgo--claude-worktrees-beautiful-bohr-0baea3/26b9a6ff-4b1e-4e34-b03e-e35c19c6f6bf/scratchpad/visual/sa-global/';
export const base='http://localhost:5304';
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function iniciar(port=9355){
  const PROF='/private/tmp/claude-501/aeon-sa-test/prof-'+process.pid;
  const ch=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-port='+port,'--user-data-dir='+PROF,'--no-first-run','--no-default-browser-check','about:blank'],{stdio:'ignore'});
  await sleep(2500);
  const tabs=await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>ws.onopen=r);
  let id=0;const pend={};
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend[m.id]){pend[m.id](m.result??m.error);delete pend[m.id];}};
  const send=(method,params={})=>new Promise(r=>{pend[++id]=r;ws.send(JSON.stringify({id,method,params}));});
  const ev=async(e)=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)return {erro:r.exceptionDetails.exception?.description||'erro'};return r.result?.value;};
  const shot=async(nome,clip)=>{const p={format:'png'};if(clip)p.clip={...clip,scale:1};const s=await send('Page.captureScreenshot',p);fs.writeFileSync(S+nome+'.png',Buffer.from(s.data,'base64'));};
  const click=sel=>ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;e.click();return true})()`);
  const nav=async p=>{await ev(`document.querySelector('.mainnav a[data-page="${p}"]').click()`);await sleep(900);};
  const key=async(k,code,vk)=>{for(const t of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type:t,key:k,code:code||k,windowsVirtualKeyCode:vk||0});};
  const fim=async()=>{try{ws.close()}catch(e){}ch.kill();await sleep(800);fs.rmSync(PROF,{recursive:true,force:true});};
  const dispositivo=async(w,h=812,dsf=3)=>{const desk=w>=900;await send('Emulation.setDeviceMetricsOverride',{width:w,height:desk?900:h,deviceScaleFactor:desk?1:dsf,mobile:!desk});};
  return {send,ev,shot,click,nav,key,fim,dispositivo};
}
export const SEED=`(()=>{
 const agora=Date.now();
 localStorage.setItem('aeon:v2:perfil',JSON.stringify({v:2,apelido:'Lia',mapas:[
  {id:'mapa-a',rotulo:'Meu mapa',data:'1990-05-14',hora:'09:30',local:{nome:'São Paulo, SP',lat:-23.55,lon:-46.63,tz:'America/Sao_Paulo'},principal:true,escolha:0,casas:'placidus',criado:new Date(agora-5e6).toISOString()},
  {id:'mapa-b',rotulo:'Ana',data:'1985-11-02',hora:null,local:{nome:'Recife, PE',lat:-8.05,lon:-34.88,tz:'America/Recife'},principal:false,escolha:0,casas:'placidus',criado:new Date(agora-4e6).toISOString()}]}));
 const d=(h)=>new Date(agora-h*3600e3).toISOString();
 localStorage.setItem('aeon:v2:diario',JSON.stringify({v:2,entradas:[
  {id:'l-1',t:d(1),tipo:'leitura',cartas:[{order:3,pos:'passado'},{order:10,pos:'presente'},{order:22,pos:'futuro'}],nota:'Primeira nota',m:d(1),pergunta:'O que vem?'},
  {id:'l-2',t:d(30),tipo:'leitura',cartas:[{order:5,pos:'passado'},{order:11,pos:'presente'},{order:40,pos:'futuro'}],nota:'',m:d(30)},
  {id:'l-3',t:d(60),tipo:'leitura',cartas:[{order:7,pos:'passado'},{order:12,pos:'presente'},{order:41,pos:'futuro'}],nota:'Outra',m:d(60)}],ocultos:[]}));
})()`;
export async function abrirApp(b,theme,w,extra={}){
  await b.dispositivo(w);
  await b.send('Page.navigate',{url:base+'/'});await sleep(1200);
  await b.ev(`localStorage.clear();localStorage.setItem('aeon.tema','${theme}');`);await b.ev(SEED);
  await b.send('Page.navigate',{url:base+'/'});await sleep(2200);
}
