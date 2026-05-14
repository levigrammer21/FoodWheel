// ============================================================
//  MicroMMO — game.js
//  All game data and logic lives here.
//  Firebase, auth, rendering, combat, market, quests, arena.
// ============================================================

import{initializeApp}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import{getAuth,onAuthStateChanged,signInWithEmailAndPassword,
  createUserWithEmailAndPassword,signInWithPopup,GoogleAuthProvider,signOut
}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import{getFirestore,doc,getDoc,setDoc,deleteDoc,collection,
  getDocs,addDoc,query,where,orderBy,limit,serverTimestamp,Timestamp
}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ============================================================
//
//  ██████╗  █████╗ ████████╗ █████╗
//  ██╔══██╗██╔══██╗╚══██╔══╝██╔══██╗
//  ██║  ██║███████║   ██║   ███████║
//  ██║  ██║██╔══██║   ██║   ██╔══██║
//  ██████╔╝██║  ██║   ██║   ██║  ██║
//
//  Everything below the "ENGINE" comment is hands-off.
//  Add your content here — monsters, items, images, settings.
//
// ============================================================

// ── FIREBASE CONFIG ──────────────────────────────────────────
const FIREBASE_CONFIG={
  apiKey:"AIzaSyA4-X-N-wAFnmPwZcJ-SnWJKMI-mNa2kQs",
  authDomain:"micrommo-77c6e.firebaseapp.com",
  projectId:"micrommo-77c6e",
  storageBucket:"micrommo-77c6e.firebasestorage.app",
  messagingSenderId:"639233695341",
  appId:"1:639233695341:web:d0df1515a79c9df6afa964"
};

// ── IMAGES ───────────────────────────────────────────────────
// Set image:"img/yourfile.png" to use a real image.
// Leave image:"" to use the emoji fallback.
// To add images: create an /img folder in your GitHub repo,
// upload your files, then set the path here.

const PLAYER_AVATAR = { emoji:"🧙", image:"" };
const WALK_BUTTON   = { emoji:"⚔️", image:"" };

// ── AVATAR DROPS ─────────────────────────────────────────────
// Avatars are rare collectible GIFs that drop while exploring.
// Players collect them and can equip any they've found.
// They show in combat, leaderboard, profile, and header.
//
// HOW TO ADD AVATARS:
// 1. Upload your GIF to img/avatars/ in your GitHub repo
// 2. Copy a block below and fill in the details
// 3. Set image: "img/avatars/yourfile.gif"
// 4. Leave image:"" to use emoji as placeholder until you have art
//
// rarity: "rare" | "epic" | "legendary"
// dropRate: weight relative to others (higher = drops more)

const AVATARS = [
  // ── RARE ──────────────────────────────────────────────────
  {id:"av_wolf",      name:"Shadow Wolf",    emoji:"🐺", image:"", rarity:"rare",      dropRate:8,  desc:"Runs alone through the dark."},
  {id:"av_knight",    name:"Iron Knight",    emoji:"⚔️", image:"", rarity:"rare",      dropRate:8,  desc:"Steel and honour."},
  {id:"av_rogue",     name:"Night Rogue",    emoji:"🗡️", image:"", rarity:"rare",      dropRate:8,  desc:"Silent. Deadly. Gone."},
  {id:"av_ranger",    name:"Forest Ranger",  emoji:"🏹", image:"", rarity:"rare",      dropRate:7,  desc:"One with the wild."},
  {id:"av_mage",      name:"Storm Mage",     emoji:"🧙", image:"", rarity:"rare",      dropRate:7,  desc:"Commands lightning and thunder."},
  // ── EPIC ──────────────────────────────────────────────────
  {id:"av_dragon",    name:"Dragonborn",     emoji:"🐉", image:"", rarity:"epic",      dropRate:3,  desc:"Blessed by ancient fire."},
  {id:"av_lich",      name:"Lich Ascendant", emoji:"💀", image:"", rarity:"epic",      dropRate:3,  desc:"Death is just the beginning."},
  {id:"av_phoenix",   name:"Phoenix Risen",  emoji:"🔥", image:"", rarity:"epic",      dropRate:3,  desc:"Born from the ashes, again."},
  {id:"av_void",      name:"Void Walker",    emoji:"🌌", image:"", rarity:"epic",      dropRate:2,  desc:"Steps between worlds."},
  // ── LEGENDARY ─────────────────────────────────────────────
  {id:"av_celestial", name:"Celestial Lord", emoji:"✨", image:"", rarity:"legendary", dropRate:0.5,desc:"Touched by the gods themselves."},
  {id:"av_chaos",     name:"Chaos Herald",   emoji:"🌀", image:"", rarity:"legendary", dropRate:0.5,desc:"Order fears this one."},
  {id:"av_champion",  name:"Eternal Champion",emoji:"👑",image:"", rarity:"legendary", dropRate:0.4,desc:"The last one standing, always."},
  // ── ADD NEW AVATARS HERE ───────────────────────────────────
  // {id:"av_yourname", name:"Your Avatar", emoji:"🔥",
  //  image:"img/avatars/your_avatar.gif",
  //  rarity:"epic", dropRate:2, desc:"Your flavour text here."},
];

// ── GAME SETTINGS ────────────────────────────────────────────
const CFG = {
  MAX_ENERGY:       5,
  ENERGY_REGEN_MS:  3 * 60 * 1000,  // 3 min per energy point
  MONSTER_CHANCE:   0.38,            // 38% chance per step
  GOLD_CHANCE:      0.27,            // 27% chance per step
  ITEM_CHANCE:      0.15,            // 15% chance per step
  // remaining % = nothing happens
  MARKET_FEE:       0.05,            // 5% cut on player market sales
  ARENA_COST_GOLD:  200,             // gold to generate arena monster
  ARENA_COST_EP:    1,               // energy to fight in arena
  DAILY_QUEST_RESET_HOUR: 0,         // UTC hour quests reset (0 = midnight)
  POTION_HEAL_SMALL: 0.3,            // heals 30% of max HP
  POTION_HEAL_BIG:   0.7,            // heals 70% of max HP
  AVATAR_DROP_CHANCE:0.04,           // 4% chance per item drop to also roll an avatar
};

// ── ARENA TIERS ──────────────────────────────────────────────
// Each tier: name, color, winsNeeded (cumulative), rewards
const ARENA_TIERS = [
  {name:"Copper",    color:"#cd7f32", wins:0,   expBonus:1.0, goldBonus:1.0},
  {name:"Bronze",    color:"#c9943a", wins:10,  expBonus:1.1, goldBonus:1.1},
  {name:"Silver",    color:"#94a3b8", wins:25,  expBonus:1.25,goldBonus:1.2},
  {name:"Gold",      color:"#f59e0b", wins:50,  expBonus:1.4, goldBonus:1.35},
  {name:"Platinum",  color:"#60a5fa", wins:100, expBonus:1.6, goldBonus:1.5},
  {name:"Diamond",   color:"#c084fc", wins:200, expBonus:1.85,goldBonus:1.7},
  {name:"Champion",  color:"#fbbf24", wins:400, expBonus:2.2, goldBonus:2.0},
];

// ── MONSTERS ─────────────────────────────────────────────────
// name      — display name
// emoji     — fallback if no image
// image     — e.g. "img/monsters/goblin.png"  (or "" for emoji)
// desc      — flavour text shown in combat
// str       — [min, max] attack
// def       — [min, max] defence
// hp        — [min, max] hit points
// exp       — [min, max] EXP reward on kill
// gold      — [min, max] gold reward on kill
// minLevel  — minimum player level to encounter (0 = always)

const MONSTERS = [
  {name:"Goblin Scout",    emoji:"👺",image:"",desc:"A sneaky little menace with sharp teeth.",         str:[4,12], def:[2,7],  hp:[25,55],  exp:[15,40],  gold:[4,20],  minLevel:0},
  {name:"Forest Wolf",     emoji:"🐺",image:"",desc:"Runs in packs. Alone now. Very hungry.",           str:[9,18], def:[4,10], hp:[45,80],  exp:[35,70],  gold:[12,35], minLevel:0},
  {name:"Cave Bat",        emoji:"🦇",image:"",desc:"Dives from the dark. Hard to track.",              str:[6,14], def:[2,8],  hp:[20,45],  exp:[20,45],  gold:[5,18],  minLevel:0},
  {name:"Stone Golem",     emoji:"🗿",image:"",desc:"Ancient guardian. Slow but devastating.",          str:[7,15], def:[18,30],hp:[70,120], exp:[55,100], gold:[20,55], minLevel:3},
  {name:"Shadow Wraith",   emoji:"👻",image:"",desc:"A spirit that feeds on life force.",               str:[22,38],def:[6,15], hp:[60,110], exp:[75,130], gold:[28,65], minLevel:5},
  {name:"Venomfang Spider",emoji:"🕷️",image:"",desc:"Its bite carries a slow, rotting curse.",         str:[14,24],def:[8,16], hp:[50,90],  exp:[50,90],  gold:[18,45], minLevel:4},
  {name:"Troll Brute",     emoji:"👹",image:"",desc:"Regenerates. Hit it fast.",                        str:[20,35],def:[14,24],hp:[100,160],exp:[80,140], gold:[35,80], minLevel:6},
  {name:"Dragon Whelp",    emoji:"🐉",image:"",desc:"Young dragon. Not fully grown. Still lethal.",     str:[28,46],def:[13,25],hp:[110,185],exp:[110,185],gold:[45,110],minLevel:8},
  {name:"Skeleton Knight", emoji:"💀",image:"",desc:"Fought a hundred wars. Lost them all. Still here.",str:[18,32],def:[22,38],hp:[90,150], exp:[90,160], gold:[38,85], minLevel:6},
  {name:"Dark Sorcerer",   emoji:"🧙",image:"",desc:"Commands ancient spells. Fragile body, lethal mind.",str:[40,60],def:[5,12],hp:[80,130], exp:[120,200],gold:[60,130],minLevel:10},
  {name:"Banshee Queen",   emoji:"👸",image:"",desc:"Her scream alone can end you.",                    str:[35,55],def:[8,18], hp:[130,210],exp:[140,230],gold:[65,140],minLevel:11},
  {name:"Lich Lord",       emoji:"💀",image:"",desc:"Mastered death itself. Now he is it.",             str:[45,70],def:[18,32],hp:[180,300],exp:[180,320],gold:[90,190],minLevel:14},
  {name:"Elder Dragon",    emoji:"🐲",image:"",desc:"A living catastrophe. Legends warn against this.", str:[60,90],def:[25,45],hp:[300,500],exp:[300,500],gold:[150,300],minLevel:18},
  // ── ADD NEW MONSTERS HERE ─────────────────────────────────
  // Copy a line above, paste here, and edit the values.
  // {name:"Fire Demon", emoji:"🔥", image:"img/monsters/demon.png",
  //  desc:"Burns everything it touches.",
  //  str:[35,55], def:[12,22], hp:[140,220], exp:[140,220], gold:[60,130], minLevel:10},
];

