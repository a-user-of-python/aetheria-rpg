// World v2: textured terrain, biome trees, redesigned spacious villages,
// caves, Dark Tower — plus a COLLIDERS list so nothing solid can be walked through.
// Whole 2400x2400 map is built once at load; detail via THREE.LOD.
import * as THREE from "three";
import { VILLAGES } from "./data.js";
import { makeTextures, textured } from "./textures.js";

export const WORLD_SIZE = 2400;
export const COLLIDERS = []; // {x,z,r}
function hash(x,z){ const s=Math.sin(x*127.1+z*311.7)*43758.5453; return s-Math.floor(s); }
function noise(x,z){
  const xi=Math.floor(x), zi=Math.floor(z), xf=x-xi, zf=z-zi;
  const u=xf*xf*(3-2*xf), v=zf*zf*(3-2*zf);
  return hash(xi,zi)*(1-u)*(1-v)+hash(xi+1,zi)*u*(1-v)+hash(xi,zi+1)*(1-u)*v+hash(xi+1,zi+1)*u*v;
}
const FLAT = [...VILLAGES.map(v=>({x:v.x,z:v.z,r:125})), {x:880,z:-880,r:120}];
export function terrainHeight(x,z){
  let h = noise(x*0.004+10, z*0.004+10)*26 + noise(x*0.015, z*0.015)*7 + noise(x*0.05,z*0.05)*1.6;
  const d = Math.sqrt(x*x+z*z);
  const mtn = Math.max(0, (d-750)/450); h += mtn*mtn*85*(0.6+noise(x*0.006,z*0.006)*0.7);
  const ridge = Math.max(0, Math.sin(x*0.002+1.3))*Math.max(0,(Math.abs(z+300)-350)/300); h += ridge*38;
  for(const f of FLAT){ const fd=Math.hypot(x-f.x,z-f.z); if(fd<f.r){ const t=Math.max(0,fd/f.r); h*= (t*t); } }
  return h;
}
// biome at a point: snow (high / cold north), autumn (west), blossom (south-east), else green
export function biomeAt(x,z,h){
  if(h>26) return "snow";
  if(x<-350 && noise(x*0.002,z*0.002)>0.42) return "autumn";
  if(x>250 && z>250) return "blossom";
  return "green";
}

