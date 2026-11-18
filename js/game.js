// AETHERIA v2 — main game. Three.js (universal WebGL).
// v2: textured world, full articulated characters with walk animation,
// unique model per item, unique visual per spell, collision, real sprint.
import * as THREE from "three";
import { CLASSES, WEAPONS, ARMOR, SPELLS, SPELL_BY_NAME, ENEMIES, VILLAGES, MAIN_QUESTS, NPC_NAMES, NPC_LINES,
  RARITIES, MODIFIERS, rollRarity, proceduralWeapon, proceduralArmor, makeSideQuest } from "./data.js";
import { buildWorld, terrainHeight, collide, addTaggedCollider, removeTaggedColliders, WORLD_SIZE } from "./world.js";
import { Room } from "./multiplayer.js";
import { makeItemModel, SPELL_FX, makeSpellProjectile } from "./models.js";

const $=id=>document.getElementById(id);
const rand=(a,b)=>a+Math.random()*(b-a);

// ---------- Character creation ----------
let selClass=CLASSES[0], selSkin=0xffd9b3, selHair=0x6b4a2a, selHairStyle=0, selOutfit=0x7a9cc6;
const SKINS=[0xffe0bd,0xffd9b3,0xf1c27d,0xe0ac69,0xc68642,0x8d5524,0x6e4423,0x4e2e1a];
const HAIRS=[0x6b4a2a,0x2b2b2b,0xd9a441,0xb5533c,0xe8e8e8,0x58a6ff,0xff7bcd,0x3f9142];
const OUTFITS=[0x7a9cc6,0xbf5a4a,0x4fbf73,0x8a7aff,0xffa657,0x58c6d9,0xf2f2f2,0x303a5e];
function swatches(el, colors, cb){ el.innerHTML=""; colors.forEach(c=>{ const b=document.createElement("button"); b.className="sw"; b.style.background="#"+c.toString(16).padStart(6,"0"); b.onclick=()=>{ [...el.children].forEach(x=>x.classList.remove("on")); b.classList.add("on"); cb(c); }; el.appendChild(b); }); el.children[0].classList.add("on"); }
swatches($("skinSw"), SKINS, c=>selSkin=c);
swatches($("hairSw"), HAIRS, c=>selHair=c);
swatches($("outfitSw"), OUTFITS, c=>selOutfit=c);
$("hairStyle").onchange=e=>selHairStyle=+e.target.value;
const classGrid=$("classGrid");
CLASSES.forEach(c=>{ const d=document.createElement("div"); d.className="classCard"+(c===selClass?" on":"");
  d.innerHTML=`<div class="ci">${c.icon}</div><b>${c.name}</b><p>${c.desc}</p><small>HP ${c.hp} · Mana ${c.mana} · Starts: ${c.weapon}</small>`;
  d.onclick=()=>{ selClass=c; [...classGrid.children].forEach(x=>x.classList.remove("on")); d.classList.add("on"); }; classGrid.appendChild(d); });

// ---------- Player state ----------
const P = { name:"Traveller", cls:null, level:1, xp:0, xpNext:100, hp:100, hpMax:100, mana:50, manaMax:50,
  gold:25, baseDmg:10, speed:1, weapon:null, armorItem:null, inventory:[], spells:[],
  mainIdx:0, mainProgress:{}, side:[], talkedVillages:new Set(), chestsOpened:0, pos:new THREE.Vector3(0,0,90) };
function xpForLevel(l){ return Math.round(100*Math.pow(l,1.55)); }

// ---------- Three setup / shared ----------
let scene, camera, renderer, clock, playerMesh, playerRig, world, started=false;
let yaw=0, pitch=0.35, camDist=11, keys={}, enemies=[], npcs=[], camps=[], chests=[], particles=[], projectiles=[], fxList=[];
let boss=null, shieldUp=false, shieldMesh=null, speedBuffUntil=0, dmgBuffUntil=0, armorBuffUntil=0, campDensity=1;
let atkCd=0, atkAnimUntil=0, walkPhase=0, isMoving=false, sprintTouch=false;
const remotes=new Map(); let room=null;

function labelSprite(text, color="#fff"){
  const cv=document.createElement("canvas"); cv.width=512; cv.height=96; const g=cv.getContext("2d");
  g.font="bold 44px system-ui"; g.textAlign="center"; g.shadowColor="#000"; g.shadowBlur=8; g.fillStyle=color; g.fillText(text,256,58);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv), transparent:true, depthTest:false}));
  sp.scale.set(11,2.1,1); return sp;
}
// ---- Full articulated humanoid: legs, arms, torso, head with eyes, hair ----
function makeHumanoid(skin, hairColor, hairStyle, outfit){
  const grp=new THREE.Group();
  const outfitMat=new THREE.MeshStandardMaterial({color:outfit, roughness:0.85});
  const skinMat=new THREE.MeshStandardMaterial({color:skin, roughness:0.65});
  const darkMat=new THREE.MeshStandardMaterial({color:0x3a2c1c, roughness:0.8});
  function limb(mat, r, len){ const pivot=new THREE.Group(); const m=new THREE.Mesh(new THREE.CapsuleGeometry(r,len,6,14), mat); m.position.y=-(len/2+r*0.6); m.castShadow=true; pivot.add(m); return pivot; }
  // legs (pivot at hip y=3.0)
  const legL=limb(darkMat,0.36,1.7); legL.position.set(-0.55,3.0,0); grp.add(legL);
  const legR=limb(darkMat,0.36,1.7); legR.position.set(0.55,3.0,0); grp.add(legR);
  for(const leg of [legL,legR]){ const boot=new THREE.Mesh(new THREE.BoxGeometry(0.62,0.42,1.05), new THREE.MeshStandardMaterial({color:0x4a3220, roughness:0.9})); boot.position.set(0,-2.55,0.18); leg.add(boot); }
  // torso
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(1.02,1.5,8,18), outfitMat); torso.position.y=4.35; torso.castShadow=true; grp.add(torso);
  const belt=new THREE.Mesh(new THREE.TorusGeometry(0.98,0.14,8,18), darkMat); belt.rotation.x=Math.PI/2; belt.position.y=3.55; grp.add(belt);
  const buckle=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.3,0.15), new THREE.MeshStandardMaterial({color:0xffd479, metalness:0.7, roughness:0.3})); buckle.position.set(0,3.55,1.0); grp.add(buckle);
  // arms (pivot at shoulder y=5.25)
  const armL=limb(outfitMat,0.32,1.5); armL.position.set(-1.35,5.25,0); grp.add(armL);
  const armR=limb(outfitMat,0.32,1.5); armR.position.set(1.35,5.25,0); grp.add(armR);
  for(const arm of [armL,armR]){ const hand=new THREE.Mesh(new THREE.SphereGeometry(0.3,12,10), skinMat); hand.position.y=-2.15; arm.add(hand); }
  armR.rotation.x=-0.35; // weapon arm slightly raised
  // head + face
  const head=new THREE.Mesh(new THREE.SphereGeometry(1.02,26,20), skinMat); head.position.y=6.65; head.castShadow=true; grp.add(head);
  for(const ex of [-0.36,0.36]){ const eye=new THREE.Mesh(new THREE.SphereGeometry(0.11,10,8), new THREE.MeshStandardMaterial({color:0x1c1c22})); eye.position.set(ex,6.8,0.92); grp.add(eye); }
  const nose=new THREE.Mesh(new THREE.SphereGeometry(0.13,10,8), skinMat); nose.position.set(0,6.5,1.0); grp.add(nose);
  let hair;
  if(hairStyle===1){ hair=new THREE.Mesh(new THREE.ConeGeometry(1.2,2.4,18), new THREE.MeshStandardMaterial({color:hairColor, roughness:0.9})); hair.position.y=7.9; }
  else if(hairStyle===2){ hair=new THREE.Mesh(new THREE.SphereGeometry(1.1,22,16,0,Math.PI*2,0,Math.PI*1.35), new THREE.MeshStandardMaterial({color:hairColor, roughness:0.9})); hair.position.y=6.8; hair.scale.set(1,1.45,1); }
  else { hair=new THREE.Mesh(new THREE.SphereGeometry(1.08,22,16,0,Math.PI*2,0,Math.PI*0.55), new THREE.MeshStandardMaterial({color:hairColor, roughness:0.9})); hair.position.y=6.8; }
  hair.castShadow=true; grp.add(hair);
  const rig={grp, legL, legR, armL, armR, hair, phase:Math.random()*6, weaponMount:new THREE.Group()};
  rig.weaponMount.position.set(0,-2.3,0.25); armR.add(rig.weaponMount);
  grp.userData.rig=rig; return rig;
}
function attachWeapon(rig, item){
  while(rig.weaponMount.children.length) rig.weaponMount.remove(rig.weaponMount.children[0]);
  if(!item) return;
  const m=makeItemModel(item); m.scale.setScalar(0.85); m.rotation.x=0.5; rig.weaponMount.add(m);
}
function animateRig(rig, speedNorm, dt, running=false){
  rig.phase += dt*(4+speedNorm*9);
  const sw=Math.sin(rig.phase)*(running?0.95:0.62)*Math.min(1,speedNorm+0.15);
  if(speedNorm>0.03){ rig.legL.rotation.x=sw; rig.legR.rotation.x=-sw; rig.armL.rotation.x=-sw*0.8; if(Date.now()>atkAnimUntil||rig!==playerRig) rig.armR.rotation.x=sw*0.7-0.35; }
  else { rig.legL.rotation.x*=0.8; rig.legR.rotation.x*=0.8; rig.armL.rotation.x*=0.8; if(rig!==playerRig||Date.now()>atkAnimUntil) rig.armR.rotation.x=-0.35+Math.sin(performance.now()*0.0015)*0.05; }
  if(rig===playerRig && Date.now()<atkAnimUntil){ rig.armR.rotation.x=-2.1+ (atkAnimUntil-Date.now())/220*1.4; }
}

