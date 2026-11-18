// Procedural textures — generated on canvas at load, so the game needs no
// image downloads but nothing is a flat colour any more. Every surface gets
// grain, variation and detail: grass blades, stone cracks, wood planks,
// bark ridges, roof shingles, snow sparkle, plaster, fabric weave.
import * as THREE from "three";
function cnv(size, fn){ const c=document.createElement("canvas"); c.width=c.height=size; fn(c.getContext("2d"), size);
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t; }
function speckle(g,s,base,specks,n=2600){ g.fillStyle=base; g.fillRect(0,0,s,s);
  for(let i=0;i<n;i++){ g.fillStyle=specks[Math.floor(Math.random()*specks.length)]; const r=1+Math.random()*3; g.fillRect(Math.random()*s, Math.random()*s, r, r); } }
export function makeTextures(){
  const T={};
  T.grass = cnv(256,(g,s)=>{ speckle(g,s,"#5da85e",["#4c944e","#6fbb6d","#7cc47a","#558f57"],3200);
    g.strokeStyle="rgba(40,110,45,.5)"; for(let i=0;i<380;i++){ const x=Math.random()*s,y=Math.random()*s; g.beginPath(); g.moveTo(x,y); g.lineTo(x+ (Math.random()*4-2), y-4-Math.random()*5); g.stroke(); } });
  T.snow = cnv(256,(g,s)=>{ speckle(g,s,"#eef4fb",["#ffffff","#dde9f5","#e2ecf8"],1800);
    g.fillStyle="rgba(255,255,255,.9)"; for(let i=0;i<90;i++){ g.fillRect(Math.random()*s,Math.random()*s,2,2); } });
  T.rock = cnv(256,(g,s)=>{ speckle(g,s,"#8d9299",["#7a7f87","#9aa0a8","#6e737c"],2200);
    // soft weathered blotches + faint strata bands (no hard line-work)
    for(let i=0;i<40;i++){ const x=Math.random()*s,y=Math.random()*s,r=14+Math.random()*36; const gr=g.createRadialGradient(x,y,2,x,y,r);
      gr.addColorStop(0,"rgba(60,64,72,.20)"); gr.addColorStop(1,"rgba(60,64,72,0)"); g.fillStyle=gr; g.beginPath(); g.arc(x,y,r,0,7); g.fill(); }
    g.fillStyle="rgba(255,255,255,.06)"; for(let y=18;y<s;y+=52){ g.fillRect(0,y,s,7); } });
  T.grassBlade = cnv(128,(g,s)=>{ g.clearRect(0,0,s,s);
    for(let i=0;i<26;i++){ const x=6+Math.random()*(s-12); const sway=(Math.random()*16-8); const hgt=s*0.55+Math.random()*s*0.45;
      const grad=g.createLinearGradient(0,s,0,s-hgt); grad.addColorStop(0,"#3e7d3c"); grad.addColorStop(1,"#79c76e");
      g.strokeStyle=grad; g.lineWidth=3.4; g.beginPath(); g.moveTo(x,s); g.quadraticCurveTo(x+sway*0.3, s-hgt*0.6, x+sway, s-hgt); g.stroke(); } });
  T.grassBlade.wrapS=T.grassBlade.wrapT=THREE.ClampToEdgeWrapping;
  T.cloud = cnv(256,(g,s)=>{ g.clearRect(0,0,s,s);
    for(let i=0;i<26;i++){ const x=s*0.5+(Math.random()*2-1)*s*0.3, y=s*0.55+(Math.random()*2-1)*s*0.16, r=22+Math.random()*44;
      const gr=g.createRadialGradient(x,y,2,x,y,r); gr.addColorStop(0,"rgba(255,255,255,.55)"); gr.addColorStop(1,"rgba(255,255,255,0)"); g.fillStyle=gr; g.beginPath(); g.arc(x,y,r,0,7); g.fill(); } });
  T.cloud.wrapS=T.cloud.wrapT=THREE.ClampToEdgeWrapping;
  T.dirt = cnv(256,(g,s)=>{ speckle(g,s,"#c9b184",["#b89f72","#dcc79c","#a8906144"],2600); });
  T.bark = cnv(256,(g,s)=>{ g.fillStyle="#6e4a2c"; g.fillRect(0,0,s,s);
    for(let x=0;x<s;x+=10+Math.random()*8){ g.fillStyle=["#5d3d24","#7d5734","#4e331e"][Math.floor(Math.random()*3)]; g.fillRect(x,0,5+Math.random()*4,s); }
    g.fillStyle="rgba(30,18,8,.35)"; for(let i=0;i<160;i++){ g.fillRect(Math.random()*s, Math.random()*s, 2, 8+Math.random()*16); } });
  T.planks = cnv(256,(g,s)=>{ g.fillStyle="#9a6a35"; g.fillRect(0,0,s,s);
    for(let y=0;y<s;y+=42){ g.fillStyle=["#a4743d","#8f6130","#9f7038"][Math.floor(Math.random()*3)]; g.fillRect(0,y,s,40);
      g.fillStyle="rgba(60,38,16,.8)"; g.fillRect(0,y,s,2.5);
      g.strokeStyle="rgba(90,60,25,.35)"; for(let i=0;i<7;i++){ g.beginPath(); const yy=y+6+Math.random()*30; g.moveTo(0,yy); g.bezierCurveTo(s*0.3,yy+3,s*0.6,yy-3,s,yy+2); g.stroke(); } } });
  T.shingle = cnv(256,(g,s)=>{ g.fillStyle="#a34a36"; g.fillRect(0,0,s,s);
    for(let y=0;y<s;y+=32){ for(let x=0;x<s;x+=42){ g.fillStyle=["#b5533c","#9c4630","#bd6046"][(x+y)%3]; g.fillRect(x+((y/32)%2)*21-21,y,40,30); g.fillStyle="rgba(60,20,10,.5)"; g.fillRect(x+((y/32)%2)*21-21,y+28,40,3); } } });
  T.plaster = cnv(256,(g,s)=>{ speckle(g,s,"#f0e2c4",["#e6d6b2","#f7ecd2","#e0cda6"],1500); });
  T.leaves = cnv(256,(g,s)=>{ speckle(g,s,"#3f9142",["#35853a","#4da34e","#2f7a33","#5cb364"],3600); });
  T.leavesSnow = cnv(256,(g,s)=>{ speckle(g,s,"#48785a",["#3c6a4e","#557f63"],1600); speckle(g,s,"rgba(0,0,0,0)",["#ffffff","#eef6ff"],0);
    g.fillStyle="#f4f9ff"; for(let i=0;i<1200;i++){ g.fillRect(Math.random()*s, Math.random()*s, 3, 3); } });
  T.leavesAutumn = cnv(256,(g,s)=>{ speckle(g,s,"#c96a2e",["#d9822e","#b8552a","#e09a3a","#a83e22"],3600); });
  T.leavesBlossom = cnv(256,(g,s)=>{ speckle(g,s,"#e58bb1",["#f2a7c3","#d9739d","#ffc7da"],3600); });
  T.fabric = cnv(128,(g,s)=>{ g.fillStyle="#ffffff"; g.fillRect(0,0,s,s); g.fillStyle="rgba(0,0,0,.07)";
    for(let i=0;i<s;i+=4){ g.fillRect(i,0,1,s); g.fillRect(0,i,s,1); } });
  for(const k in T){ T[k].repeat.set(1,1); }
  return T;
}
export function textured(tex, color, rx=1, ry=1, rough=0.9){
  const t=tex.clone(); t.needsUpdate=true; t.repeat.set(rx,ry);
  return new THREE.MeshStandardMaterial({map:t, color, roughness:rough});
}