// ── ITEMS ────────────────────────────────────────────────────
// name      — display name
// type      — must match a slot: Helmet Armour Weapon Shield Greaves Boots Amulet
// stat      — "str" (attack) or "def" (defence)
// base      — the average stat value this item rolls around
// variance  — how far from base rolls can go (bell curve ±)
//             common=3, uncommon=5, rare=8, epic=12, legendary=20
//             You can override per item.
// rarity    — common | uncommon | rare | epic | legendary
// emoji     — fallback if no image
// image     — e.g. "img/items/sword.png"  (or "" for emoji)
// dropRate  — how often it drops (higher = more common)
// shopPrice — gold cost in NPC shop (omit or 0 = not sold in shop)
// shopRarity— if in shop, can be "common" or "uncommon" only

const ITEMS = [
  // COMMON — base gear, available in shop
  {name:"Rusty Sword",       type:"Weapon",stat:"str",base:5,  rarity:"common",   emoji:"⚔️",image:"",dropRate:20,shopPrice:80},
  {name:"Wooden Club",       type:"Weapon",stat:"str",base:4,  rarity:"common",   emoji:"🪵",image:"",dropRate:20,shopPrice:60},
  {name:"Worn Shield",       type:"Shield",stat:"def",base:4,  rarity:"common",   emoji:"🛡️",image:"",dropRate:18,shopPrice:70},
  {name:"Leather Cap",       type:"Helmet",stat:"def",base:3,  rarity:"common",   emoji:"🪖",image:"",dropRate:18,shopPrice:55},
  {name:"Cloth Robe",        type:"Armour",stat:"def",base:4,  rarity:"common",   emoji:"👘",image:"",dropRate:16,shopPrice:65},
  {name:"Simple Boots",      type:"Boots", stat:"def",base:2,  rarity:"common",   emoji:"👟",image:"",dropRate:16,shopPrice:45},
  {name:"Copper Amulet",     type:"Amulet",stat:"def",base:2,  rarity:"common",   emoji:"📿",image:"",dropRate:14,shopPrice:50},
  // UNCOMMON — also in shop
  {name:"Iron Chestplate",   type:"Armour",stat:"def",base:12, rarity:"uncommon", emoji:"🦺",image:"",dropRate:12,shopPrice:350},
  {name:"Silver Blade",      type:"Weapon",stat:"str",base:20, rarity:"uncommon", image:"img/items/silver_blade.png",dropRate:12,shopPrice:400},
  {name:"Mithril Ring",      type:"Amulet",stat:"def",base:9,  rarity:"uncommon", emoji:"💍",image:"",dropRate:10,shopPrice:280},
  {name:"Knight's Shield",   type:"Shield",stat:"def",base:14, rarity:"uncommon", emoji:"🛡️",image:"",dropRate:10,shopPrice:320},
  {name:"Chain Greaves",     type:"Greaves",stat:"def",base:8, rarity:"uncommon", emoji:"🦵",image:"",dropRate:10,shopPrice:260},
  {name:"Ranger Boots",      type:"Boots", stat:"def",base:7,  rarity:"uncommon", emoji:"👢",image:"",dropRate:10,shopPrice:240},
  {name:"Iron Helm",         type:"Helmet",stat:"def",base:10, rarity:"uncommon", emoji:"⛑️",image:"",dropRate:10,shopPrice:300},
  // RARE — drop only
  {name:"Enchanted Greaves", type:"Greaves",stat:"def",base:18,rarity:"rare",     emoji:"🦵",image:"",dropRate:6},
  {name:"Dragonfang Blade",  type:"Weapon",stat:"str",base:38, rarity:"rare",     emoji:"🔱",image:"",dropRate:5},
  {name:"Stormshard Boots",  type:"Boots", stat:"def",base:18, rarity:"rare",     emoji:"👢",image:"",dropRate:6},
  {name:"Warden's Helm",     type:"Helmet",stat:"def",base:20, rarity:"rare",     emoji:"🪖",image:"",dropRate:5},
  {name:"Soulbind Shield",   type:"Shield",stat:"def",base:25, rarity:"rare",     emoji:"🛡️",image:"",dropRate:5},
  {name:"Stormweave Armour", type:"Armour",stat:"def",base:28, rarity:"rare",     emoji:"🧥",image:"",dropRate:5},
  {name:"Runic Amulet",      type:"Amulet",stat:"str",base:15, rarity:"rare",     emoji:"🔮",image:"",dropRate:5},
  // EPIC — drop only
  {name:"Phoenix Armour",    type:"Armour",stat:"def",base:42, rarity:"epic",     emoji:"✨",image:"",dropRate:2},
  {name:"Voidcaller Staff",  type:"Weapon",stat:"str",base:55, rarity:"epic",     emoji:"🪄",image:"",dropRate:2},
  {name:"Shadow Greaves",    type:"Greaves",stat:"def",base:35,rarity:"epic",     emoji:"🦵",image:"",dropRate:2},
  {name:"Void Amulet",       type:"Amulet",stat:"str",base:28, rarity:"epic",     emoji:"💜",image:"",dropRate:2},
  {name:"Dreadhelm",         type:"Helmet",stat:"def",base:38, rarity:"epic",     emoji:"😈",image:"",dropRate:2},
  // LEGENDARY — drop only
  {name:"Excalibur",         type:"Weapon",stat:"str",base:80, rarity:"legendary",emoji:"⚡",image:"",dropRate:0.3,variance:25},
  {name:"Crown of the Fallen",type:"Helmet",stat:"def",base:55,rarity:"legendary",emoji:"👑",image:"",dropRate:0.3,variance:25},
  {name:"Aegis of Eternity", type:"Shield",stat:"def",base:60, rarity:"legendary",emoji:"🌟",image:"",dropRate:0.3,variance:25},
  {name:"Dragonhide Armour", type:"Armour",stat:"def",base:65, rarity:"legendary",emoji:"🐉",image:"",dropRate:0.3,variance:25},
  // ── ADD NEW ITEMS HERE ────────────────────────────────────
  // Copy a line above, paste here, edit values.
  // {name:"Fire Amulet", type:"Amulet", stat:"str", base:22, rarity:"rare",
  //  emoji:"🔥", image:"img/items/fire_amulet.png", dropRate:5},
];

// ── PETS ─────────────────────────────────────────────────────
// Pets are equippable companions. They work exactly like gear
// but go in the Pet slot. They can give STR or DEF bonuses.
// Use GIFs for animated pets! e.g. image:"img/pets/cat.gif"
//
// Fields are the same as ITEMS but type must be "Pet".
// dropRate: how often they drop (recommend keeping low — pets are special!)

const PETS = [
  // UNCOMMON PETS
  {name:"Baby Slime",    type:"Pet",stat:"def",base:6,  rarity:"uncommon",emoji:"🟢",image:"",dropRate:8,  desc:"Wobbly but loyal."},
  {name:"Forest Sprite", type:"Pet",stat:"str",base:7,  rarity:"uncommon",emoji:"🧚",image:"",dropRate:7,  desc:"Zips around your shoulder."},
  {name:"Tamed Rat",     type:"Pet",stat:"def",base:5,  rarity:"uncommon",emoji:"🐀",image:"",dropRate:8,  desc:"Surprisingly useful."},
  // RARE PETS
  {name:"Shadow Cat",    type:"Pet",stat:"str",base:14, rarity:"rare",    emoji:"🐈",image:"",dropRate:4,  desc:"Vanishes in dim light."},
  {name:"Storm Hawk",    type:"Pet",stat:"str",base:16, rarity:"rare",    emoji:"🦅",image:"",dropRate:3,  desc:"Dives at your enemies."},
  {name:"Crystal Turtle",type:"Pet",stat:"def",base:18, rarity:"rare",    emoji:"🐢",image:"",dropRate:3,  desc:"A walking shield."},
  {name:"Baby Dragon",   type:"Pet",stat:"str",base:20, rarity:"rare",    emoji:"🐉",image:"",dropRate:2,  desc:"Breathes tiny flames."},
  // EPIC PETS
  {name:"Void Familiar", type:"Pet",stat:"str",base:30, rarity:"epic",    emoji:"👁️",image:"",dropRate:1,  desc:"Sees through walls. And lies."},
  {name:"Lava Pup",      type:"Pet",stat:"str",base:28, rarity:"epic",    emoji:"🔥",image:"",dropRate:1,  desc:"Always warm. Always angry."},
  {name:"Frost Wolf",    type:"Pet",stat:"def",base:32, rarity:"epic",    emoji:"🐺",image:"",dropRate:1,  desc:"Howls before every battle."},
  // LEGENDARY PETS
  {name:"Ancient Phoenix",type:"Pet",stat:"str",base:50,rarity:"legendary",emoji:"🦅",image:"",dropRate:0.2,desc:"Reborn every battle."},
  {name:"Celestial Crab", type:"Pet",stat:"def",base:55,rarity:"legendary",emoji:"🦀",image:"",dropRate:0.2,desc:"Claws from another dimension."},
  // ── ADD NEW PETS HERE ─────────────────────────────────────
  // {name:"My Pet", type:"Pet", stat:"str", base:25, rarity:"rare",
  //  emoji:"🦊", image:"img/pets/fox.gif", dropRate:2, desc:"A cool pet."},
];

// ── NPC SHOP: CONSUMABLES ────────────────────────────────────
// These are always available to buy in the shop tab.
// You can add new ones here.
const SHOP_CONSUMABLES = [
  {id:"potion_small",  name:"Minor Healing Potion", emoji:"🧪", desc:"Restores 30% of your max HP",    price:120, effect:"heal_small"},
  {id:"potion_big",    name:"Major Healing Potion", emoji:"💊", desc:"Restores 70% of your max HP",    price:350, effect:"heal_big"},
  {id:"energy_refill", name:"Energy Crystal",       emoji:"⚡", desc:"Instantly refills all energy",   price:200, effect:"energy_full"},
  {id:"exp_scroll",    name:"Tome of Knowledge",    emoji:"📜", desc:"Grants 200 EXP instantly",       price:500, effect:"exp_200"},
  // ADD NEW CONSUMABLES HERE:
  // {id:"luck_charm", name:"Luck Charm", emoji:"🍀", desc:"Next step always finds an item", price:400, effect:"next_item"},
];