// ---------- Loot ----------
let uid=1;
function giveItem(base, rarity, source){
  rarity = rarity || rollRarity();
  const item={...base, uid:uid++, rarity, level:P.level};
  if(base.kind==="weapon") item.power=Math.round(base.power*(RARITIES[rarity]?.mult||1));
  if(base.kind==="armor") item.armor=Math.round((base.armor||2)*(RARITIES[rarity]?.mult||1));
  if(Math.random()<0.35 && rarity!=="Common"){ const mod=MODIFIERS[Math.floor(Math.random()*MODIFIERS.length)]; item.modifier=mod; item.name=mod.name+" "+item.name; if(mod.dmg&&item.power) item.power=Math.round(item.power*mod.dmg); if(mod.armor) item.armor=(item.armor||0)+mod.armor; }
  if(source==="shopExclusive") item.rarity="Shop";
  P.inventory.push(item); toast(`Found: ${item.name} [${item.rarity}]`); renderInventory(); return item;
}
function randomLoot(fromShop){
  const pool=Math.random()<0.62? WEAPONS : ARMOR;
  const base=pool[Math.floor(Math.random()*pool.length)];
  const b = base.kind==="weapon" && Math.random()<0.4? proceduralWeapon(P.level) : base.kind==="armor" && Math.random()<0.3? proceduralArmor(P.level) : base;
  return giveItem(b, null, fromShop?"shopExclusive":null);
}

// ---------- Item preview (shop + inventory): real rotating 3D model + attributes ----------
const preview={};
function initPreview(){
  preview.renderer=new THREE.WebGLRenderer({antialias:true, alpha:true});
  preview.renderer.setSize(230,230); preview.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  preview.scene=new THREE.Scene();
  preview.camera=new THREE.PerspectiveCamera(40,1,0.1,100); preview.camera.position.set(3.4,3.2,6.4); preview.camera.lookAt(0,1.8,0);
  preview.scene.add(new THREE.HemisphereLight(0xffffff,0x445566,1.2));
  const dl=new THREE.DirectionalLight(0xfff2cc,1.6); dl.position.set(4,7,5); preview.scene.add(dl);
  preview.holder=new THREE.Group(); preview.scene.add(preview.holder);
  preview.canvas=preview.renderer.domElement; preview.canvas.style.display="block"; preview.canvas.style.margin="0 auto";
}
function itemAttrHTML(it, price){
  return `<b style="color:${RARITIES[it.rarity]?.color||'#fff'}">${it.name}</b> <small>[${it.rarity}]</small><br>`+
    `${it.kind==="weapon"? `Type: ${it.type} · <b>Power ${it.power}</b>` : `Slot: ${it.slot} · <b>Armour ${it.armor}</b>`}`+
    `${it.modifier? `<br>Modifier: <b>${it.modifier.name}</b> — ${it.modifier.desc}`:""}`+
    `<br><small>${it.desc||""}</small>${price? `<br><b>Price: 🪙 ${price}</b>`:""}`;
}
function showPreview(container, it, price){
  if(!preview.renderer) initPreview();
  container.innerHTML=""; container.appendChild(preview.canvas);
  const info=document.createElement("div"); info.innerHTML=itemAttrHTML(it, price); info.style.textAlign="center"; container.appendChild(info);
  while(preview.holder.children.length) preview.holder.remove(preview.holder.children[0]);
  const m=makeItemModel(it); // centre it
  const box=new THREE.Box3().setFromObject(m); const c=box.getCenter(new THREE.Vector3()); m.position.sub(c); m.position.y+=1.8;
  preview.holder.add(m); preview.active=true;
}
function previewTick(dt){ if(preview.active && preview.renderer){ preview.holder.rotation.y+=dt*1.4; preview.renderer.render(preview.scene, preview.camera); } }

