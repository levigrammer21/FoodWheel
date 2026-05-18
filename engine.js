// ============================================================
//  MicroMMO — engine.js
//  Pure game logic: math helpers, audio, stats, combat,
//  item rolling, quest tracking, player init.
//  No DOM access. No Firebase calls. No render calls.
// ============================================================

import{CFG,RARITY_SCALE,RARITY_COLOR,ARENA_TIERS,ITEMS,PETS,MONSTERS,AVATARS,
  EQUIP_SLOTS,PROPERTIES,SHOP_CONSUMABLES,WALK_AREAS,CHOICE_EVENTS,WALK_EVENTS,
  WEATHER_TYPES,EGG_TYPES,SHINY_CHANCE,DUNGEONS}from"./data.js";

// ── MATH ─────────────────────────────────────────────────────
export const rand  =(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
export const pick  =a=>a[Math.floor(Math.random()*a.length)];
export const clamp =(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export const fmt   =n=>n>=1e6?(n/1e6).toFixed(1)+"M":n>=1000?(n/1000).toFixed(1)+"K":String(Math.floor(n||0));
export const expLv =lv=>Math.floor(80*Math.pow(1.2,lv-1));
// 1 HP per 2 DEF
export const maxHpCalc=(lv,def,bonusHp)=>Math.floor(100+def*0.5+(bonusHp||0));

// ── AUDIO ENGINE ──────────────────────────────────────────────
let _audioCtx=null;
let _audioUnlocked=false;
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
export const SFX={
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
  combo:    ()=>{playTone(660,"sine",0.06,0.25);playTone(880,"sine",0.08,0.3,0.06);},
  burn:     ()=>{playTone(300,"sawtooth",0.08,0.2);},
};
export function unlockAudio(){
  if(_audioUnlocked)return;_audioUnlocked=true;
  try{const ctx=getAudio();const o=ctx.createOscillator();o.connect(ctx.destination);o.start();o.stop(ctx.currentTime+0.001);}catch(e){}
}

// ── STAT HELPERS ──────────────────────────────────────────────
export function equipStats(eq){
  let str=0,def=0;
  Object.values(eq||{}).forEach(it=>{if(!it)return;if(it.stat==="str")str+=it.val;else def+=it.val;});
  return{str,def};
}
export function arenaT(wins){
  let t=0;
  for(let i=ARENA_TIERS.length-1;i>=0;i--){if((wins||0)>=ARENA_TIERS[i].wins){t=i;break;}}
  return t;
}

// ── ITEM ROLLING ──────────────────────────────────────────────
export function bellRoll(base,variance){
  let r=0;for(let i=0;i<6;i++)r+=Math.random();
  r=(r-3)/3;return Math.max(1,Math.round(base+r*variance));
}
export function rollItemStat(t){
  const v=t.variance??Math.max(2,Math.round(t.base*0.5));
  return bellRoll(t.base,v);
}
export function qualityLabel(val,base){
  const d=val-base;
  if(d>=base*0.5) return{label:"Perfect",color:"#d97706"};
  if(d>=base*0.25)return{label:"Great",  color:"#7c3aed"};
  if(d>=base*0.05)return{label:"Good",   color:"#2563eb"};
  if(d>=-base*0.1)return{label:"Normal", color:"#6b7280"};
  if(d>=-base*0.25)return{label:"Poor",  color:"#9ca3af"};
  return               {label:"Worn",   color:"#d1d5db"};
}
export function rollItemAtLevel(template,itemLevel){
  const scale=RARITY_SCALE[template.rarity]||1.0;
  const base=Math.round(template.base+itemLevel*scale);
  const variance=Math.max(2,Math.round(base*0.15));
  return Math.max(1,bellRoll(base,variance));
}
export function spawnItemScaled(template,playerLv){
  const itemLevel=clamp((playerLv||1)+rand(-3,3),template.minLevel||1,9999);
  const val=rollItemAtLevel(template,itemLevel);
  const base=Math.round(template.base+itemLevel*(RARITY_SCALE[template.rarity]||1.0));
  return{...template,val,base,itemLevel,id:`item_${Date.now()}_${rand(0,9999)}`};
}
export function spawnItemFromPool(pool,playerLv){
  const lv=playerLv||1;
  const eligible=pool.filter(t=>{
    if(t.type==="Pet")return true;
    return lv>=(t.minLevel||1)-10;
  });
  const src=eligible.length?eligible:pool;
  const total=src.reduce((s,i)=>s+(i.dropRate||10),0);
  let r=Math.random()*total;
  for(const t of src){
    r-=(t.dropRate||10);
    if(r<=0){
      if(t.type==="Pet"){const val=rollItemStat(t);return{...t,val,base:t.base,id:`item_${Date.now()}_${rand(0,9999)}`};}
      return spawnItemScaled(t,lv);
    }
  }
  const t=src[0];
  return t.type==="Pet"
    ?{...t,val:rollItemStat(t),base:t.base,id:`item_${Date.now()}`}
    :spawnItemScaled(t,lv);
}

// ── MONSTER SPAWNING — 15% power buff ────────────────────────
export function spawnMonster(area,playerLv){
  const areaMin=area?area.monsterMinLv:1;
  const areaMax=area?area.monsterMaxLv:8;
  const targetLv=clamp(playerLv||1,areaMin,areaMax);
  const effectiveLv=clamp(targetLv+rand(-2,3),areaMin,areaMax);
  const areaId=area?area.id:null;
  const eligible=areaId?MONSTERS.filter(m=>!m.areaIds||m.areaIds.includes(areaId)):MONSTERS;
  const pool=eligible.length?eligible:MONSTERS;
  const base=pick(pool);
  const lv=effectiveLv,BUFF=1.15;
  const str =Math.max(1,Math.round((base.str[0]+base.str[1]*lv+rand(-2,4))*BUFF));
  const def =Math.max(0,Math.round((base.def[0]+base.def[1]*lv+rand(-1,2))*BUFF));
  const hp  =Math.max(5,Math.round((base.hp[0] +base.hp[1] *lv+rand(-5,10))*BUFF));
  const exp =Math.max(1,Math.round(base.exp[0] +base.exp[1] *lv));
  const gold=Math.max(1,Math.round(base.gold[0]+base.gold[1]*lv));
  const expMult=area?area.expMult:1;
  const goldMult=area?area.goldMult:1;
  return{
    ...base,effectiveLv,str,def,hp,maxHp:hp,
    expReward:Math.round(exp*expMult),
    goldReward:Math.round(gold*goldMult),
    burnChance:clamp((areaMin/100)*0.4,0.05,0.35),
    bleedChance:clamp((areaMin/100)*0.3,0.04,0.28),
  };
}

// ── WEATHER ───────────────────────────────────────────────────
export function rollWeather(){
  const weights=[40,20,20,10,10];
  const total=weights.reduce((a,b)=>a+b,0);
  let r=Math.random()*total;
  for(let i=0;i<WEATHER_TYPES.length;i++){r-=weights[i];if(r<=0)return WEATHER_TYPES[i];}
  return WEATHER_TYPES[0];
}

// ── COMBO SYSTEM ─────────────────────────────────────────────
export function getComboTier(streak){
  const tiers=CFG.COMBO_TIERS;let tier=0;
  for(let i=tiers.length-1;i>=0;i--){if(streak>=tiers[i]){tier=i;break;}}
  return tier;
}
export function getComboMult(streak){return CFG.COMBO_MULTS[getComboTier(streak)]||1;}
export function comboLabel(streak){
  if(streak<=0)return"";
  const tier=getComboTier(streak);
  const labels=["","🔥 Hot","⚡ Blazing","💥 UNSTOPPABLE"];
  return`${labels[tier]||""} x${CFG.COMBO_MULTS[tier]} (${streak} steps)`;
}

// ── ITEM UPGRADE / SALVAGE ────────────────────────────────────
export function salvageShards(item){
  const rarityMult={common:1,uncommon:2,rare:4,epic:8,legendary:15};
  const mult=rarityMult[item.rarity]||1;
  const upgrades=item.upgrades||0;
  return Math.max(1,Math.round(CFG.SALVAGE_SHARDS_BASE*mult+upgrades));
}
export function upgradeItemCost(item){
  const upgrades=item.upgrades||0;
  const goldCost=Math.round((item.val||1)*CFG.UPGRADE_GOLD_COST_PER_VAL*(1+upgrades*0.3));
  const shardCost=Math.round(10+(upgrades**2)*3.7);
  return{goldCost,shardCost};
}
export function canUpgrade(item){return(item.upgrades||0)<CFG.UPGRADE_MAX_TIMES;}
export function applyUpgrade(item){
  const gain=Math.max(1,Math.round((item.base||item.val)*0.15));
  return{...item,val:(item.val||1)+gain,upgrades:(item.upgrades||0)+1};
}

// ── ENERGY ───────────────────────────────────────────────────
export function calcMaxEnergy(P){
  if(!P)return CFG.BASE_ENERGY;
  const levelBonus=Math.floor((P.level-1)/5)*CFG.ENERGY_PER_5_LEVELS;
  const homeId=P.homePropertyId||null;
  let housingBonus=0;
  if(homeId){const prop=PROPERTIES.find(p=>p.id===homeId);if(prop)housingBonus=prop.energyBonus;}
  return CFG.BASE_ENERGY+levelBonus+housingBonus;
}

// ── PROPERTY HELPERS ─────────────────────────────────────────
export function getOwnedProperties(P){return P.properties||[];}
export function countOwned(P,id){return getOwnedProperties(P).filter(p=>p.id===id).length;}
export function propertyPrice(P,id){
  const prop=PROPERTIES.find(p=>p.id===id);if(!prop)return 0;
  return Math.floor(prop.price*Math.pow(1+CFG.PROPERTY_STACK_FEE,countOwned(P,id)));
}
export function getRentalIncome(P){
  const owned=getOwnedProperties(P),now=Date.now();let total=0;
  owned.forEach(op=>{
    if(op.instanceId===P.homePropertyInstanceId)return;
    const prop=PROPERTIES.find(p=>p.id===op.id);if(!prop)return;
    const lastClaim=op.lastRentClaim||op.purchasedAt||now;
    total+=Math.floor(prop.price*prop.rentalRate*((now-lastClaim)/(1000*60*60*24)));
  });
  return total;
}

// ── AVATAR HELPERS ────────────────────────────────────────────
export function getActiveAvatar(P){
  const id=P.activeAvatar;if(!id)return null;
  return AVATARS.find(a=>a.id===id)||null;
}
export function rollAvatar(){
  const total=AVATARS.reduce((s,a)=>s+(a.dropRate||1),0);
  let r=Math.random()*total;
  for(const av of AVATARS){r-=(av.dropRate||1);if(r<=0)return av;}
  return AVATARS[0];
}

// ── DAILY QUESTS ─────────────────────────────────────────────
export function buildDailyQuests(seed){
  const s=(n)=>{let x=Math.sin(seed+n)*10000;return x-Math.floor(x);};
  return[
    {id:"q_kill", icon:"⚔️",name:"Monster Hunter",desc:`Kill ${Math.floor(s(1)*8)+3} monsters`,target:Math.floor(s(1)*8)+3,type:"kills",progress:0,reward:{exp:150,gold:100}},
    {id:"q_steps",icon:"👣",name:"World Walker",  desc:`Take ${Math.floor(s(2)*20)+10} steps`,  target:Math.floor(s(2)*20)+10,type:"steps",progress:0,reward:{exp:100,gold:80}},
    {id:"q_items",icon:"🎁",name:"Fortune Seeker",desc:`Find ${Math.floor(s(3)*4)+2} items`,    target:Math.floor(s(3)*4)+2, type:"items",progress:0,reward:{exp:120,gold:90}},
  ];
}
export function questSeed(){
  const d=new Date();
  return d.getUTCFullYear()*10000+d.getUTCMonth()*100+d.getUTCDate();
}
export function getQuests(P){
  const seed=questSeed();
  if(!P.quests||P.quests.seed!==seed){P.quests={seed,list:buildDailyQuests(seed)};}
  return P.quests.list;
}
export function updateQuestProgress(P,type,amount=1){
  if(!P.quests)return false;let changed=false;
  P.quests.list.forEach(q=>{
    if(q.type===type&&q.progress<q.target){
      q.progress=Math.min(q.target,q.progress+amount);changed=true;
      if(q.progress>=q.target&&!q.claimed)return"complete";
    }
  });
  return changed;
}

// ── PLAYER INIT ───────────────────────────────────────────────
export function newPlayer(username){
  return{username,level:1,exp:0,gold:200,bank:0,diamonds:10,
    hp:110,maxHp:110,baseStr:10,baseDef:5,bonusHp:0,statPoints:0,
    energy:CFG.BASE_ENERGY,lastEnergyTime:Date.now(),
    steps:0,npcKills:0,pvpKills:0,pvpLosses:0,arenaWins:0,arenaLosses:0,
    inventory:[],equipped:{},quests:null,
    properties:[],homePropertyId:null,homePropertyInstanceId:null,
    avatars:[],activeAvatar:null,
    guildId:null,pvpAttackLog:{},notifications:[],
    walkStreak:0,shards:0,
    petCollection:[],activePetId:null,
    activeDungeon:null,shopChest:null,
    createdAt:Date.now()};
}

// ── COMBAT SIMULATION (PvP) ───────────────────────────────────
export function simulateFight(attacker,defender){
  let aHp=attacker.maxHp,dHp=defender.maxHp;
  const log=[];let round=0;
  while(aHp>0&&dHp>0&&round<50){
    round++;
    let aDmg=Math.max(1,attacker.str-defender.def+rand(-3,6));
    const aCrit=Math.random()<0.12;if(aCrit)aDmg=Math.floor(aDmg*1.75);
    dHp=Math.max(0,dHp-aDmg);
    log.push(aCrit?`<span class="log-crit">⚡ CRIT! ${attacker.name} hits ${defender.name} for ${aDmg}!</span>`:`<span class="log-you">${attacker.name} hits ${defender.name} for ${aDmg}</span>`);
    if(dHp<=0)break;
    let dDmg=Math.max(1,defender.str-attacker.def+rand(-3,6));
    const dCrit=Math.random()<0.08;if(dCrit)dDmg=Math.floor(dDmg*1.75);
    aHp=Math.max(0,aHp-dDmg);
    log.push(dCrit?`<span class="log-crit">💥 CRIT! ${defender.name} hits ${attacker.name} for ${dDmg}!</span>`:`<span class="log-hit">${defender.name} hits ${attacker.name} for ${dDmg}</span>`);
  }
  const winner=dHp<=0?"attacker":"defender";
  log.push(winner==="attacker"?`<span class="log-win">🏆 ${attacker.name} wins!</span>`:`<span class="log-lose">💀 ${defender.name} wins!</span>`);
  return{winner,log,attackerHpLeft:aHp,defenderHpLeft:dHp};
}

// ── CONSUMABLE EFFECTS ────────────────────────────────────────
export function applyConsumable(P,effect){
  const maxE=calcMaxEnergy(P);
  if(effect==="heal_small")P.hp=Math.min(P.maxHp,P.hp+Math.floor(P.maxHp*CFG.POTION_HEAL_SMALL));
  else if(effect==="heal_big")P.hp=Math.min(P.maxHp,P.hp+Math.floor(P.maxHp*CFG.POTION_HEAL_BIG));
  else if(effect==="energy_full"){P.energy=maxE;P.lastEnergyTime=Date.now();}
  else if(effect==="exp_200"){P.exp=(P.exp||0)+200;}
}

// ── EGG RARITY ROLLER ────────────────────────────────────────
export function rollEggRarity(){
  const w=CFG.CHEST_EGG_RARITY;
  const total=Object.values(w).reduce((a,b)=>a+b,0);
  let r=Math.random()*total;
  for(const[rar,wt]of Object.entries(w)){r-=wt;if(r<=0)return rar;}
  return"common";
}

// ── EGG ITEM FACTORY ─────────────────────────────────────────
export function makeEgg(eggTypeId,acquiredAt=Date.now()){
  const def=EGG_TYPES[eggTypeId];if(!def)return null;
  return{
    id:`egg_${Date.now()}_${rand(0,9999)}`,
    isEgg:true,eggType:eggTypeId,
    name:def.name,emoji:def.emoji,
    image:`img/eggs/${eggTypeId}_egg.svg`,
    rarity:eggTypeId,
    acquiredAt,placedAt:acquiredAt,
    type:"Egg",
    desc:`A ${def.name}. Incubates ${def.incubationMs>=3600000?def.incubationMs/3600000+"h":def.incubationMs/60000+"m"}.`,
    marketPrice:def.marketPrice,
    soulbound:false,
    val:0,base:0,stat:"def",
  };
}

// ── OPEN ONE CHEST ────────────────────────────────────────────
export function openChest(P){
  const rewards=[];
  if(Math.random()<CFG.DUNGEON_CHEST_EGG_CHANCE){
    const eggType=rollEggRarity();
    const egg=makeEgg(eggType);
    P.inventory=[...(P.inventory||[]),egg];
    rewards.push({type:"egg",item:egg});
  }else{
    const goldGain=rand(20+P.level*3,60+P.level*8);
    P.gold=(P.gold||0)+goldGain;
    rewards.push({type:"gold",amount:goldGain});
    if(Math.random()<0.40){
      const item=spawnItemFromPool(ITEMS,P.level);
      P.inventory=[...(P.inventory||[]),item];
      P.itemsFound=(P.itemsFound||0)+1;
      rewards.push({type:"item",item});
    }
  }
  return rewards;
}

// ── SHOP CHEST PRICE (daily scaling) ─────────────────────────
export function shopChestBuysToday(P){
  if(!P.shopChest)return 0;
  const today=new Date().toDateString();
  if(P.shopChest.date!==today)return 0;
  return P.shopChest.buys||0;
}
export function shopChestPrice(P){
  const buys=shopChestBuysToday(P);
  return Math.round(CFG.CHEST_BASE_PRICE*Math.pow(CFG.CHEST_PRICE_SCALE,buys));
}
export function recordShopChestBuy(P){
  const today=new Date().toDateString();
  if(!P.shopChest||P.shopChest.date!==today)P.shopChest={date:today,buys:0};
  P.shopChest.buys++;
}

// ── DUNGEON SYSTEM ────────────────────────────────────────────
export function startDungeon(P,dungeonId){
  const def=DUNGEONS.find(d=>d.id===dungeonId);if(!def)return{ok:false,msg:"Unknown dungeon"};
  if(P.activeDungeon)return{ok:false,msg:"Already in a dungeon!"};
  P.activeDungeon={id:dungeonId,startedAt:Date.now(),endsAt:Date.now()+def.durationMs};
  return{ok:true,def};
}
export function getDungeonProgress(P){
  if(!P.activeDungeon)return null;
  const def=DUNGEONS.find(d=>d.id===P.activeDungeon.id);if(!def)return null;
  const now=Date.now();
  const elapsed=now-P.activeDungeon.startedAt;
  const pct=Math.min(1,elapsed/def.durationMs);
  const done=now>=P.activeDungeon.endsAt;
  const remaining=Math.max(0,P.activeDungeon.endsAt-now);
  return{def,pct,done,remaining,elapsed};
}
export function claimDungeon(P){
  const prog=getDungeonProgress(P);
  if(!prog)return{ok:false,msg:"No active dungeon"};
  if(!prog.done)return{ok:false,msg:"Not finished yet!"};
  const def=prog.def;
  let chestCount;
  if(def.chestChance<1&&Math.random()>def.chestChance){
    chestCount=0;
  }else{
    chestCount=def.minChests+Math.floor(Math.random()*(def.maxChests-def.minChests+1));
  }
  const allRewards=[];
  for(let i=0;i<chestCount;i++){
    const r=openChest(P);
    allRewards.push(...r);
  }
  const expGain=Math.round(def.expBase+P.level*def.expPerLevel);
  const goldGain=Math.round(def.goldBase+P.level*def.goldPerLevel);
  P.exp=(P.exp||0)+expGain;
  P.gold=(P.gold||0)+goldGain;
  P.activeDungeon=null;
  return{ok:true,chestCount,allRewards,expGain,goldGain,def};
}
export function abandonDungeon(P){
  if(!P.activeDungeon)return;
  P.activeDungeon=null;
}

// ── TIME FORMATTER ────────────────────────────────────────────
export function fmtDuration(ms){
  if(ms<=0)return"Done!";
  const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000),s=Math.floor((ms%60000)/1000);
  if(h>0)return`${h}h ${m}m`;
  if(m>0)return`${m}m ${s}s`;
  return`${s}s`;
}

// ── EGG HATCHING ─────────────────────────────────────────────
export function rollEggHatch(eggTypeId){
  const def=EGG_TYPES[eggTypeId];if(!def)return null;
  const w=def.rarityWeights;
  const total=Object.values(w).reduce((a,b)=>a+b,0);
  let r=Math.random()*total,chosenRarity="common";
  for(const[rar,wt]of Object.entries(w)){r-=wt;if(r<=0){chosenRarity=rar;break;}}
  const pool=PETS.filter(p=>p.rarity===chosenRarity);
  const src=pool.length?pool:PETS;
  const template=src[Math.floor(Math.random()*src.length)];
  const isShiny=Math.random()<SHINY_CHANCE;
  return{
    ...template,
    id:`pet_${Date.now()}_${rand(0,9999)}`,
    petLevel:1,petExp:0,
    hunger:100,isShiny,weakened:false,weakenedBattles:0,
    hatchedAt:Date.now(),soulbound:true,
    val:template.base,base:template.base,
  };
}
export function canHatchEgg(egg){
  if(!egg||!egg.isEgg)return{ok:false,reason:"Not an egg"};
  const def=EGG_TYPES[egg.eggType];if(!def)return{ok:false,reason:"Unknown egg type"};
  return{ok:true};
}

// ── PET HELPERS ───────────────────────────────────────────────
export const petExpNeeded=lv=>Math.floor(18*Math.pow(1.07,(lv||1)-1));
export function gainPetExp(pet,amount){
  if(!pet||!pet.petLevel)return pet;
  pet=Object.assign({},pet);
  pet.petExp=(pet.petExp||0)+amount;
  while(pet.petExp>=petExpNeeded(pet.petLevel)){
    pet.petExp-=petExpNeeded(pet.petLevel);
    pet.petLevel++;
    const gain=1+(pet.petLevel%10===0?1:0);
    pet.val=(pet.val||pet.base||1)+gain;
  }
  return pet;
}
export function getPetMood(pet){
  if(!pet)return null;
  const h=pet.hunger??100;
  if(h<=0)return"Starving";
  if(h<=50)return"Hungry";
  return"Happy";
}
export function getPetPowerMult(pet){
  if(!pet)return 1;
  const m=getPetMood(pet);
  if(m==="Starving")return 0;
  if(m==="Hungry")return 0.5;
  return 1.0;
}
export function drainPetHunger(pet,amount=1){
  if(!pet)return pet;
  pet=Object.assign({},pet);
  pet.hunger=Math.max(0,(pet.hunger??100)-amount);
  pet.weakened=false;
  pet.weakenedBattles=0;
  return pet;
}
export function feedPet(pet,P){
  if(!pet)return{pet,cost:0,ok:false,msg:"No pet"};
  const costs={common:50,uncommon:125,rare:300,epic:750,legendary:2000};
  const cost=costs[pet.rarity]||100;
  if((P.gold||0)<cost)return{pet,cost,ok:false,msg:`Need 🪙${cost} to feed`};
  pet=Object.assign({},pet);
  pet.hunger=100;
  pet.weakened=false;
  pet.weakenedBattles=0;
  return{pet,cost,ok:true};
}
export function getActivePet(P){
  if(!P||!P.activePetId)return null;
  return(P.petCollection||[]).find(p=>p.id===P.activePetId)||null;
}
export function saveActivePet(P,updatedPet){
  if(!updatedPet||!P)return;
  P.petCollection=(P.petCollection||[]).map(p=>p.id===updatedPet.id?updatedPet:p);
}