// ── WALK FLAVOR TEXT ─────────────────────────────────────────
// These appear in the feed when a step finds nothing special.
// Each entry: { emoji, text }
// Add as many as you want — one is picked randomly each time.
// Keep them short — they show in a single feed row.

const WALK_EVENTS = [
  // Nature / environment
  {emoji:"🌿", text:"You walk through the quiet forest."},
  {emoji:"🍃", text:"Leaves rustle overhead. Nothing stirs."},
  {emoji:"🌧️", text:"A light rain begins to fall."},
  {emoji:"☀️", text:"The sun breaks through the canopy."},
  {emoji:"🌫️", text:"Fog rolls in from the valley below."},
  {emoji:"🍂", text:"Autumn leaves crunch under your boots."},
  {emoji:"❄️", text:"Your breath mists in the cold air."},
  {emoji:"🌊", text:"You hear distant waves. No coast in sight."},
  {emoji:"⛅", text:"Clouds drift lazily overhead."},
  {emoji:"🌙", text:"The moon watches from between the trees."},
  {emoji:"🌄", text:"The horizon glows with fading light."},
  {emoji:"🌸", text:"Cherry blossoms drift across the path."},
  {emoji:"🍄", text:"Strange mushrooms line the trail. You leave them alone."},
  {emoji:"🪨", text:"Ancient stones mark the old road."},
  {emoji:"🌺", text:"A strange flower blooms out of season."},
  {emoji:"🦋", text:"A butterfly lands on your shoulder, then vanishes."},
  {emoji:"🐦", text:"A bird sings from somewhere unseen."},
  {emoji:"🦎", text:"A lizard watches you from a warm rock."},
  {emoji:"🐌", text:"A snail crosses the path. You wait. Respect."},
  {emoji:"🦔", text:"A hedgehog trundles past without acknowledging you."},
  {emoji:"🌾", text:"Tall grass sways on either side of the path."},
  {emoji:"🏔️", text:"Mountains loom in the distance."},
  {emoji:"🌵", text:"A lone cactus stands defiantly in your path."},
  {emoji:"🕸️", text:"An elaborate spiderweb catches the morning dew."},

  // Eerie / mysterious
  {emoji:"👁️", text:"You feel like something is watching. Nothing there."},
  {emoji:"🪦", text:"An unmarked grave sits beside the road. Fresh flowers on it."},
  {emoji:"🔮", text:"You find a glass bead on the ground. Warm to the touch."},
  {emoji:"🗝️", text:"A rusted key lies in the dirt. No lock in sight."},
  {emoji:"📜", text:"Tattered parchment blows past. The writing fades as you read."},
  {emoji:"🕯️", text:"A lit candle sits on a stump. Who left it here?"},
  {emoji:"🔔", text:"A distant bell rings once. Then silence."},
  {emoji:"🌀", text:"The air shimmers for a moment. Magic residue, maybe."},
  {emoji:"💀", text:"Bones of something large litter the clearing. Old."},
  {emoji:"🪤", text:"You spot a trap in the path. You step around it."},
  {emoji:"🗿", text:"A face carved in stone stares from the undergrowth."},
  {emoji:"🧿", text:"Someone left an amulet hanging from a branch."},
  {emoji:"🌑", text:"A shadow moves against the wind. Gone when you look."},
  {emoji:"🦉", text:"An owl watches you in broad daylight. Unusual."},

  // Humorous / casual
  {emoji:"💨", text:"A tumbleweed rolls by. Where did that even come from?"},
  {emoji:"🥾", text:"Your boots are getting muddy. Worth it."},
  {emoji:"😤", text:"You trip on a root. No one saw that. Probably."},
  {emoji:"🎵", text:"You catch yourself humming. Not sure what song."},
  {emoji:"🤔", text:"You ponder the mysteries of the realm. Nothing conclusive."},
  {emoji:"😴", text:"A monster naps under a tree. You tiptoe past."},
  {emoji:"🧱", text:"A wall. Just a wall. In the middle of nowhere."},
  {emoji:"🎲", text:"You find a loaded die on the ground. Keep it? You keep it."},
  {emoji:"📦", text:"An empty chest sits open by the path. Already looted."},
  {emoji:"🪑", text:"Someone left a chair out here. Comfy-looking. You don't sit."},
  {emoji:"🏳️", text:"A white flag waves from a tree. Whoever was here, they lost."},
  {emoji:"🍖", text:"A half-eaten leg of something sits on a rock. Still warm."},
  {emoji:"🧦", text:"One boot. Just the one. No explanation."},
  {emoji:"💬", text:"You talk to yourself. No one talks back. Normal."},
  {emoji:"🎯", text:"An arrow is embedded in a tree. It missed. Badly."},

  // World-building / lore
  {emoji:"⚔️", text:"Scorch marks scar the earth. A battle happened here."},
  {emoji:"🏰", text:"Ruins of something old crumble in the distance."},
  {emoji:"🚩", text:"A faded banner from a forgotten kingdom hangs from a branch."},
  {emoji:"🛖", text:"An abandoned camp. The fire went cold days ago."},
  {emoji:"📿", text:"Prayer beads hang from a low branch. Left as an offering."},
  {emoji:"🪙", text:"A coin from a realm you don't recognize. No value here."},
  {emoji:"🌉", text:"You cross an old bridge. The river below runs black."},
  {emoji:"⛺", text:"Traveller tracks in the mud. They went the other way."},
  {emoji:"🧭", text:"Your compass spins once, then settles. Odd."},
  {emoji:"📯", text:"A distant horn sounds. Far away. Maybe a warning."},
  {emoji:"🗺️", text:"A torn map flutters past. It's not of anywhere you know."},
  {emoji:"🔥", text:"Smoke rises somewhere to the east. Not your problem. Probably."},
  {emoji:"🪬", text:"Ritual markings on the rocks. Recent."},

  // ── ADD YOUR OWN WALK EVENTS HERE ─────────────────────────
  // {emoji:"🦊", text:"A fox crosses your path and gives you a look."},
  // {emoji:"🌈", text:"A rainbow appears. It points nowhere useful."},
];

// ============================================================
//  ENGINE — no need to edit below this line
// ============================================================

const EQUIP_SLOTS  = ["Helmet","Armour","Weapon","Shield","Greaves","Boots","Amulet","Pet"];
const SLOT_EMOJI   = {Helmet:"🪖",Armour:"🦺",Weapon:"⚔️",Shield:"🛡️",Greaves:"🦵",Boots:"👢",Amulet:"💍",Pet:"🐾"};
const RARITY_COLOR = {common:"#9ca3af",uncommon:"#34d399",rare:"#60a5fa",epic:"#c084fc",legendary:"#fbbf24"};
const RARITY_VAR   = {common:3,uncommon:5,rare:8,epic:12,legendary:20};
const TIER_EMOJIS  = ["🪙","🥉","🥈","🥇","💠","💎","👑"];

// Firebase
const fbApp = initializeApp(FIREBASE_CONFIG);
const auth  = getAuth(fbApp);
const db    = getFirestore(fbApp);
const gp    = new GoogleAuthProvider();

// State
let CU=null, P=null, TAB="home";
let feed=[], combatState=null, combatInterval=null, energyInterval=null;

// ── MATH HELPERS ─────────────────────────────────────────────
const rand   = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
const pick   = a => a[Math.floor(Math.random()*a.length)];
const clamp  = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const fmt    = n => n>=1e6?(n/1e6).toFixed(1)+"M":n>=1000?(n/1000).toFixed(1)+"K":String(Math.floor(n||0));
const expLv  = lv => Math.floor(100*Math.pow(1.5,lv-1));
const maxHpCalc = (lv,def) => 100+lv*10+def*2;

// Bell-curve roll: sum of multiple random numbers approximates normal distribution
function bellRoll(base, variance){
  // Sum 6 uniform randoms, centre, scale — gives ≈normal around 0
  let r=0; for(let i=0;i<6;i++) r+=Math.random();
  r = (r-3)/3; // now in roughly -1..1 with bell shape
  return Math.max(1, Math.round(base + r*variance));
}

// Roll item stat with bell curve
function rollItemStat(itemTemplate){
  const v = itemTemplate.variance ?? RARITY_VAR[itemTemplate.rarity] ?? 3;
  return bellRoll(itemTemplate.base, v);
}

// Quality label based on how far above base
function qualityLabel(val, base){
  const diff = val - base;
  if(diff >= base*0.5)  return {label:"Perfect",color:"#fbbf24"};
  if(diff >= base*0.25) return {label:"Great",  color:"#c084fc"};
  if(diff >= base*0.05) return {label:"Good",   color:"#60a5fa"};
  if(diff >= -base*0.1) return {label:"Normal", color:"#9ca3af"};
  if(diff >= -base*0.25)return {label:"Poor",   color:"#6b7280"};
  return                       {label:"Worn",   color:"#4b5563"};
}

function equipStats(eq){
  let str=0,def=0;
  Object.values(eq||{}).forEach(it=>{if(!it)return;if(it.stat==="str")str+=it.val;else def+=it.val;});
  return{str,def};
}

function gfx(image,emoji,size=32){
  if(image) return `<img src="${image}" alt="${emoji}" style="width:${size}px;height:${size}px;object-fit:contain" onerror="this.replaceWith(document.createTextNode('${emoji}'))">`;
  return emoji;
}

// ── AVATAR HELPERS ────────────────────────────────────────────
function getActiveAvatar(){
  const id=P.activeAvatar;
  if(!id)return null;
  return AVATARS.find(a=>a.id===id)||null;
}

function avatarGfx(size=32){
  const av=getActiveAvatar();
  if(av&&av.image) return `<img src="${av.image}" alt="${av.emoji}" style="width:${size}px;height:${size}px;object-fit:contain;border-radius:4px">`;
  if(av) return av.emoji;
  if(PLAYER_AVATAR.image) return `<img src="${PLAYER_AVATAR.image}" alt="${PLAYER_AVATAR.emoji}" style="width:${size}px;height:${size}px;object-fit:contain">`;
  return PLAYER_AVATAR.emoji;
}

