// AETHERIA v2 — main game. Three.js (universal WebGL).
// v2: textured world, full articulated characters with walk animation,
// unique model per item, unique visual per spell, collision, real sprint.
import * as THREE from "three";
import { CLASSES, WEAPONS, ARMOR, SPELLS, SPELL_BY_NAME, ENEMIES, VILLAGES, MAIN_QUESTS, NPC_NAMES, NPC_LINES,
  RARITIES, MODIFIERS, rollRarity, proceduralWeapon, proceduralArmor, makeSideQuest } from "./data.js";
import { buildWorld, terrainHeight, collide, addTaggedCollider, removeTaggedColliders, biomeAt, WORLD_SIZE } from "./world.js";
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
let lastCastAt=0, lastXpAt=0, lastCombatAt=0, lastTarget=null, lastTargetAt=0;
const explored=new Set(); let mapDirty=true;
const remotes=new Map(); let room=null;

function labelSprite(text, color="#fff"){
  const cv=document.createElement("canvas"); cv.width=1024; cv.height=144; const g=cv.getContext("2d");
  let fs=62; g.textAlign="center";
  do{ g.font=`bold ${fs}px system-ui`; fs-=4; }while(g.measureText(text).width>980 && fs>20);
  g.shadowColor="#000"; g.shadowBlur=10; g.fillStyle=color; g.fillText(text,512,88);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv), transparent:true, depthTest:false}));
  sp.scale.set(13.5,1.9,1); return sp;
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
  const m=makeItemModel(item); m.scale.setScalar(0.85);
  // Per-shape CARRY POSE in the fist (mount sits on the arm at the hand):
  //  blade/hammer/wand point forward from the fist, so a swing sweeps through foes;
  //  a staff is gripped mid-shaft and carried upright; a bow is turned so its
  //  nocked arrow faces forward; a lute hangs at the hand ready to strum.
  const shape=item.shape||"wand";
  if(shape==="staff"){ m.position.y=-1.7; }
  else if(shape==="bow"){ m.rotation.y=-Math.PI/2; }
  else if(shape==="lute"){ m.position.y=-0.6; }
  else { m.rotation.x=Math.PI/2; }
  rig.weaponMount.add(m);
}
let atkAnimStart=0, castAnimStart=0;
function animateRig(rig, speedNorm, dt, running=false){
  rig.phase += dt*(4+speedNorm*9);
  const sw=Math.sin(rig.phase)*(running?0.95:0.62)*Math.min(1,speedNorm+0.15);
  if(speedNorm>0.03){ rig.legL.rotation.x=sw; rig.legR.rotation.x=-sw; rig.armL.rotation.x=-sw*0.8; rig.armR.rotation.x=sw*0.7-0.35; }
  else { rig.legL.rotation.x*=0.8; rig.legR.rotation.x*=0.8; rig.armL.rotation.x*=0.8; rig.armR.rotation.x=-0.35+Math.sin(performance.now()*0.0015)*0.05; }
  if(rig===playerRig){
    const nowMs=performance.now();
    if(atkAnimStart){ const t=nowMs-atkAnimStart; // wind up BACK, then swing FORWARD through the target
      if(t<80) rig.armR.rotation.x=0.85*(t/80)-0.35;
      else if(t<210) rig.armR.rotation.x=0.5 - 2.5*((t-80)/130);
      else if(t<340) rig.armR.rotation.x=-2.0 + 1.65*((t-210)/130);
      else atkAnimStart=0;
      if(atkAnimStart) return;
    }
    if(castAnimStart){ const t=nowMs-castAnimStart; // raise the weapon hand toward the target and pulse
      if(t<320){ rig.armR.rotation.x=-1.55+Math.sin(t/320*Math.PI)*0.25; return; }
      castAnimStart=0;
    }
    if(slamStart){ const t=nowMs-slamStart; // wind high overhead, then slam down hard
      if(t<170){ rig.armR.rotation.x=1.1*(t/170)-0.35; return; }
      if(t<300){ rig.armR.rotation.x=0.75-3.1*((t-170)/130); return; }
      slamStart=0;
    }
  }
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
  P.inventory.push(item); toast(`Found: ${item.name} [${item.rarity}]`, RARITIES[item.rarity]?.color); renderInventory(); return item;
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
  preview.renderer=new THREE.WebGLRenderer({antialias:true, alpha:true, preserveDrawingBuffer:true});
  preview.renderer.setSize(230,230); preview.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  preview.scene=new THREE.Scene();
  preview.camera=new THREE.PerspectiveCamera(40,1,0.1,100); preview.camera.position.set(3.4,3.2,6.4); preview.camera.lookAt(0,1.8,0);
  preview.scene.add(new THREE.HemisphereLight(0xffffff,0x445566,1.2));
  const dl=new THREE.DirectionalLight(0xfff2cc,1.6); dl.position.set(4,7,5); preview.scene.add(dl);
  preview.holder=new THREE.Group(); preview.scene.add(preview.holder);
  preview.canvas=preview.renderer.domElement; preview.canvas.style.display="block"; preview.canvas.style.margin="0 auto";
}
function itemAttrHTML(it, price){
  const ab=it.kind==="weapon"? weaponAbilityFor(it):null;
  return `<b style="color:${RARITIES[it.rarity]?.color||'#fff'}">${it.name}</b> <small>[${it.rarity}]</small><br>`+
    `${it.kind==="weapon"? `Type: ${it.type} · <b>Power ${it.power}</b>` : `Slot: ${it.slot} · <b>Armour ${it.armor}</b>`}`+
    `${ab? `<br>${ab.icon} <b>Ability: ${ab.name}</b> — <small>${ab.desc} (press Q)</small>`:""}`+
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
  // caster types have a real mana pool and cast sparkle bolts at you
  if(isBoss || et.type==="Wizard's Lantern" || et.type==="Tower Sentinel"){ e.mana=100; e.manaMax=100; e.castCd=rand(1,3); }
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
  toast(`Quest complete: ${q.title}  +${q.xp} XP, +${q.gold} gold`, "#ffd700");
  if(Math.random()<0.5) randomLoot();
  // quests often reward a Spell Page — learn it from your Spellbook (B)
  if(Math.random()<0.45){ const unlearned=SPELLS.map(s=>s.name).filter(n=>!P.spells.includes(n) && !P.inventory.some(i=>i.kind==="spellpage"&&i.spell===n));
    if(unlearned.length){ const sn=unlearned[Math.floor(Math.random()*unlearned.length)]; const page={name:"Spell Page: "+sn, kind:"spellpage", spell:sn, rarity:"Quest", desc:"A page torn from a friendly grimoire. Learn it in your Spellbook (press B).", uid:uid++};
      P.inventory.push(page); toast("Quest reward: "+page.name+" — open your Spellbook (B) to learn it!", "#ffd700"); } }
  if(q===currentMain()){ P.mainIdx++; if(q.id==="m14") showEnd(); }
  P.side=P.side.filter(s=>!s.done); renderQuests(); saveGame();
}
function gainXP(n){ P.xp+=n; lastXpAt=Date.now(); while(P.xp>=P.xpNext){ P.xp-=P.xpNext; P.level++; P.xpNext=xpForLevel(P.level); P.hpMax+=14+Math.round(P.level*1.5); P.manaMax+=7; P.hp=P.hpMax; P.mana=P.manaMax; P.baseDmg+=2; toast(`⭐ Level ${P.level}! HP and power up.`); learnLevelSpells(); } updateHUD(); }
function learnLevelSpells(){ const want={3:"River Rush",5:"Star Shower",7:"Sun Ray",9:"Crystal Shards",11:"Moonbeam",13:"Great Mend",16:"Comet Trail",19:"Aurora Wave",22:"Worldtree Blessing"}; const s=want[P.level]; if(s&&!P.spells.includes(s)){ P.spells.push(s); toast("New spell learned: "+s); } }

