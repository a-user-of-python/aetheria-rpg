// AETHERIA — data catalog: classes, weapons, armour, spells, quests, rarities
// School/work appropriate: practice & sparkle tools only, no gore, enemies poof into stars.

export const RARITIES = {
  Common:    { color:"#d8dee9", chance:50, mult:1.0 },
  Uncommon:  { color:"#7ee787", chance:27, mult:1.25 },
  Rare:      { color:"#58a6ff", chance:14, mult:1.6 },
  Epic:      { color:"#bc8cff", chance:6,  mult:2.1 },
  Legendary: { color:"#ffa657", chance:2,  mult:3.0 },
  Quest:     { color:"#ffd700", chance:0,  mult:1.8 },
  Shop:      { color:"#ff7bcd", chance:0,  mult:1.5 },
};
export function rollRarity(rng=Math.random){
  let r=rng()*99; // 50+27+14+6+2 = 99
  for(const k of ["Common","Uncommon","Rare","Epic","Legendary"]) { if(r<RARITIES[k].chance) return k; r-=RARITIES[k].chance; }
  return "Common";
}
export const MODIFIERS = [
  {name:"Radiant", desc:"+15% damage, glows with soft light", dmg:1.15},
  {name:"Swift", desc:"+10% move speed while equipped", speed:1.10},
  {name:"Sturdy", desc:"+20 max HP while equipped", hp:20},
  {name:"Wise", desc:"+15 max Mana while equipped", mana:15},
  {name:"Lucky", desc:"+10% gold from quests & camps", gold:1.10},
  {name:"Scholar's", desc:"+10% XP gain", xp:1.10},
  {name:"Guardian's", desc:"+4 armour", armor:4},
  {name:"Sparkling", desc:"Attacks release harmless star sparkles", dmg:1.05},
  {name:"Featherlight", desc:"+6% move speed, +5 Mana", speed:1.06, mana:5},
  {name:"Heartwood", desc:"+10 HP, +5 Mana", hp:10, mana:5},
];

export const CLASSES = [
  {id:"knight", name:"Knight of the Vale", icon:"🛡️", desc:"Balanced protector with a practice blade and shield-craft.", weapon:"Vale Practice Blade", armor:"Vale Tunic Set", spells:["Spark Bolt","Healing Light"], hp:120, mana:60, dmg:12, speed:1.0},
  {id:"ranger", name:"Ranger", icon:"🏹", desc:"Explorer with a soft-arrow bow — arrows are padded practice tips.", weapon:"Ranger Soft-Arrow Bow", armor:"Scout Leathers", spells:["Spark Bolt","Wind Step"], hp:100, mana:70, dmg:13, speed:1.12},
  {id:"mage", name:"Spark Mage", icon:"✨", desc:"Studies friendly spark magic at the village academy.", weapon:"Apprentice Spark Wand", armor:"Academy Robes", spells:["Spark Bolt","Frost Twinkle","Mana Shield"], hp:85, mana:130, dmg:15, speed:0.98},
  {id:"healer", name:"Healer", icon:"💚", desc:"Keeps everyone well with light and leaf remedies.", weapon:"Healer's Light Staff", armor:"Herbalist Garb", spells:["Healing Light","Leaf Mend","Spark Bolt"], hp:95, mana:120, dmg:10, speed:1.0},
  {id:"bard", name:"Bard", icon:"🎵", desc:"Music that lifts spirits and sparkles. Instrument is also the tool.", weapon:"Bard's Lute", armor:"Performer Silks", spells:["Cheer Song","Spark Bolt"], hp:95, mana:100, dmg:11, speed:1.05},
  {id:"guardian", name:"Guardian", icon:"🌿", desc:"Strong defender of villages and roads.", weapon:"Guardian Practice Hammer", armor:"Guardian Platecloth", spells:["Stone Skin","Spark Bolt"], hp:145, mana:50, dmg:11, speed:0.94},
  {id:"scholar", name:"Scholar", icon:"📚", desc:"Knows every path, plant and star chart in Aetheria.", weapon:"Scholar's Pointer Wand", armor:"Scholar Robes", spells:["Frost Twinkle","Spark Bolt","Teleport Home"], hp:88, mana:125, dmg:14, speed:1.0},
  {id:"wanderer", name:"Wanderer", icon:"🧭", desc:"All-rounder who starts with a bit of everything.", weapon:"Wanderer's Walking Staff", armor:"Traveller Set", spells:["Spark Bolt","Wind Step"], hp:105, mana:85, dmg:12, speed:1.08},
  {id:"frostkeeper", name:"Frostkeeper", icon:"❄️", desc:"Gentle winter magic — snowflakes, never harm beyond a poof.", weapon:"Frostkeeper Wand", armor:"Winter Wool Set", spells:["Frost Twinkle","Snow Veil","Spark Bolt"], hp:92, mana:120, dmg:14, speed:1.0},
  {id:"sunpaladin", name:"Sun Paladin", icon:"☀️", desc:"Champion of daylight, sworn to help every village.", weapon:"Sun Practice Sword", armor:"Suncloth Armour", spells:["Healing Light","Sun Ray","Spark Bolt"], hp:125, mana:80, dmg:13, speed:0.99},
];