function avatarGfxFor(plyr,size=24){
  const id=plyr.activeAvatar;
  const av=id?AVATARS.find(a=>a.id===id):null;
  if(av&&av.image) return `<img src="${av.image}" alt="${av.emoji}" style="width:${size}px;height:${size}px;object-fit:contain;border-radius:3px">`;
  if(av) return `<span style="font-size:${Math.round(size*0.7)}px">${av.emoji}</span>`;
  if(PLAYER_AVATAR.image) return `<img src="${PLAYER_AVATAR.image}" alt="${PLAYER_AVATAR.emoji}" style="width:${size}px;height:${size}px;object-fit:contain">`;
  return `<span style="font-size:${Math.round(size*0.7)}px">${PLAYER_AVATAR.emoji}</span>`;
}

function rollAvatar(){
  const total=AVATARS.reduce((s,a)=>s+(a.dropRate||1),0);
  let r=Math.random()*total;
  for(const av of AVATARS){ r-=(av.dropRate||1); if(r<=0)return av; }
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
    saveP();
    return;
  }
  P.avatars=[...collected,av.id];
  saveP();
  openAvatarDropModal(av);
}

function openAvatarDropModal(av){
  const color=RARITY_COLOR[av.rarity]||"#9ca3af";
  const imgHtml=av.image
    ?`<img src="${av.image}" alt="${av.emoji}" style="width:80px;height:80px;object-fit:contain;border-radius:8px">`
    :`<span style="font-size:3.5rem">${av.emoji}</span>`;
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
  if(TAB==="you") renderYou();
}