// ---------- World population ----------
function spawnNPCs(){
  world.villages.forEach((v,vi)=>{
    for(let i=0;i<3;i++){
      const name=NPC_NAMES[(vi*3+i)%NPC_NAMES.length];
      const rig=makeHumanoid(SKINS[(vi+i)%SKINS.length], HAIRS[(i*2+vi)%HAIRS.length], i%3, OUTFITS[(vi*2+i)%OUTFITS.length]);
      attachWeapon(rig, {name:"Villager "+name+" Wand", shape:"wand", color:0xffe27a, kind:"weapon"});
      rig.grp.position.set(v.x+rand(-20,20), v.y, v.z+rand(-20,20));
      const lab=labelSprite(name,"#ffe9a8"); lab.position.y=9.4; rig.grp.add(lab); scene.add(rig.grp);
      npcs.push({mesh:rig.grp, rig, name, village:v.name, cx:v.x, cz:v.z, a:rand(0,6.28), r:rand(12,26), sp:rand(0.1,0.26), x:rig.grp.position.x, z:rig.grp.position.z});
    }
    const lab=labelSprite("✦ "+v.name,"#aee9ff"); lab.position.set(v.x, v.y+16, v.z); lab.scale.set(24,4.5,1); scene.add(lab);
  });
}
function spawnCamps(){
  removeTaggedColliders("camp");
  camps.forEach(c=>{ scene.remove(c.group); scene.remove(c.chestMesh); });
  enemies.forEach(e=>{ if(e.camp!==undefined && e.camp>=0) scene.remove(e.mesh); });
  camps=[]; chests=[]; enemies=enemies.filter(e=>e.camp===undefined||e.camp<0);
  const count=Math.round(16*campDensity);
  for(let i=0;i<count;i++){
    let x,z,tries=0;
    do{ x=rand(-1050,1050); z=rand(-1050,1050); tries++; }while(tries<20 && (VILLAGES.some(v=>Math.hypot(x-v.x,z-v.z)<150)||Math.hypot(x-880,z+880)<140));
    const y=terrainHeight(x,z); const g=new THREE.Group();
    const tent=new THREE.Mesh(new THREE.ConeGeometry(6.5,7,4,1), new THREE.MeshStandardMaterial({color:0xc98a5a, roughness:0.9})); tent.position.y=3.4; tent.rotation.y=Math.PI/4; tent.castShadow=true; g.add(tent);
    const fire=new THREE.Mesh(new THREE.SphereGeometry(0.9,14,10), new THREE.MeshStandardMaterial({color:0xffa657, emissive:0xff7722, emissiveIntensity:2})); fire.position.set(6,0.8,4); g.add(fire);
    g.position.set(x,y,z); scene.add(g);
    const chestMesh=new THREE.Group();
    const cb=new THREE.Mesh(new THREE.BoxGeometry(2.8,1.7,1.9), new THREE.MeshStandardMaterial({color:0x9a6a35, roughness:0.55, metalness:0.25})); cb.position.y=0.85; chestMesh.add(cb);
    const lid=new THREE.Mesh(new THREE.CylinderGeometry(1.45,1.45,2.8,12,1,false,0,Math.PI), new THREE.MeshStandardMaterial({color:0xb5854a, roughness:0.5, metalness:0.3})); lid.rotation.z=Math.PI/2; lid.rotation.y=Math.PI/2; lid.position.y=1.7; chestMesh.add(lid);
    const band=new THREE.Mesh(new THREE.BoxGeometry(0.5,1.9,2), new THREE.MeshStandardMaterial({color:0xffd479, metalness:0.8, roughness:0.3})); band.position.y=1; chestMesh.add(band);
    chestMesh.position.set(x-5, terrainHeight(x-5,z+3), z+3); scene.add(chestMesh);
    const chest={x:x-5, z:z+3, mesh:chestMesh, opened:false, camp:i}; chests.push(chest);
    camps.push({x,z,y,group:g,chestMesh});
    addTaggedCollider("camp", {x, z, r:5.4});            // tent is solid
    addTaggedCollider("camp", {x:x-5, z:z+3, r:2.1});    // and so is its chest
    const n=3+Math.floor(Math.random()*3);
    for(let k=0;k<n;k++){ const et=ENEMIES[Math.floor(Math.random()*Math.min(ENEMIES.length, 3+Math.floor(P.level/3)))]; spawnEnemy(et, x+rand(-13,13), z+rand(-13,13), i); }
  }
}
function spawnEnemy(et, x, z, campIdx, isBoss=false){
  const s=isBoss?1.5:et.scale;
  const mesh=new THREE.Group();
  const mat=new THREE.MeshStandardMaterial({color:et.color, roughness:0.55});
  const rockM=new THREE.MeshStandardMaterial({color:et.color, roughness:0.95});
  if(isBoss){
    const rig=makeHumanoid(0xf1c27d, 0x4a3566, 1, 0x5e3a8a); rig.grp.scale.setScalar(1.45);
    attachWeapon(rig, {name:"Malachar's Grand Wand", shape:"wand", color:0xc792ff, kind:"weapon"});
    mesh.add(rig.grp); mesh.userData.rig=rig;
  } else if(et.type==="Grumpy Slime"){
    const b=new THREE.Mesh(new THREE.SphereGeometry(1.7*s,26,20), new THREE.MeshStandardMaterial({color:et.color, roughness:0.25, transparent:true, opacity:0.88})); b.position.y=1.25*s; b.scale.y=0.78; b.castShadow=true; mesh.add(b);
    const core=new THREE.Mesh(new THREE.SphereGeometry(0.8*s,18,14), new THREE.MeshStandardMaterial({color:0xeaffea, emissive:0x66cc77, emissiveIntensity:0.5})); core.position.y=1.2*s; mesh.add(core);
    for(const ex of [-0.5,0.5]){ const stalk=new THREE.Mesh(new THREE.CylinderGeometry(0.07*s,0.07*s,0.8*s,6), mat); stalk.position.set(ex*s,2.2*s,0.9*s); mesh.add(stalk);
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.2*s,12,10), new THREE.MeshStandardMaterial({color:0x222222})); eye.position.set(ex*s,2.65*s,0.95*s); mesh.add(eye); }
  } else if(et.type==="Mischief Sprite"){
    const b=new THREE.Mesh(new THREE.SphereGeometry(1.05*s,22,18), mat); b.position.y=2.4*s; b.castShadow=true; mesh.add(b);
    const wingMat=new THREE.MeshStandardMaterial({color:0xffffff, transparent:true, opacity:0.6, side:THREE.DoubleSide});
    const wings=[];
    for(const sx of [-1,1]){ const w=new THREE.Mesh(new THREE.CircleGeometry(1.15*s,14,0,Math.PI), wingMat); w.position.set(sx*1*s,2.9*s,-0.2); w.rotation.y=sx*0.7; mesh.add(w); wings.push(w); }
    mesh.userData.wings=wings;
    for(const ex of [-0.35,0.35]){ const eye=new THREE.Mesh(new THREE.SphereGeometry(0.15*s,10,8), new THREE.MeshStandardMaterial({color:0x222222})); eye.position.set(ex*s,2.6*s,0.9*s); mesh.add(eye); }
  } else if(et.type==="Pebble Golem"||et.type==="Tower Sentinel"){
    const b=new THREE.Mesh(new THREE.SphereGeometry(1.8*s,14,11), rockM); b.position.y=2.6*s; b.scale.y=1.15; b.castShadow=true; mesh.add(b);
    const hd=new THREE.Mesh(new THREE.SphereGeometry(0.95*s,12,10), rockM); hd.position.y=5*s; mesh.add(hd);
    for(const sx of [-1,1]){ const arm=new THREE.Mesh(new THREE.CapsuleGeometry(0.5*s,1.6*s,4,10), rockM); arm.position.set(sx*2.1*s,2.8*s,0); arm.rotation.z=sx*0.25; mesh.add(arm);
      const leg=new THREE.Mesh(new THREE.CapsuleGeometry(0.55*s,1.1*s,4,10), rockM); leg.position.set(sx*0.9*s,0.9*s,0); mesh.add(leg); }
    const eye=new THREE.Mesh(new THREE.SphereGeometry(0.16*s,10,8), new THREE.MeshStandardMaterial({color:0xffcc44, emissive:0xffaa00, emissiveIntensity:1.6})); eye.position.set(0,5.1*s,0.85*s); mesh.add(eye);
    if(et.type==="Tower Sentinel"){ const sh=new THREE.Mesh(new THREE.BoxGeometry(1.7*s,2.4*s,0.3), new THREE.MeshStandardMaterial({color:0x9aa6ff, metalness:0.6, roughness:0.35})); sh.position.set(2.6*s,2.6*s,0.6*s); mesh.add(sh); }
  } else if(et.type==="Bramble Beast"){
    const b=new THREE.Mesh(new THREE.SphereGeometry(1.7*s,20,16), mat); b.position.y=1.8*s; b.castShadow=true; mesh.add(b);
    for(let k=0;k<9;k++){ const a=k/9*Math.PI*2; const spike=new THREE.Mesh(new THREE.ConeGeometry(0.32*s,1.3*s,7), new THREE.MeshStandardMaterial({color:0x8a6a3a})); spike.position.set(Math.cos(a)*1.5*s, 2.2*s+Math.sin(a*2)*0.5, Math.sin(a)*1.5*s); spike.rotation.z=-Math.cos(a)*1.1; spike.rotation.x=Math.sin(a)*1.1; mesh.add(spike); }
    for(const ex of [-0.5,0.5]){ const eye=new THREE.Mesh(new THREE.SphereGeometry(0.16*s,10,8), new THREE.MeshStandardMaterial({color:0xffe27a, emissive:0xffcc33, emissiveIntensity:1})); eye.position.set(ex*s,2*s,1.5*s); mesh.add(eye); }
  } else if(et.type==="Cloud Imp"){
    for(let k=0;k<6;k++){ const puff=new THREE.Mesh(new THREE.SphereGeometry((0.8+((k*37)%40)/60)*s,16,12), new THREE.MeshStandardMaterial({color:0xf4f9ff, roughness:1})); puff.position.set(Math.cos(k*1.05)*0.8*s, (2+((k*53)%50)/60)*s, Math.sin(k*1.05)*0.8*s); mesh.add(puff); }
    for(const ex of [-0.35,0.35]){ const eye=new THREE.Mesh(new THREE.SphereGeometry(0.14*s,10,8), new THREE.MeshStandardMaterial({color:0x334466})); eye.position.set(ex*s,2.5*s,1.05*s); mesh.add(eye); }
  } else if(et.type==="Crystal Crab"){
    const b=new THREE.Mesh(new THREE.SphereGeometry(1.8*s,20,14), rockM); b.position.y=1.5*s; b.scale.set(1.25,0.65,1); b.castShadow=true; mesh.add(b);
    for(let k=0;k<5;k++){ const cr=new THREE.Mesh(new THREE.ConeGeometry(0.4*s,1.8*s,6), new THREE.MeshStandardMaterial({color:0xcfeaff, emissive:0x66bbff, emissiveIntensity:0.7, roughness:0.2})); cr.position.set((k-2)*0.6*s, 2.6*s, -0.3*s); cr.rotation.x=-0.3; mesh.add(cr); }
    for(const sx of [-1,1]) for(let l=0;l<3;l++){ const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.12*s,0.08*s,1.6*s,6), rockM); leg.position.set(sx*1.9*s,0.7*s,(l-1)*0.8*s); leg.rotation.z=sx*0.8; mesh.add(leg); }
  } else if(et.type==="Wizard's Lantern"){
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.12*s,0.16*s,3.6*s,8), new THREE.MeshStandardMaterial({color:0x4a3a28})); pole.position.y=1.8*s; mesh.add(pole);
    const lamp=new THREE.Mesh(new THREE.SphereGeometry(0.95*s,18,14), new THREE.MeshStandardMaterial({color:0xffc46a, emissive:0xff9922, emissiveIntensity:1.7, transparent:true, opacity:0.95})); lamp.position.y=4.1*s; mesh.add(lamp);
    const cap=new THREE.Mesh(new THREE.ConeGeometry(1.15*s,0.8*s,10), new THREE.MeshStandardMaterial({color:0x5e3a8a})); cap.position.y=5.1*s; mesh.add(cap);
  } else {
    const b=new THREE.Mesh(new THREE.SphereGeometry(1.6*s,24,18), mat); b.position.y=1.7*s; b.castShadow=true; mesh.add(b);
  }
  mesh.position.set(x, terrainHeight(x,z), z); scene.add(mesh);
  const lab=labelSprite(isBoss?"Malachar the Wizard":et.type, isBoss?"#e0aaff":"#ffffff"); lab.position.y=(isBoss?11:5.6*s); mesh.add(lab);
  const lvlBonus=1+P.level*0.12;
  const e={mesh, type:et.type, hp:et.hp*lvlBonus*(isBoss?22:1), hpMax:et.hp*lvlBonus*(isBoss?22:1), dmg:et.dmg*(isBoss?2.2:1), xp:et.xp*(isBoss?40:1), gold:et.gold, speed:et.speed, x, z, camp:campIdx, boss:isBoss, atkCd:0, wanderA:rand(0,6.28)};
  enemies.push(e); return e;
}
function burst(x,y,z,color,n=14){
  const geo=new THREE.BufferGeometry(); const pts=[]; for(let i=0;i<n;i++) pts.push(x,y,z);
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts,3));
  const m=new THREE.Points(geo, new THREE.PointsMaterial({color, size:0.7, transparent:true}));
  m.userData.vel=Array.from({length:n},()=>new THREE.Vector3(rand(-6,6),rand(2,9),rand(-6,6)));
  m.userData.life=0.8; scene.add(m); particles.push(m);
}
// expanding ring FX (shared by AoE + impacts)
function ringFX(x,y,z,color,maxR=10,dur=0.55){
  const m=new THREE.Mesh(new THREE.TorusGeometry(1,0.16,8,48), new THREE.MeshStandardMaterial({color, emissive:color, emissiveIntensity:1.4, transparent:true}));
  m.rotation.x=Math.PI/2; m.position.set(x,y,z); scene.add(m);
  fxList.push({mesh:m, life:dur, max:dur, kind:"ring", maxR});
}