// ---- Weapons: each has its own look (shape + colour used by the 3D renderer) ----
const W = (name,type,power,shape,color,desc)=>({name,type,power,shape,color,desc,kind:"weapon"});
export const WEAPONS = [
  W("Vale Practice Blade","Blade",12,"blade",0xc0c8d8,"Wooden-edged practice blade, polished smooth."),
  W("Ranger Soft-Arrow Bow","Bow",13,"bow",0x8b5a2b,"Padded-tip arrows only — they bounce off with a sparkle."),
  W("Apprentice Spark Wand","Wand",15,"wand",0x9b7bff,"Topped with a friendly glowing star."),
  W("Healer's Light Staff","Staff",10,"staff",0x7ee787,"A warm light for finding the way home."),
  W("Bard's Lute","Instrument",11,"lute",0xd2a679,"Strum it and notes turn to sparkles."),
  W("Guardian Practice Hammer","Hammer",11,"hammer",0xa8b0bc,"Foam-padded head for training yard practice."),
  W("Scholar's Pointer Wand","Wand",14,"wand",0x58a6ff,"Points at stars and solutions."),
  W("Wanderer's Walking Staff","Staff",12,"staff",0x8b5a2b,"Has walked a thousand paths."),
  W("Frostkeeper Wand","Wand",14,"wand",0xaee9ff,"Leaves a trail of tiny snowflakes."),
  W("Sun Practice Sword","Blade",13,"blade",0xffd479,"Catches the morning light."),
  W("Meadow Training Sword","Blade",16,"blade",0xd8dee9,"A step up from the yard blades."),
  W("Oakheart Bow","Bow",19,"bow",0x6b4423,"Carved from a friendly old oak."),
  W("Riverpearl Wand","Wand",21,"wand",0x7ff0e0,"Shimmers like river light."),
  W("Thistledown Staff","Staff",18,"staff",0xb8e6a0,"Light as a seed on the wind."),
  W("Copper Bell Hammer","Hammer",20,"hammer",0xd08a4e,"Rings a cheerful note on every tap."),
  W("Stormglass Blade","Blade",26,"blade",0x8fd8ff,"Holds a tiny, harmless storm inside glass."),
  W("Aurora Bow","Bow",29,"bow",0xc792ff,"Arrows leave rainbow sparkles."),
  W("Comet Wand","Wand",32,"wand",0xffa657,"Its star tip twinkles like a comet."),
  W("Worldtree Staff","Staff",34,"staff",0x5ec962,"Grown, never cut, from the Worldtree."),
  W("Dragonscale Practice Blade","Blade",38,"blade",0xff8a7a,"Replica scale finish — the dragon donated it, retired."),
  W("Moonlight Greatwand","Wand",42,"wand",0xe6e9ff,"Glows brighter under a full moon."),
  W("Sunforge Hammer","Hammer",44,"hammer",0xffc44d,"Warm to the touch, kind in a fight — foes simply poof."),
  W("Starfall Bow","Bow",48,"bow",0xffe27a,"Every shot is a falling star of light."),
  W("Blade of the First Vale","Blade",55,"blade",0xfff2b0,"Legendary practice blade of Aetheria's first Knight."),
  W("Wand of the Arch-Scholar","Wand",58,"wand",0xa0b8ff,"Hums with a library's worth of friendly spells."),
  W("Staff of Seasons","Staff",60,"staff",0x9be67a,"Spring at one end, autumn at the other."),
];
// Procedural expansion: materials × bases = hundreds of distinct findable weapons
const MATS=[["Pine",1],["Oak",1.15],["Copper",1.3],["Silver",1.5],["Crystal",1.75],["Starmetal",2.1]];
const BASES=[["Training Blade","Blade","blade",0xcfd6e4],["Soft Bow","Bow","bow",0x9a6a35],["Spark Wand","Wand","wand",0xb79bff],["Oak Staff","Staff","staff",0x9a6a35],["Bell Hammer","Hammer","hammer",0xb8b0a0],["Note Lute","Instrument","lute",0xd2a679]];
export function proceduralWeapon(level,rng=Math.random){
  const m=MATS[Math.min(MATS.length-1,Math.floor(rng()*MATS.length))];
  const b=BASES[Math.floor(rng()*BASES.length)];
  const power=Math.round((10+level*2.2)*m[1]*(0.9+rng()*0.3));
  return {name:`${m[0]} ${b[0]}`,type:b[1],power,shape:b[2],color:b[3],desc:`A ${m[0].toLowerCase()} ${b[1].toLowerCase()} made by a village craftsperson.`,kind:"weapon"};
}

