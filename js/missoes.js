/* GARRO — Missões: percurso (trilha fixa) e 3 diárias.
   Conteúdo (textos, metas, prêmios) vem de data/missoes.json (window.GD.missoes).
   Logado: progresso e prêmios vêm do Supabase (mission_counters / mission_claims) e o servidor confere antes de pagar.
   Sem login: progresso e prêmios ficam no aparelho. */
(function(){
const G=window.GARRO,D=window.GD&&window.GD.missoes;
if(!G||!D)return;
const $=id=>document.getElementById(id);
const LKEY='garro-missoes';
const BASE_DAY='1970-01-01';

// dia no horário de Brasília (o mesmo que o servidor usa)
function hoje(){return new Date(Date.now()-3*3600e3).toISOString().slice(0,10)}
// sorteio das diárias do dia: igual para todos e igual ao do servidor (mesmo código na sync-estado)
function diariasDoDia(dia){
  const n=D.diarias.length,k=Math.min(D.diarias_por_dia||3,n),out=[];
  let s=(Math.floor(Date.parse(dia+'T00:00:00Z')/864e5)*2654435761)>>>0;
  while(out.length<k){s=(Math.imul(s,1103515245)+12345)>>>0;const i=s%n;if(!out.includes(i))out.push(i)}
  return out.map(i=>D.diarias[i]);
}

// ---- estado (contadores e prêmios pegos) ----
let L={counters:{},claims:{}};try{const o=JSON.parse(localStorage.getItem(LKEY)||'');if(o&&o.counters)L=o}catch(e){}
function saveL(){try{localStorage.setItem(LKEY,JSON.stringify(L))}catch(e){}}
let S=null;// estado vindo do servidor quando logado: {counters:{kind:{total,day,day_count}}, claims:{'id|dia':true}}
function st(){return G.online()&&S?S:L}
function contar(kind,n){
  for(const box of [L,S]){if(!box)continue;const c=box.counters[kind]||(box.counters[kind]={total:0,day:hoje(),day_count:0});
    if(c.day!==hoje()){c.day=hoje();c.day_count=0}c.total+=n;c.day_count+=n}
  saveL();marcar();if(!$('missoes').hidden)render();
}
window.addEventListener('garro:evento',e=>contar(e.detail.kind,e.detail.n||1));

function progresso(m,diaria){
  const coll=G.coll();
  if(m.tipo==='distinct')return Object.keys(coll).filter(k=>coll[k]>0).length;
  if(m.tipo==='level_big'){let v=0;for(let i=0;i<G.CH0;i++)if((coll[i]||0)>0)v=Math.max(v,G.lvOf(i));return v}
  const c=st().counters[m.tipo];if(!c)return m.tipo==='capture'&&!diaria?somaColl():0;
  if(diaria)return c.day===hoje()?c.day_count:0;
  return m.tipo==='capture'?Math.max(c.total,somaColl()):c.total;
}
function somaColl(){const c=G.coll();let t=0;for(const k in c)t+=c[k]||0;return t}
function pego(id,diaria){return !!st().claims[id+'|'+(diaria?hoje():BASE_DAY)]}
function etapaAtual(){for(let i=0;i<D.percurso.length;i++)if(!pego(D.percurso[i].id,false))return i;return D.percurso.length}
function prontas(){let n=0;const i=etapaAtual();if(i<D.percurso.length&&progresso(D.percurso[i],false)>=D.percurso[i].meta)n++;
  for(const m of diariasDoDia(hoje()))if(!pego(m.id,true)&&progresso(m,true)>=m.meta)n++;return n}
function marcar(){const b=$('btnMis');if(b)b.classList.toggle('tem',prontas()>0)}

async function carregarServidor(){
  if(!G.online())return;
  try{const sb=G.sb();
    const [{data:c},{data:k}]=await Promise.all([sb.from('mission_counters').select('kind,total,day,day_count'),sb.from('mission_claims').select('mission,day')]);
    const n={counters:{},claims:{}};(c||[]).forEach(r=>{n.counters[r.kind]={total:r.total,day:r.day,day_count:r.day_count}});(k||[]).forEach(r=>{n.claims[r.mission+'|'+r.day]=true});S=n;marcar();if(!$('missoes').hidden)render()
  }catch(e){console.warn('missões',e)}
}

async function pegar(id,diaria,btn){
  const m=(diaria?diariasDoDia(hoje()):D.percurso).find(x=>x.id===id);if(!m||pego(id,diaria))return;
  if(progresso(m,diaria)<m.meta)return;btn.disabled=true;G.click(700);
  if(G.online()){const r=await G.sync('mission_claim',{id});
    if(!r||r.error||typeof r.coins!=='number'){btn.disabled=false;$('misMsg').textContent='Ainda não deu para pegar este prêmio. Tente de novo.';await carregarServidor();return}
    G.setCoins(r.coins);S.claims[id+'|'+(diaria?hoje():BASE_DAY)]=true}
  else{L.claims[id+'|'+(diaria?hoje():BASE_DAY)]=true;saveL();G.addCoinsLocal(m.premio)}
  $('misMsg').textContent='';G.fanfare();G.banner('+'+m.premio+' moedas','Missão: '+m.texto,true);render();marcar();
}

function barra(v,meta){const p=Math.min(100,Math.round(v/meta*100));return '<div class="mbar"><i style="width:'+p+'%"></i></div><small>'+Math.min(v,meta)+' / '+meta+'</small>'}
function render(){
  const cur=etapaAtual(),P=D.percurso;let h='';
  h+='<div class="shsec">Percurso <small>'+Math.min(cur,P.length)+' de '+P.length+'</small></div><ol class="mtrail">';
  P.forEach((m,i)=>{const feito=i<cur,atual=i===cur,v=atual?progresso(m,false):0,ok=atual&&v>=m.meta;
    h+='<li class="'+(feito?'feito':atual?'atual':'bloq')+'"><span class="mico">'+(feito?'✅':atual?m.icone:'🔒')+'</span><div class="mtx"><b>'+m.texto+'</b>'+(atual?barra(v,m.meta):'')+'</div><span class="mpr">'+(feito?'pego':(ok?'<button data-id="'+m.id+'" data-d="0">Pegar '+m.premio+' 🪙</button>':m.premio+' 🪙'))+'</span></li>'});
  h+='</ol>'+(cur>=P.length?'<p class="shnote">Percurso completo! 🎉</p>':'');
  h+='<div class="shsec">Missões de hoje <small>trocam à meia-noite</small></div>';
  for(const m of diariasDoDia(hoje())){const v=progresso(m,true),feito=pego(m.id,true),ok=!feito&&v>=m.meta;
    h+='<div class="shitem mday'+(feito?' feito':'')+'"><div class="shpic">'+m.icone+'</div><div class="shtx"><b>'+m.texto+'</b>'+barra(v,m.meta)+'</div>'+(feito?'<span class="mpr">pego ✅</span>':ok?'<button data-id="'+m.id+'" data-d="1">Pegar '+m.premio+' 🪙</button>':'<span class="mpr">'+m.premio+' 🪙</span>')+'</div>'}
  $('misList').innerHTML=h;
}

// ---- tela (montada aqui para não aumentar o index.html) ----
const hudEl=document.querySelector('.hud');
if(hudEl&&!$('btnMis')){const b=document.createElement('button');b.className='chip shopbtn';b.id='btnMis';b.type='button';b.innerHTML='<span>Missões</span><b>🎯</b>';hudEl.appendChild(b);hudEl.classList.add('com-missoes')}
const pan=document.createElement('div');pan.className='shop';pan.id='missoes';pan.hidden=true;
pan.innerHTML='<h3>Missões</h3><div class="shopcoins">Complete e ganhe moedas 🪙<div id="misMsg" style="color:#ff8a8a;min-height:16px;font-size:12px"></div></div><div class="shopscroll" id="misList"></div><button class="shclose" id="misClose">Voltar</button>';
document.body.appendChild(pan);
$('btnMis').addEventListener('click',()=>{G.click(650);$('misMsg').textContent='';render();pan.hidden=false;carregarServidor()});
$('misClose').addEventListener('click',()=>{pan.hidden=true});
$('misList').addEventListener('click',e=>{const b=e.target.closest('button[data-id]');if(b)pegar(b.dataset.id,b.dataset.d==='1',b)});
setTimeout(carregarServidor,2500);marcar();
window.GARRO_MISSOES={diariasDoDia,hoje,progresso,etapaAtual};// usado nos testes
})();
