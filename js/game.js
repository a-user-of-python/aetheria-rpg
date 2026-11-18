// AETHERIA — main game. Three.js (universal WebGL, works in all modern browsers).
import * as THREE from "three";
import { CLASSES, WEAPONS, ARMOR, SPELLS, SPELL_BY_NAME, ENEMIES, VILLAGES, MAIN_QUESTS, NPC_NAMES, NPC_LINES,
  RARITIES, MODIFIERS, rollRarity, proceduralWeapon, proceduralArmor, makeSideQuest } from "./data.js";
import { buildWorld, terrainHeight, WORLD_SIZE } from "./world.js";
import { Room } from "./multiplayer.js";

const $=id=>document.getElementById(id);
const rand=(a,b)=>a+Math.random()*(b-a);
const dist2d=(a,b)=>Math.hypot(a.x-b.x, a.z-b.z);

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
  gold:25, baseDmg:10, armor:0, speed:1, weapon:null, armorItem:null, inventory:[], spells:[],
  mainIdx:0, mainProgress:{}, side:[], talkedVillages:new Set(), chestsOpened:0, pos:new THREE.Vector3(0,0,90) };
function xpForLevel(l){ return Math.round(100*Math.pow(l,1.55)); }

// ---------- Three setup ----------
let scene, camera, renderer, clock, playerMesh, hairMesh, weaponMesh, world, started=false;
let yaw=0, pitch=0.35, camDist=11, keys={}, enemies=[], npcs=[], camps=[], chests=[], particles=[];
let boss=null, shieldUp=false, speedBuffUntil=0, dmgBuffUntil=0, armorBuffUntil=0, campDensity=1;
const remotes=new Map(); let room=null;

function labelSprite(text, color="#fff"){
  const cv=document.createElement("canvas"); cv.width=512; cv.height=96; const g=cv.getContext("2d");
  g.font="bold 44px system-ui"; g.textAlign="center"; g.shadowColor="#000"; g.shadowBlur=8; g.fillStyle=color; g.fillText(text,256,58);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv), transparent:true, depthTest:false}));
  sp.scale.set(11,2.1,1); return sp;
}
function makeHumanoid(skin, hairColor, hairStyle, outfit, weaponShape, weaponColor){
  const grp=new THREE.Group();
  const outfitMat=new THREE.MeshStandardMaterial({color:outfit, roughness:0.8});
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(1.05,2.2,8,20), outfitMat); body.position.y=3.1; body.castShadow=true; grp.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(1.05,28,22), new THREE.MeshStandardMaterial({color:skin, roughness:0.7})); head.position.y=6.1; head.castShadow=true; grp.add(head);
  let hair;
  if(hairStyle===1){ hair=new THREE.Mesh(new THREE.ConeGeometry(1.25,2.2,20), new THREE.MeshStandardMaterial({color:hairColor})); hair.position.y=7.4; }
  else if(hairStyle===2){ hair=new THREE.Mesh(new THREE.SphereGeometry(1.12,24,16,0,Math.PI*2,0,Math.PI*1.4), new THREE.MeshStandardMaterial({color:hairColor})); hair.position.y=6.35; hair.scale.y=1.5; }
  else { hair=new THREE.Mesh(new THREE.SphereGeometry(1.1,24,16,0,Math.PI*2,0,Math.PI*0.55), new THREE.MeshStandardMaterial({color:hairColor})); hair.position.y=6.25; }
  grp.add(hair);
  const wm=makeWeaponMesh(weaponShape||"wand", weaponColor||0xffe27a); wm.position.set(1.5,3.4,0.4); wm.rotation.z=-0.5; grp.add(wm);
  return {grp, hair, wm};
}
function makeWeaponMesh(shape, color){
  const m=new THREE.Group(); const mat=new THREE.MeshStandardMaterial({color, roughness:0.4, metalness:0.25});
  if(shape==="blade"){ const b=new THREE.Mesh(new THREE.BoxGeometry(0.28,3.4,0.7), mat); b.position.y=1.7; m.add(b); const h=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.9,0.5), new THREE.MeshStandardMaterial({color:0x6b4a2a})); m.add(h); }
  else if(shape==="bow"){ const t=new THREE.Mesh(new THREE.TorusGeometry(1.7,0.16,10,28,Math.PI), mat); t.rotation.z=-Math.PI/2; m.add(t); }
  else if(shape==="staff"){ const s=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,4.4,12), mat); s.position.y=2; m.add(s); const o=new THREE.Mesh(new THREE.SphereGeometry(0.5,18,14), new THREE.MeshStandardMaterial({color:0xffe27a, emissive:0xffcc33, emissiveIntensity:1.2})); o.position.y=4.4; m.add(o); }
  else if(shape==="hammer"){ const s=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,3,10), new THREE.MeshStandardMaterial({color:0x6b4a2a})); s.position.y=1.4; m.add(s); const h=new THREE.Mesh(new THREE.SphereGeometry(0.85,18,14), mat); h.position.y=3; m.add(h); }
  else if(shape==="lute"){ const b=new THREE.Mesh(new THREE.SphereGeometry(1,20,16), mat); b.scale.set(1,1.25,0.45); b.position.y=1.2; m.add(b); const n=new THREE.Mesh(new THREE.BoxGeometry(0.35,2,0.3), new THREE.MeshStandardMaterial({color:0x6b4a2a})); n.position.y=3; m.add(n); }
  else { const s=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.13,3.4,10), new THREE.MeshStandardMaterial({color:0x6b4a2a})); s.position.y=1.6; m.add(s); const o=new THREE.Mesh(new THREE.SphereGeometry(0.45,18,14), new THREE.MeshStandardMaterial({color, emissive:color, emissiveIntensity:1.4})); o.position.y=3.5; m.add(o); }
  return m;
}

