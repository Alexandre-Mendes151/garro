# Gera os mapas das fases de plataforma da Aventura e grava em data/aventura.json (campo "mapa" de cada fase).
# Uso: python3 ferramentas/gerar_fases_aventura.py [n da fase para imprimir]
# Os mapas também podem ser editados à mão no JSON; rodar de novo SOBRESCREVE os mapas.
# Legenda: # chão  B caixa  ? bloco-surpresa (morango)  = tronco (só pisa por cima)  T copa baixa (abaixar para passar)
#          ^ espinhos  E inimigo  K chefão  X portão do chefão  L folha dourada (estrela)  S morango  C bandeira de controle
#          G chegada  P início
import json,random,sys,os
R=15;GB=12  # linhas; altura base do chão (linha do topo do chão)
def gera(n,ninim,boss=False,seed=0):
  rnd=random.Random(seed*7919+n)
  cols=[];obj={}  # cols: topo do chão por coluna (None = buraco); obj[(r,c)]=char
  def put(r,c,ch):obj[(r,c)]=ch
  def flat(k,g):
    for _ in range(k):cols.append(g)
  g=GB
  flat(8,g);put(g-1,2,'P')
  dif=n  # 1..10
  segs=['flat','pit','step','plat','blocks']+(['duck'] if dif>=2 else [])+(['thorn'] if dif>=3 else [])+(['pitplat'] if dif>=4 else [])+(['duck','pit'] if dif>=6 else [])
  L=110+dif*12 if not boss else 150
  folhas=[];espacos=[]
  cp=False
  while len(cols)<L:
    s=rnd.choice(segs);c0=len(cols)
    if not cp and c0>L*0.5:
      flat(4,g);put(g-1,c0+1,'C');cp=True;continue
    if s=='flat':
      k=rnd.randint(5,9);flat(k,g);espacos.append((c0+1,c0+k-1,g))
      if rnd.random()<.25:put(g-1,c0+k//2,'S')
    elif s=='pit':
      w=rnd.randint(2,3 if dif>=3 else 2);flat(2,g)
      for _ in range(w):cols.append(None)
      flat(3,g)
      if rnd.random()<.3 and len(folhas)<3 and dif>=2:folhas.append((g-5,c0+2+w//2+1))
    elif s=='step':
      ng=max(9,min(GB,g+rnd.choice([-1,-2,1,2])));
      if ng==g:ng=g-1 if g>9 else g+1
      g=ng;k=rnd.randint(4,7);flat(k,g);espacos.append((c0+1,c0+k-1,g))
    elif s=='plat':
      k=rnd.randint(9,11);flat(k,g);h=g-4;a=c0+2
      for c in range(a,a+4):put(h,c,'B' if rnd.random()<.6 else '?')
      if len(folhas)<3 and rnd.random()<.45:folhas.append((h-1,a+1))
      else:put(h-1,a+2,'S') if rnd.random()<.2 else None
      espacos.append((c0+1,c0+k-1,g))
    elif s=='blocks':
      k=rnd.randint(8,10);flat(k,g)
      for j in range(rnd.randint(1,2)):put(g-1-j,c0+k-2,'B')
      for j in range(rnd.randint(0,2)):put(g-1-j,c0+k-1,'B')
      put(g-4,c0+1,'?')
    elif s=='duck':
      w=rnd.randint(3,5);k=w+8;flat(k,g);a=c0+3
      for c in range(a,a+w):
        for r in range(1,g-2):put(r,c,'T')   # 2 blocos de vão: o bichinho gigante passa abaixado
      if len(folhas)<3 and rnd.random()<.6:folhas.append((g-1,a+w//2))
    elif s=='thorn':
      k=rnd.randint(7,9);flat(k,g);w=rnd.randint(1,2)
      for c in range(c0+3,c0+3+w):put(g-1,c,'^')
    elif s=='pitplat':
      flat(2,g);w=rnd.randint(5,7)
      for _ in range(w):cols.append(None)
      for c in range(c0+3,c0+3+w-2):put(g-2,c,'=')
      flat(3,g)
      if len(folhas)<3 and rnd.random()<.5:folhas.append((g-4,c0+2+w//2))
  # chefão: arena
  if boss:
    c0=len(cols);flat(4,g)
    for r in range(g-6,g):put(r,c0+3,'B') if r<g-3 else None
    a=len(cols);flat(26,g);put(g-1,a+16,'K')
    for r in range(1,g):put(r,a+25,'X')
    flat(10,g);put(g-1,a+30,'G')
  else:
    flat(12,g);put(g-1,len(cols)-6,'G')
  # folhas que faltam: em lugares altos sobre trechos planos
  while len(folhas)<3:
    a,b,gg=rnd.choice(espacos);folhas.append((gg-5,rnd.randint(a,b)))
  for r,c in folhas:put(r,c,'L')
  W=len(cols);rows=[[' ']*W for _ in range(R)]
  for c,t in enumerate(cols):
    if t is None:continue
    for r in range(t,R):rows[r][c]='#'
  for (r,c),ch in obj.items():
    if 0<=r<R and 0<=c<W and rows[r][c]==' ':rows[r][c]=ch
  # inimigos: em chão plano (5 colunas iguais), sem nada em cima, longe do início, do fim e uns dos outros
  cand=[]
  for c in range(14,W-14):
    t=cols[c]
    if t is None or any(cols[c+d]!=t for d in (-2,-1,1,2)):continue
    if any(rows[r][c]!=' ' for r in range(t-3,t)) or any(rows[r][c]=='T' for r in range(0,t)):continue
    cand.append(c)
  rnd.shuffle(cand);usados=[]
  for c in cand:
    if len(usados)>=ninim:break
    if all(abs(c-u)>=7 for u in usados) and not (boss and c>W-40):usados.append(c);rows[cols[c]-1][c]='E'
  return [''.join(x) for x in rows],len(usados)
p=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','data','aventura.json');D=json.load(open(p))
fases=D['mundos'][0]['fases']
for k,f in enumerate(fases):
  n=k+1;boss='chefe' in f
  m,ins=gera(n,4+k if not boss else 8,boss,seed=3)
  f['mapa']=m;print(f['id'],len(m[0]),'inimigos',ins,'folhas',sum(r.count('L') for r in m))
D.setdefault('plataforma',{})
open(p,'w').write(json.dumps(D,ensure_ascii=False,indent=1))
if len(sys.argv)>1:print('\n'.join(fases[int(sys.argv[1])]['mapa']))
