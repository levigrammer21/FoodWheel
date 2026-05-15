// ============================================================
//  MicroMMO — game.js  (v2)
//  New in v2:
//    • Auto image paths for all items/monsters/pets/avatars
//    • Properties system (buy, live-in, rent, sell)
//    • Dynamic energy (base 5 + level bonus + housing bonus)
//    • Stat points on level-up
//    • Walk button → Walk Interface with Area Select
//    • Areas affect monster level, XP, loot
//    • Random choice events on steps
//    • Sell to NPC shop at 20% value
// ============================================================

import{initializeApp}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import{getAuth,onAuthStateChanged,signInWithEmailAndPassword,
  createUserWithEmailAndPassword,signInWithPopup,GoogleAuthProvider,signOut
}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import{getFirestore,doc,getDoc,setDoc,deleteDoc,collection,
  getDocs,addDoc,query,where,orderBy,limit,serverTimestamp,Timestamp
}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── FIREBASE CONFIG ──────────────────────────────────────────
const FIREBASE_CONFIG={
  apiKey:"AIzaSyA4-X-N-wAFnmPwZcJ-SnWJKMI-mNa2kQs",
  authDomain:"micrommo-77c6e.firebaseapp.com",
  projectId:"micrommo-77c6e",
  storageBucket:"micrommo-77c6e.firebasestorage.app",
  messagingSenderId:"639233695341",
  appId:"1:639233695341:web:d0df1515a79c9df6afa964"
};

// ── IMAGE HELPER ─────────────────────────────────────────────
// Converts a name to a file-safe slug: "Goblin Scout" → "goblin_scout"
function slug(name){ return name.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,""); }

// ── PLAYER AVATAR ─────────────────────────────────────────────
const PLAYER_AVATAR = { emoji:"🧙", image:"" };
const WALK_BUTTON   = { emoji:"⚔️", image:"" };

// ── WALK AREAS ───────────────────────────────────────────────
// minLevel: minimum player level to unlock
// monsterLevelBonus: added to monster stat scaling
// expMult / goldMult: multipliers on rewards
// gradient: CSS gradient for background
// Add more areas by copying a block!
const WALK_AREAS = [
  {
    id:"greenwood",
    name:"Greenwood Vale",
    emoji:"🌲",
    desc:"A peaceful forest. Beware the shadows.",
    minLevel:1,
    monsterLevelBonus:0,
    expMult:1.0,
    goldMult:1.0,
    lootBonus:0,
    gradient:"linear-gradient(180deg,#0d2b1a 0%,#1a4a2a 40%,#0f2a18 100%)",
  },
  {
    id:"stonecrypt",
    name:"Stone Crypt",
    emoji:"💀",
    desc:"Ancient burial grounds. The dead don't rest.",
    minLevel:5,
    monsterLevelBonus:3,
    expMult:1.3,
    goldMult:1.2,
    lootBonus:0.05,
    gradient:"linear-gradient(180deg,#0e0e1a 0%,#1a1a2e 40%,#0a0a14 100%)",
  },
  {
    id:"shadowpeaks",
    name:"Shadow Peaks",
    emoji:"⛰️",
    desc:"Treacherous mountains. Monsters roam freely.",
    minLevel:10,
    monsterLevelBonus:6,
    expMult:1.7,
    goldMult:1.5,
    lootBonus:0.08,
    gradient:"linear-gradient(180deg,#0a0814 0%,#1a1030 40%,#080612 100%)",
  },
  {
    id:"voidrift",
    name:"The Void Rift",
    emoji:"🌀",
    desc:"Reality tears here. Only legends survive.",
    minLevel:18,
    monsterLevelBonus:12,
    expMult:2.2,
    goldMult:2.0,
    lootBonus:0.12,
    gradient:"linear-gradient(180deg,#050514 0%,#0a0520 40%,#020208 100%)",
  },
  // ── ADD MORE AREAS HERE ───────────────────────────────────
  // {
  //   id:"volcandepths", name:"Volcanic Depths", emoji:"🌋",
  //   desc:"Rivers of lava, impossible heat.",
  //   minLevel:25, monsterLevelBonus:16,
  //   expMult:2.8, goldMult:2.5, lootBonus:0.15,
  //   gradient:"linear-gradient(180deg,#1a0500 0%,#3a0f00 40%,#0f0200 100%)",
  // },
];

// ── PROPERTIES ───────────────────────────────────────────────
// energyBonus: flat energy added while this is your home
// rentalRate: fraction of price earned per real day (0.05 = 5%)
// price: gold cost to purchase
const PROPERTIES = [
  {id:"prop_hovel",     name:"Wanderer's Hovel",    emoji:"🪨", price:500,   energyBonus:2,  rentalRate:0.05, desc:"A damp cave you've claimed. Better than nothing."},
  {id:"prop_shack",     name:"Rustic Shack",         emoji:"🛖", price:1500,  energyBonus:5,  rentalRate:0.05, desc:"Four walls and a leaky roof. Home sweet home."},
  {id:"prop_cottage",   name:"Stoneleaf Cottage",    emoji:"🏡", price:4000,  energyBonus:10, rentalRate:0.05, desc:"A cozy cottage by a babbling brook."},
  {id:"prop_inn",       name:"Traveller's Inn",      emoji:"🏠", price:10000, energyBonus:18, rentalRate:0.05, desc:"A proper inn. Guests pay, you stay."},
  {id:"prop_manor",     name:"Thornwood Manor",      emoji:"🏰", price:25000, energyBonus:30, rentalRate:0.05, desc:"A sprawling manor with servants' quarters."},
  {id:"prop_keep",      name:"Ironspire Keep",       emoji:"🗼", price:60000, energyBonus:50, rentalRate:0.05, desc:"A fortified keep overlooking the realm."},
  {id:"prop_citadel",   name:"Celestial Citadel",   emoji:"✨", price:150000,energyBonus:100,rentalRate:0.05, desc:"Touched by the gods. The finest dwelling known."},
  // ADD MORE PROPERTIES HERE:
  // {id:"prop_ship", name:"Skyward Galleon", emoji:"⛵", price:80000, energyBonus:65, rentalRate:0.05, desc:"A floating fortress."},
];

// ── RANDOM CHOICE EVENTS ─────────────────────────────────────
// triggered randomly during steps (instead of nothing happening)
// choices: array of {label, outcome: fn(player) => {msg, gold, hp, item}}
// The outcome fn receives P (player) and returns changes. Return null fields to skip.
const CHOICE_EVENTS = [
  {
    id:"chest",
    emoji:"📦",
    title:"A Weathered Chest",
    desc:"You stumble across an old chest half-buried in the dirt. Investigate?",
    choices:[
      {label:"Open it", outcome:()=>({
        msg:"The chest springs open! You find gold inside.",
        gold: ()=>rand(30,120), hp:0, item:null
      })},
      {label:"Leave it", outcome:()=>({
        msg:"You walk away. Better safe than sorry.",
        gold:0, hp:0, item:null
      })},
    ]
  },
  {
    id:"stranger",
    emoji:"🧙",
    title:"A Hooded Stranger",
    desc:"A cloaked figure offers you something wrapped in cloth. Accept?",
    choices:[
      {label:"Accept", outcome:()=>({
        msg:"It's a strange potion. You drink it. Could be worse.",
        gold:0, hp: ()=>rand(-20,40), item:null
      })},
      {label:"Decline", outcome:()=>({
        msg:"The stranger shrugs and vanishes in a puff of smoke.",
        gold:0, hp:0, item:null
      })},
    ]
  },
  {
    id:"shrine",
    emoji:"⛩️",
    title:"Ancient Shrine",
    desc:"A crumbling shrine to an old god. Do you leave an offering?",
    choices:[
      {label:"Offer 50 gold", outcome:(p)=>{
        if((p.gold||0)<50) return{msg:"You don't have enough gold to offer.",gold:0,hp:0,item:null};
        return{msg:"The shrine glows. You feel restored!",gold:-50,hp:()=>rand(20,60),item:null};
      }},
      {label:"Ignore it", outcome:()=>({
        msg:"You pass by. The shrine crumbles a little more.",
        gold:0, hp:0, item:null
      })},
    ]
  },
  {
    id:"wounded",
    emoji:"🩸",
    title:"Wounded Traveller",
    desc:"A bleeding traveller begs for coin to reach the next village.",
    choices:[
      {label:"Give 30 gold", outcome:(p)=>{
        if((p.gold||0)<30) return{msg:"You have nothing to give. They limp away sadly.",gold:0,hp:0,item:null};
        return{msg:"They press a lucky charm into your hand as thanks.",gold:-30,hp:0,item:null,bonus:"karma"};
      }},
      {label:"Walk on", outcome:()=>({
        msg:"You harden your heart and keep moving.",
        gold:0, hp:0, item:null
      })},
    ]
  },
  {
    id:"mushroom",
    emoji:"🍄",
    title:"Glowing Mushroom",
    desc:"A bioluminescent mushroom pulses with strange light. Eat it?",
    choices:[
      {label:"Eat it", outcome:()=>({
        msg: ()=>{
          const r=Math.random();
          if(r<0.4) return "Delicious! You feel energised.";
          if(r<0.7) return "Tastes awful. Your stomach churns.";
          return "Nothing happens. Weird.";
        },
        gold:0,
        hp: ()=>{const r=Math.random();return r<0.4?rand(15,40):r<0.7?-rand(10,25):0;},
        item:null
      })},
      {label:"Leave it", outcome:()=>({
        msg:"You resist the glow. Probably wise.",
        gold:0, hp:0, item:null
      })},
    ]
  },
  {
    id:"gambler",
    emoji:"🎲",
    title:"Roadside Gambler",
    desc:"A shady figure offers to double your gold. Bet 100?",
    choices:[
      {label:"Bet 100 gold", outcome:(p)=>{
        if((p.gold||0)<100) return{msg:"You're too broke to gamble.",gold:0,hp:0,item:null};
        const win=Math.random()<0.45;
        return{msg:win?"Double or nothing — you won!":"The dice were loaded. You lose.",gold:win?100:-100,hp:0,item:null};
      }},
      {label:"Walk away", outcome:()=>({
        msg:"You've heard enough tales of gamblers' ruin.",
        gold:0,hp:0,item:null
      })},
    ]
  },
  {
    id:"cave",
    emoji:"🕳️",
    title:"Dark Cave Entrance",
    desc:"A cave mouth yawns in the hillside. You hear something inside. Enter?",
    choices:[
      {label:"Go in", outcome:()=>({
        msg: ()=>Math.random()<0.5?"You find a small cache of gold!":"A bat colony erupts! You flee, shaken.",
        gold: ()=>Math.random()<0.5?rand(40,100):-10,
        hp: ()=>Math.random()<0.5?0:-rand(5,15),
        item:null
      })},
      {label:"Move on", outcome:()=>({
        msg:"Some things are best left alone.",
        gold:0,hp:0,item:null
      })},
    ]
  },
  // ADD MORE EVENTS HERE:
  // {id:"dragon_egg", emoji:"🥚", title:"A Dragon Egg", desc:"...", choices:[...]}
];

// ── GAME SETTINGS ────────────────────────────────────────────
const CFG = {
  BASE_ENERGY:        30,
  ENERGY_PER_5_LEVELS:1,        // +1 max energy per 5 player levels
  ENERGY_REGEN_MS:    1*30*1000, // 30 seconds per energy point
  MONSTER_CHANCE:     0.30,
  GOLD_CHANCE:        0.22,
  ITEM_CHANCE:        0.13,
  CHOICE_EVENT_CHANCE:0.12,      // new: chance of a choice event
  // remaining = nothing / walk flavour
  MARKET_FEE:         0.05,
  ARENA_COST_GOLD:    200,
  ARENA_COST_EP:      1,
  DAILY_QUEST_RESET_HOUR: 0,
  POTION_HEAL_SMALL:  0.3,
  POTION_HEAL_BIG:    0.7,
  AVATAR_DROP_CHANCE: 0.04,
  SHOP_SELL_RATE:     0.20,      // players sell items to NPC for 20% of value
  PROPERTY_SELL_RATE: 0.80,      // sell property back for 80%
};

// ── ARENA TIERS ──────────────────────────────────────────────
const ARENA_TIERS = [
  {name:"Copper",   color:"#cd7f32",wins:0,  expBonus:1.0, goldBonus:1.0},
  {name:"Bronze",   color:"#c9943a",wins:10, expBonus:1.1, goldBonus:1.1},
  {name:"Silver",   color:"#94a3b8",wins:25, expBonus:1.25,goldBonus:1.2},
  {name:"Gold",     color:"#f59e0b",wins:50, expBonus:1.4, goldBonus:1.35},
  {name:"Platinum", color:"#60a5fa",wins:100,expBonus:1.6, goldBonus:1.5},
  {name:"Diamond",  color:"#c084fc",wins:200,expBonus:1.85,goldBonus:1.7},
  {name:"Champion", color:"#fbbf24",wins:400,expBonus:2.2, goldBonus:2.0},
];

// ── MONSTERS ─────────────────────────────────────────────────
const MONSTERS = [
  {name:"Goblin Scout",     emoji:"👺",desc:"A sneaky little menace with sharp teeth.",         str:[4,12], def:[2,7],  hp:[25,55],  exp:[15,40],  gold:[4,20],  minLevel:0},
  {name:"Forest Wolf",      emoji:"🐺",desc:"Runs in packs. Alone now. Very hungry.",           str:[9,18], def:[4,10], hp:[45,80],  exp:[35,70],  gold:[12,35], minLevel:0},
  {name:"Cave Bat",         emoji:"🦇",desc:"Dives from the dark. Hard to track.",              str:[6,14], def:[2,8],  hp:[20,45],  exp:[20,45],  gold:[5,18],  minLevel:0},
  {name:"Stone Golem",      emoji:"🗿",desc:"Ancient guardian. Slow but devastating.",          str:[7,15], def:[18,30],hp:[70,120], exp:[55,100], gold:[20,55], minLevel:3},
  {name:"Shadow Wraith",    emoji:"👻",desc:"A spirit that feeds on life force.",               str:[22,38],def:[6,15], hp:[60,110], exp:[75,130], gold:[28,65], minLevel:5},
  {name:"Venomfang Spider", emoji:"🕷️",desc:"Its bite carries a slow, rotting curse.",         str:[14,24],def:[8,16], hp:[50,90],  exp:[50,90],  gold:[18,45], minLevel:4},
  {name:"Troll Brute",      emoji:"👹",desc:"Regenerates. Hit it fast.",                        str:[20,35],def:[14,24],hp:[100,160],exp:[80,140], gold:[35,80], minLevel:6},
  {name:"Dragon Whelp",     emoji:"🐉",desc:"Young dragon. Not fully grown. Still lethal.",     str:[28,46],def:[13,25],hp:[110,185],exp:[110,185],gold:[45,110],minLevel:8},
  {name:"Skeleton Knight",  emoji:"💀",desc:"Fought a hundred wars. Lost them all. Still here.",str:[18,32],def:[22,38],hp:[90,150], exp:[90,160], gold:[38,85], minLevel:6},
  {name:"Dark Sorcerer",    emoji:"🧙",desc:"Commands ancient spells. Fragile body, lethal mind.",str:[40,60],def:[5,12],hp:[80,130], exp:[120,200],gold:[60,130],minLevel:10},
  {name:"Banshee Queen",    emoji:"👸",desc:"Her scream alone can end you.",                    str:[35,55],def:[8,18], hp:[130,210],exp:[140,230],gold:[65,140],minLevel:11},
  {name:"Lich Lord",        emoji:"💀",desc:"Mastered death itself. Now he is it.",             str:[45,70],def:[18,32],hp:[180,300],exp:[180,320],gold:[90,190],minLevel:14},
  {name:"Elder Dragon",     emoji:"🐲",desc:"A living catastrophe. Legends warn against this.", str:[60,90],def:[25,45],hp:[300,500],exp:[300,500],gold:[150,300],minLevel:18},
].map(m=>({...m, image:`img/monsters/${slug(m.name)}.png`}));

