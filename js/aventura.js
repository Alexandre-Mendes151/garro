/* GARRO — Aventura: mapa de fases; cada fase é um jogo de plataforma: o bichinho corre, pula, se abaixa,
   pula na cabeça dos bichinhos selvagens e solta o Poder do elemento. O mapa de cada fase vem do JSON.
   Conteúdo (fases, inimigos, níveis, prêmios, regras da luta e da energia) vem de data/aventura.json (window.GD.aventura).
   Logado: começar gasta energia no servidor, e o servidor confere a vitória antes de pagar (rpc_adv_start / rpc_adv_end).
   Sem login: progresso e energia ficam no aparelho. */
(function(){
const G=window.GARRO,GD=window.GD||{},D=GD.aventura,PD=GD.pelucias;
if(!G||!D||!PD)return;
const $=id=>document.getElementById(id);
const LT=D.luta,EN=D.energia,STAT=PD.STAT,ELEM=PD.ELEM,ECOL=PD.ECOL,ELNAME=PD.ELNAME,BFX=(GD.modelos&&GD.modelos.BFX)||{};
const FASES=[];D.mundos.forEach(m=>m.fases.forEach(f=>FASES.push(Object.assign({mundo:m},f))));
const LKEY='garro-aventura';

// ---------- números da luta (mesmas fórmulas usadas para equilibrar as fases) ----------
const media=a=>a.reduce((x,y)=>x+y,0)/a.length;
const MB=media(STAT.slice(0,G.CH0).map(s=>(s[0]+s[1])/2)),MS=media(STAT.slice(G.CH0).map(s=>(s[0]+s[1])/2));
// o nível pesa muito: ataque, defesa e vida crescem juntos; bichinhos redondos são equiparados aos grandes
function lutador(i,lv,o){o=o||{};const s=STAT[i],M=i<G.CH0?MB:MS,k=MB/M,a=(s[0]+M)/2*k,d=(s[1]+M)/2*k;
  const P=1+LT.nivel_k*(lv-1),ev=(i<G.CH0&&lv>=G.EVO_LV)?LT.evoluido:1;
  let atk=a*P*ev,def=d*P*ev,hp=(a+d)*P*ev*LT.vida_k*(o.heroi?LT.heroi_vida:1);
  if(o.chefe){hp*=LT.chefe_vida;atk*=LT.chefe_ataque}
  hp=Math.round(hp);return{i,lv,atk,def,hp,max:hp,el:ELEM[i],cd:0,defesa:false,chefe:!!o.chefe}}
const grupo=el=>(D.grupos&&D.grupos[el])||el;
function elemMult(A,B){const a=grupo(A.el),b=grupo(B.el);if((D.vantagens[a]||[]).includes(b))return LT.vantagem;if((D.vantagens[b]||[]).includes(a))return LT.desvantagem;return 1}
function dano(A,B,mult){const em=elemMult(A,B);let d=A.atk*mult*(1-LT.variacao+Math.random()*2*LT.variacao)*60/(60+B.def)*em;
  const crit=Math.random()<LT.critico;if(crit)d*=1.5;if(B.defesa)d*=LT.defesa;return{d:Math.max(1,Math.round(d)),crit,em}}
function nivelMax(f){return Math.max(...f.inimigos.map(x=>x[1]).concat(f.chefe?[f.chefe[1]]:[]))}
function recomendado(f){return nivelMax(f)+(f.chefe?2:3)}
// o servidor só aceita vitória se o bichinho tiver pelo menos este nível (nível do inimigo mais forte − folga)
function nivelMin(f){return Math.max(1,nivelMax(f)-(D.nivel_min_folga??6))}

// ---------- estado: progresso (estrelas por fase) e energia por bichinho ----------
let L={prog:{},en:{}};try{const o=JSON.parse(localStorage.getItem(LKEY)||'');if(o&&o.prog)L=Object.assign(L,o)}catch(e){}
function saveL(){try{localStorage.setItem(LKEY,JSON.stringify(L))}catch(e){}}
let S=null;// vindo do servidor quando logado
const box=()=>G.online()&&S?S:L;
function liberada(k){return k===0||!!box().prog[FASES[k-1].id]}
function energia(i){const r=box().en[i];if(!r)return{e:EN.max,s:Date.now(),falta:0};let e=r.e,s=r.s;const step=EN.recarga_min*6e4;
  if(e<EN.max){const n=Math.floor((Date.now()-s)/step);if(n>0){e=Math.min(EN.max,e+n);s=e>=EN.max?Date.now():s+n*step}}
  return{e,s,falta:e>=EN.max?0:Math.max(0,s+step-Date.now())}}
function tempo(ms){const m=Math.ceil(ms/6e4);return m>=60?Math.floor(m/60)+'h'+(m%60?String(m%60).padStart(2,'0'):''):m+' min'}
async function carregarServidor(){
  if(!G.online())return;
  try{const sb=G.sb();const [{data:p},{data:e}]=await Promise.all([sb.from('adventure_progress').select('stage,stars'),sb.from('adventure_energy').select('plush_id,energy,since')]);
    const n={prog:{},en:{}};(p||[]).forEach(r=>{n.prog[r.stage]=r.stars});(e||[]).forEach(r=>{n.en[r.plush_id]={e:r.energy,s:Date.parse(r.since)}});S=n;
    if(!pan.hidden&&TELA==='mapa')mapa();else if(!pan.hidden&&TELA==='escolha')escolha(FK)
  }catch(err){console.warn('aventura',err)}
}

// ---------- tela ----------
const tabs=document.querySelector('.mtabs');
if(tabs&&!$('mach3')){const b=document.createElement('button');b.id='mach3';b.type='button';b.textContent='🗺️ Aventura';tabs.appendChild(b);tabs.classList.add('tres')}
const pan=document.createElement('div');pan.className='adv';pan.id='aventura';pan.hidden=true;
pan.innerHTML='<div class="advtop"><button id="advBack" type="button" aria-label="Voltar">‹</button><h3 id="advTitle">Aventura</h3><span id="advCoins"></span></div><div class="advmsg" id="advMsg"></div><div class="advbody" id="advBody"></div>';
document.body.appendChild(pan);
let TELA='mapa',FK=0,SEL=null,RUN=null;
function moedas(){$('advCoins').textContent=G.coins()+' 🪙'}
function msg(t){$('advMsg').textContent=t||''}
function abrir(){G.click(650);msg('');pan.hidden=false;mapa();carregarServidor()}
function fechar(){if(RUN&&!RUN.fim)return desistir();pan.hidden=true;RUN=null}
$('mach3').addEventListener('click',abrir);
$('advBack').addEventListener('click',()=>{if(TELA==='mapa')fechar();else if(TELA==='escolha')mapa();else desistir()});

function estrelas(n){return '★'.repeat(n)+'☆'.repeat(3-n)}
// mapa: caminho de baixo (fase 1) para cima (chefe)
const XS=[50,74,30,66,26,70,34,72,30,50];
function mapa(){TELA='mapa';RUN=null;moedas();const M=FASES[0].mundo;$('advTitle').textContent=M.nome;
  const n=FASES.length,H=n*104+150,pos=FASES.map((f,k)=>({x:XS[k%XS.length],y:H-80-k*104}));
  let d='M'+pos[0].x+' '+pos[0].y;for(let k=1;k<n;k++){const a=pos[k-1],b=pos[k],my=(a.y+b.y)/2;d+=' C'+a.x+' '+my+' '+b.x+' '+my+' '+b.x+' '+b.y}
  let h='<div class="advmap" style="height:'+H+'px"><svg viewBox="0 0 100 '+H+'" preserveAspectRatio="none"><path d="'+d+'" class="trilha"/><path d="'+d+'" class="trilha2"/></svg>';
  const deco=['🌲','🌳','🍄','🌿','🌸','🌲','🌳','🪨'];for(let k=0;k<26;k++){const x=(k*37+11)%92+2,y=(k*131+40)%(H-40);h+='<span class="advdeco" style="left:'+x+'%;top:'+y+'px">'+deco[k%deco.length]+'</span>'}
  let cur=FASES.findIndex((f,k)=>liberada(k)&&!box().prog[f.id]);if(cur<0)cur=n;
  FASES.forEach((f,k)=>{const ok=liberada(k),st=box().prog[f.id]||0,cls=st?'feita':ok?'atual':'bloq';
    h+='<button type="button" class="advnode '+cls+(f.chefe?' chefe':'')+'" data-k="'+k+'" style="left:'+pos[k].x+'%;top:'+pos[k].y+'px"'+(ok?'':' disabled')+'>'+
      (f.chefe?'<img src="'+G.sprite(f.chefe[0],G.EVO_LV,1)+'" alt="">':'<b>'+(k+1)+'</b>')+(ok?'':'<em>🔒</em>')+'<i>'+(st?estrelas(st):f.chefe?'Chefão':'')+'</i></button>';
    if(k===cur)h+='<div class="advlabel" style="left:'+pos[k].x+'%;top:'+(pos[k].y+40)+'px">'+f.nome+'</div>'});
  h+='</div><p class="advnote">Jogar não custa nada. Cada fase cansa um pouco o bichinho (⚡). Vencer pela 1ª vez dá moedas.</p>';
  $('advBody').innerHTML=h;
  const alvo=$('advBody').querySelector('.advnode.atual')||$('advBody').querySelector('.advnode.feita:last-of-type');
  if(alvo)setTimeout(()=>alvo.scrollIntoView({block:'center'}),30)}

// escolher o bichinho
function pips(e){let s='';for(let k=0;k<EN.max;k++)s+='<i class="'+(k<e?'on':'')+'"></i>';return '<span class="advpips">'+s+'</span>'}
function escolha(k){TELA='escolha';FK=k;const f=FASES[k];moedas();$('advTitle').textContent='Fase '+(k+1);
  const coll=G.coll(),meus=Object.keys(coll).map(Number).filter(i=>coll[i]>0).sort((a,b)=>G.lvOf(b)-G.lvOf(a));
  if(SEL===null||!meus.includes(SEL))SEL=meus[0]??null;
  let h='<div class="advfase"><b>'+f.nome+'</b><small>'+(box().prog[f.id]?'Já vencida '+estrelas(box().prog[f.id])+' · repetir dá só XP':'1ª vitória: +'+f.premio+' 🪙'+(f.chefe?' · chance de pedra de evolução':''))+'</small>';
  h+='<div class="advfoes">'+f.inimigos.map(([j,lv])=>'<span><img src="'+G.sprite(j,lv)+'" alt=""><small>Nv '+lv+'</small></span>').join('')+(f.chefe?'<span class="chefe"><img src="'+G.sprite(f.chefe[0],G.EVO_LV,1)+'" alt=""><small>👑 Nv '+f.chefe[1]+'</small></span>':'')+'</div>';
  h+='<small class="advrec">Recomendado: Nv '+recomendado(f)+' ou mais</small></div>';
  if(!meus.length)h+='<p class="advnote">Pegue uma pelúcia na máquina para começar a aventura.</p>';
  h+='<div class="advpets">'+meus.map(i=>{const lv=G.lvOf(i),E=energia(i),el=ELEM[i];return '<button type="button" class="advpet'+(i===SEL?' sel':'')+(lv<recomendado(f)-4?' fraco':'')+'" data-i="'+i+'"><img src="'+G.sprite(i,lv)+'" alt=""><b>'+(lv>=G.EVO_LV&&i<G.CH0?G.evName(i):G.name(i))+'</b><small>Nv '+lv+' · '+(ELNAME[el]||'')+'</small>'+pips(E.e)+(E.e<EN.max?'<small class="advwait">+1 ⚡ em '+tempo(E.falta)+'</small>':'')+'</button>'}).join('')+'</div>';
  if(SEL!==null){const E=energia(SEL),nm=nivelMin(f),lvs=G.lvOf(SEL);h+='<div class="advgo">'+(lvs<nm?'<button type="button" disabled>Precisa de Nv '+nm+'</button><small>'+G.name(SEL)+' ainda é fraco para esta fase. Cuide dele para subir de nível ou escolha outro bichinho.</small>':E.e>0?'<button type="button" id="advStart">Jogar! ▶</button>':'<button type="button" id="advRest">😴 Descansar · '+EN.descanso_preco+' 🪙</button><small>'+G.name(SEL)+' está cansado. Volta 1 ⚡ em '+tempo(E.falta)+', ou descanse agora.</small>')+'</div>'}
  $('advBody').innerHTML=h;
  const st=$('advStart');if(st)st.addEventListener('click',()=>comecar(k,SEL));
  const rs=$('advRest');if(rs)rs.addEventListener('click',()=>descansar(SEL))}
$('advBody').addEventListener('click',e=>{
  const n=e.target.closest('.advnode');if(n&&TELA==='mapa'){G.click(700);msg('');escolha(+n.dataset.k);return}
  const p=e.target.closest('.advpet');if(p&&TELA==='escolha'){G.click(760);SEL=+p.dataset.i;msg('');escolha(FK);return}
  const r=e.target.closest('[data-r]');if(r){const v=r.dataset.r;if(v==='mapa')mapa();else if(v==='prox')escolha(FK+1);else escolha(FK)}
});

async function descansar(i){if(G.coins()<EN.descanso_preco){msg('Faltam moedas para descansar ('+EN.descanso_preco+' 🪙).');return}
  if(G.online()){const r=await G.sync('adv_rest',{plushId:i});if(!r||r.error||typeof r.coins!=='number'){msg('Não deu para descansar agora. Tente de novo.');return}
    G.setCoins(r.coins);S.en[i]={e:r.energy,s:Date.now()}}
  else{G.addCoinsLocal(-EN.descanso_preco);L.en[i]={e:EN.max,s:Date.now()};saveL()}
  G.tone(523,.2,'sine',.08);msg('');escolha(FK)}

const ERROS={cansado:'Seu bichinho está cansado. Descanse ou espere a energia voltar.',fase_bloqueada:'Vença a fase anterior primeiro.',nao_tem:'Você não tem esse bichinho.'};
async function comecar(k,i){const f=FASES[k];if(!liberada(k))return;const E=energia(i);if(E.e<1||G.lvOf(i)<nivelMin(f)){escolha(k);return}
  const b=$('advStart');if(b)b.disabled=true;G.click(820);
  if(G.online()){const r=await G.sync('adv_start',{plushId:i,stage:f.id});
    if(!r||r.error||typeof r.energy!=='number'){const det=r&&r.detail||'';msg(Object.keys(ERROS).map(x=>det.includes(x)?ERROS[x]:'').join('')||'Não deu para começar. Tente de novo.');if(b)b.disabled=false;await carregarServidor();return}
    S.en[i]={e:r.energy,s:Date.parse(r.since)}}
  else{L.en[i]={e:E.e-1,s:E.e>=EN.max?Date.now():E.s};saveL()}
  const lv=G.lvOf(i);
  RUN={k,f,i,hero:lutador(i,lv,{heroi:1}),fim:false,quit:0,leaves:0};
  luta()}

// ---------- a fase: jogo de plataforma (correr, pular, abaixar, pular na cabeça e soltar o Poder) ----------
const PF=D.plataforma||{},TS=PF.tile||18;
const SOLIDO='#B?TXU';
const IMG={};function img(src){if(!IMG[src]){const im=new Image();im.src=src;IMG[src]=im}return IMG[src]}
let TEC={};// teclas/botões apertados
function luta(){TELA='luta';msg('');const R=RUN,f=R.f;$('advTitle').textContent=f.nome;
  const pw=(BFX[R.hero.el]&&BFX[R.hero.el].e[0])||'✨';
  $('advBody').innerHTML='<div class="advscene plat" id="advScene"><canvas id="advCv"></canvas>'+
    '<div class="advhud"><div class="advbar me"><b>'+nomeDe(R.i,R.hero.lv)+' <small>Nv '+R.hero.lv+'</small></b><div class="hp"><i id="advHpMe"></i></div></div>'+
    '<div class="advleaf" id="advLeaf"></div></div><div class="advboss" id="advBoss" hidden><b>👑 '+(f.chefe?G.evName(f.chefe[0]):'')+' <small>Nv '+(f.chefe?f.chefe[1]:'')+'</small></b><div class="hp"><i id="advHpBoss"></i></div></div>'+
    '<div class="advfx" id="advFx"></div><div class="advaviso" id="advAviso"></div></div>'+
    '<div class="advpad"><div class="advdir"><button type="button" data-k="L" aria-label="Esquerda">◀</button><button type="button" data-k="R" aria-label="Direita">▶</button></div>'+
    '<div class="advact"><button type="button" data-k="D" class="dn" aria-label="Abaixar">▼<span>Abaixar</span></button><button type="button" data-k="F" class="pw" id="advPow" aria-label="Poder">'+pw+'<span>Poder</span></button><button type="button" data-k="J" class="jp" aria-label="Pular">⤒<span>Pular</span></button></div></div>';
  controles();montar();aviso(f.chefe?'Chegue ao fim e derrote o chefão!':'Corra até a bandeira! Pule na cabeça dos inimigos ou use o Poder.');
  R.raf&&cancelAnimationFrame(R.raf);R.last=performance.now();R.acc=0;R.raf=requestAnimationFrame(passo)}
function nomeDe(i,lv){return lv>=G.EVO_LV&&i<G.CH0?G.evName(i):G.name(i)}
function aviso(t,ms){const a=$('advAviso');if(!a)return;a.textContent=t;a.classList.add('on');clearTimeout(aviso.t);aviso.t=setTimeout(()=>a.classList.remove('on'),ms||2600)}

// ---- montar a fase a partir do mapa (data/aventura.json) ----
function montar(){const R=RUN,f=R.f,M=f.mapa;const H=M.length,W=Math.max(...M.map(r=>r.length));
  const g=[];for(let r=0;r<H;r++){g.push((M[r]||'').padEnd(W,' ').split(''))}
  const W_={g,H,W,ini:null,ents:[],itens:[],cps:[],meta:null,arena:null,boss:null,tiros:[],parts:[],nums:[]};
  let ki=0;
  for(let r=0;r<H;r++)for(let c=0;c<W;c++){const ch=g[r][c],x=c*TS,y=r*TS;
    if(ch==='P'){W_.ini={x,y};g[r][c]=' '}
    else if(ch==='E'){const q=f.inimigos[ki%f.inimigos.length];ki++;W_.ents.push(inimigo(q[0],q[1],x,y+TS));g[r][c]=' '}
    else if(ch==='K'){const b=inimigo(f.chefe[0],f.chefe[1],x,y+TS,true);W_.ents.push(b);W_.boss=b;g[r][c]=' '}
    else if(ch==='L'||ch==='S'){W_.itens.push({t:ch,x:x+TS/2,y:y+TS/2,ok:false,f:Math.random()*6});g[r][c]=' '}
    else if(ch==='C'){W_.cps.push({x,y:y+TS,on:false});g[r][c]=' '}
    else if(ch==='G'){W_.meta={x,y:y+TS};g[r][c]=' '}
    else if(ch==='X'&&W_.arena===null)W_.arena=c}
  if(W_.boss){W_.arenaX=W_.boss.x-14*TS}
  const h=R.hero;R.w=W_;R.leaves=0;R.t=0;R.cpx=W_.ini.x;R.cpy=W_.ini.y;
  const Z=R.i>=G.CH0?PF.heroi_redondo:PF.heroi_grande;
  R.p={x:W_.ini.x+2,y:W_.ini.y+TS-Z.h,w:Z.w,h:Z.h,hN:Z.h,hA:Z.agachado,s:Z.desenho,vx:0,vy:0,chao:false,face:1,inv:0,cd:0,coyote:0,buf:0,ag:false,cai:0,anda:0,venceu:0};R.camY=null;
  h.hp=h.max;hud();folhas();tamanho()}
function inimigo(j,lv,x,yPe,chefe){const L_=lutador(j,lv,{chefe});const k=chefe?PF.chefe_vida:PF.inimigo_vida;L_.hp=L_.max=Math.max(8,Math.round(L_.hp*k));
  const s=chefe?PF.tam_chefe:j>=G.CH0?PF.tam_redondo:PF.tam_grande;return Object.assign(L_,{j,lv,x:x+(TS-s)/2,y:yPe-s,w:s,h:s,vx:-(PF.inimigo_vel||38)*(chefe?1.2:1),vy:0,chao:false,vivo:true,ativo:false,pisca:0,salto:1+Math.random()*2,tiro:2.5,chefe:!!chefe,src:chefe?G.sprite(j,G.EVO_LV,1):G.sprite(j,lv),morre:0,face:-1})}
function tamanho(){const cv=$('advCv');if(!cv)return;const r=cv.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
  cv.width=Math.round(r.width*dpr);cv.height=Math.round(r.height*dpr);RUN.vh=Math.min(RUN.w.H,PF.linhas_visiveis||10)*TS;RUN.sc=cv.height/RUN.vh;RUN.vw=cv.width/RUN.sc}
window.addEventListener('resize',()=>{if(RUN&&TELA==='luta'&&RUN.w)tamanho()});

// ---- controles: botões na tela (vários dedos ao mesmo tempo) e teclado ----
function controles(){TEC={};const pad=document.querySelector('.advpad');
  pad.querySelectorAll('button[data-k]').forEach(b=>{const k=b.dataset.k;
    const on=e=>{e.preventDefault();TEC[k]=true;if(k==='J')TEC.Jp=true;if(k==='F')TEC.Fp=true;b.classList.add('on');try{b.setPointerCapture(e.pointerId)}catch(_){}};
    const off=e=>{TEC[k]=false;b.classList.remove('on')};
    b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('lostpointercapture',off);
    b.addEventListener('contextmenu',e=>e.preventDefault())})}
const KMAP={ArrowLeft:'L',a:'L',A:'L',ArrowRight:'R',d:'R',D:'R',ArrowUp:'J',w:'J',W:'J',' ':'J',ArrowDown:'D',s:'D',S:'D',x:'F',X:'F',j:'F',J:'F'};
window.addEventListener('keydown',e=>{if(TELA!=='luta'||pan.hidden)return;const k=KMAP[e.key];if(!k)return;e.preventDefault();if(!TEC[k]){if(k==='J')TEC.Jp=true;if(k==='F')TEC.Fp=true}TEC[k]=true});
window.addEventListener('keyup',e=>{const k=KMAP[e.key];if(k)TEC[k]=false});

// ---- colisão com o mapa ----
function cel(c,r){const w=RUN.w;if(r<0)return ' ';if(c<0||c>=w.W)return '#';if(r>=w.H)return ' ';return w.g[r][c]}
const solido=ch=>SOLIDO.includes(ch);
function bateX(o){const w=RUN.w,r0=Math.floor(o.y/TS),r1=Math.floor((o.y+o.h-.01)/TS);
  if(o.vx>0){const c=Math.floor((o.x+o.w)/TS);for(let r=r0;r<=r1;r++)if(solido(cel(c,r))){o.x=c*TS-o.w-.01;return 1}}
  else if(o.vx<0){const c=Math.floor(o.x/TS);for(let r=r0;r<=r1;r++)if(solido(cel(c,r))){o.x=(c+1)*TS+.01;return -1}}return 0}
function bateY(o,yAntes){const c0=Math.floor(o.x/TS),c1=Math.floor((o.x+o.w-.01)/TS);o.chao=false;
  if(o.vy>0){const r=Math.floor((o.y+o.h)/TS);for(let c=c0;c<=c1;c++){const ch=cel(c,r);if(solido(ch)||(ch==='='&&yAntes+o.h<=r*TS+1)){o.y=r*TS-o.h;o.vy=0;o.chao=true;return 1}}}
  else if(o.vy<0){const r=Math.floor(o.y/TS);for(let c=c0;c<=c1;c++){const ch=cel(c,r);if(solido(ch)){o.y=(r+1)*TS;o.vy=0;return {c,r,ch}}}}return 0}
function livre(x,y,w,h){for(let r=Math.floor(y/TS);r<=Math.floor((y+h-.01)/TS);r++)for(let c=Math.floor(x/TS);c<=Math.floor((x+w-.01)/TS);c++)if(solido(cel(c,r)))return false;return true}
const toca=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;

// ---- laço do jogo (passo fixo de 1/60 s) ----
function passo(now){const R=RUN;if(!R||R.fim||TELA!=='luta')return;R.raf=requestAnimationFrame(passo);
  if(document.hidden||R.pausa){R.last=now;return}
  R.acc+=Math.min(.1,(now-R.last)/1000);R.last=now;
  while(R.acc>=1/60){R.acc-=1/60;fisica(1/60);if(R.fim)return}
  desenha()}
function fisica(dt){const R=RUN,p=R.p,w=R.w;R.t+=dt;
  if(p.venceu){p.venceu+=dt;p.vy+=PF.gravidade*dt*.5;p.y=Math.min(p.y+p.vy*dt,w.meta.y-p.h);if(p.venceu>1.6){vitoria();}return}
  // agachar (só no chão); levantar só se tiver espaço
  const querAg=TEC.D&&p.chao;
  if(querAg&&!p.ag){p.ag=true;p.y+=p.h-p.hA;p.h=p.hA}
  else if(!querAg&&p.ag&&livre(p.x,p.y+p.h-p.hN,p.w,p.hN)){p.ag=false;p.y-=p.hN-p.h;p.h=p.hN}
  const dir=(TEC.R?1:0)-(TEC.L?1:0);if(dir)p.face=dir;
  const vmax=p.ag?PF.agachado:PF.corrida,ac=p.chao?1400:900;
  if(dir)p.vx+=Math.max(-ac*dt,Math.min(ac*dt,dir*vmax-p.vx));else p.vx*=p.chao?.78:.95;
  if(Math.abs(p.vx)<2)p.vx=0;
  // pulo com tolerância (coyote e buffer) e altura variável
  p.coyote=p.chao?.1:Math.max(0,p.coyote-dt);if(TEC.Jp){p.buf=.12;TEC.Jp=false}else p.buf=Math.max(0,p.buf-dt);
  if(p.buf>0&&p.coyote>0&&!p.ag){p.vy=-PF.pulo;p.buf=0;p.coyote=0;p.chao=false;G.tone(520,.08,'square',.05)}
  if(!TEC.J&&p.vy<-180)p.vy=-180;
  p.vy=Math.min(720,p.vy+PF.gravidade*dt);
  p.x+=p.vx*dt;if(bateX(p))p.vx=0;p.x=Math.max(0,p.x);
  const ya=p.y;p.y+=p.vy*dt;const by=bateY(p,ya);
  if(by&&by.ch==='?'){w.g[by.r][by.c]='U';w.itens.push({t:'S',x:by.c*TS+TS/2,y:(by.r-1)*TS+TS/2,ok:false,f:0,sobe:1});G.tone(880,.08,'square',.05);faisca(by.c*TS+TS/2,by.r*TS,'#ffd23c',6)}
  p.anda=p.chao&&Math.abs(p.vx)>10?p.anda+dt*Math.abs(p.vx)/30:0;
  p.inv=Math.max(0,p.inv-dt);p.cd=Math.max(0,p.cd-dt);
  // Poder
  if(TEC.Fp){TEC.Fp=false;if(p.cd<=0){p.cd=PF.poder_recarga_s;const F=BFX[R.hero.el]||{e:['✨'],c:'#fff'};w.tiros.push({x:p.x+p.w/2+p.face*10,y:p.y+p.h*.45,vx:p.face*PF.poder_vel,d:0,e:F.e[0],c:F.c,meu:1,r:9});G.tone(330,.1,'triangle',.07)}}
  // espinhos
  {const c0=Math.floor(p.x/TS),c1=Math.floor((p.x+p.w-1)/TS),r0=Math.floor(p.y/TS),r1=Math.floor((p.y+p.h-1)/TS);
    for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++)if(cel(c,r)==='^'){machuca(Math.round(R.hero.max*.12),0);p.vy=-PF.pulo*.7;break}}
  // buraco
  if(p.y>w.H*TS+20){const d=Math.round(R.hero.max*PF.buraco_dano);R.hero.hp-=d;num(p.x,p.y-40,'-'+d,'#ff8a8a');
    if(R.hero.hp<=0){R.hero.hp=0;hud();return derrota()}
    p.x=R.cpx;p.y=R.cpy-p.h+TS;p.vx=p.vy=0;p.inv=PF.invencivel_s;aviso('Caiu! Voltou para a última bandeira.',1600);G.tone(160,.25,'sawtooth',.06);hud()}
  // itens
  for(const it of w.itens){if(it.ok)continue;if(it.sobe&&it.sobe<1.6){it.sobe+=dt*3}
    if(Math.abs(it.x-(p.x+p.w/2))<14&&Math.abs(it.y-(p.y+p.h/2))<p.h/2+8){it.ok=true;
      if(it.t==='L'){R.leaves++;folhas();G.tone(988,.12,'triangle',.08);setTimeout(()=>G.tone(1318,.14,'triangle',.08),90);faisca(it.x,it.y,'#ffd23c',10);aviso('Folha dourada! '+R.leaves+' de 3',1400)}
      else{const c=Math.min(R.hero.max-R.hero.hp,Math.round(R.hero.max*PF.morango_cura));R.hero.hp+=c;num(it.x,it.y-10,c>0?'+'+c+' ❤':'🍓','#9dff8a');G.tone(660,.1,'sine',.08);hud()}}}
  for(const cp of w.cps)if(!cp.on&&p.x+p.w>cp.x&&p.x<cp.x+TS){cp.on=true;R.cpx=cp.x;R.cpy=cp.y-TS;G.tone(784,.15,'triangle',.07);aviso('Bandeira! Se cair, volta daqui.',1500)}
  // chegada
  if(w.meta&&!(w.boss&&w.boss.vivo)&&p.x+p.w>w.meta.x+4&&p.x<w.meta.x+TS){p.venceu=.001;p.vx=0;p.vy=-200;G.fanfare();return}
  // inimigos
  const camL=R.cam-40,camR=R.cam+R.vw+60;
  for(const e of w.ents){if(!e.vivo){e.morre+=dt;continue}
    if(!e.ativo){if(e.x<camR&&e.x+e.w>camL){e.ativo=true;if(e.chefe){$('advBoss').hidden=false;aviso('👑 O chefão apareceu!',2000);G.tone(140,.5,'sawtooth',.07)}}else continue}
    e.pisca=Math.max(0,e.pisca-dt);
    if(e.chefe){const alvo=p.x-e.x;if(Math.abs(alvo)>8)e.vx=Math.sign(alvo)*(PF.inimigo_vel||38)*(e.hp<e.max/2?1.9:1.3);
      e.salto-=dt;if(e.salto<=0&&e.chao){e.vy=-PF.pulo*.85;e.salto=2.2+Math.random()*1.5}
      e.tiro-=dt;if(e.tiro<=0){e.tiro=e.hp<e.max/2?1.8:2.8;const F=BFX[e.el]||{e:['💥'],c:'#fff'};w.tiros.push({x:e.x+e.w/2,y:e.y+e.h*.45,vx:Math.sign(p.x-e.x||-1)*170,d:0,e:F.e[0],c:F.c,meu:0,r:11,dono:e});G.tone(200,.12,'sawtooth',.05)}}
    else if(e.j>=G.CH0){e.salto-=dt;if(e.salto<=0&&e.chao){e.vy=-PF.pulo*.55;e.salto=1.6+Math.random()*1.4}}
    e.vy=Math.min(720,e.vy+PF.gravidade*dt);const ex=e.x;e.x+=e.vx*dt;
    if(bateX(e)){e.vx=-e.vx}
    else if(e.chao&&!e.chefe){const fc=Math.floor((e.vx>0?e.x+e.w+1:e.x-1)/TS),fr=Math.floor((e.y+e.h+2)/TS);const ch=cel(fc,fr);if(!solido(ch)&&ch!=='='){e.x=ex;e.vx=-e.vx}}
    if(w.boss&&e===w.boss){e.x=Math.max(w.arenaX,e.x)}
    if(e.vx)e.face=Math.sign(e.vx);
    const eya=e.y;e.y+=e.vy*dt;bateY(e,eya);if(e.y>w.H*TS+40){e.vivo=false;continue}
    // encontro com o bichinho
    if(toca(p,e)){const pisou=p.vy>60&&(ya+p.h)<=e.y+10;
      if(pisou){golpeia(e,PF.pulo_cabeca||1,'pisou');p.vy=-PF.pulo*(TEC.J?.85:.6);p.y=e.y-p.h-1}
      else if(p.inv<=0){const r=dano(e,R.hero,1);machuca(Math.round(r.d*PF.contato),Math.sign(p.x-e.x)||-p.face)}}}
  // tiros
  for(const t of w.tiros){if(t.fim)continue;const dx=t.vx*dt;t.x+=dx;t.d+=Math.abs(dx);
    if(t.d>PF.poder_alcance*(t.meu?1:1.6)||solido(cel(Math.floor(t.x/TS),Math.floor(t.y/TS)))){t.fim=1;faisca(t.x,t.y,t.c,5);continue}
    if(t.meu){for(const e of w.ents){if(!e.vivo||!e.ativo)continue;if(t.x>e.x-t.r&&t.x<e.x+e.w+t.r&&t.y>e.y-t.r&&t.y<e.y+e.h+t.r){t.fim=1;golpeia(e,LT.poder,'poder');break}}}
    else if(p.inv<=0&&t.x>p.x-t.r&&t.x<p.x+p.w+t.r&&t.y>p.y-t.r&&t.y<p.y+p.h+t.r){t.fim=1;const r=dano(t.dono,R.hero,LT.poder*.7);machuca(r.d,Math.sign(t.vx))}}
  w.tiros=w.tiros.filter(t=>!t.fim);
  for(const q of w.parts){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=600*dt;q.t-=dt}w.parts=w.parts.filter(q=>q.t>0);
  for(const n of w.nums){n.y-=30*dt;n.t-=dt}w.nums=w.nums.filter(n=>n.t>0);
  // câmera
  const alvo=p.x+p.w/2-R.vw*.4+p.face*20;R.cam=Math.max(0,Math.min(w.W*TS-R.vw,(R.cam??alvo)+(alvo-(R.cam??alvo))*Math.min(1,dt*6)));
  const aY=Math.max(0,Math.min(w.H*TS-R.vh,p.y+p.h-R.vh*.78));R.camY=R.camY==null?aY:R.camY+(aY-R.camY)*Math.min(1,dt*4);
  const pb=$('advPow');if(pb)pb.classList.toggle('carrega',p.cd>0)}
function golpeia(e,mult,como){const R=RUN,r=dano(R.hero,e,mult);e.hp-=r.d;e.pisca=.25;num(e.x+e.w/2,e.y-6,'-'+r.d+(r.crit?'!':''),r.crit?'#ffe04a':'#fff');
  G.tone(como==='pisou'?440:300,.08,'square',.06);if(r.em>1&&como==='poder')aviso('Super eficaz! 💪',900);
  if(e.chefe)hud();
  if(e.hp<=0){e.vivo=false;faisca(e.x+e.w/2,e.y+e.h/2,ECOL[e.el]||'#fff',e.chefe?24:12);G.tone(660,.1,'triangle',.07);
    if(e.chefe){abrePortao();aviso('Você derrotou o chefão! Vá até a bandeira 🏁',3000);G.fanfare();$('advBoss').hidden=true}}}
function abrePortao(){const w=RUN.w;for(let r=0;r<w.H;r++)for(let c=0;c<w.W;c++)if(w.g[r][c]==='X'){w.g[r][c]=' ';faisca(c*TS+TS/2,r*TS+TS/2,'#c9b4ff',2)}}
function machuca(d,lado){const R=RUN,p=R.p;if(p.inv>0)return;R.hero.hp-=d;p.inv=PF.invencivel_s;p.vx=lado*170;p.vy=-260;num(p.x+p.w/2,p.y-6,'-'+d,'#ff8a8a');G.tone(180,.14,'sawtooth',.06);hud();
  if(R.hero.hp<=0){R.hero.hp=0;hud();derrota()}}
function faisca(x,y,c,n){for(let k=0;k<n;k++)RUN.w.parts.push({x,y,vx:(Math.random()-.5)*220,vy:-Math.random()*240,t:.5+Math.random()*.4,c})}
function num(x,y,t,c){RUN.w.nums.push({x,y,t:1,s:t,c})}
function hud(){const R=RUN,h=R.hero,b=$('advHpMe');if(b){b.style.width=Math.max(0,h.hp/h.max*100)+'%';b.classList.toggle('baixo',h.hp<h.max*.3)}
  const w=R.w;if(w&&w.boss){const bb=$('advHpBoss');if(bb)bb.style.width=Math.max(0,w.boss.hp/w.boss.max*100)+'%'}}
function folhas(){const l=$('advLeaf');if(l)l.innerHTML=[0,1,2].map(k=>'<i class="'+(k<RUN.leaves?'on':'')+'">🍃</i>').join('')}
function derrota(){const R=RUN;if(R.fim)return;R.p.morto=1;setTimeout(()=>terminar(false),600);R.fim=true;R.fimPend=1;desenha()}
function vitoria(){const R=RUN;if(R.fim)return;R.fim=true;R.fimPend=1;terminar(true)}
function desistir(){const R=RUN;if(!R||(R.fim&&!R.fimPend)){mapa();return}if(R.fimPend)return;
  if(!R.quit){R.quit=1;aviso('Toque de novo em ‹ para desistir (conta como derrota).',2500);setTimeout(()=>{if(RUN===R)R.quit=0},2600);return}
  R.fim=true;R.fimPend=1;terminar(false)}

// ---- pernas: cada figura é separada em corpo + pernas (achadas pelo contorno de baixo) para as pernas andarem ----
const PERNA={};
function pernas(src,mini){const k=src;if(PERNA[k])return PERNA[k];const im=img(src);if(!im.complete||!im.naturalWidth)return null;
  const W=im.naturalWidth,H=im.naturalHeight,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.drawImage(im,0,0);
  let d;try{d=x.getImageData(0,0,W,H).data}catch(e){return PERNA[k]={c,W,H,hip:H,legs:[]}}
  const b=new Int32Array(W).fill(-1);let y0=H,y1=0;
  for(let X=0;X<W;X++)for(let Y=H-1;Y>=0;Y--)if(d[(Y*W+X)*4+3]>60){b[X]=Y;if(Y>y1)y1=Y;break}
  for(let Y=0;Y<H&&y0===H;Y++)for(let X=0;X<W;X++)if(d[(Y*W+X)*4+3]>60){y0=Y;break}
  const h=y1-y0+1;let legs=[],hip;
  if(mini){// redondos: dois pezinhos na parte de baixo
    hip=Math.round(y1-h*.13);let xs=[];for(let X=0;X<W;X++)if(b[X]>=y1-h*.05)xs.push(X);
    if(xs.length){const a=xs[0],z=xs[xs.length-1],m=(a+z)>>1;legs=[[a,m],[m+1,z]]}}
  else{const low=X=>b[X]>=y1-h*.10;let g=[],st=-1;
    for(let X=0;X<=W;X++){const v=X<W&&low(X);if(v&&st<0)st=X;if(!v&&st>=0){g.push([st,X-1]);st=-1}}
    const m=[];for(const q of g){if(m.length&&q[0]-m[m.length-1][1]<=Math.max(2,W*.02))m[m.length-1][1]=q[1];else m.push(q)}
    for(const q of m){if(q[1]-q[0]<Math.max(3,W*.04))continue;if(q[1]-q[0]>W*.2){const md=(q[0]+q[1])>>1;legs.push([q[0],md],[md+1,q[1]])}else legs.push(q)}
    const bel=[];for(let X=0;X<W;X++)if(b[X]>=0&&!low(X))bel.push(b[X]);bel.sort((u,v)=>u-v);
    hip=bel.length?bel[bel.length>>1]:y1-h*.25;hip=Math.round(Math.min(Math.max(hip,y1-h*.38),y1-h*.15))}
  return PERNA[k]={c,W,H,hip,legs,y1}}
// desenha o bichinho com os pés em (0,0) já transladado; s = altura em px do jogo; fase = passo; anda/ar = estado
function bicho(x,src,mini,s,fase,anda,ar){const P=pernas(src,mini),im=img(src);if(!im.complete||!im.naturalWidth)return;
  const ar_=im.naturalWidth/im.naturalHeight,w=s*ar_,k=s/im.naturalHeight;
  if(!P||!P.legs.length){x.drawImage(im,-w/2,-s,w,s);return}
  const hy=P.hip*k-s,ov=2.5;
  // corpo: tudo acima do quadril + o que fica abaixo dele fora das pernas
  x.save();x.beginPath();x.rect(-w/2,-s,w,hy+s+ov);let px=0;
  for(const [a,z] of P.legs){if(a*k>px)x.rect(-w/2+px,hy+ov,a*k-px,s);px=(z+1)*k}x.rect(-w/2+px,hy+ov,w-px,s);x.clip();x.drawImage(P.c,-w/2,-s,w,s);x.restore();
  // pernas: giram no quadril, alternando (uma vai, a outra volta)
  P.legs.forEach(([a,z],n)=>{const ph=fase*Math.PI*2+(n%2?Math.PI:0);let ang=0,lift=0;
    if(ar)ang=(n%2?-1:1)*.35;else if(anda){ang=Math.sin(ph)*.38;lift=Math.max(0,Math.cos(ph))*s*.035}
    const lx=-w/2+a*k,lw=(z-a+1)*k,cx=lx+lw/2;x.save();x.translate(cx,hy);x.rotate(ang);x.translate(0,-lift);
    x.drawImage(P.c,a,P.hip-ov/k,z-a+1,P.H-P.hip+ov/k,-lw/2,-ov,lw,(P.H-P.hip)*k+ov);x.restore()})}

// ---- desenho ----
const TIL={};
function tile(nome,fn){if(TIL[nome])return TIL[nome];const c=document.createElement('canvas');c.width=c.height=TS*2;const x=c.getContext('2d');x.scale(2,2);fn(x);return TIL[nome]=c}
function rr(x,a,b,w,h,r){x.beginPath();x.moveTo(a+r,b);x.arcTo(a+w,b,a+w,b+h,r);x.arcTo(a+w,b+h,a,b+h,r);x.arcTo(a,b+h,a,b,r);x.arcTo(a,b,a+w,b,r);x.closePath()}
const T_={
  terra:x=>{x.fillStyle='#8a5a32';x.fillRect(0,0,TS,TS);x.fillStyle='#7a4c28';[[3,4],[11,9],[6,13],[14,3]].forEach(([a,b])=>x.fillRect(a,b,3,2))},
  grama:x=>{T_.terra(x);x.fillStyle='#3d9a3a';x.fillRect(0,0,TS,7);x.fillStyle='#5cc84a';x.fillRect(0,0,TS,5);x.fillStyle='#8be06a';x.fillRect(0,0,TS,2);x.fillStyle='#3d9a3a';[2,7,12].forEach(a=>x.fillRect(a,5,2,3))},
  caixa:x=>{x.fillStyle='#b37a3c';x.fillRect(0,0,TS,TS);x.strokeStyle='#6e4520';x.lineWidth=2;x.strokeRect(1,1,TS-2,TS-2);x.beginPath();x.moveTo(2,2);x.lineTo(TS-2,TS-2);x.moveTo(TS-2,2);x.lineTo(2,TS-2);x.lineWidth=1.5;x.stroke()},
  surpresa:x=>{rr(x,0.5,0.5,TS-1,TS-1,3);x.fillStyle='#f2b42a';x.fill();x.strokeStyle='#a8660c';x.lineWidth=1.5;x.stroke();x.fillStyle='#fff3c4';x.font='bold 13px system-ui';x.textAlign='center';x.textBaseline='middle';x.fillText('?',TS/2,TS/2+1)},
  usado:x=>{rr(x,0.5,0.5,TS-1,TS-1,3);x.fillStyle='#8a6a3a';x.fill();x.strokeStyle='#5a3e1a';x.lineWidth=1.5;x.stroke()},
  tronco:x=>{rr(x,0,1,TS,8,4);x.fillStyle='#9a6634';x.fill();x.fillStyle='#c48a4a';x.fillRect(2,2,TS-4,2)},
  copa:x=>{x.fillStyle='#2f7a34';x.fillRect(0,0,TS,TS);x.fillStyle='#3f9a40';[[4,4,5],[13,8,6],[6,14,5]].forEach(([a,b,r])=>{x.beginPath();x.arc(a,b,r,0,7);x.fill()})},
  copaBaixo:x=>{T_.copa(x);x.fillStyle='#6e4520';x.fillRect(0,TS-5,TS,4);x.fillStyle='#3f9a40';x.beginPath();x.arc(5,TS-2,3,0,7);x.arc(13,TS-1,3,0,7);x.fill()},
  espinho:x=>{x.fillStyle='#2f7a34';x.beginPath();x.arc(TS/2,TS,TS/2,Math.PI,0);x.fill();x.fillStyle='#e8e0c8';for(let k=0;k<5;k++){const a=Math.PI+k*Math.PI/4;x.beginPath();x.moveTo(TS/2+Math.cos(a)*5,TS+Math.sin(a)*5);x.lineTo(TS/2+Math.cos(a)*11,TS+Math.sin(a)*11);x.lineTo(TS/2+Math.cos(a+.25)*5,TS+Math.sin(a+.25)*5);x.fill()}},
  portao:x=>{x.fillStyle='rgba(60,30,80,.35)';x.fillRect(0,0,TS,TS);x.fillStyle='#8a7aa8';x.fillRect(3,0,3,TS);x.fillRect(12,0,3,TS);x.fillStyle='#c9b4ff';x.fillRect(4,0,1,TS);x.fillRect(13,0,1,TS)}};
function fundo(x,R){const W_=R.vw,H_=R.vh,cam=R.cam||0;const g=x.createLinearGradient(0,0,0,H_);g.addColorStop(0,'#7cc8f2');g.addColorStop(.7,'#d6f2ff');x.fillStyle=g;x.fillRect(0,0,W_,H_);
  x.fillStyle='rgba(255,255,255,.85)';for(let k=0;k<6;k++){const cx=((k*173-cam*.1)%(W_+120)+W_+120)%(W_+120)-60,cy=24+(k*37)%60;x.beginPath();x.arc(cx,cy,12,0,7);x.arc(cx+14,cy-5,14,0,7);x.arc(cx+28,cy,11,0,7);x.fill()}
  const morros=(f,cor,base,amp,per)=>{x.fillStyle=cor;x.beginPath();x.moveTo(0,H_);for(let a=0;a<=W_+8;a+=8){const u=a+cam*f;x.lineTo(a,base-amp*(.6+.4*Math.sin(u/per))*(.7+.3*Math.sin(u/(per*.37))))}x.lineTo(W_,H_);x.fill()};
  morros(.2,'#9ed890',H_*.62,40,90);morros(.4,'#6cbc62',H_*.72,30,60);
  x.font='18px system-ui';x.textAlign='center';for(let k=-1;k<W_/46+2;k++){const u=Math.floor((cam*.55)/46)+k,px=u*46-cam*.55;if((u*7919)%5<3)x.fillText((u%3)?'🌲':'🌳',px,H_*.74+((u*31)%9))}}
function desenha(){const R=RUN,cv=$('advCv');if(!cv||!R.w)return;const x=cv.getContext('2d'),w=R.w,p=R.p;x.setTransform(R.sc,0,0,R.sc,0,0);
  fundo(x,R);const cam=Math.round(R.cam||0),camY=Math.round(R.camY||0);x.save();x.translate(-cam,-camY);
  const c0=Math.max(0,Math.floor(cam/TS)-1),c1=Math.min(w.W-1,Math.ceil((cam+R.vw)/TS)+1);
  const r0=Math.max(0,Math.floor(camY/TS)-1),r1=Math.min(w.H-1,Math.ceil((camY+R.vh)/TS)+1);
  for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){const ch=w.g[r][c];if(ch===' ')continue;let t=null;
    if(ch==='#')t=(r>0&&w.g[r-1][c]==='#')?tile('terra',T_.terra):tile('grama',T_.grama);else if(ch==='B')t=tile('caixa',T_.caixa);else if(ch==='?')t=tile('surpresa',T_.surpresa);else if(ch==='U')t=tile('usado',T_.usado);
    else if(ch==='=')t=tile('tronco',T_.tronco);else if(ch==='T')t=(r+1<w.H&&w.g[r+1][c]==='T')?tile('copa',T_.copa):tile('copaBaixo',T_.copaBaixo);else if(ch==='^')t=tile('espinho',T_.espinho);else if(ch==='X')t=tile('portao',T_.portao);
    if(t)x.drawImage(t,c*TS,r*TS,TS,TS)}
  // bandeiras
  for(const cp of w.cps){x.fillStyle='#d8d0c0';x.fillRect(cp.x+TS/2-1,cp.y-34,2,34);x.fillStyle=cp.on?'#ffd23c':'#7ac06a';x.beginPath();x.moveTo(cp.x+TS/2+1,cp.y-34);x.lineTo(cp.x+TS/2+14,cp.y-29);x.lineTo(cp.x+TS/2+1,cp.y-24);x.fill()}
  if(w.meta){const m=w.meta;x.fillStyle='#e8e0d0';x.fillRect(m.x+TS/2-1.5,m.y-80,3,80);x.fillStyle='#ffd23c';x.beginPath();x.arc(m.x+TS/2,m.y-82,4,0,7);x.fill();
    const o=Math.sin(R.t*4)*2;x.fillStyle=(w.boss&&w.boss.vivo)?'#8a7aa8':'#ff4f8b';x.beginPath();x.moveTo(m.x+TS/2+2,m.y-78);x.quadraticCurveTo(m.x+TS/2+14,m.y-74+o,m.x+TS/2+26,m.y-70);x.lineTo(m.x+TS/2+2,m.y-60);x.fill();x.font='9px system-ui';x.textAlign='center';x.fillText('⭐',m.x+TS/2+11,m.y-66)}
  // itens
  x.textAlign='center';x.textBaseline='middle';
  for(const it of w.itens){if(it.ok)continue;const bob=Math.sin(R.t*3+it.f)*2;const yy=it.y+bob-(it.sobe?Math.min(1,it.sobe)*0:0);
    if(it.t==='L'){x.save();x.shadowColor='#ffd23c';x.shadowBlur=10;x.font='16px system-ui';x.fillText('🍃',it.x,yy);x.restore();x.fillStyle='rgba(255,220,80,.35)';x.beginPath();x.arc(it.x,yy,10+Math.sin(R.t*5)*1.5,0,7);x.fill();x.font='16px system-ui';x.fillText('🍃',it.x,yy)}
    else{x.font='14px system-ui';x.fillText('🍓',it.x,yy)}}
  // inimigos
  for(const e of w.ents){if(!e.ativo&&e.vivo)continue;if(!e.vivo&&e.morre>.5)continue;const im=img(e.src);x.save();
    const a=e.vivo?1:1-e.morre*2;x.globalAlpha=Math.max(0,a);x.translate(e.x+e.w/2,e.y+e.h);if(!e.vivo)x.rotate(e.morre*3);x.scale(e.face>0?1:-1,1);
    if(e.pisca>0)x.filter='brightness(2.2)';e.passo=(e.passo||Math.random())+Math.abs(e.vx)/60/22;bicho(x,e.src,e.j>=G.CH0,e.w*1.35,e.passo,e.vivo&&e.chao&&Math.abs(e.vx)>4,e.vivo&&!e.chao);x.restore();
    if(e.vivo&&!e.chefe&&e.hp<e.max){x.fillStyle='rgba(0,0,0,.55)';x.fillRect(e.x-2,e.y-12,e.w+4,5);x.fillStyle='#ff6a5a';x.fillRect(e.x-1,e.y-11,(e.w+2)*e.hp/e.max,3)}
    if(e.vivo&&!e.chefe){x.font='bold 7px system-ui';x.fillStyle='#fff';x.strokeStyle='rgba(0,0,0,.7)';x.lineWidth=2;x.strokeText('Nv '+e.lv,e.x+e.w/2,e.y-17);x.fillText('Nv '+e.lv,e.x+e.w/2,e.y-17)}
    if(e.vivo&&e.chefe){x.font='16px system-ui';x.fillText('👑',e.x+e.w/2,e.y-e.h*.45)}}
  // bichinho
  if(!(p.inv>0&&Math.floor(p.inv*14)%2)){const im=img(G.sprite(RUN.i,RUN.hero.lv));x.save();x.translate(p.x+p.w/2,p.y+p.h);x.scale(p.face,1);
    const s=p.s;
    if(p.morto){x.rotate(Math.PI);x.translate(0,s*.6)}
    if(p.ag){x.scale(1.06,.8)}x.translate(0,p.chao&&Math.abs(p.vx)>10?-Math.abs(Math.sin(p.anda*Math.PI))*1.5:0);bicho(x,G.sprite(RUN.i,RUN.hero.lv),RUN.i>=G.CH0,s,p.anda/2,p.chao&&Math.abs(p.vx)>10,!p.chao);x.restore()}
  // tiros e partículas
  for(const t of w.tiros){x.save();x.translate(t.x,t.y);x.rotate(R.t*10);x.shadowColor=t.c;x.shadowBlur=8;x.font=(t.meu?16:20)+'px system-ui';x.fillText(t.e,0,0);x.restore()}
  for(const q of w.parts){x.globalAlpha=Math.max(0,q.t*2);x.fillStyle=q.c;x.fillRect(q.x-1.5,q.y-1.5,3,3)}x.globalAlpha=1;
  x.font='bold 11px system-ui';for(const n of w.nums){x.globalAlpha=Math.min(1,n.t*2);x.strokeStyle='rgba(0,0,0,.75)';x.lineWidth=3;x.strokeText(n.s,n.x,n.y);x.fillStyle=n.c;x.fillText(n.s,n.x,n.y)}x.globalAlpha=1;
  x.restore()}

