# Fotografa o ciclo de caminhada (8 quadros) de cada bichinho para img/andar/: as pernas são mexidas no modelo 3D do visualizador
# (deformação suave, sem recorte). Roda com o jogo aberto num navegador headless (ganchos de teste). Uso: ids  evoluído(0/1)  pasta  [rotações]
import asyncio,base64,io,json,sys,os
sys.path.insert(0,'/home/claude/h')
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright
from snap import route
IDS=[int(x) for x in sys.argv[1].split(',')];EV=sys.argv[2]=='1';OUT=sys.argv[3];NF=8
RY={int(k):float(v) for k,v in (a.split('=') for a in sys.argv[4].split(','))} if len(sys.argv)>4 and sys.argv[4] else {}
AMP=float(os.environ.get('AMP','0.45'))
JS=r'''(args)=>{const [f,NF,AMP,ry,mini]=args;const V=VV(),T=TT().THREE;
 if(f===0||!window.__D){V.scene.traverse(o=>{if(o.material&&o.material.blending===2)o.visible=false});V.floor.visible=false;V.shadow.visible=false;V.blinkAt=1e9;V.nextIdle=1e9;V.st='idle';V.act=null;if(V.S)V.S.lid=0;if(V.C.lids)V.C.lids.forEach(l=>l.rotation.x=V.C.lidOpen);
  V.ry=ry;V.rx=.06;V.vy=0;V.spin.rotation.set(0,0,0);V.spin.updateMatrixWorld(true);
  const root=V.C.root,inv=new T.Matrix4().copy(V.spin.matrixWorld).invert();const ms=[];let mn=new T.Vector3(1e9,1e9,1e9),mx=new T.Vector3(-1e9,-1e9,-1e9);const v=new T.Vector3();
  root.traverse(o=>{if(!o.isMesh||!o.geometry||!o.geometry.attributes.position||o.userData.keep)return;const M=new T.Matrix4().multiplyMatrices(inv,o.matrixWorld),Mi=new T.Matrix4().copy(M).invert();
   const p=o.geometry.attributes.position,orig=new Float32Array(p.array),S=new Float32Array(p.count*3);
   for(let k=0;k<p.count;k++){v.fromBufferAttribute(p,k).applyMatrix4(M);S[k*3]=v.x;S[k*3+1]=v.y;S[k*3+2]=v.z;mn.min(v);mx.max(v)}ms.push({o,M,Mi,orig,S})});
  const H=mx.y-mn.y,hip=mn.y+H*(args[4]?.2:.34);
  // só mexe nas malhas que chegam no chão (corpo/pernas); olhos, orelhas e enfeites ficam como estão
  for(let q=ms.length-1;q>=0;q--){let lo=1e9;const S=ms[q].S;for(let k=1;k<S.length;k+=3)if(S[k]<lo)lo=S[k];if(lo>mn.y+H*.1)ms.splice(q,1)}
  // centro e pivôs das pernas a partir dos pontos de baixo
  let sx=0,n=0,zs=[];for(const m of ms)for(let k=0;k<m.S.length;k+=3)if(m.S[k+1]<mn.y+H*.12){sx+=m.S[k];n++;zs.push(m.S[k+2])}
  zs.sort((a,b)=>a-b);const xm=n?sx/n:0,zm=zs.length?zs[zs.length>>1]:(mn.z+mx.z)/2;
  const zf=zs.filter(z=>z>zm),zb=zs.filter(z=>z<=zm),avg=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);
  const poses=[];root.traverse(o=>poses.push([o,o.position.clone(),o.rotation.clone(),o.scale.clone()]));
  window.__D={poses,ms,mn,mx,H,hip,xm,zm,zF:zf.length?avg(zf):zm+H*.2,zB:zb.length?avg(zb):zm-H*.2,dx:(mx.x-mn.x)*.08,dz:(mx.z-mn.z)*.06}}
 V.ry=ry;V.rx=.06;V.vy=0;V.nextIdle=1e9;V.blinkAt=1e9;V.blinkTo=0;V.st='idle';V.act=null;if(V.S)V.S.lid=0;
 const D=window.__D,ph=f/NF*Math.PI*2,sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)},v=new T.Vector3();
 for(const m of D.ms){const p=m.o.geometry.attributes.position;
  for(let k=0;k<p.count;k++){const x=m.S[k*3],y=m.S[k*3+1],z=m.S[k*3+2];
   const wy=sm(D.hip,D.hip-(D.hip-D.mn.y)*.55,y);if(wy<=0){p.setXYZ(k,m.orig[k*3],m.orig[k*3+1],m.orig[k*3+2]);continue}
   const s=sm(D.xm-D.dx,D.xm+D.dx,x)*2-1,fr=sm(D.zm-D.dz,D.zm+D.dz,z),fb=fr*2-1;
   const th=AMP*Math.sin(ph)*s*fb*wy,zc=D.zB+(D.zF-D.zB)*fr,dy=y-D.hip,dz=z-zc,c=Math.cos(th),sn=Math.sin(th);
   const lift=Math.max(0,Math.cos(ph)*s*fb)*D.H*.05*wy;
   v.set(x,D.hip+dy*c-dz*sn+lift,zc+dy*sn+dz*c).applyMatrix4(m.Mi);p.setXYZ(k,v.x,v.y,v.z)}
  p.needsUpdate=true}
 for(const [o,pp,rr,ss] of D.poses){o.position.copy(pp);o.rotation.copy(rr);o.scale.copy(ss)}
 if(V.C.lids)V.C.lids.forEach(l=>l.rotation.x=V.C.lidOpen);
 V.spin.rotation.y=V.ry;V.spin.rotation.x=V.rx*.6;V.scene.updateMatrixWorld(true);V.renderer.render(V.scene,V.cam);return V.renderer.domElement.toDataURL('image/png')}'''