// ── AVATARS ──────────────────────────────────────────────────
const AVATARS = [
  {id:"av_wolf",      name:"Shadow Wolf",     emoji:"🐺",rarity:"rare",      dropRate:8,  desc:"Runs alone through the dark."},
  {id:"av_knight",    name:"Iron Knight",     emoji:"⚔️",rarity:"rare",      dropRate:8,  desc:"Steel and honour."},
  {id:"av_rogue",     name:"Night Rogue",     emoji:"🗡️",rarity:"rare",      dropRate:8,  desc:"Silent. Deadly. Gone."},
  {id:"av_ranger",    name:"Forest Ranger",   emoji:"🏹",rarity:"rare",      dropRate:7,  desc:"One with the wild."},
  {id:"av_mage",      name:"Storm Mage",      emoji:"🧙",rarity:"rare",      dropRate:7,  desc:"Commands lightning and thunder."},
  {id:"av_dragon",    name:"Dragonborn",      emoji:"🐉",rarity:"epic",      dropRate:3,  desc:"Blessed by ancient fire."},
  {id:"av_lich",      name:"Lich Ascendant",  emoji:"💀",rarity:"epic",      dropRate:3,  desc:"Death is just the beginning."},
  {id:"av_phoenix",   name:"Phoenix Risen",   emoji:"🔥",rarity:"epic",      dropRate:3,  desc:"Born from the ashes, again."},
  {id:"av_void",      name:"Void Walker",     emoji:"🌌",rarity:"epic",      dropRate:2,  desc:"Steps between worlds."},
  {id:"av_celestial", name:"Celestial Lord",  emoji:"✨",rarity:"legendary", dropRate:0.5,desc:"Touched by the gods themselves."},
  {id:"av_chaos",     name:"Chaos Herald",    emoji:"🌀",rarity:"legendary", dropRate:0.5,desc:"Order fears this one."},
  {id:"av_champion",  name:"Eternal Champion",emoji:"👑",rarity:"legendary", dropRate:0.4,desc:"The last one standing, always."},
].map(av=>({...av, image:`img/avatars/${av.id}.gif`}));

// ── ITEMS ────────────────────────────────────────────────────
const ITEMS = [
  // COMMON
  {name:"Rusty Sword",       type:"Weapon",stat:"str",base:5,  rarity:"common",   emoji:"⚔️",dropRate:20,shopPrice:80},
  {name:"Wooden Club",       type:"Weapon",stat:"str",base:4,  rarity:"common",   emoji:"🪵",dropRate:20,shopPrice:60},
  {name:"Worn Shield",       type:"Shield",stat:"def",base:4,  rarity:"common",   emoji:"🛡️",dropRate:18,shopPrice:70},
  {name:"Leather Cap",       type:"Helmet",stat:"def",base:3,  rarity:"common",   emoji:"🪖",dropRate:18,shopPrice:55},
  {name:"Cloth Robe",        type:"Armour",stat:"def",base:4,  rarity:"common",   emoji:"👘",dropRate:16,shopPrice:65},
  {name:"Simple Boots",      type:"Boots", stat:"def",base:2,  rarity:"common",   emoji:"👟",dropRate:16,shopPrice:45},
  {name:"Copper Amulet",     type:"Amulet",stat:"def",base:2,  rarity:"common",   emoji:"📿",dropRate:14,shopPrice:50},
  // UNCOMMON
  {name:"Iron Chestplate",   type:"Armour",stat:"def",base:12, rarity:"uncommon", emoji:"🦺",dropRate:12,shopPrice:350},
  {name:"Silver Blade",      type:"Weapon",stat:"str",base:20, rarity:"uncommon", emoji:"🗡️",dropRate:12,shopPrice:400},
  {name:"Mithril Ring",      type:"Amulet",stat:"def",base:9,  rarity:"uncommon", emoji:"💍",dropRate:10,shopPrice:280},
  {name:"Knight's Shield",   type:"Shield",stat:"def",base:14, rarity:"uncommon", emoji:"🛡️",dropRate:10,shopPrice:320},
  {name:"Chain Greaves",     type:"Greaves",stat:"def",base:8, rarity:"uncommon", emoji:"🦵",dropRate:10,shopPrice:260},
  {name:"Ranger Boots",      type:"Boots", stat:"def",base:7,  rarity:"uncommon", emoji:"👢",dropRate:10,shopPrice:240},
  {name:"Iron Helm",         type:"Helmet",stat:"def",base:10, rarity:"uncommon", emoji:"⛑️",dropRate:10,shopPrice:300},
  // RARE
  {name:"Enchanted Greaves", type:"Greaves",stat:"def",base:18,rarity:"rare",     emoji:"🦵",dropRate:6},
  {name:"Dragonfang Blade",  type:"Weapon",stat:"str",base:38, rarity:"rare",     emoji:"🔱",dropRate:5},
  {name:"Stormshard Boots",  type:"Boots", stat:"def",base:18, rarity:"rare",     emoji:"👢",dropRate:6},
  {name:"Warden's Helm",     type:"Helmet",stat:"def",base:20, rarity:"rare",     emoji:"🪖",dropRate:5},
  {name:"Soulbind Shield",   type:"Shield",stat:"def",base:25, rarity:"rare",     emoji:"🛡️",dropRate:5},
  {name:"Stormweave Armour", type:"Armour",stat:"def",base:28, rarity:"rare",     emoji:"🧥",dropRate:5},
  {name:"Runic Amulet",      type:"Amulet",stat:"str",base:15, rarity:"rare",     emoji:"🔮",dropRate:5},
  // EPIC
  {name:"Phoenix Armour",    type:"Armour",stat:"def",base:42, rarity:"epic",     emoji:"✨",dropRate:2},
  {name:"Voidcaller Staff",  type:"Weapon",stat:"str",base:55, rarity:"epic",     emoji:"🪄",dropRate:2},
  {name:"Shadow Greaves",    type:"Greaves",stat:"def",base:35,rarity:"epic",     emoji:"🦵",dropRate:2},
  {name:"Void Amulet",       type:"Amulet",stat:"str",base:28, rarity:"epic",     emoji:"💜",dropRate:2},
  {name:"Dreadhelm",         type:"Helmet",stat:"def",base:38, rarity:"epic",     emoji:"😈",dropRate:2},
  // LEGENDARY
  {name:"Excalibur",          type:"Weapon",stat:"str",base:80, rarity:"legendary",emoji:"⚡",dropRate:0.3,variance:25},
  {name:"Crown of the Fallen",type:"Helmet",stat:"def",base:55, rarity:"legendary",emoji:"👑",dropRate:0.3,variance:25},
  {name:"Aegis of Eternity",  type:"Shield",stat:"def",base:60, rarity:"legendary",emoji:"🌟",dropRate:0.3,variance:25},
  {name:"Dragonhide Armour",  type:"Armour",stat:"def",base:65, rarity:"legendary",emoji:"🐉",dropRate:0.3,variance:25},
].map(item=>({...item, image:`img/items/${slug(item.name)}.png`}));

// ── PETS ─────────────────────────────────────────────────────
const PETS = [
  {name:"Baby Slime",    type:"Pet",stat:"def",base:6,  rarity:"uncommon",emoji:"🟢",dropRate:8,  desc:"Wobbly but loyal."},
  {name:"Forest Sprite", type:"Pet",stat:"str",base:7,  rarity:"uncommon",emoji:"🧚",dropRate:7,  desc:"Zips around your shoulder."},
  {name:"Tamed Rat",     type:"Pet",stat:"def",base:5,  rarity:"uncommon",emoji:"🐀",dropRate:8,  desc:"Surprisingly useful."},
  {name:"Shadow Cat",    type:"Pet",stat:"str",base:14, rarity:"rare",    emoji:"🐈",dropRate:4,  desc:"Vanishes in dim light."},
  {name:"Storm Hawk",    type:"Pet",stat:"str",base:16, rarity:"rare",    emoji:"🦅",dropRate:3,  desc:"Dives at your enemies."},
  {name:"Crystal Turtle",type:"Pet",stat:"def",base:18, rarity:"rare",    emoji:"🐢",dropRate:3,  desc:"A walking shield."},
  {name:"Baby Dragon",   type:"Pet",stat:"str",base:20, rarity:"rare",    emoji:"🐉",dropRate:2,  desc:"Breathes tiny flames."},
  {name:"Void Familiar", type:"Pet",stat:"str",base:30, rarity:"epic",    emoji:"👁️",dropRate:1,  desc:"Sees through walls. And lies."},
  {name:"Lava Pup",      type:"Pet",stat:"str",base:28, rarity:"epic",    emoji:"🔥",dropRate:1,  desc:"Always warm. Always angry."},
  {name:"Frost Wolf",    type:"Pet",stat:"def",base:32, rarity:"epic",    emoji:"🐺",dropRate:1,  desc:"Howls before every battle."},
  {name:"Ancient Phoenix",type:"Pet",stat:"str",base:50,rarity:"legendary",emoji:"🦅",dropRate:0.2,desc:"Reborn every battle."},
  {name:"Celestial Crab", type:"Pet",stat:"def",base:55,rarity:"legendary",emoji:"🦀",dropRate:0.2,desc:"Claws from another dimension."},
].map(p=>({...p, image:`img/pets/${slug(p.name)}.png`}));

// ── NPC SHOP CONSUMABLES ─────────────────────────────────────
const SHOP_CONSUMABLES = [
  {id:"potion_small",  name:"Minor Healing Potion",emoji:"🧪",desc:"Restores 30% of your max HP",  price:120,effect:"heal_small"},
  {id:"potion_big",    name:"Major Healing Potion", emoji:"💊",desc:"Restores 70% of your max HP",  price:350,effect:"heal_big"},
  {id:"energy_refill", name:"Energy Crystal",       emoji:"⚡",desc:"Instantly refills all energy", price:200,effect:"energy_full"},
  {id:"exp_scroll",    name:"Tome of Knowledge",    emoji:"📜",desc:"Grants 200 EXP instantly",     price:500,effect:"exp_200"},
];

// ── WALK FLAVOUR TEXT ─────────────────────────────────────────
const WALK_EVENTS = [
  {emoji:"🌿",text:"You walk through the quiet forest."},
  {emoji:"🍃",text:"Leaves rustle overhead. Nothing stirs."},
  {emoji:"🌧️",text:"A light rain begins to fall."},
  {emoji:"☀️",text:"The sun breaks through the canopy."},
  {emoji:"🌫️",text:"Fog rolls in from the valley below."},
  {emoji:"🍂",text:"Autumn leaves crunch under your boots."},
  {emoji:"❄️",text:"Your breath mists in the cold air."},
  {emoji:"🌊",text:"You hear distant waves. No coast in sight."},
  {emoji:"⛅",text:"Clouds drift lazily overhead."},
  {emoji:"🌙",text:"The moon watches from between the trees."},
  {emoji:"🌄",text:"The horizon glows with fading light."},
  {emoji:"🌸",text:"Cherry blossoms drift across the path."},
  {emoji:"🍄",text:"Strange mushrooms line the trail. You leave them alone."},
  {emoji:"🪨",text:"Ancient stones mark the old road."},
  {emoji:"🦋",text:"A butterfly lands on your shoulder, then vanishes."},
  {emoji:"🐦",text:"A bird sings from somewhere unseen."},
  {emoji:"😤",text:"You trip on a root. No one saw that. Probably."},
  {emoji:"🎵",text:"You catch yourself humming. Not sure what song."},
  {emoji:"💀",text:"Bones of something large litter the clearing. Old."},
  {emoji:"🔥",text:"Smoke rises somewhere to the east. Not your problem. Probably."},
  {emoji:"👁️",text:"You feel like something is watching. Nothing there."},
  {emoji:"🗝️",text:"A rusted key lies in the dirt. No lock in sight."},
  {emoji:"🕯️",text:"A lit candle sits on a stump. Who left it here?"},
  {emoji:"💨",text:"A tumbleweed rolls by. Where did that even come from?"},
  {emoji:"📦",text:"An empty chest sits open by the path. Already looted."},
  {emoji:"⚔️",text:"Scorch marks scar the earth. A battle happened here."},
  {emoji:"🏰",text:"Ruins of something old crumble in the distance."},
  {emoji:"🧭",text:"Your compass spins once, then settles. Odd."},
  {emoji:"📯",text:"A distant horn sounds. Far away. Maybe a warning."},
];

// ============================================================
//  ENGINE
// ============================================================

const EQUIP_SLOTS  = ["Helmet","Armour","Weapon","Shield","Greaves","Boots","Amulet","Pet"];
const SLOT_EMOJI   = {Helmet:"🪖",Armour:"🦺",Weapon:"⚔️",Shield:"🛡️",Greaves:"🦵",Boots:"👢",Amulet:"💍",Pet:"🐾"};
const RARITY_COLOR = {common:"#9ca3af",uncommon:"#34d399",rare:"#60a5fa",epic:"#c084fc",legendary:"#fbbf24"};
const RARITY_VAR   = {common:3,uncommon:5,rare:8,epic:12,legendary:20};
const TIER_EMOJIS  = ["🪙","🥉","🥈","🥇","💠","💎","👑"];

const fbApp = initializeApp(FIREBASE_CONFIG);
const auth  = getAuth(fbApp);
const db    = getFirestore(fbApp);
const gp    = new GoogleAuthProvider();

let CU=null, P=null, TAB="home", CURRENT_AREA=null;
let feed=[], combatState=null, combatInterval=null, energyInterval=null;

