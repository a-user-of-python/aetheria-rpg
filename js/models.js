// Unique models per item and per spell — v3.
// Weapons are BUILT, not stacked: sword blades are extruded silhouettes with a
// fuller groove, bows are tube geometry swept along a recurve curve with a
// string and nocked arrow, staves curve along a tube with claw-held orbs,
// wands are lathe-turned with a spiral wrap, hammers have bevelled extruded
// heads, lutes are extruded teardrops with strings. A hash of name+rarity
// varies lengths, widths, curves, gems — every item's model is its own.
import * as THREE from "three";
export function hashStr(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0); }
function rngFrom(seed){ let a=seed; return ()=>{ a=(a*1664525+1013904223)>>>0; return a/4294967296; }; }
const GEM_COLORS=[0xff5577,0x55ccff,0x77ff99,0xffcc44,0xbb88ff,0xff8844,0xffffff];
const METALS=[0xd8dee9,0xc9a86a,0x9fb4c8,0xe8e2d0,0xb08d6a];
function extrude(shape, depth, bevel=0.04){ const g=new THREE.ExtrudeGeometry(shape,{depth, bevelEnabled:true, bevelThickness:bevel, bevelSize:bevel, bevelSegments:2, steps:1}); g.translate(0,0,-depth/2); return g; }