// ---------- Quests ----------
function currentMain(){ return MAIN_QUESTS[P.mainIdx]||null; }
function questProgress(kind, data={}){
  let changed=false;
  const bump=(q, store)=>{ const o=q.obj; if(!o) return;
    if(kind==="chests" && o.kind==="chests"){ store.count=(store.count||0)+1; changed=true; if(o.count<=store.count) completeQuest(q); return; }
    if(o.kind===kind){ if(kind==="defeat" && o.enemy!==data.enemy) return; store.count=(store.count||0)+1; changed=true; if((o.count||1)<=store.count) completeQuest(q); }
    if(o.kind==="defeatAny" && kind==="defeat"){ store.count=(store.count||0)+1; changed=true; if((o.count||1)<=store.count) completeQuest(q); } };
  const mq=currentMain(); if(mq && !mq.done){ P.mainProgress[mq.id]=P.mainProgress[mq.id]||{}; bump(mq, P.mainProgress[mq.id]); }
  [...P.side].forEach(q=>{ if(!q.done){ q._p=q._p||{}; bump(q, q._p); } });
  if(changed) renderQuests();
}
function completeQuest(q){
  if(q.done) return; q.done=true;
  gainXP(Math.round(q.xp*(P.inventory.some(i=>i.modifier?.xp)?1.1:1))); P.gold+=q.gold;
  toast(`Quest complete: ${q.title}  +${q.xp} XP, +${q.gold} gold`);
  if(Math.random()<0.5) randomLoot();
  if(q===currentMain()){ P.mainIdx++; if(q.id==="m14") showEnd(); }
  P.side=P.side.filter(s=>!s.done); renderQuests(); saveGame();
}
function gainXP(n){ P.xp+=n; while(P.xp>=P.xpNext){ P.xp-=P.xpNext; P.level++; P.xpNext=xpForLevel(P.level); P.hpMax+=14+Math.round(P.level*1.5); P.manaMax+=7; P.hp=P.hpMax; P.mana=P.manaMax; P.baseDmg+=2; toast(`⭐ Level ${P.level}! HP and power up.`); learnLevelSpells(); } updateHUD(); }
function learnLevelSpells(){ const want={3:"River Rush",5:"Star Shower",7:"Sun Ray",9:"Crystal Shards",11:"Moonbeam",13:"Great Mend",16:"Comet Trail",19:"Aurora Wave",22:"Worldtree Blessing"}; const s=want[P.level]; if(s&&!P.spells.includes(s)){ P.spells.push(s); toast("New spell learned: "+s); } }

