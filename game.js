// ============================================================
//  MicroMMO — game.js  (v4)
//  PART 1 of 3 — Config, Data, Audio, Helpers
// ============================================================

import{initializeApp}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import{getAuth,onAuthStateChanged,signInWithEmailAndPassword,
  createUserWithEmailAndPassword,signInWithPopup,GoogleAuthProvider,signOut
}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import{getFirestore,doc,getDoc,setDoc,deleteDoc,updateDoc,collection,
  getDocs,addDoc,query,where,orderBy,limit,serverTimestamp,arrayUnion,arrayRemove,increment
}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── FIREBASE ─────────────────────────────────────────────────
const FIREBASE_CONFIG={
  apiKey:"AIzaSyA4-X-N-wAFnmPwZcJ-SnWJKMI-mNa2kQs",
  authDomain:"micrommo-77c6e.firebaseapp.com",
  projectId:"micrommo-77c6e",
  storageBucket:"micrommo-77c6e.firebasestorage.app",
  messagingSenderId:"639233695341",
  appId:"1:639233695341:web:d0df1515a79c9df6afa964"
};

// ── UI CONFIG ─────────────────────────────────────────────────
const UI={
  LOGO:      {emoji:"⚔", image:"img/ui/logo.png"},
  WALK_BTN:  {emoji:"⚔️",image:""},
  NAV_HOME:  {emoji:"🏠",image:""},
  NAV_GEAR:  {emoji:"🎒",image:""},
  NAV_MARKET:{emoji:"🏪",image:""},
  NAV_SOCIAL:{emoji:"👥",image:""},
};
const PLAYER_AVATAR={emoji:"🧙",image:""};