// ---------- Loot ----------
let uid=1;
function giveItem(base, rarity, source){
  rarity = rarity || rollRarity();
  const item={...base, uid:uid++, rarity, level:P.level};
  if(base.kind==="weapon") item.power=Math.round(base.power* (RARITIES[rarity]?.mult||1));
  if(base.kind==="armor") item.armor=Math.round((base.armor||2)* (RARITIES[rarity]?.mult||1));
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

// ---------- World population ----------
function spawnNPCs(){
  world.villages.forEach((v,vi)=>{
    for(let i=0;i<3;i++){
      const name=NPC_NAMES[(vi*3+i)%NPC_NAMES.length];
      const h=makeHumanoid(SKINS[(vi+i)%SKINS.length], HAIRS[(i*2+vi)%HAIRS.length], i%3, OUTFITS[(vi*2+i)%OUTFITS.length], "wand", 0xffe27a);
      h.grp.position.set(v.x+rand(-16,16), v.y, v.z+rand(-16,16));
      const lab=labelSprite(name,"#ffe9a8"); lab.position.y=8.6; h.grp.add(lab); scene.add(h.grp);
      npcs.push({mesh:h.grp, name, village:v.name, cx:v.x, cz:v.z, a:rand(0,6.28), r:rand(9,20), sp:rand(0.12,0.3), x:h.grp.position.x, z:h.grp.position.z});
    }
    const lab=labelSprite("✦ "+v.name+" — quest post (E) · shop (E at stall)","#aee9ff"); lab.position.set(v.x, v.y+15, v.z); lab.scale.set(26,4.8,1); scene.add(lab);
  });
}
function spawnCamps(){
  camps.forEach(c=>{ scene.remove(c.group); scene.remove(c.chestMesh); });
  enemies.forEach(e=>{ if(e.camp!==undefined && e.camp>=0) scene.remove(e.mesh); });
  camps=[]; chests=[]; enemies=enemies.filter(e=>e.camp===undefined||e.camp<0);
  const count=Math.round(16*campDensity);
  for(let i=0;i<count;i++){
    let x,z,tries=0;
    do{ x=rand(-1050,1050); z=rand(-1050,1050); tries++; }while(tries<20 && (VILLAGES.some(v=>Math.hypot(x-v.x,z-v.z)<110)||Math.hypot(x-880,z+880)<130));
    const y=terrainHeight(x,z); const g=new THREE.Group();
    const tent=new THREE.Mesh(new THREE.ConeGeometry(6,6.5,4,1), new THREE.MeshStandardMaterial({color:0xc98a5a, roughness:0.9})); tent.position.y=3.2; tent.rotation.y=Math.PI/4; tent.castShadow=true; g.add(tent);
    const fire=new THREE.Mesh(new THREE.SphereGeometry(0.9,14,10), new THREE.MeshStandardMaterial({color:0xffa657, emissive:0xff7722, emissiveIntensity:2})); fire.position.set(6,0.8,4); g.add(fire);
    g.position.set(x,y,z); scene.add(g);
    const chestMesh=new THREE.Mesh(new THREE.BoxGeometry(2.6,1.8,1.8), new THREE.MeshStandardMaterial({color:0x9a6a35, roughness:0.6, metalness:0.2}));
    chestMesh.position.set(x-5, terrainHeight(x-5,z+3)+1, z+3); chestMesh.castShadow=true; scene.add(chestMesh);
    const chest={x:x-5, z:z+3, mesh:chestMesh, opened:false, camp:i}; chests.push(chest);
    const camp={x,z,y,group:g,enemies:[],chestMesh};
    const n=3+Math.floor(Math.random()*3);
    for(let k=0;k<n;k++){
      const et=ENEMIES[Math.floor(Math.random()*Math.min(ENEMIES.length, 3+Math.floor(P.level/3)))];
      spawnEnemy(et, x+rand(-13,13), z+rand(-13,13), i);
    }
    camps.push(camp);
  }
}
function spawnEnemy(et, x, z, campIdx, isBoss=false){
  const s=isBoss?2.6:et.scale;
  const mesh=new THREE.Group();
  const body=new THREE.Mesh(new THREE.SphereGeometry(1.6*s,28,22), new THREE.MeshStandardMaterial({color:et.color, roughness:0.55}));
  body.position.y=1.7*s; body.castShadow=true; mesh.add(body);
  const e1=new THREE.Mesh(new THREE.SphereGeometry(0.22,12,10), new THREE.MeshStandardMaterial({color:0x222222})); e1.position.set(-0.55*s,2*s,1.35*s); mesh.add(e1);
  const e2=e1.clone(); e2.position.x=0.55*s; mesh.add(e2);
  if(isBoss){ const hat=new THREE.Mesh(new THREE.ConeGeometry(1.6,3.4,20), new THREE.MeshStandardMaterial({color:0x6a4a8a})); hat.position.y=4.6*s; mesh.add(hat); }
  mesh.position.set(x, terrainHeight(x,z), z); scene.add(mesh);
  const lab=labelSprite(isBoss?"Malachar the Wizard":et.type, isBoss?"#e0aaff":"#ffffff"); lab.position.y=4.6*s; mesh.add(lab);
  const lvlBonus=1+P.level*0.12;
  const e={mesh, type:et.type, hp:et.hp*lvlBonus*(isBoss?22:1), hpMax:et.hp*lvlBonus*(isBoss?22:1), dmg:et.dmg*(isBoss?2.2:1), xp:et.xp*(isBoss?40:1), gold:et.gold, speed:et.speed, x, z, camp:campIdx, boss:isBoss, atkCd:0, wanderA:rand(0,6.28)};
  enemies.push(e); return e;
}
function burst(x,y,z,color,n=16){
  const geo=new THREE.BufferGeometry(); const pts=[];
  for(let i=0;i<n;i++) pts.push(x,y,z);
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts,3));
  const m=new THREE.Points(geo, new THREE.PointsMaterial({color, size:0.85, transparent:true}));
  m.userData.vel=Array.from({length:n},()=>new THREE.Vector3(rand(-6,6),rand(2,9),rand(-6,6)));
  m.userData.life=0.9; scene.add(m); particles.push(m);
}