// ---------- Combat & spells (each spell = its own model & behaviour) ----------
function nearestEnemy(maxD){ let best=null,bd=maxD; for(const e of enemies){ const d=Math.hypot(e.x-P.pos.x,e.z-P.pos.z); if(d<bd){bd=d;best=e;} } if(boss && Math.hypot(boss.x-P.pos.x,boss.z-P.pos.z)<maxD) best=boss; return best; }
function attack(){
  if(atkCd>0||!started) return; atkCd=0.45; atkAnimUntil=Date.now()+220;
  const dmg=P.baseDmg + (P.weapon?P.weapon.power:0);
  const best=nearestEnemy(7);
  // visible slash arc in front of the player
  const arc=new THREE.Mesh(new THREE.TorusGeometry(3.4,0.22,8,24,Math.PI*0.9), new THREE.MeshStandardMaterial({color:P.weapon?P.weapon.color:0xffe27a, emissive:P.weapon?P.weapon.color:0xffe27a, emissiveIntensity:1.3, transparent:true}));
  arc.position.set(P.pos.x,P.pos.y+4,P.pos.z); arc.rotation.y=-yaw+Math.PI*0.55; arc.rotation.x=0.4; scene.add(arc);
  fxList.push({mesh:arc, life:0.22, max:0.22, kind:"fade"});
  if(best) setTimeout(()=>{ if(enemies.includes(best)||best===boss) hitEnemy(best, dmg*(Date.now()<dmgBuffUntil?1.3:1)); },110);
}
function hitEnemy(e, dmg){
  e.hp-=dmg; burst(e.mesh.position.x, e.mesh.position.y+3, e.mesh.position.z, 0xffe27a, 8);
  ringFX(e.mesh.position.x, e.mesh.position.y+1.2, e.mesh.position.z, 0xffe27a, 3.2, 0.35);
  e.mesh.scale.setScalar(1.1); setTimeout(()=>e.mesh&&e.mesh.scale.setScalar(1),90);
  if(e.hp<=0){
    burst(e.mesh.position.x, e.mesh.position.y+3, e.mesh.position.z, 0xffffff, 26);
    ringFX(e.mesh.position.x, e.mesh.position.y+1, e.mesh.position.z, 0xffffff, 6, 0.6);
    scene.remove(e.mesh); enemies=enemies.filter(x=>x!==e); if(e===boss) boss=null;
    gainXP(e.xp); P.gold+=e.gold; toast(`Poof! ${e.type} +${e.xp} XP, +${e.gold} gold`);
    questProgress("defeat",{enemy:e.type});
    if(e.boss){ const mq=currentMain(); if(mq&&mq.id==="m14") completeQuest(mq); }
    if(Math.random()<0.25) randomLoot();
  }
}
function castSpell(name){
  const s=SPELL_BY_NAME[name]; if(!s) return;
  if(P.mana<s.cost){ toast("Not enough mana"); return; }
  const fx=SPELL_FX[name]||{mode:"projectile", geo:"orb", color:0xffe27a, speed:60, size:0.8};
  const dmg=s.power + P.level*1.5;
  const target=nearestEnemy(46);
  if(fx.mode==="projectile"){
    if(!target){ toast("No foe in range to aim at"); return; }
    P.mana-=s.cost;
    const mesh=makeSpellProjectile(fx);
    mesh.position.set(P.pos.x, P.pos.y+4.6, P.pos.z); scene.add(mesh);
    projectiles.push({mesh, target, speed:fx.speed||60, dmg, fx, trailCd:0});
  } else if(fx.mode==="beam"){
    if(!target){ toast("No foe in range to aim at"); return; }
    P.mana-=s.cost;
    const from=new THREE.Vector3(P.pos.x, P.pos.y+4.8, P.pos.z), to=new THREE.Vector3(target.mesh.position.x, target.mesh.position.y+3, target.mesh.position.z);
    const len=from.distanceTo(to);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.55,len,12,1,true), new THREE.MeshStandardMaterial({color:fx.color, emissive:fx.color, emissiveIntensity:2, transparent:true, opacity:0.9}));
    beam.position.copy(from).lerp(to,0.5); beam.lookAt(to); beam.rotateX(Math.PI/2); scene.add(beam);
    const core=makeSpellProjectile({geo:"orb", color:fx.color, size:0.9}); core.position.copy(to); scene.add(core);
    fxList.push({mesh:beam, life:0.38, max:0.38, kind:"fade"}); fxList.push({mesh:core, life:0.3, max:0.3, kind:"fade"});
    hitEnemy(target, dmg);
  } else if(fx.mode==="aoe"){
    P.mana-=s.cost; const R=fx.radius||11;
    ringFX(P.pos.x, P.pos.y+0.8, P.pos.z, fx.color, R, 0.8);
    if(fx.geo==="stars"){ for(let i=0;i<12;i++){ const st=makeSpellProjectile({geo:"star", color:fx.color, size:0.7}); const a=rand(0,6.28), r=rand(2,R-1);
      st.position.set(P.pos.x+Math.cos(a)*r, P.pos.y+16+rand(0,6), P.pos.z+Math.sin(a)*r); scene.add(st); fxList.push({mesh:st, life:0.7, max:0.7, kind:"fall"}); } }
    if(fx.geo==="petals"){ for(let i=0;i<14;i++){ const pt=new THREE.Mesh(new THREE.SphereGeometry(0.4,10,8), new THREE.MeshStandardMaterial({color:0xff9ecb, emissive:0xff7bcd, emissiveIntensity:0.7})); pt.scale.y=0.3; const a=rand(0,6.28), r=rand(1,R-1);
      pt.position.set(P.pos.x+Math.cos(a)*r, P.pos.y+2+rand(0,3), P.pos.z+Math.sin(a)*r); scene.add(pt); fxList.push({mesh:pt, life:0.9, max:0.9, kind:"spin"}); } }
    setTimeout(()=>{ [...enemies].forEach(e=>{ if(Math.hypot(e.x-P.pos.x,e.z-P.pos.z)<R) hitEnemy(e, dmg); }); if(boss&&Math.hypot(boss.x-P.pos.x,boss.z-P.pos.z)<R) hitEnemy(boss,dmg); },380);
  } else { // self spells — each with its own visual
    P.mana-=s.cost;
    if(name==="Healing Light"||name==="Leaf Mend"||name==="Great Mend"||name==="Worldtree Blessing"){
      P.hp=Math.min(P.hpMax, P.hp+s.power+(name==="Worldtree Blessing"?40:0));
      for(let i=0;i<3;i++){ const ring=new THREE.Mesh(new THREE.TorusGeometry(2.4-i*0.4,0.13,8,36), new THREE.MeshStandardMaterial({color:fx.color, emissive:fx.color, emissiveIntensity:1.4, transparent:true}));
        ring.rotation.x=Math.PI/2; ring.position.set(P.pos.x, P.pos.y+1+i*1.6, P.pos.z); scene.add(ring); fxList.push({mesh:ring, life:0.9, max:0.9, kind:"rise", follow:true}); }
      if(name==="Leaf Mend") for(let i=0;i<8;i++){ const lf=new THREE.Mesh(new THREE.SphereGeometry(0.34,8,6), new THREE.MeshStandardMaterial({color:0x5ec962, emissive:0x3f9142, emissiveIntensity:0.6})); lf.scale.y=0.35; const a=rand(0,6.28);
        lf.position.set(P.pos.x+Math.cos(a)*2.4, P.pos.y+rand(1,5), P.pos.z+Math.sin(a)*2.4); scene.add(lf); fxList.push({mesh:lf, life:1, max:1, kind:"spin", follow:true}); }
    }
    else if(name==="Mana Shield"||name==="Stone Skin"){ shieldUp=true; if(name==="Stone Skin") armorBuffUntil=Date.now()+15000;
      if(shieldMesh) scene.remove(shieldMesh);
      shieldMesh=new THREE.Mesh(new THREE.SphereGeometry(3.1,26,20), new THREE.MeshStandardMaterial({color:fx.color, transparent:true, opacity:0.22, roughness:0.15, metalness:0.1, side:THREE.DoubleSide}));
      scene.add(shieldMesh); }
    else if(name==="Wind Step"){ speedBuffUntil=Date.now()+5000; ringFX(P.pos.x,P.pos.y+0.7,P.pos.z,fx.color,4.5,0.5); }
    else if(name==="Cheer Song"){ dmgBuffUntil=Date.now()+10000;
      for(let i=0;i<5;i++){ const note=new THREE.Group(); const b=new THREE.Mesh(new THREE.SphereGeometry(0.34,12,10), new THREE.MeshStandardMaterial({color:fx.color, emissive:fx.color, emissiveIntensity:0.9})); note.add(b);
        const stem=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.9,6), b.material); stem.position.set(0.3,0.45,0); note.add(stem);
        note.position.set(P.pos.x+rand(-2,2), P.pos.y+5+i*0.5, P.pos.z+rand(-2,2)); scene.add(note); fxList.push({mesh:note, life:1.3, max:1.3, kind:"rise", follow:true}); } }
    else if(name==="Snow Veil"){ shieldUp=true; ringFX(P.pos.x,P.pos.y+1,P.pos.z,fx.color,5,0.7); burst(P.pos.x,P.pos.y+4,P.pos.z,0xffffff,18); }
    else if(name==="Teleport Home"){ let best=VILLAGES[0],bd=1e9; for(const v of VILLAGES){const d=Math.hypot(v.x-P.pos.x,v.z-P.pos.z); if(d<bd){bd=d;best=v;}} P.pos.set(best.x,0,best.z+18); ringFX(P.pos.x,terrainHeight(P.pos.x,P.pos.z)+1,P.pos.z,fx.color,6,0.7); }
  }
  updateHUD();
}

// ---------- Interaction ----------
let nearThing=null;
function findNear(){
  nearThing=null;
  for(const n of npcs) if(Math.hypot(n.x-P.pos.x,n.z-P.pos.z)<6.5){ nearThing={kind:"npc", n}; break; }
  if(!nearThing) for(const c of chests) if(!c.opened && Math.hypot(c.x-P.pos.x,c.z-P.pos.z)<5.5){ nearThing={kind:"chest", c}; break; }
  if(!nearThing) for(const v of world.villages){
    if(Math.hypot(v.x+10-P.pos.x, v.z+6-P.pos.z)<6.5){ nearThing={kind:"board", v}; break; }
    if(Math.hypot(v.x-11-P.pos.x, v.z+7-P.pos.z)<7){ nearThing={kind:"shop", v}; break; }
    if(Math.hypot(v.x-P.pos.x, v.z-P.pos.z)<8){ nearThing={kind:"village", v}; break; }
  }
  if(!nearThing && Math.hypot(880-P.pos.x,-880-P.pos.z)<22){ nearThing={kind:"tower"}; }
  $("interact").style.display=nearThing? "block":"none";
  if(nearThing) $("interact").textContent = nearThing.kind==="npc"? `E — Talk to ${nearThing.n.name}` : nearThing.kind==="chest"? "E — Open chest" : nearThing.kind==="board"? "E — Quest post" : nearThing.kind==="shop"? "E — Shop" : nearThing.kind==="tower"? "E — The Dark Tower door" : "E — Village";
}
function interact(){
  if(!nearThing) return;
  if(nearThing.kind==="npc"){
    const n=nearThing.n; showDialogue(n.name, NPC_LINES[Math.floor(Math.random()*NPC_LINES.length)]);
    const mq=currentMain();
    if(mq&&mq.obj.kind==="talk"&&mq.obj.target===n.name) completeQuest(mq);
    if(mq&&mq.obj.kind==="talkall"){ P.talkedVillages.add(n.village); toast(`Villages ready: ${P.talkedVillages.size}/5`); if(P.talkedVillages.size>=5) completeQuest(mq); }
  }
  if(nearThing.kind==="chest"){ nearThing.c.opened=true; nearThing.c.mesh.children[0].material=new THREE.MeshStandardMaterial({color:0x5a4020}); P.chestsOpened++; burst(nearThing.c.x,terrainHeight(nearThing.c.x,nearThing.c.z)+3,nearThing.c.z,0xffd700,20); randomLoot(); if(Math.random()<0.5) randomLoot(); P.gold+=Math.round(rand(5,30)); questProgress("chests",{}); }
  if(nearThing.kind==="board") openBoard(nearThing.v);
  if(nearThing.kind==="shop") openShop(nearThing.v);
  if(nearThing.kind==="village"){ const mq=currentMain(); if(mq&&mq.obj.kind==="visit"&&mq.obj.village===nearThing.v.name) completeQuest(mq);
    P.side.forEach(q=>{ if(!q.done&&q.obj.kind==="visitOther"&&q.village!==nearThing.v.name) completeQuest(q); });
    showDialogue(nearThing.v.name, "A friendly village of Aetheria. Houses, a well, a quest post and a shop — all here for travellers."); }
  if(nearThing.kind==="tower"){ const mq=currentMain(); if(mq&&mq.id==="m13") completeQuest(mq);
    if(currentMain()&&currentMain().id==="m14"&&!boss){ boss=spawnEnemy(ENEMIES[7], 855,-850, -1, true); boss.type="Malachar the Wizard"; showDialogue("Malachar", "So! The villages sent their kindest champion. Very well — a friendly duel of sparkles. First shield to fall loses, and the loser takes up gardening. En garde!"); }
    else showDialogue("The Dark Tower", "A tall, gloomy tower. It smells faintly of lavender and old books."); }
}

