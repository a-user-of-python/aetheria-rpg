// World building: one giant map (2400 x 2400) created once, all at load.
// Detail is handled with THREE.LOD — near objects show smooth high-segment
// models, far ones swap to lighter versions, so the whole world can exist at
// once without melting the browser. Graphics use smooth-shaded, high-segment
// geometry (not chunky low-poly): spheres/cylinders with 24-48 segments.
import * as THREE from "three";
import { VILLAGES } from "./data.js";

export const WORLD_SIZE = 2400;
// Smooth rolling terrain with mountain ranges, flattened at villages & tower.
function hash(x,z){ const s=Math.sin(x*127.1+z*311.7)*43758.5453; return s-Math.floor(s); }
function noise(x,z){
  const xi=Math.floor(x), zi=Math.floor(z), xf=x-xi, zf=z-zi;
  const u=xf*xf*(3-2*xf), v=zf*zf*(3-2*zf);
  return hash(xi,zi)*(1-u)*(1-v)+hash(xi+1,zi)*u*(1-v)+hash(xi,zi+1)*(1-u)*v+hash(xi+1,zi+1)*u*v;
}
const FLAT = [...VILLAGES.map(v=>({x:v.x,z:v.z,r:90})), {x:880,z:-880,r:110}]; // + Dark Tower
export function terrainHeight(x,z){
  let h = noise(x*0.004+10, z*0.004+10)*26 + noise(x*0.015, z*0.015)*7 + noise(x*0.05,z*0.05)*1.6;
  // mountain ring / ranges
  const d = Math.sqrt(x*x+z*z);
  const mtn = Math.max(0, (d-750)/450); h += mtn*mtn*85*(0.6+noise(x*0.006,z*0.006)*0.7);
  const ridge = Math.max(0, Math.sin(x*0.002+1.3))*Math.max(0,(Math.abs(z+300)-350)/300); h += ridge*38;
  for(const f of FLAT){ const fd=Math.hypot(x-f.x,z-f.z); if(fd<f.r){ const t=Math.max(0,fd/f.r); h*= (t*t); } }
  return h;
}
export function buildWorld(scene){
  const group = new THREE.Group();
  // Terrain — one big smooth mesh, vertex-coloured by height
  const seg=220, geo=new THREE.PlaneGeometry(WORLD_SIZE,WORLD_SIZE,seg,seg);
  geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position, colors=[];
  const cGrass=new THREE.Color(0x69b96a), cDry=new THREE.Color(0xa8c686), cRock=new THREE.Color(0x8d9299), cSnow=new THREE.Color(0xf4f8ff), cSand=new THREE.Color(0xe4d8a0);
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i), z=pos.getZ(i), h=terrainHeight(x,z); pos.setY(i,h);
    let c = h>52? cSnow : h>30? cRock : h>14? cDry : cGrass;
    if(h<2.2) c=cSand;
    colors.push(c.r,c.g,c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors,3));
  geo.computeVertexNormals();
  const terrain=new THREE.Mesh(geo, new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.95, metalness:0}));
  terrain.receiveShadow=true; group.add(terrain);

  // Paths: light ribbons between villages (flattened strips following terrain)
  const pathMat=new THREE.MeshStandardMaterial({color:0xd9c9a3, roughness:1});
  const pathPts=[[0,60],[-520,-340],[640,-520],[-700,520],[560,640],[880,-880]];
  for(let i=0;i<pathPts.length-1;i++){
    const [x1,z1]=pathPts[i],[x2,z2]=pathPts[i+1]; const len=Math.hypot(x2-x1,z2-z1), steps=Math.ceil(len/24);
    for(let s2=0;s2<steps;s2++){
      const t=s2/steps, x=x1+(x2-x1)*t, z=z1+(z2-z1)*t;
      const p=new THREE.Mesh(new THREE.CircleGeometry(13,20), pathMat);
      p.rotation.x=-Math.PI/2; p.position.set(x, terrainHeight(x,z)+0.25, z); group.add(p);
    }
  }

  // Trees & rocks with LOD (high detail near, light far)
  const trunkMat=new THREE.MeshStandardMaterial({color:0x7a5230, roughness:0.9});
  const leafMat=new THREE.MeshStandardMaterial({color:0x3f9142, roughness:0.8});
  const rockMat=new THREE.MeshStandardMaterial({color:0x9096a0, roughness:0.95});
  function treeLOD(x,z,s){
    const lod=new THREE.LOD();
    const hi=new THREE.Group();
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.5*s,0.8*s,5*s,12), trunkMat); trunk.position.y=2.5*s; hi.add(trunk);
    for(let k=0;k<3;k++){ const c=new THREE.Mesh(new THREE.SphereGeometry((3.4-k*0.7)*s,24,18), leafMat); c.position.y=(6+k*1.8)*s; c.castShadow=true; hi.add(c); }
    const lo=new THREE.Group();
    const t2=new THREE.Mesh(new THREE.CylinderGeometry(0.6*s,0.6*s,5*s,6), trunkMat); t2.position.y=2.5*s; lo.add(t2);
    const c2=new THREE.Mesh(new THREE.SphereGeometry(3*s,8,6), leafMat); c2.position.y=6.5*s; lo.add(c2);
    lod.addLevel(hi,0); lod.addLevel(lo,180);
    lod.position.set(x,terrainHeight(x,z),z); return lod;
  }
  function rockLOD(x,z,s){
    const lod=new THREE.LOD();
    const hi=new THREE.Mesh(new THREE.SphereGeometry(s,24,18), rockMat); hi.scale.y=0.7; hi.castShadow=true;
    const lo=new THREE.Mesh(new THREE.SphereGeometry(s,8,6), rockMat); lo.scale.y=0.7;
    lod.addLevel(hi,0); lod.addLevel(lo,220);
    lod.position.set(x,terrainHeight(x,z)+s*0.2,z); return lod;
  }
  let seed=7; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
  for(let i=0;i<650;i++){
    const x=(rnd()*2-1)*1150, z=(rnd()*2-1)*1150;
    if(FLAT.some(f=>Math.hypot(x-f.x,z-f.z)<f.r+10)) continue;
    group.add(rnd()<0.72? treeLOD(x,z,0.8+rnd()*0.9) : rockLOD(x,z,1+rnd()*2.6));
  }

  // Villages: houses (smooth roofs), well, quest post, shop stall
  const villages=[];
  const wallMats=[0xf2e3c6,0xe8d8b0,0xdfe8f2,0xf6d9c0].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:0.85}));
  const roofMat=new THREE.MeshStandardMaterial({color:0xb5533c, roughness:0.8});
  for(const v of VILLAGES){
    const vg=new THREE.Group(); const y=terrainHeight(v.x,v.z);
    for(let i=0;i<6;i++){
      const a=i/6*Math.PI*2, hx=v.x+Math.cos(a)*34, hz=v.z+Math.sin(a)*34, hy=terrainHeight(hx,hz);
      const house=new THREE.Group();
      const base=new THREE.Mesh(new THREE.BoxGeometry(13,8,11), wallMats[i%4]); base.position.y=4; base.castShadow=true; house.add(base);
      const roof=new THREE.Mesh(new THREE.ConeGeometry(10.5,5.5,4,1), roofMat); roof.position.y=10.7; roof.rotation.y=Math.PI/4; roof.castShadow=true; house.add(roof);
      const door=new THREE.Mesh(new THREE.BoxGeometry(2.6,4.4,0.4), new THREE.MeshStandardMaterial({color:0x6b4a2a})); door.position.set(0,2.2,5.6); house.add(door);
      house.position.set(hx,hy,hz); house.lookAt(v.x,hy,v.z); vg.add(house);
    }
    const well=new THREE.Mesh(new THREE.CylinderGeometry(2.6,2.6,2.2,20), rockMat); well.position.set(v.x,y+1.1,v.z); vg.add(well);
    const post=new THREE.Mesh(new THREE.BoxGeometry(4.5,3.4,0.5), new THREE.MeshStandardMaterial({color:0xd9b878})); post.position.set(v.x+8,y+2.6,v.z+4); vg.add(post);
    const stall=new THREE.Mesh(new THREE.BoxGeometry(7,3.4,4.5), new THREE.MeshStandardMaterial({color:0x9a6a35})); stall.position.set(v.x-9,y+1.7,v.z+5); vg.add(stall);
    const canopy=new THREE.Mesh(new THREE.ConeGeometry(6,2.2,20), new THREE.MeshStandardMaterial({color:0x58a6ff})); canopy.position.set(v.x-9,y+4.6,v.z+5); vg.add(canopy);
    group.add(vg); villages.push({...v, y, group:vg});
  }

  // Caves: 6 rock arch entrances with a dark interior pocket + glow crystals
  const caves=[];
  const caveSpots=[[-260,240],[300,-180],[-880,-160],[180,820],[820,240],[-380,-760]];
  for(const [cx,cz] of caveSpots){
    const cg=new THREE.Group(); const cy=terrainHeight(cx,cz);
    for(let i=0;i<7;i++){ const a=(i/7)*Math.PI; const r=new THREE.Mesh(new THREE.SphereGeometry(4.5,20,14), rockMat);
      r.position.set(Math.cos(a)*9, Math.sin(a)*8, 0); r.castShadow=true; cg.add(r); }
    const glow=new THREE.Mesh(new THREE.SphereGeometry(1.1,16,12), new THREE.MeshStandardMaterial({color:0xaee9ff, emissive:0x66ccff, emissiveIntensity:1.6}));
    glow.position.set(0,2,-5); cg.add(glow);
    cg.position.set(cx,cy,cz); cg.lookAt(0,cy,0); group.add(cg);
    caves.push({x:cx,z:cz,y:cy});
  }

  // Dark Tower (far north-east) — Malachar's home
  const tower=new THREE.Group(); const tx=880,tz=-880, ty=terrainHeight(tx,tz);
  const tbase=new THREE.Mesh(new THREE.CylinderGeometry(15,19,85,28), new THREE.MeshStandardMaterial({color:0x4a4360, roughness:0.85}));
  tbase.position.y=42; tbase.castShadow=true; tower.add(tbase);
  const ttop=new THREE.Mesh(new THREE.ConeGeometry(19,26,28), new THREE.MeshStandardMaterial({color:0x6a4a8a, roughness:0.8}));
  ttop.position.y=97; tower.add(ttop);
  const orb=new THREE.Mesh(new THREE.SphereGeometry(4,24,18), new THREE.MeshStandardMaterial({color:0xc792ff, emissive:0x9955ff, emissiveIntensity:2}));
  orb.position.y=116; tower.add(orb);
  tower.position.set(tx,ty,tz); group.add(tower);

  scene.add(group);
  return { villages, caves, towerPos:{x:tx,z:tz,y:ty}, orb };
}