// ---------- Quests ----------
function currentMain(){ return MAIN_QUESTS[P.mainIdx]||null; }
function questProgress(kind, data={}){
  let changed=false;
  const check=(q, store)=>{
    const o=q.obj; if(!o) return;
    if(o.kind===kind){
      if(kind==="defeat" && o.enemy!==data.enemy) return;
      store.count=(store.count||0)+1; changed=true;
      if((o.count||1) <= store.count) completeQuest(q);
    } else if(kind==="chests" && o.kind==="chests"){ store.count=(store.count||0)+1; changed=true; if(o.count<=store.count) completeQuest(q); }
  };
  const mq=currentMain(); if(mq && !mq.done){ if(mq.obj.kind===kind|| (kind==="chests"&&mq.obj.kind==="chests")) { P.mainProgress[mq.id]=P.mainProgress[mq.id]||{}; const before=P.mainIdx; check(mq, P.mainProgress[mq.id]); if(P.mainIdx!==before) changed=true; } }
  [...P.side].forEach(q=>{ if(q.done) return; const st=q._p||(q._p={}); if(q.obj.kind===kind||q.obj.kind==="defeatAny"&&kind==="defeat"|| (kind==="chests"&&q.obj.kind==="chests")){ if(q.obj.kind==="defeat"&&q.obj.enemy!==data.enemy) return; st.count=(st.count||0)+1; changed=true; if((q.obj.count||1)<=st.count) completeQuest(q); } });
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
function gainXP(n){ P.xp+=n; while(P.xp>=P.xpNext){ P.xp-=P.xpNext; P.level++; P.xpNext=xpForLevel(P.level); P.hpMax+=14+Math.round(P.level*1.5); P.manaMax+=7; P.hp=P.hpMax; P.mana=P.manaMax; P.baseDmg+=2; toast(`⭐ Level ${P.level}! HP and power up. New spells may be in your book (I).`); learnLevelSpells(); } updateHUD(); }
function learnLevelSpells(){ const want={3:"River Rush",5:"Star Shower",7:"Sun Ray",9:"Crystal Shards",11:"Moonbeam",13:"Great Mend",16:"Comet Trail",19:"Aurora Wave",22:"Worldtree Blessing"}; const s=want[P.level]; if(s&&!P.spells.includes(s)){ P.spells.push(s); toast("New spell learned: "+s); } }

// ---------- Combat ----------
let atkCd=0;
function attack(){
  if(atkCd>0||!started) return; atkCd=0.45;
  const dmg=P.baseDmg + (P.weapon?P.weapon.power:0);
  let best=null,bd=6.5;
  for(const e of enemies){ const d=Math.hypot(e.x-P.pos.x, e.z-P.pos.z); if(d<bd){bd=d;best=e;} }
  if(boss && Math.hypot(boss.x-P.pos.x,boss.z-P.pos.z)<8) best=boss;
  if(best) hitEnemy(best, dmg*(Date.now()<dmgBuffUntil?1.3:1));
  burst(P.pos.x,P.pos.y+4,P.pos.z, P.weapon?P.weapon.color:0xffe27a, 6);
}
function hitEnemy(e, dmg){
  e.hp-=dmg; burst(e.mesh.position.x, e.mesh.position.y+3, e.mesh.position.z, 0xffe27a, 10);
  e.mesh.scale.setScalar(1.12); setTimeout(()=>e.mesh&&e.mesh.scale.setScalar(1),90);
  if(e.hp<=0){
    burst(e.mesh.position.x, e.mesh.position.y+3, e.mesh.position.z, 0xffffff, 30);
    scene.remove(e.mesh); enemies=enemies.filter(x=>x!==e); if(e===boss) boss=null;
    gainXP(e.xp); P.gold+=e.gold; toast(`Poof! ${e.type} +${e.xp} XP, +${e.gold} gold`);
    questProgress("defeat",{enemy:e.type});
    if(e.boss){ const mq=currentMain(); if(mq&&mq.id==="m14") completeQuest(mq); }
    if(Math.random()<0.25) randomLoot();
  }
}
function castSpell(name){
  const s=SPELL_BY_NAME[name]; if(!s||P.mana<s.cost) { if(s) toast("Not enough mana"); return; }
  P.mana-=s.cost;
  if(name==="Healing Light"||name==="Leaf Mend"||name==="Great Mend"){ P.hp=Math.min(P.hpMax,P.hp+s.power); burst(P.pos.x,P.pos.y+4,P.pos.z,0x7ee787,18); }
  else if(name==="Wind Step"){ speedBuffUntil=Date.now()+5000; }
  else if(name==="Mana Shield"||name==="Snow Veil"||name==="Worldtree Blessing"){ shieldUp=true; if(name==="Worldtree Blessing") P.hp=Math.min(P.hpMax,P.hp+40); }
  else if(name==="Stone Skin"){ armorBuffUntil=Date.now()+15000; }
  else if(name==="Cheer Song"){ dmgBuffUntil=Date.now()+10000; }
  else if(name==="Teleport Home"){ let best=VILLAGES[0],bd=1e9; for(const v of VILLAGES){const d=Math.hypot(v.x-P.pos.x,v.z-P.pos.z); if(d<bd){bd=d;best=v;}} P.pos.set(best.x,0,best.z+16); }
  else { let best=null,bd=26; for(const e of enemies){const d=Math.hypot(e.x-P.pos.x,e.z-P.pos.z); if(d<bd){bd=d;best=e;}} if(boss&&Math.hypot(boss.x-P.pos.x,boss.z-P.pos.z)<28) best=boss;
    if(best) hitEnemy(best, s.power + P.level*1.5); burst(P.pos.x,P.pos.y+5,P.pos.z, s.color, 14); }
  updateHUD();
}

// ---------- Interaction ----------
let nearThing=null;
function findNear(){
  nearThing=null;
  for(const n of npcs) if(Math.hypot(n.x-P.pos.x,n.z-P.pos.z)<6){ nearThing={kind:"npc", n}; break; }
  if(!nearThing) for(const c of chests) if(!c.opened && Math.hypot(c.x-P.pos.x,c.z-P.pos.z)<5){ nearThing={kind:"chest", c}; break; }
  if(!nearThing) for(const v of world.villages){
    if(Math.hypot(v.x+8-P.pos.x, v.z+4-P.pos.z)<6){ nearThing={kind:"board", v}; break; }
    if(Math.hypot(v.x-9-P.pos.x, v.z+5-P.pos.z)<6){ nearThing={kind:"shop", v}; break; }
    if(Math.hypot(v.x-P.pos.x, v.z-P.pos.z)<7){ nearThing={kind:"village", v}; break; }
  }
  if(!nearThing && Math.hypot(880-P.pos.x,-880-P.pos.z)<14){ nearThing={kind:"tower"}; }
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
    questProgress("talk",{});
  }
  if(nearThing.kind==="chest"){ nearThing.c.opened=true; nearThing.c.mesh.material=new THREE.MeshStandardMaterial({color:0x5a4020}); P.chestsOpened++; burst(nearThing.c.x,terrainHeight(nearThing.c.x,nearThing.c.z)+3,nearThing.c.z,0xffd700,20); randomLoot(); if(Math.random()<0.5) randomLoot(); P.gold+=Math.round(rand(5,30)); questProgress("chests",{}); }
  if(nearThing.kind==="board") openBoard(nearThing.v);
  if(nearThing.kind==="shop") openShop(nearThing.v);
  if(nearThing.kind==="village"){ const mq=currentMain(); if(mq&&mq.obj.kind==="visit"&&mq.obj.village===nearThing.v.name) completeQuest(mq); if(mq&&mq.obj.kind==="visitOther"&&mq.obj) {} P.side.forEach(q=>{ if(!q.done&&q.obj.kind==="visitOther"&&q.village!==nearThing.v.name) completeQuest(q); }); showDialogue(nearThing.v.name, "A friendly village of Aetheria. Houses, a well, a quest post and a shop — all here for travellers."); }
  if(nearThing.kind==="tower"){ const mq=currentMain(); if(mq&&mq.id==="m13") completeQuest(mq);
    if(currentMain()&&currentMain().id==="m14"&&!boss){ boss=spawnEnemy(ENEMIES[7], 860,-855, -1, true); boss.type="Malachar the Wizard"; showDialogue("Malachar", "So! The villages sent their kindest champion. Very well — a friendly duel of sparkles. First shield to fall loses, and the loser takes up gardening. En garde!"); }
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
  $("invStats").innerHTML=`<b>${P.name}</b> — ${P.cls?P.cls.name:""} · Level ${P.level}<br>HP ${Math.ceil(P.hp)}/${P.hpMax} · Mana ${Math.ceil(P.mana)}/${P.manaMax} · 🪙 ${P.gold}<br>Weapon: ${P.weapon?P.weapon.name+" ("+P.weapon.power+")":"none"} · Armour: ${P.armorItem?P.armorItem.name+" ("+P.armorItem.armor+")":"none"}<br><b>Spells:</b> ${P.spells.join(", ")}`;
  $("invGrid").innerHTML=P.inventory.map(it=>`<div class="item" style="border-color:${RARITIES[it.rarity]?.color||'#888'}"><b>${it.name}</b><br><small>${it.rarity}${it.modifier?" · "+it.modifier.name:""} · ${it.kind==="weapon"?"Power "+it.power:"Armour "+it.armor}</small><br><button data-equip="${it.uid}">Equip</button> <button data-sell="${it.uid}">Sell ${Math.round((it.power||it.armor||5)*2)}g</button></div>`).join("") || "<p>No loot yet — open camp chests!</p>";
  document.querySelectorAll("[data-equip]").forEach(b=>b.onclick=()=>{ const it=P.inventory.find(x=>x.uid==b.dataset.equip); if(it.kind==="weapon"){P.weapon=it; if(weaponMesh) weaponMesh.copy(makeWeaponMesh(it.shape,it.color)); } else P.armorItem=it; toast("Equipped "+it.name); renderInventory(); updateHUD(); });
  document.querySelectorAll("[data-sell]").forEach(b=>b.onclick=()=>{ const i=P.inventory.findIndex(x=>x.uid==b.dataset.sell); if(i>=0){ const it=P.inventory[i]; P.gold+=Math.round((it.power||it.armor||5)*2); if(P.weapon===it)P.weapon=null; if(P.armorItem===it)P.armorItem=null; P.inventory.splice(i,1); renderInventory(); updateHUD(); } });
}
function openBoard(v){
  $("panelTitle").textContent="Quest Post — "+v.name; $("panelBody").innerHTML="";
  for(let i=0;i<3;i++){ const q=makeSideQuest(v.name, P.level); const d=document.createElement("div"); d.className="q";
    d.innerHTML=`<b>${q.title}</b><br>${q.text}<br><i>${q.xp} XP · ${q.gold} gold</i> <button>Accept</button>`;
    d.querySelector("button").onclick=()=>{ P.side.push(q); toast("Quest accepted: "+q.title); renderQuests(); d.remove(); }; $("panelBody").appendChild(d); }
  $("panel").style.display="block";
}
function openShop(v){
  const tier=VILLAGES.findIndex(x=>x.name===v.name);
  $("panelTitle").textContent="Shop — "+v.name; $("panelBody").innerHTML=`<p>Your gold: 🪙 ${P.gold}</p>`;
  for(let i=0;i<6;i++){
    const pool=Math.random()<0.6? WEAPONS:ARMOR; const base=pool[Math.floor(Math.random()*pool.length)];
    const price=Math.round((base.power||base.armor||5)*(6+tier*2)*rand(0.9,1.3));
    const exclusive=Math.random()<0.3;
    const d=document.createElement("div"); d.className="q";
    d.innerHTML=`<b>${exclusive?"★ Shop Exclusive — ":""}${base.name}</b> — ${base.desc||""}<br><i>${price} gold</i> <button>Buy</button>`;
    d.querySelector("button").onclick=()=>{ if(P.gold<price){toast("Not enough gold");return;} P.gold-=price; giveItem({...base}, exclusive?undefined:rollRarity(), exclusive?"shopExclusive":null); if(exclusive) P.inventory[P.inventory.length-1].name="Shop Exclusive "+base.name; updateHUD(); openShop(v); };
    $("panelBody").appendChild(d);
  }
  $("panel").style.display="block";
}
$("panelClose").onclick=()=>$("panel").style.display="none";
function showEnd(){ showDialogue("🎉 Story Complete!", "Malachar lowers his wand, laughs, and signs the Gardening Promise in big purple letters. Aetheria is safe — and the side quests, camps and villages still hold many hours of adventures. Thank you for playing!"); }

// ---------- Save ----------
function saveGame(){ try{ localStorage.setItem("aetheria-save", JSON.stringify({name:P.name, level:P.level, xp:P.xp, gold:P.gold, mainIdx:P.mainIdx, chestsOpened:P.chestsOpened, spells:P.spells, inv:P.inventory, clsId:P.cls?.id})); }catch(e){} }

// ---------- Multiplayer ----------
$("hostBtn").onclick=()=>{ room=new Room(onPeer); const code=room.host(); $("roomInfo").innerHTML=`Room code: <b style="font-size:26px;letter-spacing:4px">${code}</b><br><small>Friends: open this game in another tab/window on this device, choose Join Room, type the code.</small>`; startMpLoop(); };
$("joinBtn").onclick=()=>{ const code=$("joinCode").value; room=new Room(onPeer); if(room.join(code)){ $("roomInfo").textContent="Joined room "+code.toUpperCase()+" — look for your friends' names in the world!"; startMpLoop(); } else toast("Code must be 5 letters"); };
function onPeer(id, m){ if(!m){ const r=remotes.get(id); if(r){scene.remove(r.grp); remotes.delete(id);} return; }
  let r=remotes.get(id);
  if(!r){ const h=makeHumanoid(m.skin, m.hair, 0, m.outfit, "wand", 0xffe27a); const lab=labelSprite(m.name||"Friend","#7ee787"); lab.position.y=8.6; h.grp.add(lab); scene.add(h.grp); r={grp:h.grp}; remotes.set(id,r); toast((m.name||"A friend")+" joined your world!"); }
  r.grp.position.set(m.x, m.y, m.z); r.grp.rotation.y=m.ry||0;
}
function startMpLoop(){ setInterval(()=>{ if(room&&started) room.sendState({name:P.name, x:P.pos.x, y:P.pos.y, z:P.pos.z, ry:yaw, skin:selSkin, hair:selHair, outfit:selOutfit}); },120); }

// ---------- Start ----------
$("startBtn").onclick=()=>{
  P.name=$("charName").value.trim()||"Traveller"; P.cls=selClass;
  P.hpMax=selClass.hp; P.hp=P.hpMax; P.manaMax=selClass.mana; P.mana=P.manaMax; P.baseDmg=selClass.dmg; P.speed=selClass.speed;
  P.spells=[...selClass.spells]; P.xpNext=xpForLevel(1);
  const w=WEAPONS.find(x=>x.name===selClass.weapon)||WEAPONS[0]; const wi=giveItem({...w},"Common"); P.weapon=wi;
  const a=ARMOR.find(x=>x.name.startsWith(selClass.armor.split(" ")[0]))||ARMOR[0]; const ai=giveItem({...a},"Common"); P.armorItem=ai;
  $("creation").style.display="none"; $("hud").style.display="block"; started=true; initThree(); updateHUD(); renderQuests(); renderInventory();
  toast("Welcome to Aetheria, "+P.name+"! WASD to walk, drag to look, click / Attack to sparkle a foe, E to talk.");
};
function initThree(){
  scene=new THREE.Scene(); scene.background=new THREE.Color(0x9fd8ff); scene.fog=new THREE.Fog(0x9fd8ff, 180, 900);
  camera=new THREE.PerspectiveCamera(62, innerWidth/innerHeight, 0.1, 3000);
  renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setSize(innerWidth,innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  $("game").appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xcfeaff, 0x5a7a4a, 0.95));
  const sun=new THREE.DirectionalLight(0xfff2cc, 1.6); sun.position.set(120,220,80); sun.castShadow=true;
  sun.shadow.camera.left=-90; sun.shadow.camera.right=90; sun.shadow.camera.top=90; sun.shadow.camera.bottom=-90; sun.shadow.mapSize.set(2048,2048);
  scene.add(sun); scene.userData.sun=sun;
  world=buildWorld(scene);
  const h=makeHumanoid(selSkin, selHair, selHairStyle, selOutfit, P.weapon.shape, P.weapon.color);
  playerMesh=h.grp; hairMesh=h.hair; weaponMesh=h.wm;
  const lab=labelSprite(P.name+" · "+selClass.name,"#ffffff"); lab.position.y=8.8; playerMesh.add(lab); scene.add(playerMesh);
  P.pos.set(0, terrainHeight(0,90), 90);
  spawnNPCs(); spawnCamps();
  clock=new THREE.Clock(); animate();
  addEventListener("resize",()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });
  // camera drag look
  let dragging=false,lx=0,ly=0;
  renderer.domElement.addEventListener("pointerdown",e=>{dragging=true;lx=e.clientX;ly=e.clientY;});
  addEventListener("pointerup",()=>dragging=false);
  addEventListener("pointermove",e=>{ if(!dragging) return; yaw-=(e.clientX-lx)*0.005; pitch=Math.max(0.08,Math.min(1.2,pitch+(e.clientY-ly)*0.004)); lx=e.clientX; ly=e.clientY; });
  addEventListener("wheel",e=>{ camDist=Math.max(6,Math.min(22,camDist+e.deltaY*0.01)); });
}
// Input
addEventListener("keydown",e=>{ keys[e.key.toLowerCase()]=true;
  if(e.key==="e"||e.key==="E") interact();
  if(e.key==="i"||e.key==="I"||e.key==="Tab"){ e.preventDefault(); const p=$("inventory"); p.style.display=p.style.display==="block"?"none":"block"; renderInventory(); }
  if(e.key===" "){ e.preventDefault(); attack(); }
  const n=parseInt(e.key); if(n>=1&&n<=6&&P.spells[n-1]) castSpell(P.spells[n-1]);
  if(e.key==="`") $("dev").style.display=$("dev").style.display==="block"?"none":"block";
});
addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);
$("atkBtn").onclick=attack; $("intBtn").onclick=interact; $("invBtn").onclick=()=>{ const p=$("inventory"); p.style.display=p.style.display==="block"?"none":"block"; renderInventory(); };
$("invClose").onclick=()=>$("inventory").style.display="none";
$("density").oninput=e=>{ campDensity=+e.target.value; $("densityVal").textContent=campDensity.toFixed(1)+"×"; };
$("respawnBtn").onclick=()=>{ spawnCamps(); toast("Camps rebuilt at "+campDensity.toFixed(1)+"× density"); };
$("healBtn").onclick=()=>{ P.hp=P.hpMax; P.mana=P.manaMax; updateHUD(); };
// touch joystick
let joyVec={x:0,z:0};
const joy=$("joy"), knob=$("knob"); let joyId=null;
if(joy){ joy.addEventListener("pointerdown",e=>{joyId=e.pointerId;}); addEventListener("pointermove",e=>{ if(e.pointerId!==joyId) return; const r=joy.getBoundingClientRect(); let dx=e.clientX-(r.left+55), dy=e.clientY-(r.top+55); const m=Math.hypot(dx,dy); if(m>38){dx*=38/m;dy*=38/m;} knob.style.transform=`translate(${dx}px,${dy}px)`; joyVec={x:dx/38,z:dy/38}; });
  addEventListener("pointerup",e=>{ if(e.pointerId===joyId){joyId=null; joyVec={x:0,z:0}; knob.style.transform="";} }); }

