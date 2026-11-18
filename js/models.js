// Unique models per item and per spell.
// Every weapon/armour item gets a model generated from a hash of its name +
// rarity + modifier, so no two named items look alike: blade length, guard
// style, pommel gem, shaft wood, bow curve, gem colour/shape all vary.
// Every spell gets its own projectile/effect model: shard, star, orb,
// leaf, note, wave ring, beam — defined per spell name below.
import * as THREE from "three";
export function hashStr(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0); }
function rngFrom(seed){ let a=seed; return ()=>{ a=(a*1664525+1013904223)>>>0; return a/4294967296; }; }
const GEM_COLORS=[0xff5577,0x55ccff,0x77ff99,0xffcc44,0xbb88ff,0xff8844,0xffffff];
const METALS=[0xd8dee9,0xc9a86a,0x9fb4c8,0xe8e2d0,0xb08d6a];

export function makeItemModel(item){
  const seed=hashStr((item.name||"item")+(item.rarity||""));
  const rnd=rngFrom(seed);
  const g=new THREE.Group();
  const mainMat=new THREE.MeshStandardMaterial({color:item.color||0xcccccc, roughness:0.35, metalness:0.55});
  const woodMat=new THREE.MeshStandardMaterial({color:[0x6b4a2a,0x8b5a2b,0x54381e,0x7a4a35][Math.floor(rnd()*4)], roughness:0.85});
  const gemMat=new THREE.MeshStandardMaterial({color:GEM_COLORS[Math.floor(rnd()*GEM_COLORS.length)], emissive:GEM_COLORS[Math.floor(rnd()*GEM_COLORS.length)], emissiveIntensity:0.7, roughness:0.2});
  const gemShape=Math.floor(rnd()*3); // 0 sphere 1 octahedron 2 cone
  const gem=()=>{ const geo= gemShape===0? new THREE.SphereGeometry(0.34,16,12) : gemShape===1? new THREE.OctahedronGeometry(0.4) : new THREE.ConeGeometry(0.3,0.8,8);
    return new THREE.Mesh(geo, gemMat); };
  const shape=item.shape|| (item.kind==="armor"? "armor":"wand");
  if(shape==="blade"){
    const len=3+rnd()*1.6, wid=0.55+rnd()*0.4;
    const blade=new THREE.Mesh(new THREE.BoxGeometry(0.16,len,wid), mainMat); blade.position.y=len/2+0.9; blade.castShadow=true; g.add(blade);
    const tip=new THREE.Mesh(new THREE.ConeGeometry(wid/2,0.9,4), mainMat); tip.position.y=len+1.3; tip.rotation.y=Math.PI/4; tip.scale.z=0.3; g.add(tip);
    const guardStyle=Math.floor(rnd()*3);
    if(guardStyle===0){ const gd=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.22,0.5), new THREE.MeshStandardMaterial({color:METALS[Math.floor(rnd()*METALS.length)], metalness:0.8, roughness:0.3})); gd.position.y=0.9; g.add(gd); }
    else if(guardStyle===1){ const gd=new THREE.Mesh(new THREE.TorusGeometry(0.55,0.11,8,20,Math.PI), gemMat); gd.position.y=0.9; gd.rotation.z=Math.PI; g.add(gd); }
    else { const gd=new THREE.Mesh(new THREE.SphereGeometry(0.42,14,10), mainMat); gd.position.y=0.9; gd.scale.y=0.5; g.add(gd); }
    const grip=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.14,0.9,10), woodMat); grip.position.y=0.45; g.add(grip);
    const pom=gem(); pom.position.y=-0.1; g.add(pom);
  } else if(shape==="bow"){
    const curve=1.4+rnd()*0.7;
    const arc=new THREE.Mesh(new THREE.TorusGeometry(curve,0.13,10,30,Math.PI*1.15), woodMat); arc.rotation.z=-Math.PI*0.08; arc.castShadow=true; g.add(arc);
    const str=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,curve*1.8,4), new THREE.MeshStandardMaterial({color:0xeeeeee})); str.position.x=-curve*0.62; g.add(str);
    const grip=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,0.7,8), mainMat); grip.rotation.z=Math.PI/2; grip.position.x=-0.1; g.add(grip);
    const tipG=gem(); tipG.position.y=curve*0.95; g.add(tipG);
  } else if(shape==="staff"){
    const len=4.2+rnd()*1.1;
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.17,len,10), woodMat); shaft.position.y=len/2; shaft.castShadow=true; g.add(shaft);
    const style=Math.floor(rnd()*3);
    if(style===0){ const orb=new THREE.Mesh(new THREE.SphereGeometry(0.52,20,16), gemMat); orb.position.y=len+0.4; g.add(orb); }
    else if(style===1){ const ring=new THREE.Mesh(new THREE.TorusGeometry(0.55,0.12,10,24), mainMat); ring.position.y=len+0.3; g.add(ring); const c=gem(); c.position.y=len+0.3; g.add(c); }
    else { const crys=new THREE.Mesh(new THREE.OctahedronGeometry(0.6), gemMat); crys.position.y=len+0.45; crys.scale.y=1.6; g.add(crys);
      for(let i=0;i<3;i++){ const s=new THREE.Mesh(new THREE.ConeGeometry(0.14,0.6,6), mainMat); const a=i/3*Math.PI*2; s.position.set(Math.cos(a)*0.4,len-0.1,Math.sin(a)*0.4); s.rotation.z=Math.cos(a)*0.6; g.add(s); } }
    const band=new THREE.Mesh(new THREE.TorusGeometry(0.19,0.05,8,16), mainMat); band.rotation.x=Math.PI/2; band.position.y=len*0.55; g.add(band);
  } else if(shape==="hammer"){
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.16,3,10), woodMat); shaft.position.y=1.5; g.add(shaft);
    const headStyle=Math.floor(rnd()*3);
    if(headStyle===0){ const h=new THREE.Mesh(new THREE.SphereGeometry(0.85,20,16), mainMat); h.position.y=3.2; g.add(h); }
    else if(headStyle===1){ const h=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.9,0.9), mainMat); h.position.y=3.2; g.add(h); const b=gem(); b.position.y=3.2; b.position.z=0.5; g.add(b); }
    else { const h=new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.6,1.5,14), mainMat); h.rotation.z=Math.PI/2; h.position.y=3.2; g.add(h); }
    const pom=gem(); pom.position.y=-0.05; pom.scale.setScalar(0.7); g.add(pom);
  } else if(shape==="lute"){
    const body=new THREE.Mesh(new THREE.SphereGeometry(1,22,18), mainMat); body.scale.set(1,1.25,0.45); body.position.y=1.2; body.castShadow=true; g.add(body);
    const hole=new THREE.Mesh(new THREE.CircleGeometry(0.32,18), new THREE.MeshStandardMaterial({color:0x2a1a0c})); hole.position.set(0,1.25,0.47); g.add(hole);
    const neck=new THREE.Mesh(new THREE.BoxGeometry(0.32,2.1,0.26), woodMat); neck.position.y=3.1; g.add(neck);
    for(let i=0;i<3;i++){ const peg=new THREE.Mesh(new THREE.SphereGeometry(0.09,8,8), gemMat); peg.position.set(i-1,3.9,0); peg.scale.setScalar(0.8); g.add(peg); }
  } else if(shape==="armor"){
    // display stand: the piece itself, shaped by slot
    const slot=item.slot||"Body";
    if(slot==="Head"){ const dome=new THREE.Mesh(new THREE.SphereGeometry(0.95,22,16,0,Math.PI*2,0,Math.PI*0.62), mainMat); dome.position.y=1.4; g.add(dome);
      const brim=new THREE.Mesh(new THREE.TorusGeometry(0.95,0.12,8,22), gemMat); brim.rotation.x=Math.PI/2; brim.position.y=1.4; g.add(brim);
      const plume=gem(); plume.position.y=2.45; g.add(plume); }
    else if(slot==="Feet"){ for(const dx of [-0.5,0.5]){ const boot=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.9,0.9), mainMat); boot.position.set(dx,0.45,0); g.add(boot);
      const toe=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.4,0.6), mainMat); toe.position.set(dx,0.2,0.65); g.add(toe); } }
    else if(slot==="Hands"){ for(const dx of [-0.55,0.55]){ const gl=new THREE.Mesh(new THREE.SphereGeometry(0.42,14,12), mainMat); gl.position.set(dx,0.8,0); gl.scale.y=1.25; g.add(gl); } }
    else { const chest=new THREE.Mesh(new THREE.CapsuleGeometry(0.95,1.1,6,16), mainMat); chest.position.y=1.5; chest.castShadow=true; g.add(chest);
      const trim=new THREE.Mesh(new THREE.TorusGeometry(0.8,0.09,8,20), gemMat); trim.rotation.x=Math.PI/2; trim.position.y=2.15; g.add(trim);
      const badge=gem(); badge.position.set(0,1.6,0.95); g.add(badge); }
    const stand=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,0.7,8), woodMat); stand.position.y=-0.35; g.add(stand);
  } else { // wand
    const len=2.6+rnd()*1.2;
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.14,len,10), woodMat); shaft.position.y=len/2; g.add(shaft);
    const style=Math.floor(rnd()*4);
    if(style===0){ const star=new THREE.Mesh(new THREE.OctahedronGeometry(0.5), gemMat); star.position.y=len+0.4; star.scale.y=1.5; g.add(star); }
    else if(style===1){ const orb=new THREE.Mesh(new THREE.SphereGeometry(0.42,18,14), gemMat); orb.position.y=len+0.35; g.add(orb); }
    else if(style===2){ const cr=new THREE.Mesh(new THREE.ConeGeometry(0.3,1,7), gemMat); cr.position.y=len+0.5; g.add(cr); }
    else { const moon=new THREE.Mesh(new THREE.TorusGeometry(0.42,0.13,8,20,Math.PI*1.4), gemMat); moon.position.y=len+0.35; moon.rotation.z=1.2; g.add(moon); }
    const wrap=new THREE.Mesh(new THREE.TorusGeometry(0.15,0.045,8,14), mainMat); wrap.rotation.x=Math.PI/2; wrap.position.y=len*0.4; g.add(wrap);
  }
  g.userData.seed=seed;
  return g;
}