// ---------- Combat & spells (each spell = its own model & behaviour) ----------
function nearestEnemy(maxD){ let best=null,bd=maxD; for(const e of enemies){ const d=Math.hypot(e.x-P.pos.x,e.z-P.pos.z); if(d<bd){bd=d;best=e;} } if(boss && Math.hypot(boss.x-P.pos.x,boss.z-P.pos.z)<maxD) best=boss; return best; }
function attack(){
  if(atkCd>0||!started) return; atkCd=0.45; atkAnimStart=performance.now();
  const dmg=P.baseDmg + (P.weapon?P.weapon.power:0);
  const best=nearestEnemy(7);
  // slash arc directly in front of where the CHARACTER faces (was keyed to camera yaw — looked backwards)
  const ry=playerMesh.rotation.y, fx=Math.sin(ry), fz=Math.cos(ry);
  const arc=new THREE.Mesh(new THREE.TorusGeometry(3.4,0.22,8,24,Math.PI*0.9), new THREE.MeshStandardMaterial({color:P.weapon?P.weapon.color:0xffe27a, emissive:P.weapon?P.weapon.color:0xffe27a, emissiveIntensity:1.3, transparent:true}));
  arc.position.set(P.pos.x+fx*2.6, P.pos.y+4, P.pos.z+fz*2.6); arc.rotation.set(0.25, ry, -0.5); scene.add(arc);
  fxList.push({mesh:arc, life:0.22, max:0.22, kind:"fade"});
  if(best) setTimeout(()=>{ if(enemies.includes(best)||best===boss) hitEnemy(best, dmg*(Date.now()<dmgBuffUntil?1.3:1)); },120);
}
function hitEnemy(e, dmg){
  e.hp-=dmg; lastTarget=e; lastTargetAt=Date.now(); lastCombatAt=Date.now();
  burst(e.mesh.position.x, e.mesh.position.y+3, e.mesh.position.z, 0xffe27a, 8);
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
  castAnimStart=performance.now(); lastCastAt=Date.now();
  const ry=playerMesh?playerMesh.rotation.y:0, fwd=new THREE.Vector3(Math.sin(ry),0,Math.cos(ry));
  if(fx.mode==="projectile"){
    P.mana-=s.cost;
    const mesh=makeSpellProjectile(fx);
    mesh.position.set(P.pos.x+fwd.x*1.5, P.pos.y+4.6, P.pos.z+fwd.z*1.5); scene.add(mesh);
    // targeted if a foe is near, otherwise it flies straight where you face — either way you SEE the spell
    projectiles.push({mesh, target:target||null, dir:target?null:fwd.clone(), speed:fx.speed||60, dmg, fx, trailCd:0, travelled:0});
  } else if(fx.mode==="beam"){
    P.mana-=s.cost;
    const from=new THREE.Vector3(P.pos.x, P.pos.y+4.8, P.pos.z);
    const to= target? new THREE.Vector3(target.mesh.position.x, target.mesh.position.y+3, target.mesh.position.z)
                     : from.clone().addScaledVector(fwd, 26).add(new THREE.Vector3(0,0.5,0));
    const len=from.distanceTo(to);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.55,len,12,1,true), new THREE.MeshStandardMaterial({color:fx.color, emissive:fx.color, emissiveIntensity:2, transparent:true, opacity:0.9}));
    beam.position.copy(from).lerp(to,0.5); beam.lookAt(to); beam.rotateX(Math.PI/2); scene.add(beam);
    const core=makeSpellProjectile({geo:"orb", color:fx.color, size:0.9}); core.position.copy(to); scene.add(core);
    fxList.push({mesh:beam, life:0.38, max:0.38, kind:"fade"}); fxList.push({mesh:core, life:0.3, max:0.3, kind:"fade"});
    if(target) hitEnemy(target, dmg);
    else [...enemies].forEach(e=>{ if(Math.hypot(e.x-to.x, e.z-to.z)<4.5) hitEnemy(e, dmg); });
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