// ---------- Main loop ----------
let vy=0;
function animate(){
  requestAnimationFrame(animate); const dt=Math.min(clock.getDelta(),0.05); const now=Date.now();
  if(atkCd>0) atkCd-=dt;
  // movement
  const sp=(keys["shift"]?13:8.5)*P.speed*(now<speedBuffUntil?1.45:1);
  let f=0,r=0;
  if(keys["w"]) f+=1; if(keys["s"]) f-=1; if(keys["d"]) r+=1; if(keys["a"]) r-=1;
  r+=joyVec.x; f-=joyVec.z;
  const len=Math.hypot(f,r); if(len>0.05){ const nf=f/Math.max(1,len), nr=r/Math.max(1,len);
    const fx=-Math.sin(yaw), fz=-Math.cos(yaw);   // away from camera
    const rx=Math.cos(yaw), rz=-Math.sin(yaw);    // screen right
    P.pos.x += (fx*nf + rx*nr)*sp*dt; P.pos.z += (fz*nf + rz*nr)*sp*dt;
    playerMesh.rotation.y=Math.atan2(fx*nf+rx*nr, fz*nf+rz*nr);
  }
  P.pos.x=Math.max(-1180,Math.min(1180,P.pos.x)); P.pos.z=Math.max(-1180,Math.min(1180,P.pos.z));
  const ground=terrainHeight(P.pos.x,P.pos.z);
  if(keys[" "]&&false) {}
  P.pos.y += ((ground)-P.pos.y)*Math.min(1,dt*10);
  playerMesh.position.copy(P.pos);
  // camera
  const cx=P.pos.x+Math.sin(yaw)*Math.cos(pitch)*camDist, cz=P.pos.z+Math.cos(yaw)*Math.cos(pitch)*camDist, cy=P.pos.y+Math.sin(pitch)*camDist+3;
  camera.position.set(cx, Math.max(cy, terrainHeight(cx,cz)+1.5), cz); camera.lookAt(P.pos.x,P.pos.y+4.5,P.pos.z);
  scene.userData.sun.position.set(P.pos.x+120, P.pos.y+220, P.pos.z+80); scene.userData.sun.target=playerMesh;
  if(world.orb) world.orb.rotation.y+=dt;
  // NPCs wander
  for(const n of npcs){ n.a+=dt*n.sp*0.4; n.x=n.cx+Math.cos(n.a)*n.r; n.z=n.cz+Math.sin(n.a)*n.r; n.mesh.position.set(n.x, terrainHeight(n.x,n.z), n.z); n.mesh.rotation.y=-n.a; }
  // Enemies AI
  for(const e of [...enemies]){
    const d=Math.hypot(e.x-P.pos.x, e.z-P.pos.z);
    if(d<26 && d>2.6){ const s=e.speed*dt*(Date.now()<speedBuffUntil?1:1); e.x+=(P.pos.x-e.x)/d*s*3.2; e.z+=(P.pos.z-e.z)/d*s*3.2; }
    else { e.wanderA+=dt*0.7; e.x+=Math.cos(e.wanderA)*dt*e.speed*0.5; e.z+=Math.sin(e.wanderA)*dt*e.speed*0.5; }
    e.mesh.position.set(e.x, terrainHeight(e.x,e.z)+Math.sin(now*0.004+e.x)*0.25, e.z);
    e.atkCd-=dt;
    if(d<3.4 && e.atkCd<=0){ e.atkCd=1.1; if(shieldUp){ shieldUp=false; toast("Your shield sparkled away a hit!"); } else { const armor=(P.armorItem?P.armorItem.armor:0)+(now<armorBuffUntil?6:0); P.hp-=Math.max(1, e.dmg-armor*0.35); burst(P.pos.x,P.pos.y+4,P.pos.z,0xff9e9e,8); updateHUD(); if(P.hp<=0){ P.hp=P.hpMax; P.mana=P.manaMax; P.pos.set(0,0,90); toast("You poofed into stars and woke up safe in Valebrook. No harm done!"); } } }
  }
  // particles
  for(const p of [...particles]){ p.userData.life-=dt; const arr=p.geometry.attributes.position; const v=p.userData.vel; for(let i=0;i<v.length;i++){ arr.setXYZ(i, arr.getX(i)+v[i].x*dt, arr.getY(i)+v[i].y*dt, arr.getZ(i)+v[i].z*dt); v[i].y-=12*dt; } arr.needsUpdate=true; p.material.opacity=p.userData.life; if(p.userData.life<=0){ scene.remove(p); particles=particles.filter(x=>x!==p); } }
  // regen
  P.mana=Math.min(P.manaMax, P.mana+dt*2.2); P.hp=Math.min(P.hpMax, P.hp+dt*0.5);
  if(Math.floor(now/500)!==Math.floor((now-dt*1000)/500)) updateHUD();
  findNear();
  renderer.render(scene,camera);
}
setInterval(saveGame, 15000);
