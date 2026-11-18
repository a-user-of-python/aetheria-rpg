# ✨ Aetheria — 3D Web RPG

**Play: https://a-user-of-python.github.io/aetheria-rpg/**

A giant 3D browser RPG built with [Three.js](https://threejs.org) (WebGL — works in
all modern browsers). The whole 2400×2400 world — mountains, cliffs, paths, 6 caves,
5 villages and a Dark Tower — is created **all at once at load** and kept smooth with
`THREE.LOD`: trees/rocks swap between high-detail smooth models up close and light
versions far away.

## What's in it
- **Character creation** — name, skin tone, hair colour & style, outfit colour, and
  **10 starting classes**, each with its own starting weapon, clothes/armour and spells.
- **Local multiplayer with 5-letter codes** — host creates a room and gets a code;
  friends open the game in another tab/window on the same device and join with the
  code (BroadcastChannel rooms, no server needed). You see each other's characters,
  names, colours and movement live.
- **A massive world** — mountains, cliffs, paths between villages, caves with glow
  crystals, forests, and the Dark Tower in the far north-east. It takes a long time
  to walk across (and Teleport Home helps when you're lost).
- **Enemy camps** — creatures (slimes, sprites, golems…) guard tents and **chests**.
  Camp **density is adjustable in Dev Mode** (press `` ` ``). Combat is
  family-friendly: no blood or gore — foes flash, sparkle, and **poof into stars**.
  All weapons are practice / sparkle tools, suitable for school/work.
- **Villages** — houses, a well, walking villagers you can talk to (E), a **quest
  post** with side quests, and a **shop** selling gear by village tier.
- **Story** — a 14-chapter main campaign against **Malachar**, a very powerful (and
  ultimately garden-curious) evil wizard trying to take over the world. Chapters are
  level-gated (up to Lv 25) with long travel and objectives between them, designed
  as a 2-hour+ campaign; the quest-post system generates side quests endlessly for
  many more hours (10+ hours of questing to see everything, level and collect all).
- **Levelling** — XP from foes & quests; HP/Mana and power rise each level, XP needed
  rises with level (100 × level^1.55). Different foes give different XP.
- **Loot & rarities** — chests & quests drop weapons/armour with rarities
  **Common 50% · Uncommon 27% · Rare 14% · Epic 6% · Legendary 2% · Quest · Shop**
  (shop exclusives). Special items carry **modifiers** (Radiant, Swift, Sturdy,
  Wise, Lucky, Scholar's, Guardian's, Sparkling, Featherlight, Heartwood).
  26 named weapons + procedural material/base combinations (hundreds of variants),
  23+ armour pieces — each weapon type renders with its own 3D shape & colour.
- **Spells** — 22 spells across Spark/Frost/Leaf/Light/Wind/Stone/Water/Song schools;
  classes start with class spells and learn more as they level.
- **Inventory (I / Tab)** — all loot, equip/sell, HP/Mana/XP bars, gold counter,
  spell list and quest log. Shops, gold, and autosave (localStorage) included.

## Controls
WASD / on-screen stick — move · Drag mouse — camera · Space or Attack — attack ·
E — talk/open/use · 1–6 — cast spell · Shift — run · I — inventory · `` ` `` — Dev Mode

## Files
`index.html` · `style.css` · `js/data.js` (classes/weapons/armour/spells/quests/rarities) ·
`js/world.js` (terrain, villages, caves, tower, LOD) · `js/multiplayer.js` (5-letter rooms) ·
`js/game.js` (gameplay, combat, quests, shops, UI)

All rights reserved — viewing/playing only, no reuse without written permission.