function slug(n){return n.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");}
function gfx(image,emoji,size=32){
  if(image)return`<img src="${image}" alt="" style="width:${size}px;height:${size}px;object-fit:contain" onerror="this.style.display='none'">`;
  return emoji;
}

// ── AUDIO ENGINE ──────────────────────────────────────────────
let _audioCtx=null;
function getAudio(){
  if(!_audioCtx)_audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  return _audioCtx;
}
function playTone(freq,type,dur,vol=0.3,delay=0){
  try{
    const ctx=getAudio();
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.connect(g);g.connect(ctx.destination);
    o.type=type;o.frequency.setValueAtTime(freq,ctx.currentTime+delay);
    g.gain.setValueAtTime(vol,ctx.currentTime+delay);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+delay+dur);
    o.start(ctx.currentTime+delay);o.stop(ctx.currentTime+delay+dur+0.05);
  }catch(e){}
}
function playNoise(dur,vol=0.15){
  try{
    const ctx=getAudio();
    const buf=ctx.createBuffer(1,ctx.sampleRate*dur,ctx.sampleRate);
    const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    const src=ctx.createBufferSource(),g=ctx.createGain();
    src.buffer=buf;src.connect(g);g.connect(ctx.destination);
    g.gain.setValueAtTime(vol,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
    src.start();src.stop(ctx.currentTime+dur+0.05);
  }catch(e){}
}
const SFX={
  click:    ()=>{playTone(800,"square",0.05,0.15);},
  step:     ()=>{playTone(220,"sine",0.12,0.1);playTone(180,"sine",0.08,0.08,0.1);},
  gold:     ()=>{playTone(880,"sine",0.08,0.2);playTone(1100,"sine",0.08,0.2,0.08);playTone(1320,"sine",0.12,0.2,0.16);},
  hit:      ()=>{playNoise(0.08,0.2);playTone(150,"sawtooth",0.1,0.2);},
  crit:     ()=>{playNoise(0.05,0.3);playTone(200,"sawtooth",0.05,0.3);playTone(300,"sawtooth",0.1,0.25,0.06);},
  victory:  ()=>{[523,659,784,1047].forEach((f,i)=>playTone(f,"sine",0.15,0.3,i*0.12));},
  defeat:   ()=>{[400,300,200,150].forEach((f,i)=>playTone(f,"sine",0.2,0.25,i*0.15));},
  levelUp:  ()=>{[523,659,784,1047,1319].forEach((f,i)=>playTone(f,"sine",0.18,0.35,i*0.1));},
  itemFound:()=>{playTone(660,"sine",0.1,0.25);playTone(880,"sine",0.15,0.25,0.1);},
  chest:    ()=>{[330,440,550,660,880].forEach((f,i)=>playTone(f,"sine",0.12,0.3,i*0.07));},
  equip:    ()=>{playTone(440,"square",0.08,0.2);playTone(660,"square",0.1,0.2,0.08);},
  error:    ()=>{playTone(200,"sawtooth",0.15,0.2);},
  pvpWin:   ()=>{[440,554,659,880].forEach((f,i)=>playTone(f,"sine",0.15,0.3,i*0.1));},
  pvpLose:  ()=>{[440,370,330,220].forEach((f,i)=>playTone(f,"sawtooth",0.15,0.2,i*0.12));},
  bounty:   ()=>{playTone(300,"square",0.05,0.2);playTone(400,"square",0.05,0.2,0.06);playTone(600,"square",0.1,0.2,0.12);},
  guild:    ()=>{[330,415,523].forEach((f,i)=>playTone(f,"sine",0.15,0.25,i*0.08));},
  donate:   ()=>{playTone(523,"sine",0.1,0.2);playTone(784,"sine",0.12,0.2,0.1);},
  raid:     ()=>{playNoise(0.1,0.3);[150,200,250].forEach((f,i)=>playTone(f,"sawtooth",0.15,0.35,i*0.08));},
};

// ── WALK ZONES ────────────────────────────────────────────────
// Each zone has a unique CSS animation atmosphere.
// Edit minLevel and monsterLevelBonus to tune difficulty.
const WALK_AREAS=[
  {
    id:"greenwood", name:"Greenwood Vale", emoji:"🌲",
    desc:"A peaceful forest. Beware the shadows.",
    minLevel:1, monsterLevelBonus:0, expMult:1.0, goldMult:1.0, lootBonus:0,
    bgCSS:`background:linear-gradient(180deg,#0d2b1a 0%,#1a4a2a 50%,#0f2a18 100%);`,
    particles:"leaves",
  },
  {
    id:"stonecrypt", name:"Stone Crypt", emoji:"💀",
    desc:"Ancient burial grounds. The dead don't rest.",
    minLevel:5, monsterLevelBonus:3, expMult:1.3, goldMult:1.2, lootBonus:0.05,
    bgCSS:`background:linear-gradient(180deg,#0e0e1a 0%,#1a1a2e 50%,#0a0a14 100%);`,
    particles:"spirits",
  },
  {
    id:"shadowpeaks", name:"Shadow Peaks", emoji:"⛰️",
    desc:"Treacherous mountains. Monsters roam freely.",
    minLevel:10, monsterLevelBonus:6, expMult:1.7, goldMult:1.5, lootBonus:0.08,
    bgCSS:`background:linear-gradient(180deg,#0a0814 0%,#1a1030 50%,#080612 100%);`,
    particles:"snow",
  },
  {
    id:"voidrift", name:"The Void Rift", emoji:"🌀",
    desc:"Reality tears here. Only legends survive.",
    minLevel:18, monsterLevelBonus:12, expMult:2.2, goldMult:2.0, lootBonus:0.12,
    bgCSS:`background:linear-gradient(180deg,#050514 0%,#0a0520 50%,#020208 100%);`,
    particles:"void",
  },
  {
    id:"ashvolcano", name:"Ashveil Volcano", emoji:"🌋",
    desc:"Rivers of lava. The air burns your lungs.",
    minLevel:25, monsterLevelBonus:16, expMult:2.6, goldMult:2.4, lootBonus:0.15,
    bgCSS:`background:linear-gradient(180deg,#1a0500 0%,#3a0f00 50%,#0f0200 100%);`,
    particles:"embers",
  },
  {
    id:"frostspire", name:"Frostspire Wastes", emoji:"🧊",
    desc:"Eternal blizzard. Only the cold survives.",
    minLevel:32, monsterLevelBonus:20, expMult:3.0, goldMult:2.8, lootBonus:0.18,
    bgCSS:`background:linear-gradient(180deg,#050a14 0%,#0a1428 50%,#050a1a 100%);`,
    particles:"blizzard",
  },
  {
    id:"shadowrealm", name:"Shadow Realm", emoji:"👁️",
    desc:"A dimension of pure darkness and terror.",
    minLevel:40, monsterLevelBonus:25, expMult:3.5, goldMult:3.2, lootBonus:0.22,
    bgCSS:`background:linear-gradient(180deg,#080008 0%,#150015 50%,#050005 100%);`,
    particles:"shadow",
  },
  {
    id:"celestialplane", name:"Celestial Plane", emoji:"✨",
    desc:"The realm of gods. Few mortals see this and live.",
    minLevel:50, monsterLevelBonus:32, expMult:4.0, goldMult:3.8, lootBonus:0.28,
    bgCSS:`background:linear-gradient(180deg,#0a0820 0%,#181030 50%,#080618 100%);`,
    particles:"stars",
  },
  {
    id:"abyssaldepths", name:"Abyssal Depths", emoji:"🌊",
    desc:"The ocean floor. Ancient horrors dwell here.",
    minLevel:60, monsterLevelBonus:40, expMult:4.8, goldMult:4.5, lootBonus:0.35,
    bgCSS:`background:linear-gradient(180deg,#000814 0%,#001428 50%,#000510 100%);`,
    particles:"bubbles",
  },
  {
    id:"chaoscore", name:"The Chaos Core", emoji:"☄️",
    desc:"The end of all things. Pure destruction incarnate.",
    minLevel:75, monsterLevelBonus:50, expMult:6.0, goldMult:5.5, lootBonus:0.45,
    bgCSS:`background:linear-gradient(180deg,#0f0000 0%,#1f0505 50%,#0a0000 100%);`,
    particles:"chaos",
  },
];

// ── PROPERTIES ───────────────────────────────────────────────
const PROPERTIES=[
  {id:"prop_hovel",   name:"Wanderer's Hovel",  emoji:"🪨",price:500,   energyBonus:2,  rentalRate:0.05,desc:"A damp cave you've claimed."},
  {id:"prop_shack",   name:"Rustic Shack",       emoji:"🛖",price:1500,  energyBonus:5,  rentalRate:0.05,desc:"Four walls and a leaky roof."},
  {id:"prop_cottage", name:"Stoneleaf Cottage",  emoji:"🏡",price:4000,  energyBonus:10, rentalRate:0.05,desc:"A cozy cottage by a brook."},
  {id:"prop_inn",     name:"Traveller's Inn",    emoji:"🏠",price:10000, energyBonus:18, rentalRate:0.05,desc:"A proper inn. Guests pay."},
  {id:"prop_manor",   name:"Thornwood Manor",    emoji:"🏰",price:25000, energyBonus:30, rentalRate:0.05,desc:"A sprawling manor."},
  {id:"prop_keep",    name:"Ironspire Keep",     emoji:"🗼",price:60000, energyBonus:50, rentalRate:0.05,desc:"A fortified keep."},
  {id:"prop_citadel", name:"Celestial Citadel",  emoji:"✨",price:150000,energyBonus:100,rentalRate:0.05,desc:"Touched by the gods."},
];

// ── CHOICE EVENTS ─────────────────────────────────────────────
const CHOICE_EVENTS=[
  {id:"chest",emoji:"📦",title:"A Weathered Chest",
   desc:"You stumble across an old chest half-buried in the dirt. Investigate?",
   choices:[
     {label:"Open it", outcome:()=>({msg:"The chest springs open! Gold inside!",gold:()=>rand(30,120),hp:0})},
     {label:"Leave it",outcome:()=>({msg:"You walk away. Better safe than sorry.",gold:0,hp:0})},
   ]},
  {id:"stranger",emoji:"🧙",title:"A Hooded Stranger",
   desc:"A cloaked figure offers you something wrapped in cloth. Accept?",
   choices:[
     {label:"Accept", outcome:()=>({msg:"A strange potion. You drink it.",gold:0,hp:()=>rand(-20,40)})},
     {label:"Decline",outcome:()=>({msg:"The stranger vanishes in smoke.",gold:0,hp:0})},
   ]},
  {id:"shrine",emoji:"⛩️",title:"Ancient Shrine",
   desc:"A crumbling shrine. Leave an offering of 50 gold?",
   choices:[
     {label:"Offer 50 gold",outcome:(p)=>{
       if((p.gold||0)<50)return{msg:"Not enough gold.",gold:0,hp:0};
       return{msg:"The shrine glows. You feel restored!",gold:-50,hp:()=>rand(20,60)};
     }},
     {label:"Ignore it",outcome:()=>({msg:"You pass by.",gold:0,hp:0})},
   ]},
  {id:"gambler",emoji:"🎲",title:"Roadside Gambler",
   desc:"A shady figure offers to double 100 gold. Bet?",
   choices:[
     {label:"Bet 100 gold",outcome:(p)=>{
       if((p.gold||0)<100)return{msg:"Too broke to gamble.",gold:0,hp:0};
       const win=Math.random()<0.45;
       return{msg:win?"You won!":"The dice were loaded.",gold:win?100:-100,hp:0};
     }},
     {label:"Walk away",outcome:()=>({msg:"Some risks aren't worth it.",gold:0,hp:0})},
   ]},
  {id:"mushroom",emoji:"🍄",title:"Glowing Mushroom",
   desc:"A bioluminescent mushroom pulses with strange light. Eat it?",
   choices:[
     {label:"Eat it",outcome:()=>{
       const r=Math.random();
       return{msg:r<0.4?"Delicious! You feel energised.":r<0.7?"Tastes awful.":"Nothing happens.",
              gold:0,hp:()=>Math.random()<0.4?rand(15,40):Math.random()<0.5?-rand(10,25):0};
     }},
     {label:"Leave it",outcome:()=>({msg:"You resist the glow.",gold:0,hp:0})},
   ]},
  {id:"cave",emoji:"🕳️",title:"Dark Cave Entrance",
   desc:"A cave mouth yawns in the hillside. Enter?",
   choices:[
     {label:"Go in",outcome:()=>{
       const win=Math.random()<0.5;
       return{msg:win?"A cache of gold!":"A bat colony erupts! You flee.",
              gold:win?rand(40,100):-10,hp:win?0:-rand(5,15)};
     }},
     {label:"Move on",outcome:()=>({msg:"Some things are best left alone.",gold:0,hp:0})},
   ]},
];

// ── GAME SETTINGS ────────────────────────────────────────────
const CFG={
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
};

// ── ARENA TIERS (kept for profile history) ───────────────────
const ARENA_TIERS=[
  {name:"Copper",  color:"#cd7f32",wins:0,  expBonus:1.0, goldBonus:1.0},
  {name:"Bronze",  color:"#c9943a",wins:10, expBonus:1.1, goldBonus:1.1},
  {name:"Silver",  color:"#94a3b8",wins:25, expBonus:1.25,goldBonus:1.2},
  {name:"Gold",    color:"#f59e0b",wins:50, expBonus:1.4, goldBonus:1.35},
  {name:"Platinum",color:"#60a5fa",wins:100,expBonus:1.6, goldBonus:1.5},
  {name:"Diamond", color:"#c084fc",wins:200,expBonus:1.85,goldBonus:1.7},
  {name:"Champion",color:"#fbbf24",wins:400,expBonus:2.2, goldBonus:2.0},
];

// ── MONSTERS ─────────────────────────────────────────────────
const MONSTERS=[
  {name:"Goblin Scout",    emoji:"👺",desc:"A sneaky little menace.",                  str:[4,12], def:[2,7],  hp:[25,55],  exp:[15,40],  gold:[4,20],  minLevel:0},
  {name:"Forest Wolf",     emoji:"🐺",desc:"Runs in packs. Alone now. Very hungry.",   str:[9,18], def:[4,10], hp:[45,80],  exp:[35,70],  gold:[12,35], minLevel:0},
  {name:"Cave Bat",        emoji:"🦇",desc:"Dives from the dark. Hard to track.",      str:[6,14], def:[2,8],  hp:[20,45],  exp:[20,45],  gold:[5,18],  minLevel:0},
  {name:"Stone Golem",     emoji:"🗿",desc:"Ancient guardian. Slow but devastating.",  str:[7,15], def:[18,30],hp:[70,120], exp:[55,100], gold:[20,55], minLevel:3},
  {name:"Shadow Wraith",   emoji:"👻",desc:"A spirit that feeds on life force.",       str:[22,38],def:[6,15], hp:[60,110], exp:[75,130], gold:[28,65], minLevel:5},
  {name:"Venomfang Spider",emoji:"🕷️",desc:"Its bite carries a slow, rotting curse.", str:[14,24],def:[8,16], hp:[50,90],  exp:[50,90],  gold:[18,45], minLevel:4},
  {name:"Troll Brute",     emoji:"👹",desc:"Regenerates. Hit it fast.",                str:[20,35],def:[14,24],hp:[100,160],exp:[80,140], gold:[35,80], minLevel:6},
  {name:"Dragon Whelp",    emoji:"🐉",desc:"Young dragon. Not fully grown. Still lethal.",str:[28,46],def:[13,25],hp:[110,185],exp:[110,185],gold:[45,110],minLevel:8},
  {name:"Skeleton Knight", emoji:"💀",desc:"Fought a hundred wars. Still here.",       str:[18,32],def:[22,38],hp:[90,150], exp:[90,160], gold:[38,85], minLevel:6},
  {name:"Dark Sorcerer",   emoji:"🧙",desc:"Commands ancient spells.",                 str:[40,60],def:[5,12], hp:[80,130], exp:[120,200],gold:[60,130],minLevel:10},
  {name:"Banshee Queen",   emoji:"👸",desc:"Her scream alone can end you.",            str:[35,55],def:[8,18], hp:[130,210],exp:[140,230],gold:[65,140],minLevel:11},
  {name:"Lich Lord",       emoji:"💀",desc:"Mastered death itself.",                   str:[45,70],def:[18,32],hp:[180,300],exp:[180,320],gold:[90,190],minLevel:14},
  {name:"Elder Dragon",    emoji:"🐲",desc:"A living catastrophe.",                    str:[60,90],def:[25,45],hp:[300,500],exp:[300,500],gold:[150,300],minLevel:18},
  {name:"Void Titan",      emoji:"🌀",desc:"Born from the rift between worlds.",       str:[75,110],def:[30,50],hp:[400,650],exp:[400,650],gold:[200,400],minLevel:25},
  {name:"Frost Wyrm",      emoji:"🧊",desc:"Ancient ice dragon. Freezes all it touches.",str:[80,120],def:[35,55],hp:[450,700],exp:[450,700],gold:[220,440],minLevel:32},
  {name:"Shadow Demon",    emoji:"😈",desc:"Pure malice given form.",                  str:[90,130],def:[40,60],hp:[500,800],exp:[500,800],gold:[250,500],minLevel:40},
  {name:"Celestial Titan", emoji:"✨",desc:"A god that fell from grace.",              str:[100,150],def:[50,70],hp:[700,1100],exp:[700,1100],gold:[350,700],minLevel:50},
  {name:"Abyssal Horror",  emoji:"🌊",desc:"Something that should not exist.",         str:[120,170],def:[60,85],hp:[900,1400],exp:[900,1400],gold:[450,900],minLevel:60},
  {name:"Chaos Incarnate", emoji:"☄️",desc:"The end. The beginning. Everything.",     str:[150,220],def:[80,110],hp:[1200,2000],exp:[1200,2000],gold:[600,1200],minLevel:75},
].map(m=>({...m,image:`img/monsters/${slug(m.name)}.svg`}));

// ── AVATARS ──────────────────────────────────────────────────
const AVATARS=[
  {id:"av_wolf",     name:"Shadow Wolf",     emoji:"🐺",rarity:"rare",      dropRate:8,  desc:"Runs alone through the dark."},
  {id:"av_knight",   name:"Iron Knight",     emoji:"⚔️",rarity:"rare",      dropRate:8,  desc:"Steel and honour."},
  {id:"av_rogue",    name:"Night Rogue",     emoji:"🗡️",rarity:"rare",      dropRate:8,  desc:"Silent. Deadly. Gone."},
  {id:"av_ranger",   name:"Forest Ranger",   emoji:"🏹",rarity:"rare",      dropRate:7,  desc:"One with the wild."},
  {id:"av_mage",     name:"Storm Mage",      emoji:"🧙",rarity:"rare",      dropRate:7,  desc:"Commands lightning."},
  {id:"av_dragon",   name:"Dragonborn",      emoji:"🐉",rarity:"epic",      dropRate:3,  desc:"Blessed by ancient fire."},
  {id:"av_lich",     name:"Lich Ascendant",  emoji:"💀",rarity:"epic",      dropRate:3,  desc:"Death is just the beginning."},
  {id:"av_phoenix",  name:"Phoenix Risen",   emoji:"🔥",rarity:"epic",      dropRate:3,  desc:"Born from the ashes, again."},
  {id:"av_void",     name:"Void Walker",     emoji:"🌌",rarity:"epic",      dropRate:2,  desc:"Steps between worlds."},
  {id:"av_celestial",name:"Celestial Lord",  emoji:"✨",rarity:"legendary", dropRate:0.5,desc:"Touched by the gods."},
  {id:"av_chaos",    name:"Chaos Herald",    emoji:"🌀",rarity:"legendary", dropRate:0.5,desc:"Order fears this one."},
  {id:"av_champion", name:"Eternal Champion",emoji:"👑",rarity:"legendary", dropRate:0.4,desc:"The last one standing."},
].map(av=>({...av,image:`img/avatars/${av.id}.gif`}));

// ── ITEMS ────────────────────────────────────────────────────
const ITEMS=[
  {name:"Rusty Sword",        type:"Weapon",stat:"str",base:5,  rarity:"common",   emoji:"⚔️",dropRate:20,shopPrice:80},
  {name:"Wooden Club",        type:"Weapon",stat:"str",base:4,  rarity:"common",   emoji:"🪵",dropRate:20,shopPrice:60},
  {name:"Worn Shield",        type:"Shield",stat:"def",base:4,  rarity:"common",   emoji:"🛡️",dropRate:18,shopPrice:70},
  {name:"Leather Cap",        type:"Helmet",stat:"def",base:3,  rarity:"common",   emoji:"🪖",dropRate:18,shopPrice:55},
  {name:"Cloth Robe",         type:"Armour",stat:"def",base:4,  rarity:"common",   emoji:"👘",dropRate:16,shopPrice:65},
  {name:"Simple Boots",       type:"Boots", stat:"def",base:2,  rarity:"common",   emoji:"👟",dropRate:16,shopPrice:45},
  {name:"Copper Amulet",      type:"Amulet",stat:"def",base:2,  rarity:"common",   emoji:"📿",dropRate:14,shopPrice:50},
  {name:"Iron Chestplate",    type:"Armour",stat:"def",base:12, rarity:"uncommon", emoji:"🦺",dropRate:12,shopPrice:350},
  {name:"Silver Blade",       type:"Weapon",stat:"str",base:20, rarity:"uncommon", emoji:"🗡️",dropRate:12,shopPrice:400},
  {name:"Mithril Ring",       type:"Amulet",stat:"def",base:9,  rarity:"uncommon", emoji:"💍",dropRate:10,shopPrice:280},
  {name:"Knight's Shield",    type:"Shield",stat:"def",base:14, rarity:"uncommon", emoji:"🛡️",dropRate:10,shopPrice:320},
  {name:"Chain Greaves",      type:"Greaves",stat:"def",base:8, rarity:"uncommon", emoji:"🦵",dropRate:10,shopPrice:260},
  {name:"Ranger Boots",       type:"Boots", stat:"def",base:7,  rarity:"uncommon", emoji:"👢",dropRate:10,shopPrice:240},
  {name:"Iron Helm",          type:"Helmet",stat:"def",base:10, rarity:"uncommon", emoji:"⛑️",dropRate:10,shopPrice:300},
  {name:"Enchanted Greaves",  type:"Greaves",stat:"def",base:18,rarity:"rare",     emoji:"🦵",dropRate:6},
  {name:"Dragonfang Blade",   type:"Weapon",stat:"str",base:38, rarity:"rare",     emoji:"🔱",dropRate:5},
  {name:"Stormshard Boots",   type:"Boots", stat:"def",base:18, rarity:"rare",     emoji:"👢",dropRate:6},
  {name:"Warden's Helm",      type:"Helmet",stat:"def",base:20, rarity:"rare",     emoji:"🪖",dropRate:5},
  {name:"Soulbind Shield",    type:"Shield",stat:"def",base:25, rarity:"rare",     emoji:"🛡️",dropRate:5},
  {name:"Stormweave Armour",  type:"Armour",stat:"def",base:28, rarity:"rare",     emoji:"🧥",dropRate:5},
  {name:"Runic Amulet",       type:"Amulet",stat:"str",base:15, rarity:"rare",     emoji:"🔮",dropRate:5},
  {name:"Phoenix Armour",     type:"Armour",stat:"def",base:42, rarity:"epic",     emoji:"✨",dropRate:2},
  {name:"Voidcaller Staff",   type:"Weapon",stat:"str",base:55, rarity:"epic",     emoji:"🪄",dropRate:2},
  {name:"Shadow Greaves",     type:"Greaves",stat:"def",base:35,rarity:"epic",     emoji:"🦵",dropRate:2},
  {name:"Void Amulet",        type:"Amulet",stat:"str",base:28, rarity:"epic",     emoji:"💜",dropRate:2},
  {name:"Dreadhelm",          type:"Helmet",stat:"def",base:38, rarity:"epic",     emoji:"😈",dropRate:2},
  {name:"Excalibur",          type:"Weapon",stat:"str",base:80, rarity:"legendary",emoji:"⚡",dropRate:0.3},
  {name:"Crown of the Fallen",type:"Helmet",stat:"def",base:55, rarity:"legendary",emoji:"👑",dropRate:0.3},
  {name:"Aegis of Eternity",  type:"Shield",stat:"def",base:60, rarity:"legendary",emoji:"🌟",dropRate:0.3},
  {name:"Dragonhide Armour",  type:"Armour",stat:"def",base:65, rarity:"legendary",emoji:"🐉",dropRate:0.3},
].map(item=>({...item,image:`img/items/${slug(item.name)}.svg`}));

// ── PETS ─────────────────────────────────────────────────────
const PETS=[
  {name:"Baby Slime",    type:"Pet",stat:"def",base:6,  rarity:"uncommon",emoji:"🟢",dropRate:8, desc:"Wobbly but loyal."},
  {name:"Forest Sprite", type:"Pet",stat:"str",base:7,  rarity:"uncommon",emoji:"🧚",dropRate:7, desc:"Zips around your shoulder."},
  {name:"Tamed Rat",     type:"Pet",stat:"def",base:5,  rarity:"uncommon",emoji:"🐀",dropRate:8, desc:"Surprisingly useful."},
  {name:"Shadow Cat",    type:"Pet",stat:"str",base:14, rarity:"rare",    emoji:"🐈",dropRate:4, desc:"Vanishes in dim light."},
  {name:"Storm Hawk",    type:"Pet",stat:"str",base:16, rarity:"rare",    emoji:"🦅",dropRate:3, desc:"Dives at your enemies."},
  {name:"Crystal Turtle",type:"Pet",stat:"def",base:18, rarity:"rare",    emoji:"🐢",dropRate:3, desc:"A walking shield."},
  {name:"Baby Dragon",   type:"Pet",stat:"str",base:20, rarity:"rare",    emoji:"🐉",dropRate:2, desc:"Breathes tiny flames."},
  {name:"Void Familiar", type:"Pet",stat:"str",base:30, rarity:"epic",    emoji:"👁️",dropRate:1, desc:"Sees through walls."},
  {name:"Lava Pup",      type:"Pet",stat:"str",base:28, rarity:"epic",    emoji:"🔥",dropRate:1, desc:"Always warm. Always angry."},
  {name:"Frost Wolf",    type:"Pet",stat:"def",base:32, rarity:"epic",    emoji:"🐺",dropRate:1, desc:"Howls before every battle."},
  {name:"Ancient Phoenix",type:"Pet",stat:"str",base:50,rarity:"legendary",emoji:"🦅",dropRate:0.2,desc:"Reborn every battle."},
  {name:"Celestial Crab", type:"Pet",stat:"def",base:55,rarity:"legendary",emoji:"🦀",dropRate:0.2,desc:"Claws from another dimension."},
].map(p=>({...p,image:`img/pets/${slug(p.name)}.svg`}));

// ── SHOP CONSUMABLES ─────────────────────────────────────────
const SHOP_CONSUMABLES=[
  {id:"potion_small", name:"Minor Healing Potion",emoji:"🧪",desc:"Restores 30% max HP",    price:120,effect:"heal_small"},
  {id:"potion_big",   name:"Major Healing Potion", emoji:"💊",desc:"Restores 70% max HP",    price:350,effect:"heal_big"},
  {id:"energy_refill",name:"Energy Crystal",       emoji:"⚡",desc:"Refills all energy",     price:200,effect:"energy_full"},
  {id:"exp_scroll",   name:"Tome of Knowledge",    emoji:"📜",desc:"Grants 200 EXP",         price:500,effect:"exp_200"},
];

// ── WALK FLAVOUR TEXT ─────────────────────────────────────────
const WALK_EVENTS=[
  {emoji:"🌿",text:"You walk through the quiet forest."},
  {emoji:"🍃",text:"Leaves rustle overhead. Nothing stirs."},
  {emoji:"🌧️",text:"A light rain begins to fall."},
  {emoji:"☀️",text:"The sun breaks through the canopy."},
  {emoji:"🌫️",text:"Fog rolls in from the valley below."},
  {emoji:"🍂",text:"Autumn leaves crunch under your boots."},
  {emoji:"❄️",text:"Your breath mists in the cold air."},
  {emoji:"🌙",text:"The moon watches from between the trees."},
  {emoji:"🦋",text:"A butterfly lands on your shoulder, then vanishes."},
  {emoji:"😤",text:"You trip on a root. No one saw that. Probably."},
  {emoji:"💀",text:"Bones of something large litter the clearing. Old."},
  {emoji:"👁️",text:"You feel like something is watching. Nothing there."},
  {emoji:"🕯️",text:"A lit candle sits on a stump. Who left it here?"},
  {emoji:"💨",text:"A tumbleweed rolls by. Where did that come from?"},
  {emoji:"📦",text:"An empty chest sits open. Already looted."},
  {emoji:"⚔️",text:"Scorch marks scar the earth. A battle happened here."},
  {emoji:"🏰",text:"Ruins of something old crumble in the distance."},
  {emoji:"🧭",text:"Your compass spins once, then settles. Odd."},
  {emoji:"📯",text:"A distant horn sounds. Maybe a warning."},
  {emoji:"🪨",text:"Ancient stones mark the old road."},
  {emoji:"🌸",text:"Cherry blossoms drift across the path."},
  {emoji:"🎵",text:"You catch yourself humming. Not sure what song."},
  {emoji:"🔥",text:"Smoke rises to the east. Not your problem. Probably."},
];

// ============================================================
//  ENGINE CONSTANTS
// ============================================================
const EQUIP_SLOTS =["Helmet","Armour","Weapon","Shield","Greaves","Boots","Amulet","Pet"];
const SLOT_EMOJI  ={Helmet:"🪖",Armour:"🦺",Weapon:"⚔️",Shield:"🛡️",Greaves:"🦵",Boots:"👢",Amulet:"💍",Pet:"🐾"};
const RARITY_COLOR={common:"#6b7280",uncommon:"#059669",rare:"#2563eb",epic:"#7c3aed",legendary:"#d97706"};
const TIER_EMOJIS =["🪙","🥉","🥈","🥇","💠","💎","👑"];
const GUILD_ROLES ={leader:"Leader",admin:"Admin",member:"Member"};

// ── FIREBASE INIT ─────────────────────────────────────────────
const fbApp=initializeApp(FIREBASE_CONFIG);
const auth =getAuth(fbApp);
const db   =getFirestore(fbApp);
const gp   =new GoogleAuthProvider();

// ── STATE ─────────────────────────────────────────────────────
let CU=null,P=null,TAB="home",CURRENT_AREA=null;
let feed=[],combatState=null,combatInterval=null,energyInterval=null,walkRegenInterval=null;
let _audioUnlocked=false;

// ── MATH ─────────────────────────────────────────────────────
const rand  =(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const pick  =a=>a[Math.floor(Math.random()*a.length)];
const clamp =(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const fmt   =n=>n>=1e6?(n/1e6).toFixed(1)+"M":n>=1000?(n/1000).toFixed(1)+"K":String(Math.floor(n||0));
const expLv =lv=>Math.floor(100*Math.pow(1.5,lv-1));
const maxHpCalc=(lv,def,bonusHp)=>100+lv*10+def*2+(bonusHp||0);

function unlockAudio(){
  if(_audioUnlocked)return;
  _audioUnlocked=true;
  try{const ctx=getAudio();const o=ctx.createOscillator();o.connect(ctx.destination);o.start();o.stop(ctx.currentTime+0.001);}catch(e){}
}
document.addEventListener("touchstart",unlockAudio,{once:true});
document.addEventListener("click",unlockAudio,{once:true});

function bellRoll(base,variance){
  let r=0;for(let i=0;i<6;i++)r+=Math.random();
  r=(r-3)/3;return Math.max(1,Math.round(base+r*variance));
}
function rollItemStat(t){
  const v=t.variance??Math.max(2,Math.round(t.base*0.5));
  return bellRoll(t.base,v);
}
function qualityLabel(val,base){
  const d=val-base;
  if(d>=base*0.5) return{label:"Perfect",color:"#d97706"};
  if(d>=base*0.25)return{label:"Great",  color:"#7c3aed"};
  if(d>=base*0.05)return{label:"Good",   color:"#2563eb"};
  if(d>=-base*0.1)return{label:"Normal", color:"#6b7280"};
  if(d>=-base*0.25)return{label:"Poor",  color:"#9ca3af"};
  return               {label:"Worn",   color:"#d1d5db"};
}
function equipStats(eq){
  let str=0,def=0;
  Object.values(eq||{}).forEach(it=>{if(!it)return;if(it.stat==="str")str+=it.val;else def+=it.val;});
  return{str,def};
}

// ── ENERGY ───────────────────────────────────────────────────
function calcMaxEnergy(){
  if(!P)return CFG.BASE_ENERGY;
  const levelBonus=Math.floor((P.level-1)/5)*CFG.ENERGY_PER_5_LEVELS;
  const homeId=P.homePropertyId||null;
  let housingBonus=0;
  if(homeId){const prop=PROPERTIES.find(p=>p.id===homeId);if(prop)housingBonus=prop.energyBonus;}
  return CFG.BASE_ENERGY+levelBonus+housingBonus;
}

// ── PROPERTY HELPERS ─────────────────────────────────────────
function getOwnedProperties(){return P.properties||[];}
function countOwned(id){return getOwnedProperties().filter(p=>p.id===id).length;}
function propertyPrice(id){
  const prop=PROPERTIES.find(p=>p.id===id);if(!prop)return 0;
  return Math.floor(prop.price*Math.pow(1+CFG.PROPERTY_STACK_FEE,countOwned(id)));
}
function getRentalIncome(){
  const owned=getOwnedProperties(),now=Date.now();let total=0;
  owned.forEach(op=>{
    if(op.instanceId===P.homePropertyInstanceId)return;
    const prop=PROPERTIES.find(p=>p.id===op.id);if(!prop)return;
    const lastClaim=op.lastRentClaim||op.purchasedAt||now;
    total+=Math.floor(prop.price*prop.rentalRate*((now-lastClaim)/(1000*60*60*24)));
  });
  return total;
}
function claimRent(){
  const income=getRentalIncome();
  if(income<=0){toast("🏠 No rental income yet!");return;}
  const now=Date.now();
  (P.properties||[]).forEach(op=>{if(op.instanceId!==P.homePropertyInstanceId)op.lastRentClaim=now;});
  P.gold=(P.gold||0)+income;saveP();
  SFX.gold();toast(`🏠 Collected 🪙${fmt(income)} in rent!`);
  if(TAB==="properties")renderProperties();
  if(TAB==="home")renderHome();
}

// ── AVATAR HELPERS ────────────────────────────────────────────
function getActiveAvatar(){const id=P.activeAvatar;if(!id)return null;return AVATARS.find(a=>a.id===id)||null;}
function avatarGfx(size=32){
  const av=getActiveAvatar();
  if(av&&av.image)return`<img src="${av.image}" alt="" style="width:${size}px;height:${size}px;object-fit:contain;border-radius:4px" onerror="this.outerHTML='${av.emoji}'">`;
  if(av)return`<span style="font-size:${Math.round(size*0.75)}px">${av.emoji}</span>`;
  if(PLAYER_AVATAR.image)return`<img src="${PLAYER_AVATAR.image}" alt="" style="width:${size}px;height:${size}px;object-fit:contain" onerror="this.outerHTML='${PLAYER_AVATAR.emoji}'">`;
  return`<span style="font-size:${Math.round(size*0.75)}px">${PLAYER_AVATAR.emoji}</span>`;
}
function avatarGfxFor(plyr,size=24){
  const id=plyr.activeAvatar,av=id?AVATARS.find(a=>a.id===id):null;
  if(av&&av.image)return`<img src="${av.image}" alt="" style="width:${size}px;height:${size}px;object-fit:contain;border-radius:3px" onerror="this.outerHTML='${av.emoji}'">`;
  if(av)return`<span style="font-size:${Math.round(size*0.7)}px">${av.emoji}</span>`;
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
  const av=rollAvatar(),collected=P.avatars||[];
  if(collected.includes(av.id)){
    const bonus=rand(50,200);P.gold=(P.gold||0)+bonus;
    SFX.gold();toast(`✨ Duplicate avatar → 🪙${bonus} gold!`);saveP();return;
  }
  P.avatars=[...collected,av.id];saveP();openAvatarDropModal(av);
}
function openAvatarDropModal(av){
  const color=RARITY_COLOR[av.rarity]||"#6b7280";
  const imgHtml=av.image?`<img src="${av.image}" alt="" style="width:80px;height:80px;object-fit:contain;border-radius:8px">`:`<span style="font-size:3.5rem">${av.emoji}</span>`;
  SFX.chest();
  showModal(`<div style="text-align:center">
    <div style="font-size:0.72rem;color:var(--gold3);font-family:'Cinzel',serif;text-transform:uppercase;margin-bottom:0.5rem">✨ Avatar Unlocked!</div>
    <div style="width:80px;height:80px;margin:0 auto 0.5rem;display:flex;align-items:center;justify-content:center">${imgHtml}</div>
    <div style="font-family:'Cinzel',serif;font-size:1.05rem;color:${color};font-weight:700;margin-bottom:0.2rem">${av.name}</div>
    <div style="font-size:0.7rem;color:${color};text-transform:uppercase;font-weight:700;margin-bottom:0.5rem">${av.rarity}</div>
    <div style="font-size:0.82rem;color:var(--text3);font-style:italic;margin-bottom:1rem">"${av.desc}"</div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-gold" onclick="G.equipAvatar('${av.id}')">Equip This Avatar</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Save for Later</button>
    </div>`);
}
function equipAvatar(id){P.activeAvatar=id;saveP();updateHdr();closeModal();SFX.equip();toast("✨ Avatar equipped!");if(TAB==="you")renderYou();}
function openAvatarCollection(){
  const collected=P.avatars||[];
  if(collected.length===0){
    showModal(`<div class="modal-title">🎭 Avatars</div>
      <div style="text-align:center;color:var(--text3);padding:1.5rem;font-style:italic">No avatars yet!</div>
      <button class="btn btn-ghost" onclick="G.closeModal()">Close</button>`);return;
  }
  const rows=AVATARS.filter(a=>collected.includes(a.id)).map(av=>{
    const color=RARITY_COLOR[av.rarity],isActive=P.activeAvatar===av.id;
    const imgHtml=av.image?`<img src="${av.image}" alt="" style="width:44px;height:44px;object-fit:contain;border-radius:6px">`:`<span style="font-size:2rem">${av.emoji}</span>`;
    return`<div style="display:flex;align-items:center;gap:0.75rem;padding:0.65rem 0;border-bottom:1px solid var(--border)">
      <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${imgHtml}</div>
      <div style="flex:1;min-width:0">
        <div style="font-family:'Cinzel',serif;font-size:0.82rem;color:${color};font-weight:700">${av.name}</div>
        <div style="font-size:0.68rem;color:var(--text3)">${av.rarity} · "${av.desc}"</div>
      </div>
      ${isActive?`<span style="font-size:0.7rem;color:var(--green2);font-family:'Cinzel',serif;font-weight:700">Active ✓</span>`:`<button class="btn btn-gold btn-sm" onclick="G.equipAvatar('${av.id}')">Equip</button>`}
    </div>`;
  }).join("");
  showModal(`<div class="modal-title">🎭 Avatars (${collected.length}/${AVATARS.length})</div>
    <div style="max-height:60vh;overflow-y:auto;margin-bottom:0.75rem">${rows}</div>
    <button class="btn btn-ghost" onclick="G.closeModal()">Close</button>`);
}

function arenaT(wins){let t=0;for(let i=ARENA_TIERS.length-1;i>=0;i--){if((wins||0)>=ARENA_TIERS[i].wins){t=i;break;}}return t;}

// ── DAILY QUESTS ─────────────────────────────────────────────
function buildDailyQuests(seed){
  const s=(n)=>{let x=Math.sin(seed+n)*10000;return x-Math.floor(x);};
  return[
    {id:"q_kill", icon:"⚔️",name:"Monster Hunter",desc:`Kill ${Math.floor(s(1)*8)+3} monsters`,target:Math.floor(s(1)*8)+3,type:"kills",progress:0,reward:{exp:150,gold:100}},
    {id:"q_steps",icon:"👣",name:"World Walker",  desc:`Take ${Math.floor(s(2)*20)+10} steps`,  target:Math.floor(s(2)*20)+10,type:"steps",progress:0,reward:{exp:100,gold:80}},
    {id:"q_items",icon:"🎁",name:"Fortune Seeker",desc:`Find ${Math.floor(s(3)*4)+2} items`,    target:Math.floor(s(3)*4)+2, type:"items",progress:0,reward:{exp:120,gold:90}},
  ];
}
function questSeed(){const d=new Date();return d.getUTCFullYear()*10000+d.getUTCMonth()*100+d.getUTCDate();}
function getQuests(){const seed=questSeed();if(!P.quests||P.quests.seed!==seed){P.quests={seed,list:buildDailyQuests(seed)};}return P.quests.list;}
function updateQuestProgress(type,amount=1){
  if(!P.quests)return;let changed=false;
  P.quests.list.forEach(q=>{
    if(q.type===type&&q.progress<q.target){
      q.progress=Math.min(q.target,q.progress+amount);
      if(q.progress>=q.target&&!q.claimed)toast(`📜 Quest complete: ${q.name}!`);
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
    steps:0,npcKills:0,pvpKills:0,pvpLosses:0,arenaWins:0,arenaLosses:0,
    inventory:[],equipped:{},quests:null,
    properties:[],homePropertyId:null,homePropertyInstanceId:null,
    avatars:[],activeAvatar:null,
    guildId:null,
    pvpAttackLog:{},
    notifications:[],
    createdAt:Date.now()};
}

// ── FIREBASE HELPERS ──────────────────────────────────────────
async function loadP(uid){const s=await getDoc(doc(db,"players",uid));return s.exists()?s.data():null;}
async function saveP(){if(!CU||!P)return;await setDoc(doc(db,"players",CU.uid),P);}
async function loadLeaderboard(){const s=await getDocs(collection(db,"players"));return s.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p&&p.username);}
async function getListings(){const s=await getDocs(collection(db,"market"));return s.docs.map(d=>({id:d.id,...d.data()}));}
async function addListing(item,price){await addDoc(collection(db,"market"),{sellerId:CU.uid,sellerName:P.username,item,price,listedAt:Date.now()});}
async function removeListing(id){await deleteDoc(doc(db,"market",id));}
async function getBounties(){const s=await getDocs(collection(db,"bounties"));return s.docs.map(d=>({id:d.id,...d.data()}));}
async function getGuild(id){if(!id)return null;const s=await getDoc(doc(db,"guilds",id));return s.exists()?{id:s.id,...s.data()}:null;}

// ── MODAL HELPER ─────────────────────────────────────────────
function showModal(html){
  document.getElementById("modal-content").innerHTML=html;
  const ov=document.getElementById("modal-overlay");
  ov.style.display="flex";ov.style.pointerEvents="auto";
}

// ── TOAST ─────────────────────────────────────────────────────
function toast(msg,color=""){
  const el=document.createElement("div");
  el.className="toast";el.textContent=msg;
  if(color)el.style.borderColor=color;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(()=>{el.classList.add("dying");setTimeout(()=>el.remove(),300);},2800);
}

// ── SPAWN HELPERS ─────────────────────────────────────────────
function spawnItemFromPool(pool){
  const total=pool.reduce((s,i)=>s+(i.dropRate||10),0);
  let r=Math.random()*total;
  for(const t of pool){r-=(t.dropRate||10);if(r<=0){const val=rollItemStat(t);return{...t,val,base:t.base,id:`item_${Date.now()}_${rand(0,9999)}`};}}
  const t=pool[0];return{...t,val:rollItemStat(t),base:t.base,id:`item_${Date.now()}`};
}
function spawnMonster(area){
  const bonusLevel=area?area.monsterLevelBonus:0;
  const effectiveLevel=P.level+bonusLevel;
  const eligible=MONSTERS.filter(m=>effectiveLevel>=(m.minLevel||0));
  const base=pick(eligible.length?eligible:MONSTERS);
  return{...base,str:rand(...base.str),def:rand(...base.def),
    hp:rand(...base.hp),maxHp:base.hp[1],
    expReward:Math.round(rand(...base.exp)*(area?area.expMult:1)),
    goldReward:Math.round(rand(...base.gold)*(area?area.goldMult:1))};
}

// ── COMBAT SIMULATION (used for PvP + bounties) ───────────────
function simulateFight(attacker,defender){
  // Returns {winner:"attacker"|"defender", log:[...]}
  let aHp=attacker.maxHp, dHp=defender.maxHp;
  const log=[];let round=0;
  while(aHp>0&&dHp>0&&round<50){
    round++;
    // Attacker hits
    let aDmg=Math.max(1,attacker.str-defender.def+rand(-3,6));
    const aCrit=Math.random()<0.12;if(aCrit)aDmg=Math.floor(aDmg*1.75);
    dHp=Math.max(0,dHp-aDmg);
    log.push(aCrit?`<span class="log-crit">⚡ CRIT! ${attacker.name} hits ${defender.name} for ${aDmg}!</span>`
      :`<span class="log-you">${attacker.name} hits ${defender.name} for ${aDmg}</span>`);
    if(dHp<=0)break;
    // Defender hits back
    let dDmg=Math.max(1,defender.str-attacker.def+rand(-3,6));
    const dCrit=Math.random()<0.08;if(dCrit)dDmg=Math.floor(dDmg*1.75);
    aHp=Math.max(0,aHp-dDmg);
    log.push(dCrit?`<span class="log-crit">💥 CRIT! ${defender.name} hits ${attacker.name} for ${dDmg}!</span>`
      :`<span class="log-hit">${defender.name} hits ${attacker.name} for ${dDmg}</span>`);
  }
  const winner=dHp<=0?"attacker":"defender";
  log.push(winner==="attacker"
    ?`<span class="log-win">🏆 ${attacker.name} wins!</span>`
    :`<span class="log-lose">💀 ${defender.name} wins!</span>`);
  return{winner,log,attackerHpLeft:aHp,defenderHpLeft:dHp};
}

// END OF PART 1

// ============================================================
//  MicroMMO — game.js  (v4)
//  PART 2 of 3 — Auth, Game Loop, Walk, Home, Gear, PvP, Bounties, Guilds
// ============================================================

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
  hideErr();if(!email||!pw){showErr("Please fill all fields");return;}
  try{
    if(isLogin)await signInWithEmailAndPassword(auth,email,pw);
    else{
      const un=document.getElementById("reg-username").value.trim();
      if(!un){showErr("Hero name required");return;}
      const c=await createUserWithEmailAndPassword(auth,email,pw);
      P=newPlayer(un);await setDoc(doc(db,"players",c.user.uid),P);startGame();
    }
  }catch(e){showErr(e.message||"Auth failed");}
}
async function handleGoogleAuth(){
  try{const c=await signInWithPopup(auth,gp);const ex=await loadP(c.user.uid);
    if(!ex)showScreen("username-screen");else{P=ex;startGame();}}
  catch(e){showErr("Google sign-in failed");}
}
async function handleSetUsername(){
  const n=document.getElementById("new-username").value.trim();
  if(!n||!CU)return;P=newPlayer(n);
  await setDoc(doc(db,"players",CU.uid),P);startGame();
}
function showScreen(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ── GAME START ────────────────────────────────────────────────
function startGame(){
  if(P.statPoints===undefined)P.statPoints=0;
  if(P.bonusHp===undefined)P.bonusHp=0;
  if(P.properties===undefined)P.properties=[];
  if(P.homePropertyId===undefined)P.homePropertyId=null;
  if(P.homePropertyInstanceId===undefined)P.homePropertyInstanceId=null;
  if(P.guildId===undefined)P.guildId=null;
  if(P.pvpAttackLog===undefined)P.pvpAttackLog={};
  if(P.notifications===undefined)P.notifications=[];
  const _maxE=calcMaxEnergy();
  P.energy=clamp(P.energy,0,_maxE);
  showScreen("game-screen");
  updateHdr();regenCheck();
  energyInterval=setInterval(regenCheck,15000);
  if(P.activeCombat&&!combatState)combatState={...P.activeCombat,done:false};
  // Show pending notifications
  if(P.notifications&&P.notifications.length>0){
    setTimeout(()=>{
      P.notifications.forEach(n=>toast(n,"#f59e0b"));
      P.notifications=[];saveP();
    },1500);
  }
  showTab("home");
}
function regenCheck(){
  if(!P)return;const maxE=calcMaxEnergy();
  if(P.energy>=maxE)return;
  const pts=Math.floor((Date.now()-(P.lastEnergyTime||Date.now()))/CFG.ENERGY_REGEN_MS);
  if(pts>0){P.energy=clamp(P.energy+pts,0,maxE);P.lastEnergyTime=Date.now();saveP();
    if(TAB==="home")renderHome();updateHdr();updateWalkUI();}
}
function updateHdr(){
  const btn=document.getElementById("nav-walk");
  if(btn){btn.classList.toggle("no-energy",!P||P.energy<1);
    btn.innerHTML=UI.WALK_BTN.image?`<img src="${UI.WALK_BTN.image}" alt="">`:UI.WALK_BTN.emoji;}
  const ha=document.getElementById("hdr-avatar-el");if(ha)ha.innerHTML=avatarGfx(30);
  const hh=document.getElementById("hdr-hp");if(hh)hh.textContent=`❤️ ${P?P.hp:0}`;
  const hl=document.getElementById("hdr-level");if(hl)hl.textContent=`Lv.${P?P.level:1}`;
  // Update logo if image set
  const logo=document.getElementById("hdr-logo-el");
  if(logo){
    if(UI.LOGO.image)logo.innerHTML=`<img src="${UI.LOGO.image}" alt="MicroMMO" style="height:32px;object-fit:contain" onerror="this.outerHTML='⚔ MicroMMO'">`;
  }
}

// ── TAB ROUTING ───────────────────────────────────────────────
function showTab(tab){
  TAB=tab;
  const walkEl=document.getElementById("walk-screen");
  if(tab==="walk"){
    walkEl.classList.add("active");
    updateWalkUI();startWalkRegenTimer();renderWalkFeed();return;
  }
  walkEl.classList.remove("active");
  if(walkRegenInterval){clearInterval(walkRegenInterval);walkRegenInterval=null;}
  ["home","gear","market","social","pvp"].forEach(t=>{
    const b=document.getElementById("nav-"+t);if(b)b.classList.remove("active");
  });
  const a=document.getElementById("nav-"+tab);if(a)a.classList.add("active");
  SFX.click();
  if(tab==="home")       renderHome();
  else if(tab==="gear")  renderGear();
  else if(tab==="market")renderMarket();
  else if(tab==="social")renderSocial();
  else if(tab==="you")   renderYou();
  else if(tab==="quests")renderQuests();
  else if(tab==="pvp")   renderPvP();
  else if(tab==="bank")  renderBank();
  else if(tab==="properties")renderProperties();
  else if(tab==="guild") renderGuild();
}
function hideWalk(){
  document.getElementById("walk-screen").classList.remove("active");
  if(walkRegenInterval){clearInterval(walkRegenInterval);walkRegenInterval=null;}
  TAB="home";
  document.getElementById("nav-home").classList.add("active");
  renderHome();
}

// ── WALK SCREEN ───────────────────────────────────────────────
function updateWalkUI(){
  const maxE=calcMaxEnergy();
  const epText=document.getElementById("walk-ep-text");
  const epBar=document.getElementById("walk-ep-bar");
  const stepBtn=document.getElementById("walk-step-btn");
  const areaDisplay=document.getElementById("walk-area-display");
  const wa=document.getElementById("walk-avatar-el");
  if(epText)epText.textContent=`${P.energy}/${maxE}`;
  if(epBar)epBar.style.width=`${Math.round((P.energy/maxE)*100)}%`;
  if(stepBtn)stepBtn.classList.toggle("no-energy",P.energy<1);
  if(wa)wa.innerHTML=avatarGfx(30);
  if(areaDisplay){
    if(CURRENT_AREA){areaDisplay.innerHTML=`${CURRENT_AREA.emoji} <strong>${CURRENT_AREA.name}</strong>`;areaDisplay.classList.add("selected");}
    else{areaDisplay.textContent="🌍 Choose Area";areaDisplay.classList.remove("selected");}
  }
  // Zone background
  const zoneEl=document.getElementById("walk-zone-bg");
  if(zoneEl&&CURRENT_AREA){
    zoneEl.style.cssText=CURRENT_AREA.bgCSS;
    zoneEl.className=`walk-zone-bg particles-${CURRENT_AREA.particles}`;
  } else if(zoneEl){
    zoneEl.style.cssText="background:#1a1a2a;";
    zoneEl.className="walk-zone-bg";
  }
  // Resume banner
  const resumeBanner=document.getElementById("walk-resume-banner");
  const enemyName=document.getElementById("walk-enemy-name");
  if(resumeBanner){
    const hasCombat=(combatState&&!combatState.done)||P.activeCombat;
    resumeBanner.style.display=hasCombat?"flex":"none";
    if(hasCombat&&enemyName)enemyName.textContent=`vs ${(combatState?.monster||P.activeCombat?.monster)?.name||"Unknown"}`;
  }
}
function startWalkRegenTimer(){
  if(walkRegenInterval)clearInterval(walkRegenInterval);
  walkRegenInterval=setInterval(()=>{
    const maxE=calcMaxEnergy(),label=document.getElementById("walk-regen-label");
    if(!label)return;
    if(P.energy>=maxE){label.textContent="Full ⚡";return;}
    const elapsed=Date.now()-(P.lastEnergyTime||Date.now());
    const tl=Math.max(0,CFG.ENERGY_REGEN_MS-(elapsed%CFG.ENERGY_REGEN_MS));
    label.textContent=`${Math.floor(tl/60000)}:${String(Math.floor((tl%60000)/1000)).padStart(2,"0")}`;
    updateWalkUI();
  },1000);
}
function openAreaSelect(){
  SFX.click();
  const unlocked=WALK_AREAS.filter(a=>P.level>=a.minLevel);
  const locked=WALK_AREAS.filter(a=>P.level<a.minLevel);
  const cards=unlocked.map(area=>{
    const isActive=CURRENT_AREA&&CURRENT_AREA.id===area.id;
    return`<div class="area-card ${isActive?"selected":""}" onclick="G.selectArea('${area.id}')">
      <div style="display:flex;align-items:center;gap:0.75rem">
        <div style="font-size:2rem;flex-shrink:0">${area.emoji}</div>
        <div style="flex:1">
          <div style="font-family:'Cinzel',serif;font-size:0.9rem;font-weight:700;color:${isActive?"var(--gold3)":"var(--text)"}">${area.name}</div>
          <div style="font-size:0.75rem;color:var(--text3)">${area.desc}</div>
          <div style="display:flex;gap:0.5rem;margin-top:0.3rem;flex-wrap:wrap">
            <span style="font-size:0.65rem;color:var(--green2);font-weight:600">+${Math.round((area.expMult-1)*100)}% EXP</span>
            <span style="font-size:0.65rem;color:var(--gold3);font-weight:600">+${Math.round((area.goldMult-1)*100)}% Gold</span>
            ${area.lootBonus>0?`<span style="font-size:0.65rem;color:var(--steel);font-weight:600">+${Math.round(area.lootBonus*100)}% Loot</span>`:""}
          </div>
        </div>
        ${isActive?`<span style="font-family:'Cinzel',serif;font-size:0.72rem;color:var(--gold3);font-weight:700">✓</span>`:""}
      </div>
    </div>`;
  }).join("");
  const lockedCards=locked.map(a=>`
    <div class="area-card locked">
      <div style="display:flex;align-items:center;gap:0.75rem">
        <div style="font-size:2rem">🔒</div>
        <div><div style="font-family:'Cinzel',serif;font-size:0.9rem">${a.name}</div>
          <div style="font-size:0.75rem;color:var(--text3)">Unlocks at Level ${a.minLevel}</div>
        </div>
      </div>
    </div>`).join("");
  showModal(`<div class="modal-title">🗺️ Choose Your Area</div>${cards}${lockedCards}
    <button class="btn btn-ghost" style="margin-top:0.5rem" onclick="G.closeModal()">Close</button>`);
}
function selectArea(id){
  CURRENT_AREA=WALK_AREAS.find(a=>a.id===id)||null;
  closeModal();updateWalkUI();SFX.click();
}
function renderWalkFeed(){
  const feedEl=document.getElementById("walk-feed");if(!feedEl)return;
  if(feed.length===0){
    feedEl.innerHTML=`<div style="text-align:center;padding:2rem;color:rgba(255,255,255,0.5);font-style:italic;font-size:0.9rem">Choose an area and step into adventure...</div>`;
    return;
  }
  feedEl.innerHTML=feed.map(f=>`<div class="walk-feed-item">
    <div class="feed-icon">${f.image?`<img src="${f.image}" alt="" style="width:28px;height:28px;object-fit:contain">`:(f.emoji||"🌿")}</div>
    <div class="feed-text">${f.text}</div>
    <div class="feed-badge-dark" style="color:${f.color}">${f.badge}</div>
  </div>`).join("");
  feedEl.scrollTop=0;
}
function addFeed(emoji,image,text,badge,color){feed.unshift({emoji,image,text,badge,color});if(feed.length>25)feed.pop();}

// ── STEP ─────────────────────────────────────────────────────
function takeStep(){
  unlockAudio();
  if(!P||P.energy<1){SFX.error();toast("⚡ No energy! Wait for regen.");return;}
  if(combatState&&!combatState.done){SFX.error();toast("⚔️ Finish your current battle first!");return;}
  if(!CURRENT_AREA){SFX.click();toast("Select an area first!");openAreaSelect();return;}
  SFX.step();
  P.energy--;P.steps=(P.steps||0)+1;
  if(P.energy<calcMaxEnergy()&&!P.lastEnergyTime)P.lastEnergyTime=Date.now();
  updateHdr();updateWalkUI();updateQuestProgress("steps");
  const area=CURRENT_AREA,totalItemChance=CFG.ITEM_CHANCE+(area.lootBonus||0);
  const roll=Math.random();
  if(roll<CFG.MONSTER_CHANCE){
    const m=spawnMonster(area);
    addFeed(m.emoji,m.image,`Encountered <strong>${m.name}</strong> in ${area.name}!`,"Fight!","#f87171");
    saveP();renderWalkFeed();setTimeout(()=>openCombatModal(m),350);
  }else if(roll<CFG.MONSTER_CHANCE+CFG.GOLD_CHANCE){
    const g=Math.round(rand(5,25+P.level*2)*area.goldMult);P.gold=(P.gold||0)+g;
    SFX.gold();addFeed("🪙","",`Found gold in ${area.name}!`,`+${g} 🪙`,"#fbbf24");
    saveP();renderWalkFeed();
  }else if(roll<CFG.MONSTER_CHANCE+CFG.GOLD_CHANCE+totalItemChance){
    const item=spawnItemFromPool([...ITEMS,...PETS]);
    P.inventory=[...(P.inventory||[]),item];P.itemsFound=(P.itemsFound||0)+1;
    const q=qualityLabel(item.val,item.base||item.val);
    SFX.itemFound();
    addFeed(item.emoji,item.image,`Found <strong>${item.name}</strong>! <span style="color:${q.color};font-weight:700">${q.label}</span>`,item.rarity,RARITY_COLOR[item.rarity]);
    toast(`${item.emoji} Found ${item.name} (+${item.val}) — ${q.label}!`);
    updateQuestProgress("items");tryAvatarDrop();saveP();renderWalkFeed();
  }else if(roll<CFG.MONSTER_CHANCE+CFG.GOLD_CHANCE+totalItemChance+CFG.CHOICE_EVENT_CHANCE){
    const evt=pick(CHOICE_EVENTS);saveP();renderWalkFeed();openChoiceEventModal(evt);
  }else{
    const w=pick(WALK_EVENTS);
    addFeed(w.emoji,"",w.text,"Nothing","rgba(255,255,255,0.4)");
    saveP();renderWalkFeed();
  }
}

// ── CHOICE EVENTS ─────────────────────────────────────────────
function openChoiceEventModal(evt){
  const choicesHtml=evt.choices.map((c,i)=>
    `<button class="btn btn-ghost" style="margin-bottom:0.4rem" onclick="G.resolveChoice('${evt.id}',${i})">${c.label}</button>`).join("");
  showModal(`<div style="text-align:center;font-size:3rem;margin-bottom:0.4rem">${evt.emoji}</div>
    <div class="modal-title">${evt.title}</div>
    <div style="text-align:center;color:var(--text3);font-size:0.88rem;margin-bottom:1.2rem">${evt.desc}</div>
    <div class="modal-actions">${choicesHtml}</div>`);
}
function resolveChoice(evtId,choiceIdx){
  const evt=CHOICE_EVENTS.find(e=>e.id===evtId);if(!evt)return;
  const choice=evt.choices[choiceIdx],result=choice.outcome(P);
  const msg=typeof result.msg==="function"?result.msg():result.msg;
  const goldDelta=typeof result.gold==="function"?result.gold():result.gold||0;
  const hpDelta=typeof result.hp==="function"?result.hp():result.hp||0;
  if(goldDelta!==0){P.gold=Math.max(0,(P.gold||0)+goldDelta);goldDelta>0?SFX.gold():SFX.error();toast(goldDelta>0?`🪙 +${goldDelta} gold!`:`🪙 Lost ${Math.abs(goldDelta)} gold!`);}
  if(hpDelta!==0){P.hp=clamp((P.hp||0)+hpDelta,1,P.maxHp);toast(hpDelta>0?`❤️ +${Math.abs(hpDelta)} HP!`:`💔 -${Math.abs(hpDelta)} HP!`);}
  saveP();updateHdr();addFeed(evt.emoji,"",msg,choice.label,"rgba(255,255,255,0.5)");
  showModal(`<div style="text-align:center;font-size:3rem;margin-bottom:0.4rem">${evt.emoji}</div>
    <div class="modal-title">${evt.title}</div>
    <div style="text-align:center;color:var(--text2);font-size:0.92rem;margin:1rem 0;line-height:1.5">${msg}</div>
    ${goldDelta!==0?`<div style="text-align:center;color:${goldDelta>0?"var(--gold3)":"var(--crimson2)"};font-family:'Cinzel',serif;font-weight:700;margin-bottom:0.5rem">${goldDelta>0?"🪙 +"+goldDelta:"🪙 −"+Math.abs(goldDelta)}</div>`:""}
    ${hpDelta!==0?`<div style="text-align:center;color:${hpDelta>0?"var(--green2)":"var(--crimson2)"};font-family:'Cinzel',serif;font-weight:700;margin-bottom:0.5rem">${hpDelta>0?"❤️ +"+Math.abs(hpDelta)+" HP":"💔 −"+Math.abs(hpDelta)+" HP"}</div>`:""}
    <button class="btn btn-ghost" onclick="G.closeModal()" style="margin-top:0.5rem">Continue</button>`);
}

// ── HOME ─────────────────────────────────────────────────────
function renderHome(){
  if(!P)return;
  const maxE=calcMaxEnergy();
  const{str:eStr,def:eDef}=equipStats(P.equipped);
  const tStr=(P.baseStr||10)+eStr,tDef=(P.baseDef||5)+eDef;
  const expNeed=expLv(P.level);
  const hpPct=clamp(Math.round((P.hp/P.maxHp)*100),0,100);
  const expPct=clamp(Math.round((P.exp/expNeed)*100),0,100);
  const enPct=Math.round((P.energy/maxE)*100);
  const elapsed=Date.now()-(P.lastEnergyTime||Date.now());
  const tl=Math.max(0,CFG.ENERGY_REGEN_MS-(elapsed%CFG.ENERGY_REGEN_MS));
  const timerStr=P.energy>=maxE?"Full":`${Math.floor(tl/60000)}:${String(Math.floor((tl%60000)/1000)).padStart(2,"0")}`;
  const qs=getQuests(),qDone=qs.filter(q=>q.progress>=q.target).length;
  const tierIdx=arenaT(P.arenaWins||0),tier=ARENA_TIERS[tierIdx];
  const rentalPending=getRentalIncome();
  const homeProp=P.homePropertyId?PROPERTIES.find(p=>p.id===P.homePropertyId):null;
  const spBadge=P.statPoints>0?`<span style="background:var(--crimson2);color:white;border-radius:10px;font-size:0.62rem;padding:1px 6px;margin-left:0.4rem;font-weight:700">${P.statPoints}</span>`:"";
  updateHdr();
  document.getElementById("content").innerHTML=`
    <div class="player-banner">
      <div class="p-avatar">${avatarGfx(58)}</div>
      <div class="p-info">
        <div class="p-name">${P.username}${spBadge}</div>
        <div class="p-class">Level ${P.level} · <span style="color:${tier.color};font-weight:700">${tier.name}</span>${P.guildId?` · <span style="color:var(--purple2)">🛡️ Guild</span>`:""}</div>
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
    <div style="background:#fffbeb;border:1.5px solid #fcd34d;border-radius:12px;padding:0.85rem;margin-bottom:0.7rem;display:flex;align-items:center;gap:0.75rem">
      <div style="font-size:1.5rem">⬆️</div>
      <div style="flex:1"><div style="font-family:'Cinzel',serif;font-size:0.82rem;color:var(--gold3);font-weight:700">${P.statPoints} Stat Point${P.statPoints>1?"s":""} Available!</div></div>
      <button class="btn btn-gold btn-sm" onclick="G.openStatModal()">Spend</button>
    </div>`:""}
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
    <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:0.85rem;margin-bottom:0.7rem;display:flex;align-items:center;gap:0.75rem">
      <div style="font-size:1.5rem">🏠</div>
      <div style="flex:1"><div style="font-family:'Cinzel',serif;font-size:0.82rem;color:var(--green);font-weight:700">Rental Income Ready!</div>
        <div style="font-size:0.75rem;color:var(--text3)">🪙${fmt(rentalPending)}</div></div>
      <button class="btn btn-green btn-sm" onclick="G.claimRent()">Collect</button>
    </div>`:""}
    <div class="two-col" style="margin-bottom:0.5rem">
      <button class="btn btn-steel btn-sm" style="width:100%;padding:0.7rem" onclick="G.showTab('quests')">📜 Quests <span style="color:${qDone===3?"var(--green2)":"var(--gold2)"}">${qDone}/3</span></button>
      <button class="btn btn-purple btn-sm" style="width:100%;padding:0.7rem" onclick="G.showTab('pvp')">⚔️ PvP & Bounties</button>
    </div>
    <div class="two-col" style="margin-bottom:0.5rem">
      <button class="btn btn-gold btn-sm" style="width:100%;padding:0.7rem" onclick="G.showTab('properties')">🏠 Properties</button>
      <button class="btn btn-ghost btn-sm" style="width:100%;padding:0.7rem" onclick="G.showTab('guild')">🛡️ Guild</button>
    </div>
    <div class="two-col">
      <button class="btn btn-ghost btn-sm" style="width:100%;padding:0.7rem" onclick="G.showTab('you')">👤 Profile</button>
      <button class="btn btn-ghost btn-sm" style="width:100%;padding:0.7rem" onclick="G.showTab('social')">👥 Social</button>
    </div>`;
}

// ── STAT POINTS ───────────────────────────────────────────────
function openStatModal(){
  if(!P.statPoints||P.statPoints<1){toast("No stat points available!");return;}
  showModal(`<div class="modal-title">⬆️ Spend Stat Points</div>
    <div style="text-align:center;color:var(--text3);font-size:0.85rem;margin-bottom:1rem">
      You have <strong style="color:var(--gold3)">${P.statPoints}</strong> point${P.statPoints>1?"s":""} to spend.
    </div>
    <div class="modal-row"><em>⚔️ Strength</em><strong style="color:var(--crimson2)">${P.baseStr}</strong></div>
    <div class="modal-row"><em>🛡️ Defence</em><strong style="color:var(--steel)">${P.baseDef}</strong></div>
    <div class="modal-row"><em>❤️ Max HP</em><strong style="color:var(--crimson)">${P.maxHp}</strong></div>
    <div style="margin-top:1rem;display:flex;flex-direction:column;gap:0.5rem">
      <button class="btn btn-danger" onclick="G.spendStat('str')">+1 Strength</button>
      <button class="btn btn-steel" onclick="G.spendStat('def')">+1 Defence</button>
      <button class="btn btn-ghost" onclick="G.spendStat('hp')">+10 Max HP</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Close</button>
    </div>`);
}
function spendStat(stat){
  if(!P.statPoints||P.statPoints<1){toast("No stat points!");return;}
  P.statPoints--;SFX.equip();
  if(stat==="str"){P.baseStr=(P.baseStr||10)+1;toast("⚔️ +1 Strength!");}
  else if(stat==="def"){P.baseDef=(P.baseDef||5)+1;const{def:eDef}=equipStats(P.equipped);P.maxHp=maxHpCalc(P.level,P.baseDef+eDef,P.bonusHp||0);toast("🛡️ +1 Defence!");}
  else if(stat==="hp"){P.bonusHp=(P.bonusHp||0)+10;const{def:eDef}=equipStats(P.equipped);P.maxHp=maxHpCalc(P.level,(P.baseDef||5)+eDef,P.bonusHp);toast("❤️ +10 Max HP!");}
  saveP();
  if(P.statPoints>0)openStatModal();else{closeModal();renderHome();}
}

// ── GEAR ─────────────────────────────────────────────────────
function renderGear(){
  const inv=P.inventory||[],eq=P.equipped||{};
  const slotsHtml=EQUIP_SLOTS.map(slot=>{
    const item=eq[slot],iconHtml=item?gfx(item.image,item.emoji,26):SLOT_EMOJI[slot];
    return`<div class="equip-slot ${item?"filled":""}" ${item?`onclick="G.openItemModal('equipped','${slot}')"`:""}> 
      <div class="es-icon">${iconHtml}</div>
      <div class="es-info">${item
        ?`<div class="es-name" style="color:${RARITY_COLOR[item.rarity]}">${item.name}</div><div class="es-stat">+${item.val} ${item.stat==="str"?"STR":"DEF"}</div>`
        :`<div class="es-empty">Empty</div>`}
      </div>
      <div class="es-type">${slot}</div>
    </div>`;
  }).join("");
  const invHtml=inv.length===0?`<div class="inv-empty">No items yet — go explore!</div>`:
    inv.map((item,i)=>{
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

// ── PvP & BOUNTIES ────────────────────────────────────────────
async function renderPvP(){
  document.getElementById("content").innerHTML=`<div class="card"><div style="text-align:center;color:var(--text3);padding:1rem">Loading...</div></div>`;
  const tab=`
    <div class="tab-row" style="margin-bottom:0.75rem" id="pvp-tabs">
      <button class="tab-btn active" id="pvptab-fight" onclick="G.pvpTab('fight')">⚔️ PvP</button>
      <button class="tab-btn" id="pvptab-bounties" onclick="G.pvpTab('bounties')">💰 Bounties</button>
    </div>
    <div id="pvp-body"></div>`;
  document.getElementById("content").innerHTML=tab;
  pvpTab("fight");
}
async function pvpTab(t){
  ["fight","bounties"].forEach(x=>{const b=document.getElementById("pvptab-"+x);if(b)b.classList.toggle("active",x===t);});
  if(t==="fight")await renderPvPFight();
  else await renderBountyBoard();
}
async function renderPvPFight(){
  const body=document.getElementById("pvp-body");if(!body)return;
  body.innerHTML=`<div style="text-align:center;color:var(--text3);padding:1rem">Loading players...</div>`;
  const all=await loadLeaderboard();
  const others=all.filter(p=>p.id!==CU.uid&&p.username);
  if(others.length===0){body.innerHTML=`<div style="text-align:center;color:var(--text3);padding:2rem;font-style:italic">No other players yet!</div>`;return;}
  const{str:eStr,def:eDef}=equipStats(P.equipped);
  const myStr=(P.baseStr||10)+eStr,myDef=(P.baseDef||5)+eDef;
  const now=Date.now();
  body.innerHTML=`
    <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:12px;padding:0.75rem;margin-bottom:0.75rem;font-size:0.8rem;color:var(--text3)">
      ⚔️ Win up to <strong>10%</strong> of their gold. Each target has a <strong>4-hour</strong> cooldown.
    </div>
    ${others.map(op=>{
      const lastAttack=(P.pvpAttackLog||{})[op.id]||0;
      const cooldownLeft=Math.max(0,CFG.PVP_COOLDOWN_MS-(now-lastAttack));
      const onCooldown=cooldownLeft>0;
      const cooldownStr=onCooldown?`${Math.floor(cooldownLeft/3600000)}h ${Math.floor((cooldownLeft%3600000)/60000)}m`:"";
      const opStr=(op.baseStr||10)+(equipStats(op.equipped||{}).str);
      const opDef=(op.baseDef||5)+(equipStats(op.equipped||{}).def);
      const canWin=myStr>opDef;
      return`<div class="market-item">
        <div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${avatarGfxFor(op,38)}</div>
        <div class="market-info">
          <div class="market-name">${op.username}</div>
          <div class="market-stat">Lv.${op.level||1} · ⚔️${opStr} 🛡️${opDef} · 🪙${fmt(op.gold||0)}</div>
          ${onCooldown?`<div style="font-size:0.68rem;color:var(--text3)">⏱ Cooldown: ${cooldownStr}</div>`:""}
        </div>
        <button class="btn btn-danger btn-sm" onclick="G.attackPlayer('${op.id}','${op.username}')" ${onCooldown?"disabled":""}>
          ${onCooldown?"Cooldown":"Attack"}
        </button>
      </div>`;
    }).join("")}`;
}
async function attackPlayer(targetId,targetName){
  SFX.click();
  const targetSnap=await getDoc(doc(db,"players",targetId));
  if(!targetSnap.exists()){toast("Player not found!");return;}
  const target={id:targetId,...targetSnap.data()};
  // Check cooldown
  const lastAttack=(P.pvpAttackLog||{})[targetId]||0;
  if(Date.now()-lastAttack<CFG.PVP_COOLDOWN_MS){toast("⏱ Still on cooldown!");return;}
  // Build fighter stats
  const{str:aStr,def:aDef}=equipStats(P.equipped);
  const{str:dStr,def:dDef}=equipStats(target.equipped||{});
  const attacker={name:P.username,str:(P.baseStr||10)+aStr,def:(P.baseDef||5)+aDef,maxHp:P.maxHp};
  const defender={name:target.username,str:(target.baseStr||10)+dStr,def:(target.baseDef||5)+dDef,maxHp:target.maxHp||110};
  const result=simulateFight(attacker,defender);
  const won=result.winner==="attacker";
  // Apply results
  if(!P.pvpAttackLog)P.pvpAttackLog={};
  P.pvpAttackLog[targetId]=Date.now();
  let goldStolen=0;
  if(won){
    goldStolen=Math.floor((target.gold||0)*CFG.PVP_GOLD_STEAL);
    P.gold=(P.gold||0)+goldStolen;
    P.pvpKills=(P.pvpKills||0)+1;
    SFX.pvpWin();
    // Notify the defender on next login
    const defNote=`⚔️ ${P.username} attacked you and won! You lost 🪙${fmt(goldStolen)}.`;
    await updateDoc(doc(db,"players",targetId),{
      gold:Math.max(0,(target.gold||0)-goldStolen),
      notifications:arrayUnion(defNote)
    });
  }else{
    SFX.pvpLose();
    P.pvpLosses=(P.pvpLosses||0)+1;
    // HP penalty for losing
    P.hp=Math.max(1,Math.floor(P.maxHp*0.3));
    const defNote=`🛡️ ${P.username} attacked you and lost! Your gold is safe.`;
    await updateDoc(doc(db,"players",targetId),{notifications:arrayUnion(defNote)});
  }
  saveP();updateHdr();
  // Show combat result
  showModal(`
    <div class="combat-scene" style="margin-bottom:0.75rem">
      <div class="fighters">
        <div class="fighter">
          <div class="f-img">${avatarGfx(56)}</div>
          <div class="f-name">${P.username}</div>
        </div>
        <div class="vs">VS</div>
        <div class="fighter">
          <div class="f-img">${avatarGfxFor(target,56)}</div>
          <div class="f-name">${target.username}</div>
        </div>
      </div>
    </div>
    <div class="combat-log" style="max-height:140px">${result.log.join("<br>")}</div>
    <div style="text-align:center;margin:0.75rem 0;font-family:'Cinzel',serif;font-size:1rem;font-weight:700;color:${won?"var(--green2)":"var(--crimson2)"}">
      ${won?`🏆 Victory! +🪙${fmt(goldStolen)}`:"💀 Defeat! You fought bravely."}
    </div>
    <button class="btn btn-ghost" onclick="G.closeModal()">Close</button>`);
}

// ── BOUNTY BOARD ──────────────────────────────────────────────
async function renderBountyBoard(){
  const body=document.getElementById("pvp-body");if(!body)return;
  body.innerHTML=`<div style="text-align:center;color:var(--text3);padding:1rem">Loading...</div>`;
  const bounties=await getBounties();
  const myBounties=bounties.filter(b=>b.posterId===CU.uid);
  const others=bounties.filter(b=>b.targetId!==CU.uid&&b.posterId!==CU.uid);
  const onMe=bounties.filter(b=>b.targetId===CU.uid);
  body.innerHTML=`
    <button class="btn btn-gold" onclick="G.openPostBounty()" style="margin-bottom:0.75rem">💰 Post a Bounty</button>
    ${onMe.length>0?`<div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:12px;padding:0.75rem;margin-bottom:0.75rem">
      <div style="font-family:'Cinzel',serif;font-size:0.82rem;color:var(--crimson2);font-weight:700;margin-bottom:0.4rem">⚠️ Bounties on You!</div>
      ${onMe.map(b=>`<div style="font-size:0.8rem;color:var(--text2)">🪙${fmt(b.totalAmount)} · Posted by ${b.posterName}</div>`).join("")}
    </div>`:""}
    <div class="section-hdr">Active Bounties</div>
    ${bounties.filter(b=>b.targetId!==CU.uid).length===0
      ?`<div style="text-align:center;color:var(--text3);padding:1.5rem;font-style:italic">No bounties posted yet.</div>`
      :bounties.filter(b=>b.targetId!==CU.uid).map(b=>`
        <div class="market-item">
          <div style="font-size:1.8rem">🎯</div>
          <div class="market-info">
            <div class="market-name">${b.targetName}</div>
            <div class="market-stat">Lv.${b.targetLevel||"?"} · Posted by ${b.posterName}</div>
            <div style="font-size:0.7rem;color:var(--text3)">${b.posterId===CU.uid?"(your bounty)":""}</div>
          </div>
          <div style="text-align:right">
            <div style="font-family:'Cinzel',serif;color:var(--gold3);font-weight:700;font-size:0.9rem">🪙${fmt(b.totalAmount)}</div>
            ${b.posterId===CU.uid
              ?`<button class="btn btn-ghost btn-sm" style="margin-top:0.3rem" onclick="G.cancelBounty('${b.id}')">Cancel</button>`
              :`<button class="btn btn-danger btn-sm" style="margin-top:0.3rem" onclick="G.claimBounty('${b.id}')">Claim</button>`}
          </div>
        </div>`).join("")}`;
}
async function openPostBounty(){
  SFX.click();
  const all=await loadLeaderboard();
  const others=all.filter(p=>p.id!==CU.uid);
  const optionsHtml=others.map(p=>`<option value="${p.id}" data-name="${p.username}" data-level="${p.level||1}">${p.username} (Lv.${p.level||1})</option>`).join("");
  showModal(`<div class="modal-title">🎯 Post a Bounty</div>
    <div style="font-size:0.82rem;color:var(--text3);margin-bottom:0.75rem">Minimum 🪙${fmt(CFG.BOUNTY_MIN)}. Gold is taken immediately and held in escrow.</div>
    <div style="margin-bottom:0.6rem">
      <label style="font-size:0.7rem;color:var(--text3);font-family:'Cinzel',serif;display:block;margin-bottom:0.3rem">TARGET</label>
      <select id="bounty-target" class="modal-input" style="padding:0.65rem">
        <option value="">Select a player...</option>${optionsHtml}
      </select>
    </div>
    <div style="margin-bottom:0.75rem">
      <label style="font-size:0.7rem;color:var(--text3);font-family:'Cinzel',serif;display:block;margin-bottom:0.3rem">BOUNTY AMOUNT</label>
      <input class="modal-input" id="bounty-amount" type="number" placeholder="Min ${CFG.BOUNTY_MIN}" min="${CFG.BOUNTY_MIN}"/>
    </div>
    <div style="font-size:0.75rem;color:var(--text3);margin-bottom:0.75rem">Your gold: 🪙${fmt(P.gold)}</div>
    <div class="modal-actions">
      <button class="btn btn-gold" onclick="G.confirmPostBounty()">Post Bounty</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Cancel</button>
    </div>`);
}
async function confirmPostBounty(){
  const targetEl=document.getElementById("bounty-target");
  const amtEl=document.getElementById("bounty-amount");
  const targetId=targetEl?.value;
  const targetName=targetEl?.options[targetEl.selectedIndex]?.getAttribute("data-name");
  const targetLevel=parseInt(targetEl?.options[targetEl.selectedIndex]?.getAttribute("data-level")||"1");
  const amount=Math.floor(Number(amtEl?.value));
  if(!targetId){toast("Select a target!");return;}
  if(!amount||amount<CFG.BOUNTY_MIN){SFX.error();toast(`Minimum bounty is 🪙${fmt(CFG.BOUNTY_MIN)}!`);return;}
  if(amount>(P.gold||0)){SFX.error();toast("Not enough gold!");return;}
  // Check if bounty already exists for this target
  const existing=await getBounties();
  const existingBounty=existing.find(b=>b.targetId===targetId);
  if(existingBounty){
    // Add to existing bounty
    await updateDoc(doc(db,"bounties",existingBounty.id),{totalAmount:existingBounty.totalAmount+amount});
    P.gold-=amount;saveP();closeModal();SFX.bounty();
    toast(`💰 Added 🪙${fmt(amount)} to existing bounty on ${targetName}!`);
  }else{
    await addDoc(collection(db,"bounties"),{
      targetId,targetName,targetLevel,
      posterId:CU.uid,posterName:P.username,
      totalAmount:amount,postedAt:Date.now()
    });
    P.gold-=amount;saveP();closeModal();SFX.bounty();
    toast(`🎯 Bounty of 🪙${fmt(amount)} posted on ${targetName}!`);
  }
}
async function cancelBounty(id){
  const snap=await getDoc(doc(db,"bounties",id));
  if(!snap.exists())return;
  const b=snap.data();
  if(b.posterId!==CU.uid){toast("Not your bounty!");return;}
  P.gold=(P.gold||0)+b.totalAmount;
  await deleteDoc(doc(db,"bounties",id));
  saveP();toast(`🪙 Bounty cancelled, 🪙${fmt(b.totalAmount)} refunded!`);
  renderBountyBoard();
}
async function claimBounty(bountyId){
  SFX.click();
  const snap=await getDoc(doc(db,"bounties",bountyId));
  if(!snap.exists()){toast("Bounty no longer active!");renderBountyBoard();return;}
  const b=snap.data();
  const targetSnap=await getDoc(doc(db,"players",b.targetId));
  if(!targetSnap.exists()){toast("Target not found!");return;}
  const target={id:b.targetId,...targetSnap.data()};
  const{str:aStr,def:aDef}=equipStats(P.equipped);
  const{str:dStr,def:dDef}=equipStats(target.equipped||{});
  const attacker={name:P.username,str:(P.baseStr||10)+aStr,def:(P.baseDef||5)+aDef,maxHp:P.maxHp};
  const defender={name:target.username,str:(target.baseStr||10)+dStr,def:(target.baseDef||5)+dDef,maxHp:target.maxHp||110};
  const result=simulateFight(attacker,defender);
  const won=result.winner==="attacker";
  if(won){
    P.gold=(P.gold||0)+b.totalAmount;
    P.pvpKills=(P.pvpKills||0)+1;
    await deleteDoc(doc(db,"bounties",bountyId));
    await updateDoc(doc(db,"players",b.targetId),{
      notifications:arrayUnion(`🎯 A bounty on you was claimed by ${P.username}!`)
    });
    SFX.pvpWin();saveP();updateHdr();
    showModal(`<div class="combat-scene" style="margin-bottom:0.75rem">
      <div class="fighters">
        <div class="fighter"><div class="f-img">${avatarGfx(56)}</div><div class="f-name">${P.username}</div></div>
        <div class="vs">VS</div>
        <div class="fighter"><div class="f-img">${avatarGfxFor(target,56)}</div><div class="f-name">${target.username}</div></div>
      </div></div>
      <div class="combat-log" style="max-height:130px">${result.log.join("<br>")}</div>
      <div style="text-align:center;margin:0.75rem 0;font-family:'Cinzel',serif;font-size:1rem;font-weight:700;color:var(--green2)">
        🏆 Bounty Claimed! +🪙${fmt(b.totalAmount)}
      </div>
      <button class="btn btn-ghost" onclick="G.closeModal()">Close</button>`);
  }else{
    SFX.pvpLose();P.hp=Math.max(1,Math.floor(P.maxHp*0.3));saveP();updateHdr();
    showModal(`<div class="combat-scene" style="margin-bottom:0.75rem">
      <div class="fighters">
        <div class="fighter"><div class="f-img">${avatarGfx(56)}</div><div class="f-name">${P.username}</div></div>
        <div class="vs">VS</div>
        <div class="fighter"><div class="f-img">${avatarGfxFor(target,56)}</div><div class="f-name">${target.username}</div></div>
      </div></div>
      <div class="combat-log" style="max-height:130px">${result.log.join("<br>")}</div>
      <div style="text-align:center;margin:0.75rem 0;font-family:'Cinzel',serif;font-size:1rem;font-weight:700;color:var(--crimson2)">
        💀 Defeat! The bounty remains active.
      </div>
      <button class="btn btn-ghost" onclick="G.closeModal()">Close</button>`);
  }
}

// ── GUILDS ────────────────────────────────────────────────────
async function renderGuild(){
  document.getElementById("content").innerHTML=`<div class="card"><div style="text-align:center;color:var(--text3);padding:1rem">Loading...</div></div>`;
  if(P.guildId){
    const guild=await getGuild(P.guildId);
    if(guild)renderGuildView(guild);
    else{P.guildId=null;saveP();renderGuildLobby();}
  }else renderGuildLobby();
}
function renderGuildLobby(){
  document.getElementById("content").innerHTML=`
    <div class="card" style="text-align:center;padding:2rem">
      <div style="font-size:3rem;margin-bottom:0.5rem">🛡️</div>
      <div style="font-family:'Cinzel',serif;font-size:1.2rem;font-weight:700;color:var(--gold3);margin-bottom:0.5rem">Join a Guild</div>
      <div style="font-size:0.85rem;color:var(--text3);margin-bottom:1.5rem">Fight together, share loot, conquer dungeons as one.</div>
      <button class="btn btn-gold" onclick="G.openCreateGuild()">⚔️ Create Guild (🪙${fmt(CFG.GUILD_CREATE_COST)})</button>
      <button class="btn btn-steel" onclick="G.openJoinGuild()">🛡️ Join a Guild</button>
    </div>`;
}
async function openCreateGuild(){
  if((P.gold||0)<CFG.GUILD_CREATE_COST){SFX.error();toast(`Need 🪙${fmt(CFG.GUILD_CREATE_COST)} to create a guild!`);return;}
  showModal(`<div class="modal-title">⚔️ Create a Guild</div>
    <div style="font-size:0.82rem;color:var(--text3);margin-bottom:0.75rem">Costs 🪙${fmt(CFG.GUILD_CREATE_COST)}. You will be the Leader.</div>
    <input class="modal-input" id="guild-name" placeholder="Guild name..." maxlength="24"/>
    <input class="modal-input" id="guild-tag" placeholder="Tag [3 letters]..." maxlength="3" style="text-transform:uppercase"/>
    <div class="modal-actions">
      <button class="btn btn-gold" onclick="G.confirmCreateGuild()">Create Guild</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Cancel</button>
    </div>`);
}
async function confirmCreateGuild(){
  const name=document.getElementById("guild-name")?.value.trim();
  const tag=(document.getElementById("guild-tag")?.value.trim()||"").toUpperCase();
  if(!name||name.length<2){SFX.error();toast("Enter a guild name!");return;}
  if(!tag||tag.length!==3){SFX.error();toast("Tag must be exactly 3 letters!");return;}
  if((P.gold||0)<CFG.GUILD_CREATE_COST){SFX.error();toast("Not enough gold!");return;}
  P.gold-=CFG.GUILD_CREATE_COST;
  const guildRef=await addDoc(collection(db,"guilds"),{
    name,tag,treasury:0,
    members:[{uid:CU.uid,username:P.username,role:"leader",joinedAt:Date.now()}],
    vault:[],
    raid:null,
    createdAt:Date.now(),leaderId:CU.uid
  });
  P.guildId=guildRef.id;
  saveP();closeModal();SFX.guild();toast(`🛡️ Guild "${name}" created!`);renderGuild();
}
async function openJoinGuild(){
  const snap=await getDocs(collection(db,"guilds"));
  const guilds=snap.docs.map(d=>({id:d.id,...d.data()})).filter(g=>g.members&&g.members.length<CFG.GUILD_MAX_MEMBERS);
  if(guilds.length===0){showModal(`<div class="modal-title">🛡️ Join a Guild</div>
    <div style="text-align:center;color:var(--text3);padding:1.5rem;font-style:italic">No guilds with open spots!</div>
    <button class="btn btn-ghost" onclick="G.closeModal()">Close</button>`);return;}
  showModal(`<div class="modal-title">🛡️ Join a Guild</div>
    <div style="max-height:60vh;overflow-y:auto;margin-bottom:0.75rem">
      ${guilds.map(g=>`
        <div style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem 0;border-bottom:1px solid var(--border)">
          <div style="flex:1">
            <div style="font-family:'Cinzel',serif;font-size:0.9rem;font-weight:700">[${g.tag}] ${g.name}</div>
            <div style="font-size:0.75rem;color:var(--text3)">${g.members?.length||0}/${CFG.GUILD_MAX_MEMBERS} members · 🏦${fmt(g.treasury||0)}</div>
          </div>
          <button class="btn btn-steel btn-sm" onclick="G.joinGuild('${g.id}')">Join</button>
        </div>`).join("")}
    </div>
    <button class="btn btn-ghost" onclick="G.closeModal()">Cancel</button>`);
}
async function joinGuild(guildId){
  const guild=await getGuild(guildId);
  if(!guild){toast("Guild not found!");return;}
  if(guild.members.length>=CFG.GUILD_MAX_MEMBERS){SFX.error();toast("Guild is full!");return;}
  await updateDoc(doc(db,"guilds",guildId),{
    members:arrayUnion({uid:CU.uid,username:P.username,role:"member",joinedAt:Date.now()})
  });
  P.guildId=guildId;saveP();closeModal();SFX.guild();toast(`🛡️ Joined ${guild.name}!`);renderGuild();
}
function renderGuildView(guild){
  const myMember=guild.members?.find(m=>m.uid===CU.uid);
  const myRole=myMember?.role||"member";
  const isLeader=myRole==="leader";
  const isAdmin=myRole==="admin"||isLeader;
  const membersHtml=guild.members?.map(m=>`
    <div style="display:flex;align-items:center;gap:0.75rem;padding:0.55rem 0;border-bottom:1px solid var(--border)">
      <div style="flex:1">
        <div style="font-family:'Cinzel',serif;font-size:0.82rem;font-weight:700">${m.username}
          <span style="font-size:0.65rem;color:${m.role==="leader"?"var(--gold3)":m.role==="admin"?"var(--steel)":"var(--text3)"}"> ${m.role==="leader"?"👑":m.role==="admin"?"⭐":""}${m.role}</span>
        </div>
      </div>
      ${isLeader&&m.uid!==CU.uid?`
        <button class="btn btn-ghost btn-sm" onclick="G.promoteGuildMember('${guild.id}','${m.uid}','${m.role}')">
          ${m.role==="member"?"→ Admin":"→ Leader"}
        </button>`:``}
      ${isAdmin&&m.uid!==CU.uid&&m.role!=="leader"?`
        <button class="btn btn-danger btn-sm" onclick="G.kickGuildMember('${guild.id}','${m.uid}')">Kick</button>`:``}
    </div>`).join("");
  const vaultHtml=guild.vault&&guild.vault.length>0
    ?guild.vault.map((item,i)=>`
      <div style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0;border-bottom:1px solid var(--border)">
        <div style="font-size:1.4rem">${gfx(item.image,item.emoji,28)}</div>
        <div style="flex:1">
          <div style="font-size:0.82rem;font-weight:700;color:${RARITY_COLOR[item.rarity]}">${item.name}</div>
          <div style="font-size:0.68rem;color:var(--text3)">+${item.val} ${item.stat==="str"?"STR":"DEF"} · donated by ${item.donatedBy||"?"}</div>
        </div>
        ${isAdmin?`<button class="btn btn-steel btn-sm" onclick="G.giveVaultItem('${guild.id}',${i})">Give</button>`:""}
      </div>`).join("")
    :`<div style="font-size:0.82rem;color:var(--text3);font-style:italic;padding:0.5rem 0">Vault is empty.</div>`;
  const raidHtml=guild.raid&&!guild.raid.completed?`
    <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:12px;padding:0.85rem;margin-bottom:0.75rem">
      <div style="font-family:'Cinzel',serif;font-size:0.9rem;font-weight:700;color:var(--crimson2);margin-bottom:0.4rem">⚔️ Raid Active: ${guild.raid.name}</div>
      <div style="font-size:0.78rem;color:var(--text3);margin-bottom:0.5rem">HP: ${fmt(guild.raid.hp)} / ${fmt(guild.raid.maxHp)} · Contributors: ${guild.raid.contributors?.length||0}</div>
      ${guild.raid.contributors?.includes(CU.uid)
        ?`<div style="font-size:0.78rem;color:var(--green2);font-weight:700">✓ You've contributed!</div>`
        :`<button class="btn btn-danger btn-sm" onclick="G.contributeToRaid('${guild.id}')">⚔️ Attack (1 Energy)</button>`}
    </div>`
    :isAdmin?`<button class="btn btn-purple" onclick="G.startGuildRaid('${guild.id}')" style="margin-bottom:0.75rem">
      ⚔️ Start Raid (🏦${fmt(CFG.GUILD_RAID_COST)} from treasury)</button>`:"";
  document.getElementById("content").innerHTML=`
    <div style="background:linear-gradient(135deg,#f8f4ee,#f0ebe2);border:1.5px solid var(--border2);border-radius:14px;padding:1rem;margin-bottom:0.7rem;text-align:center">
      <div style="font-family:'Cinzel',serif;font-size:1.4rem;font-weight:900;color:var(--gold3)">[${guild.tag}] ${guild.name}</div>
      <div style="font-size:0.8rem;color:var(--text3);margin-top:0.2rem">${guild.members?.length||0}/${CFG.GUILD_MAX_MEMBERS} members · You are ${myRole}</div>
    </div>
    <div class="card">
      <div class="card-title">🏦 Guild Treasury</div>
      <div style="font-family:'Cinzel',serif;font-size:1.5rem;color:var(--gold3);font-weight:700;text-align:center;margin-bottom:0.5rem">🪙${fmt(guild.treasury||0)}</div>
      <button class="btn btn-gold btn-sm" onclick="G.donateToGuild('${guild.id}')">Donate Gold</button>
      <button class="btn btn-ghost btn-sm" onclick="G.donateItemToGuild('${guild.id}')" style="margin-top:0.3rem">Donate Item</button>
    </div>
    ${raidHtml}
    <div class="card">
      <div class="card-title">👥 Members (${guild.members?.length||0})</div>
      ${membersHtml}
    </div>
    <div class="card">
      <div class="card-title">📦 Guild Vault</div>
      ${vaultHtml}
    </div>
    <button class="btn btn-danger" onclick="G.leaveGuild('${guild.id}')" style="margin-top:0.5rem">Leave Guild</button>`;
}
async function donateToGuild(guildId){
  showModal(`<div class="modal-title">🏦 Donate to Guild</div>
    <div style="font-size:0.82rem;color:var(--text3);margin-bottom:0.75rem">Your gold: 🪙${fmt(P.gold)}</div>
    <input class="modal-input" id="guild-donate-amt" type="number" placeholder="Amount..." min="1"/>
    <div class="modal-actions">
      <button class="btn btn-gold" onclick="G.confirmDonateGold('${guildId}')">Donate</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Cancel</button>
    </div>`);
}
async function confirmDonateGold(guildId){
  const amt=Math.floor(Number(document.getElementById("guild-donate-amt")?.value));
  if(!amt||amt<1){SFX.error();toast("Enter a valid amount");return;}
  if(amt>(P.gold||0)){SFX.error();toast("Not enough gold!");return;}
  P.gold-=amt;
  await updateDoc(doc(db,"guilds",guildId),{treasury:increment(amt)});
  saveP();closeModal();SFX.donate();toast(`🏦 Donated 🪙${fmt(amt)} to the guild!`);renderGuild();
}
async function donateItemToGuild(guildId){
  const inv=P.inventory||[];
  if(inv.length===0){SFX.error();toast("No items to donate!");return;}
  showModal(`<div class="modal-title">📦 Donate Item to Vault</div>
    <div style="max-height:50vh;overflow-y:auto;margin-bottom:0.75rem">
      ${inv.map((item,i)=>`
        <div style="display:flex;align-items:center;gap:0.6rem;padding:0.6rem 0;border-bottom:1px solid var(--border)">
          <div style="font-size:1.4rem">${gfx(item.image,item.emoji,28)}</div>
          <div style="flex:1">
            <div style="font-size:0.82rem;font-weight:700;color:${RARITY_COLOR[item.rarity]}">${item.name}</div>
            <div style="font-size:0.68rem;color:var(--text3)">+${item.val} ${item.stat==="str"?"STR":"DEF"}</div>
          </div>
          <button class="btn btn-steel btn-sm" onclick="G.confirmDonateItem('${guildId}',${i})">Donate</button>
        </div>`).join("")}
    </div>
    <button class="btn btn-ghost" onclick="G.closeModal()">Cancel</button>`);
}
async function confirmDonateItem(guildId,idx){
  const item=(P.inventory||[])[idx];if(!item)return;
  P.inventory=P.inventory.filter((_,i)=>i!==idx);
  const vaultItem={...item,donatedBy:P.username};
  await updateDoc(doc(db,"guilds",guildId),{vault:arrayUnion(vaultItem)});
  saveP();closeModal();SFX.donate();toast(`📦 Donated ${item.name} to the vault!`);renderGuild();
}
async function giveVaultItem(guildId,itemIdx){
  const guild=await getGuild(guildId);if(!guild)return;
  const members=guild.members?.filter(m=>m.uid!==CU.uid)||[];
  showModal(`<div class="modal-title">🎁 Give Item To...</div>
    <div style="max-height:50vh;overflow-y:auto;margin-bottom:0.75rem">
      ${members.map(m=>`
        <div style="display:flex;align-items:center;gap:0.6rem;padding:0.6rem 0;border-bottom:1px solid var(--border)">
          <div style="flex:1;font-family:'Cinzel',serif;font-size:0.85rem">${m.username}</div>
          <button class="btn btn-gold btn-sm" onclick="G.confirmGiveItem('${guildId}',${itemIdx},'${m.uid}','${m.username}')">Give</button>
        </div>`).join("")}
    </div>
    <button class="btn btn-ghost" onclick="G.closeModal()">Cancel</button>`);
}
async function confirmGiveItem(guildId,itemIdx,targetUid,targetName){
  const guild=await getGuild(guildId);if(!guild)return;
  const item=guild.vault[itemIdx];if(!item)return;
  // Remove from vault
  const newVault=guild.vault.filter((_,i)=>i!==itemIdx);
  await updateDoc(doc(db,"guilds",guildId),{vault:newVault});
  // Add to target player
  await updateDoc(doc(db,"players",targetUid),{
    inventory:arrayUnion({...item,id:`item_${Date.now()}_${rand(0,9999)}`}),
    notifications:arrayUnion(`🎁 Your guild gave you ${item.name}!`)
  });
  closeModal();SFX.donate();toast(`✅ Gave ${item.name} to ${targetName}!`);renderGuild();
}
async function startGuildRaid(guildId){
  const guild=await getGuild(guildId);if(!guild)return;
  if((guild.treasury||0)<CFG.GUILD_RAID_COST){SFX.error();toast(`Need 🏦${fmt(CFG.GUILD_RAID_COST)} in treasury!`);return;}
  if(guild.raid&&!guild.raid.completed){SFX.error();toast("Raid already active!");return;}
  // Generate raid boss based on average member level
  const avgLevel=Math.round((guild.members||[]).reduce((s,m)=>s+1,0)*5+10);
  const raidHp=avgLevel*200+rand(500,2000);
  const raid={name:"Guild Raid Boss",emoji:"🔥",hp:raidHp,maxHp:raidHp,
    str:avgLevel*8,def:avgLevel*4,expReward:avgLevel*50,goldReward:avgLevel*80,
    contributors:[],completed:false,startedBy:P.username,startedAt:Date.now()};
  await updateDoc(doc(db,"guilds",guildId),{raid,treasury:increment(-CFG.GUILD_RAID_COST)});
  SFX.raid();toast("⚔️ Raid started! All guild members can now attack!");renderGuild();
}
async function contributeToRaid(guildId){
  if(P.energy<1){SFX.error();toast("⚡ No energy!");return;}
  const guild=await getGuild(guildId);if(!guild||!guild.raid||guild.raid.completed){toast("No active raid!");return;}
  if(guild.raid.contributors?.includes(CU.uid)){toast("You already contributed!");return;}
  P.energy--;updateHdr();updateWalkUI();SFX.raid();
  const{str:eStr,def:eDef}=equipStats(P.equipped);
  const myStr=(P.baseStr||10)+eStr,myDef=(P.baseDef||5)+eDef;
  const dmg=Math.max(1,myStr-guild.raid.def+rand(-5,15));
  const newHp=Math.max(0,guild.raid.hp-dmg);
  const newContributors=[...(guild.raid.contributors||[]),CU.uid];
  if(newHp<=0){
    // Raid defeated!
    const contributors=newContributors;
    const goldEach=Math.floor(guild.raid.goldReward/contributors.length);
    const expEach=Math.floor(guild.raid.expReward/contributors.length);
    await updateDoc(doc(db,"guilds",guildId),{"raid.hp":0,"raid.completed":true,"raid.contributors":contributors});
    // Give rewards to all contributors
    for(const uid of contributors){
      await updateDoc(doc(db,"players",uid),{
        gold:increment(goldEach),exp:increment(expEach),
        notifications:arrayUnion(`🏆 Guild Raid defeated! You earned 🪙${goldEach} and ${expEach} EXP!`)
      });
    }
    // Give self reward immediately
    P.gold=(P.gold||0)+goldEach;P.exp=(P.exp||0)+expEach;
    checkLevelUp();saveP();
    SFX.victory();toast(`🏆 Raid defeated! +🪙${goldEach} +${expEach} EXP!`);
  }else{
    await updateDoc(doc(db,"guilds",guildId),{"raid.hp":newHp,"raid.contributors":newContributors});
    P.notifications=P.notifications||[];
    saveP();toast(`⚔️ Hit for ${dmg}! Raid HP: ${fmt(newHp)}/${fmt(guild.raid.maxHp)}`);
  }
  renderGuild();
}
async function promoteGuildMember(guildId,targetUid,currentRole){
  const guild=await getGuild(guildId);if(!guild)return;
  const myMember=guild.members?.find(m=>m.uid===CU.uid);
  if(myMember?.role!=="leader"){toast("Only the leader can promote!");return;}
  if(currentRole==="member"){
    // Promote to admin
    const newMembers=guild.members.map(m=>m.uid===targetUid?{...m,role:"admin"}:m);
    await updateDoc(doc(db,"guilds",guildId),{members:newMembers});
    toast("⭐ Promoted to Admin!");
  }else if(currentRole==="admin"){
    // Promote to leader, demote self to admin
    const newMembers=guild.members.map(m=>{
      if(m.uid===targetUid)return{...m,role:"leader"};
      if(m.uid===CU.uid)return{...m,role:"admin"};
      return m;
    });
    await updateDoc(doc(db,"guilds",guildId),{members:newMembers,leaderId:targetUid});
    toast("👑 Leadership transferred!");
  }
  SFX.guild();renderGuild();
}
async function kickGuildMember(guildId,targetUid){
  const guild=await getGuild(guildId);if(!guild)return;
  const targetMember=guild.members?.find(m=>m.uid===targetUid);
  if(!targetMember){return;}
  if(targetMember.role==="leader"){toast("Cannot kick the leader!");return;}
  const newMembers=guild.members.filter(m=>m.uid!==targetUid);
  await updateDoc(doc(db,"guilds",guildId),{members:newMembers});
  await updateDoc(doc(db,"players",targetUid),{guildId:null,notifications:arrayUnion("You have been kicked from the guild.")});
  SFX.click();toast("Member kicked.");renderGuild();
}
async function leaveGuild(guildId){
  showModal(`<div class="modal-title">Leave Guild?</div>
    <div style="text-align:center;color:var(--text3);margin-bottom:1rem;font-size:0.88rem">Are you sure you want to leave?</div>
    <div class="modal-actions">
      <button class="btn btn-danger" onclick="G.confirmLeaveGuild('${guildId}')">Leave</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Cancel</button>
    </div>`);
}
async function confirmLeaveGuild(guildId){
  const guild=await getGuild(guildId);if(!guild)return;
  const newMembers=guild.members.filter(m=>m.uid!==CU.uid);
  if(newMembers.length===0)await deleteDoc(doc(db,"guilds",guildId));
  else await updateDoc(doc(db,"guilds",guildId),{members:newMembers});
  P.guildId=null;saveP();closeModal();SFX.click();toast("Left the guild.");renderGuild();
}

// END OF PART 2

// ============================================================
//  MicroMMO — game.js  (v4)
//  PART 3 of 3 — Combat, Market, Social, Profile, Quests, Bank, Properties
// ============================================================

// ── COMBAT ───────────────────────────────────────────────────
function openCombatModal(monster){
  const{str:eStr,def:eDef}=equipStats(P.equipped);
  const pet=P.equipped?.Pet||null;
  combatState={monster,playerHp:P.hp,playerMaxHp:P.maxHp,monsterHp:monster.hp,
    pStr:(P.baseStr||10)+eStr,pDef:(P.baseDef||5)+eDef,pet,log:[],done:false};
  P.activeCombat=serializeCombat(combatState);saveP();
  showModal("");renderCombatModal();
  combatInterval=setInterval(combatTick,900);
  updateWalkUI();
}
function serializeCombat(cs){
  return{monster:cs.monster,playerHp:cs.playerHp,playerMaxHp:cs.playerMaxHp,
    monsterHp:cs.monsterHp,pStr:cs.pStr,pDef:cs.pDef,pet:cs.pet,log:cs.log.slice(-20)};
}
function resumeCombat(){
  if(!P.activeCombat)return;
  combatState={...P.activeCombat,done:false};
  showModal("");renderCombatModal();
  combatInterval=setInterval(combatTick,900);
}
function abandonCombat(){
  clearInterval(combatInterval);
  const penalty=rand(10,30);
  P.gold=Math.max(0,(P.gold||0)-penalty);P.hp=Math.max(1,Math.floor(P.maxHp*0.4));
  P.activeCombat=null;combatState=null;
  saveP();updateHdr();closeModal();updateWalkUI();SFX.error();
  toast(`🏃 You fled! Lost ${penalty}🪙.`);
}
function fleeCombat(){
  if(!combatState||combatState.done)return;
  clearInterval(combatInterval);combatState.done=true;
  const goldLost=rand(15,Math.min(80,Math.floor((P.gold||0)*0.1)+15));
  P.gold=Math.max(0,(P.gold||0)-goldLost);P.hp=combatState.playerHp;P.activeCombat=null;
  combatState.log.push(`<span class="log-sys">🏃 You fled! Lost ${goldLost}🪙</span>`);
  renderCombatModal();saveP();updateHdr();updateWalkUI();SFX.error();
  toast(`🏃 Escaped! Dropped ${goldLost}🪙.`);
}
function healInCombat(){
  if(!combatState||combatState.done)return;
  const smallP=SHOP_CONSUMABLES.find(c=>c.id==="potion_small");
  const bigP=SHOP_CONSUMABLES.find(c=>c.id==="potion_big");
  const canAffordBig=(P.gold||0)>=bigP.price,canAffordSmall=(P.gold||0)>=smallP.price;
  if(!canAffordSmall){SFX.error();toast("💰 Can't afford potions!");return;}
  if(canAffordBig&&P.hp<P.maxHp*0.5){
    P.gold-=bigP.price;
    const heal=Math.floor(combatState.playerMaxHp*CFG.POTION_HEAL_BIG);
    combatState.playerHp=Math.min(combatState.playerMaxHp,combatState.playerHp+heal);
    P.hp=combatState.playerHp;
    combatState.log.push(`<span class="log-win">💊 Major Potion! +${heal} HP</span>`);
  }else if(canAffordSmall){
    P.gold-=smallP.price;
    const heal=Math.floor(combatState.playerMaxHp*CFG.POTION_HEAL_SMALL);
    combatState.playerHp=Math.min(combatState.playerMaxHp,combatState.playerHp+heal);
    P.hp=combatState.playerHp;
    combatState.log.push(`<span class="log-win">🧪 Minor Potion! +${heal} HP</span>`);
  }
  saveP();renderCombatModal();
}
function renderCombatModal(){
  if(!combatState)return;
  const cs=combatState,m=cs.monster;
  const pPct=clamp((cs.playerHp/cs.playerMaxHp)*100,0,100);
  const mPct=clamp((cs.monsterHp/m.maxHp)*100,0,100);
  const smallPrice=SHOP_CONSUMABLES.find(c=>c.id==="potion_small")?.price||120;
  const canHeal=(P.gold||0)>=smallPrice,hpLow=cs.playerHp<cs.playerMaxHp;
  document.getElementById("modal-content").innerHTML=`
    <div class="combat-scene">
      <div class="fighters">
        <div class="fighter">
          <div class="f-img">${avatarGfx(56)}</div>
          <div class="f-name">${P.username}${cs.pet?" + "+cs.pet.name:""}</div>
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
          ${hpLow&&canHeal?`<button class="btn btn-green btn-sm" style="flex:1;padding:0.55rem" onclick="G.healInCombat()">🧪 Heal (🪙${smallPrice})</button>`
            :`<button class="btn btn-ghost btn-sm" style="flex:1;padding:0.55rem;opacity:0.4" disabled>🧪 Heal</button>`}
          <button class="btn btn-danger btn-sm" style="flex:1;padding:0.55rem" onclick="G.fleeCombat()">🏃 Flee</button>
        </div>
        <div style="text-align:center;color:#94a3b8;font-size:0.75rem;margin-top:0.4rem;font-style:italic">⚔️ Auto-battling...</div>`}`;
  const log=document.getElementById("combat-log");if(log)log.scrollTop=log.scrollHeight;
}
function combatTick(){
  if(!combatState||combatState.done){clearInterval(combatInterval);return;}
  const cs=combatState,m=cs.monster;
  let pDmg=Math.max(1,cs.pStr-m.def+rand(-3,6));
  const pCrit=Math.random()<0.12;if(pCrit)pDmg=Math.floor(pDmg*1.75);
  cs.monsterHp=Math.max(0,cs.monsterHp-pDmg);
  pCrit?SFX.crit():SFX.hit();
  cs.log.push(pCrit?`<span class="log-crit">⚡ CRIT! You smash ${m.name} for ${pDmg}!</span>`
    :`<span class="log-you">You hit ${m.name} for ${pDmg}</span>`);
  if(cs.pet&&cs.monsterHp>0){
    const petDmg=Math.max(1,Math.floor(cs.pet.val*0.25)+rand(0,3));
    cs.monsterHp=Math.max(0,cs.monsterHp-petDmg);
    cs.log.push(`<span class="log-pet">${cs.pet.name} bites for ${petDmg}!</span>`);
  }
  if(cs.monsterHp<=0){
    cs.done=true;clearInterval(combatInterval);
    cs.log.push(`<span class="log-win">🏆 ${m.name} defeated! +${m.expReward} EXP · +${m.goldReward}🪙</span>`);
    handleVictory(cs);renderCombatModal();
    setTimeout(()=>{const ov=document.getElementById("modal-overlay");if(ov&&ov.style.display!=="none")closeModal();},CFG.COMBAT_VICTORY_CLOSE_MS);
    return;
  }
  let mDmg=Math.max(1,m.str-cs.pDef+rand(-3,6));
  const mCrit=Math.random()<0.08;if(mCrit)mDmg=Math.floor(mDmg*1.75);
  cs.playerHp=Math.max(0,cs.playerHp-mDmg);
  cs.log.push(mCrit?`<span class="log-crit">💥 ${m.name} CRITS you for ${mDmg}!</span>`
    :`<span class="log-hit">${m.name} hits you for ${mDmg}</span>`);
  if(cs.playerHp<=0){
    cs.done=true;clearInterval(combatInterval);
    cs.log.push(`<span class="log-lose">💀 You were defeated by ${m.name}...</span>`);
    handleDefeat(cs);renderCombatModal();
    setTimeout(()=>{const ov=document.getElementById("modal-overlay");if(ov&&ov.style.display!=="none")closeModal();},CFG.COMBAT_VICTORY_CLOSE_MS);
    return;
  }
  renderCombatModal();
}
function handleVictory(cs){
  const m=cs.monster;
  SFX.victory();
  P.npcKills=(P.npcKills||0)+1;P.gold=(P.gold||0)+m.goldReward;P.exp=(P.exp||0)+m.expReward;P.hp=cs.playerHp;
  updateQuestProgress("kills");checkLevelUp();
  toast(`⚔️ Victory! +${m.expReward} EXP · +${m.goldReward}🪙`);
  P.hp=clamp(P.hp,1,P.maxHp);combatState=null;P.activeCombat=null;
  saveP();updateHdr();updateWalkUI();
}
function handleDefeat(cs){
  SFX.defeat();
  P.hp=Math.max(1,Math.floor(P.maxHp*0.25));
  toast("💀 Defeated! Buy potions in the shop!");
  combatState=null;P.activeCombat=null;saveP();updateHdr();updateWalkUI();
}
function checkLevelUp(){
  let leveled=false,levels=0;
  while(P.exp>=expLv(P.level)){
    P.exp-=expLv(P.level);P.level++;levels++;
    P.statPoints=(P.statPoints||0)+1;
    const{def:eDef}=equipStats(P.equipped);
    P.maxHp=maxHpCalc(P.level,(P.baseDef||5)+eDef,P.bonusHp||0);
    leveled=true;
  }
  if(leveled){P.hp=P.maxHp;SFX.levelUp();toast(`🎉 LEVEL UP! Now Level ${P.level}! +${levels} stat point${levels>1?"s":""}!`);updateHdr();}
}
function closeModal(){
  const ov=document.getElementById("modal-overlay");
  ov.style.display="none";ov.style.pointerEvents="none";
  if(combatState&&combatState.done){combatState=null;P.activeCombat=null;saveP();updateWalkUI();}
  else if(combatState&&!combatState.done){
    clearInterval(combatInterval);combatInterval=null;
    P.activeCombat=serializeCombat(combatState);saveP();
    if(TAB==="home")renderHome();
  }
}

// ── ITEM MODAL ────────────────────────────────────────────────
function openItemModal(source,idx){
  let item,isEquipped=false,slot=null;
  if(source==="equipped"){slot=idx;item=P.equipped[slot];isEquipped=true;}
  else item=(P.inventory||[])[idx];
  if(!item)return;SFX.click();
  const color=RARITY_COLOR[item.rarity]||"#6b7280";
  const q=qualityLabel(item.val,item.base||item.val);
  const curEquipped=P.equipped[item.type];
  const compare=curEquipped&&!isEquipped
    ?`<div class="modal-row"><em>vs Equipped</em><span style="color:${item.val>curEquipped.val?"var(--green2)":"var(--crimson2)"}">
        ${item.val>curEquipped.val?"▲":"▼"}${Math.abs(item.val-curEquipped.val)} vs +${curEquipped.val}</span></div>`:"";
  const npcVal=Math.max(5,Math.floor((item.shopPrice||item.base*item.val*2||50)*CFG.SHOP_SELL_RATE));
  showModal(`<div class="modal-icon">${gfx(item.image,item.emoji,72)}</div>
    <div class="modal-title" style="color:${color}">${item.name}</div>
    <div class="modal-rarity" style="color:${color}">${item.rarity}<span style="margin-left:0.5rem;color:${q.color};font-size:0.65rem;font-weight:700">${q.label}</span></div>
    <div class="modal-row"><em>Type</em><span>${item.type}</span></div>
    <div class="modal-row"><em>Stat</em><span style="color:${item.stat==="str"?"var(--crimson2)":"var(--steel)"}">+${item.val} ${item.stat==="str"?"STR":"DEF"}</span></div>
    <div class="modal-row"><em>Base Roll</em><span style="color:var(--text3)">~${item.base||"?"}</span></div>
    <div class="modal-row"><em>NPC Value</em><span style="color:var(--text3)">🪙${npcVal}</span></div>
    ${compare}
    <div class="modal-actions">
      ${isEquipped?`<button class="btn btn-ghost" onclick="G.unequipItem('${slot}')">Unequip</button>`:`<button class="btn btn-gold" onclick="G.equipItem(${idx})">Equip</button>`}
      ${!isEquipped?`<button class="btn btn-purple" onclick="G.promptSell(${idx});G.closeModal()">List on Market</button>`:""}
      ${!isEquipped?`<button class="btn btn-ghost" onclick="G.sellToNpc(${idx});G.closeModal()">Sell to NPC (🪙${npcVal})</button>`:""}
      <button class="btn btn-danger" onclick="${isEquipped?`G.dropEquipped('${slot}')`:`G.dropInventory(${idx})`}">Drop Item</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Close</button>
    </div>`);
}
function equipItem(idx){
  const item=(P.inventory||[])[idx];if(!item)return;
  const eq={...(P.equipped||{})},inv=[...(P.inventory||[])];
  if(eq[item.type])inv.push(eq[item.type]);
  inv.splice(inv.findIndex(i=>i.id===item.id),1);
  eq[item.type]=item;P.equipped=eq;P.inventory=inv;
  const{def:eDef}=equipStats(eq);
  P.maxHp=maxHpCalc(P.level,(P.baseDef||5)+eDef,P.bonusHp||0);P.hp=clamp(P.hp,1,P.maxHp);
  saveP();closeModal();SFX.equip();toast(`✅ Equipped ${item.name}!`);renderGear();
}
function unequipItem(slot){
  const item=P.equipped[slot];if(!item)return;
  P.inventory=[...(P.inventory||[]),item];delete P.equipped[slot];
  const{def:eDef}=equipStats(P.equipped);
  P.maxHp=maxHpCalc(P.level,(P.baseDef||5)+eDef,P.bonusHp||0);P.hp=clamp(P.hp,1,P.maxHp);
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
  P.maxHp=maxHpCalc(P.level,(P.baseDef||5)+eDef,P.bonusHp||0);P.hp=clamp(P.hp,1,P.maxHp);
  saveP();closeModal();toast(`🗑️ Dropped ${item.name}`);renderGear();
}

// ── MARKET ────────────────────────────────────────────────────
async function renderMarket(){
  document.getElementById("content").innerHTML=`<div class="card"><div style="text-align:center;color:var(--text3);padding:1rem">Loading...</div></div>`;
  const listings=await getListings(),others=listings.filter(l=>l.sellerId!==CU.uid);
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
  SFX.click();
  if(t==="browse")getListings().then(l=>renderMarketBrowse(l.filter(x=>x.sellerId!==CU.uid)));
  else if(t==="sell")renderMarketSell();
  else if(t==="shop")renderMarketShop();
  else if(t==="mine")getListings().then(l=>renderMyListings(l.filter(x=>x.sellerId===CU.uid)));
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
          <span class="pill" style="background:${q.color}22;color:${q.color}">${q.label}</span></div>
        <div class="market-seller">by ${l.sellerName}</div>
        <div class="market-stat">+${l.item.val} ${l.item.stat==="str"?"STR":"DEF"} · ${l.item.type}</div>
      </div>
      <div><div class="market-price">🪙${fmt(l.price)}</div>
        <button class="btn btn-gold btn-sm" style="margin-top:0.3rem" onclick="G.buyListing('${l.id}',${l.price})">Buy</button>
      </div>
    </div>`;
  }).join("");
}
function renderMarketSell(){
  const body=document.getElementById("market-body");if(!body)return;
  const inv=P.inventory||[];
  if(inv.length===0){body.innerHTML=`<div style="text-align:center;color:var(--text3);padding:2rem;font-style:italic">No items to sell.</div>`;return;}
  body.innerHTML=`<div style="font-size:0.8rem;color:var(--text3);margin-bottom:0.75rem">${Math.round(CFG.MARKET_FEE*100)}% fee on market sales.</div>`+
    inv.map((item,i)=>{
      const q=qualityLabel(item.val,item.base||item.val);
      const npcVal=Math.max(5,Math.floor((item.shopPrice||item.base*item.val*2||50)*CFG.SHOP_SELL_RATE));
      return`<div class="market-item">
        <div class="market-icon">${gfx(item.image,item.emoji,36)}</div>
        <div class="market-info">
          <div class="market-name" style="color:${RARITY_COLOR[item.rarity]}">${item.name}
            <span class="pill" style="background:${q.color}22;color:${q.color}">${q.label}</span></div>
          <div class="market-stat">+${item.val} ${item.stat==="str"?"STR":"DEF"}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:0.3rem;align-items:flex-end">
          <button class="btn btn-gold btn-sm" onclick="G.promptSell(${i})">List</button>
          <button class="btn btn-ghost btn-sm" onclick="G.sellToNpc(${i})" style="font-size:0.62rem">NPC 🪙${npcVal}</button>
        </div>
      </div>`;
    }).join("");
}
function sellToNpc(idx){
  const item=(P.inventory||[])[idx];if(!item)return;
  const npcVal=Math.max(5,Math.floor((item.shopPrice||item.base*item.val*2||50)*CFG.SHOP_SELL_RATE));
  P.inventory=P.inventory.filter((_,i)=>i!==idx);P.gold=(P.gold||0)+npcVal;
  SFX.gold();saveP();toast(`🛒 Sold for 🪙${npcVal}`);renderMarketSell();
}
function openMysteryChest(){
  if((P.gold||0)<CFG.CHEST_PRICE){SFX.error();toast(`Need 🪙${CFG.CHEST_PRICE}!`);return;}
  P.gold-=CFG.CHEST_PRICE;
  const roll=Math.random();let reward;
  if(roll<0.60){
    const item=spawnItemFromPool(ITEMS);
    P.inventory=[...(P.inventory||[]),item];P.itemsFound=(P.itemsFound||0)+1;
    updateQuestProgress("items");
    const q=qualityLabel(item.val,item.base||item.val);
    reward={emoji:item.emoji,image:item.image,name:item.name,
      sub:`+${item.val} ${item.stat==="str"?"STR":"DEF"} · ${item.rarity}`,
      color:RARITY_COLOR[item.rarity],extra:`<span style="background:${q.color}22;color:${q.color};font-family:'Cinzel',serif;font-size:0.7rem;padding:2px 8px;border-radius:6px;font-weight:700">${q.label}</span>`};
  }else if(roll<0.90){
    const pet=spawnItemFromPool(PETS);
    P.inventory=[...(P.inventory||[]),pet];P.itemsFound=(P.itemsFound||0)+1;
    updateQuestProgress("items");
    reward={emoji:pet.emoji,image:pet.image,name:pet.name,
      sub:`+${pet.val} ${pet.stat==="str"?"STR":"DEF"} · ${pet.rarity} Pet`,color:RARITY_COLOR[pet.rarity],extra:""};
  }else{
    const av=rollAvatar(),collected=P.avatars||[];
    if(collected.includes(av.id)){
      const bonus=rand(100,400);P.gold=(P.gold||0)+bonus;
      reward={emoji:"🪙",image:"",name:"Duplicate Avatar",sub:`Converted to 🪙${bonus} gold`,color:"#d97706",extra:""};
    }else{
      P.avatars=[...collected,av.id];
      reward={emoji:av.emoji,image:av.image,name:av.name,sub:`${av.rarity} Avatar`,color:RARITY_COLOR[av.rarity],extra:""};
    }
  }
  saveP();
  showModal(`<div style="text-align:center"><div style="font-size:5rem;margin-bottom:0.5rem">📦</div>
    <div style="font-family:'Cinzel',serif;font-size:0.9rem;color:var(--text3)">Opening...</div></div>`);
  SFX.chest();
  setTimeout(()=>{
    const imgHtml=reward.image?`<img src="${reward.image}" alt="" style="width:80px;height:80px;object-fit:contain;border-radius:8px">`:`<span style="font-size:4rem">${reward.emoji}</span>`;
    showModal(`<div style="text-align:center">
      <div style="font-size:0.75rem;color:var(--text3);font-family:'Cinzel',serif;text-transform:uppercase;margin-bottom:0.5rem">✨ Chest Opened!</div>
      <div style="width:80px;height:80px;margin:0 auto 0.6rem;display:flex;align-items:center;justify-content:center">${imgHtml}</div>
      <div style="font-family:'Cinzel',serif;font-size:1.05rem;color:${reward.color};font-weight:700;margin-bottom:0.2rem">${reward.name}</div>
      ${reward.extra}
      <div style="font-size:0.82rem;color:var(--text3);margin:0.5rem 0 1rem">${reward.sub}</div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-gold" onclick="G.openMysteryChest()">Open Another (🪙${CFG.CHEST_PRICE})</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Close</button>
    </div>`);
  },600);
}
function renderMarketShop(){
  const body=document.getElementById("market-body");if(!body)return;
  const shopItems=ITEMS.filter(i=>i.shopPrice>0);
  const shopPets=PETS.filter(p=>p.rarity==="common"||p.rarity==="uncommon");
  const chestHtml=`<div class="shop-item" style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border-color:var(--gold2)">
    <div class="shop-icon">📦</div>
    <div class="shop-info"><div class="shop-name" style="color:var(--gold3)">Mystery Chest</div>
      <div class="shop-desc">Random item, pet, or avatar!</div></div>
    <div><div class="shop-price">🪙${fmt(CFG.CHEST_PRICE)}</div>
      <button class="btn btn-gold btn-sm" style="margin-top:0.3rem" onclick="G.openMysteryChest()">Open</button>
    </div></div>`;
  const consumeHtml=SHOP_CONSUMABLES.map(c=>`
    <div class="shop-item"><div class="shop-icon">${c.emoji}</div>
      <div class="shop-info"><div class="shop-name">${c.name}</div><div class="shop-desc">${c.desc}</div></div>
      <div><div class="shop-price">🪙${fmt(c.price)}</div>
        <button class="btn btn-gold btn-sm" style="margin-top:0.3rem" onclick="G.buyConsumable('${c.id}')">Buy</button>
      </div></div>`).join("");
  const equipHtml=shopItems.map((item,i)=>`
    <div class="shop-item"><div class="shop-icon">${gfx(item.image,item.emoji,40)}</div>
      <div class="shop-info"><div class="shop-name" style="color:${RARITY_COLOR[item.rarity]}">${item.name}</div>
        <div class="shop-desc">+~${item.base} ${item.stat==="str"?"STR":"DEF"}</div></div>
      <div><div class="shop-price">🪙${fmt(item.shopPrice)}</div>
        <button class="btn btn-gold btn-sm" style="margin-top:0.3rem" onclick="G.buyShopItem('item',${i})">Buy</button>
      </div></div>`).join("");
  const petHtml=shopPets.map((pet,i)=>{
    const price=Math.round(300*(pet.base/5));
    return`<div class="shop-item"><div class="shop-icon">${gfx(pet.image,pet.emoji,40)}</div>
      <div class="shop-info"><div class="shop-name" style="color:${RARITY_COLOR[pet.rarity]}">${pet.name}</div>
        <div class="shop-desc">+~${pet.base} ${pet.stat==="str"?"STR":"DEF"} · Pet</div></div>
      <div><div class="shop-price">🪙${fmt(price)}</div>
        <button class="btn btn-gold btn-sm" style="margin-top:0.3rem" onclick="G.buyShopItem('pet',${i})">Buy</button>
      </div></div>`;
  }).join("");
  body.innerHTML=`<div style="font-size:0.78rem;color:var(--text3);margin-bottom:0.6rem">Your gold: 🪙${fmt(P.gold)}</div>
    <div class="section-hdr">✨ Special</div>${chestHtml}
    <div class="section-hdr">Consumables</div>${consumeHtml}
    <div class="section-hdr">🐾 Pets</div>${petHtml||`<div style="color:var(--text3);font-style:italic;padding:0.5rem">No pets.</div>`}
    <div class="section-hdr">Equipment</div>${equipHtml}`;
}
function renderMyListings(listings){
  const body=document.getElementById("market-body");if(!body)return;
  if(listings.length===0){body.innerHTML=`<div style="text-align:center;color:var(--text3);padding:2rem;font-style:italic">No active listings.</div>`;return;}
  body.innerHTML=listings.map(l=>`
    <div class="market-item"><div class="market-icon">${gfx(l.item.image,l.item.emoji,36)}</div>
      <div class="market-info"><div class="market-name" style="color:${RARITY_COLOR[l.item.rarity]}">${l.item.name}</div>
        <div class="market-stat">+${l.item.val} ${l.item.stat==="str"?"STR":"DEF"}</div></div>
      <div><div class="market-price">🪙${fmt(l.price)}</div>
        <button class="btn btn-danger btn-sm" style="margin-top:0.3rem" onclick="G.cancelListing('${l.id}',${JSON.stringify(l.item).split("'").join("&#39;")})">Cancel</button>
      </div></div>`).join("");
}
async function buyListing(id,price){
  if((P.gold||0)<price){SFX.error();toast("💰 Not enough gold!");return;}
  const snap=await getDoc(doc(db,"market",id));
  if(!snap.exists()){toast("Listing gone.");renderMarket();return;}
  const listing=snap.data();P.gold-=price;P.inventory=[...(P.inventory||[]),listing.item];
  await removeListing(id);saveP();SFX.gold();toast(`✅ Bought ${listing.item.name}!`);
  updateQuestProgress("items");renderMarket();
}
async function cancelListing(id,item){
  await removeListing(id);P.inventory=[...(P.inventory||[]),item];saveP();
  toast("📦 Listing cancelled.");renderMarket();
}
function promptSell(idx){
  const item=(P.inventory||[])[idx];if(!item)return;
  const suggestedPrice=item.base?(item.base*item.val*2):200;
  showModal(`<div class="modal-title">List on Market</div>
    <div class="modal-icon">${gfx(item.image,item.emoji,72)}</div>
    <div style="text-align:center;color:${RARITY_COLOR[item.rarity]};margin-bottom:0.5rem;font-weight:700">${item.name}</div>
    <input class="modal-input" id="sell-price" type="number" value="${suggestedPrice}" min="1"/>
    <div class="modal-actions">
      <button class="btn btn-gold" onclick="G.confirmSell(${idx})">List Item</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Cancel</button>
    </div>`);
}
async function confirmSell(idx){
  const price=Math.floor(Number(document.getElementById("sell-price").value));
  if(!price||price<1){toast("Enter a valid price");return;}
  const item=(P.inventory||[])[idx];if(!item)return;
  P.inventory=P.inventory.filter((_,i)=>i!==idx);
  await addListing(item,price);saveP();closeModal();
  toast(`🏪 Listed for 🪙${fmt(price)}!`);renderMarket();
}
function buyShopItem(kind,idx){
  let template,price;
  if(kind==="pet"){const sp=PETS.filter(p=>p.rarity==="common"||p.rarity==="uncommon");template=sp[idx];price=Math.round(300*(template.base/5));}
  else{const si=ITEMS.filter(i=>i.shopPrice>0);template=si[idx];price=template.shopPrice;}
  if(!template)return;
  if((P.gold||0)<price){SFX.error();toast("💰 Not enough gold!");return;}
  const val=rollItemStat(template);
  const item={...template,val,base:template.base,id:`item_${Date.now()}_${rand(0,9999)}`};
  delete item.shopPrice;delete item.dropRate;
  P.gold-=price;P.inventory=[...(P.inventory||[]),item];P.itemsFound=(P.itemsFound||0)+1;
  saveP();updateQuestProgress("items");SFX.itemFound();toast(`🛒 Bought ${item.name}!`);renderMarketShop();
}
function buyConsumable(id){
  const c=SHOP_CONSUMABLES.find(x=>x.id===id);if(!c)return;
  if((P.gold||0)<c.price){SFX.error();toast("💰 Not enough gold!");return;}
  P.gold-=c.price;applyConsumable(c.effect);saveP();SFX.gold();toast(`${c.emoji} Used ${c.name}!`);updateHdr();
  if(TAB==="market")renderMarket();
}
function applyConsumable(effect){
  const maxE=calcMaxEnergy();
  if(effect==="heal_small")P.hp=Math.min(P.maxHp,P.hp+Math.floor(P.maxHp*CFG.POTION_HEAL_SMALL));
  else if(effect==="heal_big")P.hp=Math.min(P.maxHp,P.hp+Math.floor(P.maxHp*CFG.POTION_HEAL_BIG));
  else if(effect==="energy_full"){P.energy=maxE;P.lastEnergyTime=Date.now();updateHdr();updateWalkUI();}
  else if(effect==="exp_200"){P.exp=(P.exp||0)+200;checkLevelUp();}
}

// ── SOCIAL / LEADERBOARD ──────────────────────────────────────
let _lbCache=null;
async function renderSocial(){
  document.getElementById("content").innerHTML=`<div class="card"><div style="text-align:center;color:var(--text3);padding:1rem">Loading...</div></div>`;
  _lbCache=await loadLeaderboard();
  document.getElementById("content").innerHTML=`
    <div class="tab-row" style="margin-bottom:0.75rem;flex-wrap:wrap;gap:3px" id="lb-tabs">
      <button class="tab-btn active" onclick="G.lbTab('level')">🏆 Level</button>
      <button class="tab-btn" onclick="G.lbTab('kills')">💀 Kills</button>
      <button class="tab-btn" onclick="G.lbTab('pvp')">⚔️ PvP</button>
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
    const types=["level","kills","pvp","steps","gold","items"];b.classList.toggle("active",types[i]===type);
  });
  const all=_lbCache||[];let sorted,valFn,title;
  if(type==="level"){sorted=[...all].sort((a,b)=>b.level-a.level||(b.exp||0)-(a.exp||0));valFn=p=>`Lv.${p.level}`;title="🏆 Level Rankings";}
  else if(type==="kills"){sorted=[...all].sort((a,b)=>(b.npcKills||0)-(a.npcKills||0));valFn=p=>`${fmt(p.npcKills||0)} kills`;title="💀 Kill Rankings";}
  else if(type==="pvp"){sorted=[...all].sort((a,b)=>(b.pvpKills||0)-(a.pvpKills||0));valFn=p=>`${p.pvpKills||0}W/${p.pvpLosses||0}L`;title="⚔️ PvP Rankings";}
  else if(type==="steps"){sorted=[...all].sort((a,b)=>(b.steps||0)-(a.steps||0));valFn=p=>`${fmt(p.steps||0)} steps`;title="👣 Step Rankings";}
  else if(type==="gold"){sorted=[...all].sort((a,b)=>((b.gold||0)+(b.bank||0))-((a.gold||0)+(a.bank||0)));valFn=p=>`🪙${fmt((p.gold||0)+(p.bank||0))}`;title="🪙 Wealth Rankings";}
  else{sorted=[...all].sort((a,b)=>(b.itemsFound||0)-(a.itemsFound||0));valFn=p=>`${p.itemsFound||0} items`;title="🎁 Items Found";}
  const top=sorted.slice(0,10),body=document.getElementById("lb-body");if(!body)return;
  if(top.length===0){body.innerHTML=`<div class="card"><div style="text-align:center;color:var(--text3);font-style:italic;padding:1rem">No data yet!</div></div>`;return;}
  const rows=top.map((p,i)=>{
    const rc=i===0?"r1":i===1?"r2":i===2?"r3":"";
    const you=p.id===CU.uid?`<span class="lb-you">(you)</span>`:"";
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
  const tierIdx=arenaT(P.arenaWins||0),tier=ARENA_TIERS[tierIdx];
  const maxE=calcMaxEnergy(),expNeed=expLv(P.level);
  const expPct=clamp(Math.round((P.exp/expNeed)*100),0,100);
  document.getElementById("content").innerHTML=`
    <div class="profile-hero">
      <div class="profile-ava">${avatarGfx(84)}</div>
      <div class="profile-name">${P.username}</div>
      <div class="profile-level">Level ${P.level} · <span style="color:${tier.color};font-weight:700">${TIER_EMOJIS[tierIdx]} ${tier.name}</span></div>
      <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:10px;padding:0.75rem;margin-bottom:0.75rem;text-align:left">
        <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text3);margin-bottom:0.3rem;font-family:'Cinzel',serif">
          <span>✨ Experience</span><span>${fmt(P.exp)} / ${fmt(expNeed)}</span>
        </div>
        <div class="bar bar-exp"><div class="bar-fill" style="width:${expPct}%"></div></div>
        <div style="font-size:0.68rem;color:var(--text3);margin-top:0.2rem">${fmt(expNeed-P.exp)} XP to Level ${P.level+1}</div>
      </div>
      <div class="profile-stats">
        <div class="ps-item"><div class="ps-val">${(P.baseStr||10)+eStr}</div><div class="ps-key">⚔️ STR</div></div>
        <div class="ps-item"><div class="ps-val">${(P.baseDef||5)+eDef}</div><div class="ps-key">🛡️ DEF</div></div>
        <div class="ps-item"><div class="ps-val">${P.maxHp}</div><div class="ps-key">❤️ Max HP</div></div>
        <div class="ps-item"><div class="ps-val">${maxE}</div><div class="ps-key">⚡ Max EP</div></div>
        <div class="ps-item"><div class="ps-val">${P.statPoints||0}</div><div class="ps-key">⬆️ Stat Pts</div></div>
        <div class="ps-item"><div class="ps-val">${fmt(P.steps||0)}</div><div class="ps-key">👣 Steps</div></div>
        <div class="ps-item"><div class="ps-val">${P.npcKills||0}</div><div class="ps-key">💀 Kills</div></div>
        <div class="ps-item"><div class="ps-val">${P.pvpKills||0}W/${P.pvpLosses||0}L</div><div class="ps-key">⚔️ PvP</div></div>
        <div class="ps-item"><div class="ps-val">${fmt(P.gold||0)}</div><div class="ps-key">🪙 Gold</div></div>
        <div class="ps-item"><div class="ps-val">${(P.properties||[]).length}</div><div class="ps-key">🏠 Props</div></div>
        <div class="ps-item"><div class="ps-val">${(P.inventory||[]).length}</div><div class="ps-key">🎒 Items</div></div>
        <div class="ps-item"><div class="ps-val">${(P.avatars||[]).length}/${AVATARS.length}</div><div class="ps-key">🎭 Avatars</div></div>
      </div>
    </div>
    <button class="btn btn-purple" onclick="G.openAvatarCollection()" style="margin-bottom:0.5rem">🎭 My Avatar Collection</button>
    ${P.statPoints>0?`<button class="btn btn-gold" onclick="G.openStatModal()" style="margin-bottom:0.5rem">⬆️ Spend ${P.statPoints} Stat Point${P.statPoints>1?"s":""}</button>`:""}
    <div class="card"><div class="card-title">⚙️ Account</div>
      <button class="btn btn-ghost" onclick="G.handleSignOut()">Sign Out</button>
    </div>
    <button class="btn btn-ghost" onclick="G.showTab('home')" style="margin-top:0.5rem">← Back</button>`;
}
async function handleSignOut(){clearInterval(energyInterval);await signOut(auth);}

// ── QUESTS ───────────────────────────────────────────────────
function renderQuests(){
  const qs=getQuests(),now=new Date();
  const msUntilReset=(24-now.getUTCHours())*3600000-now.getUTCMinutes()*60000;
  const hReset=Math.floor(msUntilReset/3600000),mReset=Math.floor((msUntilReset%3600000)/60000);
  const questsHtml=qs.map(q=>{
    const done=q.progress>=q.target,pct=Math.min(100,Math.round((q.progress/q.target)*100));
    return`<div class="quest-item">
      <div class="quest-top">
        <div class="quest-icon">${q.icon}</div>
        <div class="quest-info">
          <div class="quest-name ${done?"quest-done":""}">${q.name} ${done?"✓":""}</div>
          <div class="quest-desc">${q.desc}</div>
          <div class="quest-reward">🎁 +${q.reward.exp} EXP · +${q.reward.gold}🪙</div>
        </div>
        ${done&&!q.claimed?`<button class="btn btn-green btn-sm" onclick="G.claimQuest('${q.id}')">Claim</button>`:
          done?`<span style="color:var(--text3);font-size:0.72rem">Claimed</span>`:""}
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
  const q=P.quests.list.find(x=>x.id===id);if(!q||q.claimed||q.progress<q.target)return;
  q.claimed=true;P.exp=(P.exp||0)+q.reward.exp;P.gold=(P.gold||0)+q.reward.gold;
  checkLevelUp();saveP();SFX.gold();toast(`🎁 Claimed! +${q.reward.exp} EXP · +${q.reward.gold}🪙`);renderQuests();
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
    </div>
    <button class="btn btn-ghost" onclick="G.showTab('home')" style="margin-top:0.5rem">← Back</button>`;
}
function doDeposit(){
  const amt=Math.floor(Number(document.getElementById("deposit-amt").value));
  if(!amt||amt<1){toast("Enter a valid amount");return;}
  if(amt>(P.gold||0)){SFX.error();toast("Not enough gold!");return;}
  P.gold-=amt;P.bank=(P.bank||0)+amt;saveP();SFX.gold();toast(`🏦 Deposited ${fmt(amt)} gold`);renderBank();
}
function doWithdraw(){
  const amt=Math.floor(Number(document.getElementById("withdraw-amt").value));
  if(!amt||amt<1){toast("Enter a valid amount");return;}
  if(amt>(P.bank||0)){SFX.error();toast("Not enough in bank!");return;}
  P.bank-=amt;P.gold=(P.gold||0)+amt;saveP();SFX.gold();toast(`🪙 Withdrew ${fmt(amt)} gold`);renderBank();
}

// ── PROPERTIES ────────────────────────────────────────────────
function renderProperties(){
  const owned=getOwnedProperties(),rentalPending=getRentalIncome();
  const ownedHtml=owned.length===0?"":owned.map(op=>{
    const prop=PROPERTIES.find(p=>p.id===op.id);if(!prop)return"";
    const isHome=op.instanceId===P.homePropertyInstanceId;
    const daily=Math.floor(prop.price*prop.rentalRate);
    const sellPrice=Math.floor(prop.price*CFG.PROPERTY_SELL_RATE);
    return`<div style="background:var(--surface);border:1.5px solid ${isHome?"var(--gold2)":"var(--border)"};border-radius:12px;padding:0.9rem;margin-bottom:0.5rem;box-shadow:var(--shadow-sm)">
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
        <div style="font-size:2rem">${prop.emoji}</div>
        <div style="flex:1">
          <div style="font-family:'Cinzel',serif;font-size:0.9rem;font-weight:700;color:${isHome?"var(--gold3)":"var(--text)"}">${prop.name}${isHome?" 🏠":""}</div>
          <div style="font-size:0.75rem;color:var(--text3)">${prop.desc}</div>
          ${isHome?`<div style="font-size:0.72rem;color:var(--steel);margin-top:0.2rem;font-weight:600">+${prop.energyBonus} Max Energy (your home)</div>`
            :`<div style="font-size:0.72rem;color:var(--green2);margin-top:0.2rem;font-weight:600">🪙${fmt(daily)}/day rental</div>`}
        </div>
      </div>
      <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
        ${!isHome?`<button class="btn btn-steel btn-sm" onclick="G.setHome('${op.instanceId}','${prop.id}')">Move In</button>`:""}
        ${isHome&&owned.length>1?`<button class="btn btn-ghost btn-sm" onclick="G.unsetHome()">Move Out</button>`:""}
        <button class="btn btn-danger btn-sm" onclick="G.sellProperty('${op.instanceId}','${prop.id}')">Sell (🪙${fmt(sellPrice)})</button>
      </div>
    </div>`;
  }).join("");
  const availHtml=PROPERTIES.map(prop=>{
    const ownedCount=countOwned(prop.id),nextPrice=propertyPrice(prop.id);
    return`<div style="background:var(--surface);border:1.5px solid var(--border);border-radius:12px;padding:0.9rem;margin-bottom:0.5rem;box-shadow:var(--shadow-sm)">
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
        <div style="font-size:2rem">${prop.emoji}</div>
        <div style="flex:1">
          <div style="font-family:'Cinzel',serif;font-size:0.9rem;font-weight:700">${prop.name}
            ${ownedCount>0?`<span style="font-size:0.65rem;color:var(--text3);margin-left:0.3rem">(own ${ownedCount})</span>`:""}
          </div>
          <div style="font-size:0.75rem;color:var(--text3)">${prop.desc}</div>
          <div style="display:flex;gap:0.6rem;margin-top:0.25rem;flex-wrap:wrap">
            <span style="font-size:0.7rem;color:var(--steel);font-weight:600">+${prop.energyBonus} energy if home</span>
            <span style="font-size:0.7rem;color:var(--green2);font-weight:600">🪙${fmt(Math.floor(prop.price*prop.rentalRate))}/day rent</span>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-family:'Cinzel',serif;color:var(--gold3);font-size:0.9rem;font-weight:700">🪙${fmt(nextPrice)}</div>
          ${ownedCount>0?`<div style="font-size:0.6rem;color:var(--text3)">+5% per copy</div>`:""}
        </div>
      </div>
      <button class="btn btn-gold btn-sm" onclick="G.buyProperty('${prop.id}')" ${(P.gold||0)<nextPrice?"disabled":""}>
        ${(P.gold||0)>=nextPrice?"Purchase":"Need 🪙"+fmt(nextPrice)}
      </button>
    </div>`;
  }).join("");
  document.getElementById("content").innerHTML=`
    ${rentalPending>0?`<div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:0.85rem;margin-bottom:0.7rem;display:flex;align-items:center;gap:0.75rem">
      <div style="font-size:1.5rem">🏠</div>
      <div style="flex:1"><div style="font-family:'Cinzel',serif;font-size:0.82rem;color:var(--green);font-weight:700">🪙${fmt(rentalPending)} in Rental Income!</div></div>
      <button class="btn btn-green btn-sm" onclick="G.claimRent()">Collect</button>
    </div>`:""}
    ${owned.length>0?`<div class="section-hdr">Your Properties (${owned.length})</div>${ownedHtml}`:""}
    <div class="section-hdr">Available to Buy</div>${availHtml}
    <button class="btn btn-ghost" onclick="G.showTab('home')" style="margin-top:0.5rem">← Back</button>`;
}
function buyProperty(id){
  const prop=PROPERTIES.find(p=>p.id===id);if(!prop)return;
  const price=propertyPrice(id);
  if((P.gold||0)<price){SFX.error();toast("💰 Not enough gold!");return;}
  P.gold-=price;
  const instanceId=`${id}_${Date.now()}`;
  P.properties=[...(P.properties||[]),{id:prop.id,instanceId,purchasedAt:Date.now(),lastRentClaim:Date.now()}];
  if(!P.homePropertyInstanceId){P.homePropertyId=prop.id;P.homePropertyInstanceId=instanceId;}
  saveP();SFX.gold();toast(`🏠 Purchased ${prop.name}!`);renderProperties();
}
function setHome(instanceId,propId){
  P.homePropertyInstanceId=instanceId;P.homePropertyId=propId;
  P.energy=Math.min(P.energy,calcMaxEnergy());
  saveP();toast("🏠 Moved in!");renderProperties();
}
function unsetHome(){P.homePropertyInstanceId=null;P.homePropertyId=null;saveP();toast("🏠 Moved out!");renderProperties();}
function sellProperty(instanceId,propId){
  const prop=PROPERTIES.find(p=>p.id===propId);if(!prop)return;
  const sellPrice=Math.floor(prop.price*CFG.PROPERTY_SELL_RATE);
  showModal(`<div class="modal-title">Sell Property?</div>
    <div style="text-align:center;font-size:3rem;margin:0.5rem 0">${prop.emoji}</div>
    <div style="text-align:center;color:var(--text3);font-size:0.88rem;margin-bottom:1rem">
      Sell <strong>${prop.name}</strong> for <strong style="color:var(--gold3)">🪙${fmt(sellPrice)}</strong>?</div>
    <div class="modal-actions">
      <button class="btn btn-danger" onclick="G.confirmSellProperty('${instanceId}','${propId}')">Confirm Sale</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Cancel</button>
    </div>`);
}
function confirmSellProperty(instanceId,propId){
  const prop=PROPERTIES.find(p=>p.id===propId);if(!prop)return;
  P.properties=(P.properties||[]).filter(op=>op.instanceId!==instanceId);
  if(P.homePropertyInstanceId===instanceId){P.homePropertyInstanceId=null;P.homePropertyId=null;}
  P.gold=(P.gold||0)+Math.floor(prop.price*CFG.PROPERTY_SELL_RATE);
  saveP();closeModal();SFX.gold();toast(`🪙 Sold!`);renderProperties();
}

// ── EXPOSE ────────────────────────────────────────────────────
window.G={
  // Auth
  switchAuthTab,handleEmailAuth,handleGoogleAuth,handleSetUsername,
  // Navigation
  showTab,hideWalk,closeModal,
  // Walk
  takeStep,openAreaSelect,selectArea,
  // Home
  openStatModal,spendStat,claimRent,
  // Gear/Items
  openItemModal,equipItem,unequipItem,dropInventory,dropEquipped,
  // Market
  renderMarket,mTab,
  promptSell,confirmSell,buyListing,cancelListing,buyShopItem,buyConsumable,sellToNpc,
  openMysteryChest,
  // PvP
  pvpTab,attackPlayer,
  // Bounties
  openPostBounty,confirmPostBounty,cancelBounty,claimBounty,
  // Guilds
  openCreateGuild,confirmCreateGuild,openJoinGuild,joinGuild,
  donateToGuild,confirmDonateGold,donateItemToGuild,confirmDonateItem,
  giveVaultItem,confirmGiveItem,
  startGuildRaid,contributeToRaid,
  promoteGuildMember,kickGuildMember,leaveGuild,confirmLeaveGuild,
  // Quests
  claimQuest,
  // Bank
  doDeposit,doWithdraw,
  // Properties
  buyProperty,setHome,unsetHome,sellProperty,confirmSellProperty,
  // Social
  lbTab,
  // Profile/Avatar
  handleSignOut,equipAvatar,openAvatarCollection,
  // Combat
  fleeCombat,healInCombat,resumeCombat,abandonCombat,
  // Choice events
  resolveChoice,
};

// END OF PART 3