async function terminar(win){const R=RUN;if(!R||R.salvo)return;R.salvo=1;R.fim=true;
  const f=R.f,id=f.id,st=win?Math.min(3,R.leaves):0;
  let res={first:false,stone:-1,coins:0,xp:win?D.xp.vitoria:D.xp.derrota,erro:''};
  if(G.online()){const r=await G.sync('adv_end',{stage:id,win,stars:Math.max(1,st)});
    if(r&&!r.error&&typeof r.coins==='number'){res.coins=r.coins-G.coins();G.setCoins(r.coins);G.xpSet(R.i,r.xp);res.first=!!r.first;res.stone=r.stone;if(win)S.prog[id]=Math.max(S.prog[id]||0,Math.max(1,st));if(r.stone>=0)G.stoneLocal(r.stone)}
    else{const det=r&&r.detail||'';res.erro=det.includes('nivel_baixo')?'O servidor não aceitou: seu bichinho ainda é fraco demais para esta fase.':'Não deu para salvar o resultado. Tente de novo.';res.xp=0}}
  else{if(win){res.first=!L.prog[id];L.prog[id]=Math.max(L.prog[id]||0,Math.max(1,st));if(res.first&&f.premio){G.addCoinsLocal(f.premio);res.coins=f.premio}
      if(f.chefe&&Math.random()<D.chefe_pedra.chance){const p=D.chefe_pedra.pedras;res.stone=p[Math.floor(Math.random()*p.length)];G.stoneLocal(res.stone)}}
    saveL();G.xpLocal(R.i,res.xp)}
  if(win&&!res.erro)G.evento('adventure',1);
  resultado(win,st,res)}