export function buildWorld(scene){
  const T = makeTextures();
  const group = new THREE.Group();
  // Terrain: grass texture map multiplied by height vertex colours
  const seg=220, geo=new THREE.PlaneGeometry(WORLD_SIZE,WORLD_SIZE,seg,seg);
  geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position, colors=[];
  const cGrass=new THREE.Color(0xffffff), cDry=new THREE.Color(0xd8e6b0), cRock=new THREE.Color(0xb9bec6), cSnow=new THREE.Color(0xffffff), cSand=new THREE.Color(0xf2e2b0);
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i), z=pos.getZ(i), h=terrainHeight(x,z); pos.setY(i,h);
    let c = h>34? cSnow : h>22? cRock : h>13? cDry : cGrass;
    if(h<2.2) c=cSand;
    colors.push(c.r,c.g,c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors,3));
  geo.computeVertexNormals();
  const grassTex=T.grass.clone(); grassTex.needsUpdate=true; grassTex.repeat.set(180,180);
  const terrain=new THREE.Mesh(geo, new THREE.MeshStandardMaterial({map:grassTex, vertexColors:true, roughness:1}));
  terrain.receiveShadow=true; group.add(terrain);
  // snow cap overlay patches on high ground handled by vertex colour whitening above.

  // Paths (dirt texture)
  const pathMat=textured(T.dirt, 0xffffff, 1, 1, 1);
  const pathPts=[[0,60],[-520,-340],[640,-520],[-700,520],[560,640],[880,-880]];
  for(let i=0;i<pathPts.length-1;i++){
    const [x1,z1]=pathPts[i],[x2,z2]=pathPts[i+1]; const len=Math.hypot(x2-x1,z2-z1), steps=Math.ceil(len/22);
    for(let s2=0;s2<steps;s2++){
      const t=s2/steps, x=x1+(x2-x1)*t, z=z1+(z2-z1)*t;
      const p=new THREE.Mesh(new THREE.CircleGeometry(12,18), pathMat);
      p.rotation.x=-Math.PI/2; p.rotation.z=Math.random()*3; p.position.set(x, terrainHeight(x,z)+0.22, z); group.add(p);
    }
  }

  // ---- Trees by biome, varied shapes ----
  const barkMat=textured(T.bark, 0xffffff, 1, 2, 0.95);
  const leafMats={ green:textured(T.leaves,0xffffff,2,2,0.9), snow:textured(T.leavesSnow,0xffffff,2,2,0.9),
    autumn:textured(T.leavesAutumn,0xffffff,2,2,0.9), blossom:textured(T.leavesBlossom,0xffffff,2,2,0.9) };
  const rockMat=textured(T.rock, 0xffffff, 1, 1, 0.95);
  function canopy(lod, kind, biome, s){
    const lm=leafMats[biome];
    const hi=new THREE.Group(), lo=new THREE.Group();
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.42*s,0.75*s,5*s,10), barkMat); trunk.position.y=2.5*s; trunk.castShadow=true; hi.add(trunk);
    const trunkLo=new THREE.Mesh(new THREE.CylinderGeometry(0.55*s,0.55*s,5*s,6), barkMat); trunkLo.position.y=2.5*s; lo.add(trunkLo);
    if(kind==="pine"||kind==="snowpine"){
      for(let k=0;k<4;k++){ const c=new THREE.Mesh(new THREE.ConeGeometry((3.1-k*0.55)*s, 3.4*s, 14), lm); c.position.y=(4.6+k*1.9)*s; c.castShadow=true; hi.add(c); }
      if(kind==="snowpine"){ const cap=new THREE.Mesh(new THREE.ConeGeometry(1.1*s,1.4*s,12), textured(T.snow,0xffffff)); cap.position.y=11.6*s; hi.add(cap); }
      const cLo=new THREE.Mesh(new THREE.ConeGeometry(2.6*s, 8*s, 8), lm); cLo.position.y=7*s; lo.add(cLo);
    } else if(kind==="dead"){
      for(let k=0;k<3;k++){ const br=new THREE.Mesh(new THREE.CylinderGeometry(0.12*s,0.22*s,3.4*s,6), barkMat); br.position.set(Math.cos(k*2.1)*1.1*s,(5.6+k)*s,Math.sin(k*2.1)*1.1*s); br.rotation.z=Math.cos(k*2.1)*0.7; hi.add(br); }
      const cLo=new THREE.Mesh(new THREE.CylinderGeometry(0.2*s,0.3*s,4*s,5), barkMat); cLo.position.y=6*s; lo.add(cLo);
    } else { // oak / autumn / blossom: clustered round canopies, all different
      const n=3+Math.floor(Math.random()*3);
      for(let k=0;k<n;k++){ const c=new THREE.Mesh(new THREE.SphereGeometry((2.2+Math.random()*1.3)*s,20,16), lm);
        c.position.set((Math.random()*2-1)*1.7*s,(5.6+Math.random()*2.2)*s,(Math.random()*2-1)*1.7*s); c.castShadow=true; hi.add(c); }
      const cLo=new THREE.Mesh(new THREE.SphereGeometry(3*s,8,6), lm); cLo.position.y=6.4*s; lo.add(cLo);
    }
    lod.addLevel(hi,0); lod.addLevel(lo,200); return lod;
  }
  let seed=11; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
  for(let i=0;i<700;i++){
    const x=(rnd()*2-1)*1150, z=(rnd()*2-1)*1150;
    if(FLAT.some(f=>Math.hypot(x-f.x,z-f.z)<f.r*0.82)) continue;
    const h=terrainHeight(x,z); const biome=biomeAt(x,z,h);
    if(rnd()<0.24){ // rocks — irregular, not spheres-with-delusions
      const s=1+rnd()*2.8; const lod=new THREE.LOD();
      const hi=new THREE.Mesh(new THREE.SphereGeometry(s,18,14), rockMat);
      const pp=hi.geometry.attributes.position; for(let vi=0;vi<pp.count;vi++){ const f=0.82+rnd()*0.36; pp.setXYZ(vi, pp.getX(vi)*f, pp.getY(vi)*f*0.72, pp.getZ(vi)*f); } hi.geometry.computeVertexNormals();
      hi.castShadow=true; const lo=new THREE.Mesh(new THREE.SphereGeometry(s,7,5), rockMat); lo.scale.y=0.7;
      lod.addLevel(hi,0); lod.addLevel(lo,230); lod.position.set(x,h+s*0.15,z); lod.rotation.y=rnd()*3; group.add(lod);
      COLLIDERS.push({x,z,r:s*0.95}); continue;
    }
    let kind = biome==="snow"? (rnd()<0.8?"snowpine":"dead") : biome==="green"? (rnd()<0.45?"pine":"oak") : "oak";
    const lod=new THREE.LOD(); canopy(lod, kind, biome, 0.85+rnd()*0.95);
    lod.position.set(x,h-0.2,z); lod.rotation.y=rnd()*Math.PI*2; group.add(lod);
    COLLIDERS.push({x,z,r:1.1});
  }

  // ---- Villages redesigned: spacious, varied houses with detail ----
  const villages=[];
  const wallTex=[T.plaster, T.planks];
  const roofCols=[0xb5533c,0x7a5aa0,0x4a7a9c,0x9c6a3a,0x5e8c4f,0xb5533c,0x86614f];
  VILLAGES.forEach((v,vi)=>{
    const vg=new THREE.Group(); const y=terrainHeight(v.x,v.z);
    const plaza=new THREE.Mesh(new THREE.CircleGeometry(26,28), textured(T.dirt,0xffffff,3,3)); plaza.rotation.x=-Math.PI/2; plaza.position.set(v.x,y+0.18,v.z); vg.add(plaza);
    for(let i=0;i<7;i++){
      const a=i/7*Math.PI*2+vi, hx=v.x+Math.cos(a)*62, hz=v.z+Math.sin(a)*62, hy=terrainHeight(hx,hz);
      const W=15+((i*7)%5), D=12+((i*3)%4), H=8+((i*5)%3);
      const house=new THREE.Group();
      const walls=new THREE.Mesh(new THREE.BoxGeometry(W,H,D), textured(wallTex[i%2], 0xffffff, 2, 1, 0.9)); walls.position.y=H/2; walls.castShadow=true; house.add(walls);
      const roof=new THREE.Mesh(new THREE.ConeGeometry(Math.max(W,D)*0.78, 5.5+((i*2)%3), 4, 1), textured(T.shingle, roofCols[i%roofCols.length], 3, 2, 0.9));
      roof.position.y=H+2.6; roof.rotation.y=Math.PI/4; roof.castShadow=true; house.add(roof);
      const chim=new THREE.Mesh(new THREE.BoxGeometry(1.8,4.4,1.8), rockMat); chim.position.set(W*0.28, H+4.4, 0); house.add(chim);
      const door=new THREE.Mesh(new THREE.BoxGeometry(3,4.8,0.35), textured(T.planks, 0x8a6a45)); door.position.set(0,2.4,D/2+0.15); house.add(door);
      const winMat=new THREE.MeshStandardMaterial({color:0xffd98a, emissive:0xffb84d, emissiveIntensity:0.9});
      for(const wx of [-W*0.3, W*0.3]){ const win=new THREE.Mesh(new THREE.BoxGeometry(2.2,2.2,0.25), winMat); win.position.set(wx, H*0.58, D/2+0.12); house.add(win); }
      const porch=new THREE.Mesh(new THREE.BoxGeometry(W*0.7,0.5,3.4), textured(T.planks,0xa8845c)); porch.position.set(0,0.25,D/2+1.8); house.add(porch);
      // little fenced garden with flower dots
      for(let f=0;f<5;f++){ const fx2=(Math.random()*2-1)*W*0.55, fz2=D/2+4.5+Math.random()*2;
        const stem=new THREE.Mesh(new THREE.SphereGeometry(0.42,10,8), new THREE.MeshStandardMaterial({color:[0xff7bcd,0xffa657,0xffe27a,0xc792ff,0xff6a6a][f%5], roughness:0.6}));
        stem.position.set(fx2,0.6,fz2); house.add(stem); }
      house.position.set(hx,hy,hz); house.lookAt(v.x,hy,v.z); vg.add(house);
      COLLIDERS.push({x:hx,z:hz,r:Math.max(W,D)*0.62});
    }
    const well=new THREE.Mesh(new THREE.CylinderGeometry(3,3,2.4,16), rockMat); well.position.set(v.x,y+1.2,v.z); well.castShadow=true; vg.add(well);
    const wellRoof=new THREE.Mesh(new THREE.ConeGeometry(4.4,2.4,10), textured(T.shingle,0xb5533c)); wellRoof.position.set(v.x,y+6.4,v.z); vg.add(wellRoof);
    for(const dx of [-3,3]){ const post2=new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.25,4.6,8), barkMat); post2.position.set(v.x+dx,y+2.3,v.z); vg.add(post2); }
    COLLIDERS.push({x:v.x,z:v.z,r:3.6});
    const board=new THREE.Mesh(new THREE.BoxGeometry(5.4,3.8,0.5), textured(T.planks,0xd9b878)); board.position.set(v.x+10,y+2.8,v.z+6); vg.add(board);
    const boardRoof=new THREE.Mesh(new THREE.BoxGeometry(6.6,0.4,2.6), textured(T.shingle,0x7a5aa0)); boardRoof.position.set(v.x+10,y+5.2,v.z+6); vg.add(boardRoof);
    COLLIDERS.push({x:v.x+10,z:v.z+6,r:2.6});
    const stall=new THREE.Mesh(new THREE.BoxGeometry(8.5,3.6,5), textured(T.planks,0xffffff)); stall.position.set(v.x-11,y+1.8,v.z+7); vg.add(stall);
    const canopy2=new THREE.Mesh(new THREE.ConeGeometry(7,2.4,4,1), new THREE.MeshStandardMaterial({color:0x58a6ff, roughness:0.8})); canopy2.position.y=0; canopy2.position.set(v.x-11,y+5.4,v.z+7); canopy2.rotation.y=Math.PI/4; vg.add(canopy2);
    COLLIDERS.push({x:v.x-11,z:v.z+7,r:4.6});
    // lamp posts around plaza
    for(let li=0;li<4;li++){ const la=li/4*Math.PI*2+0.4, lx=v.x+Math.cos(la)*22, lz=v.z+Math.sin(la)*22, ly=terrainHeight(lx,lz);
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.28,5.6,8), barkMat); pole.position.set(lx,ly+2.8,lz); vg.add(pole);
      const lamp=new THREE.Mesh(new THREE.SphereGeometry(0.65,14,10), new THREE.MeshStandardMaterial({color:0xffe9a8, emissive:0xffc44d, emissiveIntensity:1.8})); lamp.position.set(lx,ly+5.9,lz); vg.add(lamp);
      COLLIDERS.push({x:lx,z:lz,r:0.7}); }
    group.add(vg); villages.push({...v, y, group:vg});
  });

  // Caves
  const caves=[]; const caveSpots=[[-260,240],[300,-180],[-880,-160],[180,820],[820,240],[-380,-760]];
  for(const [cx,cz] of caveSpots){
    const cg=new THREE.Group(); const cy=terrainHeight(cx,cz);
    for(let i=0;i<8;i++){ const a=(i/8)*Math.PI; const r=new THREE.Mesh(new THREE.SphereGeometry(4.6,16,12), rockMat);
      const pp=r.geometry.attributes.position; for(let vi=0;vi<pp.count;vi++){ const f=0.85+hash(vi,i)*0.3; pp.setXYZ(vi,pp.getX(vi)*f,pp.getY(vi)*f,pp.getZ(vi)*f); }
      r.position.set(Math.cos(a)*9.5, Math.sin(a)*8.5, 0); r.castShadow=true; cg.add(r); COLLIDERS.push({x:cx+Math.cos(a)*9.5*Math.cos(Math.atan2(0-cz,0-cx)), z:cz, r:3.4}); }
    const glow=new THREE.Mesh(new THREE.SphereGeometry(1.1,16,12), new THREE.MeshStandardMaterial({color:0xaee9ff, emissive:0x66ccff, emissiveIntensity:1.6}));
    glow.position.set(0,2,-5); cg.add(glow);
    cg.position.set(cx,cy,cz); cg.lookAt(0,cy,0); group.add(cg); caves.push({x:cx,z:cz,y:cy});
  }

  // Dark Tower
  const tower=new THREE.Group(); const tx=880,tz=-880, ty=terrainHeight(tx,tz);
  const stoneMat=textured(T.rock, 0x8a84a0, 4, 6, 0.95);
  const tbase=new THREE.Mesh(new THREE.CylinderGeometry(15,19,85,24), stoneMat); tbase.position.y=42; tbase.castShadow=true; tower.add(tbase);
  for(let wi=0;wi<6;wi++){ const a=wi/6*Math.PI*2; const win=new THREE.Mesh(new THREE.BoxGeometry(2,3.4,0.4), new THREE.MeshStandardMaterial({color:0xd8b8ff, emissive:0x9955ff, emissiveIntensity:1.2}));
    win.position.set(Math.cos(a)*15.4, 18+wi*9, Math.sin(a)*15.4); win.lookAt(Math.cos(a)*30, 18+wi*9, Math.sin(a)*30); tower.add(win); }
  const ttop=new THREE.Mesh(new THREE.ConeGeometry(19,26,24), textured(T.shingle,0x6a4a8a,4,3)); ttop.position.y=97; tower.add(ttop);
  const orb=new THREE.Mesh(new THREE.SphereGeometry(4,24,18), new THREE.MeshStandardMaterial({color:0xc792ff, emissive:0x9955ff, emissiveIntensity:2}));
  orb.position.y=116; tower.add(orb);
  tower.position.set(tx,ty,tz); group.add(tower); COLLIDERS.push({x:tx,z:tz,r:19});

  scene.add(group);
  return { villages, caves, towerPos:{x:tx,z:tz,y:ty}, orb };
}
// Resolve collisions: push a point (with radius pr) out of every nearby collider.
export function collide(p, pr=1.2){
  for(const c of COLLIDERS){ const dx=p.x-c.x, dz=p.z-c.z; const rr=c.r+pr; const d2=dx*dx+dz*dz;
    if(d2<rr*rr && d2>0.0001){ const d=Math.sqrt(d2); p.x=c.x+dx/d*rr; p.z=c.z+dz/d*rr; } }
}