async def main():
  os.makedirs(OUT,exist_ok=True)
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg=await b.new_page(viewport={'width':760,'height':960},device_scale_factor=1);L=[];pg.on('pageerror',lambda e:L.append(str(e)))
    await pg.route('**/*',route);await pg.goto('http://g.test/index.html');await pg.wait_for_timeout(2500);await pg.evaluate("document.getElementById('attract').hidden=true")
    for i in IDS:
      await pg.evaluate(f"(()=>{{const X=CHX();X.coll[{i}]=1;X.CARE[{i}]={{xp:{9999 if EV else 5},f:50,l:50,p:50,t:Date.now()+1e9}}}})()")
      await pg.evaluate(f'window.__D=null;openViewer({i})');await pg.wait_for_timeout(3500)
      fr=[]
      for f in range(NF):
        d=await pg.evaluate(JS,[f,NF,AMP*(0.6 if i>=20 else 1),RY.get(i,1.0),i>=20]);fr.append(Image.open(io.BytesIO(base64.b64decode(d.split(',')[1]))).convert('RGBA'))
      # restaura a geometria original (é compartilhada com o cache)
      await pg.evaluate("(()=>{const D=window.__D;if(D)for(const m of D.ms){m.o.geometry.attributes.position.array.set(m.orig);m.o.geometry.attributes.position.needsUpdate=true}})()")
      al=np.zeros(fr[0].size[::-1],bool)
      for im in fr:al|=np.array(im)[...,3]>20
      ys,xs=np.where(al);x0,x1,y0,y1=xs.min()-3,xs.max()+4,ys.min()-3,ys.max()+4
      fr=[im.crop((x0,y0,x1,y1)) for im in fr];
      # cada quadro desce até a pata mais baixa encostar no chão (senão ele parece voar durante o passo)
      fr2=[]
      for im in fr:
        al2=np.array(im)[...,3]>40;ys2=np.where(al2.any(1))[0];d=(im.height-2)-(ys2[-1] if len(ys2) else im.height-2)
        z=Image.new('RGBA',im.size);z.paste(im,(0,d),im);fr2.append(z)
      fr=fr2W,H=fr[0].size;sc=128/max(W,H);w,h=round(W*sc),round(H*sc)
      strip=Image.new('RGBA',(w*NF,h))
      for k,im in enumerate(fr):strip.paste(im.resize((w,h),Image.LANCZOS),(k*w,0))
      name=f'{OUT}/{i}{"e" if EV else ""}.webp';strip.save(name,'WEBP',quality=76,method=6);print(i,w,h,os.path.getsize(name),flush=True)
      await pg.evaluate("document.getElementById('vClose').click()");await pg.wait_for_timeout(200)
    print(L[:3]);await b.close()
asyncio.run(main())