function resultado(win,st,res){const R=RUN,f=R.f,tem=FASES[R.k+1];if(win)G.fanfare();else G.tone(196,.4,'sawtooth',.07);
  let h='<div class="advres '+(win?'win':'lose')+'"><h4>'+(win?'Vitória! 🏆':'Derrota 💔')+'</h4>';
  if(win)h+='<div class="advstars">'+estrelas(st)+'</div><small class="advst">'+st+' de 3 folhas douradas 🍃</small>';
  h+='<ul>';if(res.erro)h+='<li>'+res.erro+'</li>';
  if(res.erro){}else if(win&&res.first&&res.coins>0)h+='<li>+'+res.coins+' 🪙 <small>(1ª vitória nesta fase)</small></li>';else if(win)h+='<li><small>Fase já vencida antes: sem moedas desta vez</small></li>';
  if(!res.erro)h+='<li>+'+res.xp+' XP para '+G.name(R.i)+'</li>';
  if(res.stone>=0){const s=G.stone(res.stone);h+='<li class="pedra">'+(s&&s.img?'<img src="'+s.img+'" alt="">':'💎')+' O chefão deixou cair: <b>'+(s?s.name:'pedra')+'</b>!</li>'}
  if(!win)h+='<li><small>Dica: pule na cabeça dos inimigos, use o Poder de longe e pegue os morangos 🍓 dos blocos ? para recuperar vida. Bichinho com nível maior aguenta mais.</small></li>';
  h+='</ul><div class="advresb">'+(win&&tem?'<button type="button" data-r="prox">Próxima fase ›</button>':'')+'<button type="button" data-r="de-novo">'+(win?'Jogar de novo':'Tentar de novo')+'</button><button type="button" data-r="mapa" class="sec">Mapa</button></div></div>';
  const d=document.createElement('div');d.innerHTML=h;$('advScene').appendChild(d.firstChild);moedas()}

window.GARRO_AVENTURA={FASES,lutador,dano,elemMult,energia,liberada,box,recomendado,nivelMin,run:()=>RUN,cel:(c,r)=>cel(c,r),TS,bicho:(x,src,mini,s,f,a,ar)=>bicho(x,src,mini,s,f,a,ar),pernas,tec:(k,v)=>{TEC[k]=v;if(v&&k==='J')TEC.Jp=true;if(v&&k==='F')TEC.Fp=true},sim:(n,bot)=>{for(let k=0;k<n&&RUN&&!RUN.fim;k++){if(bot)bot();fisica(1/60)}if(RUN&&RUN.w)desenha()}};// usado nos testes
setTimeout(carregarServidor,3000);
})();
