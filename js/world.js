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
  const cGrass=new THREE.Color(0xffffff), cMeadow=new THREE.Color(0xe6f2b8), cDry=new THREE.Color(0xd8e6b0), cRock=new THREE.Color(0xb9bec6), cStrata=new THREE.Color(0xd8c2a0), cSnow=new THREE.Color(0xffffff), cSand=new THREE.Color(0xf2e2b0);
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i), z=pos.getZ(i), h=terrainHeight(x,z); pos.setY(i,h);
    // Breath-of-the-Wild style: big soft meadow patches across the lowlands
    const patch=noise(x*0.0016+40, z*0.0016+40);
    let c = h>34? cSnow : h>22? ((Math.floor(h/7)%2===0)? cRock : cStrata) : h>13? cDry : (patch>0.55? cMeadow : cGrass);
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

  // ---- Grass: REAL 3D tufts — seven bent, tapered blades of geometry each,
  // vertex-coloured dark at the root and pale at the tip (no flat sprites) ----
  {
    const posArr=[], colArr=[], idxArr=[];
    const cBase=new THREE.Color(0x2e6b2c), cTip=new THREE.Color(0x9bdd84);
    let seed=7; const srand=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
    let vOff=0;
    for(let b=0;b<7;b++){
      const ang=b/7*Math.PI*2 + srand()*0.5, h=1.7+srand()*1.1, w=0.17, bend=0.35+srand()*0.4;
      const local=[[-w,0,0],[w,0,0],[-w*0.55,h*0.6,bend*0.45],[w*0.55,h*0.6,bend*0.45],[0,h,bend]];
      const cols=[cBase,cBase,cBase.clone().lerp(cTip,0.5),cBase.clone().lerp(cTip,0.5),cTip];
      const axis=new THREE.Vector3(0,1,0);
      local.forEach((v,i)=>{ const vec=new THREE.Vector3(v[0],v[1],v[2]).applyAxisAngle(axis,ang); posArr.push(vec.x,vec.y,vec.z); colArr.push(cols[i].r,cols[i].g,cols[i].b); });
      idxArr.push(vOff,vOff+1,vOff+2, vOff+2,vOff+1,vOff+3, vOff+2,vOff+3,vOff+4); vOff+=5;
    }
    const tuftGeo=new THREE.BufferGeometry();
    tuftGeo.setAttribute("position", new THREE.Float32BufferAttribute(posArr,3));
    tuftGeo.setAttribute("color", new THREE.Float32BufferAttribute(colArr,3));
    tuftGeo.setIndex(idxArr); tuftGeo.computeVertexNormals();
    const tuftMat=new THREE.MeshStandardMaterial({vertexColors:true, roughness:1, side:THREE.DoubleSide});
    const COUNT=6500; const grass=new THREE.InstancedMesh(tuftGeo, tuftMat, COUNT);
    const dummy=new THREE.Object3D(); let placed=0, guard=0; let gseed=31; const grnd=()=>{ gseed=(gseed*16807)%2147483647; return gseed/2147483647; };
    while(placed<COUNT && guard++<COUNT*4){
      const x=(grnd()*2-1)*1120, z=(grnd()*2-1)*1120, h=terrainHeight(x,z);
      if(h>16) continue; if(FLAT.some(f=>Math.hypot(x-f.x,z-f.z)<f.r*0.5)) continue;
      dummy.position.set(x,h-0.12,z); dummy.rotation.set(0, grnd()*Math.PI, 0); const sc=0.85+grnd()*1.0; dummy.scale.set(sc,sc*(0.9+grnd()*0.4),sc);
      dummy.updateMatrix(); grass.setMatrixAt(placed++, dummy.matrix);
    }
    grass.count=placed; grass.instanceMatrix.needsUpdate=true; group.add(grass);
    // flower patches: little instanced colour dots in the meadows
    const fGeo=new THREE.SphereGeometry(0.32,8,6);
    const fMat=new THREE.MeshStandardMaterial({roughness:0.7});
    const flowers=new THREE.InstancedMesh(fGeo, fMat, 1400); const fcol=new THREE.Color();
    let fp=0; guard=0;
    while(fp<1400 && guard++<8000){ const x=(grnd()*2-1)*1000, z=(grnd()*2-1)*1000, h=terrainHeight(x,z);
      if(h>12) continue; if(FLAT.some(f=>Math.hypot(x-f.x,z-f.z)<f.r*0.5)) continue;
      dummy.position.set(x,h+0.35,z); dummy.rotation.set(0,0,0); dummy.scale.setScalar(0.8+grnd()*0.8); dummy.updateMatrix();
      flowers.setMatrixAt(fp, dummy.matrix); flowers.setColorAt(fp, fcol.setHex([0xff7bcd,0xffe27a,0xffffff,0xffa657,0xc792ff][Math.floor(grnd()*5)])); fp++; }
    flowers.count=fp; if(flowers.instanceColor) flowers.instanceColor.needsUpdate=true; group.add(flowers);
    // bushes: instanced leafy blobs everywhere the grass grows
    const bGeo=new THREE.SphereGeometry(1.6,12,9); bGeo.scale(1,0.72,1);
    const bushMat=new THREE.MeshStandardMaterial({map:T.leaves, roughness:1});
    const bushes=new THREE.InstancedMesh(bGeo, bushMat, 420); let bp=0; guard=0;
    while(bp<420 && guard++<6000){ const x=(grnd()*2-1)*1080, z=(grnd()*2-1)*1080, h=terrainHeight(x,z);
      if(h>17) continue; if(FLAT.some(f=>Math.hypot(x-f.x,z-f.z)<f.r*0.62)) continue;
      dummy.position.set(x,h+0.55,z); dummy.rotation.set(0,grnd()*3,0); dummy.scale.setScalar(0.8+grnd()*1.5); dummy.updateMatrix();
      bushes.setMatrixAt(bp, dummy.matrix); bushes.setColorAt(bp, fcol.setHex([0xffffff,0xd8ffd0,0xffe9c9,0xffd9ec][Math.floor(grnd()*4)])); bp++; }
    bushes.count=bp; bushes.instanceMatrix.needsUpdate=true; if(bushes.instanceColor) bushes.instanceColor.needsUpdate=true; group.add(bushes);
  }
  // ---- Dirt paths between the villages (instanced worn-earth discs) ----
  {
    const pathMat=new THREE.MeshStandardMaterial({map:T.dirt, roughness:1, polygonOffset:true, polygonOffsetFactor:-2});
    const spots=[]; const pairs=[[0,1],[0,2],[0,3],[0,4],[1,3],[2,4]];
    for(const [a,b] of pairs){ const A=VILLAGES[a], B=VILLAGES[b]; const d=Math.hypot(B.x-A.x,B.z-A.z); const steps=Math.floor(d/7);
      for(let s2=2;s2<steps-1;s2++){ const t=s2/steps; spots.push([A.x+(B.x-A.x)*t, A.z+(B.z-A.z)*t]); } }
    const pGeo=new THREE.CircleGeometry(3.6,10); pGeo.rotateX(-Math.PI/2);
    const paths=new THREE.InstancedMesh(pGeo, pathMat, spots.length);
    const dummy=new THREE.Object3D(); let pseed=13; const prand=()=>{ pseed=(pseed*16807)%2147483647; return pseed/2147483647; };
    spots.forEach(([x,z],i)=>{ dummy.position.set(x, terrainHeight(x,z)+0.09, z); dummy.rotation.set(0,prand()*3,0); dummy.scale.set(0.9+prand()*0.5,1,0.9+prand()*0.5); dummy.updateMatrix(); paths.setMatrixAt(i,dummy.matrix); });
    paths.instanceMatrix.needsUpdate=true; group.add(paths);
  }
  // ---- Wildlife: circling birds + butterflies (animated in game.js) ----
  const birds=[], flies=[];
  {
    const birdMat=new THREE.MeshStandardMaterial({color:0x3a4a6b, roughness:0.8});
    for(let i=0;i<9;i++){ const bg=new THREE.Group();
      const body=new THREE.Mesh(new THREE.ConeGeometry(0.5,2.6,8), birdMat); body.rotation.x=Math.PI/2; bg.add(body);
      const wl=new THREE.Mesh(new THREE.PlaneGeometry(3.6,1.1), new THREE.MeshStandardMaterial({color:0x5a6f9e, side:THREE.DoubleSide})); wl.position.x=-1.9; const wlP=new THREE.Group(); wlP.add(wl); bg.add(wlP);
      const wr=wl.clone(); wr.position.x=1.9; const wrP=new THREE.Group(); wrP.add(wr); bg.add(wrP);
      bg.userData={wl:wlP, wr:wrP}; group.add(bg);
      birds.push({grp:bg, cx:(hash(i,5)*2-1)*700, cz:(hash(i,6)*2-1)*700, r:90+hash(i,7)*160, h:62+hash(i,8)*36, sp:0.05+hash(i,9)*0.05, ph:hash(i,10)*6.28});
    }
    const flyCols=[0xff9ecb,0xffe27a,0xaee9ff,0xffa657];
    for(let i=0;i<24;i++){ const fg=new THREE.Group();
      const wmat=new THREE.MeshStandardMaterial({color:flyCols[i%4], side:THREE.DoubleSide, emissive:flyCols[i%4], emissiveIntensity:0.25});
      const wl=new THREE.Mesh(new THREE.PlaneGeometry(0.85,0.6), wmat); wl.position.x=-0.45; const wlP=new THREE.Group(); wlP.add(wl); fg.add(wlP);
      const wr=new THREE.Mesh(new THREE.PlaneGeometry(0.85,0.6), wmat); wr.position.x=0.45; const wrP=new THREE.Group(); wrP.add(wr); fg.add(wrP);
      fg.userData={wl:wlP, wr:wrP}; group.add(fg);
      const ax=(hash(i,11)*2-1)*950, az=(hash(i,12)*2-1)*950;
      flies.push({grp:fg, ax, az, ay:terrainHeight(ax,az), r:3+hash(i,13)*7, sp:0.4+hash(i,14)*0.5, ph:hash(i,15)*6.28});
    }
  }
  // ---- Sky: big soft drifting clouds ----
  const clouds=new THREE.Group();
  for(let i=0;i<26;i++){
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:T.cloud, transparent:true, opacity:0.85, depthWrite:false}));
    const sc=120+hash(i,7)*160; sp.scale.set(sc, sc*0.42, 1);
    sp.position.set((hash(i,1)*2-1)*1300, 190+hash(i,2)*110, (hash(i,3)*2-1)*1300);
    clouds.add(sp);
  }
  group.add(clouds);
  // ---- Ruins: broken stone columns scattered like old Hyrule ----
  const ruinMat=textured(T.rock, 0xcfc8b8, 1, 1, 0.95);
  const ruinSpots=[[240,180],[-420,-60],[120,-640],[-180,420],[720,-140],[-760,-420],[420,420],[-60,-240]];
  for(const [rx,rz] of ruinSpots){
    const ry=terrainHeight(rx,rz); const rg=new THREE.Group();
    for(let ci=0;ci<3;ci++){ const hgt=[7,4.5,2.2][ci]; const col=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.7,hgt,10), ruinMat);
      col.position.set(ci*4.6-4.6, hgt/2, (ci%2)*2-1); col.castShadow=true; rg.add(col);
      const cap=new THREE.Mesh(new THREE.BoxGeometry(3.8,0.8,3.8), ruinMat); cap.position.set(ci*4.6-4.6, hgt+0.4, (ci%2)*2-1); rg.add(cap);
      COLLIDERS.push({x:rx+ci*4.6-4.6, z:rz+(ci%2)*2-1, r:2}); }
    const slab=new THREE.Mesh(new THREE.BoxGeometry(9,1,4), ruinMat); slab.position.set(0,0.5,4); slab.rotation.y=0.4; rg.add(slab);
    rg.position.set(rx,ry,rz); group.add(rg);
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
  for(let i=0;i<1150;i++){
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
    // wooden fences along two arcs of the plaza — villages should feel lived-in
    const fenceMat=textured(T.planks, 0x9a7a52, 1, 1, 0.95);
    for(const arcStart of [0.5, 2.6]){ let prev=null;
      for(let fi=0;fi<=7;fi++){ const fa=arcStart+fi*0.16, fx=v.x+Math.cos(fa)*31, fz=v.z+Math.sin(fa)*31, fy=terrainHeight(fx,fz);
        const post=new THREE.Mesh(new THREE.BoxGeometry(0.5,2.6,0.5), fenceMat); post.position.set(fx,fy+1.3,fz); vg.add(post);
        COLLIDERS.push({x:fx,z:fz,r:0.55});
        if(prev){ const mx=(fx+prev.x)/2, mz=(fz+prev.z)/2, my=(fy+prev.y)/2;
          for(const ry2 of [0.9,1.9]){ const rail=new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(fx-prev.x,fz-prev.z)+0.4,0.32,0.32), fenceMat);
            rail.position.set(mx,my+ry2,mz); rail.rotation.y=-Math.atan2(fz-prev.z,fx-prev.x); vg.add(rail); } }
        prev={x:fx,z:fz,y:fy}; } }
    // second market stall with a striped awning + crates
    const stall2=new THREE.Group();
    const counter=new THREE.Mesh(new THREE.BoxGeometry(8,2.6,3.6), textured(T.planks,0xb08a5a)); counter.position.y=1.3; stall2.add(counter);
    for(const px of [-3.6,3.6]){ const p=new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.24,6,8), barkMat); p.position.set(px,3,0); stall2.add(p); }
    const awn=new THREE.Mesh(new THREE.BoxGeometry(9.6,0.35,5.6), textured(T.fabric, vi%2? 0xff7b6b:0x6bcbff, 3, 1, 0.9)); awn.position.y=6.1; awn.rotation.z=0.1; stall2.add(awn);
    for(let ci=0;ci<3;ci++){ const crate=new THREE.Mesh(new THREE.BoxGeometry(1.7,1.7,1.7), textured(T.planks,0xc9a06a)); crate.position.set(-2.6+ci*2.1,0.85,2.8); stall2.add(crate); }
    stall2.position.set(v.x+16, y, v.z-12); stall2.lookAt(v.x, y, v.z); vg.add(stall2);
    COLLIDERS.push({x:v.x+16,z:v.z-12,r:4.4});
    group.add(vg); villages.push({...v, y, group:vg});
  });

  // Caves — a proper rock mound with a dark mouth, stone frame and crystal
  // clusters flanking the entrance (no more snake-arch, no floating ball).
  const caves=[]; const caveSpots=[[-260,240],[300,-180],[-880,-160],[180,820],[820,240],[-380,-760]];
  const crystalMat=new THREE.MeshStandardMaterial({color:0xaee9ff, emissive:0x55bbee, emissiveIntensity:1.5, roughness:0.2});
  for(const [cx,cz] of caveSpots){
    const cg=new THREE.Group(); const cy=terrainHeight(cx,cz);
    const yaw=Math.atan2(-cx,-cz);
    // mound: one big weathered dome, squashed, sunk into the ground
    const mound=new THREE.Mesh(new THREE.SphereGeometry(13,26,20), rockMat);
    const mp=mound.geometry.attributes.position; for(let vi=0;vi<mp.count;vi++){ const f=0.88+hash(vi,3)*0.22; mp.setXYZ(vi, mp.getX(vi)*f, mp.getY(vi)*f, mp.getZ(vi)*f); } mound.geometry.computeVertexNormals();
    mound.scale.set(1.25,0.72,1); mound.position.y=-1.5; mound.castShadow=true; cg.add(mound);
    // dark mouth: an arch-shaped black inset on the side facing the world centre
    const mouth=new THREE.Mesh(new THREE.CircleGeometry(4.6,20,0,Math.PI), new THREE.MeshBasicMaterial({color:0x06080e}));
    mouth.scale.set(1,1.5,1); mouth.position.set(0,0.4,12.2); cg.add(mouth);
    const mouthFill=new THREE.Mesh(new THREE.PlaneGeometry(9.2,3.4), new THREE.MeshBasicMaterial({color:0x06080e}));
    mouthFill.position.set(0,0.2,12.15); cg.add(mouthFill);
    // stone frame: two jamb boulders + a lintel, clearly an entrance
    for(const sx of [-5.6,5.6]){ const jamb=new THREE.Mesh(new THREE.SphereGeometry(2.6,14,11), rockMat); jamb.position.set(sx,1.2,11.6); jamb.scale.y=1.5; jamb.castShadow=true; cg.add(jamb); }
    const lintel=new THREE.Mesh(new THREE.SphereGeometry(3.4,14,11), rockMat); lintel.position.set(0,7.6,11.6); lintel.scale.set(1.9,0.75,1); cg.add(lintel);
    // crystal clusters at both sides of the mouth — shards, not a ball
    for(const sx of [-8.6,8.6]){ for(let k=0;k<4;k++){ const cr=new THREE.Mesh(new THREE.ConeGeometry(0.5+((k*29)%30)/60, 1.8+((k*41)%50)/28, 6), crystalMat);
      cr.position.set(sx+(k-1.5)*0.85, 0.8, 11.4+((k%2)*0.7)); cr.rotation.z=(k-1.5)*0.24; cg.add(cr); } }
    cg.position.set(cx,cy,cz); cg.lookAt(0,cy,0); group.add(cg); caves.push({x:cx,z:cz,y:cy});
    // colliders: mound sides + jambs, entrance itself stays walkable up to the mouth
    const lx2wx=(lx,lz)=>({x:cx+lx*Math.cos(yaw)+lz*Math.sin(yaw), z:cz-lx*Math.sin(yaw)+lz*Math.cos(yaw)});
    for(const [lx,lz,r] of [[-11,4,4.5],[11,4,4.5],[-8,-6,5],[8,-6,5],[0,-11,6],[-5.6,11.6,2.4],[5.6,11.6,2.4]]){ const w=lx2wx(lx,lz); COLLIDERS.push({x:w.x, z:w.z, r}); }
  }

  // ---- Shrines: BOTW-style puzzle spots. Two kinds alternate:
  // braziers (light all three with your attacks) and orb (carry the sun orb home).
  const shrines=[];
  const shrineSpots=[[-450,80],[350,430],[-150,-520],[700,300],[-820,300],[150,-950]];
  const shrineStone=textured(T.rock, 0xd8d2c2, 1, 1, 0.95);
  const shrineGlow=new THREE.MeshStandardMaterial({color:0x7ef0d4, emissive:0x2fd4ae, emissiveIntensity:1.7, roughness:0.25});
  shrineSpots.forEach(([sx,sz],si)=>{
    const sy=terrainHeight(sx,sz); const sg=new THREE.Group();
    const plat=new THREE.Mesh(new THREE.CylinderGeometry(8,9,1.2,18), shrineStone); plat.position.y=0.4; plat.castShadow=true; sg.add(plat);
    for(const px of [-5.5,5.5]){ const pil=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.3,10,10), shrineStone); pil.position.set(px,5.6,0); pil.castShadow=true; sg.add(pil);
      const cap=new THREE.Mesh(new THREE.SphereGeometry(1.25,12,10), shrineGlow); cap.position.set(px,11.2,0); sg.add(cap);
      COLLIDERS.push({x:sx+px, z:sz, r:1.5}); }
    const lintel=new THREE.Mesh(new THREE.BoxGeometry(14.5,1.6,2.6), shrineStone); lintel.position.y=10.6; sg.add(lintel);
    const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(1.5), shrineGlow); crystal.position.y=7.6; crystal.scale.y=1.5; sg.add(crystal);
    sg.position.set(sx,sy,sz); group.add(sg);
    const shrine={x:sx, z:sz, y:sy, type: si%2===0? "braziers":"orb", solved:false, crystal};
    if(shrine.type==="braziers"){ shrine.braziers=[];
      for(let bi=0;bi<3;bi++){ const ba=bi/3*Math.PI*2+si, bx=sx+Math.cos(ba)*13, bz=sz+Math.sin(ba)*13, by=terrainHeight(bx,bz);
        const bowl=new THREE.Mesh(new THREE.CylinderGeometry(1.5,0.9,1.6,10), shrineStone); bowl.position.set(bx,by+0.8,bz); group.add(bowl);
        const flame=new THREE.Mesh(new THREE.ConeGeometry(0.85,2.6,8), new THREE.MeshStandardMaterial({color:0xffa657, emissive:0xff8830, emissiveIntensity:2.2, transparent:true, opacity:0.92}));
        flame.position.set(bx,by+2.8,bz); flame.visible=false; group.add(flame);
        COLLIDERS.push({x:bx,z:bz,r:1.4}); shrine.braziers.push({x:bx,z:bz,flame,lit:false}); }
    } else { // orb on a pedestal a short trek away; socket ring at the shrine
      const oa=si*1.7+0.6, ox=sx+Math.cos(oa)*34, oz=sz+Math.sin(oa)*34, oy=terrainHeight(ox,oz);
      const ped=new THREE.Mesh(new THREE.CylinderGeometry(1.6,2.1,2.6,10), shrineStone); ped.position.set(ox,oy+1.3,oz); group.add(ped);
      COLLIDERS.push({x:ox,z:oz,r:1.8});
      const orbM=new THREE.Mesh(new THREE.SphereGeometry(1.15,18,14), new THREE.MeshStandardMaterial({color:0xffe9a8, emissive:0xffc44d, emissiveIntensity:1.9}));
      orbM.position.set(ox,oy+3.9,oz); group.add(orbM);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(2.6,0.32,8,22), shrineGlow); ring.rotation.x=Math.PI/2; ring.position.set(sx,sy+1.15,sz); group.add(ring);
      shrine.orbMesh=orbM; shrine.orbHome={x:ox,z:oz,y:oy+3.9}; shrine.ring=ring;
    }
    shrines.push(shrine);
  });

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

  // Hero trees: a few huge lone landmark oaks you can navigate by
  for(const [hx,hz,hs] of [[150,300,2.6],[-350,-520,2.3],[480,120,2.8],[-150,700,2.4],[60,-420,2.5]]){
    const lod=new THREE.LOD(); canopy(lod, "oak", biomeAt(hx,hz,terrainHeight(hx,hz))==="autumn"?"autumn":"green", hs);
    lod.position.set(hx, terrainHeight(hx,hz)-0.2, hz); group.add(lod); COLLIDERS.push({x:hx,z:hz,r:2.2});
  }

  scene.add(group);
  return { villages, caves, towerPos:{x:tx,z:tz,y:ty}, orb, clouds, birds, flies, shrines };
}
// Tagged colliders can be removed again (e.g. camps rebuilt at a new density).
export function addTaggedCollider(tag, c){ c.tag=tag; COLLIDERS.push(c); return c; }
export function removeTaggedColliders(tag){ for(let i=COLLIDERS.length-1;i>=0;i--) if(COLLIDERS[i].tag===tag) COLLIDERS.splice(i,1); }
// Resolve collisions: push a point (with radius pr) out of every nearby collider.
export function collide(p, pr=1.2){
  for(const c of COLLIDERS){ const dx=p.x-c.x, dz=p.z-c.z; const rr=c.r+pr; const d2=dx*dx+dz*dz;
    if(d2<rr*rr && d2>0.0001){ const d=Math.sqrt(d2); p.x=c.x+dx/d*rr; p.z=c.z+dz/d*rr; } }
}