// ---------- UI ----------
function toast(t){ const el=document.createElement("div"); el.className="toast"; el.textContent=t; $("toasts").appendChild(el); setTimeout(()=>el.remove(),4200); }
function showDialogue(name, text){ $("dlgName").textContent=name; $("dlgText").textContent=text; $("dialogue").style.display="block"; }
$("dlgClose").onclick=()=>$("dialogue").style.display="none";
function updateHUD(){
  $("hpBar").style.width=(P.hp/P.hpMax*100)+"%"; $("hpText").textContent=`HP ${Math.ceil(P.hp)}/${P.hpMax}`;
  $("manaBar").style.width=(P.mana/P.manaMax*100)+"%"; $("manaText").textContent=`Mana ${Math.ceil(P.mana)}/${P.manaMax}`;
  $("xpBar").style.width=(P.xp/P.xpNext*100)+"%"; $("xpText").textContent=`Level ${P.level} · XP ${Math.floor(P.xp)}/${P.xpNext}`;
  $("goldText").textContent="🪙 "+P.gold; $("lvlBadge").textContent=P.level;
  $("spellBar").innerHTML=P.spells.slice(0,6).map((s,i)=>`<button class="spellBtn" data-s="${s}">${i+1} ${s}</button>`).join("");
  document.querySelectorAll(".spellBtn").forEach(b=>b.onclick=()=>castSpell(b.dataset.s));
}
function renderQuests(){
  const mq=currentMain();
  $("questTracker").innerHTML = mq? `<b>📜 ${mq.title}</b><br><small>${mq.text}</small>` : "<b>📜 Story complete!</b>";
  $("questList").innerHTML = (mq? `<div class="q"><b>${mq.title}</b> (Lv ${mq.lvl})<br>${mq.text}<br><i>Reward ${mq.xp} XP · ${mq.gold} gold</i></div>`:"") +
    P.side.map(q=>`<div class="q"><b>${q.title}</b><br>${q.text}<br><i>Reward ${q.xp} XP · ${q.gold} gold</i></div>`).join("");
}
function renderInventory(){
  $("invStats").innerHTML=`<b>${P.name}</b> — ${P.cls?P.cls.name:""} · Level ${P.level}<br>HP ${Math.ceil(P.hp)}/${P.hpMax} · Mana ${Math.ceil(P.mana)}/${P.manaMax} · 🪙 ${P.gold}<br>Weapon: ${P.weapon?P.weapon.name+" ("+P.weapon.power+")":"none"} · Armour: ${P.armorItem?P.armorItem.name+" ("+P.armorItem.armor+")":"none"}<br><b>Spells:</b> ${P.spells.join(", ")}<br><small>Tap any item to preview its own 3D model + attributes below.</small>`;
  $("invGrid").innerHTML=P.inventory.map(it=>`<div class="item" style="border-color:${RARITIES[it.rarity]?.color||'#888'}" data-view="${it.uid}"><b>${it.name}</b><br><small>${it.rarity}${it.modifier?" · "+it.modifier.name:""} · ${it.kind==="weapon"?"Power "+it.power:"Armour "+it.armor}</small><br><button data-equip="${it.uid}">Equip</button> <button data-sell="${it.uid}">Sell ${Math.round((it.power||it.armor||5)*2)}g</button></div>`).join("") || "<p>No loot yet — open camp chests!</p>";
  document.querySelectorAll("[data-view]").forEach(el=>el.onclick=e=>{ if(e.target.tagName==="BUTTON") return; const it=P.inventory.find(x=>x.uid==el.dataset.view); if(it) showPreview($("invPreview"), it); });
  document.querySelectorAll("[data-equip]").forEach(b=>b.onclick=()=>{ const it=P.inventory.find(x=>x.uid==b.dataset.equip); if(it.kind==="weapon"){ P.weapon=it; if(playerRig) attachWeapon(playerRig, it); } else P.armorItem=it; toast("Equipped "+it.name); renderInventory(); updateHUD(); });
  document.querySelectorAll("[data-sell]").forEach(b=>b.onclick=()=>{ const i=P.inventory.findIndex(x=>x.uid==b.dataset.sell); if(i>=0){ const it=P.inventory[i]; P.gold+=Math.round((it.power||it.armor||5)*2); if(P.weapon===it)P.weapon=null; if(P.armorItem===it)P.armorItem=null; P.inventory.splice(i,1); renderInventory(); updateHUD(); } });
}
function openBoard(v){
  $("panelTitle").textContent="Quest Post — "+v.name; $("shopPreview").style.display="none"; $("panelBody").innerHTML="";
  for(let i=0;i<3;i++){ const q=makeSideQuest(v.name, P.level); const d=document.createElement("div"); d.className="q";
    d.innerHTML=`<b>${q.title}</b><br>${q.text}<br><i>${q.xp} XP · ${q.gold} gold</i> <button>Accept</button>`;
    d.querySelector("button").onclick=()=>{ P.side.push(q); toast("Quest accepted: "+q.title); renderQuests(); d.remove(); }; $("panelBody").appendChild(d); }
  $("panel").style.display="block";
}
function openShop(v){
  const tier=VILLAGES.findIndex(x=>x.name===v.name);
  $("panelTitle").textContent="Shop — "+v.name; $("shopPreview").style.display="block"; $("shopPreview").innerHTML="<p style='text-align:center'><small>Tap an item's Preview to see its own 3D model + attributes here.</small></p>";
  $("panelBody").innerHTML=`<p>Your gold: 🪙 ${P.gold}</p>`;
  for(let i=0;i<6;i++){
    const pool=Math.random()<0.6? WEAPONS:ARMOR; const base=pool[Math.floor(Math.random()*pool.length)];
    const item={...base, rarity:rollRarity(), kind:base.kind, power:base.power, armor:base.armor};
    if(item.kind==="weapon") item.power=Math.round(base.power*(RARITIES[item.rarity].mult||1)); if(item.kind==="armor") item.armor=Math.round((base.armor||2)*(RARITIES[item.rarity].mult||1));
    const exclusive=Math.random()<0.3; if(exclusive) item.rarity="Shop";
    const price=Math.round((base.power||base.armor||5)*(6+tier*2)*rand(0.9,1.3));
    const d=document.createElement("div"); d.className="q";
    d.innerHTML=`<b style="color:${RARITIES[item.rarity].color}">${exclusive?"★ Shop Exclusive — ":""}${item.name}</b> [${item.rarity}] — ${item.kind==="weapon"?"Power "+item.power:"Armour "+item.armor}<br><small>${item.desc||""}</small><br><button data-act="prev">👁 Preview</button> <button data-act="buy">Buy 🪙 ${price}</button>`;
    d.querySelector('[data-act="prev"]').onclick=()=>showPreview($("shopPreview"), item, price);
    d.querySelector('[data-act="buy"]').onclick=()=>{ if(P.gold<price){toast("Not enough gold");return;} P.gold-=price; const bought=giveItem({...base}, exclusive?undefined:item.rarity, exclusive?"shopExclusive":null); if(exclusive) bought.name="Shop Exclusive "+base.name; updateHUD(); openShop(v); };
    $("panelBody").appendChild(d);
    if(i===0) showPreview($("shopPreview"), item, price);
  }
  $("panel").style.display="block";
}
$("panelClose").onclick=()=>{ $("panel").style.display="none"; preview.active=false; };
function showEnd(){ showDialogue("🎉 Story Complete!", "Malachar lowers his wand, laughs, and signs the Gardening Promise in big purple letters. Aetheria is safe — and the side quests, camps and villages still hold many hours of adventures. Thank you for playing!"); }