export function makeItemModel(item){
  const seed=hashStr((item.name||"item")+(item.rarity||""));
  const rnd=rngFrom(seed);
  const g=new THREE.Group();
  const gemColor=GEM_COLORS[Math.floor(rnd()*GEM_COLORS.length)];
  const mainMat=new THREE.MeshStandardMaterial({color:item.color||0xcccccc, roughness:0.32, metalness:0.6});
  const steelMat=new THREE.MeshStandardMaterial({color:METALS[Math.floor(rnd()*METALS.length)], roughness:0.25, metalness:0.85});
  const woodMat=new THREE.MeshStandardMaterial({color:[0x6b4a2a,0x8b5a2b,0x54381e,0x7a4a35][Math.floor(rnd()*4)], roughness:0.85});
  const gemMat=new THREE.MeshStandardMaterial({color:gemColor, emissive:gemColor, emissiveIntensity:0.75, roughness:0.15});
  const gem=(r=0.3)=>{ const kinds=[new THREE.SphereGeometry(r,16,12), new THREE.OctahedronGeometry(r*1.25), new THREE.ConeGeometry(r*0.9,r*2.2,8)];
    return new THREE.Mesh(kinds[Math.floor(rnd()*3)], gemMat); };
  const shape=item.shape|| (item.kind==="armor"? "armor":"wand");

  if(shape==="blade"){
    const len=3.1+rnd()*1.5, wid=0.34+rnd()*0.22;
    // extruded sword silhouette: shoulders, taper, pointed tip
    const s=new THREE.Shape();
    s.moveTo(-wid,0); s.lineTo(wid,0); s.lineTo(wid*0.82,len*0.8); s.lineTo(0,len); s.lineTo(-wid*0.82,len*0.8); s.closePath();
    const blade=new THREE.Mesh(extrude(s,0.09+rnd()*0.05), steelMat); blade.position.y=0.95; blade.castShadow=true; g.add(blade);
    // fuller groove
    const fuller=new THREE.Mesh(new THREE.BoxGeometry(0.07,len*0.62,0.16), new THREE.MeshStandardMaterial({color:0x8a94a4, metalness:0.7, roughness:0.4}));
    fuller.position.y=0.95+len*0.36; g.add(fuller);
    // guard: swept curve (tube along an arc) or straight bar by seed
    if(rnd()<0.55){ const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.85,0.92,-0.1), new THREE.Vector3(0,0.78,0), new THREE.Vector3(0.85,0.92,-0.1));
      const gd=new THREE.Mesh(new THREE.TubeGeometry(curve,12,0.09,8), mainMat); g.add(gd); }
    else { const gd=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,1.7,10), mainMat); gd.rotation.z=Math.PI/2; gd.position.y=0.9; g.add(gd); }
    // wrapped grip: lathe with ridges
    const pts=[]; for(let i=0;i<=8;i++){ const y=i/8*0.85; pts.push(new THREE.Vector2(0.13+((i%2)?0.028:0), y)); }
    const grip=new THREE.Mesh(new THREE.LatheGeometry(pts,12), woodMat); grip.position.y=0.02; g.add(grip);
    const pom=gem(0.24); pom.position.y=-0.16; g.add(pom);
  } else if(shape==="bow"){
    const R=1.7+rnd()*0.5, recurve=0.35+rnd()*0.3;
    const pts=[]; for(let i=0;i<=16;i++){ const t=i/16, a=-Math.PI*0.62+t*Math.PI*1.24;
      const bend=Math.sin(t*Math.PI)*0.12 + Math.pow(Math.abs(t-0.5)*2,3)*recurve*0.4;
      pts.push(new THREE.Vector3(Math.cos(a)*(R+bend)*0.4 - 0.2, Math.sin(a)*R, 0)); }
    const curve=new THREE.CatmullRomCurve3(pts);
    const limb=new THREE.Mesh(new THREE.TubeGeometry(curve,24,0.085,8), woodMat); limb.castShadow=true; g.add(limb);
    const wrap=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.13,0.6,10), mainMat); wrap.position.set(-0.28,0,0); wrap.rotation.z=0.15; g.add(wrap);
    const top=curve.getPoint(1), bot=curve.getPoint(0);
    const strLen=top.distanceTo(bot);
    const str=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,strLen,4), new THREE.MeshStandardMaterial({color:0xf2f2f2}));
    str.position.copy(top).lerp(bot,0.5); str.lookAt(top); str.rotateX(Math.PI/2); g.add(str);
    // nocked arrow
    const arrow=new THREE.Group(); const shaft=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,1.9,6), woodMat); shaft.rotation.z=Math.PI/2; arrow.add(shaft);
    const head=new THREE.Mesh(new THREE.ConeGeometry(0.09,0.3,8), steelMat); head.rotation.z=-Math.PI/2; head.position.x=1.05; arrow.add(head);
    const fletch=new THREE.Mesh(new THREE.ConeGeometry(0.12,0.35,4), gemMat); fletch.rotation.z=Math.PI/2; fletch.position.x=-0.95; arrow.add(fletch);
    arrow.position.set(0.1,0,0.05); g.add(arrow);
    const tipG=gem(0.2); tipG.position.copy(top); g.add(tipG);
  } else if(shape==="staff"){
    const len=4.3+rnd()*1.0, bend=(rnd()-0.5)*0.7;
    const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,0,0), new THREE.Vector3(bend*0.4,len*0.55,0), new THREE.Vector3(bend,len,0));
    const shaft=new THREE.Mesh(new THREE.TubeGeometry(curve,14,0.13,9), woodMat); shaft.castShadow=true; g.add(shaft);
    const topP=curve.getPoint(1);
    const style=Math.floor(rnd()*3);
    if(style===0){ // claw prongs holding an orb
      for(let i=0;i<3;i++){ const a=i/3*Math.PI*2; const pr=new THREE.Mesh(new THREE.ConeGeometry(0.11,0.85,6), mainMat);
        pr.position.set(topP.x+Math.cos(a)*0.34, topP.y+0.3, topP.z+Math.sin(a)*0.34); pr.rotation.z=-Math.cos(a)*0.5; pr.rotation.x=Math.sin(a)*0.5; g.add(pr); }
      const orb=new THREE.Mesh(new THREE.SphereGeometry(0.46,20,16), gemMat); orb.position.set(topP.x,topP.y+0.42,topP.z); g.add(orb);
    } else if(style===1){ const ring=new THREE.Mesh(new THREE.TorusGeometry(0.52,0.1,10,24), mainMat); ring.position.copy(topP).y+=0.35; g.add(ring);
      const c=gem(0.3); c.position.copy(topP).y+=0.35; g.add(c);
    } else { const crys=new THREE.Mesh(new THREE.OctahedronGeometry(0.58), gemMat); crys.position.copy(topP).y+=0.5; crys.scale.y=1.7; g.add(crys); }
    for(const fy of [0.35,0.6]){ const band=new THREE.Mesh(new THREE.TorusGeometry(0.16,0.045,8,14), steelMat); const p=curve.getPoint(fy); band.position.copy(p); band.rotation.x=Math.PI/2; g.add(band); }
  } else if(shape==="hammer"){
    const pts=[]; for(let i=0;i<=6;i++){ pts.push(new THREE.Vector2(0.12+Math.sin(i/6*Math.PI)*0.03, i/6*2.9)); }
    const shaft=new THREE.Mesh(new THREE.LatheGeometry(pts,12), woodMat); g.add(shaft);
    const hs=new THREE.Shape(); const hw=0.75+rnd()*0.3;
    hs.moveTo(-hw,0); hs.lineTo(hw,0); hs.lineTo(hw*0.85,0.85); hs.lineTo(-hw*0.85,0.85); hs.closePath();
    const head=new THREE.Mesh(extrude(hs,0.8,0.09), mainMat); head.rotation.y=Math.PI/2; head.position.y=2.75; head.castShadow=true; g.add(head);
    for(const bz of [-0.42,0.42]){ const band=new THREE.Mesh(new THREE.BoxGeometry(0.92,0.95,0.1), steelMat); band.position.set(0,3.17,bz); g.add(band); }
    const spike=gem(0.22); spike.position.y=3.85; g.add(spike);
    const pom=gem(0.2); pom.position.y=-0.14; g.add(pom);
  } else if(shape==="lute"){
    const s=new THREE.Shape(); // teardrop silhouette
    s.moveTo(0,-1.15); s.bezierCurveTo(0.95,-0.8, 0.9,0.45, 0.42,0.95); s.bezierCurveTo(0.18,1.25,-0.18,1.25,-0.42,0.95); s.bezierCurveTo(-0.9,0.45,-0.95,-0.8, 0,-1.15);
    const body=new THREE.Mesh(extrude(s,0.42,0.1), mainMat); body.position.y=1.15; body.castShadow=true; g.add(body);
    const hole=new THREE.Mesh(new THREE.CircleGeometry(0.3,18), new THREE.MeshStandardMaterial({color:0x241408})); hole.position.set(0,0.95,0.28); g.add(hole);
    const neck=new THREE.Mesh(new THREE.BoxGeometry(0.3,1.9,0.2), woodMat); neck.position.y=3.2; g.add(neck);
    for(let i=0;i<4;i++){ const fret=new THREE.Mesh(new THREE.BoxGeometry(0.32,0.035,0.22), steelMat); fret.position.y=2.55+i*0.42; g.add(fret); }
    for(let i=0;i<3;i++){ const str=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,3.1,3), new THREE.MeshStandardMaterial({color:0xf8f4e0})); str.position.set((i-1)*0.09,2.15,0.3); g.add(str); }
    for(let i=0;i<3;i++){ const peg=gem(0.09); peg.position.set((i-1)*0.22,4.2,0); g.add(peg); }
  } else if(shape==="armor"){
    const slot=item.slot||"Body";
    if(slot==="Head"){ const dome=new THREE.Mesh(new THREE.SphereGeometry(0.95,22,16,0,Math.PI*2,0,Math.PI*0.62), mainMat); dome.position.y=1.4; g.add(dome);
      const brim=new THREE.Mesh(new THREE.TorusGeometry(0.95,0.11,8,22), gemMat); brim.rotation.x=Math.PI/2; brim.position.y=1.4; g.add(brim);
      const plume=gem(0.26); plume.position.y=2.4; g.add(plume); }
    else if(slot==="Feet"){ for(const dx of [-0.5,0.5]){ const boot=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.9,0.9), mainMat); boot.position.set(dx,0.45,0); g.add(boot);
      const toe=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.4,0.6), mainMat); toe.position.set(dx,0.2,0.65); g.add(toe); } }
    else if(slot==="Hands"){ for(const dx of [-0.55,0.55]){ const gl=new THREE.Mesh(new THREE.SphereGeometry(0.42,14,12), mainMat); gl.position.set(dx,0.8,0); gl.scale.y=1.25; g.add(gl); } }
    else { const chest=new THREE.Mesh(new THREE.CapsuleGeometry(0.95,1.1,6,16), mainMat); chest.position.y=1.5; chest.castShadow=true; g.add(chest);
      const trim=new THREE.Mesh(new THREE.TorusGeometry(0.8,0.09,8,20), gemMat); trim.rotation.x=Math.PI/2; trim.position.y=2.15; g.add(trim);
      const badge=gem(0.26); badge.position.set(0,1.6,0.95); g.add(badge); }
    const stand=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,0.7,8), woodMat); stand.position.y=-0.35; g.add(stand);
  } else { // wand — lathe-turned shaft + spiral wrap + styled tip
    const len=2.6+rnd()*1.1;
    const pts=[]; for(let i=0;i<=7;i++){ const t=i/7; pts.push(new THREE.Vector2(0.15-0.06*t+Math.sin(t*Math.PI)*0.02, t*len)); }
    const shaft=new THREE.Mesh(new THREE.LatheGeometry(pts,12), woodMat); shaft.castShadow=true; g.add(shaft);
    // spiral wrap: tube along a helix
    const helixPts=[]; for(let i=0;i<=40;i++){ const t=i/40, a=t*Math.PI*7; helixPts.push(new THREE.Vector3(Math.cos(a)*0.15, t*len*0.7+0.15, Math.sin(a)*0.15)); }
    const wrap=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helixPts),60,0.028,6), gemMat); g.add(wrap);
    const style=Math.floor(rnd()*4);
    if(style===0){ const star=new THREE.Mesh(new THREE.OctahedronGeometry(0.5), gemMat); star.position.y=len+0.42; star.scale.y=1.5; g.add(star); }
    else if(style===1){ const orb=new THREE.Mesh(new THREE.SphereGeometry(0.42,18,14), gemMat); orb.position.y=len+0.36; g.add(orb); }
    else if(style===2){ const cr=new THREE.Mesh(new THREE.ConeGeometry(0.3,1.05,7), gemMat); cr.position.y=len+0.5; g.add(cr); }
    else { const moon=new THREE.Mesh(new THREE.TorusGeometry(0.42,0.12,8,20,Math.PI*1.4), gemMat); moon.position.y=len+0.36; moon.rotation.z=1.2; g.add(moon); }
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
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({color:fx.color, transparent:true, opacity:0.5, depthWrite:false}));
  glow.scale.set(4.2,4.2,1); g.add(glow);
  return g;
}