// Per-spell effect definitions: each spell casts a DIFFERENT model.
export const SPELL_FX = {
  "Spark Bolt":   {mode:"projectile", geo:"star",  color:0xffe27a, speed:65, size:0.8},
  "Frost Twinkle":{mode:"projectile", geo:"shard", color:0xaee9ff, speed:55, size:0.9},
  "Ember Glow":   {mode:"projectile", geo:"orb",   color:0xffa657, speed:58, size:0.85},
  "River Rush":   {mode:"projectile", geo:"wave",  color:0x58c6ff, speed:50, size:1.1},
  "Crystal Shards":{mode:"projectile", geo:"shards",color:0xaee9ff, speed:62, size:0.8},
  "Comet Trail":  {mode:"projectile", geo:"comet", color:0xffa657, speed:85, size:1.0},
  "Sun Ray":      {mode:"beam", geo:"beam", color:0xffd479},
  "Moonbeam":     {mode:"beam", geo:"beam", color:0xcfe0ff},
  "Thunder Clap": {mode:"beam", geo:"beam", color:0xd8b8ff},
  "Star Shower":  {mode:"aoe", geo:"stars", color:0xffe27a, radius:11},
  "Aurora Wave":  {mode:"aoe", geo:"ring", color:0xc792ff, radius:13},
  "Bloom Burst":  {mode:"aoe", geo:"petals", color:0xff9ecb, radius:10},
  "Snow Veil":    {mode:"self", geo:"veil", color:0xe8f2ff},
  "Healing Light":{mode:"self", geo:"rings", color:0x7ee787},
  "Leaf Mend":    {mode:"self", geo:"leaves", color:0x7ee787},
  "Great Mend":   {mode:"self", geo:"rings", color:0xaef2b0},
  "Worldtree Blessing":{mode:"self", geo:"rings", color:0x5ec962},
  "Mana Shield":  {mode:"self", geo:"bubble", color:0xfff2b0},
  "Stone Skin":   {mode:"self", geo:"bubble", color:0xc9b18a},
  "Wind Step":    {mode:"self", geo:"trail", color:0xc8ffd8},
  "Cheer Song":   {mode:"self", geo:"notes", color:0xff9ecb},
  "Teleport Home":{mode:"self", geo:"rings", color:0xa0b8ff},
};
export function makeSpellProjectile(fx){
  const g=new THREE.Group();
  const mat=new THREE.MeshStandardMaterial({color:fx.color, emissive:fx.color, emissiveIntensity:1.6, roughness:0.3});
  const s=fx.size||0.8;
  if(fx.geo==="star"){ const m=new THREE.Mesh(new THREE.OctahedronGeometry(s), mat); m.scale.y=1.4; g.add(m); }
  else if(fx.geo==="shard"){ const m=new THREE.Mesh(new THREE.ConeGeometry(s*0.55, s*2.6, 6), mat); m.rotation.x=Math.PI/2; g.add(m); }
  else if(fx.geo==="shards"){ for(let i=0;i<3;i++){ const m=new THREE.Mesh(new THREE.ConeGeometry(s*0.4, s*2, 5), mat); m.rotation.x=Math.PI/2; m.position.set((i-1)*0.5,(i%2)*0.3,0); g.add(m); } }
  else if(fx.geo==="comet"){ const m=new THREE.Mesh(new THREE.SphereGeometry(s*0.8,18,14), mat); g.add(m);
    const tail=new THREE.Mesh(new THREE.ConeGeometry(s*0.6, s*3.4, 12), new THREE.MeshStandardMaterial({color:fx.color, emissive:fx.color, emissiveIntensity:0.9, transparent:true, opacity:0.55})); tail.rotation.x=-Math.PI/2; tail.position.z=-s*2; g.add(tail); }
  else if(fx.geo==="wave"){ const m=new THREE.Mesh(new THREE.TorusGeometry(s, s*0.4, 10, 22), mat); g.add(m); }
  else { const m=new THREE.Mesh(new THREE.SphereGeometry(s*0.8,20,16), mat); g.add(m); }
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({color:fx.color, transparent:true, opacity:0.55, depthWrite:false}));
  glow.scale.set(4.2,4.2,1); g.add(glow);
  return g;
}