// ---------- Save ----------
function saveGame(){ try{ localStorage.setItem("aetheria-save", JSON.stringify({name:P.name, level:P.level, xp:P.xp, gold:P.gold, mainIdx:P.mainIdx, chestsOpened:P.chestsOpened, spells:P.spells, inv:P.inventory, clsId:P.cls?.id})); }catch(e){} }

// ---------- Multiplayer ----------
$("hostBtn").onclick=()=>{ room=new Room(onPeer); const code=room.host(); $("roomInfo").innerHTML=`Room code: <b style="font-size:26px;letter-spacing:4px">${code}</b><br><small>Friends: open this game in another tab/window on this device, choose Join Room, type the code.</small>`; startMpLoop(); };
$("joinBtn").onclick=()=>{ const code=$("joinCode").value; room=new Room(onPeer); if(room.join(code)){ $("roomInfo").textContent="Joined room "+code.toUpperCase()+" — look for your friends' names in the world!"; startMpLoop(); } else toast("Code must be 5 letters"); };
function onPeer(id, m){ if(!m){ const r=remotes.get(id); if(r){scene.remove(r.rig.grp); remotes.delete(id);} return; }
  let r=remotes.get(id);
  if(!r){ const rig=makeHumanoid(m.skin, m.hair, 0, m.outfit); attachWeapon(rig, {name:(m.name||"Friend")+" Wand", shape:"wand", color:0xffe27a, kind:"weapon"});
    const lab=labelSprite(m.name||"Friend","#7ee787"); lab.position.y=9.4; rig.grp.add(lab); scene.add(rig.grp); r={rig, px:m.x, pz:m.z}; remotes.set(id,r); toast((m.name||"A friend")+" joined your world!"); }
  const moving=Math.hypot(m.x-r.px, m.z-r.pz)>0.4; r.px=m.x; r.pz=m.z;
  r.rig.grp.position.set(m.x, m.y, m.z); r.rig.grp.rotation.y=m.ry||0; animateRig(r.rig, moving?1:0, 0.12);
}
function startMpLoop(){ setInterval(()=>{ if(room&&started) room.sendState({name:P.name, x:P.pos.x, y:P.pos.y, z:P.pos.z, ry:playerMesh?playerMesh.rotation.y:0, skin:selSkin, hair:selHair, outfit:selOutfit}); },120); }

// ---------- Start ----------
$("startBtn").onclick=()=>{
  P.name=$("charName").value.trim()||"Traveller"; P.cls=selClass;
  P.hpMax=selClass.hp; P.hp=P.hpMax; P.manaMax=selClass.mana; P.mana=P.manaMax; P.baseDmg=selClass.dmg; P.speed=selClass.speed;
  P.spells=[...selClass.spells]; P.xpNext=xpForLevel(1);
  const w=WEAPONS.find(x=>x.name===selClass.weapon)||WEAPONS[0]; P.weapon=giveItem({...w},"Common");
  const a=ARMOR.find(x=>x.name.startsWith(selClass.armor.split(" ")[0]))||ARMOR[0]; P.armorItem=giveItem({...a},"Common");
  $("creation").style.display="none"; $("hud").style.display="block"; started=true; initThree(); updateHUD(); renderQuests(); renderInventory();
  toast("Welcome to Aetheria, "+P.name+"! WASD walk, hold SHIFT to sprint, drag to look, Space to attack, E to talk.");
};
function initThree(){
  scene=new THREE.Scene(); scene.background=new THREE.Color(0x9fd8ff); scene.fog=new THREE.Fog(0x9fd8ff, 200, 950);
  camera=new THREE.PerspectiveCamera(62, innerWidth/innerHeight, 0.1, 3000);
  renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setSize(innerWidth,innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  $("game").appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xcfeaff, 0x5a7a4a, 0.95));
  const sun=new THREE.DirectionalLight(0xfff2cc, 1.6); sun.position.set(120,220,80); sun.castShadow=true;
  sun.shadow.camera.left=-90; sun.shadow.camera.right=90; sun.shadow.camera.top=90; sun.shadow.camera.bottom=-90; sun.shadow.mapSize.set(2048,2048);
  scene.add(sun); scene.userData.sun=sun;
  world=buildWorld(scene);
  playerRig=makeHumanoid(selSkin, selHair, selHairStyle, selOutfit);
  playerMesh=playerRig.grp; attachWeapon(playerRig, P.weapon);
  const lab=labelSprite(P.name+" · "+selClass.name,"#ffffff"); lab.position.y=9.6; playerMesh.add(lab); scene.add(playerMesh);
  P.pos.set(0, terrainHeight(0,90), 90);
  spawnNPCs(); spawnCamps();
  clock=new THREE.Clock(); animate();
  addEventListener("resize",()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });
  let dragging=false,lx=0,ly=0;
  renderer.domElement.addEventListener("pointerdown",e=>{dragging=true;lx=e.clientX;ly=e.clientY;});
  addEventListener("pointerup",()=>dragging=false);
  addEventListener("pointermove",e=>{ if(!dragging) return; yaw-=(e.clientX-lx)*0.005; pitch=Math.max(0.08,Math.min(1.2,pitch+(e.clientY-ly)*0.004)); lx=e.clientX; ly=e.clientY; });
  addEventListener("wheel",e=>{ camDist=Math.max(6,Math.min(22,camDist+e.deltaY*0.01)); });
}
// Input
addEventListener("keydown",e=>{ keys[e.key.toLowerCase()]=true;
  if(e.key==="e"||e.key==="E") interact();
  if(e.key==="i"||e.key==="I"||e.key==="Tab"){ e.preventDefault(); const p=$("inventory"); const opening=p.style.display!=="block"; p.style.display=opening?"block":"none"; preview.active=opening; if(opening) renderInventory(); }
  if(e.key===" "){ e.preventDefault(); attack(); }
  const n=parseInt(e.key); if(n>=1&&n<=6&&P.spells[n-1]) castSpell(P.spells[n-1]);
  if(e.key==="`") $("dev").style.display=$("dev").style.display==="block"?"none":"block";
});
addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);
$("atkBtn").onclick=attack; $("intBtn").onclick=interact;
$("invBtn").onclick=()=>{ const p=$("inventory"); const opening=p.style.display!=="block"; p.style.display=opening?"block":"none"; preview.active=opening; if(opening) renderInventory(); };
$("invClose").onclick=()=>{ $("inventory").style.display="none"; preview.active=false; };
$("sprBtn").addEventListener("pointerdown",e=>{ e.preventDefault(); sprintTouch=true; });
addEventListener("pointerup",()=>{ sprintTouch=false; });
$("density").oninput=e=>{ campDensity=+e.target.value; $("densityVal").textContent=campDensity.toFixed(1)+"×"; };
$("respawnBtn").onclick=()=>{ spawnCamps(); toast("Camps rebuilt at "+campDensity.toFixed(1)+"× density"); };
$("healBtn").onclick=()=>{ P.hp=P.hpMax; P.mana=P.manaMax; updateHUD(); };
// touch joystick
let joyVec={x:0,z:0};
const joy=$("joy"), knob=$("knob"); let joyId=null;
if(joy){ joy.addEventListener("pointerdown",e=>{joyId=e.pointerId;}); addEventListener("pointermove",e=>{ if(e.pointerId!==joyId) return; const r=joy.getBoundingClientRect(); let dx=e.clientX-(r.left+55), dy=e.clientY-(r.top+55); const m=Math.hypot(dx,dy); if(m>38){dx*=38/m;dy*=38/m;} knob.style.transform=`translate(${dx}px,${dy}px)`; joyVec={x:dx/38,z:dy/38}; });
  addEventListener("pointerup",e=>{ if(e.pointerId===joyId){joyId=null; joyVec={x:0,z:0}; knob.style.transform="";} }); }

