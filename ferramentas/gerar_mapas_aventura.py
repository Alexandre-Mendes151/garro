# Gera os mapas 3D (vista de cima) das fases da Aventura e grava em data/aventura.json (campo "mapa3d" de cada fase).
# Unidades em metros do jogo (o bichinho grande tem ~1 de altura). O mapa vai de z=0 (início) até z=L (portal);
# x de -LARG/2 a +LARG/2. Rodar de novo SOBRESCREVE os mapas (os números ficam iguais com a mesma semente).
# Uso: python3 ferramentas/gerar_mapas_aventura.py
import json,math,os,random
LARG=26
def gera(n,f,seed=7):
  rnd=random.Random(seed*1009+n);chefe='chefe' in f
  L=58+n*6 if not chefe else 96
  # caminho sinuoso
  pts=[];x=0.0
  for z in range(0,L+1,6):
    if 6<z<L-6:x=max(-8,min(8,x+rnd.uniform(-4.5,4.5)))
    elif z>=L-6:x*=.4
    pts.append([round(x,2),float(z)])
  def dcam(px,pz):
    best=1e9
    for (ax,az),(bx,bz) in zip(pts,pts[1:]):
      vx,vz=bx-ax,bz-az;t=max(0,min(1,((px-ax)*vx+(pz-az)*vz)/(vx*vx+vz*vz)));best=min(best,math.hypot(px-(ax+t*vx),pz-(az+t*vz)))
    return best
  def xcam(z):
    for (ax,az),(bx,bz) in zip(pts,pts[1:]):
      if az<=z<=bz:return ax+(bx-ax)*(z-az)/(bz-az)
    return pts[-1][0]
  livre=[]  # áreas que não podem ter árvore (acampamentos, arena)
  # acampamentos de inimigos ao longo do caminho
  total=4+n if not chefe else 7;inim=f['inimigos'];camps=[];k=0
  fim=L-14 if not chefe else L-30
  nc=max(2,math.ceil(total/2));zs=[14+(fim-14)*q/(nc-1) for q in range(nc)]
  for q,z in enumerate(zs):
    cx=xcam(z)+rnd.uniform(-2.5,2.5);quant=min(3,total-k) if q<nc-1 else total-k
    if quant<=0:break
    grupo=[]
    for j in range(quant):
      i,lv=inim[k%len(inim)];k+=1;a=j/max(1,quant)*6.283+rnd.uniform(0,1)
      grupo.append([i,lv,round(cx+math.cos(a)*1.6,2),round(z+math.sin(a)*1.6,2)])
    camps.append({"x":round(cx,2),"z":round(z,2),"inimigos":grupo});livre.append((cx,z,3.5))
  arena=None
  if chefe:
    az=L-16;arena={"x":0.0,"z":float(az),"r":9.0};livre.append((0,az,10));pts[-1]=[0.0,float(L)];pts[-2][0]=0.0;pts[-3][0]*=.3
  # folhas douradas: fora do caminho, escondidas
  folhas=[]
  while len(folhas)<3:
    z=rnd.uniform(10,L-12);x=xcam(z)+rnd.choice([-1,1])*rnd.uniform(4.5,8.5)
    if abs(x)<LARG/2-2 and all(math.hypot(x-a,z-b)>8 for a,b in folhas):folhas.append([round(x,2),round(z,2)])
  morangos=[]
  for q in range(3+n//3):
    z=rnd.uniform(8,L-8);x=xcam(z)+rnd.choice([-1,1])*rnd.uniform(2.2,3.4);morangos.append([round(x,2),round(z,2)])
  # árvores, pedras e cogumelos (fora do caminho, dos acampamentos e dos itens)
  arv,ped,cog=[],[],[]
  ocup=[(a,b,1.6) for a,b in folhas+morangos]
  def ok(x,z,r):
    if dcam(x,z)<2.9+r:return False
    if any(math.hypot(x-a,z-b)<rr+r for a,b,rr in livre):return False
    if any(math.hypot(x-a,z-b)<rr+r for a,b,rr in ocup):return False
    return True
  for _ in range(int(L*2.3)):
    x=rnd.uniform(-LARG/2+.5,LARG/2-.5);z=rnd.uniform(-2,L+2);t=rnd.random()
    s=rnd.uniform(.85,1.35)
    if t<.62:r=.55*s
    elif t<.85:r=.5*s
    else:r=.35*s
    if not ok(x,z,r):continue
    ocup.append((x,z,r+.4));(arv if t<.62 else ped if t<.85 else cog).append([round(x,2),round(z,2),round(s,2)])
  # borda: fileira de árvores dos dois lados e no começo
  for z in range(-2,L+3,2):
    for sx in (-1,1):arv.append([round(sx*(LARG/2+rnd.uniform(-.3,.6)),2),float(z),round(rnd.uniform(1,1.5),2)])
  for x in range(-LARG//2,LARG//2+1,2):arv.append([float(x),round(-3+rnd.uniform(-.4,.4),2),round(rnd.uniform(1,1.4),2)])
  return {"largura":LARG,"comprimento":L,"caminho":pts,"inicio":[pts[0][0],1.5],"portal":[pts[-1][0],float(L-2)],
          "acampamentos":camps,"folhas":folhas,"morangos":morangos,"arvores":arv,"pedras":ped,"cogumelos":cog,"arena":arena}
p=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','data','aventura.json');D=json.load(open(p))
for k,f in enumerate(D['mundos'][0]['fases']):
  f.pop('mapa',None);f['mapa3d']=gera(k+1,f)
  m=f['mapa3d'];print(f['id'],'L',m['comprimento'],'inimigos',sum(len(c['inimigos']) for c in m['acampamentos']),'árvores',len(m['arvores']))
D.pop('plataforma',None)
D.setdefault('arena',{})
txt=json.dumps(D,ensure_ascii=False,indent=1)
# mapas numa linha só por lista (o arquivo fica bem menor e legível)
import re
txt=re.sub(r'\[\s+(-?[\d.]+),\s+(-?[\d.]+)(?:,\s+(-?[\d.]+))?(?:,\s+(-?[\d.]+))?\s+\]',lambda m_:'['+','.join(g for g in m_.groups() if g is not None)+']',txt)
open(p,'w').write(txt)