// ---- Armour / clothes ----
const A=(name,slot,armor,color,desc)=>({name,slot,armor,color,desc,kind:"armor"});
export const ARMOR = [
  A("Vale Tunic","Body",3,0x7a9cc6,"Blue tunic of the Vale."), A("Vale Cap","Head",1,0x7a9cc6,"A soft blue cap."), A("Vale Boots","Feet",1,0x6b4a2a,"Sturdy walking boots."),
  A("Scout Leathers","Body",4,0x7a6a4a,"Light leathers for quiet paths."), A("Scout Hood","Head",2,0x7a6a4a,"Keeps the rain off."),
  A("Academy Robes","Body",2,0x8a7aff,"Robes with many pockets for notes."), A("Academy Hat","Head",2,0x8a7aff,"A tall, friendly hat."),
  A("Herbalist Garb","Body",3,0x6fbf73,"Smells faintly of mint."), A("Performer Silks","Body",2,0xff9ecb,"They swirl when you spin."),
  A("Guardian Platecloth","Body",6,0xb8c0cc,"Cloth over light plates — safe and strong."), A("Guardian Helm","Head",3,0xb8c0cc,"Polished and kind-looking."),
  A("Scholar Robes","Body",2,0x5a7ac6,"Ink stains included, free of charge."), A("Traveller Set","Body",3,0xa08a5a,"Patched in twelve villages."),
  A("Winter Wool Set","Body",4,0xe8f2ff,"Warm as a fireside."), A("Suncloth Armour","Body",5,0xffd479,"Woven with golden thread."),
  A("Riverweave Robes","Body",6,0x4fc3c9,"Flows like water."), A("Mountain Guard Plate","Body",9,0x9aa6b5,"For cliff wardens."),
  A("Aurora Silk Robes","Body",8,0xc792ff,"Shifts colour at dawn."), A("Worldtree Barkcloth","Body",11,0x5ec962,"Grown armour, surprisingly comfy."),
  A("Starlight Mantle","Body",14,0x303a5e,"A mantle of midnight blue with star stitching."),
  A("Crown of the Vale","Head",6,0xffd700,"Legendary circlet of the first Vale council."),
  A("Boots of the Long Road","Feet",4,0x8b5a2b,"Legendary boots — they never blister."),
  A("Gloves of Gentle Craft","Hands",3,0xd2a679,"For careful hands and kind work."),
];
export function proceduralArmor(level,rng=Math.random){
  const base=ARMOR[Math.floor(rng()*ARMOR.length)];
  return {...base, armor: Math.max(1, Math.round(base.armor*(0.8+level*0.08))), name: base.name};
}