// ── MATH ─────────────────────────────────────────────────────
const rand   = (a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const pick   = a=>a[Math.floor(Math.random()*a.length)];
const clamp  = (v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const fmt    = n=>n>=1e6?(n/1e6).toFixed(1)+"M":n>=1000?(n/1000).toFixed(1)+"K":String(Math.floor(n||0));
const expLv  = lv=>Math.floor(100*Math.pow(1.5,lv-1));
const maxHpCalc = (lv,def,bonusHp)=>100+lv*10+def*2+(bonusHp||0);

function bellRoll(base,variance){
  let r=0; for(let i=0;i<6;i++)r+=Math.random();
  r=(r-3)/3;
  return Math.max(1,Math.round(base+r*variance));
}
function rollItemStat(t){
  const v=t.variance??RARITY_VAR[t.rarity]??3;
  return bellRoll(t.base,v);
}
function qualityLabel(val,base){
  const d=val-base;
  if(d>=base*0.5)  return{label:"Perfect",color:"#fbbf24"};
  if(d>=base*0.25) return{label:"Great",  color:"#c084fc"};
  if(d>=base*0.05) return{label:"Good",   color:"#60a5fa"};
  if(d>=-base*0.1) return{label:"Normal", color:"#9ca3af"};
  if(d>=-base*0.25)return{label:"Poor",   color:"#6b7280"};
  return                  {label:"Worn",  color:"#4b5563"};
}
function equipStats(eq){
  let str=0,def=0;
  Object.values(eq||{}).forEach(it=>{if(!it)return;if(it.stat==="str")str+=it.val;else def+=it.val;});
  return{str,def};
}
function gfx(image,emoji,size=32){
  if(image) return`<img src="${image}" alt="${emoji}" style="width:${size}px;height:${size}px;object-fit:contain" onerror="this.style.display='none';this.insertAdjacentText('afterend','${emoji}')">`;
  return emoji;
}

// ── ENERGY CALC ──────────────────────────────────────────────
function calcMaxEnergy(){
  if(!P) return CFG.BASE_ENERGY;
  const levelBonus=Math.floor((P.level-1)/5)*CFG.ENERGY_PER_5_LEVELS;
  const homeId=P.homePropertyId||null;
  let housingBonus=0;
  if(homeId){
    const prop=PROPERTIES.find(p=>p.id===homeId);
    if(prop) housingBonus=prop.energyBonus;
  }
  return CFG.BASE_ENERGY+levelBonus+housingBonus;
}

// ── PROPERTY HELPERS ─────────────────────────────────────────
function getOwnedProperties(){
  return P.properties||[];
}
function ownsProperty(id){
  return getOwnedProperties().some(p=>p.id===id);
}
function getRentalIncome(){
  // Calculate pending rental income from all non-home properties
  const owned=getOwnedProperties();
  const now=Date.now();
  let total=0;
  owned.forEach(op=>{
    if(op.id===P.homePropertyId) return; // home, no rent
    const prop=PROPERTIES.find(p=>p.id===op.id);
    if(!prop) return;
    const lastClaim=op.lastRentClaim||op.purchasedAt||now;
    const msElapsed=now-lastClaim;
    const daysElapsed=msElapsed/(1000*60*60*24);
    const daily=Math.floor(prop.price*prop.rentalRate);
    total+=Math.floor(daily*daysElapsed);
  });
  return total;
}
function claimRent(){
  const income=getRentalIncome();
  if(income<=0){toast("🏠 No rental income yet!");return;}
  const now=Date.now();
  (P.properties||[]).forEach(op=>{
    if(op.id!==P.homePropertyId) op.lastRentClaim=now;
  });
  P.gold=(P.gold||0)+income;
  saveP();
  toast(`🏠 Collected 🪙${fmt(income)} in rent!`);
  renderProperties();
}

// ── AVATAR HELPERS ────────────────────────────────────────────
function getActiveAvatar(){
  const id=P.activeAvatar;
  if(!id)return null;
  return AVATARS.find(a=>a.id===id)||null;
}
function avatarGfx(size=32){
  const av=getActiveAvatar();
  if(av&&av.image) return`<img src="${av.image}" alt="${av.emoji}" style="width:${size}px;height:${size}px;object-fit:contain;border-radius:4px" onerror="this.replaceWith(document.createTextNode('${av.emoji}'))">`;
  if(av) return av.emoji;
  if(PLAYER_AVATAR.image) return`<img src="${PLAYER_AVATAR.image}" alt="${PLAYER_AVATAR.emoji}" style="width:${size}px;height:${size}px;object-fit:contain">`;
  return PLAYER_AVATAR.emoji;
}
function avatarGfxFor(plyr,size=24){
  const id=plyr.activeAvatar;
  const av=id?AVATARS.find(a=>a.id===id):null;
  if(av&&av.image) return`<img src="${av.image}" alt="${av.emoji}" style="width:${size}px;height:${size}px;object-fit:contain;border-radius:3px" onerror="this.replaceWith(document.createTextNode('${av.emoji}'))">`;
  if(av) return`<span style="font-size:${Math.round(size*0.7)}px">${av.emoji}</span>`;
  return`<span style="font-size:${Math.round(size*0.7)}px">${PLAYER_AVATAR.emoji}</span>`;
}
function rollAvatar(){
  const total=AVATARS.reduce((s,a)=>s+(a.dropRate||1),0);
  let r=Math.random()*total;
  for(const av of AVATARS){r-=(av.dropRate||1);if(r<=0)return av;}
  return AVATARS[0];
}
function tryAvatarDrop(){
  if(Math.random()>CFG.AVATAR_DROP_CHANCE)return;
  const av=rollAvatar();
  const collected=P.avatars||[];
  if(collected.includes(av.id)){
    const bonus=rand(50,200);
    P.gold=(P.gold||0)+bonus;
    toast(`✨ Duplicate avatar converted to 🪙${bonus} gold!`);
    saveP(); return;
  }
  P.avatars=[...collected,av.id];
  saveP();
  openAvatarDropModal(av);
}
function openAvatarDropModal(av){
  const color=RARITY_COLOR[av.rarity]||"#9ca3af";
  const imgHtml=av.image?`<img src="${av.image}" alt="${av.emoji}" style="width:80px;height:80px;object-fit:contain;border-radius:8px" onerror="this.replaceWith(document.createTextNode('${av.emoji}'))">`:`<span style="font-size:3.5rem">${av.emoji}</span>`;
  document.getElementById("modal-content").innerHTML=`
    <div style="text-align:center;margin-bottom:0.75rem">
      <div style="font-size:0.72rem;color:var(--gold2);font-family:'Cinzel',serif;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:0.5rem">✨ Avatar Unlocked!</div>
      <div style="width:80px;height:80px;margin:0 auto 0.5rem;display:flex;align-items:center;justify-content:center">${imgHtml}</div>
      <div style="font-family:'Cinzel',serif;font-size:1.05rem;color:${color};margin-bottom:0.2rem">${av.name}</div>
      <div style="font-size:0.7rem;color:${color};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.5rem">${av.rarity}</div>
      <div style="font-size:0.82rem;color:var(--text3);font-style:italic;margin-bottom:1rem">"${av.desc}"</div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-gold" onclick="G.equipAvatar('${av.id}')">Equip This Avatar</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Save for Later</button>
    </div>`;
  document.getElementById("modal-overlay").style.display="flex";
}
function equipAvatar(id){
  P.activeAvatar=id;
  saveP(); updateWalkBtn(); closeModal();
  toast("✨ Avatar equipped!");
  if(TAB==="you")renderYou();
}
function openAvatarCollection(){
  const collected=P.avatars||[];
  if(collected.length===0){
    document.getElementById("modal-content").innerHTML=`
      <div class="modal-title">🎭 Avatars</div>
      <div style="text-align:center;color:var(--text3);padding:1.5rem;font-style:italic">No avatars yet! They drop rarely while exploring.</div>
      <button class="btn btn-ghost" onclick="G.closeModal()">Close</button>`;
    document.getElementById("modal-overlay").style.display="flex"; return;
  }
  const rows=AVATARS.filter(a=>collected.includes(a.id)).map(av=>{
    const color=RARITY_COLOR[av.rarity];
    const isActive=P.activeAvatar===av.id;
    const imgHtml=av.image?`<img src="${av.image}" alt="${av.emoji}" style="width:44px;height:44px;object-fit:contain;border-radius:6px" onerror="this.replaceWith(document.createTextNode('${av.emoji}'))">`:`<span style="font-size:2rem">${av.emoji}</span>`;
    return`<div style="display:flex;align-items:center;gap:0.75rem;padding:0.65rem 0;border-bottom:1px solid var(--border)">
      <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${imgHtml}</div>
      <div style="flex:1;min-width:0">
        <div style="font-family:'Cinzel',serif;font-size:0.82rem;color:${color}">${av.name}</div>
        <div style="font-size:0.68rem;color:var(--text3);margin-top:0.1rem">${av.rarity} · "${av.desc}"</div>
      </div>
      ${isActive?`<span style="font-size:0.7rem;color:var(--green2);font-family:'Cinzel',serif;flex-shrink:0">Active ✓</span>`:`<button class="btn btn-gold btn-sm" onclick="G.equipAvatar('${av.id}')">Equip</button>`}
    </div>`;
  }).join("");
  document.getElementById("modal-content").innerHTML=`
    <div class="modal-title">🎭 Avatars (${collected.length}/${AVATARS.length})</div>
    <div style="max-height:60vh;overflow-y:auto;margin-bottom:0.75rem">${rows}</div>
    <button class="btn btn-ghost" onclick="G.closeModal()">Close</button>`;
  document.getElementById("modal-overlay").style.display="flex";
}

function arenaT(wins){
  let t=0;
  for(let i=ARENA_TIERS.length-1;i>=0;i--){if((wins||0)>=ARENA_TIERS[i].wins){t=i;break;}}
  return t;
}

// ── DAILY QUESTS ─────────────────────────────────────────────
function buildDailyQuests(seed){
  const s=(n)=>{let x=Math.sin(seed+n)*10000;return x-Math.floor(x);};
  return[
    {id:"q_kill", icon:"⚔️",name:"Monster Hunter",desc:`Kill ${Math.floor(s(1)*8)+3} monsters`,target:Math.floor(s(1)*8)+3,type:"kills",progress:0,reward:{exp:150,gold:100}},
    {id:"q_steps",icon:"👣",name:"World Walker",  desc:`Take ${Math.floor(s(2)*20)+10} steps`,  target:Math.floor(s(2)*20)+10,type:"steps",progress:0,reward:{exp:100,gold:80}},
    {id:"q_items",icon:"🎁",name:"Fortune Seeker",desc:`Find ${Math.floor(s(3)*4)+2} items`,    target:Math.floor(s(3)*4)+2,type:"items",progress:0,reward:{exp:120,gold:90}},
  ];
}
function questSeed(){
  const d=new Date();
  return d.getUTCFullYear()*10000+d.getUTCMonth()*100+d.getUTCDate();
}
function getQuests(){
  const seed=questSeed();
  if(!P.quests||P.quests.seed!==seed){P.quests={seed,list:buildDailyQuests(seed)};}
  return P.quests.list;
}
function updateQuestProgress(type,amount=1){
  if(!P.quests)return;
  let changed=false;
  P.quests.list.forEach(q=>{
    if(q.type===type&&q.progress<q.target){
      q.progress=Math.min(q.target,q.progress+amount);
      if(q.progress>=q.target&&!q.claimed)toast(`📜 Quest complete: ${q.name}! Claim your reward!`);
      changed=true;
    }
  });
  if(changed)saveP();
}

// ── PLAYER INIT ───────────────────────────────────────────────
function newPlayer(username){
  return{username,level:1,exp:0,gold:200,bank:0,diamonds:10,
    hp:110,maxHp:110,baseStr:10,baseDef:5,bonusHp:0,statPoints:0,
    energy:CFG.BASE_ENERGY,lastEnergyTime:Date.now(),
    steps:0,npcKills:0,pvpKills:0,arenaWins:0,arenaLosses:0,
    inventory:[],equipped:{},quests:null,
    properties:[],homePropertyId:null,
    avatars:[],activeAvatar:null,
    createdAt:Date.now()};
}

// ── FIREBASE ─────────────────────────────────────────────────
async function loadP(uid){const s=await getDoc(doc(db,"players",uid));return s.exists()?s.data():null;}
async function saveP(){if(!CU||!P)return;await setDoc(doc(db,"players",CU.uid),P);}
async function loadLeaderboard(){const s=await getDocs(collection(db,"players"));return s.docs.map(d=>d.data()).filter(p=>p&&p.username);}
async function getListings(){const s=await getDocs(collection(db,"market"));return s.docs.map(d=>({id:d.id,...d.data()}));}
async function addListing(item,price){await addDoc(collection(db,"market"),{sellerId:CU.uid,sellerName:P.username,item,price,listedAt:Date.now()});}
async function removeListing(id){await deleteDoc(doc(db,"market",id));}

// ── AUTH ─────────────────────────────────────────────────────
onAuthStateChanged(auth,async u=>{
  CU=u;
  if(u){P=await loadP(u.uid);P?startGame():showScreen("username-screen");}
  else showScreen("auth-screen");
});
function showErr(m){const e=document.getElementById("auth-error");e.textContent=m;e.style.display="block";}
function hideErr(){document.getElementById("auth-error").style.display="none";}
function switchAuthTab(t){
  document.getElementById("tab-login").classList.toggle("active",t==="login");
  document.getElementById("tab-register").classList.toggle("active",t==="register");
  document.getElementById("reg-username-group").style.display=t==="register"?"block":"none";
  hideErr();
}
async function handleEmailAuth(){
  const email=document.getElementById("auth-email").value.trim();
  const pw=document.getElementById("auth-password").value;
  const isLogin=document.getElementById("tab-login").classList.contains("active");
  hideErr();
  if(!email||!pw){showErr("Please fill all fields");return;}
  try{
    if(isLogin){await signInWithEmailAndPassword(auth,email,pw);}
    else{
      const un=document.getElementById("reg-username").value.trim();
      if(!un){showErr("Hero name required");return;}
      const c=await createUserWithEmailAndPassword(auth,email,pw);
      P=newPlayer(un);
      await setDoc(doc(db,"players",c.user.uid),P);
      startGame();
    }
  }catch(e){showErr(e.message||"Auth failed");}
}
async function handleGoogleAuth(){
  try{
    const c=await signInWithPopup(auth,gp);
    const ex=await loadP(c.user.uid);
    if(!ex)showScreen("username-screen");
    else{P=ex;startGame();}
  }catch(e){showErr("Google sign-in failed");}
}
async function handleSetUsername(){
  const n=document.getElementById("new-username").value.trim();
  if(!n||!CU)return;
  P=newPlayer(n);
  await setDoc(doc(db,"players",CU.uid),P);
  startGame();
}
function showScreen(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ── GAME START ────────────────────────────────────────────────
function startGame(){
  // Migrate old players: add missing fields
  if(P.statPoints===undefined)P.statPoints=0;
  if(P.bonusHp===undefined)P.bonusHp=0;
  if(P.properties===undefined)P.properties=[];
  if(P.homePropertyId===undefined)P.homePropertyId=null;

  showScreen("game-screen");
  updateWalkBtn();
  regenCheck();
  energyInterval=setInterval(regenCheck,15000);
  if(P.activeCombat&&!combatState){
    combatState={...P.activeCombat,done:false};
  }
  showTab("home");
}

function regenCheck(){
  if(!P)return;
  const maxE=calcMaxEnergy();
  if(P.energy>=maxE)return;
  const pts=Math.floor((Date.now()-(P.lastEnergyTime||Date.now()))/CFG.ENERGY_REGEN_MS);
  if(pts>0){
    P.energy=clamp(P.energy+pts,0,maxE);
    P.lastEnergyTime=Date.now();
    saveP();
    if(TAB==="home")renderHome();
    updateWalkBtn();
  }
}

function updateWalkBtn(){
  const maxE=calcMaxEnergy();
  const btn=document.getElementById("nav-walk");if(!btn)return;
  btn.classList.toggle("no-energy",!P||P.energy<1);
  btn.innerHTML=WALK_BUTTON.image?`<img src="${WALK_BUTTON.image}" alt="⚔️">`:WALK_BUTTON.emoji;
  const ha=document.getElementById("hdr-avatar-el");
  if(ha)ha.innerHTML=avatarGfx(30);
  const hh=document.getElementById("hdr-hp");
  if(hh)hh.textContent=`❤️ ${P?P.hp:0}`;
  const hl=document.getElementById("hdr-level");
  if(hl)hl.textContent=`Lv.${P?P.level:1}`;
}

function showTab(tab){
  TAB=tab;
  ["home","gear","market","social"].forEach(t=>{
    const b=document.getElementById("nav-"+t);if(b)b.classList.remove("active");
  });
  const a=document.getElementById("nav-"+tab);if(a)a.classList.add("active");
  if(tab==="home")      renderHome();
  else if(tab==="gear") renderGear();
  else if(tab==="market")renderMarket();
  else if(tab==="social")renderSocial();
  else if(tab==="you")  renderYou();
  else if(tab==="quests")renderQuests();
  else if(tab==="arena")renderArena();
  else if(tab==="bank") renderBank();
  else if(tab==="properties")renderProperties();
  else if(tab==="walk") renderWalkAreaSelect();
}

// ── HOME ─────────────────────────────────────────────────────
function renderHome(){
  if(!P)return;
  const maxE=calcMaxEnergy();
  const{str:eStr,def:eDef}=equipStats(P.equipped);
  const tStr=(P.baseStr||10)+eStr, tDef=(P.baseDef||5)+eDef;
  const expNeed=expLv(P.level);
  const hpPct=clamp(Math.round((P.hp/P.maxHp)*100),0,100);
  const expPct=clamp(Math.round((P.exp/expNeed)*100),0,100);
  const enPct=Math.round((P.energy/maxE)*100);
  const elapsed=Date.now()-(P.lastEnergyTime||Date.now());
  const tl=Math.max(0,CFG.ENERGY_REGEN_MS-(elapsed%CFG.ENERGY_REGEN_MS));
  const timerStr=P.energy>=maxE?"Full":`${Math.floor(tl/60000)}:${String(Math.floor((tl%60000)/1000)).padStart(2,"0")}`;
  const qs=getQuests();
  const qDone=qs.filter(q=>q.progress>=q.target).length;
  const tierIdx=arenaT(P.arenaWins||0);
  const tier=ARENA_TIERS[tierIdx];
  const rentalPending=getRentalIncome();
  const homeProp=P.homePropertyId?PROPERTIES.find(p=>p.id===P.homePropertyId):null;
  const spBadge=P.statPoints>0?`<span style="background:var(--crimson2);color:white;border-radius:10px;font-size:0.65rem;padding:1px 6px;margin-left:0.4rem">${P.statPoints} pts</span>`:"";
  updateWalkBtn();

  document.getElementById("content").innerHTML=`
    <div class="player-banner">
      <div class="p-avatar">${avatarGfx(58)}</div>
      <div class="p-info">
        <div class="p-name">${P.username}${spBadge}</div>
        <div class="p-class">Level ${P.level} Adventurer &nbsp;·&nbsp; <span style="color:${tier.color}">${tier.name} Arena</span></div>
        <div class="bar-wrap">
          <div class="bar-labels"><span>❤️ HP</span><span>${P.hp}/${P.maxHp}</span></div>
          <div class="bar bar-hp"><div class="bar-fill" style="width:${hpPct}%"></div></div>
        </div>
        <div class="bar-wrap">
          <div class="bar-labels"><span>✨ EXP</span><span>${fmt(P.exp)}/${fmt(expNeed)}</span></div>
          <div class="bar bar-exp"><div class="bar-fill" style="width:${expPct}%"></div></div>
        </div>
      </div>
    </div>

    ${P.statPoints>0?`
    <div style="background:rgba(176,48,48,0.18);border:1px solid var(--crimson);border-radius:12px;
      padding:0.85rem;margin-bottom:0.7rem;display:flex;align-items:center;gap:0.75rem">
      <div style="font-size:1.5rem">⬆️</div>
      <div style="flex:1">
        <div style="font-family:'Cinzel',serif;font-size:0.82rem;color:var(--gold2)">${P.statPoints} Stat Point${P.statPoints>1?"s":""} Available!</div>
        <div style="font-size:0.75rem;color:var(--text3);margin-top:0.1rem">Spend them to grow stronger</div>
      </div>
      <button class="btn btn-gold btn-sm" onclick="G.openStatModal()">Spend</button>
    </div>`:``}

    <div class="card">
      <div class="card-title">⚡ Energy</div>
      <div class="bar-wrap">
        <div class="bar-labels"><span>${P.energy}/${maxE} EP</span><span>${timerStr} to next</span></div>
        <div class="bar bar-energy"><div class="bar-fill" style="width:${enPct}%"></div></div>
      </div>
      ${homeProp?`<div style="font-size:0.72rem;color:var(--text3);margin-top:0.3rem">🏠 ${homeProp.name} gives +${homeProp.energyBonus} energy</div>`:""}
    </div>

    <div class="card">
      <div class="card-title">💰 Currencies</div>
      <div class="curr-row">
        <div class="curr-item"><div class="curr-amount">🪙 ${fmt(P.gold)}</div><div class="curr-label">Gold</div></div>
        <div class="curr-item" onclick="G.showTab('bank')" style="cursor:pointer"><div class="curr-amount">🏦 ${fmt(P.bank)}</div><div class="curr-label">Bank ›</div></div>
        <div class="curr-item"><div class="curr-amount">💎 ${P.diamonds}</div><div class="curr-label">Gems</div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">📊 Stats</div>
      <div class="stat-row">
        <div class="stat-badge"><em>⚔️ STR</em><strong>${tStr}</strong></div>
        <div class="stat-badge"><em>🛡️ DEF</em><strong>${tDef}</strong></div>
        <div class="stat-badge"><em>❤️ HP</em><strong>${P.maxHp}</strong></div>
        <div class="stat-badge"><em>💀 Kills</em><strong>${P.npcKills||0}</strong></div>
        <div class="stat-badge"><em>👣 Steps</em><strong>${fmt(P.steps||0)}</strong></div>
      </div>
    </div>

    ${rentalPending>0?`
    <div style="background:rgba(39,174,96,0.15);border:1px solid var(--green);border-radius:12px;
      padding:0.85rem;margin-bottom:0.7rem;display:flex;align-items:center;gap:0.75rem">
      <div style="font-size:1.5rem">🏠</div>
      <div style="flex:1">
        <div style="font-family:'Cinzel',serif;font-size:0.82rem;color:var(--green2)">Rental Income Ready!</div>
        <div style="font-size:0.75rem;color:var(--text3)">🪙${fmt(rentalPending)} from your properties</div>
      </div>
      <button class="btn btn-green btn-sm" onclick="G.claimRent()">Collect</button>
    </div>`:""}

    ${(combatState&&!combatState.done)||P.activeCombat?`
    <div style="background:rgba(176,48,48,0.15);border:1px solid var(--crimson);border-radius:12px;
      padding:0.85rem;margin-bottom:0.7rem;display:flex;align-items:center;gap:0.75rem">
      <div style="font-size:1.5rem">⚔️</div>
      <div style="flex:1">
        <div style="font-family:'Cinzel',serif;font-size:0.82rem;color:var(--crimson2)">Battle in Progress!</div>
        <div style="font-size:0.75rem;color:var(--text3);margin-top:0.15rem">vs ${(combatState?.monster||P.activeCombat?.monster)?.name||"Unknown"}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:0.3rem">
        <button class="btn btn-danger btn-sm" onclick="G.resumeCombat()">Resume</button>
        <button class="btn btn-ghost btn-sm" style="font-size:0.62rem" onclick="G.abandonCombat()">Abandon</button>
      </div>
    </div>`:""}

    <div class="two-col" style="margin-bottom:0.5rem">
      <button class="btn btn-steel btn-sm" style="width:100%;padding:0.7rem" onclick="G.showTab('quests')">
        📜 Daily Quests <span style="color:${qDone===3?"var(--green2)":"var(--gold2)"}">${qDone}/3</span>
      </button>
      <button class="btn btn-purple btn-sm" style="width:100%;padding:0.7rem" onclick="G.showTab('arena')">
        ⚔️ Battle Arena
      </button>
    </div>
    <div class="two-col">
      <button class="btn btn-gold btn-sm" style="width:100%;padding:0.7rem" onclick="G.showTab('properties')">
        🏠 Properties
      </button>
      <button class="btn btn-ghost btn-sm" style="width:100%;padding:0.7rem" onclick="G.showTab('you')">
        👤 Profile
      </button>
    </div>`;
}

// ── STAT POINTS MODAL ─────────────────────────────────────────
function openStatModal(){
  if(!P.statPoints||P.statPoints<1){toast("No stat points available!");return;}
  document.getElementById("modal-content").innerHTML=`
    <div class="modal-title">⬆️ Spend Stat Points</div>
    <div style="text-align:center;color:var(--text3);font-size:0.85rem;margin-bottom:1rem">
      You have <strong style="color:var(--gold2)">${P.statPoints}</strong> point${P.statPoints>1?"s":""} to spend.
    </div>
    <div class="modal-row"><em>⚔️ Strength</em><strong style="color:var(--crimson2)">${P.baseStr}</strong></div>
    <div class="modal-row"><em>🛡️ Defence</em><strong style="color:var(--steel2)">${P.baseDef}</strong></div>
    <div class="modal-row"><em>❤️ Max HP</em><strong style="color:var(--crimson)">${P.maxHp}</strong></div>
    <div style="margin-top:1rem;display:flex;flex-direction:column;gap:0.5rem">
      <button class="btn btn-danger" onclick="G.spendStat('str')">+1 Strength (Attack)</button>
      <button class="btn btn-steel" onclick="G.spendStat('def')">+1 Defence</button>
      <button class="btn btn-ghost" onclick="G.spendStat('hp')">+10 Max HP</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Close</button>
    </div>`;
  document.getElementById("modal-overlay").style.display="flex";
}

function spendStat(stat){
  if(!P.statPoints||P.statPoints<1){toast("No stat points!");return;}
  P.statPoints--;
  if(stat==="str"){ P.baseStr=(P.baseStr||10)+1; toast("⚔️ +1 Strength!"); }
  else if(stat==="def"){
    P.baseDef=(P.baseDef||5)+1;
    const{def:eDef}=equipStats(P.equipped);
    P.maxHp=maxHpCalc(P.level,(P.baseDef)+eDef,P.bonusHp||0);
    toast("🛡️ +1 Defence!");
  }
  else if(stat==="hp"){
    P.bonusHp=(P.bonusHp||0)+10;
    const{def:eDef}=equipStats(P.equipped);
    P.maxHp=maxHpCalc(P.level,(P.baseDef||5)+eDef,P.bonusHp);
    toast("❤️ +10 Max HP!");
  }
  saveP();
  if(P.statPoints>0) openStatModal();
  else{ closeModal(); renderHome(); }
}

// ── WALK AREA SELECT ─────────────────────────────────────────
function renderWalkAreaSelect(){
  TAB="walk";
  ["home","gear","market","social"].forEach(t=>{
    const b=document.getElementById("nav-"+t);if(b)b.classList.remove("active");
  });

  const maxE=calcMaxEnergy();
  const enPct=Math.round((P.energy/maxE)*100);
  const unlockedAreas=WALK_AREAS.filter(a=>P.level>=a.minLevel);
  const lockedAreas=WALK_AREAS.filter(a=>P.level<a.minLevel);

  const areaCards=unlockedAreas.map(area=>{
    const isActive=CURRENT_AREA&&CURRENT_AREA.id===area.id;
    return`<div onclick="G.selectArea('${area.id}')" style="
      background:${isActive?area.gradient:"var(--surface)"};
      border:2px solid ${isActive?"var(--gold2)":"var(--border)"};
      border-radius:12px;padding:0.9rem;margin-bottom:0.5rem;cursor:pointer;
      transition:all 0.2s;position:relative;overflow:hidden">
      <div style="display:flex;align-items:center;gap:0.75rem">
        <div style="font-size:2rem;flex-shrink:0">${area.emoji}</div>
        <div style="flex:1">
          <div style="font-family:'Cinzel',serif;font-size:0.9rem;color:${isActive?"var(--gold2)":"var(--text)"}">${area.name}</div>
          <div style="font-size:0.75rem;color:var(--text3);margin-top:0.15rem">${area.desc}</div>
          <div style="display:flex;gap:0.5rem;margin-top:0.35rem;flex-wrap:wrap">
            <span style="font-size:0.65rem;color:var(--green2)">+${Math.round((area.expMult-1)*100)}% EXP</span>
            <span style="font-size:0.65rem;color:var(--gold2)">+${Math.round((area.goldMult-1)*100)}% Gold</span>
            ${area.lootBonus>0?`<span style="font-size:0.65rem;color:var(--steel2)">+${Math.round(area.lootBonus*100)}% Loot</span>`:""}
          </div>
        </div>
        ${isActive?`<div style="font-family:'Cinzel',serif;font-size:0.7rem;color:var(--gold2)">Selected ✓</div>`:""}
      </div>
    </div>`;
  }).join("");

  const lockedCards=lockedAreas.map(area=>`
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:0.9rem;margin-bottom:0.5rem;opacity:0.5">
      <div style="display:flex;align-items:center;gap:0.75rem">
        <div style="font-size:2rem">🔒</div>
        <div>
          <div style="font-family:'Cinzel',serif;font-size:0.9rem">${area.name}</div>
          <div style="font-size:0.75rem;color:var(--text3)">Unlocks at Level ${area.minLevel}</div>
        </div>
      </div>
    </div>`).join("");

  const feedHtml=feed.length===0
    ?`<div class="feed-empty" style="padding:1.5rem">Select an area above and tap the ⚔️ button to begin!</div>`
    :feed.map(f=>`<div class="feed-item">
        <div class="feed-icon">${f.image?`<img src="${f.image}" alt="${f.emoji}" style="width:32px;height:32px;object-fit:contain">`:(f.emoji||"🌿")}</div>
        <div class="feed-text">${f.text}</div>
        <div class="feed-badge" style="color:${f.color}">${f.badge}</div>
      </div>`).join("");

  document.getElementById("content").innerHTML=`
    <div class="card">
      <div class="card-title">⚡ Energy ${P.energy}/${maxE}</div>
      <div class="bar bar-energy"><div class="bar-fill" style="width:${enPct}%"></div></div>
      <div style="font-size:0.78rem;color:var(--text3);margin-top:0.4rem">Each step costs 1 energy · Regen: 1 per 3 min</div>
<button class="btn btn-steel" onclick="G.takeStep()" style="margin-top:0.6rem">⚔️ Take Step (${P.energy} EP)</button>
    </div>
    <div class="section-hdr">Choose Your Area</div>
    ${areaCards}${lockedCards}
    <div class="section-hdr">Recent Steps</div>
    ${feedHtml}`;
}

function selectArea(id){
  CURRENT_AREA=WALK_AREAS.find(a=>a.id===id)||null;
  renderWalkAreaSelect();
}

// ── GEAR ─────────────────────────────────────────────────────
function renderGear(){
  const inv=P.inventory||[], eq=P.equipped||{};
  const slotsHtml=EQUIP_SLOTS.map(slot=>{
    const item=eq[slot];
    const iconHtml=item?gfx(item.image,item.emoji,26):SLOT_EMOJI[slot];
    return`<div class="equip-slot ${item?"filled":""}" ${item?`onclick="G.openItemModal('equipped','${slot}')"`:""}> 
      <div class="es-icon">${iconHtml}</div>
      <div class="es-info">${item
        ?`<div class="es-name" style="color:${RARITY_COLOR[item.rarity]}">${item.name}</div>
           <div class="es-stat">+${item.val} ${item.stat==="str"?"STR":"DEF"}</div>`
        :`<div class="es-empty">Empty</div>`}
      </div>
      <div class="es-type">${slot}</div>
    </div>`;
  }).join("");

  const invHtml=inv.length===0
    ?`<div class="inv-empty">No items yet — go explore!</div>`
    :inv.map((item,i)=>{
      const q=qualityLabel(item.val,item.base||item.val);
      return`<div class="inv-item" onclick="G.openItemModal('inv',${i})">
        <span class="quality-badge" style="background:${q.color}22;color:${q.color}">${q.label}</span>
        <div class="inv-icon">${gfx(item.image,item.emoji,40)}</div>
        <div class="inv-item-name" style="color:${RARITY_COLOR[item.rarity]}">${item.name}</div>
        <div class="inv-item-stat">+${item.val} ${item.stat==="str"?"STR":"DEF"}</div>
      </div>`;
    }).join("");

  document.getElementById("content").innerHTML=`
    <div class="section-hdr">Equipped (${EQUIP_SLOTS.length} slots)</div>
    <div class="equip-grid">${slotsHtml}</div>
    <div class="section-hdr">Inventory (${inv.length} items)</div>
    <div class="inv-grid">${invHtml}</div>`;
}

// ── PROPERTIES ────────────────────────────────────────────────
function renderProperties(){
  const owned=getOwnedProperties();
  const rentalPending=getRentalIncome();

  const ownedHtml=owned.length===0?"":owned.map(op=>{
    const prop=PROPERTIES.find(p=>p.id===op.id);if(!prop)return"";
    const isHome=P.homePropertyId===op.id;
    const daily=Math.floor(prop.price*prop.rentalRate);
    const sellPrice=Math.floor(prop.price*CFG.PROPERTY_SELL_RATE);
    return`<div style="background:var(--surface);border:1px solid ${isHome?"var(--gold2)":"var(--border)"};border-radius:12px;padding:0.9rem;margin-bottom:0.5rem">
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
        <div style="font-size:2rem">${prop.emoji}</div>
        <div style="flex:1">
          <div style="font-family:'Cinzel',serif;font-size:0.9rem;color:${isHome?"var(--gold2)":"var(--text)"}">${prop.name}${isHome?" 🏠":""}</div>
          <div style="font-size:0.75rem;color:var(--text3)">${prop.desc}</div>
          ${isHome
            ?`<div style="font-size:0.72rem;color:var(--steel2);margin-top:0.2rem">+${prop.energyBonus} Max Energy (your home)</div>`
            :`<div style="font-size:0.72rem;color:var(--green2);margin-top:0.2rem">🪙${fmt(daily)}/day rental income</div>`}
        </div>
      </div>
      <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
        ${!isHome?`<button class="btn btn-steel btn-sm" onclick="G.setHome('${prop.id}')">Move In</button>`:""}
        ${isHome&&owned.length>1?`<button class="btn btn-ghost btn-sm" onclick="G.unsetHome()">Move Out</button>`:""}
        <button class="btn btn-danger btn-sm" onclick="G.sellProperty('${prop.id}')">Sell (🪙${fmt(sellPrice)})</button>
      </div>
    </div>`;
  }).join("");

  const availHtml=PROPERTIES.filter(p=>!ownsProperty(p.id)).map(prop=>`
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:0.9rem;margin-bottom:0.5rem">
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
        <div style="font-size:2rem">${prop.emoji}</div>
        <div style="flex:1">
          <div style="font-family:'Cinzel',serif;font-size:0.9rem">${prop.name}</div>
          <div style="font-size:0.75rem;color:var(--text3)">${prop.desc}</div>
          <div style="display:flex;gap:0.6rem;margin-top:0.25rem;flex-wrap:wrap">
            <span style="font-size:0.7rem;color:var(--steel2)">+${prop.energyBonus} energy if home</span>
            <span style="font-size:0.7rem;color:var(--green2)">🪙${fmt(Math.floor(prop.price*prop.rentalRate))}/day rent</span>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-family:'Cinzel',serif;color:var(--gold2);font-size:0.9rem">🪙${fmt(prop.price)}</div>
        </div>
      </div>
      <button class="btn btn-gold btn-sm" onclick="G.buyProperty('${prop.id}')" ${(P.gold||0)<prop.price?"disabled":""}>
        ${(P.gold||0)>=prop.price?"Purchase":"Need 🪙"+fmt(prop.price)}
      </button>
    </div>`).join("");

  document.getElementById("content").innerHTML=`
    ${rentalPending>0?`
    <div style="background:rgba(39,174,96,0.15);border:1px solid var(--green);border-radius:12px;
      padding:0.85rem;margin-bottom:0.7rem;display:flex;align-items:center;gap:0.75rem">
      <div style="font-size:1.5rem">🏠</div>
      <div style="flex:1">
        <div style="font-family:'Cinzel',serif;font-size:0.82rem;color:var(--green2)">🪙${fmt(rentalPending)} in Rental Income!</div>
        <div style="font-size:0.75rem;color:var(--text3)">From ${owned.filter(o=>o.id!==P.homePropertyId).length} rented properties</div>
      </div>
      <button class="btn btn-green btn-sm" onclick="G.claimRent()">Collect</button>
    </div>`:""}

    ${owned.length>0?`<div class="section-hdr">Your Properties (${owned.length})</div>${ownedHtml}`:""}

    <div class="section-hdr">Available to Buy</div>
    ${availHtml||`<div style="text-align:center;color:var(--text3);font-style:italic;padding:1rem">You own every property!</div>`}

    <button class="btn btn-ghost" onclick="G.showTab('home')" style="margin-top:0.5rem">← Back</button>`;
}

function buyProperty(id){
  const prop=PROPERTIES.find(p=>p.id===id);
  if(!prop||ownsProperty(id)){toast("Already owned!");return;}
  if((P.gold||0)<prop.price){toast("💰 Not enough gold!");return;}
  P.gold-=prop.price;
  P.properties=[...(P.properties||[]),{id:prop.id,purchasedAt:Date.now(),lastRentClaim:Date.now()}];
  // Auto set as home if no home
  if(!P.homePropertyId) P.homePropertyId=prop.id;
  saveP();
  toast(`🏠 Purchased ${prop.name}!`);
  renderProperties();
}

function setHome(id){
  P.homePropertyId=id;
  const maxE=calcMaxEnergy();
  P.energy=Math.min(P.energy,maxE);
  saveP();
  toast("🏠 Moved in!");
  renderProperties();
}

function unsetHome(){
  P.homePropertyId=null;
  const maxE=calcMaxEnergy();
  P.energy=Math.min(P.energy,maxE);
  saveP();
  toast("🏠 You're homeless now. Find a new home!");
  renderProperties();
}

function sellProperty(id){
  const prop=PROPERTIES.find(p=>p.id===id);
  if(!prop){return;}
  const sellPrice=Math.floor(prop.price*CFG.PROPERTY_SELL_RATE);
  document.getElementById("modal-content").innerHTML=`
    <div class="modal-title">Sell Property?</div>
    <div style="text-align:center;font-size:3rem;margin:0.5rem 0">${prop.emoji}</div>
    <div style="text-align:center;color:var(--text3);font-size:0.88rem;margin-bottom:1rem">
      Sell <strong style="color:var(--text)">${prop.name}</strong> for <strong style="color:var(--gold2)">🪙${fmt(sellPrice)}</strong>?<br>
      <span style="font-size:0.75rem">(80% of purchase price)</span>
    </div>
    <div class="modal-actions">
      <button class="btn btn-danger" onclick="G.confirmSellProperty('${id}')">Confirm Sale</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Cancel</button>
    </div>`;
  document.getElementById("modal-overlay").style.display="flex";
}

function confirmSellProperty(id){
  const prop=PROPERTIES.find(p=>p.id===id);
  if(!prop)return;
  const sellPrice=Math.floor(prop.price*CFG.PROPERTY_SELL_RATE);
  P.properties=(P.properties||[]).filter(op=>op.id!==id);
  if(P.homePropertyId===id) P.homePropertyId=null;
  P.gold=(P.gold||0)+sellPrice;
  saveP(); closeModal();
  toast(`🪙 Sold ${prop.name} for ${fmt(sellPrice)} gold!`);
  renderProperties();
}

// ── QUESTS ───────────────────────────────────────────────────
function renderQuests(){
  const qs=getQuests();
  const now=new Date();
  const msUntilReset=(24-now.getUTCHours())*3600000-now.getUTCMinutes()*60000;
  const hReset=Math.floor(msUntilReset/3600000);
  const mReset=Math.floor((msUntilReset%3600000)/60000);
  const questsHtml=qs.map(q=>{
    const done=q.progress>=q.target;
    const pct=Math.min(100,Math.round((q.progress/q.target)*100));
    return`<div class="quest-item">
      <div class="quest-top">
        <div class="quest-icon">${q.icon}</div>
        <div class="quest-info">
          <div class="quest-name ${done?"quest-done":""}">${q.name} ${done?"✓":""}</div>
          <div class="quest-desc">${q.desc}</div>
          <div class="quest-reward">🎁 +${q.reward.exp} EXP · +${q.reward.gold}🪙</div>
        </div>
        ${done&&!q.claimed?`<button class="btn btn-green btn-sm" onclick="G.claimQuest('${q.id}')">Claim</button>`:done?`<span style="color:var(--text3);font-size:0.72rem">Claimed</span>`:""}
      </div>
      <div class="bar bar-quest" style="height:5px"><div class="bar-fill" style="width:${pct}%"></div></div>
      <div style="font-size:0.7rem;color:var(--text3);margin-top:0.2rem">${q.progress}/${q.target}</div>
    </div>`;
  }).join("");
  document.getElementById("content").innerHTML=`
    <div class="card">
      <div class="card-title">📜 Daily Quests</div>
      <div style="font-size:0.78rem;color:var(--text3);margin-bottom:0.75rem">Resets in ${hReset}h ${mReset}m</div>
      ${questsHtml}
    </div>
    <button class="btn btn-ghost" onclick="G.showTab('home')" style="margin-top:0.5rem">← Back</button>`;
}

function claimQuest(id){
  const q=P.quests.list.find(x=>x.id===id);
  if(!q||q.claimed||q.progress<q.target)return;
  q.claimed=true;
  P.exp=(P.exp||0)+q.reward.exp;
  P.gold=(P.gold||0)+q.reward.gold;
  checkLevelUp(); saveP();
  toast(`🎁 Claimed! +${q.reward.exp} EXP · +${q.reward.gold}🪙`);
  renderQuests();
}

// ── ARENA ─────────────────────────────────────────────────────
function renderArena(){
  const tierIdx=arenaT(P.arenaWins||0);
  const tier=ARENA_TIERS[tierIdx];
  const nextTier=ARENA_TIERS[tierIdx+1];
  const wins=P.arenaWins||0, losses=P.arenaLosses||0;
  const pct=nextTier?Math.round(((wins-tier.wins)/(nextTier.wins-tier.wins))*100):100;
  document.getElementById("content").innerHTML=`
    <div class="card">
      <div class="arena-tier">
        <div style="font-size:2.5rem">${TIER_EMOJIS[tierIdx]}</div>
        <div class="arena-tier-name" style="color:${tier.color}">${tier.name} League</div>
        <div class="arena-tier-sub">${wins} wins · ${losses} losses</div>
        ${nextTier?`
          <div class="bar bar-arena" style="margin:0.5rem auto;max-width:200px"><div class="bar-fill" style="width:${pct}%"></div></div>
          <div style="font-size:0.72rem;color:var(--text3)">${wins}/${nextTier.wins} wins to ${nextTier.name}</div>
        `:`<div style="font-size:0.82rem;color:var(--gold2)">👑 Maximum rank achieved!</div>`}
      </div>
    </div>
    <div class="card">
      <div class="card-title">📊 Tier Bonuses</div>
      <div class="modal-row"><em>EXP Bonus</em><span style="color:var(--green2)">×${tier.expBonus.toFixed(2)}</span></div>
      <div class="modal-row"><em>Gold Bonus</em><span style="color:var(--gold2)">×${tier.goldBonus.toFixed(2)}</span></div>
    </div>
    <div class="card">
      <div class="card-title">⚔️ Fight</div>
      <div style="font-size:0.85rem;color:var(--text3);margin-bottom:0.75rem">Generate a monster scaled to your arena tier.<br>Costs ${CFG.ARENA_COST_GOLD}🪙 and ${CFG.ARENA_COST_EP} energy.</div>
      <button class="btn btn-purple" onclick="G.startArenaBattle()">⚔️ Generate Arena Monster (${CFG.ARENA_COST_GOLD}🪙)</button>
    </div>
    <button class="btn btn-ghost" onclick="G.showTab('home')" style="margin-top:0.5rem">← Back</button>`;
}

function startArenaBattle(){
  if((P.gold||0)<CFG.ARENA_COST_GOLD){toast("💰 Not enough gold!");return;}
  const maxE=calcMaxEnergy();
  if(P.energy<CFG.ARENA_COST_EP){toast("⚡ Not enough energy!");return;}
  P.gold-=CFG.ARENA_COST_GOLD; P.energy-=CFG.ARENA_COST_EP;
  const tierIdx=arenaT(P.arenaWins||0);
  const tier=ARENA_TIERS[tierIdx];
  const{str:eStr,def:eDef}=equipStats(P.equipped);
  const tStr=(P.baseStr||10)+eStr, tDef=(P.baseDef||5)+eDef;
  const m={
    name:`${tier.name} Champion`,
    emoji:["🗡️","⚔️","🏹","🛡️","🔱","💀","👑"][tierIdx],
    image:"",desc:`A ${tier.name} League champion. Formidable.`,
    str:Math.round(tStr*(0.8+Math.random()*0.6)),
    def:Math.round(tDef*(0.8+Math.random()*0.6)),
    hp:P.maxHp+Math.round(P.maxHp*tierIdx*0.15),
    maxHp:P.maxHp+Math.round(P.maxHp*tierIdx*0.15),
    expReward:Math.round(100*tier.expBonus*(1+tierIdx*0.2)),
    goldReward:Math.round(150*tier.goldBonus*(1+tierIdx*0.2)),
    isArena:true,tierIdx
  };
  saveP(); updateWalkBtn(); openCombatModal(m);
}

// ── BANK ─────────────────────────────────────────────────────
function renderBank(){
  document.getElementById("content").innerHTML=`
    <div class="card">
      <div class="card-title">🏦 Royal Bank</div>
      <div class="bank-display"><div class="bank-amount">🏦 ${fmt(P.bank)}</div><div class="bank-label">Bank Balance</div></div>
      <div class="bank-display" style="margin-bottom:0.75rem"><div class="bank-amount">🪙 ${fmt(P.gold)}</div><div class="bank-label">On Hand</div></div>
      <div style="font-size:0.82rem;color:var(--text3);margin-bottom:0.6rem">Deposit Gold</div>
      <div class="bank-input-row">
        <input class="bank-input" id="deposit-amt" type="number" placeholder="Amount" min="1"/>
        <button class="btn btn-gold btn-sm" style="width:auto;padding:0.65rem 1rem" onclick="G.doDeposit()">Deposit</button>
      </div>
      <div style="font-size:0.82rem;color:var(--text3);margin-bottom:0.6rem;margin-top:0.5rem">Withdraw Gold</div>
      <div class="bank-input-row">
        <input class="bank-input" id="withdraw-amt" type="number" placeholder="Amount" min="1"/>
        <button class="btn btn-ghost btn-sm" style="width:auto;padding:0.65rem 1rem" onclick="G.doWithdraw()">Withdraw</button>
      </div>
      <div style="font-size:0.72rem;color:var(--text3);margin-top:0.5rem">Gold in the bank is safe from anything.</div>
    </div>
    <button class="btn btn-ghost" onclick="G.showTab('home')" style="margin-top:0.5rem">← Back</button>`;
}

function doDeposit(){
  const amt=Math.floor(Number(document.getElementById("deposit-amt").value));
  if(!amt||amt<1){toast("Enter a valid amount");return;}
  if(amt>(P.gold||0)){toast("Not enough gold on hand!");return;}
  P.gold-=amt; P.bank=(P.bank||0)+amt;
  saveP(); toast(`🏦 Deposited ${fmt(amt)} gold`); renderBank();
}
function doWithdraw(){
  const amt=Math.floor(Number(document.getElementById("withdraw-amt").value));
  if(!amt||amt<1){toast("Enter a valid amount");return;}
  if(amt>(P.bank||0)){toast("Not enough in bank!");return;}
  P.bank-=amt; P.gold=(P.gold||0)+amt;
  saveP(); toast(`🪙 Withdrew ${fmt(amt)} gold`); renderBank();
}

// ── MARKET ────────────────────────────────────────────────────
async function renderMarket(){
  document.getElementById("content").innerHTML=`<div class="card"><div style="text-align:center;color:var(--text3);padding:1rem">Loading market...</div></div>`;
  const listings=await getListings();
  const others=listings.filter(l=>l.sellerId!==CU.uid);
  document.getElementById("content").innerHTML=`
    <div class="tab-row" style="margin-bottom:0.75rem">
      <button class="tab-btn active" id="mtab-browse" onclick="G.mTab('browse')">Browse</button>
      <button class="tab-btn" id="mtab-sell" onclick="G.mTab('sell')">Sell</button>
      <button class="tab-btn" id="mtab-shop" onclick="G.mTab('shop')">NPC Shop</button>
      <button class="tab-btn" id="mtab-mine" onclick="G.mTab('mine')">My Listings</button>
    </div>
    <div id="market-body"></div>`;
  renderMarketBrowse(others);
}

function mTab(t){
  ["browse","sell","shop","mine"].forEach(x=>{const b=document.getElementById("mtab-"+x);if(b)b.classList.toggle("active",x===t);});
  if(t==="browse") getListings().then(l=>renderMarketBrowse(l.filter(x=>x.sellerId!==CU.uid)));
  else if(t==="sell") renderMarketSell();
  else if(t==="shop") renderMarketShop();
  else if(t==="mine") getListings().then(l=>renderMyListings(l.filter(x=>x.sellerId===CU.uid)));
}

function renderMarketBrowse(listings){
  const body=document.getElementById("market-body");if(!body)return;
  if(listings.length===0){body.innerHTML=`<div style="text-align:center;color:var(--text3);padding:2rem;font-style:italic">No items listed yet.</div>`;return;}
  body.innerHTML=listings.map(l=>{
    const q=qualityLabel(l.item.val,l.item.base||l.item.val);
    return`<div class="market-item">
      <div class="market-icon">${gfx(l.item.image,l.item.emoji,36)}</div>
      <div class="market-info">
        <div class="market-name" style="color:${RARITY_COLOR[l.item.rarity]}">${l.item.name}
          <span class="pill" style="background:${q.color}22;color:${q.color};font-size:0.6rem">${q.label}</span>
        </div>
        <div class="market-seller">Sold by ${l.sellerName}</div>
        <div class="market-stat">+${l.item.val} ${l.item.stat==="str"?"STR":"DEF"} · ${l.item.type}</div>
      </div>
      <div>
        <div class="market-price">🪙${fmt(l.price)}</div>
        <button class="btn btn-gold btn-sm" style="margin-top:0.3rem" onclick="G.buyListing('${l.id}',${l.price})">Buy</button>
      </div>
    </div>`;
  }).join("");
}

function renderMarketSell(){
  const body=document.getElementById("market-body");if(!body)return;
  const inv=P.inventory||[];
  if(inv.length===0){body.innerHTML=`<div style="text-align:center;color:var(--text3);padding:2rem;font-style:italic">No items to sell.</div>`;return;}
  body.innerHTML=`
    <div style="font-size:0.8rem;color:var(--text3);margin-bottom:0.75rem">A ${Math.round(CFG.MARKET_FEE*100)}% fee is deducted. Or sell to NPC Shop for quick gold.</div>
    ${inv.map((item,i)=>{
      const q=qualityLabel(item.val,item.base||item.val);
      const npcVal=Math.max(5,Math.floor((item.shopPrice||item.base*item.val*2||50)*CFG.SHOP_SELL_RATE));
      return`<div class="market-item">
        <div class="market-icon">${gfx(item.image,item.emoji,36)}</div>
        <div class="market-info">
          <div class="market-name" style="color:${RARITY_COLOR[item.rarity]}">${item.name}
            <span class="pill" style="background:${q.color}22;color:${q.color};font-size:0.6rem">${q.label}</span>
          </div>
          <div class="market-stat">+${item.val} ${item.stat==="str"?"STR":"DEF"}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:0.3rem;align-items:flex-end">
          <button class="btn btn-gold btn-sm" onclick="G.promptSell(${i})">List</button>
          <button class="btn btn-ghost btn-sm" onclick="G.sellToNpc(${i})" style="font-size:0.65rem">NPC 🪙${npcVal}</button>
        </div>
      </div>`;
    }).join("")}`;
}

function sellToNpc(idx){
  const item=(P.inventory||[])[idx];if(!item)return;
  const npcVal=Math.max(5,Math.floor((item.shopPrice||item.base*item.val*2||50)*CFG.SHOP_SELL_RATE));
  P.inventory=P.inventory.filter((_,i)=>i!==idx);
  P.gold=(P.gold||0)+npcVal;
  saveP(); toast(`🛒 Sold ${item.name} to NPC for 🪙${npcVal}`);
  renderMarketSell();
}

function renderMarketShop(){
  const body=document.getElementById("market-body");if(!body)return;
  const shopItems=ITEMS.filter(i=>i.shopPrice>0);
  const shopPets=PETS.filter(p=>p.rarity==="common"||p.rarity==="uncommon");
  const equipHtml=shopItems.map((item,i)=>`
    <div class="shop-item">
      <div class="shop-icon">${gfx(item.image,item.emoji,40)}</div>
      <div class="shop-info">
        <div class="shop-name" style="color:${RARITY_COLOR[item.rarity]}">${item.name}</div>
        <div class="shop-desc">+~${item.base} ${item.stat==="str"?"STR":"DEF"} · ${item.type}</div>
      </div>
      <div>
        <div class="shop-price">🪙${fmt(item.shopPrice)}</div>
        <button class="btn btn-gold btn-sm" style="margin-top:0.3rem" onclick="G.buyShopItem('item',${i})">Buy</button>
      </div>
    </div>`).join("");
  const petBasePrice=300;
  const petHtml=shopPets.map((pet,i)=>{
    const price=Math.round(petBasePrice*(pet.base/5));
    return`<div class="shop-item">
      <div class="shop-icon">${gfx(pet.image,pet.emoji,40)}</div>
      <div class="shop-info">
        <div class="shop-name" style="color:${RARITY_COLOR[pet.rarity]}">${pet.name}</div>
        <div class="shop-desc">+~${pet.base} ${pet.stat==="str"?"STR":"DEF"} · Pet</div>
      </div>
      <div>
        <div class="shop-price">🪙${fmt(price)}</div>
        <button class="btn btn-gold btn-sm" style="margin-top:0.3rem" onclick="G.buyShopItem('pet',${i})">Buy</button>
      </div>
    </div>`;
  }).join("");
  const consumeHtml=SHOP_CONSUMABLES.map(c=>`
    <div class="shop-item">
      <div class="shop-icon">${c.emoji}</div>
      <div class="shop-info"><div class="shop-name">${c.name}</div><div class="shop-desc">${c.desc}</div></div>
      <div>
        <div class="shop-price">🪙${fmt(c.price)}</div>
        <button class="btn btn-gold btn-sm" style="margin-top:0.3rem" onclick="G.buyConsumable('${c.id}')">Buy</button>
      </div>
    </div>`).join("");
  body.innerHTML=`
    <div style="font-size:0.78rem;color:var(--text3);margin-bottom:0.6rem">Your gold: 🪙${fmt(P.gold)}</div>
    <div class="section-hdr">Consumables</div>${consumeHtml}
    <div class="section-hdr">🐾 Pets</div>${petHtml||`<div style="color:var(--text3);font-style:italic;padding:0.5rem">No pets.</div>`}
    <div class="section-hdr">Equipment</div>${equipHtml}`;
}

function renderMyListings(listings){
  const body=document.getElementById("market-body");if(!body)return;
  if(listings.length===0){body.innerHTML=`<div style="text-align:center;color:var(--text3);padding:2rem;font-style:italic">You have no active listings.</div>`;return;}
  body.innerHTML=listings.map(l=>`
    <div class="market-item">
      <div class="market-icon">${gfx(l.item.image,l.item.emoji,36)}</div>
      <div class="market-info">
        <div class="market-name" style="color:${RARITY_COLOR[l.item.rarity]}">${l.item.name}</div>
        <div class="market-stat">+${l.item.val} ${l.item.stat==="str"?"STR":"DEF"}</div>
      </div>
      <div>
        <div class="market-price">🪙${fmt(l.price)}</div>
        <button class="btn btn-danger btn-sm" style="margin-top:0.3rem" onclick="G.cancelListing('${l.id}',${JSON.stringify(l.item).split("'").join("&#39;")})">Cancel</button>
      </div>
    </div>`).join("");
}

async function buyListing(id,price){
  if((P.gold||0)<price){toast("💰 Not enough gold!");return;}
  const snap=await getDoc(doc(db,"market",id));
  if(!snap.exists()){toast("Listing no longer available.");renderMarket();return;}
  const listing=snap.data();
  P.gold-=price; P.inventory=[...(P.inventory||[]),listing.item];
  await removeListing(id); saveP();
  toast(`✅ Bought ${listing.item.name} for 🪙${fmt(price)}!`);
  updateQuestProgress("items"); renderMarket();
}
async function cancelListing(id,item){
  await removeListing(id); P.inventory=[...(P.inventory||[]),item]; saveP();
  toast("📦 Listing cancelled."); renderMarket();
}
function promptSell(idx){
  const item=(P.inventory||[])[idx];if(!item)return;
  const suggestedPrice=item.base?(item.base*item.val*2):200;
  document.getElementById("modal-content").innerHTML=`
    <div class="modal-title">List on Market</div>
    <div class="modal-icon">${gfx(item.image,item.emoji,72)}</div>
    <div style="text-align:center;color:${RARITY_COLOR[item.rarity]};margin-bottom:0.5rem">${item.name}</div>
    <div style="font-size:0.82rem;color:var(--text3);text-align:center;margin-bottom:1rem">+${item.val} ${item.stat==="str"?"STR":"DEF"}</div>
    <div style="font-size:0.8rem;color:var(--text3);margin-bottom:0.4rem">Set your price (gold):</div>
    <input class="modal-input" id="sell-price" type="number" value="${suggestedPrice}" min="1"/>
    <div style="font-size:0.72rem;color:var(--text3);margin-bottom:0.75rem">${Math.round(CFG.MARKET_FEE*100)}% fee on sale.</div>
    <div class="modal-actions">
      <button class="btn btn-gold" onclick="G.confirmSell(${idx})">List Item</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Cancel</button>
    </div>`;
  document.getElementById("modal-overlay").style.display="flex";
}
async function confirmSell(idx){
  const price=Math.floor(Number(document.getElementById("sell-price").value));
  if(!price||price<1){toast("Enter a valid price");return;}
  const item=(P.inventory||[])[idx];if(!item)return;
  P.inventory=P.inventory.filter((_,i)=>i!==idx);
  await addListing(item,price); saveP(); closeModal();
  toast(`🏪 Listed ${item.name} for 🪙${fmt(price)}!`); renderMarket();
}
function buyShopItem(kind,idx){
  let template,price;
  if(kind==="pet"){const sp=PETS.filter(p=>p.rarity==="common"||p.rarity==="uncommon");template=sp[idx];price=Math.round(300*(template.base/5));}
  else{const si=ITEMS.filter(i=>i.shopPrice>0);template=si[idx];price=template.shopPrice;}
  if(!template)return;
  if((P.gold||0)<price){toast("💰 Not enough gold!");return;}
  const val=rollItemStat(template);
  const item={...template,val,base:template.base,id:`item_${Date.now()}_${rand(0,9999)}`};
  delete item.shopPrice;delete item.dropRate;
  P.gold-=price; P.inventory=[...(P.inventory||[]),item];
  P.itemsFound=(P.itemsFound||0)+1; saveP(); updateQuestProgress("items");
  toast(`🛒 Bought ${item.name} (+${val})!`); renderMarketShop();
}
function buyConsumable(id){
  const c=SHOP_CONSUMABLES.find(x=>x.id===id);if(!c)return;
  if((P.gold||0)<c.price){toast("💰 Not enough gold!");return;}
  P.gold-=c.price; applyConsumable(c.effect); saveP();
  toast(`${c.emoji} Used ${c.name}!`); updateWalkBtn();
  if(TAB==="market")renderMarket();
}
function applyConsumable(effect){
  const maxE=calcMaxEnergy();
  if(effect==="heal_small"){P.hp=Math.min(P.maxHp,P.hp+Math.floor(P.maxHp*CFG.POTION_HEAL_SMALL));toast(`❤️ Restored HP!`);}
  else if(effect==="heal_big"){P.hp=Math.min(P.maxHp,P.hp+Math.floor(P.maxHp*CFG.POTION_HEAL_BIG));toast(`❤️ Restored HP!`);}
  else if(effect==="energy_full"){P.energy=maxE;P.lastEnergyTime=Date.now();toast("⚡ Energy restored!");updateWalkBtn();}
  else if(effect==="exp_200"){P.exp=(P.exp||0)+200;checkLevelUp();toast("📜 +200 EXP!");}
}

// ── SOCIAL ────────────────────────────────────────────────────
let _lbCache=null;
async function renderSocial(){
  document.getElementById("content").innerHTML=`<div class="card"><div style="text-align:center;color:var(--text3);padding:1rem">Loading...</div></div>`;
  _lbCache=await loadLeaderboard();
  document.getElementById("content").innerHTML=`
    <div class="tab-row" style="margin-bottom:0.75rem;flex-wrap:wrap;gap:3px" id="lb-tabs">
      <button class="tab-btn active" onclick="G.lbTab('level')">🏆 Level</button>
      <button class="tab-btn" onclick="G.lbTab('kills')">💀 Kills</button>
      <button class="tab-btn" onclick="G.lbTab('arena')">⚔️ Arena</button>
      <button class="tab-btn" onclick="G.lbTab('steps')">👣 Steps</button>
      <button class="tab-btn" onclick="G.lbTab('gold')">🪙 Gold</button>
      <button class="tab-btn" onclick="G.lbTab('items')">🎁 Items</button>
    </div>
    <div id="lb-body"></div>
    <div class="card" style="margin-top:0.5rem">
      <div class="card-title">⚙️ Account</div>
      <button class="btn btn-ghost" onclick="G.showTab('you')">👤 My Profile</button>
      <button class="btn btn-ghost" onclick="G.handleSignOut()">Sign Out</button>
    </div>`;
  lbTab("level");
}
function lbTab(type){
  document.querySelectorAll("#lb-tabs .tab-btn").forEach((b,i)=>{
    const types=["level","kills","arena","steps","gold","items"];
    b.classList.toggle("active",types[i]===type);
  });
  const all=_lbCache||[];
  let sorted,valFn,title;
  if(type==="level"){sorted=[...all].sort((a,b)=>b.level-a.level||(b.exp||0)-(a.exp||0));valFn=p=>`Lv.${p.level}`;title="🏆 Level Rankings";}
  else if(type==="kills"){sorted=[...all].sort((a,b)=>(b.npcKills||0)-(a.npcKills||0));valFn=p=>`${fmt(p.npcKills||0)} kills`;title="💀 Monster Kill Rankings";}
  else if(type==="arena"){sorted=[...all].sort((a,b)=>(b.arenaWins||0)-(a.arenaWins||0));valFn=p=>{const ti=arenaT(p.arenaWins||0);return`${TIER_EMOJIS[ti]} ${ARENA_TIERS[ti].name}`;};title="⚔️ Arena Rankings";}
  else if(type==="steps"){sorted=[...all].sort((a,b)=>(b.steps||0)-(a.steps||0));valFn=p=>`${fmt(p.steps||0)} steps`;title="👣 Step Rankings";}
  else if(type==="gold"){sorted=[...all].sort((a,b)=>((b.gold||0)+(b.bank||0))-((a.gold||0)+(a.bank||0)));valFn=p=>`🪙${fmt((p.gold||0)+(p.bank||0))}`;title="🪙 Wealth Rankings";}
  else{sorted=[...all].sort((a,b)=>(b.itemsFound||0)-(a.itemsFound||0));valFn=p=>`${p.itemsFound||0} items`;title="🎁 Items Found";}
  const top=sorted.slice(0,10);
  const body=document.getElementById("lb-body");if(!body)return;
  if(top.length===0){body.innerHTML=`<div class="card"><div style="text-align:center;color:var(--text3);font-style:italic;padding:1rem">No data yet!</div></div>`;return;}
  const rows=top.map((p,i)=>{
    const rc=i===0?"r1":i===1?"r2":i===2?"r3":"";
    const you=p.username===P.username?`<span class="lb-you">(you)</span>`:"";
    return`<div class="lb-row">
      <div class="lb-rank ${rc}">${i===0?"👑":i+1}</div>
      <div style="width:26px;height:26px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${avatarGfxFor(p,24)}</div>
      <div class="lb-name">${p.username} ${you}</div>
      <div class="lb-val">${valFn(p)}</div>
    </div>`;
  }).join("");
  body.innerHTML=`<div class="card"><div class="card-title">${title}</div>${rows}</div>`;
}

// ── PROFILE ───────────────────────────────────────────────────
function renderYou(){
  const{str:eStr,def:eDef}=equipStats(P.equipped);
  const tierIdx=arenaT(P.arenaWins||0);
  const tier=ARENA_TIERS[tierIdx];
  const maxE=calcMaxEnergy();
  document.getElementById("content").innerHTML=`
    <div class="profile-hero">
      <div class="profile-ava">${avatarGfx(80)}</div>
      <div class="profile-name">${P.username}</div>
      <div class="profile-level">Level ${P.level} · <span style="color:${tier.color}">${TIER_EMOJIS[tierIdx]} ${tier.name} League</span></div>
      <div class="profile-stats">
        <div class="ps-item"><div class="ps-val">${(P.baseStr||10)+eStr}</div><div class="ps-key">⚔️ STR</div></div>
        <div class="ps-item"><div class="ps-val">${(P.baseDef||5)+eDef}</div><div class="ps-key">🛡️ DEF</div></div>
        <div class="ps-item"><div class="ps-val">${P.maxHp}</div><div class="ps-key">❤️ Max HP</div></div>
        <div class="ps-item"><div class="ps-val">${maxE}</div><div class="ps-key">⚡ Max EP</div></div>
        <div class="ps-item"><div class="ps-val">${P.statPoints||0}</div><div class="ps-key">⬆️ Stat Pts</div></div>
        <div class="ps-item"><div class="ps-val">${fmt(P.steps||0)}</div><div class="ps-key">👣 Steps</div></div>
        <div class="ps-item"><div class="ps-val">${P.npcKills||0}</div><div class="ps-key">💀 Kills</div></div>
        <div class="ps-item"><div class="ps-val">${P.arenaWins||0}</div><div class="ps-key">🏆 Arena W</div></div>
        <div class="ps-item"><div class="ps-val">${fmt(P.gold||0)}</div><div class="ps-key">🪙 Gold</div></div>
        <div class="ps-item"><div class="ps-val">${(P.properties||[]).length}</div><div class="ps-key">🏠 Props</div></div>
        <div class="ps-item"><div class="ps-val">${(P.inventory||[]).length}</div><div class="ps-key">🎒 Items</div></div>
        <div class="ps-item"><div class="ps-val">${(P.avatars||[]).length}/${AVATARS.length}</div><div class="ps-key">🎭 Avatars</div></div>
      </div>
    </div>
    <button class="btn btn-purple" onclick="G.openAvatarCollection()" style="margin-bottom:0.7rem">🎭 My Avatar Collection</button>
    ${P.statPoints>0?`<button class="btn btn-gold" onclick="G.openStatModal()" style="margin-bottom:0.7rem">⬆️ Spend ${P.statPoints} Stat Point${P.statPoints>1?"s":""}</button>`:""}
    <div class="card">
      <div class="card-title">⚙️ Account</div>
      <button class="btn btn-ghost" onclick="G.handleSignOut()">Sign Out</button>
    </div>
    <button class="btn btn-ghost" onclick="G.showTab('home')" style="margin-top:0.5rem">← Back</button>`;
}

async function handleSignOut(){clearInterval(energyInterval);await signOut(auth);}

// ── WALK / STEP ───────────────────────────────────────────────
function takeStep(){
  if(!P||P.energy<1){toast("⚡ No energy! Wait for regen.");return;}
  if(combatState){toast("⚔️ Finish your current battle first!");return;}
  if(!CURRENT_AREA){
    // If no area selected, open walk interface
    showTab("walk"); toast("Select an area first!"); return;
  }

  P.energy--; P.steps=(P.steps||0)+1;
  if(P.energy<calcMaxEnergy()&&!P.lastEnergyTime)P.lastEnergyTime=Date.now();
  updateWalkBtn(); updateQuestProgress("steps");

  const area=CURRENT_AREA;
  const roll=Math.random();
  const totalItemChance=CFG.ITEM_CHANCE+(area.lootBonus||0);

  if(roll<CFG.MONSTER_CHANCE){
    const m=spawnMonster(area);
    addFeed(m.emoji,m.image,`Encountered <strong>${m.name}</strong> in ${area.name}!`,"Fight!","var(--crimson2)");
    saveP(); renderWalkAreaSelect(); setTimeout(()=>openCombatModal(m),350);
  } else if(roll<CFG.MONSTER_CHANCE+CFG.GOLD_CHANCE){
    const g=Math.round(rand(5,25+P.level*2)*area.goldMult);
    P.gold=(P.gold||0)+g;
    addFeed("🪙","",`Found gold in ${area.name}!`,`+${g} 🪙`,"var(--gold2)");
    saveP(); renderWalkAreaSelect();
  } else if(roll<CFG.MONSTER_CHANCE+CFG.GOLD_CHANCE+totalItemChance){
    const item=spawnItem();
    P.inventory=[...(P.inventory||[]),item];
    P.itemsFound=(P.itemsFound||0)+1;
    const q=qualityLabel(item.val,item.base||item.val);
    addFeed(item.emoji,item.image,`Found a <strong>${item.name}</strong>! <span style="color:${q.color}">${q.label}</span>`,item.rarity,RARITY_COLOR[item.rarity]);
    toast(`${item.emoji} Found ${item.name} (+${item.val}) — ${q.label}!`);
    updateQuestProgress("items"); tryAvatarDrop();
    saveP(); renderWalkAreaSelect();
  } else if(roll<CFG.MONSTER_CHANCE+CFG.GOLD_CHANCE+totalItemChance+CFG.CHOICE_EVENT_CHANCE){
    // Random choice event
    const evt=pick(CHOICE_EVENTS);
    saveP(); renderWalkAreaSelect();
    openChoiceEventModal(evt);
  } else {
    const w=pick(WALK_EVENTS);
    addFeed(w.emoji,"",w.text,"Nothing","var(--text3)");
    saveP(); renderWalkAreaSelect();
  }
}

// ── CHOICE EVENTS ─────────────────────────────────────────────
function openChoiceEventModal(evt){
  const choicesHtml=evt.choices.map((c,i)=>`
    <button class="btn btn-ghost" style="margin-bottom:0.4rem" onclick="G.resolveChoice('${evt.id}',${i})">${c.label}</button>`).join("");
  document.getElementById("modal-content").innerHTML=`
    <div style="text-align:center;font-size:3rem;margin-bottom:0.4rem">${evt.emoji}</div>
    <div class="modal-title">${evt.title}</div>
    <div style="text-align:center;color:var(--text3);font-size:0.88rem;margin-bottom:1.2rem">${evt.desc}</div>
    <div class="modal-actions">${choicesHtml}</div>`;
  document.getElementById("modal-overlay").style.display="flex";
}

function resolveChoice(evtId,choiceIdx){
  const evt=CHOICE_EVENTS.find(e=>e.id===evtId);
  if(!evt)return;
  const choice=evt.choices[choiceIdx];
  const result=choice.outcome(P);

  // Resolve functions
  const msg=typeof result.msg==="function"?result.msg():result.msg;
  const goldDelta=typeof result.gold==="function"?result.gold():result.gold||0;
  const hpDelta=typeof result.hp==="function"?result.hp():result.hp||0;

  if(goldDelta!==0){
    P.gold=Math.max(0,(P.gold||0)+goldDelta);
    if(goldDelta>0) toast(`🪙 +${goldDelta} gold!`);
    else toast(`🪙 Lost ${Math.abs(goldDelta)} gold!`);
  }
  if(hpDelta!==0){
    P.hp=clamp((P.hp||0)+hpDelta,1,P.maxHp);
    if(hpDelta>0) toast(`❤️ +${Math.abs(hpDelta)} HP!`);
    else toast(`💔 -${Math.abs(hpDelta)} HP!`);
  }

  saveP(); updateWalkBtn();
  addFeed(evt.emoji,"",msg,choice.label,"var(--text2)");

  document.getElementById("modal-content").innerHTML=`
    <div style="text-align:center;font-size:3rem;margin-bottom:0.4rem">${evt.emoji}</div>
    <div class="modal-title">${evt.title}</div>
    <div style="text-align:center;color:var(--text2);font-size:0.92rem;margin:1rem 0;line-height:1.5">${msg}</div>
    ${goldDelta!==0?`<div style="text-align:center;color:${goldDelta>0?"var(--gold2)":"var(--crimson2)"};font-family:'Cinzel',serif;margin-bottom:0.5rem">${goldDelta>0?"🪙 +"+goldDelta:"🪙 −"+Math.abs(goldDelta)}</div>`:""}
    ${hpDelta!==0?`<div style="text-align:center;color:${hpDelta>0?"var(--green2)":"var(--crimson2)"};font-family:'Cinzel',serif;margin-bottom:0.5rem">${hpDelta>0?"❤️ +"+Math.abs(hpDelta)+" HP":"💔 −"+Math.abs(hpDelta)+" HP"}</div>`:""}
    <button class="btn btn-ghost" onclick="G.closeModal()" style="margin-top:0.5rem">Continue</button>`;
}

function addFeed(emoji,image,text,badge,color){
  feed.unshift({emoji,image,text,badge,color});
  if(feed.length>25)feed.pop();
}

// ── SPAWN ─────────────────────────────────────────────────────
function spawnMonster(area){
  const bonusLevel=area?area.monsterLevelBonus:0;
  const effectiveLevel=P.level+bonusLevel;
  const eligible=MONSTERS.filter(m=>effectiveLevel>=(m.minLevel||0));
  const base=pick(eligible.length?eligible:MONSTERS);
  const areaExpMult=area?area.expMult:1;
  const areaGoldMult=area?area.goldMult:1;
  return{...base,
    str:rand(...base.str),def:rand(...base.def),
    hp:rand(...base.hp),maxHp:base.hp[1],
    expReward:Math.round(rand(...base.exp)*areaExpMult),
    goldReward:Math.round(rand(...base.gold)*areaGoldMult)};
}

function spawnItem(){
  const pool=[...ITEMS,...PETS];
  const total=pool.reduce((s,i)=>s+(i.dropRate||10),0);
  let r=Math.random()*total;
  for(const t of pool){r-=(t.dropRate||10);if(r<=0){const val=rollItemStat(t);return{...t,val,base:t.base,id:`item_${Date.now()}_${rand(0,9999)}`};}}
  const t=ITEMS[0];return{...t,val:rollItemStat(t),base:t.base,id:`item_${Date.now()}`};
}

// ── COMBAT ───────────────────────────────────────────────────
function openCombatModal(monster){
  const{str:eStr,def:eDef}=equipStats(P.equipped);
  combatState={monster,playerHp:P.hp,playerMaxHp:P.maxHp,monsterHp:monster.hp,
    pStr:(P.baseStr||10)+eStr,pDef:(P.baseDef||5)+eDef,log:[],done:false,paused:false};
  P.activeCombat=serializeCombat(combatState); saveP();
  renderCombatModal();
  document.getElementById("modal-overlay").style.display="flex";
  combatInterval=setInterval(combatTick,900);
}
function serializeCombat(cs){
  return{monster:cs.monster,playerHp:cs.playerHp,playerMaxHp:cs.playerMaxHp,
    monsterHp:cs.monsterHp,pStr:cs.pStr,pDef:cs.pDef,log:cs.log.slice(-20)};
}
function resumeCombat(){
  if(!P.activeCombat)return;
  combatState={...P.activeCombat,done:false,paused:false};
  renderCombatModal();
  document.getElementById("modal-overlay").style.display="flex";
  combatInterval=setInterval(combatTick,900);
}
function abandonCombat(){
  clearInterval(combatInterval);
  const penalty=rand(10,30);
  P.gold=Math.max(0,(P.gold||0)-penalty);
  P.hp=Math.max(1,Math.floor(P.maxHp*0.4));
  P.activeCombat=null; combatState=null;
  saveP(); updateWalkBtn(); closeModal();
  toast(`🏃 You fled! Lost ${penalty}🪙 and arrived injured.`);
}
function fleeCombat(){
  if(!combatState||combatState.done)return;
  clearInterval(combatInterval); combatState.done=true;
  const goldLost=rand(15,Math.min(80,Math.floor((P.gold||0)*0.1)+15));
  P.gold=Math.max(0,(P.gold||0)-goldLost);
  P.hp=combatState.playerHp; P.activeCombat=null;
  combatState.log.push(`<span class="log-sys">🏃 You fled! Lost ${goldLost}🪙</span>`);
  renderCombatModal(); saveP(); updateWalkBtn();
  toast(`🏃 Escaped! Dropped ${goldLost}🪙.`);
}
function healInCombat(){
  if(!combatState||combatState.done)return;
  const smallP=SHOP_CONSUMABLES.find(c=>c.id==="potion_small");
  const bigP=SHOP_CONSUMABLES.find(c=>c.id==="potion_big");
  const canAffordBig=(P.gold||0)>=bigP.price;
  const canAffordSmall=(P.gold||0)>=smallP.price;
  if(!canAffordSmall){toast("💰 Can't afford any potions!");return;}
  if(canAffordBig&&P.hp<P.maxHp*0.5){
    P.gold-=bigP.price;
    const heal=Math.floor(combatState.playerMaxHp*CFG.POTION_HEAL_BIG);
    combatState.playerHp=Math.min(combatState.playerMaxHp,combatState.playerHp+heal);
    P.hp=combatState.playerHp;
    combatState.log.push(`<span class="log-win">💊 Major Potion! +${heal} HP</span>`);
  } else if(canAffordSmall){
    P.gold-=smallP.price;
    const heal=Math.floor(combatState.playerMaxHp*CFG.POTION_HEAL_SMALL);
    combatState.playerHp=Math.min(combatState.playerMaxHp,combatState.playerHp+heal);
    P.hp=combatState.playerHp;
    combatState.log.push(`<span class="log-win">🧪 Minor Potion! +${heal} HP</span>`);
  }
  saveP(); renderCombatModal();
}
function renderCombatModal(){
  if(!combatState)return;
  const cs=combatState,m=cs.monster;
  const pPct=clamp((cs.playerHp/cs.playerMaxHp)*100,0,100);
  const mPct=clamp((cs.monsterHp/m.maxHp)*100,0,100);
  const smallPrice=SHOP_CONSUMABLES.find(c=>c.id==="potion_small")?.price||120;
  const canHeal=(P.gold||0)>=smallPrice;
  const hpLow=cs.playerHp<cs.playerMaxHp;
  document.getElementById("modal-content").innerHTML=`
    <div class="combat-scene">
      <div class="fighters">
        <div class="fighter">
          <div class="f-img">${avatarGfx(56)}</div>
          <div class="f-name">${P.username}</div>
          <div class="f-hp">${cs.playerHp}/${cs.playerMaxHp}</div>
          <div class="f-bar"><div class="f-bar-fill" style="width:${pPct}%"></div></div>
        </div>
        <div class="vs">VS</div>
        <div class="fighter">
          <div class="f-img">${gfx(m.image,m.emoji,56)}</div>
          <div class="f-name">${m.name}</div>
          <div class="f-hp">${cs.monsterHp}/${m.maxHp}</div>
          <div class="f-bar"><div class="f-bar-fill" style="width:${mPct}%"></div></div>
        </div>
      </div>
    </div>
    <div class="combat-log" id="combat-log">${cs.log.join("<br>")||`<span class="log-sys">${m.desc||"Battle commences..."}</span>`}</div>
    ${cs.done
      ?`<button class="btn btn-ghost" onclick="G.closeModal()">Close</button>`
      :`<div style="display:flex;gap:0.5rem;margin-top:0.1rem">
          ${hpLow&&canHeal
            ?`<button class="btn btn-green btn-sm" style="flex:1;padding:0.55rem" onclick="G.healInCombat()">🧪 Heal (🪙${smallPrice})</button>`
            :`<button class="btn btn-ghost btn-sm" style="flex:1;padding:0.55rem;opacity:0.4" disabled>🧪 Heal</button>`}
          <button class="btn btn-danger btn-sm" style="flex:1;padding:0.55rem" onclick="G.fleeCombat()">🏃 Flee</button>
        </div>
        <div style="text-align:center;color:var(--text3);font-size:0.75rem;margin-top:0.4rem;font-style:italic">⚔️ Auto-battling...</div>`}`;
  const log=document.getElementById("combat-log");
  if(log)log.scrollTop=log.scrollHeight;
}
function combatTick(){
  if(!combatState||combatState.done){clearInterval(combatInterval);return;}
  const cs=combatState,m=cs.monster;
  let pDmg=Math.max(1,cs.pStr-m.def+rand(-3,6));
  const pCrit=Math.random()<0.12;
  if(pCrit)pDmg=Math.floor(pDmg*1.75);
  cs.monsterHp=Math.max(0,cs.monsterHp-pDmg);
  cs.log.push(pCrit?`<span class="log-crit">⚡ CRIT! You smash ${m.name} for ${pDmg}!</span>`:`<span class="log-you">You hit ${m.name} for ${pDmg}</span>`);
  if(cs.monsterHp<=0){cs.done=true;clearInterval(combatInterval);cs.log.push(`<span class="log-win">🏆 ${m.name} defeated! +${m.expReward} EXP · +${m.goldReward}🪙</span>`);handleVictory(cs);renderCombatModal();return;}
  let mDmg=Math.max(1,m.str-cs.pDef+rand(-3,6));
  const mCrit=Math.random()<0.08;
  if(mCrit)mDmg=Math.floor(mDmg*1.75);
  cs.playerHp=Math.max(0,cs.playerHp-mDmg);
  cs.log.push(mCrit?`<span class="log-crit">💥 ${m.name} CRITS you for ${mDmg}!</span>`:`<span class="log-hit">${m.name} hits you for ${mDmg}</span>`);
  if(cs.playerHp<=0){cs.done=true;clearInterval(combatInterval);cs.log.push(`<span class="log-lose">💀 You were defeated by ${m.name}...</span>`);handleDefeat(cs);renderCombatModal();return;}
  renderCombatModal();
}
function handleVictory(cs){
  const m=cs.monster;
  const isArena=m.isArena||false;
  const tierIdx=isArena?(m.tierIdx||0):arenaT(P.arenaWins||0);
  const tier=ARENA_TIERS[tierIdx];
  const expGain=Math.round(m.expReward*(isArena?tier.expBonus:1));
  const goldGain=Math.round(m.goldReward*(isArena?tier.goldBonus:1));
  P.npcKills=(P.npcKills||0)+1;
  P.gold=(P.gold||0)+goldGain;
  P.exp=(P.exp||0)+expGain;
  P.hp=cs.playerHp;
  if(isArena)P.arenaWins=(P.arenaWins||0)+1;
  updateQuestProgress("kills"); checkLevelUp();
  toast(isArena?`🏆 Arena Victory! +${expGain} EXP · +${goldGain}🪙`:`⚔️ Victory! +${expGain} EXP · +${goldGain}🪙`);
  P.hp=clamp(P.hp,1,P.maxHp); combatState=null; P.activeCombat=null;
  saveP(); updateWalkBtn();
}
function handleDefeat(cs){
  if(cs.monster.isArena)P.arenaLosses=(P.arenaLosses||0)+1;
  P.hp=Math.max(1,Math.floor(P.maxHp*0.25));
  toast("💀 Defeated! Rest and recover. Buy potions in the shop!");
  combatState=null; P.activeCombat=null; saveP(); updateWalkBtn();
}
function checkLevelUp(){
  let leveled=false,levels=0;
  while(P.exp>=expLv(P.level)){
    P.exp-=expLv(P.level); P.level++; levels++;
    P.statPoints=(P.statPoints||0)+1; // Award 1 stat point per level
    const{def:eDef}=equipStats(P.equipped);
    P.maxHp=maxHpCalc(P.level,(P.baseDef||5)+eDef,P.bonusHp||0);
    leveled=true;
  }
  if(leveled){
    P.hp=P.maxHp;
    toast(`🎉 LEVEL UP! Now Level ${P.level}! +${levels} stat point${levels>1?"s":""}! Full HP!`);
    updateWalkBtn();
  }
}

// ── ITEM MODAL ────────────────────────────────────────────────
function openItemModal(source,idx){
  let item,isEquipped=false,slot=null;
  if(source==="equipped"){slot=idx;item=P.equipped[slot];isEquipped=true;}
  else item=(P.inventory||[])[idx];
  if(!item)return;
  const color=RARITY_COLOR[item.rarity]||"#9ca3af";
  const q=qualityLabel(item.val,item.base||item.val);
  const curEquipped=P.equipped[item.type];
  const compare=curEquipped&&!isEquipped
    ?`<div class="modal-row"><em>vs Equipped</em><span style="color:${item.val>curEquipped.val?"var(--green2)":"var(--crimson2)"}">
        ${item.val>curEquipped.val?"▲":"▼"}${Math.abs(item.val-curEquipped.val)} vs +${curEquipped.val}
      </span></div>`:"";
  const npcVal=Math.max(5,Math.floor((item.shopPrice||item.base*item.val*2||50)*CFG.SHOP_SELL_RATE));
  document.getElementById("modal-content").innerHTML=`
    <div class="modal-icon">${gfx(item.image,item.emoji,72)}</div>
    <div class="modal-title" style="color:${color}">${item.name}</div>
    <div class="modal-rarity" style="color:${color}">${item.rarity}<span style="margin-left:0.5rem;color:${q.color};font-size:0.65rem">${q.label}</span></div>
    <div class="modal-row"><em>Type</em><span>${item.type}</span></div>
    <div class="modal-row"><em>Stat</em><span style="color:${item.stat==="str"?"var(--crimson2)":"var(--steel2)"}">+${item.val} ${item.stat==="str"?"STR":"DEF"}</span></div>
    <div class="modal-row"><em>Base Roll</em><span style="color:var(--text3)">~${item.base||"?"}</span></div>
    <div class="modal-row"><em>NPC Value</em><span style="color:var(--text3)">🪙${npcVal}</span></div>
    ${compare}
    <div class="modal-actions">
      ${isEquipped?`<button class="btn btn-ghost" onclick="G.unequipItem('${slot}')">Unequip</button>`:`<button class="btn btn-gold" onclick="G.equipItem(${idx})">Equip</button>`}
      ${!isEquipped?`<button class="btn btn-purple" onclick="G.promptSell(${idx});G.closeModal()">List on Market</button>`:""}
      ${!isEquipped?`<button class="btn btn-ghost" onclick="G.sellToNpc(${idx});G.closeModal()">Sell to NPC (🪙${npcVal})</button>`:""}
      <button class="btn btn-danger" onclick="${isEquipped?`G.dropEquipped('${slot}')`:`G.dropInventory(${idx})`}">Drop Item</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Close</button>
    </div>`;
  document.getElementById("modal-overlay").style.display="flex";
}
function equipItem(idx){
  const item=(P.inventory||[])[idx];if(!item)return;
  const eq={...(P.equipped||{})},inv=[...(P.inventory||[])];
  if(eq[item.type])inv.push(eq[item.type]);
  inv.splice(inv.findIndex(i=>i.id===item.id),1);
  eq[item.type]=item;P.equipped=eq;P.inventory=inv;
  const{def:eDef}=equipStats(eq);
  P.maxHp=maxHpCalc(P.level,(P.baseDef||5)+eDef,P.bonusHp||0);
  P.hp=clamp(P.hp,1,P.maxHp);
  saveP();closeModal();toast(`✅ Equipped ${item.name}!`);renderGear();
}
function unequipItem(slot){
  const item=P.equipped[slot];if(!item)return;
  P.inventory=[...(P.inventory||[]),item];delete P.equipped[slot];
  const{def:eDef}=equipStats(P.equipped);
  P.maxHp=maxHpCalc(P.level,(P.baseDef||5)+eDef,P.bonusHp||0);
  P.hp=clamp(P.hp,1,P.maxHp);
  saveP();closeModal();toast(`📦 Unequipped ${item.name}`);renderGear();
}
function dropInventory(idx){
  const item=(P.inventory||[])[idx];if(!item)return;
  P.inventory=P.inventory.filter((_,i)=>i!==idx);
  saveP();closeModal();toast(`🗑️ Dropped ${item.name}`);renderGear();
}
function dropEquipped(slot){
  const item=P.equipped[slot];if(!item)return;
  delete P.equipped[slot];
  const{def:eDef}=equipStats(P.equipped);
  P.maxHp=maxHpCalc(P.level,(P.baseDef||5)+eDef,P.bonusHp||0);
  P.hp=clamp(P.hp,1,P.maxHp);
  saveP();closeModal();toast(`🗑️ Dropped ${item.name}`);renderGear();
}
function closeModal(){
  document.getElementById("modal-overlay").style.display="none";
  if(combatState&&combatState.done){combatState=null;P.activeCombat=null;saveP();}
  else if(combatState&&!combatState.done){
    clearInterval(combatInterval);combatInterval=null;
    P.activeCombat=serializeCombat(combatState);saveP();
    if(TAB==="home")renderHome();
  }
}

// ── TOAST ─────────────────────────────────────────────────────
function toast(msg){
  const el=document.createElement("div");
  el.className="toast";el.textContent=msg;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(()=>{el.classList.add("dying");setTimeout(()=>el.remove(),300);},2800);
}

// ── EXPOSE ────────────────────────────────────────────────────
window.G={
  switchAuthTab,handleEmailAuth,handleGoogleAuth,handleSetUsername,
  showTab,takeStep,closeModal,
  selectArea,
  openItemModal,equipItem,unequipItem,dropInventory,dropEquipped,
  promptSell,confirmSell,buyListing,cancelListing,buyShopItem,buyConsumable,
  sellToNpc,
  mTab,
  claimQuest,
  startArenaBattle,
  doDeposit,doWithdraw,
  handleSignOut,
  equipAvatar,openAvatarCollection,
  lbTab,
  fleeCombat,healInCombat,resumeCombat,abandonCombat,
  // Properties
  buyProperty,setHome,unsetHome,sellProperty,confirmSellProperty,claimRent,
  // Stat points
  openStatModal,spendStat,
  // Choice events
  resolveChoice,
};