// ---------- Endless wilderness: the homeland is hand-built; beyond its edge the
// world streams forever as deterministic tiles (same height/biome functions,
// seeded scatter), so you can walk in any direction as long as you like. ----------
const TILE=360;
function makeTuftGeo(){
  const posArr=[], colArr=[], idxArr=[]; let seed=7; const sr=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
  const cBase=new THREE.Color(0x2e6b2c), cTip=new THREE.Color(0x9bdd84); let vOff=0;
  for(let b=0;b<7;b++){ const ang=b/7*Math.PI*2+sr()*0.5, h=1.7+sr()*1.1, w=0.17, bend=0.35+sr()*0.4;
    const local=[[-w,0,0],[w,0,0],[-w*0.55,h*0.6,bend*0.45],[w*0.55,h*0.6,bend*0.45],[0,h,bend]];
    const cols=[cBase,cBase,cBase.clone().lerp(cTip,0.5),cBase.clone().lerp(cTip,0.5),cTip];
    local.forEach((v,i)=>{ const vec=new THREE.Vector3(v[0],v[1],v[2]).applyAxisAngle(new THREE.Vector3(0,1,0),ang); posArr.push(vec.x,vec.y,vec.z); colArr.push(cols[i].r,cols[i].g,cols[i].b); });
    idxArr.push(vOff,vOff+1,vOff+2, vOff+2,vOff+1,vOff+3, vOff+2,vOff+3,vOff+4); vOff+=5; }
  const g=new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(posArr,3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colArr,3)); g.setIndex(idxArr); g.computeVertexNormals(); return g;
}
export function createEndless(scene){
  const T=makeTextures();
  const tiles=new Map(); const shrines=[];
  const groundMat=textured(T.grass, 0xffffff, 14, 14, 1); groundMat.vertexColors=true;
  const barkMat=textured(T.bark, 0xffffff, 1, 2, 0.95);
  const leafMats={ green:textured(T.leaves,0xffffff,2,2,0.9), snow:textured(T.leavesSnow,0xffffff,2,2,0.9), autumn:textured(T.leavesAutumn,0xffffff,2,2,0.9), blossom:textured(T.leavesBlossom,0xffffff,2,2,0.9) };
  const rockMat=textured(T.rock, 0xffffff, 1, 1, 0.95);
  const tuftGeo=makeTuftGeo(); const tuftMat=new THREE.MeshStandardMaterial({vertexColors:true, roughness:1, side:THREE.DoubleSide});
  const stoneMat=textured(T.rock, 0xd8d2c2, 1, 1, 0.95);
  const glowMat=new THREE.MeshStandardMaterial({color:0x7ef0d4, emissive:0x2fd4ae, emissiveIntensity:1.7, roughness:0.25});
  const dummy=new THREE.Object3D();
  function buildTile(tx,tz){
    const cx=tx*TILE, cz=tz*TILE; const g=new THREE.Group();
    const geo=new THREE.PlaneGeometry(TILE,TILE,36,36); geo.rotateX(-Math.PI/2);
    const pos=geo.attributes.position, colors=[];
    const cGrass=new THREE.Color(0xffffff), cMeadow=new THREE.Color(0xe6f2b8), cDry=new THREE.Color(0xd8e6b0), cRock=new THREE.Color(0xb9bec6), cStrata=new THREE.Color(0xd8c2a0), cSnow=new THREE.Color(0xffffff), cSand=new THREE.Color(0xf2e2b0);
    for(let i=0;i<pos.count;i++){ const wx=cx+pos.getX(i), wz=cz+pos.getZ(i), h=terrainHeight(wx,wz); pos.setY(i,h);
      const patch=noise(wx*0.0016+40, wz*0.0016+40);
      let c= h>34? cSnow : h>22? ((Math.floor(h/7)%2===0)? cRock:cStrata) : h>13? cDry : (patch>0.55? cMeadow:cGrass);
      if(h<2.2) c=cSand; colors.push(c.r,c.g,c.b); }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors,3)); geo.computeVertexNormals();
    const ground=new THREE.Mesh(geo, groundMat); ground.position.set(cx,0.12,cz); ground.receiveShadow=true; g.add(ground);
    // seeded scatter
    let s=(Math.imul(tx,73856093)^Math.imul(tz,19349663))>>>0; const rnd=()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; };
    const tag="tile:"+tx+","+tz;
    for(let i=0;i<17;i++){ const x=cx+(rnd()*2-1)*(TILE/2-14), z=cz+(rnd()*2-1)*(TILE/2-14); const h=terrainHeight(x,z); const biome=biomeAt(x,z,h);
      if(rnd()<0.3){ const sc=1+rnd()*2.6; const rock=new THREE.Mesh(new THREE.SphereGeometry(sc,12,9), rockMat); rock.scale.y=0.7; rock.position.set(x,h+sc*0.15,z); rock.castShadow=true; g.add(rock); addTaggedCollider(tag,{x,z,r:sc*0.95}); }
      else { const sc=0.9+rnd()*0.9; const tree=new THREE.Group();
        const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.42*sc,0.75*sc,5*sc,8), barkMat); trunk.position.y=2.5*sc; trunk.castShadow=true; tree.add(trunk);
        const lm=leafMats[biome]||leafMats.green;
        if(biome==="snow"&&rnd()<0.8){ for(let k=0;k<3;k++){ const cone=new THREE.Mesh(new THREE.ConeGeometry((2.9-k*0.55)*sc,3.2*sc,10), lm); cone.position.y=(4.8+k*1.8)*sc; tree.add(cone); } }
        else for(let k=0;k<3;k++){ const c=new THREE.Mesh(new THREE.SphereGeometry((2.1+rnd()*1.1)*sc,12,9), lm); c.position.set((rnd()*2-1)*1.5*sc,(5.6+rnd()*2)*sc,(rnd()*2-1)*1.5*sc); c.castShadow=true; tree.add(c); }
        tree.position.set(x,h-0.2,z); tree.rotation.y=rnd()*3; g.add(tree); addTaggedCollider(tag,{x,z,r:1.1}); } }
    // grass tufts
    const tufts=new THREE.InstancedMesh(tuftGeo, tuftMat, 240); let tp=0, guard=0;
    while(tp<240 && guard++<900){ const x=cx+(rnd()*2-1)*(TILE/2-8), z=cz+(rnd()*2-1)*(TILE/2-8); const h=terrainHeight(x,z); if(h>16) continue;
      dummy.position.set(x,h-0.1,z); dummy.rotation.set(0,rnd()*3,0); dummy.scale.setScalar(0.85+rnd()); dummy.updateMatrix(); tufts.setMatrixAt(tp++, dummy.matrix); }
    tufts.count=tp; tufts.instanceMatrix.needsUpdate=true; g.add(tufts);
    // occasional places: a ruin, or a brazier shrine (puzzle included)
    const roll=rnd();
    if(roll<0.10){ for(let ci=0;ci<3;ci++){ const hgt=[6.5,4,2.2][ci]; const col=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.6,hgt,9), stoneMat);
        const lx=(ci-1)*4.6, lz=(ci%2)*2-1; col.position.set(cx+lx, terrainHeight(cx+lx,cz+lz)+hgt/2, cz+lz); col.castShadow=true; g.add(col); addTaggedCollider(tag,{x:cx+lx,z:cz+lz,r:1.9}); } }
    else if(roll<0.16){ const sy=terrainHeight(cx,cz); const shrine={x:cx, z:cz, y:sy, type:"braziers", solved:false, endless:true, tileKey:tx+","+tz, braziers:[]};
      const plat=new THREE.Mesh(new THREE.CylinderGeometry(8,9,1.2,14), stoneMat); plat.position.set(cx,sy+0.4,cz); g.add(plat);
      const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(1.4), glowMat); crystal.position.set(cx,sy+7,cz); crystal.scale.y=1.5; g.add(crystal); shrine.crystal=crystal;
      for(let bi=0;bi<3;bi++){ const ba=bi/3*Math.PI*2+tx, bx=cx+Math.cos(ba)*13, bz=cz+Math.sin(ba)*13, by=terrainHeight(bx,bz);
        const bowl=new THREE.Mesh(new THREE.CylinderGeometry(1.5,0.9,1.6,9), stoneMat); bowl.position.set(bx,by+0.8,bz); g.add(bowl);
        const flame=new THREE.Mesh(new THREE.ConeGeometry(0.85,2.6,7), new THREE.MeshStandardMaterial({color:0xffa657, emissive:0xff8830, emissiveIntensity:2.2, transparent:true, opacity:0.92}));
        flame.position.set(bx,by+2.8,bz); flame.visible=false; g.add(flame); addTaggedCollider(tag,{x:bx,z:bz,r:1.4});
        shrine.braziers.push({x:bx,z:bz,flame,lit:false}); }
      shrines.push(shrine); }
    scene.add(g);
    return {group:g, tag};
  }
  function update(px,pz){
    const ctx=Math.round(px/TILE), ctz=Math.round(pz/TILE); const want=new Set();
    for(let dx=-2;dx<=2;dx++) for(let dz=-2;dz<=2;dz++){ const tx=ctx+dx, tz=ctz+dz; const cx=tx*TILE, cz=tz*TILE;
      if(Math.abs(cx)+TILE/2<=WORLD_SIZE/2 && Math.abs(cz)+TILE/2<=WORLD_SIZE/2) continue; // fully inside the homeland — its own ground covers it (edge tiles overlap a step, no void ring)
      want.add(tx+","+tz); }
    for(const [k,t] of [...tiles]){ if(!want.has(k)){ scene.remove(t.group); removeTaggedColliders(t.tag);
      for(let i=shrines.length-1;i>=0;i--) if(shrines[i].tileKey===k) shrines.splice(i,1);
      tiles.delete(k); } }
    for(const k of want){ if(!tiles.has(k)){ const [tx,tz]=k.split(",").map(Number); tiles.set(k, buildTile(tx,tz)); } }
  }
  return { update, shrines };
}