function damagePlayer(raw){
  lastCombatAt=Date.now();
  if(shieldUp){ shieldUp=false; toast("Your shield sparkled away a hit!"); return; }
  const armor=(P.armorItem?P.armorItem.armor:0)+(Date.now()<armorBuffUntil?6:0);
  P.hp-=Math.max(1, raw-armor*0.35);
  burst(P.pos.x,P.pos.y+4,P.pos.z,0xff9e9e,8); updateHUD();
  if(P.hp<=0){ P.hp=P.hpMax; P.mana=P.manaMax; P.pos.set(0,0,90); toast("You poofed into stars and woke up safe in Valebrook. No harm done!"); }
}
// ---------- Weapon abilities: your weapon grants an ability by what it IS ----------
// A blade spins, a hammer slams, a bow volleys — and a staff/wand casts the
// element in its name (an Ocean Staff really does shoot waves).
let abilityCdUntil=0, spinStart=0, spinBaseRy=0, slamStart=0;
function weaponAbilityFor(item){
  if(!item||item.kind!=="weapon") return null;
  const n=(item.name||"").toLowerCase(); const shape=item.shape||"wand";
  if(shape==="blade") return {id:"spin", icon:"🌀", name:"Whirlwind Spin", desc:"Spin in a full circle, hitting every foe around you for 160% weapon damage."};
  if(shape==="hammer") return {id:"slam", icon:"💥", name:"Star Slam", desc:"Slam the ground: a shockwave hits every foe within 8 for 200% weapon damage."};
  if(shape==="bow") return {id:"volley", icon:"🏹", name:"Triple Volley", desc:"Loose three arrows in a fan, each for 90% weapon damage."};
  if(shape==="lute") return {id:"song", icon:"🎵", name:"Healing Song", desc:"Strum a chord that restores 30% of your HP in a swirl of notes."};
  if(/ocean|water|river|wave|tide|sea/.test(n)) return {id:"wave", icon:"🌊", name:"Wave Surge", desc:"Send a rolling wave crashing forward — it pierces through every foe in its path for 180% damage."};
  if(/frost|ice|snow|crystal|winter/.test(n)) return {id:"shards", icon:"❄️", name:"Crystal Volley", desc:"Fan five frost shards forward, each for 70% weapon damage."};
  if(/ember|fire|sun|flame|solar/.test(n)) return {id:"fireball", icon:"☄️", name:"Comet Blast", desc:"Hurl a comet that explodes on impact for 220% damage plus splash."};
  if(/leaf|bloom|forest|wood|thorn|vine|tree|season|meadow/.test(n)) return {id:"leafstorm", icon:"🍃", name:"Leaf Storm", desc:"A whirl of sharp petals strikes every foe within 8 for 130% damage."};
  if(/moon|star|night|comet/.test(n)) return {id:"starfall", icon:"⭐", name:"Starfall", desc:"Call five stars down onto the nearest foes for 110% damage each."};
  return {id:"bolt", icon:"✨", name:"Spark Volley", desc:"Three spark bolts streak where you face, each for 80% weapon damage."};
}
function abilityDamage(mult){ return (P.baseDmg+(P.weapon?P.weapon.power:0))*mult; }
function useAbility(){
  const ab=weaponAbilityFor(P.weapon); if(!ab||!started) return;
  if(Date.now()<abilityCdUntil){ toast("Ability recharging… "+Math.ceil((abilityCdUntil-Date.now())/1000)+"s"); return; }
  if(P.mana<15){ toast("Not enough mana for "+ab.name+" (needs 15)"); return; }
  P.mana-=15; abilityCdUntil=Date.now()+6000; lastCastAt=Date.now();
  const ry=playerMesh.rotation.y, fwd=new THREE.Vector3(Math.sin(ry),0,Math.cos(ry));
  const spawnY=P.pos.y+4.4;
  const fireDir=(dir, fx, dmg, opts={})=>{ const mesh=makeSpellProjectile(fx); mesh.position.set(P.pos.x+dir.x*1.6, spawnY, P.pos.z+dir.z*1.6); scene.add(mesh);
    projectiles.push({mesh, target:null, dir:dir.clone(), speed:opts.speed||55, dmg, fx, trailCd:0, travelled:0, pierce:!!opts.pierce, splash:opts.splash||0, hitSet:new Set()}); };
  if(ab.id==="spin"){ spinStart=performance.now(); spinBaseRy=ry;
    ringFX(P.pos.x, P.pos.y+1.2, P.pos.z, P.weapon.color||0xffe27a, 7, 0.5);
    setTimeout(()=>{ [...enemies].forEach(e=>{ if(Math.hypot(e.x-P.pos.x,e.z-P.pos.z)<7) hitEnemy(e, abilityDamage(1.6)); }); if(boss&&Math.hypot(boss.x-P.pos.x,boss.z-P.pos.z)<7.5) hitEnemy(boss, abilityDamage(1.6)); },200);
  } else if(ab.id==="slam"){ slamStart=performance.now();
    setTimeout(()=>{ ringFX(P.pos.x, P.pos.y+0.7, P.pos.z, 0xd8c2a0, 9, 0.6); burst(P.pos.x,P.pos.y+1,P.pos.z,0xc9b18a,26);
      [...enemies].forEach(e=>{ if(Math.hypot(e.x-P.pos.x,e.z-P.pos.z)<8.5) hitEnemy(e, abilityDamage(2.0)); }); if(boss&&Math.hypot(boss.x-P.pos.x,boss.z-P.pos.z)<9) hitEnemy(boss, abilityDamage(2.0)); },280);
  } else if(ab.id==="volley"){ castAnimStart=performance.now();
    for(const off of [-0.18,0,0.18]){ const d=fwd.clone(); const cs=Math.cos(off), sn=Math.sin(off); fireDir(new THREE.Vector3(d.x*cs-d.z*sn,0,d.x*sn+d.z*cs), {geo:"shard", color:0xd8c9a3, size:0.55}, abilityDamage(0.9), {speed:75}); }
  } else if(ab.id==="wave"){ castAnimStart=performance.now(); fireDir(fwd, {geo:"wave", color:0x58c6ff, size:1.7}, abilityDamage(1.8), {speed:38, pierce:true});
  } else if(ab.id==="shards"){ castAnimStart=performance.now();
    for(const off of [-0.3,-0.15,0,0.15,0.3]){ const d=fwd.clone(); const cs=Math.cos(off), sn=Math.sin(off); fireDir(new THREE.Vector3(d.x*cs-d.z*sn,0,d.x*sn+d.z*cs), {geo:"shard", color:0xaee9ff, size:0.8}, abilityDamage(0.7), {speed:62}); }
  } else if(ab.id==="fireball"){ castAnimStart=performance.now(); fireDir(fwd, {geo:"comet", color:0xffa657, size:1.35}, abilityDamage(2.2), {speed:60, splash:5});
  } else if(ab.id==="leafstorm"){ castAnimStart=performance.now(); ringFX(P.pos.x,P.pos.y+1.5,P.pos.z,0x7ee787,8.5,0.6); burst(P.pos.x,P.pos.y+4,P.pos.z,0x7ee787,30);
    [...enemies].forEach(e=>{ if(Math.hypot(e.x-P.pos.x,e.z-P.pos.z)<8.5) hitEnemy(e, abilityDamage(1.3)); }); if(boss&&Math.hypot(boss.x-P.pos.x,boss.z-P.pos.z)<9) hitEnemy(boss, abilityDamage(1.3));
  } else if(ab.id==="starfall"){ castAnimStart=performance.now();
    const foes=[...enemies].sort((a,b)=>Math.hypot(a.x-P.pos.x,a.z-P.pos.z)-Math.hypot(b.x-P.pos.x,b.z-P.pos.z)).slice(0,5);
    if(boss) foes.push(boss);
    if(!foes.length){ toast("No foes near enough for Starfall — the stars fade."); abilityCdUntil=Date.now()+1500; }
    foes.forEach((e,i)=>{ setTimeout(()=>{ if(enemies.includes(e)||e===boss){ ringFX(e.x, e.mesh.position.y+0.5, e.z, 0xffe27a, 3.6, 0.45); burst(e.x, e.mesh.position.y+6, e.z, 0xffe27a, 14); hitEnemy(e, abilityDamage(1.1)); } }, 200+i*140); });
  } else if(ab.id==="song"){ castAnimStart=performance.now(); const heal=P.hpMax*0.3; P.hp=Math.min(P.hpMax,P.hp+heal);
    ringFX(P.pos.x,P.pos.y+1.2,P.pos.z,0xff9ecb,6,0.7); burst(P.pos.x,P.pos.y+4.5,P.pos.z,0xff9ecb,22); toast("🎵 Healing Song restored "+Math.round(heal)+" HP"); updateHUD();
  } else { castAnimStart=performance.now();
    for(const off of [-0.12,0,0.12]){ const d=fwd.clone(); const cs=Math.cos(off), sn=Math.sin(off); fireDir(new THREE.Vector3(d.x*cs-d.z*sn,0,d.x*sn+d.z*cs), {geo:"star", color:P.weapon.color||0xffe27a, size:0.7}, abilityDamage(0.8), {speed:70}); } }
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
function toast(t, color){ const el=document.createElement("div"); el.className="toast"; el.textContent=t; if(color) el.style.borderColor=color; $("toasts").appendChild(el); setTimeout(()=>el.remove(),4200); }
function showDialogue(name, text){ $("dlgName").textContent=name; $("dlgText").textContent=text; $("dialogue").style.display="block"; }
$("dlgClose").onclick=()=>$("dialogue").style.display="none";
function updateHUD(){
  $("hpBar").style.width=(P.hp/P.hpMax*100)+"%"; $("hpText").textContent=`HP ${Math.ceil(P.hp)}/${P.hpMax}`;
  $("manaBar").style.width=(P.mana/P.manaMax*100)+"%"; $("manaText").textContent=`Mana ${Math.ceil(P.mana)}/${P.manaMax}`;
  $("xpBar").style.width=(P.xp/P.xpNext*100)+"%"; $("xpText").textContent=`Level ${P.level} · XP ${Math.floor(P.xp)}/${P.xpNext}`;
  $("goldText").textContent="🪙 "+P.gold; $("lvlBadge").textContent=P.level;
  $("spellBar").innerHTML=P.spells.slice(0,6).map((s,i)=>`<button class="spellBtn" data-s="${s}">${i+1} ${s}</button>`).join("");
  document.querySelectorAll(".spellBtn").forEach(b=>b.onclick=()=>castSpell(b.dataset.s));
  $("equipLine").innerHTML=`⚔ <span style="color:${P.weapon?RARITIES[P.weapon.rarity]?.color:'#fff'}">${P.weapon?P.weapon.name:"Bare hands"}</span>${P.armorItem?` · 🛡 <span style="color:${RARITIES[P.armorItem.rarity]?.color}">${P.armorItem.name}</span>`:""}`;
  const ab=weaponAbilityFor(P.weapon); const cdLeft=Math.max(0,Math.ceil((abilityCdUntil-Date.now())/1000));
  $("abilityChip").textContent= ab? `${ab.icon} ${ab.name} — ${cdLeft>0? "⏳ "+cdLeft+"s":"Q / tap Ability"}` : "";
  $("abilityChip").style.display= ab? "block":"none";
}
function renderQuests(){
  const mq=currentMain();
  $("questTracker").innerHTML = mq? `<b>📜 ${mq.title}</b><br><small>${mq.text}</small>` : "<b>📜 Story complete!</b>";
  $("questList").innerHTML = (mq? `<div class="q"><b>${mq.title}</b> (Lv ${mq.lvl})<br>${mq.text}<br><i>Reward ${mq.xp} XP · ${mq.gold} gold</i></div>`:"") +
    P.side.map(q=>`<div class="q"><b>${q.title}</b><br>${q.text}<br><i>Reward ${q.xp} XP · ${q.gold} gold</i></div>`).join("");
}
// Item icons: snapshot each item's own 3D model once, cache it.
const iconCache=new Map();
function itemIcon(it){
  const key=it.uid||it.name; if(iconCache.has(key)) return iconCache.get(key);
  if(!preview.renderer) initPreview();
  preview.holder.rotation.set(0,0.6,0);
  while(preview.holder.children.length) preview.holder.remove(preview.holder.children[0]);
  const m=makeItemModel(it); const box=new THREE.Box3().setFromObject(m); const c=box.getCenter(new THREE.Vector3()); const sz=box.getSize(new THREE.Vector3()).length();
  m.position.sub(c); m.position.y+=1.8; preview.holder.add(m);
  preview.camera.position.set(0,2.2,Math.max(4.5, sz*1.15)); preview.camera.lookAt(0,1.8,0);
  preview.renderer.render(preview.scene, preview.camera);
  const url=preview.renderer.domElement.toDataURL(); iconCache.set(key,url); preview.active=false;
  return url;
}
let selInvUid=null;
function renderInventory(){
  $("invStats").innerHTML=`<b>${P.name}</b> — ${P.cls?P.cls.name:""} · Level ${P.level} · 🪙 ${P.gold} &nbsp;|&nbsp; Weapon: <b style="color:${P.weapon?RARITIES[P.weapon.rarity]?.color:'#fff'}">${P.weapon?P.weapon.name:"none"}</b> · Armour: <b style="color:${P.armorItem?RARITIES[P.armorItem.rarity]?.color:'#fff'}">${P.armorItem?P.armorItem.name:"none"}</b>`;
  let html=`<div class="slot book" id="bookSlot"><div class="slotIcon">📖</div><div class="slotName">Spellbook</div><div class="slotSub">Press B</div></div>`;
  html+=P.inventory.map(it=>{
    if(it.kind==="spellpage") return `<div class="slot" data-slot="${it.uid}" style="border-color:#ffd700"><div class="slotIcon">📜</div><div class="slotName">${it.spell}</div><div class="slotSub" style="color:#ffd700">Spell Page</div></div>`;
    const equipped=(P.weapon===it||P.armorItem===it);
    return `<div class="slot ${equipped?"equipped":""}" data-slot="${it.uid}" style="border-color:${RARITIES[it.rarity]?.color||'#888'}; box-shadow:0 0 10px ${(RARITIES[it.rarity]?.color||'#888')}55 inset"><img class="slotIcon" src="${itemIcon(it)}" alt=""><div class="slotName">${it.name}</div><div class="slotSub" style="color:${RARITIES[it.rarity]?.color}">${it.rarity}${equipped?" · EQUIPPED":""}</div></div>`;
  }).join("");
  $("invGrid").innerHTML=html || "<p>No loot yet — open camp chests!</p>";
  $("bookSlot").onclick=()=>openSpellbook();
  document.querySelectorAll("[data-slot]").forEach(el=>el.onclick=()=>{ selInvUid=+el.dataset.slot; renderInvDetail(); document.querySelectorAll(".slot").forEach(s=>s.classList.remove("sel")); el.classList.add("sel"); });
  renderInvDetail();
}
function renderInvDetail(){
  const it=P.inventory.find(x=>x.uid===selInvUid); const box=$("invPreview");
  if(!it){ box.innerHTML="<p style='text-align:center'><small>Tap an item slot to see its model, stats and actions.</small></p>"; preview.active=false; return; }
  if(it.kind==="spellpage"){ box.innerHTML=`<div style="text-align:center"><div style="font-size:44px">📜</div>${itemAttrHTML(it)}<br><button id="learnBtn">✨ Learn ${it.spell} (in Spellbook)</button></div>`;
    $("learnBtn").onclick=()=>learnSpell(it); return; }
  showPreview(box, it);
  const acts=document.createElement("div"); acts.style.textAlign="center"; acts.style.marginTop="6px";
  const equipped=(P.weapon===it||P.armorItem===it);
  acts.innerHTML=`<button id="eqBtn">${equipped?"Equipped ✓":"Equip"}</button> <button id="sellBtn">Sell ${Math.round((it.power||it.armor||5)*2)}g</button>`;
  box.appendChild(acts);
  $("eqBtn").onclick=()=>{ if(it.kind==="weapon"){ P.weapon=it; if(playerRig) attachWeapon(playerRig, it); } else if(it.kind==="armor") P.armorItem=it; toast("Equipped "+it.name, RARITIES[it.rarity]?.color); renderInventory(); updateHUD(); };
  $("sellBtn").onclick=()=>{ const i=P.inventory.findIndex(x=>x.uid===it.uid); if(i>=0){ P.gold+=Math.round((it.power||it.armor||5)*2); if(P.weapon===it)P.weapon=null; if(P.armorItem===it)P.armorItem=null; P.inventory.splice(i,1); selInvUid=null; renderInventory(); updateHUD(); } };
}
// ---------- Spellbook ----------
const SCHOOL_ICON={Spark:"✨",Frost:"❄️",Leaf:"🌿",Light:"💛",Wind:"🌬️",Stone:"🪨",Water:"💧",Song:"🎵"};
function openSpellbook(){ renderSpellbook(); $("spellbook").style.display="block"; }
function learnSpell(page){
  if(!P.spells.includes(page.spell)) P.spells.push(page.spell);
  P.inventory=P.inventory.filter(x=>x!==page); selInvUid=null;
  toast("Spell learned: "+page.spell+"!", "#ffd700"); renderSpellbook(); renderInventory(); updateHUD();
}
function renderSpellbook(){
  const pages=P.inventory.filter(i=>i.kind==="spellpage");
  $("bookBody").innerHTML=
    `<h4>Your spells — the first 6 are on your hotbar (keys 1–6)</h4><div class="spellGrid">`+
    P.spells.map((n,i)=>{ const s=SPELL_BY_NAME[n]; if(!s) return ""; const fx=SPELL_FX[n]||{};
      return `<div class="spellCard" style="border-color:#${(fx.color||0xffe27a).toString(16).padStart(6,"0")}"><div class="spellIco">${SCHOOL_ICON[s.school]||"✨"}</div><b>${n}</b> ${i<6?`<span class="hotkey">${i+1}</span>`:`<button data-front="${n}">Put on hotbar</button>`}<br><small>${s.school} · Mana ${s.cost}${s.power?` · Power ${s.power}`:""}<br>${s.desc}</small></div>`; }).join("")+
    `</div><h4>Spell Pages — learn new spells you earned from quests</h4>`+
    (pages.length? pages.map(p=>`<div class="q">📜 <b>${p.spell}</b> — ${SPELL_BY_NAME[p.spell]?.desc||""} <button data-learn="${p.uid}">Learn</button></div>`).join("") : "<p><small>No spell pages yet — completing quests often rewards one.</small></p>")+
    `<h4>⌨️ Keybinds</h4><p class="keys">WASD move · <b>Shift</b> sprint · <b>Mouse click / Space</b> attack · <b>Q</b> weapon ability · <b>E</b> talk / open / use · <b>1–6</b> cast hotbar spell · <b>I</b> inventory · <b>B</b> spellbook · <b>M</b> world map · <b>\`</b> dev mode · <b>Esc</b> close panels · Drag mouse to look, wheel to zoom</p>`;
  document.querySelectorAll("[data-learn]").forEach(b=>b.onclick=()=>{ const p=P.inventory.find(x=>x.uid==b.dataset.learn); if(p) learnSpell(p); });
  document.querySelectorAll("[data-front]").forEach(b=>b.onclick=()=>{ const n=b.dataset.front; P.spells=P.spells.filter(x=>x!==n); P.spells.unshift(n); renderSpellbook(); updateHUD(); });
}
$("bookClose").onclick=()=>$("spellbook").style.display="none";
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

// ---------- Explored map ----------
const CELL=50, GRIDN=Math.floor(WORLD_SIZE/CELL); // 48x48 cells
function cellKey(cx,cz){ return cx+","+cz; }
function markExplored(){
  const pcx=Math.floor((P.pos.x+WORLD_SIZE/2)/CELL), pcz=Math.floor((P.pos.z+WORLD_SIZE/2)/CELL);
  for(let dx=-2;dx<=2;dx++) for(let dz=-2;dz<=2;dz++){ const cx=pcx+dx, cz=pcz+dz; if(cx<0||cz<0||cx>=GRIDN||cz>=GRIDN) continue;
    if(Math.hypot(dx,dz)<=2.2){ const k=cellKey(cx,cz); if(!explored.has(k)){ explored.add(k); mapDirty=true; } } }
}
function cellColor(cx,cz){
  const wx=(cx+0.5)*CELL-WORLD_SIZE/2, wz=(cz+0.5)*CELL-WORLD_SIZE/2; const h=terrainHeight(wx,wz); const b=biomeAt(wx,wz,h);
  if(h<2.2) return "#3f7fbf"; if(h>34) return "#ffffff"; if(h>22) return "#9aa0a8"; if(h>13) return "#c9d689";
  return b==="snow"?"#eaf4ff": b==="autumn"?"#d8a34e": b==="blossom"?"#a8d88a": "#7cc46a";
}
function drawMap(cv, cx0, cz0, cells, cellPx, playerAngle){
  const g=cv.getContext("2d"); g.fillStyle="#0a0f1e"; g.fillRect(0,0,cv.width,cv.height);
  for(let cz=cz0;cz<cz0+cells;cz++) for(let cx=cx0;cx<cx0+cells;cx++){
    if(cx<0||cz<0||cx>=GRIDN||cz>=GRIDN) continue; if(!explored.has(cellKey(cx,cz))) continue;
    g.fillStyle=cellColor(cx,cz); g.fillRect((cx-cx0)*cellPx,(cz-cz0)*cellPx,cellPx+1,cellPx+1);
  }
  g.font=`${Math.max(11,cellPx*1.5)}px system-ui`; g.textAlign="center";
  for(const v of (world?.villages||[])){ const cx=Math.floor((v.x+WORLD_SIZE/2)/CELL), cz=Math.floor((v.z+WORLD_SIZE/2)/CELL);
    if(explored.has(cellKey(cx,cz))){ g.fillText("🏠",(cx-cx0+0.5)*cellPx,(cz-cz0+0.6)*cellPx); if(cellPx>8){ g.fillStyle="#fff"; g.font="bold 12px system-ui"; g.fillText(v.name,(cx-cx0+0.5)*cellPx,(cz-cz0)*cellPx-4); g.font=`${Math.max(11,cellPx*1.5)}px system-ui`; } } }
  if(world?.towerPos){ const cx=Math.floor((world.towerPos.x+WORLD_SIZE/2)/CELL), cz=Math.floor((world.towerPos.z+WORLD_SIZE/2)/CELL);
    if(explored.has(cellKey(cx,cz))) g.fillText("🗼",(cx-cx0+0.5)*cellPx,(cz-cz0+0.6)*cellPx); }
  const pcx=(P.pos.x+WORLD_SIZE/2)/CELL-cx0, pcz=(P.pos.z+WORLD_SIZE/2)/CELL-cz0;
  g.save(); g.translate(pcx*cellPx,pcz*cellPx); g.rotate(playerAngle||0); g.fillStyle="#fff"; g.strokeStyle="#173";
  g.beginPath(); g.moveTo(0,-cellPx*0.8); g.lineTo(cellPx*0.5,cellPx*0.6); g.lineTo(-cellPx*0.5,cellPx*0.6); g.closePath(); g.fill(); g.stroke(); g.restore();
}
function openMap(){ const cv=$("mapCanvas"); drawMap(cv, 0, 0, GRIDN, cv.width/GRIDN, (playerMesh?playerMesh.rotation.y:0)); $("mapModal").style.display="block"; }
$("mapClose").onclick=()=>$("mapModal").style.display="none";

function saveGame(){ try{ localStorage.setItem("aetheria-save", JSON.stringify({name:P.name, level:P.level, xp:P.xp, gold:P.gold, mainIdx:P.mainIdx, chestsOpened:P.chestsOpened, spells:P.spells, inv:P.inventory, clsId:P.cls?.id, explored:[...explored]})); }catch(e){} }

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
  try{ const sv=JSON.parse(localStorage.getItem("aetheria-save")||"null"); if(sv?.explored) sv.explored.forEach(k=>explored.add(k)); }catch(e){}
  $("creation").style.display="none"; $("hud").style.display="block"; started=true; initThree(); updateHUD(); renderQuests(); renderInventory();
  toast("Welcome to Aetheria, "+P.name+"! WASD walk, hold SHIFT to sprint, drag to look, Space to attack, E to talk.");
};
function initThree(){
  scene=new THREE.Scene();
  { const gc=document.createElement("canvas"); gc.width=2; gc.height=512; const gg=gc.getContext("2d");
    const gr=gg.createLinearGradient(0,0,0,512); gr.addColorStop(0,"#5ea9e6"); gr.addColorStop(0.55,"#a8d4f5"); gr.addColorStop(1,"#e8f6ff"); gg.fillStyle=gr; gg.fillRect(0,0,2,512);
    scene.background=new THREE.CanvasTexture(gc); }
  scene.fog=new THREE.Fog(0xd6ecfa, 260, 1150);
  camera=new THREE.PerspectiveCamera(62, innerWidth/innerHeight, 0.1, 3000);
  renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setSize(innerWidth,innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.12; // soft filmic BOTW-ish light
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
  let downX=0, downY=0, downT=0;
  renderer.domElement.addEventListener("pointerdown",e=>{dragging=true;lx=e.clientX;ly=e.clientY;downX=e.clientX;downY=e.clientY;downT=performance.now();});
  addEventListener("pointerup",e=>{ const wasDrag=dragging; dragging=false;
    if(wasDrag && started && Math.hypot(e.clientX-downX,e.clientY-downY)<6 && performance.now()-downT<300 && e.target===renderer.domElement) attack(); });
  addEventListener("pointermove",e=>{ if(!dragging) return; yaw-=(e.clientX-lx)*0.005; pitch=Math.max(0.08,Math.min(1.2,pitch+(e.clientY-ly)*0.004)); lx=e.clientX; ly=e.clientY; });
  addEventListener("wheel",e=>{ camDist=Math.max(6,Math.min(22,camDist+e.deltaY*0.01)); });
}
// Input
addEventListener("keydown",e=>{ keys[e.key.toLowerCase()]=true;
  if(e.key==="e"||e.key==="E") interact();
  if(e.key==="i"||e.key==="I"||e.key==="Tab"){ e.preventDefault(); const p=$("inventory"); const opening=p.style.display!=="block"; p.style.display=opening?"block":"none"; preview.active=opening; if(opening) renderInventory(); }
  if(e.key===" "){ e.preventDefault(); attack(); }
  if(e.key==="q"||e.key==="Q") useAbility();
  const n=parseInt(e.key); if(n>=1&&n<=6&&P.spells[n-1]) castSpell(P.spells[n-1]);
  if(e.key==="b"||e.key==="B"){ const bk=$("spellbook"); const opening=bk.style.display!=="block"; bk.style.display=opening?"block":"none"; if(opening) renderSpellbook(); }
  if(e.key==="m"||e.key==="M"){ const mp=$("mapModal"); if(mp.style.display==="block") mp.style.display="none"; else openMap(); }
  if(e.key==="Escape"){ for(const id of ["inventory","spellbook","mapModal","panel","dev","dialogue"]) $(id).style.display="none"; preview.active=false; }
  if(e.key==="`") $("dev").style.display=$("dev").style.display==="block"?"none":"block";
});
addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);
$("atkBtn").onclick=attack; $("abilBtn").onclick=()=>useAbility(); $("intBtn").onclick=interact;
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
  if(spinStart){ const t=performance.now()-spinStart; // Whirlwind Spin: one full turn in 0.45s
    if(t<450) playerMesh.rotation.y=spinBaseRy + (t/450)*Math.PI*2; else { playerMesh.rotation.y=spinBaseRy; spinStart=0; } }
  animateRig(playerRig, isMoving? (sprinting?1.35:0.8):0, dt, sprinting&&isMoving);
  // sprint FOV kick so you can FEEL it
  const targetFov=(sprinting&&isMoving)? 73:62;
  if(Math.abs(camera.fov-targetFov)>0.2){ camera.fov+=(targetFov-camera.fov)*Math.min(1,dt*7); camera.updateProjectionMatrix(); }
  const cx=P.pos.x+Math.sin(yaw)*Math.cos(pitch)*camDist, cz=P.pos.z+Math.cos(yaw)*Math.cos(pitch)*camDist, cy=P.pos.y+Math.sin(pitch)*camDist+3;
  camera.position.set(cx, Math.max(cy, terrainHeight(cx,cz)+1.5), cz); camera.lookAt(P.pos.x,P.pos.y+4.8,P.pos.z);
  scene.userData.sun.position.set(P.pos.x+120, P.pos.y+220, P.pos.z+80); scene.userData.sun.target=playerMesh;
  if(world.orb) world.orb.rotation.y+=dt;
  if(world.clouds){ for(const c of world.clouds.children){ c.position.x+=dt*1.6; if(c.position.x>1400) c.position.x=-1400; } }
  if(world.birds){ const t=now*0.001; for(const b of world.birds){ const a=t*b.sp*10+b.ph; b.grp.position.set(b.cx+Math.cos(a)*b.r, b.h+Math.sin(t*0.7+b.ph)*3, b.cz+Math.sin(a)*b.r); b.grp.rotation.y=-a; const flap=Math.sin(t*9+b.ph)*0.65; b.grp.userData.wl.rotation.z=flap; b.grp.userData.wr.rotation.z=-flap; } }
  if(world.flies){ const t=now*0.001; for(const f of world.flies){ const a=t*f.sp+f.ph; f.grp.position.set(f.ax+Math.cos(a)*f.r, f.ay+2.2+Math.sin(t*2.1+f.ph)*0.8, f.az+Math.sin(a)*f.r); f.grp.rotation.y=-a; const flap=Math.sin(t*16+f.ph)*0.85; f.grp.userData.wl.rotation.z=flap; f.grp.userData.wr.rotation.z=-flap; } }
  markExplored();
  const inCombat=Date.now()-lastCombatAt<6000;
  $("hpWrap").classList.toggle("cond", !(P.hp<P.hpMax-0.5||inCombat));
  $("manaWrap").classList.toggle("cond", !(P.mana<P.manaMax-0.5||Date.now()-lastCastAt<4000));
  $("xpWrap").classList.toggle("cond", !(Date.now()-lastXpAt<5000));
  { const abNow=weaponAbilityFor(P.weapon); if(abNow){ const cd=Math.max(0,Math.ceil((abilityCdUntil-Date.now())/1000)); $("abilityChip").textContent=`${abNow.icon} ${abNow.name} — ${cd>0?"⏳ "+cd+"s":"Q / tap Ability"}`; } }
  const tf=$("targetFrame");
  if(lastTarget && (enemies.includes(lastTarget)||lastTarget===boss) && lastTarget.hp>0 && Date.now()-lastTargetAt<7000){
    tf.style.display="block"; $("tfName").textContent=(lastTarget.boss?"👑 ":"")+lastTarget.type;
    $("tfHp").style.width=Math.max(0,lastTarget.hp/lastTarget.hpMax*100)+"%";
    if(lastTarget.mana!==undefined){ $("tfManaRow").style.display="flex"; $("tfMana").style.width=(lastTarget.mana/lastTarget.manaMax*100)+"%"; } else $("tfManaRow").style.display="none";
  } else tf.style.display="none";
  if(!drawMap._mm || performance.now()-drawMap._mm>1000){ drawMap._mm=performance.now(); const cv=$("minimap"); const pcx=Math.floor((P.pos.x+WORLD_SIZE/2)/CELL), pcz=Math.floor((P.pos.z+WORLD_SIZE/2)/CELL);
    drawMap(cv, pcx-6, pcz-6, 12, cv.width/12, playerMesh.rotation.y); }
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
    if(d<3.6 && e.atkCd<=0){ e.atkCd=1.1; lastTarget=e; lastTargetAt=Date.now(); damagePlayer(e.dmg); }
    // casters spend mana to throw sparkle bolts at you
    if(e.mana!==undefined){ e.mana=Math.min(e.manaMax, e.mana+dt*4); e.castCd-=dt;
      if(d<24 && d>5 && e.mana>=25 && e.castCd<=0){ e.mana-=25; e.castCd=3.5;
        const pm=makeSpellProjectile({geo:"orb", color:0xc792ff, size:0.85});
        pm.position.set(e.x, e.mesh.position.y+3.4, e.z); scene.add(pm);
        projectiles.push({mesh:pm, hostile:true, speed:34, dmg:e.dmg*1.25, fx:{color:0xc792ff}, trailCd:0, travelled:0}); } }
  }
  // Spell projectiles: travel, trail, impact (yours home or fly straight; hostile ones fly at you)
  for(const pr of [...projectiles]){
    const kill=()=>{ scene.remove(pr.mesh); projectiles=projectiles.filter(x=>x!==pr); };
    if(pr.hostile){
      const dest=new THREE.Vector3(P.pos.x, P.pos.y+3.6, P.pos.z);
      const dir=dest.clone().sub(pr.mesh.position); const dl=dir.length();
      if(dl<2.4){ burst(P.pos.x,P.pos.y+4,P.pos.z,0xd8b8ff,10); damagePlayer(pr.dmg); kill(); continue; }
      dir.normalize(); pr.mesh.position.addScaledVector(dir, pr.speed*dt); pr.travelled=(pr.travelled||0)+pr.speed*dt;
      if(pr.travelled>90){ kill(); continue; }
    } else if(pr.target){
      if(!enemies.includes(pr.target) && pr.target!==boss){ kill(); continue; }
      const tp=pr.target.mesh.position; const dest=new THREE.Vector3(tp.x, tp.y+3, tp.z);
      const dir=dest.clone().sub(pr.mesh.position); const distLeft=dir.length();
      if(distLeft<2.6){ ringFX(dest.x, dest.y-1.5, dest.z, pr.fx.color, 4.2, 0.5); burst(dest.x,dest.y,dest.z, pr.fx.color, 12); hitEnemy(pr.target, pr.dmg); kill(); continue; }
      dir.normalize(); pr.mesh.position.addScaledVector(dir, pr.speed*dt); pr.mesh.lookAt(dest);
    } else {
      pr.mesh.position.addScaledVector(pr.dir, pr.speed*dt); pr.travelled+=pr.speed*dt;
      let hit=null; for(const e of enemies){ if(pr.hitSet&&pr.hitSet.has(e)) continue; if(Math.hypot(e.x-pr.mesh.position.x, e.z-pr.mesh.position.z)<3 && Math.abs(e.mesh.position.y+3-pr.mesh.position.y)<4){ hit=e; break; } }
      if(!hit && boss && !(pr.hitSet&&pr.hitSet.has(boss)) && Math.hypot(boss.x-pr.mesh.position.x, boss.z-pr.mesh.position.z)<4) hit=boss;
      if(hit){ ringFX(pr.mesh.position.x, pr.mesh.position.y-1, pr.mesh.position.z, pr.fx.color, 4.2, 0.5); hitEnemy(hit, pr.dmg);
        if(pr.splash){ [...enemies].forEach(e=>{ if(e!==hit&&Math.hypot(e.x-hit.x,e.z-hit.z)<pr.splash) hitEnemy(e, pr.dmg*0.6); }); burst(pr.mesh.position.x, pr.mesh.position.y, pr.mesh.position.z, pr.fx.color, 22); }
        if(pr.pierce){ pr.hitSet.add(hit); } else { kill(); continue; } }
      if(pr.travelled>75){ if(pr.splash) burst(pr.mesh.position.x, pr.mesh.position.y, pr.mesh.position.z, pr.fx.color, 16); kill(); continue; }
    }
    pr.mesh.rotation.x+=dt*7; pr.mesh.rotation.z+=dt*5;
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