// ---------- Main loop ----------
function animate(){
  requestAnimationFrame(animate); const dt=Math.min(clock.getDelta(),0.05); const now=Date.now();
  if(atkCd>0) atkCd-=dt;
  const sprinting=(keys["shift"]||sprintTouch);
  const baseSp=sprinting? 17.5 : 9;
  const sp=baseSp*P.speed*(now<speedBuffUntil?1.35:1);
  let f=0,r=0;
  if(keys["w"]) f+=1; if(keys["s"]) f-=1; if(keys["d"]) r+=1; if(keys["a"]) r-=1;
  r+=joyVec.x; f-=joyVec.z;
  const len=Math.hypot(f,r); isMoving=len>0.05;
  if(isMoving){ const nf=f/Math.max(1,len), nr=r/Math.max(1,len);
    const fx=-Math.sin(yaw), fz=-Math.cos(yaw), rx=Math.cos(yaw), rz=-Math.sin(yaw);
    P.pos.x += (fx*nf + rx*nr)*sp*dt; P.pos.z += (fz*nf + rz*nr)*sp*dt;
    playerMesh.rotation.y=Math.atan2(fx*nf+rx*nr, fz*nf+rz*nr);
  }
  P.pos.x=Math.max(-1180,Math.min(1180,P.pos.x)); P.pos.z=Math.max(-1180,Math.min(1180,P.pos.z));
  collide(P.pos, 1.15); // cannot walk through houses/trees/rocks/tower/wells
  const ground=terrainHeight(P.pos.x,P.pos.z);
  P.pos.y += (ground-P.pos.y)*Math.min(1,dt*10);
  playerMesh.position.copy(P.pos);
  animateRig(playerRig, isMoving? (sprinting?1.35:0.8):0, dt, sprinting&&isMoving);
  // sprint FOV kick so you can FEEL it
  const targetFov=(sprinting&&isMoving)? 73:62;
  if(Math.abs(camera.fov-targetFov)>0.2){ camera.fov+=(targetFov-camera.fov)*Math.min(1,dt*7); camera.updateProjectionMatrix(); }
  const cx=P.pos.x+Math.sin(yaw)*Math.cos(pitch)*camDist, cz=P.pos.z+Math.cos(yaw)*Math.cos(pitch)*camDist, cy=P.pos.y+Math.sin(pitch)*camDist+3;
  camera.position.set(cx, Math.max(cy, terrainHeight(cx,cz)+1.5), cz); camera.lookAt(P.pos.x,P.pos.y+4.8,P.pos.z);
  scene.userData.sun.position.set(P.pos.x+120, P.pos.y+220, P.pos.z+80); scene.userData.sun.target=playerMesh;
  if(world.orb) world.orb.rotation.y+=dt;
  if(shieldMesh){ shieldMesh.position.set(P.pos.x, P.pos.y+3.6, P.pos.z); shieldMesh.visible=shieldUp; }
  // NPCs wander + walk animation
  for(const n of npcs){ n.a+=dt*n.sp*0.35; const nx=n.cx+Math.cos(n.a)*n.r, nz=n.cz+Math.sin(n.a)*n.r; const moving=Math.hypot(nx-n.x,nz-n.z)>0.01; n.x=nx; n.z=nz;
    n.mesh.position.set(n.x, terrainHeight(n.x,n.z), n.z); n.mesh.rotation.y=Math.atan2(Math.cos(n.a), Math.sin(n.a))+Math.PI/2; animateRig(n.rig, moving?0.5:0, dt); }
  // Enemies AI
  for(const e of [...enemies]){
    const d=Math.hypot(e.x-P.pos.x, e.z-P.pos.z);
    if(d<26 && d>2.8){ e.x+=(P.pos.x-e.x)/d*e.speed*dt*3.2; e.z+=(P.pos.z-e.z)/d*e.speed*dt*3.2; }
    else { e.wanderA+=dt*0.7; e.x+=Math.cos(e.wanderA)*dt*e.speed*0.5; e.z+=Math.sin(e.wanderA)*dt*e.speed*0.5; }
    e.mesh.position.set(e.x, terrainHeight(e.x,e.z)+(e.type==="Mischief Sprite"||e.type==="Cloud Imp"? 1.2+Math.sin(now*0.005+e.x)*0.4 : Math.abs(Math.sin(now*0.004+e.x))*0.22), e.z);
    if(e.mesh.userData.wings) e.mesh.userData.wings.forEach((w,i)=>{ w.rotation.x=Math.sin(now*0.03+i*2)*0.55; });
    if(e.mesh.userData.rig) animateRig(e.mesh.userData.rig, d<26?0.7:0.2, dt);
    e.atkCd-=dt;
    if(d<3.6 && e.atkCd<=0){ e.atkCd=1.1; if(shieldUp){ shieldUp=false; toast("Your shield sparkled away a hit!"); } else { const armor=(P.armorItem?P.armorItem.armor:0)+(now<armorBuffUntil?6:0); P.hp-=Math.max(1, e.dmg-armor*0.35); burst(P.pos.x,P.pos.y+4,P.pos.z,0xff9e9e,8); updateHUD(); if(P.hp<=0){ P.hp=P.hpMax; P.mana=P.manaMax; P.pos.set(0,0,90); toast("You poofed into stars and woke up safe in Valebrook. No harm done!"); } } }
  }
  // Spell projectiles: travel, trail, impact
  for(const pr of [...projectiles]){
    if(!pr.target || !enemies.includes(pr.target) && pr.target!==boss){ scene.remove(pr.mesh); projectiles=projectiles.filter(x=>x!==pr); continue; }
    const tp=pr.target.mesh.position; const dest=new THREE.Vector3(tp.x, tp.y+3, tp.z);
    const dir=dest.clone().sub(pr.mesh.position); const distLeft=dir.length();
    if(distLeft<2.6){ ringFX(dest.x, dest.y-1.5, dest.z, pr.fx.color, 4.2, 0.5); burst(dest.x,dest.y,dest.z, pr.fx.color, 12); hitEnemy(pr.target, pr.dmg); scene.remove(pr.mesh); projectiles=projectiles.filter(x=>x!==pr); continue; }
    dir.normalize(); pr.mesh.position.addScaledVector(dir, pr.speed*dt);
    pr.mesh.rotation.x+=dt*7; pr.mesh.rotation.z+=dt*5; pr.mesh.lookAt(dest);
    pr.trailCd-=dt; if(pr.trailCd<=0){ pr.trailCd=0.03; const tr=new THREE.Mesh(new THREE.SphereGeometry(0.22,8,6), new THREE.MeshStandardMaterial({color:pr.fx.color, emissive:pr.fx.color, emissiveIntensity:1.2, transparent:true, opacity:0.7}));
      tr.position.copy(pr.mesh.position); scene.add(tr); fxList.push({mesh:tr, life:0.32, max:0.32, kind:"fade"}); }
  }
  // Generic FX lifecycle
  for(const fxo of [...fxList]){ fxo.life-=dt; const t=Math.max(0,fxo.life/fxo.max);
    if(fxo.kind==="ring"){ const rr=1+(1-t)*fxo.maxR; fxo.mesh.scale.set(rr,rr,1); fxo.mesh.material.opacity=t; }
    else if(fxo.kind==="fade"){ fxo.mesh.material.opacity=t; }
    else if(fxo.kind==="rise"){ fxo.mesh.position.y+=dt*3.2; if(fxo.follow){ fxo.mesh.position.x=P.pos.x; fxo.mesh.position.z=P.pos.z; } fxo.mesh.material.opacity=t; fxo.mesh.rotation.z+=dt*2; }
    else if(fxo.kind==="fall"){ fxo.mesh.position.y-=dt*26; fxo.mesh.rotation.x+=dt*6; }
    else if(fxo.kind==="spin"){ fxo.mesh.rotation.y+=dt*7; fxo.mesh.rotation.x+=dt*3; if(fxo.follow){} fxo.mesh.material.transparent=true; fxo.mesh.material.opacity=Math.min(1,t+0.2); }
    if(fxo.life<=0){ scene.remove(fxo.mesh); fxList=fxList.filter(x=>x!==fxo); } }
  // particles (accent only now)
  for(const p of [...particles]){ p.userData.life-=dt; const arr=p.geometry.attributes.position; const v=p.userData.vel; for(let i=0;i<v.length;i++){ arr.setXYZ(i, arr.getX(i)+v[i].x*dt, arr.getY(i)+v[i].y*dt, arr.getZ(i)+v[i].z*dt); v[i].y-=12*dt; } arr.needsUpdate=true; p.material.opacity=p.userData.life; if(p.userData.life<=0){ scene.remove(p); particles=particles.filter(x=>x!==p); } }
  P.mana=Math.min(P.manaMax, P.mana+dt*2.2); P.hp=Math.min(P.hpMax, P.hp+dt*0.5);
  if(Math.floor(now/500)!==Math.floor((now-dt*1000)/500)) updateHUD();
  findNear();
  previewTick(dt);
  renderer.render(scene,camera);
}
setInterval(saveGame, 15000);