// ---- Spells (36) ----
const S=(name,school,cost,power,color,desc)=>({name,school,cost,power,color,desc});
export const SPELLS = [
  S("Spark Bolt","Spark",8,14,0xffe27a,"A friendly bolt of starlight."),
  S("Healing Light","Light",14,25,0x7ee787,"Restores HP to you (and friends nearby in multiplayer)."),
  S("Frost Twinkle","Frost",10,16,0xaee9ff,"Snowflake sparkles that slow a foe's steps."),
  S("Wind Step","Wind",10,0,0xc8ffd8,"A burst of speed for 5 seconds."),
  S("Mana Shield","Light",12,0,0xfff2b0,"A bubble that absorbs the next hit."),
  S("Leaf Mend","Leaf",12,20,0x7ee787,"Leaves swirl and mend your HP."),
  S("Cheer Song","Song",10,0,0xff9ecb,"+Damage for you and nearby friends for 10s."),
  S("Stone Skin","Stone",12,0,0xc9b18a,"+Armour for 15 seconds."),
  S("Teleport Home","Wind",20,0,0xa0b8ff,"Return to the nearest village."),
  S("Sun Ray","Light",16,26,0xffd479,"A beam of warm sunlight."),
  S("Snow Veil","Frost",14,0,0xe8f2ff,"A veil of snow — foes lose track of you."),
  S("Star Shower","Spark",22,34,0xffe27a,"A shower of little stars all around you."),
  S("River Rush","Water",12,18,0x58c6ff,"A playful wave that pushes foes back."),
  S("Ember Glow","Spark",12,19,0xffa657,"Warm glow sparkles (strictly campfire-safe)."),
  S("Thunder Clap","Spark",20,30,0xd8b8ff,"A loud clap of light — foes poof in surprise."),
  S("Bloom Burst","Leaf",16,24,0x9be67a,"Flowers burst and sparkle."),
  S("Crystal Shards","Stone",16,25,0xaee9ff,"Pretty crystal sparkles."),
  S("Moonbeam","Light",18,28,0xe6e9ff,"A calm beam of moonlight."),
  S("Comet Trail","Spark",24,38,0xffa657,"Ride a comet's sparkle into a foe."),
  S("Great Mend","Light",26,55,0x7ee787,"A big, kind heal."),
  S("Aurora Wave","Frost",26,40,0xc792ff,"A wave of aurora light."),
  S("Worldtree Blessing","Leaf",30,0,0x5ec962,"Full shield + heal over time."),
];
export const SPELL_BY_NAME = Object.fromEntries(SPELLS.map(s=>[s.name,s]));

// ---- Enemies (friendly-creature constructs gone grumpy — they poof, never bleed) ----
export const ENEMIES = [
  {type:"Grumpy Slime", hp:30, dmg:5, xp:22, gold:6, color:0x7ee787, scale:1.0, speed:1.6},
  {type:"Mischief Sprite", hp:24, dmg:6, xp:28, gold:9, color:0xff9ecb, scale:0.8, speed:2.6},
  {type:"Pebble Golem", hp:60, dmg:8, xp:45, gold:12, color:0xb8b0a0, scale:1.4, speed:1.1},
  {type:"Bramble Beast", hp:48, dmg:7, xp:40, gold:10, color:0x5ec962, scale:1.2, speed:1.9},
  {type:"Cloud Imp", hp:36, dmg:9, xp:55, gold:14, color:0xd8e9ff, scale:0.9, speed:2.9},
  {type:"Crystal Crab", hp:70, dmg:10, xp:70, gold:18, color:0xaee9ff, scale:1.1, speed:1.4},
  {type:"Wizard's Lantern", hp:85, dmg:12, xp:95, gold:24, color:0xffa657, scale:1.0, speed:2.1},
  {type:"Tower Sentinel", hp:130, dmg:14, xp:150, gold:40, color:0x9aa6ff, scale:1.7, speed:1.5},
];

export const VILLAGES = [
  {name:"Valebrook", x:0, z:60}, {name:"Riverbend", x:-520, z:-340},
  {name:"Highcliff", x:640, z:-520}, {name:"Pinewatch", x:-700, z:520},
  {name:"Sunmere", x:560, z:640},
];

