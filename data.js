// ============================================================
//  MicroMMO — data.js
//  All static config, constants, and data arrays.
//  Nothing here should import from other game files.
// ============================================================

// ── HELPERS (needed to build data arrays) ────────────────────
export function slug(n){return n.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");}

// ── UI CONFIG ─────────────────────────────────────────────────
export const UI={
  LOGO:      {emoji:"⚔", image:"img/ui/logo.svg"},
  WALK_BTN:  {emoji:"👣",image:""},   // ← footprints
  NAV_HOME:  {emoji:"🏠",image:""},
  NAV_GEAR:  {emoji:"🎒",image:""},
  NAV_MARKET:{emoji:"🏪",image:""},
  NAV_SOCIAL:{emoji:"👥",image:""},
};
export const PLAYER_AVATAR={emoji:"🧙",image:""};

// ── GAME SETTINGS ────────────────────────────────────────────
export const CFG={
  BASE_ENERGY:25,
  ENERGY_PER_5_LEVELS:1,
  ENERGY_REGEN_MS:1*60*1000,
  MONSTER_CHANCE:0.30,GOLD_CHANCE:0.22,ITEM_CHANCE:0.13,CHOICE_EVENT_CHANCE:0.12,
  MARKET_FEE:0.05,
  PVP_GOLD_STEAL:0.10,
  PVP_COOLDOWN_MS:4*60*60*1000,
  ARENA_COST_GOLD:200,ARENA_COST_EP:1,
  POTION_HEAL_SMALL:0.3,POTION_HEAL_BIG:0.7,
  AVATAR_DROP_CHANCE:0.04,SHOP_SELL_RATE:0.20,
  PROPERTY_SELL_RATE:0.80,PROPERTY_STACK_FEE:0.05,
  CHEST_PRICE:500,
  COMBAT_VICTORY_CLOSE_MS:3000,
  GUILD_CREATE_COST:5000,
  GUILD_MAX_MEMBERS:10,
  GUILD_RAID_COST:1000,
  BOUNTY_MIN:500,
  // Item economy
  SALVAGE_SHARDS_BASE:3,       // shards from salvaging
  UPGRADE_SHARD_COST:5,        // shards per upgrade
  UPGRADE_GOLD_COST_PER_VAL:20,// gold cost = currentVal * this
  UPGRADE_MAX_TIMES:10,        // max upgrades per item
  // Step XP
  STEP_XP_BASE:3,              // base XP per "nothing" step
  STEP_XP_PER_LEVEL:0.5,      // extra XP per player level
  // Combo
  COMBO_TIERS:[1,3,7,15],     // steps to reach each multiplier tier
  COMBO_MULTS:[1,1.5,2,3],    // gold/xp multipliers at each tier
  COMBO_DECAY_ON_DEATH:true,
};

// ── ENGINE CONSTANTS ──────────────────────────────────────────
export const EQUIP_SLOTS =["Helmet","Armour","Weapon","Shield","Greaves","Boots","Amulet","Pet"];
export const SLOT_EMOJI  ={Helmet:"🪖",Armour:"🦺",Weapon:"⚔️",Shield:"🛡️",Greaves:"🦵",Boots:"👢",Amulet:"💍",Pet:"🐾"};
export const RARITY_COLOR={common:"#6b7280",uncommon:"#059669",rare:"#2563eb",epic:"#7c3aed",legendary:"#d97706"};
export const RARITY_SCALE={common:0.8,uncommon:1.2,rare:1.8,epic:2.5,legendary:3.5};
export const TIER_EMOJIS =["🪙","🥉","🥈","🥇","💠","💎","👑"];
export const GUILD_ROLES ={leader:"Leader",admin:"Admin",member:"Member"};

// ── ARENA TIERS ───────────────────────────────────────────────
export const ARENA_TIERS=[
  {name:"Copper",  color:"#cd7f32",wins:0,  expBonus:1.0, goldBonus:1.0},
  {name:"Bronze",  color:"#c9943a",wins:10, expBonus:1.1, goldBonus:1.1},
  {name:"Silver",  color:"#94a3b8",wins:25, expBonus:1.25,goldBonus:1.2},
  {name:"Gold",    color:"#f59e0b",wins:50, expBonus:1.4, goldBonus:1.35},
  {name:"Platinum",color:"#60a5fa",wins:100,expBonus:1.6, goldBonus:1.5},
  {name:"Diamond", color:"#c084fc",wins:200,expBonus:1.85,goldBonus:1.7},
  {name:"Champion",color:"#fbbf24",wins:400,expBonus:2.2, goldBonus:2.0},
];

// ── WEATHER ───────────────────────────────────────────────────
// Each weather lasts one session. Applied on walk screen open.
export const WEATHER_TYPES=[
  {id:"clear",    name:"Clear Skies",   emoji:"☀️", desc:"A fine day for adventuring.",
   goldMult:1.0, expMult:1.0,  monsterMult:1.0, lootMult:1.0, color:"#fbbf24"},
  {id:"rain",     name:"Heavy Rain",    emoji:"🌧️", desc:"Gold washes out of the mud.",
   goldMult:1.4, expMult:1.0,  monsterMult:0.8, lootMult:1.1, color:"#60a5fa"},
  {id:"fog",      name:"Thick Fog",     emoji:"🌫️", desc:"Monsters lurk unseen — but so does treasure.",
   goldMult:1.2, expMult:1.1,  monsterMult:1.3, lootMult:1.2, color:"#94a3b8"},
  {id:"bloodmoon",name:"Blood Moon",    emoji:"🌑", desc:"Double danger. Double glory.",
   goldMult:1.5, expMult:1.5,  monsterMult:1.6, lootMult:1.4, color:"#ef4444"},
  {id:"blessing", name:"Divine Blessing",emoji:"✨",desc:"The gods smile upon you today.",
   goldMult:1.2, expMult:1.5,  monsterMult:0.9, lootMult:1.5, color:"#c084fc"},
];

// ── WALK ZONES ────────────────────────────────────────────────
// minLevel = area requirement; monsterLevelBonus drives enemy power
// Monsters are now capped to the area range, not player level.
export const WALK_AREAS=[
  {id:"greenwood",    name:"Greenwood Vale",   emoji:"🌲",desc:"A peaceful forest. Beware the shadows.",
   minLevel:1,  monsterMinLv:1,  monsterMaxLv:8,  expMult:1.0,goldMult:1.0,lootBonus:0,
   bgCSS:`background:linear-gradient(180deg,#0d2b1a 0%,#1a4a2a 50%,#0f2a18 100%);`,particles:"leaves"},
  {id:"stonecrypt",   name:"Stone Crypt",      emoji:"💀",desc:"Ancient burial grounds. The dead don't rest.",
   minLevel:5,  monsterMinLv:5,  monsterMaxLv:14, expMult:1.3,goldMult:1.2,lootBonus:0.05,
   bgCSS:`background:linear-gradient(180deg,#0e0e1a 0%,#1a1a2e 50%,#0a0a14 100%);`,particles:"spirits"},
  {id:"shadowpeaks",  name:"Shadow Peaks",     emoji:"⛰️",desc:"Treacherous mountains. Monsters roam freely.",
   minLevel:10, monsterMinLv:10, monsterMaxLv:22, expMult:1.7,goldMult:1.5,lootBonus:0.08,
   bgCSS:`background:linear-gradient(180deg,#0a0814 0%,#1a1030 50%,#080612 100%);`,particles:"snow"},
  {id:"voidrift",     name:"The Void Rift",    emoji:"🌀",desc:"Reality tears here. Only legends survive.",
   minLevel:18, monsterMinLv:18, monsterMaxLv:35, expMult:2.2,goldMult:2.0,lootBonus:0.12,
   bgCSS:`background:linear-gradient(180deg,#050514 0%,#0a0520 50%,#020208 100%);`,particles:"void"},
  {id:"ashvolcano",   name:"Ashveil Volcano",  emoji:"🌋",desc:"Rivers of lava. The air burns your lungs.",
   minLevel:25, monsterMinLv:25, monsterMaxLv:50, expMult:2.6,goldMult:2.4,lootBonus:0.15,
   bgCSS:`background:linear-gradient(180deg,#1a0500 0%,#3a0f00 50%,#0f0200 100%);`,particles:"embers"},
  {id:"frostspire",   name:"Frostspire Wastes",emoji:"🧊",desc:"Eternal blizzard. Only the cold survives.",
   minLevel:32, monsterMinLv:32, monsterMaxLv:65, expMult:3.0,goldMult:2.8,lootBonus:0.18,
   bgCSS:`background:linear-gradient(180deg,#050a14 0%,#0a1428 50%,#050a1a 100%);`,particles:"blizzard"},
  {id:"shadowrealm",  name:"Shadow Realm",     emoji:"👁️",desc:"A dimension of pure darkness and terror.",
   minLevel:40, monsterMinLv:40, monsterMaxLv:80, expMult:3.5,goldMult:3.2,lootBonus:0.22,
   bgCSS:`background:linear-gradient(180deg,#080008 0%,#150015 50%,#050005 100%);`,particles:"shadow"},
  {id:"celestialplane",name:"Celestial Plane", emoji:"✨",desc:"The realm of gods. Few mortals see this and live.",
   minLevel:50, monsterMinLv:50, monsterMaxLv:100,expMult:4.0,goldMult:3.8,lootBonus:0.28,
   bgCSS:`background:linear-gradient(180deg,#0a0820 0%,#181030 50%,#080618 100%);`,particles:"stars"},
  {id:"abyssaldepths",name:"Abyssal Depths",   emoji:"🌊",desc:"The ocean floor. Ancient horrors dwell here.",
   minLevel:60, monsterMinLv:60, monsterMaxLv:130,expMult:4.8,goldMult:4.5,lootBonus:0.35,
   bgCSS:`background:linear-gradient(180deg,#000814 0%,#001428 50%,#000510 100%);`,particles:"bubbles"},
  {id:"chaoscore",    name:"The Chaos Core",   emoji:"☄️",desc:"The end of all things. Pure destruction incarnate.",
   minLevel:75, monsterMinLv:75, monsterMaxLv:200,expMult:6.0,goldMult:5.5,lootBonus:0.45,
   bgCSS:`background:linear-gradient(180deg,#0f0000 0%,#1f0505 50%,#0a0000 100%);`,particles:"chaos"},
];

// ── PROPERTIES ───────────────────────────────────────────────
export const PROPERTIES=[
  {id:"prop_hovel",   name:"Wanderer's Hovel",  emoji:"🪨",price:500,   energyBonus:2,  rentalRate:0.05,desc:"A damp cave you've claimed."},
  {id:"prop_shack",   name:"Rustic Shack",       emoji:"🛖",price:1500,  energyBonus:5,  rentalRate:0.05,desc:"Four walls and a leaky roof."},
  {id:"prop_cottage", name:"Stoneleaf Cottage",  emoji:"🏡",price:4000,  energyBonus:10, rentalRate:0.05,desc:"A cozy cottage by a brook."},
  {id:"prop_inn",     name:"Traveller's Inn",    emoji:"🏠",price:10000, energyBonus:18, rentalRate:0.05,desc:"A proper inn. Guests pay."},
  {id:"prop_manor",   name:"Thornwood Manor",    emoji:"🏰",price:25000, energyBonus:30, rentalRate:0.05,desc:"A sprawling manor."},
  {id:"prop_keep",    name:"Ironspire Keep",     emoji:"🗼",price:60000, energyBonus:50, rentalRate:0.05,desc:"A fortified keep."},
  {id:"prop_citadel", name:"Celestial Citadel",  emoji:"✨",price:150000,energyBonus:100,rentalRate:0.05,desc:"Touched by the gods."},
];

// ── SHOP CONSUMABLES ─────────────────────────────────────────
export const SHOP_CONSUMABLES=[
  {id:"potion_small", name:"Minor Healing Potion",emoji:"🧪",desc:"Restores 30% max HP",price:120, effect:"heal_small"},
  {id:"potion_big",   name:"Major Healing Potion", emoji:"💊",desc:"Restores 70% max HP",price:350, effect:"heal_big"},
  {id:"energy_refill",name:"Energy Crystal",       emoji:"⚡",desc:"Refills all energy",  price:200, effect:"energy_full"},
  {id:"exp_scroll",   name:"Tome of Knowledge",    emoji:"📜",desc:"Grants 200 EXP",      price:500, effect:"exp_200"},
];

// ── MONSTERS ─────────────────────────────────────────────────
// str/def/hp/exp/gold are now [base, perLevel] pairs.
// spawnMonster() in engine.js scales them by effective area level.
export const MONSTERS=[
  {name:"Goblin Scout",    emoji:"👺",image:"",desc:"A sneaky little menace.",
   str:[3,0.8], def:[1,0.5], hp:[20,4],   exp:[10,2.5], gold:[3,1.5], areaIds:["greenwood","stonecrypt"]},
  {name:"Forest Wolf",     emoji:"🐺",image:"",desc:"Runs in packs. Alone now.",
   str:[6,1.0], def:[2,0.6], hp:[35,5],   exp:[25,3.5], gold:[8,2.0], areaIds:["greenwood","stonecrypt","shadowpeaks"]},
  {name:"Cave Bat",        emoji:"🦇",image:"",desc:"Dives from the dark.",
   str:[4,0.9], def:[1,0.5], hp:[15,3.5], exp:[15,2.5], gold:[4,1.5], areaIds:["greenwood","stonecrypt"]},
  {name:"Stone Golem",     emoji:"🗿",image:"",desc:"Slow but devastating.",
   str:[5,1.1], def:[10,1.5],hp:[55,8],   exp:[40,5.0], gold:[15,2.5],areaIds:["stonecrypt","shadowpeaks"]},
  {name:"Shadow Wraith",   emoji:"👻",image:"",desc:"Feeds on life force.",
   str:[14,1.8],def:[3,0.8], hp:[45,7],   exp:[55,6.5], gold:[20,3.5],areaIds:["stonecrypt","shadowpeaks","voidrift"]},
  {name:"Venomfang Spider",emoji:"🕷️",image:"",desc:"Its bite carries rot.",
   str:[9,1.4], def:[4,0.9], hp:[38,6],   exp:[35,4.5], gold:[12,2.5],areaIds:["stonecrypt","shadowpeaks"]},
  {name:"Troll Brute",     emoji:"👹",image:"",desc:"Regenerates. Hit it fast.",
   str:[13,1.7],def:[8,1.3], hp:[75,10],  exp:[60,7.0], gold:[25,4.0],areaIds:["shadowpeaks","voidrift"]},
  {name:"Dragon Whelp",    emoji:"🐉",image:"",desc:"Young dragon. Still lethal.",
   str:[18,2.2],def:[7,1.4], hp:[85,12],  exp:[80,9.0], gold:[35,5.5],areaIds:["shadowpeaks","voidrift","ashvolcano"]},
  {name:"Skeleton Knight", emoji:"💀",image:"",desc:"Fought a hundred wars.",
   str:[12,1.6],def:[12,1.8],hp:[65,9],   exp:[65,7.5], gold:[28,4.5],areaIds:["stonecrypt","shadowpeaks","voidrift"]},
  {name:"Dark Sorcerer",   emoji:"🧙",image:"",desc:"Commands ancient spells.",
   str:[26,2.8],def:[3,0.7], hp:[60,9],   exp:[90,10],  gold:[45,6.5],areaIds:["voidrift","ashvolcano"]},
  {name:"Banshee Queen",   emoji:"👸",image:"",desc:"Her scream alone can end you.",
   str:[22,2.5],def:[4,1.0], hp:[95,13],  exp:[100,11], gold:[50,7.0],areaIds:["voidrift","ashvolcano","frostspire"]},
  {name:"Lich Lord",       emoji:"💀",image:"",desc:"Mastered death itself.",
   str:[28,3.2],def:[9,1.6], hp:[130,16], exp:[130,14], gold:[65,9.0],areaIds:["ashvolcano","frostspire"]},
  {name:"Elder Dragon",    emoji:"🐲",image:"",desc:"A living catastrophe.",
   str:[38,4.0],def:[14,2.2],hp:[220,25], exp:[220,22], gold:[110,14],areaIds:["frostspire","shadowrealm"]},
  {name:"Void Titan",      emoji:"🌀",image:"",desc:"Born from the rift.",
   str:[48,5.0],def:[18,2.8],hp:[300,32], exp:[300,28], gold:[150,18],areaIds:["shadowrealm","celestialplane"]},
  {name:"Frost Wyrm",      emoji:"🧊",image:"",desc:"Freezes all it touches.",
   str:[52,5.5],def:[22,3.2],hp:[340,36], exp:[340,32], gold:[170,20],areaIds:["frostspire","shadowrealm"]},
  {name:"Shadow Demon",    emoji:"😈",image:"",desc:"Pure malice given form.",
   str:[58,6.0],def:[25,3.5],hp:[380,40], exp:[380,36], gold:[190,23],areaIds:["shadowrealm","celestialplane"]},
  {name:"Celestial Titan", emoji:"✨",image:"",desc:"A god that fell.",
   str:[65,7.0],def:[32,4.5],hp:[500,55], exp:[500,48], gold:[250,30],areaIds:["celestialplane","abyssaldepths"]},
  {name:"Abyssal Horror",  emoji:"🌊",image:"",desc:"Should not exist.",
   str:[78,8.0],def:[40,5.5],hp:[650,70], exp:[650,62], gold:[320,38],areaIds:["abyssaldepths","chaoscore"]},
  {name:"Chaos Incarnate", emoji:"☄️",image:"",desc:"The end. The beginning.",
   str:[95,9.5],def:[52,7.0],hp:[850,90], exp:[850,82], gold:[420,50],areaIds:["chaoscore"]},
];

// ── AVATARS ──────────────────────────────────────────────────
export const AVATARS=[
  {id:"av_wolf",     name:"Shadow Wolf",     emoji:"🐺",rarity:"rare",      dropRate:8,  desc:"Runs alone through the dark."},
  {id:"av_knight",   name:"Iron Knight",     emoji:"⚔️",rarity:"uncommon",  dropRate:15, desc:"Clad in unbreakable iron."},
  {id:"av_mage",     name:"Arcane Mage",     emoji:"🧙",rarity:"uncommon",  dropRate:15, desc:"Power through knowledge."},
  {id:"av_rogue",    name:"Shadow Rogue",    emoji:"🗡️",rarity:"uncommon",  dropRate:15, desc:"Strikes before you see them."},
  {id:"av_dragon",   name:"Dragon Rider",    emoji:"🐉",rarity:"epic",      dropRate:3,  desc:"Tamed the untameable."},
  {id:"av_phoenix",  name:"Phoenix Born",    emoji:"🔥",rarity:"epic",      dropRate:3,  desc:"Death is just a setback."},
  {id:"av_void",     name:"Void Walker",     emoji:"🌀",rarity:"epic",      dropRate:3,  desc:"Steps between worlds."},
  {id:"av_celestial",name:"Celestial",       emoji:"✨",rarity:"legendary", dropRate:1,  desc:"Touched by the gods."},
  {id:"av_chaos",    name:"Chaos Lord",      emoji:"☄️",rarity:"legendary", dropRate:0.5,desc:"Destruction incarnate."},
  {id:"av_goblin",   name:"Goblin King",     emoji:"👺",rarity:"common",    dropRate:20, desc:"Surprisingly regal."},
  {id:"av_skeleton", name:"Bone Lord",       emoji:"💀",rarity:"rare",      dropRate:8,  desc:"Rattles ominously."},
  {id:"av_nature",   name:"Forest Guardian", emoji:"🌿",rarity:"uncommon",  dropRate:15, desc:"One with the woods."},
].map(a=>({...a,image:""}));

// ── ITEMS ─────────────────────────────────────────────────────
export const ITEMS=[
  // ── HELMETS ──────────────────────────────────────────────
  {name:"Leather Cap",           type:"Helmet", stat:"def", base:3,  minLevel:1,  rarity:"common",    emoji:"🪖", dropRate:16, shopPrice:60},
  {name:"Iron Helmet",           type:"Helmet", stat:"def", base:5,  minLevel:3,  rarity:"common",    emoji:"⛑️", dropRate:15, shopPrice:90},
  {name:"Chainmail Coif",        type:"Helmet", stat:"def", base:7,  minLevel:5,  rarity:"uncommon",  emoji:"🪖", dropRate:12, shopPrice:200},
  {name:"Steel Helm",            type:"Helmet", stat:"def", base:9,  minLevel:7,  rarity:"uncommon",  emoji:"⛑️", dropRate:11, shopPrice:260},
  {name:"Warhelm of Thorns",     type:"Helmet", stat:"def", base:12, minLevel:10, rarity:"rare",      emoji:"🪖", dropRate:5},
  {name:"Shadowveil Hood",       type:"Helmet", stat:"str", base:10, minLevel:12, rarity:"rare",      emoji:"🎭", dropRate:5},
  {name:"Crown of Flames",       type:"Helmet", stat:"str", base:18, minLevel:20, rarity:"epic",      emoji:"👑", dropRate:2},
  {name:"Voidmask",              type:"Helmet", stat:"def", base:22, minLevel:28, rarity:"epic",      emoji:"🌀", dropRate:2},
  {name:"Helm of the Ancients",  type:"Helmet", stat:"def", base:35, minLevel:40, rarity:"legendary", emoji:"💀", dropRate:0.3},
  {name:"Godcrown",              type:"Helmet", stat:"str", base:50, minLevel:60, rarity:"legendary", emoji:"✨", dropRate:0.2},
  // ── ARMOUR ───────────────────────────────────────────────
  {name:"Cloth Robe",            type:"Armour", stat:"def", base:3,  minLevel:1,  rarity:"common",    emoji:"👘", dropRate:16, shopPrice:55},
  {name:"Leather Vest",          type:"Armour", stat:"def", base:5,  minLevel:2,  rarity:"common",    emoji:"🦺", dropRate:15, shopPrice:80},
  {name:"Chainmail Hauberk",     type:"Armour", stat:"def", base:8,  minLevel:5,  rarity:"uncommon",  emoji:"🦺", dropRate:12, shopPrice:250},
  {name:"Plate Armour",          type:"Armour", stat:"def", base:11, minLevel:8,  rarity:"uncommon",  emoji:"🦺", dropRate:11, shopPrice:340},
  {name:"Dragonscale Vest",      type:"Armour", stat:"def", base:15, minLevel:12, rarity:"rare",      emoji:"🐉", dropRate:5},
  {name:"Voidweave Robe",        type:"Armour", stat:"str", base:13, minLevel:14, rarity:"rare",      emoji:"🌀", dropRate:5},
  {name:"Celestial Breastplate", type:"Armour", stat:"def", base:24, minLevel:22, rarity:"epic",      emoji:"✨", dropRate:2},
  {name:"Armour of Chaos",       type:"Armour", stat:"str", base:28, minLevel:30, rarity:"epic",      emoji:"☄️", dropRate:2},
  {name:"Aegis of Eternity",     type:"Armour", stat:"def", base:42, minLevel:45, rarity:"legendary", emoji:"🛡️", dropRate:0.3},
  {name:"Godplate",              type:"Armour", stat:"def", base:60, minLevel:65, rarity:"legendary", emoji:"👑", dropRate:0.2},
  // ── WEAPONS ──────────────────────────────────────────────
  {name:"Rusty Dagger",          type:"Weapon", stat:"str", base:3,  minLevel:1,  rarity:"common",    emoji:"🗡️", dropRate:16, shopPrice:50},
  {name:"Short Sword",           type:"Weapon", stat:"str", base:5,  minLevel:2,  rarity:"common",    emoji:"⚔️", dropRate:15, shopPrice:75},
  {name:"Axe",                   type:"Weapon", stat:"str", base:7,  minLevel:4,  rarity:"common",    emoji:"🪓", dropRate:14, shopPrice:110},
  {name:"Steel Sword",           type:"Weapon", stat:"str", base:9,  minLevel:6,  rarity:"uncommon",  emoji:"⚔️", dropRate:11, shopPrice:280},
  {name:"War Hammer",            type:"Weapon", stat:"str", base:11, minLevel:8,  rarity:"uncommon",  emoji:"🔨", dropRate:10, shopPrice:340},
  {name:"Shadow Blade",          type:"Weapon", stat:"str", base:14, minLevel:11, rarity:"rare",      emoji:"🗡️", dropRate:5},
  {name:"Flame Sword",           type:"Weapon", stat:"str", base:17, minLevel:15, rarity:"rare",      emoji:"🔥", dropRate:5},
  {name:"Voidcleaver",           type:"Weapon", stat:"str", base:22, minLevel:20, rarity:"rare",      emoji:"🌀", dropRate:4},
  {name:"Godslayer",             type:"Weapon", stat:"str", base:30, minLevel:28, rarity:"epic",      emoji:"⚡", dropRate:2},
  {name:"Stormbreaker",          type:"Weapon", stat:"str", base:35, minLevel:35, rarity:"epic",      emoji:"🌩️", dropRate:2},
  {name:"Blade of Eternity",     type:"Weapon", stat:"str", base:50, minLevel:50, rarity:"legendary", emoji:"✨", dropRate:0.3},
  {name:"Chaos Edge",            type:"Weapon", stat:"str", base:70, minLevel:70, rarity:"legendary", emoji:"☄️", dropRate:0.2},
  // ── SHIELDS ──────────────────────────────────────────────
  {name:"Wooden Shield",         type:"Shield", stat:"def", base:3,  minLevel:1,  rarity:"common",    emoji:"🛡️", dropRate:16, shopPrice:50},
  {name:"Iron Shield",           type:"Shield", stat:"def", base:5,  minLevel:3,  rarity:"common",    emoji:"🛡️", dropRate:15, shopPrice:80},
  {name:"Tower Shield",          type:"Shield", stat:"def", base:8,  minLevel:6,  rarity:"uncommon",  emoji:"🛡️", dropRate:12, shopPrice:240},
  {name:"Dragon Shield",         type:"Shield", stat:"def", base:13, minLevel:11, rarity:"rare",      emoji:"🐉", dropRate:5},
  {name:"Void Barrier",          type:"Shield", stat:"def", base:20, minLevel:20, rarity:"epic",      emoji:"🌀", dropRate:2},
  {name:"Aegis of Light",        type:"Shield", stat:"def", base:32, minLevel:35, rarity:"legendary", emoji:"✨", dropRate:0.3},
  // ── GREAVES ──────────────────────────────────────────────
  {name:"Cloth Leggings",        type:"Greaves",stat:"def", base:2,  minLevel:1,  rarity:"common",    emoji:"👖", dropRate:16, shopPrice:40},
  {name:"Leather Greaves",       type:"Greaves",stat:"def", base:4,  minLevel:3,  rarity:"common",    emoji:"🦵", dropRate:15, shopPrice:65},
  {name:"Iron Greaves",          type:"Greaves",stat:"def", base:7,  minLevel:6,  rarity:"uncommon",  emoji:"🦵", dropRate:11, shopPrice:220},
  {name:"Stormstride Greaves",   type:"Greaves",stat:"def", base:12, minLevel:12, rarity:"rare",      emoji:"⚡", dropRate:5},
  {name:"Void Legplates",        type:"Greaves",stat:"def", base:20, minLevel:22, rarity:"epic",      emoji:"🌀", dropRate:2},
  {name:"Greaves of Eternity",   type:"Greaves",stat:"def", base:32, minLevel:40, rarity:"legendary", emoji:"✨", dropRate:0.3},
  // ── BOOTS ────────────────────────────────────────────────
  {name:"Simple Boots",          type:"Boots",  stat:"def", base:2,  minLevel:1,  rarity:"common",    emoji:"👟", dropRate:16, shopPrice:45},
  {name:"Leather Boots",         type:"Boots",  stat:"def", base:3,  minLevel:2,  rarity:"common",    emoji:"👢", dropRate:16, shopPrice:55},
  {name:"Traveller's Boots",     type:"Boots",  stat:"def", base:4,  minLevel:3,  rarity:"common",    emoji:"👢", dropRate:14, shopPrice:70},
  {name:"Iron Boots",            type:"Boots",  stat:"def", base:6,  minLevel:5,  rarity:"uncommon",  emoji:"👢", dropRate:11, shopPrice:220},
  {name:"Swiftfoot Boots",       type:"Boots",  stat:"def", base:9,  minLevel:8,  rarity:"uncommon",  emoji:"👢", dropRate:10, shopPrice:280},
  {name:"Stormshard Boots",      type:"Boots",  stat:"def", base:12, minLevel:12, rarity:"rare",      emoji:"👢", dropRate:5},
  {name:"Voidstep Boots",        type:"Boots",  stat:"def", base:19, minLevel:22, rarity:"rare",      emoji:"👢", dropRate:4},
  {name:"Celestial Walkers",     type:"Boots",  stat:"def", base:25, minLevel:30, rarity:"epic",      emoji:"✨", dropRate:2},
  {name:"Boots of Eternity",     type:"Boots",  stat:"def", base:35, minLevel:45, rarity:"legendary", emoji:"🌟", dropRate:0.3},
  {name:"Godwalkers",            type:"Boots",  stat:"def", base:50, minLevel:65, rarity:"legendary", emoji:"⚡", dropRate:0.2},
  // ── AMULETS ──────────────────────────────────────────────
  {name:"Copper Amulet",         type:"Amulet", stat:"def", base:2,  minLevel:1,  rarity:"common",    emoji:"📿", dropRate:14, shopPrice:50},
  {name:"Bone Necklace",         type:"Amulet", stat:"str", base:3,  minLevel:1,  rarity:"common",    emoji:"💀", dropRate:14, shopPrice:55},
  {name:"Mithril Ring",          type:"Amulet", stat:"def", base:7,  minLevel:5,  rarity:"uncommon",  emoji:"💍", dropRate:10, shopPrice:280},
  {name:"Warrior's Pendant",     type:"Amulet", stat:"str", base:8,  minLevel:5,  rarity:"uncommon",  emoji:"⚔️", dropRate:10, shopPrice:300},
  {name:"Runic Amulet",          type:"Amulet", stat:"str", base:12, minLevel:10, rarity:"rare",      emoji:"🔮", dropRate:5},
  {name:"Voidstone Pendant",     type:"Amulet", stat:"str", base:15, minLevel:14, rarity:"rare",      emoji:"🌀", dropRate:5},
  {name:"Soulfire Necklace",     type:"Amulet", stat:"str", base:18, minLevel:18, rarity:"rare",      emoji:"🔥", dropRate:4},
  {name:"Void Amulet",           type:"Amulet", stat:"str", base:26, minLevel:28, rarity:"epic",      emoji:"💜", dropRate:2},
  {name:"Stormcaller's Eye",     type:"Amulet", stat:"str", base:30, minLevel:32, rarity:"epic",      emoji:"⚡", dropRate:2},
  {name:"Amulet of the Fallen",  type:"Amulet", stat:"str", base:40, minLevel:20, rarity:"legendary", emoji:"💀", dropRate:0.3},
  {name:"Eye of the Void",       type:"Amulet", stat:"str", base:50, minLevel:50, rarity:"legendary", emoji:"👁️", dropRate:0.3},
  {name:"Godchain",              type:"Amulet", stat:"def", base:55, minLevel:60, rarity:"legendary", emoji:"✨", dropRate:0.2},
].map(item=>({...item,image:""}));

// ── PETS ─────────────────────────────────────────────────────
export const PETS=[
  {name:"Baby Slime",    type:"Pet",stat:"def",base:6,  rarity:"uncommon", emoji:"🟢",dropRate:8, desc:"Wobbly but loyal."},
  {name:"Forest Sprite", type:"Pet",stat:"str",base:7,  rarity:"uncommon", emoji:"🧚",dropRate:7, desc:"Zips around your shoulder."},
  {name:"Tamed Rat",     type:"Pet",stat:"def",base:5,  rarity:"uncommon", emoji:"🐀",dropRate:8, desc:"Surprisingly useful."},
  {name:"Shadow Cat",    type:"Pet",stat:"str",base:14, rarity:"rare",     emoji:"🐈",dropRate:4, desc:"Vanishes in dim light."},
  {name:"Storm Hawk",    type:"Pet",stat:"str",base:16, rarity:"rare",     emoji:"🦅",dropRate:3, desc:"Dives at your enemies."},
  {name:"Crystal Turtle",type:"Pet",stat:"def",base:18, rarity:"rare",     emoji:"🐢",dropRate:3, desc:"A walking shield."},
  {name:"Baby Dragon",   type:"Pet",stat:"str",base:20, rarity:"rare",     emoji:"🐉",dropRate:2, desc:"Breathes tiny flames."},
  {name:"Void Familiar", type:"Pet",stat:"str",base:30, rarity:"epic",     emoji:"👁️",dropRate:1, desc:"Sees through walls."},
  {name:"Lava Pup",      type:"Pet",stat:"str",base:28, rarity:"epic",     emoji:"🔥",dropRate:1, desc:"Always warm. Always angry."},
  {name:"Frost Wolf",    type:"Pet",stat:"def",base:32, rarity:"epic",     emoji:"🐺",dropRate:1, desc:"Howls before every battle."},
  {name:"Ancient Phoenix",type:"Pet",stat:"str",base:50,rarity:"legendary",emoji:"🦅",dropRate:0.2,desc:"Reborn every battle."},
  {name:"Celestial Crab", type:"Pet",stat:"def",base:55,rarity:"legendary",emoji:"🦀",dropRate:0.2,desc:"Claws from another dimension."},
].map(p=>({...p,image:""}));

// ── CHOICE EVENTS ─────────────────────────────────────────────
function rand(a,b){return Math.floor(Math.random()*(b-a+1))+a;}

export const CHOICE_EVENTS=[
  {id:"wounded_knight",emoji:"⚔️",title:"A Wounded Knight",desc:"A knight slumped against a tree. Badly hurt.",choices:[{label:"Help him",outcome:()=>{const r=Math.random();return r<0.5?{msg:"He thanks you and presses a coin pouch into your hand.",gold:()=>rand(40,100),hp:0}:{msg:"He thanks you weakly. That's all he has to give.",gold:0,hp:0};}},{label:"Leave him",outcome:()=>({msg:"You walk past. Some things aren't your problem.",gold:0,hp:0})}]},
  {id:"cursed_coin",emoji:"🪙",title:"A Glowing Coin",desc:"A single gold coin glows faintly in the path.",choices:[{label:"Pick it up",outcome:()=>{const r=Math.random();return r<0.4?{msg:"Just a coin. Lucky you!",gold:()=>rand(20,80),hp:0}:r<0.7?{msg:"It burns your hand! Cursed gold.",gold:0,hp:()=>-rand(10,30)}:{msg:"It vanishes the moment you touch it.",gold:0,hp:0};}},{label:"Leave it",outcome:()=>({msg:"Some things are too good to be true.",gold:0,hp:0})}]},
  {id:"ancient_well",emoji:"🪣",title:"An Ancient Well",desc:"A stone well covered in moss. Drink?",choices:[{label:"Drink from it",outcome:()=>{const r=Math.random();return r<0.5?{msg:"Cool and sweet. You feel refreshed.",gold:0,hp:()=>rand(20,50)}:r<0.75?{msg:"Tastes foul. Your stomach protests.",gold:0,hp:()=>-rand(10,25)}:{msg:"Nothing happens. Just water.",gold:0,hp:0};}},{label:"Move on",outcome:()=>({msg:"Probably wise.",gold:0,hp:0})}]},
  {id:"travelling_merchant",emoji:"🛒",title:"A Travelling Merchant",desc:"Offers a mystery item for 75 gold. No refunds.",choices:[{label:"Buy it (75g)",outcome:(p)=>{if((p.gold||0)<75)return{msg:"Not enough gold.",gold:0,hp:0};const r=Math.random();return r<0.4?{msg:"A health tonic!",gold:-75,hp:()=>rand(30,60)}:r<0.7?{msg:"A bag of gold! Net gain.",gold:()=>rand(5,75),hp:0}:{msg:"A rock. A painted rock.",gold:-75,hp:0};}},{label:"Decline",outcome:()=>({msg:"He tips his hat and disappears.",gold:0,hp:0})}]},
  {id:"haunted_tree",emoji:"🌳",title:"A Whispering Tree",desc:"An ancient tree seems to whisper your name.",choices:[{label:"Listen closely",outcome:()=>{const r=Math.random();return r<0.33?{msg:"It reveals buried gold nearby!",gold:()=>rand(50,150),hp:0}:r<0.66?{msg:"The whispers grow to screams. You flee, shaken.",gold:0,hp:()=>-rand(15,35)}:{msg:"It says: keep walking.",gold:0,hp:0};}},{label:"Back away",outcome:()=>({msg:"Smart. Whispering trees are never a good sign.",gold:0,hp:0})}]},
  {id:"wounded_creature",emoji:"🐺",title:"A Wounded Animal",desc:"A small creature caught in a trap whimpers at you.",choices:[{label:"Free it",outcome:()=>{const r=Math.random();return r<0.5?{msg:"It licks your hand before bounding off.",gold:0,hp:()=>rand(10,25)}:r<0.75?{msg:"It bites you for your trouble.",gold:0,hp:()=>-rand(5,15)}:{msg:"It drops something shiny as it flees.",gold:()=>rand(20,60),hp:0};}},{label:"Leave it",outcome:()=>({msg:"Nature is cruel. So are you, apparently.",gold:0,hp:0})}]},
  {id:"fortune_teller",emoji:"🔮",title:"A Fortune Teller",desc:"Offers to read your future for 30 gold.",choices:[{label:"Pay 30 gold",outcome:(p)=>{if((p.gold||0)<30)return{msg:"She looks at your empty pockets and sighs.",gold:0,hp:0};const f=["Gold finds those who walk far.","Your next battle will test you.","A great item awaits around the corner.","You will live. Probably."][Math.floor(Math.random()*4)];return{msg:`"${f}"`,gold:-30,hp:0};}},{label:"Keep walking",outcome:()=>({msg:"Your future remains unread.",gold:0,hp:0})}]},
  {id:"rope_bridge",emoji:"🌉",title:"A Rope Bridge",desc:"Rickety bridge over a deep gorge. Cross it?",choices:[{label:"Cross it",outcome:()=>{const r=Math.random();return r<0.6?{msg:"It holds! Something glints on the other side.",gold:()=>rand(30,80),hp:0}:r<0.85?{msg:"A rope snaps! You make it but bruised.",gold:0,hp:()=>-rand(15,30)}:{msg:"You cross safely. Nothing on the other side.",gold:0,hp:0};}},{label:"Go around",outcome:()=>({msg:"Takes longer but your bones are intact.",gold:0,hp:0})}]},
  {id:"alchemist_fire",emoji:"🧪",title:"Bubbling Vials",desc:"An abandoned alchemist's pack. Drink one?",choices:[{label:"Drink a vial",outcome:()=>{const r=Math.random();return r<0.35?{msg:"A healing elixir!",gold:0,hp:()=>rand(30,70)}:r<0.6?{msg:"Tastes like burning. Is burning.",gold:0,hp:()=>-rand(20,40)}:r<0.8?{msg:"Nothing. Probably coloured water.",gold:0,hp:0}:{msg:"Gold hidden in the pack too!",gold:()=>rand(40,100),hp:()=>rand(10,30)};}},{label:"Leave them",outcome:()=>({msg:"Wise. Unlabelled potions are never safe.",gold:0,hp:0})}]},
  {id:"sleeping_giant",emoji:"👹",title:"A Sleeping Giant",desc:"A massive creature sleeps. Its pockets look full.",choices:[{label:"Pick its pocket",outcome:()=>{const r=Math.random();return r<0.5?{msg:"Success! Heavy coin pouch secured.",gold:()=>rand(80,200),hp:0}:{msg:"It wakes up! You run. It throws a rock.",gold:0,hp:()=>-rand(20,45)};}},{label:"Sneak past",outcome:()=>({msg:"You tiptoe past. Living to fight another day.",gold:0,hp:0})}]},
  {id:"wishing_fountain",emoji:"⛲",title:"A Wishing Fountain",desc:"A pristine fountain. Make a wish?",choices:[{label:"Toss in 10 gold",outcome:(p)=>{if((p.gold||0)<10)return{msg:"Not even 10 gold to spare.",gold:0,hp:0};const r=Math.random();return r<0.3?{msg:"The water glows! Wish granted.",gold:()=>rand(50,200),hp:0}:r<0.6?{msg:"You feel healthier.",gold:-10,hp:()=>rand(20,50)}:{msg:"Nothing happens.",gold:-10,hp:0};}},{label:"Just look",outcome:()=>({msg:"Pretty fountain. You move on.",gold:0,hp:0})}]},
  {id:"dark_pact",emoji:"😈",title:"A Voice in the Dark",desc:"A voice offers power in exchange for something.",choices:[{label:"Accept",outcome:()=>{const r=Math.random();return r<0.4?{msg:"Power surges through you!",gold:()=>rand(100,250),hp:0}:{msg:"Something leaves you. Worth it?",gold:0,hp:()=>-rand(30,60)};}},{label:"Refuse",outcome:()=>({msg:"The voice sighs. Smart choice. Probably.",gold:0,hp:0})}]},
  {id:"chest",emoji:"📦",title:"A Weathered Chest",desc:"Half-buried in the dirt. Investigate?",choices:[{label:"Open it",outcome:()=>({msg:"Gold inside!",gold:()=>rand(30,120),hp:0})},{label:"Leave it",outcome:()=>({msg:"Better safe than sorry.",gold:0,hp:0})}]},
  {id:"shrine",emoji:"⛩️",title:"Ancient Shrine",desc:"A crumbling shrine. Leave an offering of 50 gold?",choices:[{label:"Offer 50 gold",outcome:(p)=>{if((p.gold||0)<50)return{msg:"Not enough gold.",gold:0,hp:0};return{msg:"The shrine glows. You feel restored!",gold:-50,hp:()=>rand(20,60)};}},{label:"Ignore it",outcome:()=>({msg:"You pass by.",gold:0,hp:0})}]},
  {id:"gambler",emoji:"🎲",title:"Roadside Gambler",desc:"Offers to double 100 gold. Bet?",choices:[{label:"Bet 100 gold",outcome:(p)=>{if((p.gold||0)<100)return{msg:"Too broke to gamble.",gold:0,hp:0};const win=Math.random()<0.45;return{msg:win?"You won!":"The dice were loaded.",gold:win?100:-100,hp:0};}},{label:"Walk away",outcome:()=>({msg:"Some risks aren't worth it.",gold:0,hp:0})}]},
  {id:"mushroom",emoji:"🍄",title:"Glowing Mushroom",desc:"A bioluminescent mushroom pulses. Eat it?",choices:[{label:"Eat it",outcome:()=>{const r=Math.random();return{msg:r<0.4?"Delicious! Energised.":r<0.7?"Tastes awful.":"Nothing happens.",gold:0,hp:()=>Math.random()<0.4?rand(15,40):Math.random()<0.5?-rand(10,25):0};}},{label:"Leave it",outcome:()=>({msg:"You resist the glow.",gold:0,hp:0})}]},
  {id:"cave",emoji:"🕳️",title:"Dark Cave Entrance",desc:"A cave mouth yawns in the hillside. Enter?",choices:[{label:"Go in",outcome:()=>{const win=Math.random()<0.5;return{msg:win?"A cache of gold!":"A bat colony erupts! You flee.",gold:win?rand(40,100):-10,hp:win?0:-rand(5,15)};}},{label:"Move on",outcome:()=>({msg:"Some things are best left alone.",gold:0,hp:0})}]},
];

// ── WALK FLAVOUR TEXT ─────────────────────────────────────────
export const WALK_EVENTS=[
  {emoji:"🌿",text:"You walk through the quiet forest."},{emoji:"🍃",text:"Leaves rustle overhead. Nothing stirs."},
  {emoji:"🌧️",text:"A light rain begins to fall."},{emoji:"☀️",text:"The sun breaks through the canopy."},
  {emoji:"🌫️",text:"Fog rolls in from the valley below."},{emoji:"🍂",text:"Autumn leaves crunch under your boots."},
  {emoji:"❄️",text:"Your breath mists in the cold air."},{emoji:"🌙",text:"The moon watches from between the trees."},
  {emoji:"🦋",text:"A butterfly lands on your shoulder, then vanishes."},{emoji:"💀",text:"Bones of something large litter the clearing. Old."},
  {emoji:"👁️",text:"You feel like something is watching. Nothing there."},{emoji:"🕯️",text:"A lit candle sits on a stump. Who left it here?"},
  {emoji:"📦",text:"An empty chest sits open. Already looted."},{emoji:"⚔️",text:"Scorch marks scar the earth. A battle happened here."},
  {emoji:"🏰",text:"Ruins of something old crumble in the distance."},{emoji:"🧭",text:"Your compass spins once, then settles. Odd."},
  {emoji:"📯",text:"A distant horn sounds. Maybe a warning."},{emoji:"🪨",text:"Ancient stones mark the old road."},
  {emoji:"🌸",text:"Cherry blossoms drift across the path."},{emoji:"🎵",text:"You catch yourself humming. Not sure what song."},
  {emoji:"🔥",text:"Smoke rises to the east. Not your problem. Probably."},{emoji:"🐦",text:"A bird lands nearby, stares at you, then leaves. Rude."},
  {emoji:"👟",text:"Your boot comes untied. Again."},{emoji:"🌬️",text:"The wind blows your hair dramatically. Nobody saw it."},
  {emoji:"😴",text:"You yawn so hard your jaw pops. Keep moving."},{emoji:"🤔",text:"You could have sworn you've been here before."},
  {emoji:"💭",text:"You think about what you'd do with a million gold."},{emoji:"🦗",text:"Something bites you. Nothing there when you look."},
  {emoji:"🧦",text:"A single sock hangs from a branch. The mystery deepens."},{emoji:"📍",text:"Someone planted a flag here. For what? Unknown."},
  {emoji:"🗑️",text:"An empty potion bottle. Someone had a rough time here."},{emoji:"🩸",text:"A dark trail leads off the path. You don't follow."},
  {emoji:"🌀",text:"The air shimmers for a moment. Then nothing."},{emoji:"🔔",text:"A bell rings in the distance. No church for miles."},
  {emoji:"🪞",text:"A mirror propped against a tree. You don't look in it."},{emoji:"🧿",text:"An evil eye amulet dangles from a branch. A warning."},
  {emoji:"🕸️",text:"An enormous spiderweb blocks the trail. No spider."},{emoji:"🌑",text:"The shadows move the wrong way for a moment."},
  {emoji:"📿",text:"Prayer beads scattered across the path. Recently dropped."},{emoji:"🚪",text:"A door frame stands alone in the forest. Just the door."},
  {emoji:"🪦",text:"A small grave marker. The name has worn away."},{emoji:"🌡️",text:"The temperature drops ten degrees and returns. Strange."},
  {emoji:"👣",text:"Footprints in the mud. They stop suddenly. Nowhere."},{emoji:"🔮",text:"A crystal ball half buried in the dirt. Cloudy inside."},
  {emoji:"🗺️",text:"A torn map flutters past. Nowhere you recognize."},{emoji:"🏹",text:"An arrow is lodged in a tree. Still quivering."},
  {emoji:"🛡️",text:"A cracked shield leans against a rock. Its owner moved on."},{emoji:"⛺",text:"An abandoned campsite. The fire is still warm."},
  {emoji:"🔑",text:"A rusty key on the ground. No lock in sight."},{emoji:"📜",text:"A torn parchment. The writing is smudged beyond reading."},
  {emoji:"🧲",text:"Your gear tugs slightly in one direction. Odd."},{emoji:"💎",text:"Something glints in the dirt. Just glass. Still pretty."},
  {emoji:"🪤",text:"You nearly step on a trap. Nearly."},{emoji:"🎒",text:"Someone's pack lies abandoned by the road."},
  {emoji:"🔭",text:"A spyglass hanging from a branch."},{emoji:"🦊",text:"A fox crosses your path and gives you a judgemental look."},
  {emoji:"🐺",text:"A distant howl echoes through the trees. Then silence."},{emoji:"🦅",text:"A hawk circles overhead for a while, then moves on."},
  {emoji:"🐍",text:"A snake slithers across the path."},{emoji:"🐗",text:"Something large crashes through the undergrowth. Moves away."},
  {emoji:"🐾",text:"Large paw prints in the mud. Very large."},{emoji:"🦉",text:"An owl watches you from a low branch. In daylight."},
  {emoji:"🐉",text:"Something huge flew overhead — very high up. Gone."},{emoji:"🐜",text:"A column of ants marches across your boot."},
  {emoji:"🌈",text:"A rainbow appears. It points somewhere."},{emoji:"⚡",text:"Lightning strikes nearby. No clouds in sight."},
  {emoji:"🌋",text:"The ground rumbles faintly. Nothing more."},{emoji:"🌤️",text:"Perfect weather today. You almost feel safe."},
  {emoji:"🧙",text:"A hooded figure walks the other way. Doesn't acknowledge you."},{emoji:"👴",text:"An old man sits by the road. Asleep, or pretending."},
  {emoji:"🎪",text:"Distant music carries on the wind. Happy music. Out here."},{emoji:"😤",text:"You trip on a root. No one saw that. Probably."},
  {emoji:"💨",text:"A tumbleweed rolls by. Where did that even come from?"},
];