function openAvatarCollection(){
  const collected=P.avatars||[];
  if(collected.length===0){
    document.getElementById("modal-content").innerHTML=`
      <div class="modal-title">🎭 Avatars</div>
      <div style="text-align:center;color:var(--text3);padding:1.5rem;font-style:italic">
        No avatars collected yet!<br><br>They drop rarely while exploring.<br>
        <span style="font-size:0.75rem">Chance: ${Math.round(CFG.AVATAR_DROP_CHANCE*100)}% per item found</span>
      </div>
      <button class="btn btn-ghost" onclick="G.closeModal()">Close</button>`;
    document.getElementById("modal-overlay").style.display="flex";
    return;
  }
  const rows=AVATARS.filter(a=>collected.includes(a.id)).map(av=>{
    const color=RARITY_COLOR[av.rarity];
    const isActive=P.activeAvatar===av.id;
    const imgHtml=av.image
      ?`<img src="${av.image}" alt="${av.emoji}" style="width:44px;height:44px;object-fit:contain;border-radius:6px">`
      :`<span style="font-size:2rem">${av.emoji}</span>`;
    return`<div style="display:flex;align-items:center;gap:0.75rem;padding:0.65rem 0;border-bottom:1px solid var(--border)">
      <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${imgHtml}</div>
      <div style="flex:1;min-width:0">
        <div style="font-family:'Cinzel',serif;font-size:0.82rem;color:${color}">${av.name}</div>
        <div style="font-size:0.68rem;color:var(--text3);margin-top:0.1rem">${av.rarity} · "${av.desc}"</div>
      </div>
      ${isActive
        ?`<span style="font-size:0.7rem;color:var(--green2);font-family:'Cinzel',serif;flex-shrink:0">Active ✓</span>`
        :`<button class="btn btn-gold btn-sm" onclick="G.equipAvatar('${av.id}')">Equip</button>`}
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
  for(let i=ARENA_TIERS.length-1;i>=0;i--){ if((wins||0)>=ARENA_TIERS[i].wins){t=i;break;} }
  return t;
}

// ── DAILY QUESTS ─────────────────────────────────────────────
function buildDailyQuests(seed){
  // Deterministic from date seed so all players get same quests
  const s = (n) => { let x=Math.sin(seed+n)*10000; return x-Math.floor(x); };
  return [
    {id:"q_kill",  icon:"⚔️", name:"Monster Hunter",
     desc:`Kill ${Math.floor(s(1)*8)+3} monsters`,
     target:Math.floor(s(1)*8)+3, type:"kills", progress:0, reward:{exp:150,gold:100}},
    {id:"q_steps", icon:"👣", name:"World Walker",
     desc:`Take ${Math.floor(s(2)*20)+10} steps`,
     target:Math.floor(s(2)*20)+10, type:"steps", progress:0, reward:{exp:100,gold:80}},
    {id:"q_items", icon:"🎁", name:"Fortune Seeker",
     desc:`Find ${Math.floor(s(3)*4)+2} items`,
     target:Math.floor(s(3)*4)+2, type:"items", progress:0, reward:{exp:120,gold:90}},
  ];
}

function questSeed(){
  const d=new Date();
  return d.getUTCFullYear()*10000+d.getUTCMonth()*100+d.getUTCDate();
}

function getQuests(){
  const seed=questSeed();
  if(!P.quests || P.quests.seed!==seed){
    P.quests={seed, list:buildDailyQuests(seed)};
  }
  return P.quests.list;
}

function updateQuestProgress(type, amount=1){
  if(!P.quests) return;
  let changed=false;
  P.quests.list.forEach(q=>{
    if(q.type===type && q.progress<q.target){
      q.progress=Math.min(q.target,q.progress+amount);
      if(q.progress>=q.target && !q.claimed){
        toast(`📜 Quest complete: ${q.name}! Claim your reward!`);
      }
      changed=true;
    }
  });
  if(changed) saveP();
}

// ── PLAYER INIT ───────────────────────────────────────────────
function newPlayer(username){
  return{username,level:1,exp:0,gold:200,bank:0,diamonds:10,
    hp:110,maxHp:110,baseStr:10,baseDef:5,
    energy:CFG.MAX_ENERGY,lastEnergyTime:Date.now(),
    steps:0,npcKills:0,pvpKills:0,arenaWins:0,arenaLosses:0,
    inventory:[],equipped:{},quests:null,
    createdAt:Date.now()};
}

// ── FIREBASE HELPERS ─────────────────────────────────────────
async function loadP(uid){ const s=await getDoc(doc(db,"players",uid)); return s.exists()?s.data():null; }
async function saveP(){ if(!CU||!P)return; await setDoc(doc(db,"players",CU.uid),P); }
async function loadLeaderboard(){ const s=await getDocs(collection(db,"players")); return s.docs.map(d=>d.data()).filter(p=>p&&p.username); }

// Market helpers
async function getListings(){
  const s=await getDocs(collection(db,"market"));
  return s.docs.map(d=>({id:d.id,...d.data()}));
}
async function addListing(item,price){
  await addDoc(collection(db,"market"),{
    sellerId:CU.uid, sellerName:P.username,
    item, price, listedAt:Date.now()
  });
}
async function removeListing(id){ await deleteDoc(doc(db,"market",id)); }

// ── AUTH ─────────────────────────────────────────────────────
onAuthStateChanged(auth,async u=>{
  CU=u;
  if(u){ P=await loadP(u.uid); P?startGame():showScreen("username-screen"); }
  else showScreen("auth-screen");
});

function showErr(m){ const e=document.getElementById("auth-error"); e.textContent=m; e.style.display="block"; }
function hideErr(){ document.getElementById("auth-error").style.display="none"; }

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
    if(isLogin){ await signInWithEmailAndPassword(auth,email,pw); }
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
    if(!ex) showScreen("username-screen");
    else{ P=ex; startGame(); }
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

// ── GAME START ───────────────────────────────────────────────
function startGame(){
  showScreen("game-screen");
  updateWalkBtn();
  regenCheck();
  energyInterval=setInterval(regenCheck,15000);
  // Restore any fight that was active when app was closed
  if(P.activeCombat && !combatState){
    combatState={...P.activeCombat, done:false};
  }
  showTab("home");
}

function regenCheck(){
  if(!P||P.energy>=CFG.MAX_ENERGY)return;
  const pts=Math.floor((Date.now()-(P.lastEnergyTime||Date.now()))/CFG.ENERGY_REGEN_MS);
  if(pts>0){
    P.energy=clamp(P.energy+pts,0,CFG.MAX_ENERGY);
    P.lastEnergyTime=Date.now();
    saveP();
    if(TAB==="home")renderHome();
    updateWalkBtn();
  }
}

function updateWalkBtn(){
  const btn=document.getElementById("nav-walk"); if(!btn)return;
  btn.classList.toggle("no-energy",!P||P.energy<1);
  btn.innerHTML=WALK_BUTTON.image?`<img src="${WALK_BUTTON.image}" alt="⚔️">`:WALK_BUTTON.emoji;
  const ha=document.getElementById("hdr-avatar-el");
  if(ha) ha.innerHTML=avatarGfx(30);
  const hh=document.getElementById("hdr-hp");
  if(hh) hh.textContent=`❤️ ${P?P.hp:0}`;
  const hl=document.getElementById("hdr-level");
  if(hl) hl.textContent=`Lv.${P?P.level:1}`;
}

function showTab(tab){
  TAB=tab;
  ["home","gear","market","social"].forEach(t=>{
    const b=document.getElementById("nav-"+t);
    if(b)b.classList.remove("active");
  });
  const a=document.getElementById("nav-"+tab);
  if(a)a.classList.add("active");
  if(tab==="home")    renderHome();
  else if(tab==="gear")    renderGear();
  else if(tab==="market")  renderMarket();
  else if(tab==="social")  renderSocial();
  else if(tab==="you")     renderYou();
  else if(tab==="quests")  renderQuests();
  else if(tab==="arena")   renderArena();
  else if(tab==="bank")    renderBank();
}

// ── HOME ─────────────────────────────────────────────────────
function renderHome(){
  if(!P)return;
  const{str:eStr,def:eDef}=equipStats(P.equipped);
  const tStr=(P.baseStr||10)+eStr, tDef=(P.baseDef||5)+eDef;
  const expNeed=expLv(P.level);
  const hpPct=clamp(Math.round((P.hp/P.maxHp)*100),0,100);
  const expPct=clamp(Math.round((P.exp/expNeed)*100),0,100);
  const enPct=Math.round((P.energy/CFG.MAX_ENERGY)*100);
  const elapsed=Date.now()-(P.lastEnergyTime||Date.now());
  const tl=Math.max(0,CFG.ENERGY_REGEN_MS-(elapsed%CFG.ENERGY_REGEN_MS));
  const timerStr=P.energy>=CFG.MAX_ENERGY?"Full":`${Math.floor(tl/60000)}:${String(Math.floor((tl%60000)/1000)).padStart(2,"0")}`;

  // Quest summary
  const qs=getQuests();
  const qDone=qs.filter(q=>q.progress>=q.target).length;

  // Arena tier
  const tierIdx=arenaT(P.arenaWins||0);
  const tier=ARENA_TIERS[tierIdx];

  updateWalkBtn();

  document.getElementById("content").innerHTML=`
    <div class="player-banner">
      <div class="p-avatar">${avatarGfx(58)}</div>
      <div class="p-info">
        <div class="p-name">${P.username}</div>
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

    <div class="card">
      <div class="card-title">⚡ Energy</div>
      <div class="bar-wrap">
        <div class="bar-labels"><span>${P.energy}/${CFG.MAX_ENERGY} EP</span><span>${timerStr} to next</span></div>
        <div class="bar bar-energy"><div class="bar-fill" style="width:${enPct}%"></div></div>
      </div>
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
        <div class="stat-badge"><em>💀 Kills</em><strong>${P.npcKills||0}</strong></div>
        <div class="stat-badge"><em>👣 Steps</em><strong>${fmt(P.steps||0)}</strong></div>
      </div>
    </div>

    ${(combatState&&!combatState.done)||P.activeCombat ? `
    <div style="background:rgba(176,48,48,0.15);border:1px solid var(--crimson);border-radius:12px;
      padding:0.85rem;margin-bottom:0.7rem;display:flex;align-items:center;gap:0.75rem">
      <div style="font-size:1.5rem">⚔️</div>
      <div style="flex:1">
        <div style="font-family:'Cinzel',serif;font-size:0.82rem;color:var(--crimson2)">Battle in Progress!</div>
        <div style="font-size:0.75rem;color:var(--text3);margin-top:0.15rem">
          vs ${(combatState?.monster||P.activeCombat?.monster)?.name||"Unknown"}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:0.3rem">
        <button class="btn btn-danger btn-sm" onclick="G.resumeCombat()">Resume</button>
        <button class="btn btn-ghost btn-sm" style="font-size:0.62rem" onclick="G.abandonCombat()">Abandon</button>
      </div>
    </div>` : ""}

    <div class="two-col" style="margin-bottom:0.7rem">
      <button class="btn btn-steel btn-sm" style="width:100%;padding:0.7rem" onclick="G.showTab('quests')">
        📜 Daily Quests <span style="color:${qDone===3?"var(--green2)":"var(--gold2)"}">${qDone}/3</span>
      </button>
      <button class="btn btn-purple btn-sm" style="width:100%;padding:0.7rem" onclick="G.showTab('arena')">
        ⚔️ Battle Arena
      </button>
    </div>
  `;
}

// ── WALK ─────────────────────────────────────────────────────
function renderWalk(){
  const enPct=Math.round((P.energy/CFG.MAX_ENERGY)*100);
  const feedHtml=feed.length===0
    ?`<div class="feed-empty">Tap the ⚔️ button below to begin your adventure...</div>`
    :feed.map(f=>`<div class="feed-item">
        <div class="feed-icon">${f.image?`<img src="${f.image}" alt="${f.emoji}">`:(f.emoji||"🌿")}</div>
        <div class="feed-text">${f.text}</div>
        <div class="feed-badge" style="color:${f.color}">${f.badge}</div>
      </div>`).join("");

  // This tab is opened via walk button but we reuse the content area
  document.getElementById("content").innerHTML=`
    <div class="card">
      <div class="card-title">⚡ Energy ${P.energy}/${CFG.MAX_ENERGY}</div>
      <div class="bar bar-energy"><div class="bar-fill" style="width:${enPct}%"></div></div>
      <div style="font-size:0.78rem;color:var(--text3);margin-top:0.4rem">Each step costs 1 energy · Regen: 1 per 3 min</div>
    </div>
    ${feedHtml}`;
}

// ── GEAR ─────────────────────────────────────────────────────
function renderGear(){
  const inv=P.inventory||[], eq=P.equipped||{};
  const slotsHtml=EQUIP_SLOTS.map(slot=>{
    const item=eq[slot];
    const iconHtml=item?gfx(item.image,item.emoji,26):SLOT_EMOJI[slot];
    return`<div class="equip-slot ${item?"filled":""}" ${item?`onclick="G.openItemModal('equipped','${slot}')"`:"" }>
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

// ── QUESTS ───────────────────────────────────────────────────
function renderQuests(){
  const qs=getQuests();
  const now=new Date();
  const msUntilReset=(24-(now.getUTCHours()))*3600000-now.getUTCMinutes()*60000;
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
        ${done&&!q.claimed
          ?`<button class="btn btn-green btn-sm" onclick="G.claimQuest('${q.id}')">Claim</button>`
          :done?`<span style="color:var(--text3);font-size:0.72rem">Claimed</span>`:""}
      </div>
      <div class="bar bar-quest" style="height:5px">
        <div class="bar-fill" style="width:${pct}%"></div>
      </div>
      <div style="font-size:0.7rem;color:var(--text3);margin-top:0.2rem">${q.progress}/${q.target}</div>
    </div>`;
  }).join("");

  document.getElementById("content").innerHTML=`
    <div class="card">
      <div class="card-title">📜 Daily Quests</div>
      <div style="font-size:0.78rem;color:var(--text3);margin-bottom:0.75rem">
        Resets in ${hReset}h ${mReset}m
      </div>
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
  checkLevelUp();
  saveP();
  toast(`🎁 Claimed! +${q.reward.exp} EXP · +${q.reward.gold}🪙`);
  renderQuests();
}

// ── ARENA ─────────────────────────────────────────────────────
function renderArena(){
  const tierIdx=arenaT(P.arenaWins||0);
  const tier=ARENA_TIERS[tierIdx];
  const nextTier=ARENA_TIERS[tierIdx+1];
  const wins=P.arenaWins||0;
  const losses=P.arenaLosses||0;
  const pct=nextTier?Math.round(((wins-tier.wins)/(nextTier.wins-tier.wins))*100):100;

  document.getElementById("content").innerHTML=`
    <div class="card">
      <div class="arena-tier">
        <div style="font-size:2.5rem">${TIER_EMOJIS[tierIdx]}</div>
        <div class="arena-tier-name" style="color:${tier.color}">${tier.name} League</div>
        <div class="arena-tier-sub">${wins} wins · ${losses} losses</div>
        ${nextTier?`
          <div class="bar bar-arena" style="margin:0.5rem auto;max-width:200px">
            <div class="bar-fill" style="width:${pct}%"></div>
          </div>
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
      <div style="font-size:0.85rem;color:var(--text3);margin-bottom:0.75rem">
        Generate a monster scaled to your arena tier and level.<br>
        Costs ${CFG.ARENA_COST_GOLD}🪙 and ${CFG.ARENA_COST_EP} energy.
      </div>
      <button class="btn btn-purple" onclick="G.startArenaBattle()">
        ⚔️ Generate Arena Monster (${CFG.ARENA_COST_GOLD}🪙)
      </button>
    </div>

    <button class="btn btn-ghost" onclick="G.showTab('home')" style="margin-top:0.5rem">← Back</button>`;
}

function startArenaBattle(){
  if((P.gold||0)<CFG.ARENA_COST_GOLD){toast("💰 Not enough gold!");return;}
  if(P.energy<CFG.ARENA_COST_EP){toast("⚡ Not enough energy!");return;}
  P.gold-=CFG.ARENA_COST_GOLD;
  P.energy-=CFG.ARENA_COST_EP;

  // Generate a stronger arena monster based on tier
  const tierIdx=arenaT(P.arenaWins||0);
  const tier=ARENA_TIERS[tierIdx];
  const {str:eStr,def:eDef}=equipStats(P.equipped);
  const tStr=(P.baseStr||10)+eStr, tDef=(P.baseDef||5)+eDef;

  // Arena monster scales relative to player's actual stats
  const m={
    name:`${tier.name} Champion`,
    emoji:["🗡️","⚔️","🏹","🛡️","🔱","💀","👑"][tierIdx],
    image:"",
    desc:`A ${tier.name} League champion. Formidable.`,
    str:Math.round(tStr*(0.8+Math.random()*0.6)),
    def:Math.round(tDef*(0.8+Math.random()*0.6)),
    hp:P.maxHp+Math.round(P.maxHp*tierIdx*0.15),
    maxHp:P.maxHp+Math.round(P.maxHp*tierIdx*0.15),
    expReward:Math.round(100*tier.expBonus*(1+tierIdx*0.2)),
    goldReward:Math.round(150*tier.goldBonus*(1+tierIdx*0.2)),
    isArena:true,
    tierIdx
  };

  saveP();
  updateWalkBtn();
  openCombatModal(m);
}

// ── BANK ─────────────────────────────────────────────────────
function renderBank(){
  document.getElementById("content").innerHTML=`
    <div class="card">
      <div class="card-title">🏦 Royal Bank</div>
      <div class="bank-display">
        <div class="bank-amount">🏦 ${fmt(P.bank)}</div>
        <div class="bank-label">Bank Balance</div>
      </div>
      <div class="bank-display" style="margin-bottom:0.75rem">
        <div class="bank-amount">🪙 ${fmt(P.gold)}</div>
        <div class="bank-label">On Hand</div>
      </div>

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
      <div style="font-size:0.72rem;color:var(--text3);margin-top:0.5rem">
        Gold in the bank is safe from anything. Keep your savings here!
      </div>
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

// ── MARKET ───────────────────────────────────────────────────
async function renderMarket(){
  document.getElementById("content").innerHTML=`
    <div class="card"><div style="text-align:center;color:var(--text3);padding:1rem">Loading market...</div></div>`;

  const listings=await getListings();
  const myListings=listings.filter(l=>l.sellerId===CU.uid);
  const others=listings.filter(l=>l.sellerId!==CU.uid);

  // Tab row for market sub-sections
  const marketContent=`
    <div class="tab-row" style="margin-bottom:0.75rem">
      <button class="tab-btn active" id="mtab-browse" onclick="G.mTab('browse')">Browse</button>
      <button class="tab-btn" id="mtab-sell" onclick="G.mTab('sell')">Sell</button>
      <button class="tab-btn" id="mtab-shop" onclick="G.mTab('shop')">NPC Shop</button>
      <button class="tab-btn" id="mtab-mine" onclick="G.mTab('mine')">My Listings</button>
    </div>
    <div id="market-body"></div>`;

  document.getElementById("content").innerHTML=marketContent;
  renderMarketBrowse(others);
}

function mTab(t){
  ["browse","sell","shop","mine"].forEach(x=>{
    const b=document.getElementById("mtab-"+x);
    if(b)b.classList.toggle("active",x===t);
  });
  if(t==="browse") getListings().then(l=>renderMarketBrowse(l.filter(x=>x.sellerId!==CU.uid)));
  else if(t==="sell") renderMarketSell();
  else if(t==="shop") renderMarketShop();
  else if(t==="mine") getListings().then(l=>renderMyListings(l.filter(x=>x.sellerId===CU.uid)));
}

function renderMarketBrowse(listings){
  const body=document.getElementById("market-body");
  if(!body)return;
  if(listings.length===0){
    body.innerHTML=`<div style="text-align:center;color:var(--text3);padding:2rem;font-style:italic">
      No items listed yet. Be the first to sell!</div>`;
    return;
  }
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
  const body=document.getElementById("market-body");
  if(!body)return;
  const inv=P.inventory||[];
  if(inv.length===0){
    body.innerHTML=`<div style="text-align:center;color:var(--text3);padding:2rem;font-style:italic">
      No items in inventory to sell.</div>`;
    return;
  }
  body.innerHTML=`
    <div style="font-size:0.8rem;color:var(--text3);margin-bottom:0.75rem">
      A ${Math.round(CFG.MARKET_FEE*100)}% fee is deducted from sales.
    </div>
    ${inv.map((item,i)=>{
      const q=qualityLabel(item.val,item.base||item.val);
      return`<div class="market-item">
        <div class="market-icon">${gfx(item.image,item.emoji,36)}</div>
        <div class="market-info">
          <div class="market-name" style="color:${RARITY_COLOR[item.rarity]}">${item.name}
            <span class="pill" style="background:${q.color}22;color:${q.color};font-size:0.6rem">${q.label}</span>
          </div>
          <div class="market-stat">+${item.val} ${item.stat==="str"?"STR":"DEF"} · ${item.type}</div>
        </div>
        <button class="btn btn-gold btn-sm" onclick="G.promptSell(${i})">List</button>
      </div>`;
    }).join("")}`;
}

function renderMarketShop(){
  const body=document.getElementById("market-body");
  if(!body)return;

  const shopItems=ITEMS.filter(i=>i.shopPrice>0);
  // Common pets available in shop (uncommon rarity and below)
  const shopPets=PETS.filter(p=>p.rarity==="common"||p.rarity==="uncommon");

  const equipHtml=shopItems.map((item,i)=>`
    <div class="shop-item">
      <div class="shop-icon">${gfx(item.image,item.emoji,40)}</div>
      <div class="shop-info">
        <div class="shop-name" style="color:${RARITY_COLOR[item.rarity]}">${item.name}</div>
        <div class="shop-desc">+~${item.base} ${item.stat==="str"?"STR":"DEF"} (stat varies) · ${item.type}</div>
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
        <div class="shop-desc">+~${pet.base} ${pet.stat==="str"?"STR":"DEF"} · Pet · "${pet.desc}"</div>
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
      <div class="shop-info">
        <div class="shop-name">${c.name}</div>
        <div class="shop-desc">${c.desc}</div>
      </div>
      <div>
        <div class="shop-price">🪙${fmt(c.price)}</div>
        <button class="btn btn-gold btn-sm" style="margin-top:0.3rem" onclick="G.buyConsumable('${c.id}')">Buy</button>
      </div>
    </div>`).join("");

  body.innerHTML=`
    <div style="font-size:0.78rem;color:var(--text3);margin-bottom:0.6rem">Your gold: 🪙${fmt(P.gold)}</div>
    <div class="section-hdr">Consumables</div>
    ${consumeHtml}
    <div class="section-hdr">🐾 Pets</div>
    ${petHtml||`<div style="color:var(--text3);font-style:italic;font-size:0.85rem;padding:0.5rem">No pets in stock.</div>`}
    <div class="section-hdr">Equipment</div>
    ${equipHtml}`;
}

function renderMyListings(listings){
  const body=document.getElementById("market-body");
  if(!body)return;
  if(listings.length===0){
    body.innerHTML=`<div style="text-align:center;color:var(--text3);padding:2rem;font-style:italic">
      You have no active listings.</div>`;
    return;
  }
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
  // Re-fetch to make sure it's still there
  const snap=await getDoc(doc(db,"market",id));
  if(!snap.exists()){toast("Listing no longer available.");renderMarket();return;}
  const listing=snap.data();
  P.gold-=price;
  P.inventory=[...(P.inventory||[]),listing.item];
  await removeListing(id);
  saveP();
  toast(`✅ Bought ${listing.item.name} for 🪙${fmt(price)}!`);
  updateQuestProgress("items");
  renderMarket();
}

async function cancelListing(id,item){
  await removeListing(id);
  P.inventory=[...(P.inventory||[]),item];
  saveP();
  toast("📦 Listing cancelled, item returned.");
  renderMarket();
}

function promptSell(idx){
  const item=(P.inventory||[])[idx];
  if(!item)return;
  const suggestedPrice=item.base?(item.base*item.val*2):200;
  document.getElementById("modal-content").innerHTML=`
    <div class="modal-title">List on Market</div>
    <div class="modal-icon">${gfx(item.image,item.emoji,72)}</div>
    <div style="text-align:center;color:${RARITY_COLOR[item.rarity]};margin-bottom:0.5rem">${item.name}</div>
    <div style="font-size:0.82rem;color:var(--text3);text-align:center;margin-bottom:1rem">+${item.val} ${item.stat==="str"?"STR":"DEF"}</div>
    <div style="font-size:0.8rem;color:var(--text3);margin-bottom:0.4rem">Set your price (gold):</div>
    <input class="modal-input" id="sell-price" type="number" value="${suggestedPrice}" min="1"/>
    <div style="font-size:0.72rem;color:var(--text3);margin-bottom:0.75rem">
      ${Math.round(CFG.MARKET_FEE*100)}% fee on sale. Suggested: ${suggestedPrice}🪙
    </div>
    <div class="modal-actions">
      <button class="btn btn-gold" onclick="G.confirmSell(${idx})">List Item</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Cancel</button>
    </div>`;
  document.getElementById("modal-overlay").style.display="flex";
}

async function confirmSell(idx){
  const price=Math.floor(Number(document.getElementById("sell-price").value));
  if(!price||price<1){toast("Enter a valid price");return;}
  const item=(P.inventory||[])[idx];
  if(!item)return;
  P.inventory=P.inventory.filter((_,i)=>i!==idx);
  await addListing(item,price);
  saveP();
  closeModal();
  toast(`🏪 Listed ${item.name} for 🪙${fmt(price)}!`);
  renderMarket();
}

function buyShopItem(kind, idx){
  let template, price;
  if(kind==="pet"){
    const shopPets=PETS.filter(p=>p.rarity==="common"||p.rarity==="uncommon");
    template=shopPets[idx];
    price=Math.round(300*(template.base/5));
  } else {
    const shopItems=ITEMS.filter(i=>i.shopPrice>0);
    template=shopItems[idx];
    price=template.shopPrice;
  }
  if(!template)return;
  if((P.gold||0)<price){toast("💰 Not enough gold!");return;}
  const val=rollItemStat(template);
  const item={...template,val,base:template.base,id:`item_${Date.now()}_${rand(0,9999)}`};
  delete item.shopPrice; delete item.dropRate;
  P.gold-=price;
  P.inventory=[...(P.inventory||[]),item];
  P.itemsFound=(P.itemsFound||0)+1;
  saveP();
  updateQuestProgress("items");
  toast(`🛒 Bought ${item.name} (+${val} ${item.stat==="str"?"STR":"DEF"})!`);
  renderMarketShop();
}

function buyConsumable(id){
  const c=SHOP_CONSUMABLES.find(x=>x.id===id);
  if(!c)return;
  if((P.gold||0)<c.price){toast("💰 Not enough gold!");return;}
  P.gold-=c.price;
  applyConsumable(c.effect);
  saveP();
  toast(`${c.emoji} Used ${c.name}!`);
  updateWalkBtn();
  if(TAB==="market")renderMarket();
}

function applyConsumable(effect){
  if(effect==="heal_small"){ P.hp=Math.min(P.maxHp,P.hp+Math.floor(P.maxHp*CFG.POTION_HEAL_SMALL)); toast(`❤️ Restored ${Math.floor(P.maxHp*CFG.POTION_HEAL_SMALL)} HP!`); }
  else if(effect==="heal_big"){ P.hp=Math.min(P.maxHp,P.hp+Math.floor(P.maxHp*CFG.POTION_HEAL_BIG)); toast(`❤️ Restored ${Math.floor(P.maxHp*CFG.POTION_HEAL_BIG)} HP!`); }
  else if(effect==="energy_full"){ P.energy=CFG.MAX_ENERGY; P.lastEnergyTime=Date.now(); toast("⚡ Energy fully restored!"); updateWalkBtn(); }
  else if(effect==="exp_200"){ P.exp=(P.exp||0)+200; checkLevelUp(); toast("📜 +200 EXP!"); }
}

// ── SOCIAL / LEADERBOARD ─────────────────────────────────────
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
  // Update active tab button
  document.querySelectorAll("#lb-tabs .tab-btn").forEach((b,i)=>{
    const types=["level","kills","arena","steps","gold","items"];
    b.classList.toggle("active",types[i]===type);
  });

  const all=_lbCache||[];
  let sorted, valFn, title;

  if(type==="level"){
    sorted=[...all].sort((a,b)=>b.level-a.level||(b.exp||0)-(a.exp||0));
    valFn=p=>`Lv.${p.level}`;
    title="🏆 Level Rankings";
  } else if(type==="kills"){
    sorted=[...all].sort((a,b)=>(b.npcKills||0)-(a.npcKills||0));
    valFn=p=>`${fmt(p.npcKills||0)} kills`;
    title="💀 Monster Kill Rankings";
  } else if(type==="arena"){
    sorted=[...all].sort((a,b)=>(b.arenaWins||0)-(a.arenaWins||0));
    valFn=p=>{ const ti=arenaT(p.arenaWins||0); return `${TIER_EMOJIS[ti]} ${ARENA_TIERS[ti].name}`; };
    title="⚔️ Arena Rankings";
  } else if(type==="steps"){
    sorted=[...all].sort((a,b)=>(b.steps||0)-(a.steps||0));
    valFn=p=>`${fmt(p.steps||0)} steps`;
    title="👣 Step Rankings";
  } else if(type==="gold"){
    sorted=[...all].sort((a,b)=>((b.gold||0)+(b.bank||0))-((a.gold||0)+(a.bank||0)));
    valFn=p=>`🪙${fmt((p.gold||0)+(p.bank||0))}`;
    title="🪙 Wealth Rankings";
  } else {
    sorted=[...all].sort((a,b)=>(b.itemsFound||0)-(a.itemsFound||0));
    valFn=p=>`${p.itemsFound||0} items`;
    title="🎁 Items Found Rankings";
  }

  const top=sorted.slice(0,10);
  const body=document.getElementById("lb-body");
  if(!body)return;

  if(top.length===0){
    body.innerHTML=`<div class="card"><div style="text-align:center;color:var(--text3);font-style:italic;padding:1rem">No data yet!</div></div>`;
    return;
  }

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

// ── PROFILE ──────────────────────────────────────────────────
function renderYou(){
  const{str:eStr,def:eDef}=equipStats(P.equipped);
  const tierIdx=arenaT(P.arenaWins||0);
  const tier=ARENA_TIERS[tierIdx];
  document.getElementById("content").innerHTML=`
    <div class="profile-hero">
      <div class="profile-ava">${avatarGfx(80)}</div>
      <div class="profile-name">${P.username}</div>
      <div class="profile-level">Level ${P.level} · <span style="color:${tier.color}">${TIER_EMOJIS[tierIdx]} ${tier.name} League</span></div>
      <div class="profile-stats">
        <div class="ps-item"><div class="ps-val">${(P.baseStr||10)+eStr}</div><div class="ps-key">⚔️ STR</div></div>
        <div class="ps-item"><div class="ps-val">${(P.baseDef||5)+eDef}</div><div class="ps-key">🛡️ DEF</div></div>
        <div class="ps-item"><div class="ps-val">${P.maxHp}</div><div class="ps-key">❤️ Max HP</div></div>
        <div class="ps-item"><div class="ps-val">${fmt(P.steps||0)}</div><div class="ps-key">👣 Steps</div></div>
        <div class="ps-item"><div class="ps-val">${P.npcKills||0}</div><div class="ps-key">💀 Kills</div></div>
        <div class="ps-item"><div class="ps-val">${P.arenaWins||0}</div><div class="ps-key">🏆 Arena W</div></div>
        <div class="ps-item"><div class="ps-val">${fmt(P.gold||0)}</div><div class="ps-key">🪙 Gold</div></div>
        <div class="ps-item"><div class="ps-val">${fmt(P.bank||0)}</div><div class="ps-key">🏦 Bank</div></div>
        <div class="ps-item"><div class="ps-val">${(P.inventory||[]).length}</div><div class="ps-key">🎒 Items</div></div>
        <div class="ps-item"><div class="ps-val">${(P.avatars||[]).length}/${AVATARS.length}</div><div class="ps-key">🎭 Avatars</div></div>
      </div>
    </div>
    <button class="btn btn-purple" onclick="G.openAvatarCollection()" style="margin-bottom:0.7rem">🎭 My Avatar Collection</button>
    <div class="card">
      <div class="card-title">⚙️ Account</div>
      <button class="btn btn-ghost" onclick="G.handleSignOut()">Sign Out</button>
    </div>
    <button class="btn btn-ghost" onclick="G.showTab('home')" style="margin-top:0.5rem">← Back</button>`;
}

async function handleSignOut(){ clearInterval(energyInterval); await signOut(auth); }

// ── WALK / STEP ───────────────────────────────────────────────
function takeStep(){
  if(!P||P.energy<1){toast("⚡ No energy! Wait for regen.");return;}
  if(combatState){toast("⚔️ Finish your current battle first!");return;}
  P.energy--;
  P.steps=(P.steps||0)+1;
  if(P.energy<CFG.MAX_ENERGY&&!P.lastEnergyTime) P.lastEnergyTime=Date.now();
  updateWalkBtn();
  updateQuestProgress("steps");

  const roll=Math.random();
  if(roll<CFG.MONSTER_CHANCE){
    const m=spawnMonster();
    addFeed(m.emoji,m.image,`Encountered <strong>${m.name}</strong>!`,"Fight!","var(--crimson2)");
    saveP(); showWalkFeed(); setTimeout(()=>openCombatModal(m),350);
  } else if(roll<CFG.MONSTER_CHANCE+CFG.GOLD_CHANCE){
    const g=rand(5,25+P.level*2);
    P.gold=(P.gold||0)+g;
    addFeed("🪙","",`Found gold on the path!`,`+${g} 🪙`,"var(--gold2)");
    saveP(); showWalkFeed();
  } else if(roll<CFG.MONSTER_CHANCE+CFG.GOLD_CHANCE+CFG.ITEM_CHANCE){
    const item=spawnItem();
    P.inventory=[...(P.inventory||[]),item];
    P.itemsFound=(P.itemsFound||0)+1;
    const q=qualityLabel(item.val,item.base||item.val);
    addFeed(item.emoji,item.image,`Found a <strong>${item.name}</strong>! <span style="color:${q.color}">${q.label}</span>`,item.rarity,RARITY_COLOR[item.rarity]);
    toast(`${item.emoji} Found ${item.name} (+${item.val}) — ${q.label}!`);
    updateQuestProgress("items");
    tryAvatarDrop();
    saveP(); showWalkFeed();
  } else {
    const w=pick(WALK_EVENTS);
    addFeed(w.emoji,"",w.text,"Nothing","var(--text3)");
    saveP(); showWalkFeed();
  }
}

function showWalkFeed(){
  TAB="walk";
  ["home","gear","market","social"].forEach(t=>{
    const b=document.getElementById("nav-"+t);
    if(b)b.classList.remove("active");
  });
  renderWalk();
}

function addFeed(emoji,image,text,badge,color){
  feed.unshift({emoji,image,text,badge,color});
  if(feed.length>25)feed.pop();
}

function spawnMonster(){
  const eligible=MONSTERS.filter(m=>P.level>=(m.minLevel||0));
  const base=pick(eligible.length?eligible:MONSTERS);
  return{...base,
    str:rand(...base.str),def:rand(...base.def),
    hp:rand(...base.hp),maxHp:base.hp[1],
    expReward:rand(...base.exp),goldReward:rand(...base.gold)};
}

function spawnItem(){
  // Combine items and pets into one drop pool
  const pool=[...ITEMS,...PETS];
  const total=pool.reduce((s,i)=>s+(i.dropRate||10),0);
  let r=Math.random()*total;
  for(const t of pool){
    r-=(t.dropRate||10);
    if(r<=0){
      const val=rollItemStat(t);
      return{...t,val,base:t.base,id:`item_${Date.now()}_${rand(0,9999)}`};
    }
  }
  const t=ITEMS[0];
  return{...t,val:rollItemStat(t),base:t.base,id:`item_${Date.now()}`};
}

// ── COMBAT ───────────────────────────────────────────────────
function openCombatModal(monster){
  const{str:eStr,def:eDef}=equipStats(P.equipped);
  combatState={monster,
    playerHp:P.hp, playerMaxHp:P.maxHp,
    monsterHp:monster.hp,
    pStr:(P.baseStr||10)+eStr, pDef:(P.baseDef||5)+eDef,
    log:[], done:false, paused:false};
  // Save combat state to player so backing out doesn't lose it
  P.activeCombat=serializeCombat(combatState);
  saveP();
  renderCombatModal();
  document.getElementById("modal-overlay").style.display="flex";
  combatInterval=setInterval(combatTick,900);
}

function serializeCombat(cs){
  // Store the active fight so it can be resumed
  return{
    monster:cs.monster,
    playerHp:cs.playerHp, playerMaxHp:cs.playerMaxHp,
    monsterHp:cs.monsterHp,
    pStr:cs.pStr, pDef:cs.pDef,
    log:cs.log.slice(-20) // keep last 20 log lines
  };
}

function resumeCombat(){
  if(!P.activeCombat)return;
  const saved=P.activeCombat;
  combatState={...saved, done:false, paused:false};
  renderCombatModal();
  document.getElementById("modal-overlay").style.display="flex";
  combatInterval=setInterval(combatTick,900);
}

function abandonCombat(){
  // Abandoning = treated like a defeat, lose some HP and gold
  clearInterval(combatInterval);
  const penalty=rand(10,30);
  P.gold=Math.max(0,(P.gold||0)-penalty);
  P.hp=Math.max(1,Math.floor(P.maxHp*0.4));
  P.activeCombat=null;
  combatState=null;
  saveP(); updateWalkBtn(); closeModal();
  toast(`🏃 You fled! Lost ${penalty}🪙 and arrived injured.`);
}

function fleeCombat(){
  // Flee mid-battle — costs gold, ends fight
  if(!combatState||combatState.done)return;
  clearInterval(combatInterval);
  combatState.done=true;
  const goldLost=rand(15,Math.min(80, Math.floor((P.gold||0)*0.1)+15));
  P.gold=Math.max(0,(P.gold||0)-goldLost);
  P.hp=combatState.playerHp;
  P.activeCombat=null;
  combatState.log.push(`<span class="log-sys">🏃 You fled the battle! Lost ${goldLost}🪙</span>`);
  renderCombatModal();
  saveP(); updateWalkBtn();
  toast(`🏃 Escaped! But dropped ${goldLost}🪙 running away.`);
}

function healInCombat(){
  // Use a healing potion mid-fight (pauses 1 tick)
  if(!combatState||combatState.done)return;
  const smallP=SHOP_CONSUMABLES.find(c=>c.id==="potion_small");
  const bigP=SHOP_CONSUMABLES.find(c=>c.id==="potion_big");

  // Check what player has gold for
  const canAffordBig=(P.gold||0)>=bigP.price;
  const canAffordSmall=(P.gold||0)>=smallP.price;
  if(!canAffordSmall){
    toast("💰 Can't afford any potions! Check the shop.");
    return;
  }

  // Pick best affordable potion
  if(canAffordBig && P.hp < P.maxHp*0.5){
    // Low HP — use big potion
    P.gold-=bigP.price;
    const heal=Math.floor(combatState.playerMaxHp*CFG.POTION_HEAL_BIG);
    combatState.playerHp=Math.min(combatState.playerMaxHp,combatState.playerHp+heal);
    P.hp=combatState.playerHp;
    combatState.log.push(`<span class="log-win">💊 You chug a Major Potion! +${heal} HP</span>`);
  } else if(canAffordSmall){
    P.gold-=smallP.price;
    const heal=Math.floor(combatState.playerMaxHp*CFG.POTION_HEAL_SMALL);
    combatState.playerHp=Math.min(combatState.playerMaxHp,combatState.playerHp+heal);
    P.hp=combatState.playerHp;
    combatState.log.push(`<span class="log-win">🧪 You drink a Minor Potion! +${heal} HP</span>`);
  }
  saveP();
  renderCombatModal();
}

function renderCombatModal(){
  if(!combatState)return;
  const cs=combatState, m=cs.monster;
  const pPct=clamp((cs.playerHp/cs.playerMaxHp)*100,0,100);
  const mPct=clamp((cs.monsterHp/m.maxHp)*100,0,100);

  // Check if player has potions they can afford
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
            ?`<button class="btn btn-green btn-sm" style="flex:1;padding:0.55rem" onclick="G.healInCombat()">
                🧪 Heal (🪙${smallPrice})
              </button>`
            :`<button class="btn btn-ghost btn-sm" style="flex:1;padding:0.55rem;opacity:0.4" disabled>
                🧪 Heal
              </button>`}
          <button class="btn btn-danger btn-sm" style="flex:1;padding:0.55rem" onclick="G.fleeCombat()">
            🏃 Flee
          </button>
        </div>
        <div style="text-align:center;color:var(--text3);font-size:0.75rem;margin-top:0.4rem;font-style:italic">⚔️ Auto-battling... Flee costs random gold.</div>`}`;
  const log=document.getElementById("combat-log");
  if(log)log.scrollTop=log.scrollHeight;
}

function combatTick(){
  if(!combatState||combatState.done){clearInterval(combatInterval);return;}
  const cs=combatState,m=cs.monster;

  // Player attacks
  let pDmg=Math.max(1,cs.pStr-m.def+rand(-3,6));
  const pCrit=Math.random()<0.12;
  if(pCrit)pDmg=Math.floor(pDmg*1.75);
  cs.monsterHp=Math.max(0,cs.monsterHp-pDmg);
  cs.log.push(pCrit
    ?`<span class="log-crit">⚡ CRIT! You smash ${m.name} for ${pDmg}!</span>`
    :`<span class="log-you">You hit ${m.name} for ${pDmg}</span>`);

  if(cs.monsterHp<=0){
    cs.done=true; clearInterval(combatInterval);
    cs.log.push(`<span class="log-win">🏆 ${m.name} defeated! +${m.expReward} EXP · +${m.goldReward}🪙</span>`);
    handleVictory(cs); renderCombatModal(); return;
  }

  // Monster attacks
  let mDmg=Math.max(1,m.str-cs.pDef+rand(-3,6));
  const mCrit=Math.random()<0.08;
  if(mCrit)mDmg=Math.floor(mDmg*1.75);
  cs.playerHp=Math.max(0,cs.playerHp-mDmg);
  cs.log.push(mCrit
    ?`<span class="log-crit">💥 ${m.name} CRITS you for ${mDmg}!</span>`
    :`<span class="log-hit">${m.name} hits you for ${mDmg}</span>`);

  if(cs.playerHp<=0){
    cs.done=true; clearInterval(combatInterval);
    cs.log.push(`<span class="log-lose">💀 You were defeated by ${m.name}...</span>`);
    handleDefeat(cs); renderCombatModal(); return;
  }
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
  if(isArena) P.arenaWins=(P.arenaWins||0)+1;

  updateQuestProgress("kills");
  checkLevelUp();
  toast(isArena
    ?`🏆 Arena Victory! +${expGain} EXP · +${goldGain}🪙`
    :`⚔️ Victory! +${expGain} EXP · +${goldGain}🪙`);
  P.hp=clamp(P.hp,1,P.maxHp);
  combatState=null;
  P.activeCombat=null;
  saveP();
  updateWalkBtn();
}

function handleDefeat(cs){
  if(cs.monster.isArena) P.arenaLosses=(P.arenaLosses||0)+1;
  P.hp=Math.max(1,Math.floor(P.maxHp*0.25));
  toast("💀 Defeated! You rest and recover some HP. Buy potions in the shop!");
  combatState=null;
  P.activeCombat=null;
  saveP();
  updateWalkBtn();
}

function checkLevelUp(){
  let leveled=false;
  while(P.exp>=expLv(P.level)){
    P.exp-=expLv(P.level);
    P.level++;
    const{def:eDef}=equipStats(P.equipped);
    P.maxHp=maxHpCalc(P.level,(P.baseDef||5)+eDef);
    leveled=true;
  }
  if(leveled){
    P.hp=P.maxHp; // Full heal on level up!
    toast(`🎉 LEVEL UP! You are now Level ${P.level}! Full HP restored!`);
    updateWalkBtn();
  }
}

// ── ITEM MODAL ────────────────────────────────────────────────
function openItemModal(source,idx){
  let item,isEquipped=false,slot=null;
  if(source==="equipped"){ slot=idx; item=P.equipped[slot]; isEquipped=true; }
  else item=(P.inventory||[])[idx];
  if(!item)return;
  const color=RARITY_COLOR[item.rarity]||"#9ca3af";
  const q=qualityLabel(item.val,item.base||item.val);
  const curEquipped=P.equipped[item.type];
  const compare=curEquipped&&!isEquipped
    ?`<div class="modal-row"><em>vs Equipped</em><span style="color:${item.val>curEquipped.val?"var(--green2)":"var(--crimson2)"}">
        ${item.val>curEquipped.val?"▲":"▼"}${Math.abs(item.val-curEquipped.val)} vs +${curEquipped.val}
      </span></div>`:"";

  document.getElementById("modal-content").innerHTML=`
    <div class="modal-icon">${gfx(item.image,item.emoji,72)}</div>
    <div class="modal-title" style="color:${color}">${item.name}</div>
    <div class="modal-rarity" style="color:${color}">${item.rarity}
      <span style="margin-left:0.5rem;color:${q.color};font-size:0.65rem">${q.label}</span>
    </div>
    <div class="modal-row"><em>Type</em><span>${item.type}</span></div>
    <div class="modal-row"><em>Stat</em><span style="color:${item.stat==="str"?"var(--crimson2)":"var(--steel2)"}">+${item.val} ${item.stat==="str"?"STR":"DEF"}</span></div>
    <div class="modal-row"><em>Base Roll</em><span style="color:var(--text3)">~${item.base||"?"}</span></div>
    ${compare}
    <div class="modal-actions">
      ${isEquipped
        ?`<button class="btn btn-ghost" onclick="G.unequipItem('${slot}')">Unequip</button>`
        :`<button class="btn btn-gold" onclick="G.equipItem(${idx})">Equip</button>`}
      ${!isEquipped?`<button class="btn btn-purple" onclick="G.promptSell(${idx});G.closeModal()">List on Market</button>`:""}
      <button class="btn btn-danger" onclick="${isEquipped?`G.dropEquipped('${slot}')`:`G.dropInventory(${idx})`}">Drop Item</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Close</button>
    </div>`;
  document.getElementById("modal-overlay").style.display="flex";
}

function equipItem(idx){
  const item=(P.inventory||[])[idx]; if(!item)return;
  const eq={...(P.equipped||{})}, inv=[...(P.inventory||[])];
  if(eq[item.type]) inv.push(eq[item.type]);
  inv.splice(inv.findIndex(i=>i.id===item.id),1);
  eq[item.type]=item; P.equipped=eq; P.inventory=inv;
  const{def:eDef}=equipStats(eq);
  P.maxHp=maxHpCalc(P.level,(P.baseDef||5)+eDef);
  P.hp=clamp(P.hp,1,P.maxHp);
  saveP(); closeModal(); toast(`✅ Equipped ${item.name}!`); renderGear();
}

function unequipItem(slot){
  const item=P.equipped[slot]; if(!item)return;
  P.inventory=[...(P.inventory||[]),item];
  delete P.equipped[slot];
  const{def:eDef}=equipStats(P.equipped);
  P.maxHp=maxHpCalc(P.level,(P.baseDef||5)+eDef);
  P.hp=clamp(P.hp,1,P.maxHp);
  saveP(); closeModal(); toast(`📦 Unequipped ${item.name}`); renderGear();
}

function dropInventory(idx){
  const item=(P.inventory||[])[idx]; if(!item)return;
  P.inventory=P.inventory.filter((_,i)=>i!==idx);
  saveP(); closeModal(); toast(`🗑️ Dropped ${item.name}`); renderGear();
}

function dropEquipped(slot){
  const item=P.equipped[slot]; if(!item)return;
  delete P.equipped[slot];
  const{def:eDef}=equipStats(P.equipped);
  P.maxHp=maxHpCalc(P.level,(P.baseDef||5)+eDef);
  P.hp=clamp(P.hp,1,P.maxHp);
  saveP(); closeModal(); toast(`🗑️ Dropped ${item.name}`); renderGear();
}

function closeModal(){
  document.getElementById("modal-overlay").style.display="none";
  // If combat is done, clear it. If still going, pause it but keep state.
  if(combatState&&combatState.done){
    combatState=null;
    P.activeCombat=null;
    saveP();
  } else if(combatState&&!combatState.done){
    // Paused — stop the interval, keep combatState alive
    clearInterval(combatInterval);
    combatInterval=null;
    P.activeCombat=serializeCombat(combatState);
    saveP();
    // Show resume banner on home
    if(TAB==="home") renderHome();
  }
}

// ── TOAST ─────────────────────────────────────────────────────
function toast(msg){
  const el=document.createElement("div");
  el.className="toast"; el.textContent=msg;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(()=>{ el.classList.add("dying"); setTimeout(()=>el.remove(),300); },2800);
}

// ── EXPOSE TO HTML ────────────────────────────────────────────
// Everything called from onclick= in index.html must be on window.G
window.G={
  switchAuthTab, handleEmailAuth, handleGoogleAuth, handleSetUsername,
  showTab, takeStep, closeModal,
  openItemModal, equipItem, unequipItem, dropInventory, dropEquipped,
  promptSell, confirmSell, buyListing, cancelListing, buyShopItem, buyConsumable,
  mTab,
  claimQuest,
  startArenaBattle,
  doDeposit, doWithdraw,
  handleSignOut,
  equipAvatar, openAvatarCollection,
  lbTab,
  fleeCombat, healInCombat, resumeCombat, abandonCombat,
};