// ---- Main story: the Wizard Malachar (14 chapters, level-gated — a long campaign) ----
export const MAIN_QUESTS = [
  {id:"m1", title:"A Strange Sparkle", lvl:1, xp:120, gold:50, obj:{kind:"talk", target:"Elder Maren", village:"Valebrook"}, text:"Elder Maren in Valebrook saw purple sparkles over the hills. Go and hear her story."},
  {id:"m2", title:"Camps in the Meadow", lvl:2, xp:180, gold:70, obj:{kind:"defeat", enemy:"Grumpy Slime", count:5}, text:"Malachar's grumpy constructs have set up camps. Poof 5 Grumpy Slimes."},
  {id:"m3", title:"The Riverbend Warning", lvl:3, xp:240, gold:90, obj:{kind:"talk", target:"Fisher Tam", village:"Riverbend"}, text:"Carry Maren's warning to Fisher Tam in Riverbend."},
  {id:"m4", title:"Lanterns Gone Wrong", lvl:5, xp:340, gold:130, obj:{kind:"defeat", enemy:"Wizard's Lantern", count:4}, text:"The wizard's lanterns drift loose. Poof 4 of them before they startle the villages."},
  {id:"m5", title:"A Chest Beneath the Pines", lvl:6, xp:420, gold:160, obj:{kind:"chests", count:3}, text:"Old maps mark supply chests near Pinewatch. Open any 3 camp chests."},
  {id:"m6", title:"Highcliff's Signal Fires", lvl:8, xp:520, gold:200, obj:{kind:"visit", village:"Highcliff"}, text:"Travel to Highcliff and check the signal fires above the cliffs."},
  {id:"m7", title:"Crystal Trouble", lvl:10, xp:650, gold:260, obj:{kind:"defeat", enemy:"Crystal Crab", count:6}, text:"Crystal Crabs, polished by wizard magic, block the Sunmere road. Poof 6."},
  {id:"m8", title:"The Scholar's Star Chart", lvl:12, xp:800, gold:320, obj:{kind:"talk", target:"Scholar Ivo", village:"Sunmere"}, text:"Scholar Ivo in Sunmere has charted the wizard's tower by starlight. Hear him out."},
  {id:"m9", title:"Sentinels of the Tower Road", lvl:14, xp:980, gold:400, obj:{kind:"defeat", enemy:"Tower Sentinel", count:5}, text:"Tower Sentinels guard the road north. Poof 5 to clear the way."},
  {id:"m10", title:"Every Village Ready", lvl:16, xp:1150, gold:480, obj:{kind:"talkall"}, text:"Speak to an elder in all 5 villages so everyone is ready."},
  {id:"m11", title:"The Cave of Echoes", lvl:18, xp:1350, gold:560, obj:{kind:"chests", count:5}, text:"Echoes in the caves hide the wizard's supply caches. Open 5 chests total."},
  {id:"m12", title:"Malachar's Generals", lvl:20, xp:1600, gold:700, obj:{kind:"defeat", enemy:"Tower Sentinel", count:10}, text:"Poof 10 more Tower Sentinels — Malachar's finest constructs."},
  {id:"m13", title:"The Dark Tower Door", lvl:22, xp:1900, gold:850, obj:{kind:"visit", village:"Dark Tower"}, text:"Reach the Dark Tower in the far north-east and stand at its door."},
  {id:"m14", title:"A Friendly Duel with Malachar", lvl:25, xp:3000, gold:1500, obj:{kind:"boss"}, text:"Face Malachar at the Dark Tower. He respects a good duel — win, and he has promised (in writing!) to go home and garden instead. No hard feelings, no harm: first to run out of sparkle-shield loses."},
];
// ---- Side quests (from village quest posts) ----
const SIDE_TEMPLATES = [
  {title:"Camp Clearing", obj:{kind:"defeatAny", count:4}, text:"Poof {n} creatures from the camps troubling our roads."},
  {title:"Chest Hunt", obj:{kind:"chests", count:2}, text:"Open {n} camp chests and bring back word of what's inside."},
  {title:"Slime Patrol", obj:{kind:"defeat", enemy:"Grumpy Slime", count:4}, text:"Poof {n} Grumpy Slimes near the village."},
  {title:"Sprite Round-Up", obj:{kind:"defeat", enemy:"Mischief Sprite", count:4}, text:"The sprites keep moving our signposts. Poof {n}."},
  {title:"Golem Gardening", obj:{kind:"defeat", enemy:"Pebble Golem", count:3}, text:"Pebble Golems keep sitting on the flowerbeds. Poof {n}."},
  {title:"A Long Walk", obj:{kind:"visitOther"}, text:"Visit a different village and come back with a story."},
];
export function makeSideQuest(village, lvl, rng=Math.random){
  const t=SIDE_TEMPLATES[Math.floor(rng()*SIDE_TEMPLATES.length)];
  const count=t.obj.count||1;
  return { id:"s"+Date.now()+"_"+Math.floor(rng()*1e6), title:t.title+" — "+village, lvl:Math.max(1,lvl),
    xp:80+lvl*35+count*15, gold:30+lvl*12+count*6,
    obj: JSON.parse(JSON.stringify(t.obj)), text: t.text.replace("{n}",count), side:true, village };
}
export const NPC_NAMES = ["Elder Maren","Fisher Tam","Scholar Ivo","Baker Pip","Herbalist Wren","Smith Ada","Farmer Cole","Teacher June","Cartographer Finn","Beekeeper Rosa","Miller Bram","Librarian Tess"];
export const NPC_LINES = [
  "Lovely day for a walk to the next village, isn't it?",
  "I heard the wizard Malachar only wants attention. And maybe a garden.",
  "The quest post by the well always has work for kind travellers.",
  "Chests in the camps? The creatures guard them, but they just poof into stars.",
  "If you level up, the academy will teach you new sparkles. Press I to see your spells.",
  "Highcliff's view is worth the climb. Mind the paths on the cliffs!",
  "I collect buttons. If your armour has a modifier, it's extra special!",
  "Shops stock better gear the further you travel. Save your gold!",
];
