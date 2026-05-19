// ============================================================
//  MicroMMO — ui.js
// ============================================================
import{CFG,UI,PLAYER_AVATAR,EQUIP_SLOTS,SLOT_EMOJI,RARITY_COLOR,TIER_EMOJIS,
  ARENA_TIERS,PROPERTIES,SHOP_CONSUMABLES,ITEMS,PETS,AVATARS,CHOICE_EVENTS,WALK_AREAS,WEATHER_TYPES,WALK_EVENTS,DUNGEONS,EGG_TYPES}from"./data.js";
import{rand,clamp,fmt,expLv,maxHpCalc,SFX,unlockAudio,
  equipStats,arenaT,qualityLabel,rollAvatar,rollItemStat,spawnItemScaled,spawnItemFromPool,
  spawnMonster,calcMaxEnergy,getRentalIncome,countOwned,propertyPrice,getOwnedProperties,
  getActiveAvatar,getQuests,updateQuestProgress,applyConsumable,simulateFight,newPlayer,
  rollWeather,getComboMult,getComboTier,comboLabel,salvageShards,upgradeItemCost,canUpgrade,applyUpgrade,
  startDungeon,getDungeonProgress,claimDungeon,abandonDungeon,fmtDuration,
  rollEggRarity,makeEgg,shopChestPrice,recordShopChestBuy,rollEggHatch,canHatchEgg,
  gainPetExp,getPetMood,getPetPowerMult,drainPetHunger,feedPet,getActivePet as getActiveBattlePet,saveActivePet,petExpNeeded}from"./engine.js";
import{db,auth,gp,saveP as fbSaveP,loadP,loadLeaderboard,getListings,addListing,removeListing,
  getBounties,getGuild,trackCirculation,getCirculation,
  getParty,createParty,inviteToParty,acceptPartyInvite,leaveParty,kickFromParty,updatePartyMemberStats,disbandParty,
  onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,
  signInWithPopup,signOut,doc,getDoc,setDoc,deleteDoc,updateDoc,
  collection,getDocs,addDoc,arrayUnion,arrayRemove,increment}from"./firebase.js";

export let CU=null,P=null,TAB="home",CURRENT_AREA=null;
let INVENTORY_SORT="newest"; // newest|rarity|type|stat_str|stat_def
export let feed=[],combatState=null;
let combatInterval=null,energyInterval=null,walkRegenInterval=null,partyHeartbeatInterval=null;
let currentWeather=null;
export function setCU(u){CU=u;}
export function setP(data){P=data;}
function saveP(){return fbSaveP(CU?.uid,P);}
function pick(a){return a[Math.floor(Math.random()*a.length)];}

function normalizePet(pet){
  if(!pet)return pet;
  return{
    ...pet,
    id:pet.id||`pet_${Date.now()}_${rand(0,9999)}`,
    type:"Pet",
    petLevel:pet.petLevel||1,
    petExp:pet.petExp||0,
    hunger:pet.hunger??100,
    isShiny:!!pet.isShiny,
    soulbound:true,
    val:pet.val||pet.base||1,
    base:pet.base||pet.val||1
  };
}
function migrateOldPets(){
  if(!P)return;
  P.petCollection=(P.petCollection||[]).map(normalizePet);
  if(P.equipped?.Pet){
    const old=normalizePet(P.equipped.Pet);
    const exists=P.petCollection.some(p=>p.id===old.id);
    if(!exists)P.petCollection.push(old);
    if(!P.activePetId)P.activePetId=old.id;
    delete P.equipped.Pet;
  }
  P.inventory=(P.inventory||[]).filter(item=>{
    if(item&&item.type==="Pet"&&!item.isEgg){
      const pet=normalizePet(item);
      const exists=P.petCollection.some(p=>p.id===pet.id);
      if(!exists)P.petCollection.push(pet);
      if(!P.activePetId)P.activePetId=pet.id;
      return false;
    }
    return true;
  });
}
function activePet(){return getActiveBattlePet(P);}
function petImage(pet,size=36){return pet?gfx(pet.image,pet.emoji,size):"";}
function stepActivePet(){
  const pet=activePet();if(!pet)return;
  const beforeLevel=pet.petLevel||1,beforeMood=getPetMood(pet);
  let updated=gainPetExp(drainPetHunger(pet,1),1);
  saveActivePet(P,updated);
  if(updated.petLevel>beforeLevel){
    toast(`🐾 ${updated.name} reached Lv.${updated.petLevel}!`);
    spawnFlavorText(`${updated.name} Lv.${updated.petLevel}!`,"🐾");
  }
  const afterMood=getPetMood(updated);
  if(beforeMood!==afterMood&&(afterMood==="Hungry"||afterMood==="Starving"))toast(`🍖 ${updated.name} is ${afterMood.toLowerCase()}!`);
}
function eggRarityColor(egg){return RARITY_COLOR[egg?.rarity]||EGG_TYPES[egg?.eggType]?.color||"#6b7280";}


// Pets and items use hyphenated filenames on GitHub (e.g. baby-slime.svg, rusty-sword.svg)
// Monsters and avatars use underscored filenames (e.g. goblin_scout.svg, av_wolf.svg)
// So we only convert underscores→hyphens for img/pets/ and img/items/ paths.
function fixImgPath(src){
  if(!src)return src;
  if(src.startsWith("img/pets/")||src.startsWith("img/items/"))return src.replace(/_/g,"-");
  return src;
}

// Image renderer: renders emoji immediately, then tries to load SVG over it.
// Uses a post-render JS hook to swap emoji->image cleanly, avoiding all onerror issues.
let _gfxId=0;
function _gfxWrap(imgSrc,emoji,size,extraStyle){
  const id='gfx'+(++_gfxId);
  const fixedSrc=fixImgPath(imgSrc);
  // Schedule image load after this render cycle
  setTimeout(()=>{
    const el=document.getElementById(id);
    if(!el||!fixedSrc)return;
    const img=new Image();
    img.onload=()=>{el.style.backgroundImage=`url('${fixedSrc}')`;el.style.backgroundSize='contain';el.style.backgroundRepeat='no-repeat';el.style.backgroundPosition='center';el.textContent='';};
    img.src=fixedSrc;
  },0);
  return`<span id="${id}" style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;flex-shrink:0;font-size:${Math.round(size*0.75)}px;${extraStyle||''}">${emoji}</span>`;
}
export function gfx(image,emoji,size=32){
  if(image)return _gfxWrap(image,emoji,size,'');
  return`<span style="font-size:${Math.round(size*0.75)}px;display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px">${emoji}</span>`;
}
export function avatarGfx(size=32){
  const av=getActiveAvatar(P);
  const em=av?av.emoji:PLAYER_AVATAR.emoji;
  const img=av?av.image:PLAYER_AVATAR.image;
  if(img)return _gfxWrap(img,em,size,'border-radius:4px;overflow:hidden;');
  return`<span style="font-size:${Math.round(size*0.75)}px">${em}</span>`;
}
export function avatarGfxFor(plyr,size=24){
  const id=plyr.activeAvatar,av=id?AVATARS.find(a=>a.id===id):null;
  const em=av?av.emoji:PLAYER_AVATAR.emoji;
  const img=av?av.image:'';
  if(img)return _gfxWrap(img,em,size,'border-radius:3px;overflow:hidden;');
  return`<span style="font-size:${Math.round(size*0.7)}px">${em}</span>`;
}
export function showModal(html){
  document.getElementById("modal-content").innerHTML=html;
  const ov=document.getElementById("modal-overlay");ov.style.display="flex";ov.style.pointerEvents="auto";
}
export function toast(msg,color=""){
  const el=document.createElement("div");el.className="toast";el.textContent=msg;
  if(color)el.style.borderColor=color;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(()=>{el.classList.add("dying");setTimeout(()=>el.remove(),300);},2800);
}
export function closeModal(){
  const ov=document.getElementById("modal-overlay");ov.style.display="none";ov.style.pointerEvents="none";
  if(combatState&&combatState.done){combatState=null;P.activeCombat=null;saveP();updateWalkUI();}
  else if(combatState&&!combatState.done){
    clearInterval(combatInterval);combatInterval=null;
    P.activeCombat=serializeCombat(combatState);saveP();if(TAB==="home")renderHome();
  }
}
export function showScreen(id){document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));document.getElementById(id).classList.add("active");}
export function updateHdr(){
  const btn=document.getElementById("nav-walk");
  if(btn){btn.classList.toggle("no-energy",!P||P.energy<1);btn.textContent="👣";}
  const ha=document.getElementById("hdr-avatar-el");if(ha)ha.innerHTML=avatarGfx(30);
  const hh=document.getElementById("hdr-hp");if(hh)hh.textContent=`❤️ ${P?P.hp:0}`;
  const hl=document.getElementById("hdr-level");if(hl)hl.textContent=`Lv.${P?P.level:1}`;
}
export function showTab(tab){
  TAB=tab;const walkEl=document.getElementById("walk-screen");
  if(tab==="walk"){if(!currentWeather)currentWeather=rollWeather();walkEl.classList.add("active");updateWalkUI();startWalkRegenTimer();renderWalkFeed();return;}
  walkEl.classList.remove("active");if(walkRegenInterval){clearInterval(walkRegenInterval);walkRegenInterval=null;}
  ["home","gear","market","social","pvp"].forEach(t=>{const b=document.getElementById("nav-"+t);if(b)b.classList.remove("active");});
  const a=document.getElementById("nav-"+tab);if(a)a.classList.add("active");SFX.click();
  if(tab==="home")renderHome();else if(tab==="gear")renderGear();else if(tab==="market")renderMarket();
  else if(tab==="social")renderSocial();else if(tab==="you")renderYou();else if(tab==="quests")renderQuests();
  else if(tab==="pvp")renderPvP();else if(tab==="bank")renderBank();else if(tab==="properties")renderProperties();
  else if(tab==="guild")renderGuild();
}
export function hideWalk(){
  document.getElementById("walk-screen").classList.remove("active");
  if(walkRegenInterval){clearInterval(walkRegenInterval);walkRegenInterval=null;}
  TAB="home";document.getElementById("nav-home").classList.add("active");renderHome();
}
export function showErr(m){const e=document.getElementById("auth-error");e.textContent=m;e.style.display="block";}
export function hideErr(){document.getElementById("auth-error").style.display="none";}
export function switchAuthTab(t){
  document.getElementById("tab-login").classList.toggle("active",t==="login");
  document.getElementById("tab-register").classList.toggle("active",t==="register");
  document.getElementById("reg-username-group").style.display=t==="register"?"block":"none";hideErr();
}
export async function handleEmailAuth(){
  const email=document.getElementById("auth-email").value.trim(),pw=document.getElementById("auth-password").value;
  const isLogin=document.getElementById("tab-login").classList.contains("active");
  hideErr();if(!email||!pw){showErr("Please fill all fields");return;}
  try{if(isLogin)await signInWithEmailAndPassword(auth,email,pw);
  else{const un=document.getElementById("reg-username").value.trim();if(!un){showErr("Hero name required");return;}
    const c=await createUserWithEmailAndPassword(auth,email,pw);P=newPlayer(un);await setDoc(doc(db,"players",c.user.uid),P);startGame();}}
  catch(e){showErr(e.message||"Auth failed");}
}
export async function handleGoogleAuth(){
  try{const c=await signInWithPopup(auth,gp);const ex=await loadP(c.user.uid);if(!ex)showScreen("username-screen");else{P=ex;startGame();}}
  catch(e){showErr("Google sign-in failed");}
}
export async function handleSetUsername(){
  const n=document.getElementById("new-username").value.trim();if(!n||!CU)return;
  P=newPlayer(n);await setDoc(doc(db,"players",CU.uid),P);startGame();
}
export function startGame(){
  if(P.statPoints===undefined)P.statPoints=0;if(P.bonusHp===undefined)P.bonusHp=0;
  if(P.properties===undefined)P.properties=[];if(P.homePropertyId===undefined)P.homePropertyId=null;
  if(P.homePropertyInstanceId===undefined)P.homePropertyInstanceId=null;if(P.guildId===undefined)P.guildId=null;
  if(P.pvpAttackLog===undefined)P.pvpAttackLog={};if(P.notifications===undefined)P.notifications=[];
  if(P.walkStreak===undefined)P.walkStreak=0;if(P.shards===undefined)P.shards=0;
  if(P.petCollection===undefined)P.petCollection=[];
  if(P.activePetId===undefined)P.activePetId=null;
  if(P.activeDungeon===undefined)P.activeDungeon=null;
  if(P.shopChest===undefined)P.shopChest=null;
  if(P.partyId===undefined)P.partyId=null;
  if(P.pendingPartyInvite===undefined)P.pendingPartyInvite=null;
  migrateOldPets();
  // Always recalculate maxHp on load so formula changes take effect immediately
  const{def:eDef}=equipStats(P.equipped||{});
  P.maxHp=maxHpCalc(P.level,(P.baseDef||5)+eDef,P.bonusHp||0);
  P.hp=clamp(P.hp,1,P.maxHp);
  const _maxE=calcMaxEnergy(P);P.energy=clamp(P.energy,0,_maxE);
  showScreen("game-screen");updateHdr();regenCheck();energyInterval=setInterval(regenCheck,15000);startPartyHeartbeat();
  if(P.activeCombat&&!combatState)combatState={...P.activeCombat,done:false};
  if(P.notifications&&P.notifications.length>0){setTimeout(()=>{P.notifications.forEach(n=>toast(n,"#f59e0b"));P.notifications=[];saveP();},1500);}
  showTab("home");
}
function regenCheck(){
  if(!P)return;const maxE=calcMaxEnergy(P);if(P.energy>=maxE)return;
  const pts=Math.floor((Date.now()-(P.lastEnergyTime||Date.now()))/CFG.ENERGY_REGEN_MS);
  if(pts>0){P.energy=clamp(P.energy+pts,0,maxE);P.lastEnergyTime=Date.now();saveP();if(TAB==="home")renderHome();updateHdr();updateWalkUI();}
}
function startPartyHeartbeat(){
  if(partyHeartbeatInterval)clearInterval(partyHeartbeatInterval);
  // Ping every 30s so party members know you are online (lastSeen < 60s = online)
  partyHeartbeatInterval=setInterval(()=>{
    if(!P||!P.partyId)return;
    updatePartyMemberStats(P.partyId,CU.uid,{...myPartyStats(),lastSeen:Date.now()}).catch(()=>{});
  },30000);
  // Also ping immediately on start
  if(P?.partyId)updatePartyMemberStats(P.partyId,CU.uid,{...myPartyStats(),lastSeen:Date.now()}).catch(()=>{});
}
function renderWeatherBanner(){
  const w=currentWeather;if(!w||w.id==="clear")return"";
  const bonuses=[];
  if(w.goldMult>1)bonuses.push(`🪙+${Math.round((w.goldMult-1)*100)}%`);
  if(w.expMult>1)bonuses.push(`✨+${Math.round((w.expMult-1)*100)}% XP`);
  if(w.monsterMult>1)bonuses.push(`⚔️+${Math.round((w.monsterMult-1)*100)}% monsters`);
  if(w.monsterMult<1)bonuses.push(`⚔️-${Math.round((1-w.monsterMult)*100)}% monsters`);
  if(w.lootMult>1)bonuses.push(`🎁+${Math.round((w.lootMult-1)*100)}% loot`);
  return`<div style="background:${w.color}18;border:1.5px solid ${w.color}55;border-radius:10px;padding:0.5rem 0.75rem;margin-bottom:0.5rem;display:flex;align-items:center;gap:0.6rem">
    <span style="font-size:1.3rem">${w.emoji}</span>
    <div style="flex:1"><div style="font-family:'Cinzel',serif;font-size:0.7rem;color:${w.color};font-weight:700">${w.name}</div>
      <div style="font-size:0.65rem;color:var(--text3)">${bonuses.join(" · ")||w.desc}</div></div></div>`;
}

export function updateWalkUI(){
  const maxE=calcMaxEnergy(P);
  const epText=document.getElementById("walk-ep-text"),epBar=document.getElementById("walk-ep-bar");
  const areaDisplay=document.getElementById("walk-area-display");
  const wa=document.getElementById("walk-avatar-el");
  if(epText)epText.textContent=`${P.energy}/${maxE}`;
  if(epBar)epBar.style.width=`${Math.round((P.energy/maxE)*100)}%`;
  if(wa)wa.innerHTML=avatarGfx(48);
  if(wa){
    let petEl=document.getElementById("walk-pet-el");
    const pet=activePet();
    if(pet){
      if(!petEl){
        petEl=document.createElement("div");
        petEl.id="walk-pet-el";
        petEl.style.cssText="position:absolute;left:calc(50% + 42px);bottom:31%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.55));z-index:3;pointer-events:none;";
        const world=document.getElementById("walk-world");if(world)world.appendChild(petEl);
      }
      const mood=getPetMood(pet);
      petEl.innerHTML=`${petImage(pet,34)}${mood==="Hungry"?`<span style="position:absolute;right:-6px;top:-6px;font-size:0.75rem">🍖</span>`:mood==="Starving"?`<span style="position:absolute;right:-6px;top:-6px;font-size:0.75rem">💤</span>`:""}`;
      petEl.style.display="flex";
    }else if(petEl)petEl.style.display="none";
  }
  if(areaDisplay){
    if(CURRENT_AREA){
      areaDisplay.innerHTML=`${CURRENT_AREA.emoji} ${CURRENT_AREA.name}`;
      areaDisplay.classList.add("selected");
      // Set world background to area theme
      const world=document.getElementById("walk-world");
      if(world&&CURRENT_AREA.bgCSS)world.style.cssText=CURRENT_AREA.bgCSS;
    }else{
      areaDisplay.textContent="🌍 Choose Area";
      areaDisplay.classList.remove("selected");
    }
  }
  const resumeBanner=document.getElementById("walk-resume-banner"),enemyName=document.getElementById("walk-enemy-name");
  if(resumeBanner){const hasCombat=(combatState&&!combatState.done)||P.activeCombat;
    resumeBanner.style.display=hasCombat?"flex":"none";
    if(hasCombat&&enemyName)enemyName.textContent=`vs ${(combatState?.monster||P.activeCombat?.monster)?.name||"Unknown"}`;}
  const comboEl=document.getElementById("walk-combo-label");
  if(comboEl){const streak=P.walkStreak||0;
    if(streak>=CFG.COMBO_TIERS[1]){
      comboEl.textContent=comboLabel(streak);
      comboEl.style.color=["","#f59e0b","#ef4444","#c084fc"][getComboTier(streak)]||"";
    }else{comboEl.textContent="";}}
  // Update no-energy world dim
  const world=document.getElementById("walk-world");
  if(world)world.style.opacity=P.energy<1?"0.6":"1";
}
function startWalkRegenTimer(){
  if(walkRegenInterval)clearInterval(walkRegenInterval);
  walkRegenInterval=setInterval(()=>{
    const maxE=calcMaxEnergy(P),label=document.getElementById("walk-regen-label");if(!label)return;
    if(P.energy>=maxE){label.textContent="Full ⚡";return;}
    const elapsed=Date.now()-(P.lastEnergyTime||Date.now());
    const tl=Math.max(0,CFG.ENERGY_REGEN_MS-(elapsed%CFG.ENERGY_REGEN_MS));
    label.textContent=`${Math.floor(tl/60000)}:${String(Math.floor((tl%60000)/1000)).padStart(2,"0")}`;updateWalkUI();
  },1000);
}
export function openAreaSelect(){
  SFX.click();const unlocked=WALK_AREAS.filter(a=>P.level>=a.minLevel),locked=WALK_AREAS.filter(a=>P.level<a.minLevel);
  const cards=unlocked.map(area=>{const isActive=CURRENT_AREA&&CURRENT_AREA.id===area.id;
    return`<div class="area-card ${isActive?"selected":""}" onclick="G.selectArea('${area.id}')">
      <div style="display:flex;align-items:center;gap:0.75rem">
        <div style="font-size:2rem;flex-shrink:0">${area.emoji}</div>
        <div style="flex:1"><div style="font-family:'Cinzel',serif;font-size:0.9rem;font-weight:700;color:${isActive?"var(--gold3)":"var(--text)"}">${area.name}</div>
          <div style="font-size:0.75rem;color:var(--text3)">${area.desc}</div>
          <div style="display:flex;gap:0.5rem;margin-top:0.3rem;flex-wrap:wrap">
            <span style="font-size:0.65rem;color:var(--text3)">Monsters Lv.${area.monsterMinLv}–${area.monsterMaxLv}</span>
            <span style="font-size:0.65rem;color:var(--green2);font-weight:600">+${Math.round((area.expMult-1)*100)}% EXP</span>
            <span style="font-size:0.65rem;color:var(--gold3);font-weight:600">+${Math.round((area.goldMult-1)*100)}% Gold</span>
            ${area.lootBonus>0?`<span style="font-size:0.65rem;color:var(--steel);font-weight:600">+${Math.round(area.lootBonus*100)}% Loot</span>`:""}
          </div></div>${isActive?`<span style="color:var(--gold3);font-weight:700">✓</span>`:""}
      </div></div>`;}).join("");
  const lockedCards=locked.map(a=>`<div class="area-card locked"><div style="display:flex;align-items:center;gap:0.75rem">
    <div style="font-size:2rem">🔒</div><div><div style="font-family:'Cinzel',serif;font-size:0.9rem">${a.name}</div>
      <div style="font-size:0.75rem;color:var(--text3)">Unlocks at Level ${a.minLevel}</div></div></div></div>`).join("");
  showModal(`<div class="modal-title">🗺️ Choose Your Area</div>${cards}${lockedCards}
    <button class="btn btn-ghost" style="margin-top:0.5rem" onclick="G.closeModal()">Close</button>`);
}
export function selectArea(id){CURRENT_AREA=WALK_AREAS.find(a=>a.id===id)||null;closeModal();updateWalkUI();SFX.click();}
export function renderWalkFeed(){
  // New UI: no feed div. Events show in the world directly.
  // Hide tap hint after first step
  if(feed.length>0){const hint=document.getElementById("walk-tap-hint");if(hint)hint.style.display="none";}
}
function addFeed(emoji,image,text,badge,color){
  feed.unshift({emoji,image,text,badge,color});if(feed.length>30)feed.pop();
}
function spawnFlavorText(text,emoji){
  const layer=document.getElementById("walk-flavor-layer");if(!layer)return;
  const el=document.createElement("div");
  el.className="walk-flavor";
  // Randomize horizontal position slightly
  const offset=(Math.random()-0.5)*60;
  el.style.cssText=`bottom:38%;left:calc(50% + ${offset}px);transform:translateX(-50%);`;
  el.textContent=`${emoji} ${text}`;
  layer.appendChild(el);
  setTimeout(()=>el.remove(),3200);
}
function spawnEventCard(emoji,title,type,color){
  const layer=document.getElementById("walk-flavor-layer");if(!layer)return;
  const el=document.createElement("div");
  el.className="walk-event-card";
  el.style.bottom="20%";
  el.style.borderColor=color||"rgba(255,255,255,0.2)";
  el.innerHTML=`<div class="walk-event-emoji">${emoji}</div>
    <div class="walk-event-title">${title}</div>
    <div class="walk-event-type">${type}</div>`;
  layer.appendChild(el);
  setTimeout(()=>{el.style.opacity="0";el.style.transform="translateX(-50%) translateY(-60px) scale(0.9)";el.style.transition="all 0.4s ease";setTimeout(()=>el.remove(),400);},2200);
}
function spawnFootprint(){
  const fp=document.getElementById("walk-footprints");if(!fp)return;
  const el=document.createElement("div");
  el.className="walk-footprint";
  const streak=P.walkStreak||0;
  const tier=getComboTier(streak);
  const colors=["rgba(255,255,255,0.4)","rgba(251,191,36,0.7)","rgba(239,68,68,0.8)","rgba(192,132,252,0.9)"];
  el.style.cssText=`left:calc(50% + ${(Math.random()-0.5)*20}px);bottom:${28+Math.random()*8}%;color:${colors[tier]};`;
  el.textContent="👣";
  fp.appendChild(el);
  setTimeout(()=>el.remove(),2600);
}
function questProgress(type,amount=1){
  if(!P.quests)return;
  P.quests.list.forEach(q=>{if(q.type===type&&q.progress<q.target){q.progress=Math.min(q.target,q.progress+amount);if(q.progress>=q.target&&!q.claimed)toast(`📜 Quest complete: ${q.name}!`);}});
  saveP();
}
function doAvatarHop(){
  const el=document.getElementById("walk-avatar-el");if(!el)return;
  el.classList.remove("hop");void el.offsetWidth;// reflow to restart animation
  el.classList.add("hop");
  setTimeout(()=>el.classList.remove("hop"),320);
  const pet=document.getElementById("walk-pet-el");if(pet){pet.style.transform="translateY(-8px)";setTimeout(()=>pet.style.transform="",180);}
  spawnFootprint();
}

export function takeStep(){
  unlockAudio();
  if(!P||P.energy<1){SFX.error();toast("⚡ No energy! Wait for regen.");return;}
  if(combatState&&!combatState.done){SFX.error();toast("⚔️ Finish your current battle first!");return;}
  if(!CURRENT_AREA){SFX.click();toast("Select an area first!");openAreaSelect();return;}
  SFX.step();doAvatarHop();
  P.energy--;P.steps=(P.steps||0)+1;P.walkStreak=(P.walkStreak||0)+1;
  stepActivePet();
  if(P.energy<calcMaxEnergy(P)&&!P.lastEnergyTime)P.lastEnergyTime=Date.now();
  updateHdr();updateWalkUI();questProgress("steps");
  const streak=P.walkStreak;
  if(CFG.COMBO_TIERS.slice(1).includes(streak)){const mult=CFG.COMBO_MULTS[getComboTier(streak)];SFX.combo();spawnFlavorText(`COMBO x${mult}!`,"🔥");toast(`🔥 Combo x${mult}! Keep stepping!`,"#f59e0b");}
  const w=currentWeather||{goldMult:1,expMult:1,monsterMult:1,lootMult:1};
  const comboMult=getComboMult(streak),area=CURRENT_AREA;
  const totalItemChance=(CFG.ITEM_CHANCE+(area.lootBonus||0))*w.lootMult;
  const totalMonsterChance=Math.min(CFG.MONSTER_CHANCE,0.22)*w.monsterMult; // capped so flavor text always has room
  const stepXp=Math.round((CFG.STEP_XP_BASE+P.level*CFG.STEP_XP_PER_LEVEL)*area.expMult*w.expMult*comboMult);
  P.exp=(P.exp||0)+stepXp;checkLevelUp();
  // ── PARTY STEP XP — 28% share, batched every 10 steps to avoid spamming Firebase ──
  if(P.partyId&&P.steps%10===0){
    const partyStepXp=Math.max(1,Math.round(stepXp*0.28));
    getParty(P.partyId).then(party=>{
      if(!party)return;
      (party.members||[]).filter(m=>m.uid!==CU.uid).forEach(m=>{
        updateDoc(doc(db,"players",m.uid),{exp:increment(partyStepXp*10)}).catch(()=>{});
      });
    }).catch(()=>{});
  }
  if(Math.random()<(CFG.WALK_EGG_CHANCE||0)){
    const egg=makeEgg(rollEggRarity());
    P.inventory=[...(P.inventory||[]),egg];P.itemsFound=(P.itemsFound||0)+1;
    SFX.chest();spawnEventCard(egg.emoji,egg.name,"🥚 Pet Egg",eggRarityColor(egg)+"66");
    toast(`${egg.emoji} Found a ${egg.name}!`);questProgress("items");saveP();renderWalkFeed();
    return;
  }
  const roll=Math.random();
  if(roll<totalMonsterChance){
    const m=spawnMonster(area,P.level);
    spawnEventCard(m.emoji,`Lv.${m.effectiveLv} ${m.name}`,"⚔️ Battle!","#ef444466");
    addFeed(m.emoji,m.image,`Encountered Lv.${m.effectiveLv} ${m.name}!`,"⚔️","#f87171");
    saveP();renderWalkFeed();setTimeout(()=>openCombatModal(m),600);
  }else if(roll<totalMonsterChance+CFG.GOLD_CHANCE){
    const g=Math.round(rand(5,25+P.level*2)*area.goldMult*w.goldMult*comboMult);P.gold=(P.gold||0)+g;SFX.gold();
    spawnFlavorText(`+${g} 🪙${comboMult>1?" x"+comboMult:""}`.trim(),"🪙");
    addFeed("🪙","",`Found gold in ${area.name}!`,`+${g}🪙`,"#fbbf24");
    saveP();renderWalkFeed();
  }else if(roll<totalMonsterChance+CFG.GOLD_CHANCE+totalItemChance){
    const item=spawnItemFromPool(ITEMS,P.level);
    P.inventory=[...(P.inventory||[]),item];P.itemsFound=(P.itemsFound||0)+1;
    const q=qualityLabel(item.val,item.base||item.val);
    const cur=P.equipped[item.type];
    const cStr=cur?(item.val>cur.val?` ▲+${item.val-cur.val}`:`▼${item.val-cur.val}`):"";
    const cColor=cur?(item.val>cur.val?"#4ade80":"#f87171"):"";
    SFX.itemFound();const lvlTag=item.itemLevel?` Lv.${item.itemLevel}`:"";
    addFeed(item.emoji,item.image,`Found <strong>${item.name}</strong>${lvlTag} <span style="color:${q.color};font-weight:700">${q.label}</span>${cStr?`<span style="color:${cColor}"> ${cStr}</span>`:""}`,item.rarity,RARITY_COLOR[item.rarity]);
    spawnEventCard(item.emoji,item.name,`+${item.val} ${item.stat==="str"?"STR":"DEF"} · ${item.rarity}`,RARITY_COLOR[item.rarity]+"66");
    toast(`${item.emoji} ${item.name}${lvlTag} (+${item.val}) ${q.label}${cStr}`);
    questProgress("items");tryAvatarDrop();trackCirculation(item.name);saveP();renderWalkFeed();
  }else if(roll<totalMonsterChance+CFG.GOLD_CHANCE+totalItemChance+CFG.CHOICE_EVENT_CHANCE){
    const evt=pick(CHOICE_EVENTS);saveP();renderWalkFeed();openChoiceEventModal(evt);
  }else{
    const wev=WALK_EVENTS[Math.floor(Math.random()*WALK_EVENTS.length)];
    spawnFlavorText(wev.text,wev.emoji);
    setTimeout(()=>spawnFlavorText(`+${stepXp} XP`,"✨"),800);
    addFeed(wev.emoji,"",wev.text,`+${stepXp} XP`,"#60a5fa");saveP();renderWalkFeed();
  }
}
export function openChoiceEventModal(evt){
  const choicesHtml=evt.choices.map((c,i)=>`<button class="btn btn-ghost" style="margin-bottom:0.4rem" onclick="G.resolveChoice('${evt.id}',${i})">${c.label}</button>`).join("");
  showModal(`<div style="text-align:center;font-size:3rem;margin-bottom:0.4rem">${evt.emoji}</div>
    <div class="modal-title">${evt.title}</div>
    <div style="text-align:center;color:var(--text3);font-size:0.88rem;margin-bottom:1.2rem">${evt.desc}</div>
    <div class="modal-actions">${choicesHtml}</div>`);
}
export function resolveChoice(evtId,choiceIdx){
  const evt=CHOICE_EVENTS.find(e=>e.id===evtId);if(!evt)return;
  const choice=evt.choices[choiceIdx],result=choice.outcome(P);
  const msg=typeof result.msg==="function"?result.msg():result.msg;
  const goldDelta=typeof result.gold==="function"?result.gold():result.gold||0;
  const hpDelta=typeof result.hp==="function"?result.hp():result.hp||0;
  if(goldDelta!==0){P.gold=Math.max(0,(P.gold||0)+goldDelta);goldDelta>0?SFX.gold():SFX.error();toast(goldDelta>0?`🪙 +${goldDelta} gold!`:`🪙 Lost ${Math.abs(goldDelta)} gold!`);}
  if(hpDelta!==0){P.hp=clamp((P.hp||0)+hpDelta,1,P.maxHp);toast(hpDelta>0?`❤️ +${Math.abs(hpDelta)} HP!`:`💔 -${Math.abs(hpDelta)} HP!`);}
  saveP();updateHdr();addFeed(evt.emoji,"",msg,choice.label,"rgba(100,100,100,0.6)");
  showModal(`<div style="text-align:center;font-size:3rem;margin-bottom:0.4rem">${evt.emoji}</div>
    <div class="modal-title">${evt.title}</div>
    <div style="text-align:center;color:var(--text2);font-size:0.92rem;margin:1rem 0;line-height:1.5">${msg}</div>
    ${goldDelta!==0?`<div style="text-align:center;color:${goldDelta>0?"var(--gold3)":"var(--crimson2)"};font-family:'Cinzel',serif;font-weight:700;margin-bottom:0.5rem">${goldDelta>0?"🪙 +"+goldDelta:"🪙 −"+Math.abs(goldDelta)}</div>`:""}
    ${hpDelta!==0?`<div style="text-align:center;color:${hpDelta>0?"var(--green2)":"var(--crimson2)"};font-family:'Cinzel',serif;font-weight:700;margin-bottom:0.5rem">${hpDelta>0?"❤️ +"+Math.abs(hpDelta)+" HP":"💔 −"+Math.abs(hpDelta)+" HP"}</div>`:""}
    <button class="btn btn-ghost" onclick="G.closeModal()" style="margin-top:0.5rem">Continue</button>`);
}

export function renderHome(){
  if(!P)return;
  const maxE=calcMaxEnergy(P);const{str:eStr,def:eDef}=equipStats(P.equipped);
  const tStr=(P.baseStr||10)+eStr,tDef=(P.baseDef||5)+eDef;const expNeed=expLv(P.level);
  const hpPct=clamp(Math.round((P.hp/P.maxHp)*100),0,100);
  const expPct=clamp(Math.round((P.exp/expNeed)*100),0,100);
  const enPct=Math.round((P.energy/maxE)*100);
  const elapsed=Date.now()-(P.lastEnergyTime||Date.now());
  const tl=Math.max(0,CFG.ENERGY_REGEN_MS-(elapsed%CFG.ENERGY_REGEN_MS));
  const timerStr=P.energy>=maxE?"Full":`${Math.floor(tl/60000)}:${String(Math.floor((tl%60000)/1000)).padStart(2,"0")}`;
  const qs=getQuests(P),qDone=qs.filter(q=>q.progress>=q.target).length;
  const tierIdx=arenaT(P.arenaWins||0),tier=ARENA_TIERS[tierIdx];
  const rentalPending=getRentalIncome(P);const homeProp=P.homePropertyId?PROPERTIES.find(p=>p.id===P.homePropertyId):null;
  const spBadge=P.statPoints>0?`<span style="background:var(--crimson2);color:white;border-radius:10px;font-size:0.62rem;padding:1px 6px;margin-left:0.4rem;font-weight:700">${P.statPoints}</span>`:"";
  const streak=P.walkStreak||0,comboMult=getComboMult(streak);updateHdr();
  document.getElementById("content").innerHTML=`
    <div class="player-banner"><div class="p-avatar">${avatarGfx(58)}</div>
      <div class="p-info"><div class="p-name">${P.username}${spBadge}</div>
        <div class="p-class">Level ${P.level} · <span style="color:${tier.color};font-weight:700">${tier.name}</span>${P.guildId?` · <span style="color:var(--purple2)">🛡️ Guild</span>`:""}</div>
        <div class="bar-wrap"><div class="bar-labels"><span>❤️ HP</span><span>${P.hp}/${P.maxHp}</span></div><div class="bar bar-hp"><div class="bar-fill" style="width:${hpPct}%"></div></div></div>
        <div class="bar-wrap"><div class="bar-labels"><span>✨ EXP</span><span>${fmt(P.exp)}/${fmt(expNeed)}</span></div><div class="bar bar-exp"><div class="bar-fill" style="width:${expPct}%"></div></div></div>
      </div></div>
    ${P.statPoints>0?`<div style="background:#fffbeb;border:1.5px solid #fcd34d;border-radius:12px;padding:0.85rem;margin-bottom:0.7rem;display:flex;align-items:center;gap:0.75rem">
      <div style="font-size:1.5rem">⬆️</div><div style="flex:1"><div style="font-family:'Cinzel',serif;font-size:0.82rem;color:var(--gold3);font-weight:700">${P.statPoints} Stat Point${P.statPoints>1?"s":""} Available!</div></div>
      <button class="btn btn-gold btn-sm" onclick="G.openStatModal()">Spend</button></div>`:""}
    ${streak>=CFG.COMBO_TIERS[1]?`<div style="background:#7c3aed18;border:1.5px solid #7c3aed55;border-radius:12px;padding:0.6rem 0.85rem;margin-bottom:0.7rem;display:flex;align-items:center;gap:0.6rem">
      <span style="font-size:1.3rem">🔥</span><div style="font-family:'Cinzel',serif;font-size:0.75rem;color:#7c3aed;font-weight:700">${comboLabel(streak)}</div></div>`:""}
    <div class="card"><div class="card-title">⚡ Energy</div>
      <div class="bar-wrap"><div class="bar-labels"><span>${P.energy}/${maxE} EP</span><span>${timerStr} to next</span></div><div class="bar bar-energy"><div class="bar-fill" style="width:${enPct}%"></div></div></div>
      ${homeProp?`<div style="font-size:0.72rem;color:var(--text3);margin-top:0.3rem">🏠 ${homeProp.name} gives +${homeProp.energyBonus} energy</div>`:""}
    </div>
    <div class="card"><div class="card-title">💰 Currencies</div>
      <div class="curr-row">
        <div class="curr-item"><div class="curr-amount">🪙 ${fmt(P.gold)}</div><div class="curr-label">Gold</div></div>
        <div class="curr-item" onclick="G.showTab('bank')" style="cursor:pointer"><div class="curr-amount">🏦 ${fmt(P.bank)}</div><div class="curr-label">Bank ›</div></div>
        <div class="curr-item"><div class="curr-amount">💎 ${P.diamonds}</div><div class="curr-label">Gems</div></div>
      </div></div>
    <div class="card"><div class="card-title">📊 Stats</div>
      <div class="stat-row">
        <div class="stat-badge"><em>⚔️ STR</em><strong>${tStr}</strong></div>
        <div class="stat-badge"><em>🛡️ DEF</em><strong>${tDef}</strong></div>
        <div class="stat-badge"><em>❤️ HP</em><strong>${P.maxHp}</strong></div>
        <div class="stat-badge"><em>💀 Kills</em><strong>${P.npcKills||0}</strong></div>
        <div class="stat-badge"><em>👣 Steps</em><strong>${fmt(P.steps||0)}</strong></div>
        <div class="stat-badge"><em>🧩 Shards</em><strong>${P.shards||0}</strong></div>
      </div></div>
    ${rentalPending>0?`<div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:0.85rem;margin-bottom:0.7rem;display:flex;align-items:center;gap:0.75rem">
      <div style="font-size:1.5rem">🏠</div><div style="flex:1"><div style="font-family:'Cinzel',serif;font-size:0.82rem;color:var(--green);font-weight:700">Rental Income Ready!</div><div style="font-size:0.75rem;color:var(--text3)">🪙${fmt(rentalPending)}</div></div>
      <button class="btn btn-green btn-sm" onclick="G.claimRent()">Collect</button></div>`:""}
    <div class="two-col" style="margin-bottom:0.5rem">
      <button class="btn btn-steel btn-sm" style="width:100%;padding:0.7rem" onclick="G.showTab('quests')">📜 Quests <span style="color:${qDone===3?"var(--green2)":"var(--gold2)"}">${qDone}/3</span></button>
      <button class="btn btn-purple btn-sm" style="width:100%;padding:0.7rem" onclick="G.showTab('pvp')">⚔️ PvP & Bounties</button>
    </div>
    <div class="two-col" style="margin-bottom:0.5rem">
      <button class="btn btn-green btn-sm" style="width:100%;padding:0.7rem" onclick="G.openPetCollection()">🐾 Pets <span style="color:var(--gold2)">${(P.petCollection||[]).length}</span></button>
      <button class="btn btn-gold btn-sm" style="width:100%;padding:0.7rem" onclick="G.launchDungeon()">🏰 Dungeons${P.activeDungeon?" · Active":""}</button>
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
export function openStatModal(){
  if(!P.statPoints||P.statPoints<1){toast("No stat points available!");return;}
  showModal(`<div class="modal-title">⬆️ Spend Stat Points</div>
    <div style="text-align:center;color:var(--text3);font-size:0.85rem;margin-bottom:1rem">You have <strong style="color:var(--gold3)">${P.statPoints}</strong> point${P.statPoints>1?"s":""} to spend.</div>
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
export function spendStat(stat){
  if(!P.statPoints||P.statPoints<1){toast("No stat points!");return;}P.statPoints--;SFX.equip();
  if(stat==="str"){P.baseStr=(P.baseStr||10)+1;toast("⚔️ +1 Strength!");}
  else if(stat==="def"){P.baseDef=(P.baseDef||5)+1;const{def:eDef}=equipStats(P.equipped);P.maxHp=maxHpCalc(P.level,P.baseDef+eDef,P.bonusHp||0);toast("🛡️ +1 Defence!");}
  else if(stat==="hp"){P.bonusHp=(P.bonusHp||0)+10;const{def:eDef}=equipStats(P.equipped);P.maxHp=maxHpCalc(P.level,(P.baseDef||5)+eDef,P.bonusHp);toast("❤️ +10 Max HP!");}
  saveP();if(P.statPoints>0)openStatModal();else{closeModal();renderHome();}
}
export function claimRent(){
  const income=getRentalIncome(P);if(income<=0){toast("🏠 No rental income yet!");return;}
  const now=Date.now();(P.properties||[]).forEach(op=>{if(op.instanceId!==P.homePropertyInstanceId)op.lastRentClaim=now;});
  P.gold=(P.gold||0)+income;saveP();SFX.gold();toast(`🏠 Collected 🪙${fmt(income)} in rent!`);
  if(TAB==="properties")renderProperties();if(TAB==="home")renderHome();
}
export function renderGear(){
  const rawInv=P.inventory||[],eq=P.equipped||{},slots=EQUIP_SLOTS.filter(s=>s!=="Pet");
  // ── SORT ──
  const RO={"legendary":0,"epic":1,"rare":2,"uncommon":3,"common":4};
  const sorted=[...rawInv.map((it,i)=>({...it,_origIdx:i}))];
  if(INVENTORY_SORT==="rarity")sorted.sort((a,b)=>(RO[a.rarity]??5)-(RO[b.rarity]??5)||(b.val||0)-(a.val||0));
  else if(INVENTORY_SORT==="type")sorted.sort((a,b)=>(a.type||"").localeCompare(b.type||"")||(b.val||0)-(a.val||0));
  else if(INVENTORY_SORT==="stat_str")sorted.sort((a,b)=>{if(a.stat==="str"&&b.stat!=="str")return -1;if(b.stat==="str"&&a.stat!=="str")return 1;return(b.val||0)-(a.val||0);});
  else if(INVENTORY_SORT==="stat_def")sorted.sort((a,b)=>{if(a.stat==="def"&&b.stat!=="def")return -1;if(b.stat==="def"&&a.stat!=="def")return 1;return(b.val||0)-(a.val||0);});
  else if(INVENTORY_SORT==="power")sorted.sort((a,b)=>(b.val||0)-(a.val||0));
  // newest = default, no sort needed
  const inv=sorted;
  const slotsHtml=slots.map(slot=>{const item=eq[slot],iconHtml=item?gfx(item.image,item.emoji,26):SLOT_EMOJI[slot];
    return`<div class="equip-slot ${item?"filled":""}" ${item?`onclick="G.openItemModal('equipped','${slot}')"`:""}> 
      <div class="es-icon">${iconHtml}</div>
      <div class="es-info">${item?`<div class="es-name" style="color:${RARITY_COLOR[item.rarity]}">${item.name}${item.upgrades?` <span style="color:var(--gold3)">+${item.upgrades}</span>`:""}</div><div class="es-stat">+${item.val} ${item.stat==="str"?"STR":"DEF"}${item.itemLevel?" · Lv."+item.itemLevel:""}</div>`:`<div class="es-empty">Empty</div>`}
      </div><div class="es-type">${slot}</div></div>`;}).join("");
  const sortBtns=["newest","rarity","type","power","stat_str","stat_def"].map(s=>{
    const labels={newest:"🕐 New",rarity:"💎 Rarity",type:"📦 Type",power:"⚡ Power",stat_str:"⚔️ STR",stat_def:"🛡️ DEF"};
    return`<button onclick="G.setInvSort('${s}')" style="padding:0.25rem 0.55rem;border:1.5px solid ${INVENTORY_SORT===s?"var(--steel)":"var(--border)"};border-radius:8px;background:${INVENTORY_SORT===s?"var(--steel)":"transparent"};color:${INVENTORY_SORT===s?"white":"var(--text3)"};font-size:0.62rem;cursor:pointer;font-family:'Cinzel',serif;white-space:nowrap">${labels[s]}</button>`;}).join("");
  const invHtml=inv.length===0?`<div class="inv-empty">No items yet — go explore!</div>`:
    inv.map((item)=>{
      const i=item._origIdx;
      if(item.isEgg){const hatch=canHatchEgg(item);const color=RARITY_COLOR[item.rarity]||"#6b7280";
        return`<div class="inv-item" onclick="G.openItemModalEgg(${i})">
          <span class="quality-badge" style="background:${color}22;color:${color}">${hatch.ok?"Ready":"Egg"}</span>
          <div class="inv-icon">${gfx(item.image,item.emoji,40)}</div>
          <div class="inv-item-name" style="color:${color}">${item.name}</div>
          <div class="inv-item-stat">${hatch.ok?"Ready to hatch":"Pet Egg"}</div></div>`;}
      const q=qualityLabel(item.val,item.base||item.val);const cur=P.equipped[item.type];
      const upg=item.upgrades?`<div style="position:absolute;bottom:3px;left:3px;font-size:0.55rem;font-family:'Cinzel',serif;color:var(--gold3);font-weight:700">+${item.upgrades}</div>`:"";
      const lockBadge=item.locked?`<div style="position:absolute;top:3px;right:3px;font-size:0.7rem;line-height:1">🔒</div>`:"";
      const cmpColor=cur?(item.val>cur.val?"#4ade80":"#f87171"):"";
      const cmpDot=cur?`<div style="position:absolute;top:3px;left:3px;width:6px;height:6px;border-radius:50%;background:${cmpColor}"></div>`:"";
      return`<div class="inv-item ${item.locked?"inv-item-locked":""}" onclick="G.openItemModal('inv',${i})">${cmpDot}
        <span class="quality-badge" style="background:${q.color}22;color:${q.color}">${q.label}</span>${upg}${lockBadge}
        <div class="inv-icon">${gfx(item.image,item.emoji,40)}</div>
        <div class="inv-item-name" style="color:${RARITY_COLOR[item.rarity]}">${item.name}</div>
        <div class="inv-item-stat">+${item.val} ${item.stat==="str"?"STR":"DEF"}${item.itemLevel?" · Lv."+item.itemLevel:""}</div></div>`;}).join("");
  document.getElementById("content").innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.4rem">
      <div class="section-hdr" style="margin:0">Equipped (${EQUIP_SLOTS.length} slots)</div>
      <div style="font-size:0.72rem;color:var(--text3)">🧩 ${P.shards||0} shards</div></div>
    <div class="equip-grid">${slotsHtml}</div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.4rem;margin-top:0.6rem">
      <div class="section-hdr" style="margin:0">Inventory (${rawInv.length})</div></div>
    <div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.6rem">${sortBtns}</div>
    <div class="inv-grid">${invHtml}</div>
    ${rawInv.filter(i=>!i.isEgg&&!i.locked&&i.type!=="Pet").length>1?`
    <div style="display:flex;gap:0.5rem;margin-top:0.75rem">
      <button class="btn btn-purple btn-sm" style="flex:1" onclick="G.openMassSalvage()">🧩 Mass Salvage</button>
      <button class="btn btn-gold btn-sm" style="flex:1" onclick="G.openMassSell()">🪙 Mass Sell</button>
    </div>`:""}`;
}
export function setInvSort(s){INVENTORY_SORT=s;renderGear();}
export async function openItemModal(source,idx){
  let item,isEquipped=false,slot=null;
  if(source==="equipped"){slot=idx;item=P.equipped[slot];isEquipped=true;}else item=(P.inventory||[])[idx];
  if(!item)return;SFX.click();
  if(item.isEgg&&!isEquipped){openItemModalEgg(idx);return;}
  if(item.type==="Pet"&&!item.isEgg){toast("🐾 Pets live in your pet collection now.");openPetCollection();return;}
  const color=RARITY_COLOR[item.rarity]||"#6b7280",q=qualityLabel(item.val,item.base||item.val);
  const curEquipped=P.equipped[item.type];
  const compare=curEquipped&&!isEquipped?`<div class="modal-row"><em>vs Equipped</em><span style="color:${item.val>curEquipped.val?"var(--green2)":"var(--crimson2)"}">
      ${item.val>curEquipped.val?"▲":"▼"}${Math.abs(item.val-curEquipped.val)} vs +${curEquipped.val}</span></div>`:"";
  const npcVal=Math.max(5,Math.floor((item.shopPrice||item.base*item.val*2||50)*CFG.SHOP_SELL_RATE));
  const canEquip=!item.itemLevel||(P.level||1)>=item.itemLevel;
  const itemLevelRow=item.itemLevel?`<div class="modal-row"><em>Item Level</em><span style="color:${canEquip?"var(--green2)":"var(--crimson2)"}">Lv.${item.itemLevel} ${canEquip?"✓":"(Need Lv."+item.itemLevel+")"}</span></div>`:"";
  const circ=await getCirculation(item.name);
  const circRow=`<div class="modal-row"><em>In Circulation</em><span style="color:var(--text3)">${circ>0?circ.toLocaleString()+" found worldwide":"Be the first!"}</span></div>`;
  const upgTimes=item.upgrades||0;
  const upgradeRow=item.type!=="Pet"?(canUpgrade(item)?(()=>{const{goldCost,shardCost}=upgradeItemCost(item);
    return`<div class="modal-row"><em>Upgrades</em><span>${upgTimes}/${CFG.UPGRADE_MAX_TIMES}</span></div>
      <div class="modal-row"><em>Upgrade Cost</em><span style="color:var(--text3)">🪙${fmt(goldCost)} + 🧩${shardCost}</span></div>`;})()
    :`<div class="modal-row"><em>Upgrades</em><span style="color:var(--text3)">${upgTimes}/${CFG.UPGRADE_MAX_TIMES} (Max)</span></div>`):"";
  const salvCount=salvageShards(item),gainAmt=Math.max(1,Math.round((item.base||item.val)*0.15));
  showModal(`<div class="modal-icon">${gfx(item.image,item.emoji,72)}</div>
    <div class="modal-title" style="color:${color}">${item.name}${upgTimes?` <span style="color:var(--gold3)">+${upgTimes}</span>`:""}</div>
    <div class="modal-rarity" style="color:${color}">${item.rarity}<span style="margin-left:0.5rem;color:${q.color};font-size:0.65rem;font-weight:700">${q.label}</span></div>
    <div class="modal-row"><em>Type</em><span>${item.type}</span></div>
    <div class="modal-row"><em>Stat</em><span style="color:${item.stat==="str"?"var(--crimson2)":"var(--steel)"}">+${item.val} ${item.stat==="str"?"STR":"DEF"}</span></div>
    <div class="modal-row"><em>Base Roll</em><span style="color:var(--text3)">~${item.base||"?"}</span></div>
    ${itemLevelRow}${upgradeRow}${circRow}
    <div class="modal-row"><em>NPC Value</em><span style="color:var(--text3)">🪙${npcVal}</span></div>${compare}
    <div class="modal-actions">
      ${isEquipped?`<button class="btn btn-ghost" onclick="G.unequipItem('${slot}')">Unequip</button>`
        :canEquip?`<button class="btn btn-gold" onclick="G.equipItem(${idx})">Equip</button>`
        :`<button class="btn btn-ghost" style="opacity:0.4" disabled>🔒 Need Lv.${item.itemLevel}</button>`}
      ${!isEquipped&&item.type!=="Pet"&&canUpgrade(item)?`<button class="btn btn-purple" onclick="G.upgradeItem(${idx})">⬆️ Upgrade (+${gainAmt} ${item.stat.toUpperCase()})</button>`:""}
      ${!isEquipped?`<button class="btn ${item.locked?"btn-gold":"btn-ghost"}" onclick="G.toggleLock(${idx})">${item.locked?"🔒 Locked — tap to unlock":"🔓 Lock Item"}</button>`:""}
      ${!isEquipped&&!item.locked?`<button class="btn btn-ghost" style="background:#6b728018" onclick="G.salvageItem(${idx})">🧩 Salvage (+${salvCount} shards)</button>`:""}
      ${!isEquipped&&!item.locked?`<button class="btn btn-purple" onclick="G.promptSell(${idx});G.closeModal()">List on Market</button>`:""}
      ${!isEquipped&&!item.locked?`<button class="btn btn-ghost" onclick="G.sellToNpc(${idx});G.closeModal()">Sell to NPC (🪙${npcVal})</button>`:""}
      ${!item.locked?`<button class="btn btn-danger" onclick="${isEquipped?`G.dropEquipped('${slot}')`:`G.dropInventory(${idx})`}">Drop Item</button>`:""}
      <button class="btn btn-ghost" onclick="G.closeModal()">Close</button>
    </div>`);
}
export function toggleLock(idx){
  const item=(P.inventory||[])[idx];if(!item||item.isEgg)return;
  item.locked=!item.locked;
  saveP();SFX.click();
  toast(item.locked?"🔒 Item locked — safe from mass actions":"🔓 Item unlocked");
  openItemModal("inv",idx);
}

// ── MASS SALVAGE ──────────────────────────────────────────────
export function openMassSalvage(){
  const inv=P.inventory||[];
  const eligible=inv.map((item,i)=>({item,i})).filter(({item})=>!item.isEgg&&!item.locked&&item.type!=="Pet");
  if(eligible.length===0){SFX.error();toast("No unlocked items to salvage!");return;}
  const totalShards=eligible.reduce((s,{item})=>s+salvageShards(item),0);
  const rarityGroups={};
  eligible.forEach(({item})=>{rarityGroups[item.rarity]=(rarityGroups[item.rarity]||0)+1;});
  const breakdown=Object.entries(rarityGroups).map(([r,c])=>`<div style="display:flex;justify-content:space-between;font-size:0.8rem;padding:0.2rem 0"><span style="color:${RARITY_COLOR[r]};font-weight:600;text-transform:capitalize">${r}</span><span>${c} item${c>1?"s":""}</span></div>`).join("");
  showModal(`<div class="modal-title">🧩 Mass Salvage</div>
    <div style="background:var(--bg3);border-radius:10px;padding:0.75rem;margin-bottom:0.75rem">
      ${breakdown}
      <div style="border-top:1px solid var(--border);margin-top:0.5rem;padding-top:0.5rem;display:flex;justify-content:space-between;font-family:'Cinzel',serif;font-size:0.85rem;font-weight:700">
        <span>${eligible.length} items</span><span style="color:var(--purple2)">🧩 +${totalShards} shards</span>
      </div>
    </div>
    <div style="font-size:0.78rem;color:var(--text3);margin-bottom:1rem;text-align:center">🔒 Locked items and eggs are excluded. This cannot be undone.</div>
    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.75rem">
      <button class="btn btn-ghost btn-sm" style="flex:1" onclick="G.openMassSalvageFilter('common')">Common only</button>
      <button class="btn btn-ghost btn-sm" style="flex:1" onclick="G.openMassSalvageFilter('uncommon')">≤ Uncommon</button>
      <button class="btn btn-ghost btn-sm" style="flex:1" onclick="G.openMassSalvageFilter('rare')">≤ Rare</button>
    </div>
    <div class="modal-actions">
      <button class="btn btn-purple" onclick="G.confirmMassSalvage(null)">🧩 Salvage All (${eligible.length})</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Cancel</button>
    </div>`);
}
export function openMassSalvageFilter(maxRarity){
  const RO={"common":4,"uncommon":3,"rare":2,"epic":1,"legendary":0};
  const maxRank=RO[maxRarity]??4;
  const inv=P.inventory||[];
  const eligible=inv.map((item,i)=>({item,i})).filter(({item})=>!item.isEgg&&!item.locked&&item.type!=="Pet"&&(RO[item.rarity]??0)>=maxRank);
  if(eligible.length===0){SFX.error();toast("No items match that filter!");return;}
  const totalShards=eligible.reduce((s,{item})=>s+salvageShards(item),0);
  showModal(`<div class="modal-title">🧩 Salvage ≤ ${maxRarity}?</div>
    <div style="text-align:center;padding:0.5rem;margin-bottom:0.75rem">
      <div style="font-family:'Cinzel',serif;font-size:1.1rem;color:var(--purple2);font-weight:700">${eligible.length} items → 🧩${totalShards} shards</div>
      <div style="font-size:0.78rem;color:var(--text3);margin-top:0.4rem">Locked items excluded. Cannot be undone.</div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-purple" onclick="G.confirmMassSalvage('${maxRarity}')">Confirm</button>
      <button class="btn btn-ghost" onclick="G.openMassSalvage()">Back</button>
    </div>`);
}
export function confirmMassSalvage(maxRarity){
  const RO={"common":4,"uncommon":3,"rare":2,"epic":1,"legendary":0};
  const maxRank=maxRarity!=null?(RO[maxRarity]??4):99;
  const inv=P.inventory||[];
  let shardsGained=0,count=0;
  const kept=inv.filter(item=>{
    if(item.isEgg||item.locked||item.type==="Pet")return true;
    if((RO[item.rarity]??0)<maxRank)return true; // keep higher rarity
    shardsGained+=salvageShards(item);count++;return false;
  });
  P.inventory=kept;P.shards=(P.shards||0)+shardsGained;
  saveP();closeModal();SFX.equip();
  toast(`🧩 Salvaged ${count} items! +${shardsGained} shards (total: ${P.shards})`);
  renderGear();
}

// ── MASS NPC SELL ─────────────────────────────────────────────
export function openMassSell(){
  const inv=P.inventory||[];
  const eligible=inv.map((item,i)=>({item,i})).filter(({item})=>!item.isEgg&&!item.locked&&item.type!=="Pet");
  if(eligible.length===0){SFX.error();toast("No unlocked items to sell!");return;}
  const totalGold=eligible.reduce((s,{item})=>s+Math.max(5,Math.floor((item.shopPrice||item.base*item.val*2||50)*CFG.SHOP_SELL_RATE)),0);
  const rarityGroups={};
  eligible.forEach(({item})=>{rarityGroups[item.rarity]=(rarityGroups[item.rarity]||0)+1;});
  const breakdown=Object.entries(rarityGroups).map(([r,c])=>`<div style="display:flex;justify-content:space-between;font-size:0.8rem;padding:0.2rem 0"><span style="color:${RARITY_COLOR[r]};font-weight:600;text-transform:capitalize">${r}</span><span>${c} item${c>1?"s":""}</span></div>`).join("");
  showModal(`<div class="modal-title">🪙 Mass Sell to NPC</div>
    <div style="background:var(--bg3);border-radius:10px;padding:0.75rem;margin-bottom:0.75rem">
      ${breakdown}
      <div style="border-top:1px solid var(--border);margin-top:0.5rem;padding-top:0.5rem;display:flex;justify-content:space-between;font-family:'Cinzel',serif;font-size:0.85rem;font-weight:700">
        <span>${eligible.length} items</span><span style="color:var(--gold3)">🪙 +${fmt(totalGold)}</span>
      </div>
    </div>
    <div style="font-size:0.78rem;color:var(--text3);margin-bottom:1rem;text-align:center">🔒 Locked items and eggs are excluded. This cannot be undone.</div>
    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.75rem">
      <button class="btn btn-ghost btn-sm" style="flex:1" onclick="G.openMassSellFilter('common')">Common only</button>
      <button class="btn btn-ghost btn-sm" style="flex:1" onclick="G.openMassSellFilter('uncommon')">≤ Uncommon</button>
      <button class="btn btn-ghost btn-sm" style="flex:1" onclick="G.openMassSellFilter('rare')">≤ Rare</button>
    </div>
    <div class="modal-actions">
      <button class="btn btn-gold" onclick="G.confirmMassSell(null)">🪙 Sell All (${eligible.length})</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Cancel</button>
    </div>`);
}
export function openMassSellFilter(maxRarity){
  const RO={"common":4,"uncommon":3,"rare":2,"epic":1,"legendary":0};
  const maxRank=RO[maxRarity]??4;
  const inv=P.inventory||[];
  const eligible=inv.map((item,i)=>({item,i})).filter(({item})=>!item.isEgg&&!item.locked&&item.type!=="Pet"&&(RO[item.rarity]??0)>=maxRank);
  if(eligible.length===0){SFX.error();toast("No items match that filter!");return;}
  const totalGold=eligible.reduce((s,{item})=>s+Math.max(5,Math.floor((item.shopPrice||item.base*item.val*2||50)*CFG.SHOP_SELL_RATE)),0);
  showModal(`<div class="modal-title">🪙 Sell ≤ ${maxRarity}?</div>
    <div style="text-align:center;padding:0.5rem;margin-bottom:0.75rem">
      <div style="font-family:'Cinzel',serif;font-size:1.1rem;color:var(--gold3);font-weight:700">${eligible.length} items → 🪙${fmt(totalGold)}</div>
      <div style="font-size:0.78rem;color:var(--text3);margin-top:0.4rem">Locked items excluded. Cannot be undone.</div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-gold" onclick="G.confirmMassSell('${maxRarity}')">Confirm</button>
      <button class="btn btn-ghost" onclick="G.openMassSell()">Back</button>
    </div>`);
}
export function confirmMassSell(maxRarity){
  const RO={"common":4,"uncommon":3,"rare":2,"epic":1,"legendary":0};
  const maxRank=maxRarity!=null?(RO[maxRarity]??4):99;
  const inv=P.inventory||[];
  let goldGained=0,count=0;
  const kept=inv.filter(item=>{
    if(item.isEgg||item.locked||item.type==="Pet")return true;
    if((RO[item.rarity]??0)<maxRank)return true;
    goldGained+=Math.max(5,Math.floor((item.shopPrice||item.base*item.val*2||50)*CFG.SHOP_SELL_RATE));
    count++;return false;
  });
  P.inventory=kept;P.gold=(P.gold||0)+goldGained;
  saveP();closeModal();SFX.gold();
  toast(`🪙 Sold ${count} items for ${fmt(goldGained)} gold!`);
  updateHdr();renderGear();
}

export function salvageItem(idx){
  const item=(P.inventory||[])[idx];if(!item)return;
  if(item.isEgg){SFX.error();toast("🥚 Eggs cannot be salvaged.");return;}
  if(item.locked){SFX.error();toast("🔒 Unlock this item first!");return;}
  const shards=salvageShards(item);
  showModal(`<div class="modal-title">🧩 Salvage Item?</div>
    <div style="text-align:center;font-size:2.5rem;margin:0.4rem 0">${item.emoji||"⚔️"}</div>
    <div style="text-align:center;color:var(--text3);font-size:0.88rem;margin-bottom:1rem">
      Destroy <strong style="color:${RARITY_COLOR[item.rarity]}">${item.name}</strong> for <strong style="color:var(--purple2)">🧩${shards} shards</strong>?<br>
      <span style="font-size:0.78rem">Cannot be undone.</span></div>
    <div class="modal-actions"><button class="btn btn-purple" onclick="G.confirmSalvage(${idx})">🧩 Salvage</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Cancel</button></div>`);
}
export function confirmSalvage(idx){
  const item=(P.inventory||[])[idx];if(!item)return;if(item.isEgg){SFX.error();toast("🥚 Eggs cannot be salvaged.");return;}const shards=salvageShards(item);
  P.inventory=P.inventory.filter((_,i)=>i!==idx);P.shards=(P.shards||0)+shards;
  saveP();closeModal();SFX.equip();toast(`🧩 Salvaged! +${shards} shards (total: ${P.shards})`);renderGear();
}
export function upgradeItem(idx){
  const item=(P.inventory||[])[idx];if(!item)return;if(!canUpgrade(item)){toast("Max upgrades reached!");return;}
  const{goldCost,shardCost}=upgradeItemCost(item);
  if((P.gold||0)<goldCost){SFX.error();toast(`Need 🪙${fmt(goldCost)}!`);return;}
  if((P.shards||0)<shardCost){SFX.error();toast(`Need 🧩${shardCost} shards!`);return;}
  const gain=Math.max(1,Math.round((item.base||item.val)*0.15));
  P.gold-=goldCost;P.shards-=shardCost;P.inventory[idx]=applyUpgrade(item);
  saveP();closeModal();SFX.equip();toast(`⬆️ ${item.name} upgraded! +${gain} ${item.stat.toUpperCase()}`);renderGear();
}
export function equipItem(idx){
  const item=(P.inventory||[])[idx];if(!item)return;
  if(item.itemLevel&&(P.level||1)<item.itemLevel){SFX.error();toast(`🔒 Need Level ${item.itemLevel}!`);return;}
  const eq={...(P.equipped||{})},inv=[...(P.inventory||[])];
  if(eq[item.type])inv.push(eq[item.type]);inv.splice(inv.findIndex(i=>i.id===item.id),1);
  eq[item.type]=item;P.equipped=eq;P.inventory=inv;
  const{def:eDef}=equipStats(eq);P.maxHp=maxHpCalc(P.level,(P.baseDef||5)+eDef,P.bonusHp||0);P.hp=clamp(P.hp,1,P.maxHp);
  saveP();closeModal();SFX.equip();toast(`✅ Equipped ${item.name}!`);renderGear();
}
export function unequipItem(slot){
  const item=P.equipped[slot];if(!item)return;P.inventory=[...(P.inventory||[]),item];delete P.equipped[slot];
  const{def:eDef}=equipStats(P.equipped);P.maxHp=maxHpCalc(P.level,(P.baseDef||5)+eDef,P.bonusHp||0);P.hp=clamp(P.hp,1,P.maxHp);
  saveP();closeModal();toast(`📦 Unequipped ${item.name}`);renderGear();
}
export function dropInventory(idx){const item=(P.inventory||[])[idx];if(!item)return;if(item.locked){SFX.error();toast("🔒 Unlock this item first!");return;}P.inventory=P.inventory.filter((_,i)=>i!==idx);saveP();closeModal();toast(`🗑️ Dropped ${item.name}`);renderGear();}
export function dropEquipped(slot){const item=P.equipped[slot];if(!item)return;delete P.equipped[slot];const{def:eDef}=equipStats(P.equipped);P.maxHp=maxHpCalc(P.level,(P.baseDef||5)+eDef,P.bonusHp||0);P.hp=clamp(P.hp,1,P.maxHp);saveP();closeModal();toast(`🗑️ Dropped ${item.name}`);renderGear();}

// ── COMBAT ───────────────────────────────────────────────────
export async function openCombatModal(monster){
  const{str:eStr,def:eDef}=equipStats(P.equipped);const pet=getActiveBattlePet(P)||null;
  // Load party members for this combat session
  let partyMembers=[];
  if(P.partyId){try{const party=await getParty(P.partyId);partyMembers=(party?.members||[]).filter(m=>m.uid!==CU.uid);}catch(e){}}
  combatState={monster,playerHp:P.hp,playerMaxHp:P.maxHp,monsterHp:monster.hp,
    pStr:(P.baseStr||10)+eStr,pDef:(P.baseDef||5)+eDef,pet,partyMembers,log:[],done:false,burnStacks:0,bleedStacks:0,stunned:false};
  if(partyMembers.length>0)combatState.log.push(`<span class="log-sys">⚔️ Party: ${partyMembers.map(m=>m.username).join(", ")} fighting with you!</span>`);
  P.activeCombat=serializeCombat(combatState);saveP();showModal("");renderCombatModal();
  combatInterval=setInterval(combatTick,700);updateWalkUI();
}
function serializeCombat(cs){
  return{monster:cs.monster,playerHp:cs.playerHp,playerMaxHp:cs.playerMaxHp,
    monsterHp:cs.monsterHp,pStr:cs.pStr,pDef:cs.pDef,pet:cs.pet,log:cs.log.slice(-20)};
}
export function resumeCombat(){
  if(!P.activeCombat)return;combatState={...P.activeCombat,done:false,burnStacks:0,bleedStacks:0,stunned:false};
  showModal("");renderCombatModal();combatInterval=setInterval(combatTick,700);
}
export function abandonCombat(){
  clearInterval(combatInterval);const penalty=rand(10,30);
  P.gold=Math.max(0,(P.gold||0)-penalty);P.hp=Math.max(1,Math.floor(P.maxHp*0.4));P.walkStreak=0;
  P.activeCombat=null;combatState=null;saveP();updateHdr();closeModal();updateWalkUI();
  SFX.error();toast(`🏃 Fled! Lost ${penalty}🪙. Combo reset.`);
}
export function fleeCombat(){
  if(!combatState||combatState.done)return;clearInterval(combatInterval);combatState.done=true;
  const goldLost=rand(15,Math.min(80,Math.floor((P.gold||0)*0.1)+15));
  P.gold=Math.max(0,(P.gold||0)-goldLost);P.hp=combatState.playerHp;P.activeCombat=null;P.walkStreak=0;
  combatState.log.push(`<span class="log-sys">🏃 You fled! Lost ${goldLost}🪙. Combo reset.</span>`);
  renderCombatModal();saveP();updateHdr();updateWalkUI();SFX.error();toast(`🏃 Escaped! Dropped ${goldLost}🪙.`);
}
export function healInCombat(){
  if(!combatState||combatState.done)return;
  const smallP=SHOP_CONSUMABLES.find(c=>c.id==="potion_small"),bigP=SHOP_CONSUMABLES.find(c=>c.id==="potion_big");
  const canBig=(P.gold||0)>=bigP.price,canSmall=(P.gold||0)>=smallP.price;
  if(!canSmall){SFX.error();toast("💰 Can't afford potions!");return;}
  if(canBig&&P.hp<P.maxHp*0.5){P.gold-=bigP.price;const h=Math.floor(combatState.playerMaxHp*CFG.POTION_HEAL_BIG);
    combatState.playerHp=Math.min(combatState.playerMaxHp,combatState.playerHp+h);P.hp=combatState.playerHp;
    combatState.log.push(`<span class="log-win">💊 Major Potion! +${h} HP</span>`);}
  else{P.gold-=smallP.price;const h=Math.floor(combatState.playerMaxHp*CFG.POTION_HEAL_SMALL);
    combatState.playerHp=Math.min(combatState.playerMaxHp,combatState.playerHp+h);P.hp=combatState.playerHp;
    combatState.log.push(`<span class="log-win">🧪 Minor Potion! +${h} HP</span>`);}
  saveP();renderCombatModal();
}
function flashFighter(side){
  const el=document.getElementById(side==="player"?"combat-fighter-player":"combat-fighter-monster");
  if(!el)return;el.style.filter="brightness(3)";setTimeout(()=>{el.style.filter="";},120);
}
function renderCombatModal(){
  if(!combatState)return;const cs=combatState,m=cs.monster;
  const pPct=clamp((cs.playerHp/cs.playerMaxHp)*100,0,100);
  const mPct=clamp((cs.monsterHp/m.maxHp)*100,0,100);
  const smallPrice=SHOP_CONSUMABLES.find(c=>c.id==="potion_small")?.price||120;
  const canHeal=(P.gold||0)>=smallPrice,hpLow=cs.playerHp<cs.playerMaxHp;
  const pStatus=(cs.burnStacks>0?"🔥":"")+(cs.bleedStacks>0?"🩸":"")+(cs.stunned?"💫":"");
  const hpColor=pPct>50?"#16a34a,#4ade80":pPct>25?"#d97706,#fbbf24":"#dc2626,#ef4444";
  document.getElementById("modal-content").innerHTML=`
    <div class="combat-scene"><div class="fighters">
      <div class="fighter" id="combat-fighter-player" style="transition:filter 0.1s">
        <div class="f-img">${avatarGfx(56)}</div>
        <div class="f-name">${P.username}${cs.pet?" + "+cs.pet.name:""}${pStatus?" "+pStatus:""}</div>
        <div class="f-hp">${cs.playerHp}/${cs.playerMaxHp}</div>
        <div class="f-bar"><div class="f-bar-fill" style="width:${pPct}%;background:linear-gradient(90deg,${hpColor})"></div></div>
      </div>
      <div class="vs">VS</div>
      <div class="fighter" id="combat-fighter-monster" style="transition:filter 0.1s">
        <div class="f-img">${gfx(m.image,m.emoji,56)}</div>
        <div class="f-name">${m.name} Lv.${m.effectiveLv||"?"}</div>
        <div class="f-hp">${cs.monsterHp}/${m.maxHp}</div>
        <div class="f-bar"><div class="f-bar-fill" style="width:${mPct}%"></div></div>
      </div>
    </div></div>
    <div class="combat-log" id="combat-log">${cs.log.join("<br>")||`<span class="log-sys">${m.desc||"Battle commences..."}</span>`}</div>
    ${cs.done?`<button class="btn btn-ghost" onclick="G.closeModal()">Close</button>`
      :`<div style="display:flex;gap:0.5rem;margin-top:0.1rem">
          ${hpLow&&canHeal?`<button class="btn btn-green btn-sm" style="flex:1;padding:0.55rem" onclick="G.healInCombat()">🧪 Heal (🪙${smallPrice})</button>`
            :`<button class="btn btn-ghost btn-sm" style="flex:1;padding:0.55rem;opacity:0.4" disabled>🧪 Heal</button>`}
          <button class="btn btn-danger btn-sm" style="flex:1;padding:0.55rem" onclick="G.fleeCombat()">🏃 Flee</button>
        </div><div style="text-align:center;color:#94a3b8;font-size:0.75rem;margin-top:0.4rem;font-style:italic">⚔️ Auto-battling...</div>`}`;
  const log=document.getElementById("combat-log");if(log)log.scrollTop=log.scrollHeight;
}
function combatTick(){
  if(!combatState||combatState.done){clearInterval(combatInterval);return;}
  const cs=combatState,m=cs.monster;
  const comboMult=getComboMult(P.walkStreak||0);
  if(!cs.stunned){
    const pDefReduction=m.def/(m.def+150);let pDmg=Math.max(1,Math.round((cs.pStr*(1-pDefReduction)+rand(-3,6))*comboMult));
    const pCrit=Math.random()<(0.12+getComboTier(P.walkStreak||0)*0.03);
    if(pCrit)pDmg=Math.floor(pDmg*1.85);
    cs.monsterHp=Math.max(0,cs.monsterHp-pDmg);
    pCrit?SFX.crit():SFX.hit();flashFighter("monster");
    const v=["smashes","cleaves","strikes","hammers","slashes"][Math.floor(Math.random()*5)];
    cs.log.push(pCrit?`<span class="log-crit">⚡ CRIT! You ${v} ${m.name} for ${pDmg}!</span>`:`<span class="log-you">You ${v} ${m.name} for ${pDmg}</span>`);
    if(pCrit&&Math.random()<0.4){cs.burnStacks=(cs.burnStacks||0)+1;cs.log.push(`<span class="log-crit">🔥 ${m.name} is burning!</span>`);}
  }else{cs.stunned=false;cs.log.push(`<span class="log-sys">💫 Stunned! Lost your attack.</span>`);}
  if((cs.burnStacks||0)>0){
    const bd=Math.max(1,Math.round(cs.pStr*0.1*cs.burnStacks));cs.monsterHp=Math.max(0,cs.monsterHp-bd);
    cs.log.push(`<span class="log-crit">🔥 Burn: ${bd} dmg!</span>`);
    if(Math.random()<0.3)cs.burnStacks=Math.max(0,cs.burnStacks-1);
  }
  if(cs.pet&&cs.monsterHp>0){
    const mult=getPetPowerMult(cs.pet);
    const mood=getPetMood(cs.pet);
    if(mult>0){
      const pd=Math.max(1,Math.round((cs.pet.val||cs.pet.base||1)*0.18*mult)+rand(0,2));cs.monsterHp=Math.max(0,cs.monsterHp-pd);
      const pv=["bites","claws","pounces on","nips at"][Math.floor(Math.random()*4)];
      cs.log.push(`<span class="log-pet">${cs.pet.isShiny?"✨ ":""}${cs.pet.name}${mood&&mood!=="Happy"?" ("+mood+")":""} ${pv} ${m.name} for ${pd}!</span>`);
    }else{
      cs.log.push(`<span class="log-sys">🐾 ${cs.pet.name} is starving and cannot attack.</span>`);
    }
  }
  // ── PARTY MEMBER ATTACKS (like pets, cached per combat) ──
  if(cs.partyMembers&&cs.partyMembers.length>0&&cs.monsterHp>0){
    const now=Date.now();
    cs.partyMembers.forEach(m2=>{
      if(Math.random()<0.40){// 40% proc chance per member per round
        const isOnline=(now-(m2.lastSeen||m2.joinedAt||0))<60000;
        const mult=isOnline?1.0:0.5;
        const str=(m2.baseStr||10)+(m2.equipStr||0);
        const defR=m.def/(m.def+150);
        const pd=Math.max(1,Math.round((str*(1-defR)*0.35+rand(0,3))*mult));
        cs.monsterHp=Math.max(0,cs.monsterHp-pd);
        const pv=["strikes","assists","flanks","charges at","cuts into"][Math.floor(Math.random()*5)];
        const tag=isOnline?"log-pet":"log-sys";
        cs.log.push(`<span class="${tag}">⚔️ ${m2.username}${isOnline?"":" (offline)"} ${pv} ${m.name} for ${pd}!</span>`);
      }
    });
  }
  if(cs.monsterHp<=0){
    cs.done=true;clearInterval(combatInterval);
    cs.log.push(`<span class="log-win">🏆 ${m.name} defeated! +${m.expReward} EXP · +${m.goldReward}🪙</span>`);
    handleVictory(cs);renderCombatModal();
    setTimeout(()=>{const ov=document.getElementById("modal-overlay");if(ov&&ov.style.display!=="none")closeModal();},CFG.COMBAT_VICTORY_CLOSE_MS);
    return;
  }
  const mDefReduction=cs.pDef/(cs.pDef+150);let mDmg=Math.max(1,Math.round(m.str*(1-mDefReduction)+rand(-3,6)));const mCrit=Math.random()<0.09;if(mCrit)mDmg=Math.floor(mDmg*1.85);
  cs.playerHp=Math.max(0,cs.playerHp-mDmg);flashFighter("player");
  const mv=["slashes","bites","mauls","claws","crushes"][Math.floor(Math.random()*5)];
  cs.log.push(mCrit?`<span class="log-crit">💥 ${m.name} CRITS! ${mv} you for ${mDmg}!</span>`:`<span class="log-hit">${m.name} ${mv} you for ${mDmg}</span>`);
  if(mCrit&&Math.random()<(m.bleedChance||0.1)){cs.bleedStacks=(cs.bleedStacks||0)+1;cs.log.push(`<span class="log-hit">🩸 You are bleeding!</span>`);}
  if(!cs.stunned&&Math.random()<0.06){cs.stunned=true;cs.log.push(`<span class="log-hit">💫 ${m.name} stuns you!</span>`);}
  if((cs.bleedStacks||0)>0){
    const bld=Math.max(1,cs.bleedStacks*2);cs.playerHp=Math.max(0,cs.playerHp-bld);
    cs.log.push(`<span class="log-hit">🩸 Bleed: ${bld} dmg!</span>`);
    if(Math.random()<0.3)cs.bleedStacks=Math.max(0,cs.bleedStacks-1);
  }
  if(cs.playerHp<=0){
    cs.done=true;clearInterval(combatInterval);
    cs.log.push(`<span class="log-lose">💀 Defeated by ${m.name}...</span>`);
    handleDefeat(cs);renderCombatModal();
    setTimeout(()=>{const ov=document.getElementById("modal-overlay");if(ov&&ov.style.display!=="none")closeModal();},CFG.COMBAT_VICTORY_CLOSE_MS);
    return;
  }
  renderCombatModal();
}
async function handleVictory(cs){
  const m=cs.monster;SFX.victory();P.npcKills=(P.npcKills||0)+1;
  const comboMult=getComboMult(P.walkStreak||0);
  const goldGain=Math.round(m.goldReward*comboMult);
  P.gold=(P.gold||0)+goldGain;P.exp=(P.exp||0)+m.expReward;P.hp=cs.playerHp;
  questProgress("kills");checkLevelUp();
  // ── PARTY LOOT SHARE ──
  const partyMs=cs.partyMembers||[];
  if(partyMs.length>0){
    const partySize=partyMs.length+1; // +1 for self
    const now2=Date.now();
    for(const pm of partyMs){
      try{
        const isOnline=(now2-(pm.lastSeen||pm.joinedAt||0))<60000;
        const mult=isOnline?1.0:0.5;
        const shareGold=Math.round(goldGain*0.4*mult);
        const shareExp=Math.round(m.expReward*0.4*mult);
        await updateDoc(doc(db,"players",pm.uid),{
          gold:increment(shareGold),exp:increment(shareExp),
          notifications:arrayUnion(`⚔️ Party victory vs ${m.name}! +🪙${shareGold} +${shareExp} EXP${isOnline?"":" (offline 50%)"}`)
        });
      }catch(e){}
    }
    const onlineCount=partyMs.filter(m=>( Date.now()-(m.lastSeen||m.joinedAt||0))<60000).length;
    const offlineCount=partyMs.length-onlineCount;
    toast(`⚔️ Victory! +${m.expReward} EXP +${goldGain}🪙 · Party: ${onlineCount} online (100%) ${offlineCount>0?offlineCount+" offline (50%)":""}${comboMult>1?" x"+comboMult:""}`);
  }else{
    toast(`⚔️ Victory! +${m.expReward} EXP · +${goldGain}🪙${comboMult>1?" (x"+comboMult+")":""}`);
  }
  P.hp=clamp(P.hp,1,P.maxHp);combatState=null;P.activeCombat=null;saveP();updateHdr();updateWalkUI();
}
function handleDefeat(cs){
  SFX.defeat();const goldLost=Math.floor((P.gold||0)*0.08);
  P.gold=Math.max(0,(P.gold||0)-goldLost);P.hp=Math.max(1,Math.floor(P.maxHp*0.15));P.walkStreak=0;
  if(cs.pet){const up=drainPetHunger(cs.pet);saveActivePet(P,up);cs.pet=up;}
  toast(`💀 Defeated! Lost 🪙${fmt(goldLost)}. Combo reset.`,"#ef4444");
  combatState=null;P.activeCombat=null;saveP();updateHdr();updateWalkUI();
}
function checkLevelUp(){
  let leveled=false,levels=0;
  while(P.exp>=expLv(P.level)){P.exp-=expLv(P.level);P.level++;levels++;P.statPoints=(P.statPoints||0)+1;
    const{def:eDef}=equipStats(P.equipped);P.maxHp=maxHpCalc(P.level,(P.baseDef||5)+eDef,P.bonusHp||0);leveled=true;}
  if(leveled){P.hp=P.maxHp;SFX.levelUp();toast(`🎉 LEVEL UP! Now Level ${P.level}! +${levels} stat point${levels>1?"s":""}!`);updateHdr();}
}
function tryAvatarDrop(){
  if(Math.random()>CFG.AVATAR_DROP_CHANCE)return;
  const av=rollAvatar(),collected=P.avatars||[];
  if(collected.includes(av.id)){const bonus=rand(50,200);P.gold=(P.gold||0)+bonus;SFX.gold();toast(`✨ Duplicate avatar → 🪙${bonus} gold!`);saveP();return;}
  P.avatars=[...collected,av.id];saveP();
  const color=RARITY_COLOR[av.rarity]||"#6b7280";
  const imgHtml=gfx(av.image,av.emoji,80);
  SFX.chest();
  showModal(`<div style="text-align:center">
    <div style="font-size:0.72rem;color:var(--gold3);font-family:'Cinzel',serif;text-transform:uppercase;margin-bottom:0.5rem">✨ Avatar Unlocked!</div>
    <div style="width:80px;height:80px;margin:0 auto 0.5rem;display:flex;align-items:center;justify-content:center">${imgHtml}</div>
    <div style="font-family:'Cinzel',serif;font-size:1.05rem;color:${color};font-weight:700;margin-bottom:0.2rem">${av.name}</div>
    <div style="font-size:0.7rem;color:${color};text-transform:uppercase;font-weight:700;margin-bottom:0.5rem">${av.rarity}</div>
    <div style="font-size:0.82rem;color:var(--text3);font-style:italic;margin-bottom:1rem">"${av.desc}"</div>
    </div><div class="modal-actions">
      <button class="btn btn-gold" onclick="G.equipAvatar('${av.id}')">Equip This Avatar</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Save for Later</button>
    </div>`);
}
export function equipAvatar(id){P.activeAvatar=id;saveP();updateHdr();closeModal();SFX.equip();toast("✨ Avatar equipped!");if(TAB==="you")renderYou();}
export function openAvatarCollection(){
  const collected=P.avatars||[];
  if(collected.length===0){showModal(`<div class="modal-title">🎭 Avatars</div><div style="text-align:center;color:var(--text3);padding:1.5rem;font-style:italic">No avatars yet!</div><button class="btn btn-ghost" onclick="G.closeModal()">Close</button>`);return;}
  const rows=AVATARS.filter(a=>collected.includes(a.id)).map(av=>{
    const color=RARITY_COLOR[av.rarity],isActive=P.activeAvatar===av.id;
    const imgHtml=gfx(av.image,av.emoji,44);
    return`<div style="display:flex;align-items:center;gap:0.75rem;padding:0.65rem 0;border-bottom:1px solid var(--border)">
      <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${imgHtml}</div>
      <div style="flex:1;min-width:0"><div style="font-family:'Cinzel',serif;font-size:0.82rem;color:${color};font-weight:700">${av.name}</div>
        <div style="font-size:0.68rem;color:var(--text3)">${av.rarity} · "${av.desc}"</div></div>
      ${isActive?`<span style="font-size:0.7rem;color:var(--green2);font-weight:700">Active ✓</span>`:`<button class="btn btn-gold btn-sm" onclick="G.equipAvatar('${av.id}')">Equip</button>`}
    </div>`;
  }).join("");
  showModal(`<div class="modal-title">🎭 Avatars (${collected.length}/${AVATARS.length})</div>
    <div style="max-height:60vh;overflow-y:auto;margin-bottom:0.75rem">${rows}</div>
    <button class="btn btn-ghost" onclick="G.closeModal()">Close</button>`);
}

// ── MARKET ────────────────────────────────────────────────────
export async function renderMarket(){
  document.getElementById("content").innerHTML=`<div class="card"><div style="text-align:center;color:var(--text3);padding:1rem">Loading...</div></div>`;
  const listings=await getListings(),others=listings.filter(l=>l.sellerId!==CU.uid);
  document.getElementById("content").innerHTML=`
    <div class="tab-row" style="margin-bottom:0.75rem">
      <button class="tab-btn active" id="mtab-browse" onclick="G.mTab('browse')">Browse</button>
      <button class="tab-btn" id="mtab-sell" onclick="G.mTab('sell')">Sell</button>
      <button class="tab-btn" id="mtab-shop" onclick="G.mTab('shop')">NPC Shop</button>
      <button class="tab-btn" id="mtab-mine" onclick="G.mTab('mine')">My Listings</button>
    </div><div id="market-body"></div>`;
  renderMarketBrowse(others);
}
export function mTab(t){
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
    const isEgg=l.item?.isEgg,color=RARITY_COLOR[l.item?.rarity]||"#6b7280";
    const q=isEgg?{label:"Egg",color}:qualityLabel(l.item.val,l.item.base||l.item.val);
    const statLine=isEgg?`${l.item.rarity} Pet Egg · Hatchable`:`+${l.item.val} ${l.item.stat==="str"?"STR":"DEF"} · ${l.item.type}${l.item.itemLevel?" · Lv."+l.item.itemLevel:""}`;
    return`<div class="market-item">
      <div class="market-icon">${gfx(l.item.image,l.item.emoji,36)}</div>
      <div class="market-info">
        <div class="market-name" style="color:${color}">${l.item.name} <span class="pill" style="background:${q.color}22;color:${q.color}">${q.label}</span></div>
        <div class="market-seller">by ${l.sellerName}</div>
        <div class="market-stat">${statLine}</div>
      </div>
      <div><div class="market-price">🪙${fmt(l.price)}</div>
        <button class="btn btn-gold btn-sm" style="margin-top:0.3rem" onclick="G.buyListing('${l.id}',${l.price})">Buy</button>
      </div></div>`;}).join("");
}
function renderMarketSell(){
  const body=document.getElementById("market-body");if(!body)return;const inv=P.inventory||[];
  if(inv.length===0){body.innerHTML=`<div style="text-align:center;color:var(--text3);padding:2rem;font-style:italic">No items to sell.</div>`;return;}
  body.innerHTML=`<div style="font-size:0.8rem;color:var(--text3);margin-bottom:0.75rem">${Math.round(CFG.MARKET_FEE*100)}% fee · or 🧩 Salvage for shards</div>`+
    inv.map((item,i)=>{if(item.isEgg){const color=RARITY_COLOR[item.rarity]||"#6b7280";const hatch=canHatchEgg(item);
      return`<div class="market-item"><div class="market-icon">${gfx(item.image,item.emoji,36)}</div><div class="market-info">
        <div class="market-name" style="color:${color}">${item.name} <span class="pill" style="background:${color}22;color:${color}">Egg</span></div>
        <div class="market-stat">${hatch.ok?"Ready to hatch":hatch.reason}</div></div>
        <div style="display:flex;flex-direction:column;gap:0.3rem;align-items:flex-end"><button class="btn btn-gold btn-sm" onclick="G.promptSell(${i})">List Egg</button><button class="btn btn-purple btn-sm" onclick="G.openItemModalEgg(${i})" style="font-size:0.62rem">View</button></div></div>`;}
      const q=qualityLabel(item.val,item.base||item.val);
      const npcVal=Math.max(5,Math.floor((item.shopPrice||item.base*item.val*2||50)*CFG.SHOP_SELL_RATE));
      const shards=salvageShards(item);
      return`<div class="market-item">
        <div class="market-icon">${gfx(item.image,item.emoji,36)}</div>
        <div class="market-info">
          <div class="market-name" style="color:${RARITY_COLOR[item.rarity]}">${item.name} <span class="pill" style="background:${q.color}22;color:${q.color}">${q.label}</span></div>
          <div class="market-stat">+${item.val} ${item.stat==="str"?"STR":"DEF"}${item.itemLevel?" · Lv."+item.itemLevel:""}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:0.3rem;align-items:flex-end">
          <button class="btn btn-gold btn-sm" onclick="G.promptSell(${i})">List</button>
          <button class="btn btn-ghost btn-sm" onclick="G.sellToNpc(${i})" style="font-size:0.62rem">NPC 🪙${npcVal}</button>
          <button class="btn btn-purple btn-sm" onclick="G.salvageItem(${i})" style="font-size:0.62rem">🧩${shards}</button>
        </div></div>`;}).join("");
}
export function sellToNpc(idx){
  const item=(P.inventory||[])[idx];if(!item)return;
  if(item.isEgg){SFX.error();toast("🥚 Eggs can be listed or hatched, not sold to NPC.");return;}
  if(item.locked){SFX.error();toast("🔒 Unlock this item first!");return;}
  const npcVal=Math.max(5,Math.floor((item.shopPrice||item.base*item.val*2||50)*CFG.SHOP_SELL_RATE));
  P.inventory=P.inventory.filter((_,i)=>i!==idx);P.gold=(P.gold||0)+npcVal;
  SFX.gold();saveP();toast(`🛒 Sold for 🪙${npcVal}`);
  updateHdr();
  if(TAB==="market")renderMarketSell();
  else if(TAB==="gear")renderGear();
  else if(TAB==="home")renderHome();
}
export function openMysteryChest(){
  const price=shopChestPrice(P);
  if((P.gold||0)<price){SFX.error();toast(`Need 🪙${fmt(price)}!`);return;}
  P.gold-=price;recordShopChestBuy(P);let reward;
  const roll=Math.random();
  if(roll<(CFG.CHEST_EGG_CHANCE||0.05)){
    const egg=makeEgg(rollEggRarity());P.inventory=[...(P.inventory||[]),egg];P.itemsFound=(P.itemsFound||0)+1;questProgress("items");
    reward={emoji:egg.emoji,image:egg.image,name:egg.name,sub:`Pet Egg · ${egg.rarity} · Ready to hatch`,color:RARITY_COLOR[egg.rarity]||"#6b7280",extra:`<span style="background:${(RARITY_COLOR[egg.rarity]||"#6b7280")}22;color:${RARITY_COLOR[egg.rarity]||"#6b7280"};font-family:'Cinzel',serif;font-size:0.7rem;padding:2px 8px;border-radius:6px;font-weight:700">EGG</span>`};
  }else if(roll<0.68){const item=spawnItemFromPool(ITEMS,P.level);P.inventory=[...(P.inventory||[]),item];P.itemsFound=(P.itemsFound||0)+1;questProgress("items");trackCirculation(item.name);
    const q=qualityLabel(item.val,item.base||item.val);reward={emoji:item.emoji,image:item.image,name:item.name,sub:`+${item.val} ${item.stat==="str"?"STR":"DEF"} · ${item.rarity}`,color:RARITY_COLOR[item.rarity],extra:`<span style="background:${q.color}22;color:${q.color};font-family:'Cinzel',serif;font-size:0.7rem;padding:2px 8px;border-radius:6px;font-weight:700">${q.label}</span>`};}
  else{const av=rollAvatar(),collected=P.avatars||[];
    if(collected.includes(av.id)){const bonus=rand(100,400);P.gold=(P.gold||0)+bonus;reward={emoji:"🪙",image:"",name:"Duplicate Avatar",sub:`Converted to 🪙${bonus} gold`,color:"#d97706",extra:""};}
    else{P.avatars=[...collected,av.id];reward={emoji:av.emoji,image:av.image,name:av.name,sub:`${av.rarity} Avatar`,color:RARITY_COLOR[av.rarity],extra:""};}}
  saveP();showModal(`<div style="text-align:center"><div style="font-size:5rem;margin-bottom:0.5rem">📦</div><div style="font-family:'Cinzel',serif;font-size:0.9rem;color:var(--text3)">Opening...</div></div>`);SFX.chest();
  setTimeout(()=>{const nextPrice=shopChestPrice(P);const imgHtml=reward.image?gfx(reward.image,reward.emoji,80):`<span style="font-size:4rem">${reward.emoji}</span>`;
    showModal(`<div style="text-align:center">
      <div style="font-size:0.75rem;color:var(--text3);font-family:'Cinzel',serif;text-transform:uppercase;margin-bottom:0.5rem">✨ Chest Opened!</div>
      <div style="width:80px;height:80px;margin:0 auto 0.6rem;display:flex;align-items:center;justify-content:center">${imgHtml}</div>
      <div style="font-family:'Cinzel',serif;font-size:1.05rem;color:${reward.color};font-weight:700;margin-bottom:0.2rem">${reward.name}</div>
      ${reward.extra}<div style="font-size:0.82rem;color:var(--text3);margin:0.5rem 0 1rem">${reward.sub}</div>
    </div><div class="modal-actions">
      <button class="btn btn-gold" onclick="G.openMysteryChest()">Open Another (🪙${fmt(nextPrice)})</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Close</button>
    </div>`);},600);
}
function renderMarketShop(){
  const body=document.getElementById("market-body");if(!body)return;
  const shopItems=ITEMS.filter(i=>i.shopPrice>0);
  const chestPrice=shopChestPrice(P);
  const chestHtml=`<div class="shop-item" style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border-color:var(--gold2)">
    <div class="shop-icon">📦</div><div class="shop-info"><div class="shop-name" style="color:var(--gold3)">Mystery Chest</div><div class="shop-desc">Random item, avatar, or rare pet egg!</div></div>
    <div><div class="shop-price">🪙${fmt(chestPrice)}</div><button class="btn btn-gold btn-sm" style="margin-top:0.3rem" onclick="G.openMysteryChest()">Open</button></div></div>`;
  const consumeHtml=SHOP_CONSUMABLES.map(c=>`<div class="shop-item"><div class="shop-icon">${c.emoji}</div>
    <div class="shop-info"><div class="shop-name">${c.name}</div><div class="shop-desc">${c.desc}</div></div>
    <div><div class="shop-price">🪙${fmt(c.price)}</div><button class="btn btn-gold btn-sm" style="margin-top:0.3rem" onclick="G.buyConsumable('${c.id}')">Buy</button></div></div>`).join("");
  const equipHtml=shopItems.map((item,i)=>`<div class="shop-item"><div class="shop-icon">${gfx(item.image,item.emoji,40)}</div>
    <div class="shop-info"><div class="shop-name" style="color:${RARITY_COLOR[item.rarity]}">${item.name}</div><div class="shop-desc">+~${item.base} ${item.stat==="str"?"STR":"DEF"} · Min Lv.${item.minLevel}</div></div>
    <div><div class="shop-price">🪙${fmt(item.shopPrice)}</div><button class="btn btn-gold btn-sm" style="margin-top:0.3rem" onclick="G.buyShopItem('item',${i})">Buy</button></div></div>`).join("");
  const eggHtml=Object.values(EGG_TYPES).map(e=>`<div class="shop-item" style="opacity:0.7"><div class="shop-icon">${e.emoji}</div>
    <div class="shop-info"><div class="shop-name" style="color:${e.color}">${e.name}</div><div class="shop-desc">Incubates ${fmtDuration(e.incubationMs)} · hatches a pet · Market value 🪙${fmt(e.marketPrice)}</div></div>
    <div style="text-align:right;font-size:0.7rem;color:var(--text3);font-style:italic;padding:0.4rem">Find in<br>dungeons &<br>chests</div></div>`).join("");
  body.innerHTML=`<div style="font-size:0.78rem;color:var(--text3);margin-bottom:0.6rem">Gold: 🪙${fmt(P.gold)} · Shards: 🧩${P.shards||0}</div>
    <div class="section-hdr">✨ Special</div>${chestHtml}
    <div style="font-size:0.72rem;color:var(--text3);margin:-0.25rem 0 0.75rem">Pet eggs come from dungeon chests, this chest, and rare walking finds.</div>
    <div class="section-hdr">Consumables</div>${consumeHtml}
    <div class="section-hdr">Equipment</div>${equipHtml}
    <div class="section-hdr">🥚 Pet Eggs (Reference)</div>
    <div style="font-size:0.72rem;color:var(--text3);margin-bottom:0.5rem">Eggs cannot be purchased — find them while exploring or in dungeon chests!</div>
    ${eggHtml}`;
}
function renderMyListings(listings){
  const body=document.getElementById("market-body");if(!body)return;
  if(listings.length===0){body.innerHTML=`<div style="text-align:center;color:var(--text3);padding:2rem;font-style:italic">No active listings.</div>`;return;}
  body.innerHTML=listings.map(l=>{
    const isEgg=l.item?.isEgg,color=RARITY_COLOR[l.item?.rarity]||"#6b7280";
    const stat=isEgg?`${l.item.rarity} Pet Egg`:`+${l.item.val} ${l.item.stat==="str"?"STR":"DEF"}`;
    return`<div class="market-item"><div class="market-icon">${gfx(l.item.image,l.item.emoji,36)}</div>
    <div class="market-info"><div class="market-name" style="color:${color}">${l.item.name}</div>
      <div class="market-stat">${stat}</div></div>
    <div><div class="market-price">🪙${fmt(l.price)}</div>
      <button class="btn btn-danger btn-sm" style="margin-top:0.3rem" onclick="G.cancelListing('${l.id}',${JSON.stringify(l.item).split("'").join("&#39;")})">Cancel</button>
    </div></div>`;}).join("");
}
export async function buyListing(id,price){
  if((P.gold||0)<price){SFX.error();toast("💰 Not enough gold!");return;}
  const snap=await getDoc(doc(db,"market",id));if(!snap.exists()){toast("Listing gone.");renderMarket();return;}
  const listing=snap.data();
  const fee=Math.floor(price*CFG.MARKET_FEE);
  const sellerProfit=price-fee;
  P.gold-=price;P.inventory=[...(P.inventory||[]),listing.item];
  if(listing.sellerId&&listing.sellerId!==CU.uid){
    try{
      await updateDoc(doc(db,"players",listing.sellerId),{
        gold:increment(sellerProfit),
        notifications:arrayUnion(`🏪 Your ${listing.item.name} sold for 🪙${fmt(sellerProfit)} (after ${Math.round(CFG.MARKET_FEE*100)}% fee)!`)
      });
    }catch(e){console.warn("Could not deliver sale proceeds:",e);}
  }
  await removeListing(id);saveP();SFX.gold();toast(`✅ Bought ${listing.item.name}!`);questProgress("items");renderMarket();
}
export async function cancelListing(id,item){await removeListing(id);P.inventory=[...(P.inventory||[]),item];saveP();toast("📦 Listing cancelled.");renderMarket();}
export function promptSell(idx){
  const item=(P.inventory||[])[idx];if(!item)return;
  if(item.locked){SFX.error();toast("🔒 Unlock this item first!");return;}
  const suggestedPrice=item.isEgg?(EGG_TYPES[item.eggType]?.marketPrice||100):(item.itemLevel?Math.round(item.base*(item.itemLevel||1)*item.val*0.5):item.base?(item.base*item.val*2):200);
  showModal(`<div class="modal-title">List on Market</div>
    <div class="modal-icon">${gfx(item.image,item.emoji,72)}</div>
    <div style="text-align:center;color:${RARITY_COLOR[item.rarity]};margin-bottom:0.5rem;font-weight:700">${item.name}</div>
    <input class="modal-input" id="sell-price" type="number" value="${suggestedPrice}" min="1"/>
    <div class="modal-actions"><button class="btn btn-gold" onclick="G.confirmSell(${idx})">List Item</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Cancel</button></div>`);
}
export async function confirmSell(idx){
  const price=Math.floor(Number(document.getElementById("sell-price").value));if(!price||price<1){toast("Enter a valid price");return;}
  const item=(P.inventory||[])[idx];if(!item)return;P.inventory=P.inventory.filter((_,i)=>i!==idx);
  await addListing(CU.uid,P.username,item,price);saveP();closeModal();toast(`🏪 Listed for 🪙${fmt(price)}!`);renderMarket();
}
export function buyShopItem(kind,idx){
  if(kind==="pet"){SFX.error();toast("🐾 Pets now come from eggs only.");return;}
  const si=ITEMS.filter(i=>i.shopPrice>0),template=si[idx],price=template?.shopPrice;
  if(!template)return;if((P.gold||0)<price){SFX.error();toast("💰 Not enough gold!");return;}
  const item=spawnItemScaled(template,P.level);
  delete item.shopPrice;delete item.dropRate;P.gold-=price;P.inventory=[...(P.inventory||[]),item];P.itemsFound=(P.itemsFound||0)+1;
  trackCirculation(item.name);saveP();questProgress("items");SFX.itemFound();toast(`🛒 Bought ${item.name}!`);renderMarketShop();
}
export function buyConsumable(id){
  const c=SHOP_CONSUMABLES.find(x=>x.id===id);if(!c)return;if((P.gold||0)<c.price){SFX.error();toast("💰 Not enough gold!");return;}
  P.gold-=c.price;applyConsumable(P,c.effect);if(c.effect==="exp_200")checkLevelUp();if(c.effect==="energy_full")updateWalkUI();
  saveP();SFX.gold();toast(`${c.emoji} Used ${c.name}!`);updateHdr();if(TAB==="market")renderMarket();
}

// ── SOCIAL / LEADERBOARD ──────────────────────────────────────
let _lbCache=null;
export async function renderSocial(){
  document.getElementById("content").innerHTML=`<div class="card"><div style="text-align:center;color:var(--text3);padding:1rem">Loading...</div></div>`;
  _lbCache=await loadLeaderboard();
  document.getElementById("content").innerHTML=`
    <div class="tab-row" style="margin-bottom:0.75rem;flex-wrap:wrap;gap:3px" id="social-tabs">
      <button class="tab-btn active" id="stab-leaderboard" onclick="G.socialTab('leaderboard')">🏆 Rankings</button>
      <button class="tab-btn" id="stab-party" onclick="G.socialTab('party')">⚔️ Party${P.partyId?` <span style="background:var(--green2);color:white;border-radius:6px;font-size:0.58rem;padding:1px 5px;margin-left:2px">In</span>`:""}
      </button>
    </div>
    <div id="social-body"></div>`;
  socialTab("leaderboard");
}
export function socialTab(t){
  document.querySelectorAll("#social-tabs .tab-btn").forEach(b=>b.classList.remove("active"));
  const active=document.getElementById("stab-"+t);if(active)active.classList.add("active");
  const body=document.getElementById("social-body");if(!body)return;
  if(t==="leaderboard"){
    body.innerHTML=`<div class="tab-row" style="margin-bottom:0.75rem;flex-wrap:wrap;gap:3px" id="lb-tabs">
      <button class="tab-btn active" onclick="G.lbTab('level')">🏆 Level</button>
      <button class="tab-btn" onclick="G.lbTab('kills')">💀 Kills</button>
      <button class="tab-btn" onclick="G.lbTab('pvp')">⚔️ PvP</button>
      <button class="tab-btn" onclick="G.lbTab('steps')">👣 Steps</button>
      <button class="tab-btn" onclick="G.lbTab('gold')">🪙 Gold</button>
      <button class="tab-btn" onclick="G.lbTab('items')">🎁 Items</button>
    </div><div id="lb-body"></div>
    <div class="card" style="margin-top:0.5rem"><div class="card-title">⚙️ Account</div>
      <button class="btn btn-ghost" onclick="G.showTab('you')">👤 My Profile</button>
      <button class="btn btn-ghost" onclick="G.handleSignOut()">Sign Out</button></div>`;
    lbTab("level");
  }else if(t==="party"){
    body.innerHTML=`<div id="party-body"></div>`;
    renderParty();
  }
}
export function lbTab(type){
  document.querySelectorAll("#lb-tabs .tab-btn").forEach((b,i)=>{const types=["level","kills","pvp","steps","gold","items"];b.classList.toggle("active",types[i]===type);});
  const all=_lbCache||[];let sorted,valFn,title;
  if(type==="level"){sorted=[...all].sort((a,b)=>b.level-a.level||(b.exp||0)-(a.exp||0));valFn=p=>`Lv.${p.level}`;title="🏆 Level Rankings";}
  else if(type==="kills"){sorted=[...all].sort((a,b)=>(b.npcKills||0)-(a.npcKills||0));valFn=p=>`${fmt(p.npcKills||0)} kills`;title="💀 Kill Rankings";}
  else if(type==="pvp"){sorted=[...all].sort((a,b)=>(b.pvpKills||0)-(a.pvpKills||0));valFn=p=>`${p.pvpKills||0}W/${p.pvpLosses||0}L`;title="⚔️ PvP Rankings";}
  else if(type==="steps"){sorted=[...all].sort((a,b)=>(b.steps||0)-(a.steps||0));valFn=p=>`${fmt(p.steps||0)} steps`;title="👣 Step Rankings";}
  else if(type==="gold"){sorted=[...all].sort((a,b)=>((b.gold||0)+(b.bank||0))-((a.gold||0)+(a.bank||0)));valFn=p=>`🪙${fmt((p.gold||0)+(p.bank||0))}`;title="🪙 Wealth Rankings";}
  else{sorted=[...all].sort((a,b)=>(b.itemsFound||0)-(a.itemsFound||0));valFn=p=>`${p.itemsFound||0} items`;title="🎁 Items Found";}
  const top=sorted.slice(0,10),body=document.getElementById("lb-body");if(!body)return;
  if(top.length===0){body.innerHTML=`<div class="card"><div style="text-align:center;color:var(--text3);font-style:italic;padding:1rem">No data yet!</div></div>`;return;}
  const rows=top.map((p,i)=>{const rc=i===0?"r1":i===1?"r2":i===2?"r3":"";const you=p.id===CU.uid?`<span class="lb-you">(you)</span>`:"";
    return`<div class="lb-row"><div class="lb-rank ${rc}">${i===0?"👑":i+1}</div>
      <div style="width:26px;height:26px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${avatarGfxFor(p,24)}</div>
      <div class="lb-name">${p.username} ${you}</div><div class="lb-val">${valFn(p)}</div></div>`;}).join("");
  body.innerHTML=`<div class="card"><div class="card-title">${title}</div>${rows}</div>`;
}

// ── PVP ───────────────────────────────────────────────────────
export async function renderPvP(){
  document.getElementById("content").innerHTML=`<div class="tab-row" style="margin-bottom:0.75rem" id="pvp-tabs">
    <button class="tab-btn active" id="pvptab-fight" onclick="G.pvpTab('fight')">⚔️ PvP</button>
    <button class="tab-btn" id="pvptab-bounties" onclick="G.pvpTab('bounties')">💰 Bounties</button>
  </div><div id="pvp-body"></div>`;
  pvpTab("fight");
}
export async function pvpTab(t){
  ["fight","bounties"].forEach(x=>{const b=document.getElementById("pvptab-"+x);if(b)b.classList.toggle("active",x===t);});
  if(t==="fight")await renderPvPFight();else await renderBountyBoard();
}
async function renderPvPFight(){
  const body=document.getElementById("pvp-body");if(!body)return;
  body.innerHTML=`<div style="text-align:center;color:var(--text3);padding:1rem">Loading...</div>`;
  const all=await loadLeaderboard(),others=all.filter(p=>p.id!==CU.uid&&p.username);
  if(others.length===0){body.innerHTML=`<div style="text-align:center;color:var(--text3);padding:2rem;font-style:italic">No other players yet!</div>`;return;}
  const now=Date.now();
  body.innerHTML=`<div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:12px;padding:0.75rem;margin-bottom:0.75rem;font-size:0.8rem;color:var(--text3)">
    ⚔️ Win up to <strong>10%</strong> of their gold. 4-hour cooldown per target.</div>
  ${others.map(op=>{const lastAttack=(P.pvpAttackLog||{})[op.id]||0;const cooldownLeft=Math.max(0,CFG.PVP_COOLDOWN_MS-(now-lastAttack));const onCooldown=cooldownLeft>0;
    const cooldownStr=onCooldown?`${Math.floor(cooldownLeft/3600000)}h ${Math.floor((cooldownLeft%3600000)/60000)}m`:"";
    const opStr=(op.baseStr||10)+(equipStats(op.equipped||{}).str),opDef=(op.baseDef||5)+(equipStats(op.equipped||{}).def);
    return`<div class="market-item">
      <div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${avatarGfxFor(op,38)}</div>
      <div class="market-info"><div class="market-name">${op.username}</div>
        <div class="market-stat">Lv.${op.level||1} · ⚔️${opStr} 🛡️${opDef} · 🪙${fmt(op.gold||0)}</div>
        ${onCooldown?`<div style="font-size:0.68rem;color:var(--text3)">⏱ ${cooldownStr}</div>`:""}
      </div>
      <button class="btn btn-danger btn-sm" onclick="G.attackPlayer('${op.id}','${op.username}')" ${onCooldown?"disabled":""}>${onCooldown?"Cooldown":"Attack"}</button>
    </div>`;}).join("")}`;
}
export async function attackPlayer(targetId,targetName){
  SFX.click();const targetSnap=await getDoc(doc(db,"players",targetId));if(!targetSnap.exists()){toast("Player not found!");return;}
  const target={id:targetId,...targetSnap.data()};const lastAttack=(P.pvpAttackLog||{})[targetId]||0;
  if(Date.now()-lastAttack<CFG.PVP_COOLDOWN_MS){toast("⏱ Still on cooldown!");return;}
  const{str:aStr,def:aDef}=equipStats(P.equipped);const{str:dStr,def:dDef}=equipStats(target.equipped||{});
  const attacker={name:P.username,str:(P.baseStr||10)+aStr,def:(P.baseDef||5)+aDef,maxHp:P.maxHp};
  const defender={name:target.username,str:(target.baseStr||10)+dStr,def:(target.baseDef||5)+dDef,maxHp:target.maxHp||110};
  const result=simulateFight(attacker,defender);const won=result.winner==="attacker";
  if(!P.pvpAttackLog)P.pvpAttackLog={};P.pvpAttackLog[targetId]=Date.now();let goldStolen=0;
  if(won){goldStolen=Math.floor((target.gold||0)*CFG.PVP_GOLD_STEAL);P.gold=(P.gold||0)+goldStolen;P.pvpKills=(P.pvpKills||0)+1;SFX.pvpWin();
    await updateDoc(doc(db,"players",targetId),{gold:Math.max(0,(target.gold||0)-goldStolen),notifications:arrayUnion(`⚔️ ${P.username} attacked you and won! Lost 🪙${fmt(goldStolen)}.`)});}
  else{SFX.pvpLose();P.pvpLosses=(P.pvpLosses||0)+1;P.hp=Math.max(1,Math.floor(P.maxHp*0.3));
    await updateDoc(doc(db,"players",targetId),{notifications:arrayUnion(`🛡️ ${P.username} attacked you and lost!`)});}
  saveP();updateHdr();
  showModal(`<div class="combat-scene" style="margin-bottom:0.75rem"><div class="fighters">
    <div class="fighter"><div class="f-img">${avatarGfx(56)}</div><div class="f-name">${P.username}</div></div>
    <div class="vs">VS</div>
    <div class="fighter"><div class="f-img">${avatarGfxFor(target,56)}</div><div class="f-name">${target.username}</div></div>
  </div></div>
  <div class="combat-log" style="max-height:140px">${result.log.join("<br>")}</div>
  <div style="text-align:center;margin:0.75rem 0;font-family:'Cinzel',serif;font-size:1rem;font-weight:700;color:${won?"var(--green2)":"var(--crimson2)"}">
    ${won?`🏆 Victory! +🪙${fmt(goldStolen)}`:"💀 Defeat! You fought bravely."}</div>
  <button class="btn btn-ghost" onclick="G.closeModal()">Close</button>`);
}

// ── BOUNTIES ──────────────────────────────────────────────────
async function renderBountyBoard(){
  const body=document.getElementById("pvp-body");if(!body)return;
  body.innerHTML=`<div style="text-align:center;color:var(--text3);padding:1rem">Loading...</div>`;
  const bounties=await getBounties(),onMe=bounties.filter(b=>b.targetId===CU.uid);
  body.innerHTML=`<button class="btn btn-gold" onclick="G.openPostBounty()" style="margin-bottom:0.75rem">💰 Post a Bounty</button>
    ${onMe.length>0?`<div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:12px;padding:0.75rem;margin-bottom:0.75rem">
      <div style="font-family:'Cinzel',serif;font-size:0.82rem;color:var(--crimson2);font-weight:700;margin-bottom:0.4rem">⚠️ Bounties on You!</div>
      ${onMe.map(b=>`<div style="font-size:0.8rem">🪙${fmt(b.totalAmount)} · by ${b.posterName}</div>`).join("")}</div>`:""}
    <div class="section-hdr">Active Bounties</div>
    ${bounties.filter(b=>b.targetId!==CU.uid).length===0?`<div style="text-align:center;color:var(--text3);padding:1.5rem;font-style:italic">No bounties yet.</div>`
      :bounties.filter(b=>b.targetId!==CU.uid).map(b=>`<div class="market-item"><div style="font-size:1.8rem">🎯</div>
        <div class="market-info"><div class="market-name">${b.targetName}</div>
          <div class="market-stat">Lv.${b.targetLevel||"?"} · by ${b.posterName}</div></div>
        <div style="text-align:right"><div style="font-family:'Cinzel',serif;color:var(--gold3);font-weight:700;font-size:0.9rem">🪙${fmt(b.totalAmount)}</div>
          ${b.posterId===CU.uid?`<button class="btn btn-ghost btn-sm" style="margin-top:0.3rem" onclick="G.cancelBounty('${b.id}')">Cancel</button>`
            :`<button class="btn btn-danger btn-sm" style="margin-top:0.3rem" onclick="G.claimBounty('${b.id}')">Claim</button>`}
        </div></div>`).join("")}`;
}
export async function openPostBounty(){
  SFX.click();const all=await loadLeaderboard(),others=all.filter(p=>p.id!==CU.uid);
  const optionsHtml=others.map(p=>`<option value="${p.id}" data-name="${p.username}" data-level="${p.level||1}">${p.username} (Lv.${p.level||1})</option>`).join("");
  showModal(`<div class="modal-title">🎯 Post a Bounty</div>
    <div style="font-size:0.82rem;color:var(--text3);margin-bottom:0.75rem">Min 🪙${fmt(CFG.BOUNTY_MIN)}. Gold taken immediately.</div>
    <select id="bounty-target" class="modal-input" style="padding:0.65rem;margin-bottom:0.4rem"><option value="">Select a player...</option>${optionsHtml}</select>
    <input class="modal-input" id="bounty-amount" type="number" placeholder="Min ${CFG.BOUNTY_MIN}" min="${CFG.BOUNTY_MIN}"/>
    <div style="font-size:0.75rem;color:var(--text3);margin:0.4rem 0 0.75rem">Your gold: 🪙${fmt(P.gold)}</div>
    <div class="modal-actions"><button class="btn btn-gold" onclick="G.confirmPostBounty()">Post Bounty</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Cancel</button></div>`);
}
export async function confirmPostBounty(){
  const targetEl=document.getElementById("bounty-target"),amtEl=document.getElementById("bounty-amount");
  const targetId=targetEl?.value,targetName=targetEl?.options[targetEl.selectedIndex]?.getAttribute("data-name");
  const targetLevel=parseInt(targetEl?.options[targetEl.selectedIndex]?.getAttribute("data-level")||"1");
  const amount=Math.floor(Number(amtEl?.value));
  if(!targetId){toast("Select a target!");return;}if(!amount||amount<CFG.BOUNTY_MIN){SFX.error();toast(`Min 🪙${fmt(CFG.BOUNTY_MIN)}!`);return;}
  if(amount>(P.gold||0)){SFX.error();toast("Not enough gold!");return;}
  const existing=await getBounties(),existingBounty=existing.find(b=>b.targetId===targetId);
  if(existingBounty){await updateDoc(doc(db,"bounties",existingBounty.id),{totalAmount:existingBounty.totalAmount+amount});P.gold-=amount;saveP();closeModal();SFX.bounty();toast(`💰 Added to bounty on ${targetName}!`);}
  else{await addDoc(collection(db,"bounties"),{targetId,targetName,targetLevel,posterId:CU.uid,posterName:P.username,totalAmount:amount,postedAt:Date.now()});P.gold-=amount;saveP();closeModal();SFX.bounty();toast(`🎯 Bounty posted on ${targetName}!`);}
}
export async function cancelBounty(id){
  const snap=await getDoc(doc(db,"bounties",id));if(!snap.exists())return;const b=snap.data();if(b.posterId!==CU.uid){toast("Not your bounty!");return;}
  P.gold=(P.gold||0)+b.totalAmount;await deleteDoc(doc(db,"bounties",id));saveP();toast(`🪙 Cancelled, refunded!`);renderBountyBoard();
}
export async function claimBounty(bountyId){
  SFX.click();const snap=await getDoc(doc(db,"bounties",bountyId));if(!snap.exists()){toast("Bounty gone!");renderBountyBoard();return;}
  const b=snap.data();const targetSnap=await getDoc(doc(db,"players",b.targetId));if(!targetSnap.exists()){toast("Target not found!");return;}
  const target={id:b.targetId,...targetSnap.data()};
  const{str:aStr,def:aDef}=equipStats(P.equipped);const{str:dStr,def:dDef}=equipStats(target.equipped||{});
  const result=simulateFight({name:P.username,str:(P.baseStr||10)+aStr,def:(P.baseDef||5)+aDef,maxHp:P.maxHp},{name:target.username,str:(target.baseStr||10)+dStr,def:(target.baseDef||5)+dDef,maxHp:target.maxHp||110});
  const won=result.winner==="attacker";
  if(won){P.gold=(P.gold||0)+b.totalAmount;await deleteDoc(doc(db,"bounties",bountyId));
    await updateDoc(doc(db,"players",b.targetId),{notifications:arrayUnion(`🎯 ${P.username} claimed the bounty on you!`)});
    saveP();SFX.pvpWin();toast(`🎯 Bounty claimed! +🪙${fmt(b.totalAmount)}!`);}
  else{SFX.pvpLose();toast("💀 Failed to defeat them!");}renderBountyBoard();
}

// ── GUILDS ────────────────────────────────────────────────────
export async function renderGuild(){
  document.getElementById("content").innerHTML=`<div class="card"><div style="text-align:center;color:var(--text3);padding:1rem">Loading...</div></div>`;
  if(!P.guildId){
    document.getElementById("content").innerHTML=`<div class="card"><div class="card-title">🛡️ Guild</div>
      <p style="color:var(--text3);font-size:0.88rem;margin-bottom:0.75rem">You're not in a guild yet.</p>
      <button class="btn btn-gold" onclick="G.openCreateGuild()">Create Guild (🪙${fmt(CFG.GUILD_CREATE_COST)})</button>
      <button class="btn btn-ghost" onclick="G.openJoinGuild()" style="margin-top:0.5rem">Join a Guild</button></div>
    <button class="btn btn-ghost" onclick="G.showTab('home')" style="margin-top:0.5rem">← Back</button>`;return;
  }
  const guild=await getGuild(P.guildId);if(!guild){P.guildId=null;saveP();renderGuild();return;}
  renderGuildView(guild);
}
export async function openCreateGuild(){
  showModal(`<div class="modal-title">🛡️ Create Guild</div>
    <div style="font-size:0.82rem;color:var(--text3);margin-bottom:0.75rem">Cost: 🪙${fmt(CFG.GUILD_CREATE_COST)}</div>
    <input class="modal-input" id="guild-name" placeholder="Guild Name" maxlength="30"/>
    <input class="modal-input" id="guild-tag" placeholder="3-letter Tag" maxlength="3" style="margin-top:0.4rem;text-transform:uppercase"/>
    <div class="modal-actions"><button class="btn btn-gold" onclick="G.confirmCreateGuild()">Create</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Cancel</button></div>`);
}
export async function confirmCreateGuild(){
  const name=document.getElementById("guild-name")?.value.trim(),tag=(document.getElementById("guild-tag")?.value.trim()||"").toUpperCase();
  if(!name||name.length<2){SFX.error();toast("Enter a guild name!");return;}if(!tag||tag.length!==3){SFX.error();toast("Tag must be 3 letters!");return;}
  if((P.gold||0)<CFG.GUILD_CREATE_COST){SFX.error();toast("Not enough gold!");return;}
  P.gold-=CFG.GUILD_CREATE_COST;
  const guildRef=await addDoc(collection(db,"guilds"),{name,tag,treasury:0,members:[{uid:CU.uid,username:P.username,role:"leader",joinedAt:Date.now()}],vault:[],raid:null,createdAt:Date.now(),leaderId:CU.uid});
  P.guildId=guildRef.id;saveP();closeModal();SFX.guild();toast(`🛡️ Guild "${name}" created!`);renderGuild();
}
export async function openJoinGuild(){
  const snap=await getDocs(collection(db,"guilds"));const guilds=snap.docs.map(d=>({id:d.id,...d.data()})).filter(g=>g.members&&g.members.length<CFG.GUILD_MAX_MEMBERS);
  if(guilds.length===0){showModal(`<div class="modal-title">🛡️ Join a Guild</div><div style="text-align:center;color:var(--text3);padding:1.5rem;font-style:italic">No open guilds!</div><button class="btn btn-ghost" onclick="G.closeModal()">Close</button>`);return;}
  showModal(`<div class="modal-title">🛡️ Join a Guild</div><div style="max-height:60vh;overflow-y:auto;margin-bottom:0.75rem">
    ${guilds.map(g=>`<div style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem 0;border-bottom:1px solid var(--border)">
      <div style="flex:1"><div style="font-family:'Cinzel',serif;font-size:0.9rem;font-weight:700">[${g.tag}] ${g.name}</div>
        <div style="font-size:0.75rem;color:var(--text3)">${g.members?.length||0}/${CFG.GUILD_MAX_MEMBERS} · 🏦${fmt(g.treasury||0)}</div></div>
      <button class="btn btn-steel btn-sm" onclick="G.joinGuild('${g.id}')">Join</button></div>`).join("")}
  </div><button class="btn btn-ghost" onclick="G.closeModal()">Cancel</button>`);
}
export async function joinGuild(guildId){
  const guild=await getGuild(guildId);if(!guild){toast("Guild not found!");return;}
  if(guild.members.length>=CFG.GUILD_MAX_MEMBERS){SFX.error();toast("Guild is full!");return;}
  await updateDoc(doc(db,"guilds",guildId),{members:arrayUnion({uid:CU.uid,username:P.username,role:"member",joinedAt:Date.now()})});
  P.guildId=guildId;saveP();closeModal();SFX.guild();toast(`🛡️ Joined ${guild.name}!`);renderGuild();
}
function renderGuildView(guild){
  const myMember=guild.members?.find(m=>m.uid===CU.uid),myRole=myMember?.role||"member";
  const isLeader=myRole==="leader",isAdmin=myRole==="admin"||isLeader;
  const membersHtml=guild.members?.map(m=>`<div style="display:flex;align-items:center;gap:0.75rem;padding:0.55rem 0;border-bottom:1px solid var(--border)">
    <div style="flex:1"><div style="font-family:'Cinzel',serif;font-size:0.82rem;font-weight:700">${m.username}
      <span style="font-size:0.65rem;color:${m.role==="leader"?"var(--gold3)":m.role==="admin"?"var(--steel)":"var(--text3)"}"> ${m.role==="leader"?"👑":m.role==="admin"?"⭐":""}${m.role}</span></div></div>
    ${isLeader&&m.uid!==CU.uid?`<button class="btn btn-ghost btn-sm" onclick="G.promoteGuildMember('${guild.id}','${m.uid}','${m.role}')">${m.role==="member"?"→ Admin":"→ Leader"}</button>`:``}
    ${isAdmin&&m.uid!==CU.uid&&m.role!=="leader"?`<button class="btn btn-danger btn-sm" onclick="G.kickGuildMember('${guild.id}','${m.uid}')">Kick</button>`:``}
  </div>`).join("");
  const vaultHtml=guild.vault&&guild.vault.length>0?guild.vault.map((item,i)=>`<div style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0;border-bottom:1px solid var(--border)">
    <div style="font-size:1.4rem">${gfx(item.image,item.emoji,28)}</div>
    <div style="flex:1"><div style="font-size:0.82rem;font-weight:700;color:${RARITY_COLOR[item.rarity]}">${item.name}</div>
      <div style="font-size:0.68rem;color:var(--text3)">+${item.val} ${item.stat==="str"?"STR":"DEF"} · from ${item.donatedBy||"?"}</div></div>
    ${isAdmin?`<button class="btn btn-steel btn-sm" onclick="G.giveVaultItem('${guild.id}',${i})">Give</button>`:""}</div>`).join("")
    :`<div style="font-size:0.82rem;color:var(--text3);font-style:italic;padding:0.5rem 0">Vault is empty.</div>`;
  const raidHtml=guild.raid&&!guild.raid.completed?`<div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:12px;padding:0.85rem;margin-bottom:0.75rem">
    <div style="font-family:'Cinzel',serif;font-size:0.9rem;font-weight:700;color:var(--crimson2);margin-bottom:0.4rem">⚔️ ${guild.raid.name}</div>
    <div style="font-size:0.78rem;color:var(--text3);margin-bottom:0.5rem">HP: ${fmt(guild.raid.hp)} / ${fmt(guild.raid.maxHp)} · ${guild.raid.contributors?.length||0} contributors</div>
    ${guild.raid.contributors?.includes(CU.uid)?`<div style="font-size:0.78rem;color:var(--green2);font-weight:700">✓ Contributed!</div>`
      :`<button class="btn btn-danger btn-sm" onclick="G.contributeToRaid('${guild.id}')">⚔️ Attack (1 Energy)</button>`}
  </div>`:isAdmin?`<button class="btn btn-purple" onclick="G.startGuildRaid('${guild.id}')" style="margin-bottom:0.75rem">⚔️ Start Raid (🏦${fmt(CFG.GUILD_RAID_COST)})</button>`:"";
  document.getElementById("content").innerHTML=`
    <div style="background:linear-gradient(135deg,#f8f4ee,#f0ebe2);border:1.5px solid var(--border2);border-radius:14px;padding:1rem;margin-bottom:0.7rem;text-align:center">
      <div style="font-family:'Cinzel',serif;font-size:1.4rem;font-weight:900;color:var(--gold3)">[${guild.tag}] ${guild.name}</div>
      <div style="font-size:0.8rem;color:var(--text3);margin-top:0.2rem">${guild.members?.length||0}/${CFG.GUILD_MAX_MEMBERS} members · ${myRole}</div></div>
    <div class="card"><div class="card-title">🏦 Guild Treasury</div>
      <div style="font-family:'Cinzel',serif;font-size:1.5rem;color:var(--gold3);font-weight:700;text-align:center;margin-bottom:0.5rem">🪙${fmt(guild.treasury||0)}</div>
      <button class="btn btn-gold btn-sm" onclick="G.donateToGuild('${guild.id}')">Donate Gold</button>
      <button class="btn btn-ghost btn-sm" onclick="G.donateItemToGuild('${guild.id}')" style="margin-top:0.3rem">Donate Item</button></div>
    ${raidHtml}
    <div class="card"><div class="card-title">👥 Members (${guild.members?.length||0})</div>${membersHtml}</div>
    <div class="card"><div class="card-title">📦 Guild Vault</div>${vaultHtml}</div>
    <button class="btn btn-danger" onclick="G.leaveGuild('${guild.id}')" style="margin-top:0.5rem">Leave Guild</button>`;
}
export async function donateToGuild(guildId){
  showModal(`<div class="modal-title">🏦 Donate to Guild</div>
    <div style="font-size:0.82rem;color:var(--text3);margin-bottom:0.75rem">Your gold: 🪙${fmt(P.gold)}</div>
    <input class="modal-input" id="guild-donate-amt" type="number" placeholder="Amount..." min="1"/>
    <div class="modal-actions"><button class="btn btn-gold" onclick="G.confirmDonateGold('${guildId}')">Donate</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Cancel</button></div>`);
}
export async function confirmDonateGold(guildId){
  const amt=Math.floor(Number(document.getElementById("guild-donate-amt")?.value));
  if(!amt||amt<1){SFX.error();toast("Enter a valid amount");return;}if(amt>(P.gold||0)){SFX.error();toast("Not enough gold!");return;}
  P.gold-=amt;await updateDoc(doc(db,"guilds",guildId),{treasury:increment(amt)});saveP();closeModal();SFX.donate();toast(`🏦 Donated 🪙${fmt(amt)}!`);renderGuild();
}
export async function donateItemToGuild(guildId){
  const inv=P.inventory||[];if(inv.length===0){SFX.error();toast("No items to donate!");return;}
  showModal(`<div class="modal-title">📦 Donate Item to Vault</div><div style="max-height:50vh;overflow-y:auto;margin-bottom:0.75rem">
    ${inv.map((item,i)=>`<div style="display:flex;align-items:center;gap:0.6rem;padding:0.6rem 0;border-bottom:1px solid var(--border)">
      <div style="font-size:1.4rem">${gfx(item.image,item.emoji,28)}</div>
      <div style="flex:1"><div style="font-size:0.82rem;font-weight:700;color:${RARITY_COLOR[item.rarity]}">${item.name}</div>
        <div style="font-size:0.68rem;color:var(--text3)">+${item.val} ${item.stat==="str"?"STR":"DEF"}</div></div>
      <button class="btn btn-steel btn-sm" onclick="G.confirmDonateItem('${guildId}',${i})">Donate</button></div>`).join("")}
  </div><button class="btn btn-ghost" onclick="G.closeModal()">Cancel</button>`);
}
export async function confirmDonateItem(guildId,idx){
  const item=(P.inventory||[])[idx];if(!item)return;P.inventory=P.inventory.filter((_,i)=>i!==idx);
  await updateDoc(doc(db,"guilds",guildId),{vault:arrayUnion({...item,donatedBy:P.username})});
  saveP();closeModal();SFX.donate();toast(`📦 Donated ${item.name}!`);renderGuild();
}
export async function giveVaultItem(guildId,itemIdx){
  const guild=await getGuild(guildId);if(!guild)return;const members=guild.members?.filter(m=>m.uid!==CU.uid)||[];
  if(members.length===0){toast("No other members!");return;}
  showModal(`<div class="modal-title">🎁 Give Item To...</div><div style="max-height:50vh;overflow-y:auto;margin-bottom:0.75rem">
    ${members.map(m=>`<div style="display:flex;align-items:center;gap:0.6rem;padding:0.6rem 0;border-bottom:1px solid var(--border)">
      <div style="flex:1;font-family:'Cinzel',serif;font-size:0.85rem">${m.username}</div>
      <button class="btn btn-gold btn-sm" onclick="G.confirmGiveItem('${guildId}',${itemIdx},'${m.uid}','${m.username}')">Give</button></div>`).join("")}
  </div><button class="btn btn-ghost" onclick="G.closeModal()">Cancel</button>`);
}
export async function confirmGiveItem(guildId,itemIdx,targetUid,targetName){
  const guild=await getGuild(guildId);if(!guild)return;const item=guild.vault[itemIdx];if(!item)return;
  const newVault=guild.vault.filter((_,i)=>i!==itemIdx);await updateDoc(doc(db,"guilds",guildId),{vault:newVault});
  // BUGFIX: read+write inventory directly — arrayUnion deduplicates items with same data
  const targetSnap=await getDoc(doc(db,"players",targetUid));const newItem={...item,id:`item_${Date.now()}_${rand(0,9999)}`};
  if(targetSnap.exists()){const existing=targetSnap.data().inventory||[];
    await updateDoc(doc(db,"players",targetUid),{inventory:[...existing,newItem],notifications:arrayUnion(`🎁 ${P.username} gave you ${item.name} from the guild vault!`)});}
  closeModal();SFX.donate();toast(`✅ Gave ${item.name} to ${targetName}!`);renderGuild();
}
export async function startGuildRaid(guildId){
  const guild=await getGuild(guildId);if(!guild)return;
  if((guild.treasury||0)<CFG.GUILD_RAID_COST){SFX.error();toast(`Need 🏦${fmt(CFG.GUILD_RAID_COST)}!`);return;}
  if(guild.raid&&!guild.raid.completed){SFX.error();toast("Raid already active!");return;}
  const avgLevel=Math.round((guild.members||[]).reduce((s,m)=>s+1,0)*5+10),raidHp=avgLevel*200+rand(500,2000);
  const raid={name:"Guild Raid Boss",emoji:"🔥",hp:raidHp,maxHp:raidHp,str:avgLevel*8,def:avgLevel*4,expReward:avgLevel*50,goldReward:avgLevel*80,contributors:[],completed:false,startedBy:P.username,startedAt:Date.now()};
  await updateDoc(doc(db,"guilds",guildId),{raid,treasury:increment(-CFG.GUILD_RAID_COST)});SFX.raid();toast("⚔️ Raid started!");renderGuild();
}
export async function contributeToRaid(guildId){
  if(P.energy<1){SFX.error();toast("⚡ No energy!");return;}const guild=await getGuild(guildId);if(!guild||!guild.raid||guild.raid.completed){toast("No active raid!");return;}
  if(guild.raid.contributors?.includes(CU.uid)){toast("Already contributed!");return;}
  P.energy--;updateHdr();updateWalkUI();SFX.raid();
  const{str:eStr}=equipStats(P.equipped),myStr=(P.baseStr||10)+eStr;
  const dmg=Math.max(1,myStr-guild.raid.def+rand(-5,15)),newHp=Math.max(0,guild.raid.hp-dmg);
  const newContributors=[...(guild.raid.contributors||[]),CU.uid];
  if(newHp<=0){
    const goldEach=Math.floor(guild.raid.goldReward/newContributors.length),expEach=Math.floor(guild.raid.expReward/newContributors.length);
    await updateDoc(doc(db,"guilds",guildId),{"raid.hp":0,"raid.completed":true,"raid.contributors":newContributors});
    for(const uid of newContributors)await updateDoc(doc(db,"players",uid),{gold:increment(goldEach),exp:increment(expEach),notifications:arrayUnion(`🏆 Raid defeated! +🪙${goldEach} +${expEach} EXP!`)});
    P.gold=(P.gold||0)+goldEach;P.exp=(P.exp||0)+expEach;checkLevelUp();saveP();SFX.victory();toast(`🏆 Raid defeated! +🪙${goldEach} +${expEach} EXP!`);
  }else{await updateDoc(doc(db,"guilds",guildId),{"raid.hp":newHp,"raid.contributors":newContributors});saveP();toast(`⚔️ Hit for ${dmg}!`);}
  renderGuild();
}
export async function promoteGuildMember(guildId,targetUid,currentRole){
  const guild=await getGuild(guildId);if(!guild)return;const myMember=guild.members?.find(m=>m.uid===CU.uid);if(myMember?.role!=="leader"){toast("Only leaders can promote!");return;}
  if(currentRole==="member"){await updateDoc(doc(db,"guilds",guildId),{members:guild.members.map(m=>m.uid===targetUid?{...m,role:"admin"}:m)});toast("⭐ Promoted to Admin!");}
  else if(currentRole==="admin"){await updateDoc(doc(db,"guilds",guildId),{members:guild.members.map(m=>{if(m.uid===targetUid)return{...m,role:"leader"};if(m.uid===CU.uid)return{...m,role:"admin"};return m;}),leaderId:targetUid});toast("👑 Leadership transferred!");}
  SFX.guild();renderGuild();
}
export async function kickGuildMember(guildId,targetUid){
  const guild=await getGuild(guildId);if(!guild)return;const tm=guild.members?.find(m=>m.uid===targetUid);if(!tm||tm.role==="leader"){toast("Cannot kick leader!");return;}
  await updateDoc(doc(db,"guilds",guildId),{members:guild.members.filter(m=>m.uid!==targetUid)});
  await updateDoc(doc(db,"players",targetUid),{guildId:null,notifications:arrayUnion("You were kicked from the guild.")});
  SFX.click();toast("Member kicked.");renderGuild();
}
export async function leaveGuild(guildId){
  showModal(`<div class="modal-title">Leave Guild?</div>
    <div style="text-align:center;color:var(--text3);margin-bottom:1rem;font-size:0.88rem">Are you sure?</div>
    <div class="modal-actions"><button class="btn btn-danger" onclick="G.confirmLeaveGuild('${guildId}')">Leave</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Cancel</button></div>`);
}
export async function confirmLeaveGuild(guildId){
  const guild=await getGuild(guildId);if(!guild)return;const newMembers=guild.members.filter(m=>m.uid!==CU.uid);
  if(newMembers.length===0)await deleteDoc(doc(db,"guilds",guildId));else await updateDoc(doc(db,"guilds",guildId),{members:newMembers});
  P.guildId=null;saveP();closeModal();SFX.click();toast("Left the guild.");renderGuild();
}



// ── PETS & EGGS ──────────────────────────────────────────────
export function buyEgg(eggTypeId){
  SFX.error();
  toast("🥚 Eggs come from dungeon chests, mystery chests, and rare walking finds.");
}
export function openItemModalEgg(idx){
  const egg=(P.inventory||[])[idx];if(!egg||!egg.isEgg)return;
  const def=EGG_TYPES[egg.eggType]||{};const hatch=canHatchEgg(egg);const color=RARITY_COLOR[egg.rarity]||def.color||"#6b7280";
  showModal(`<div class="modal-icon">${gfx(egg.image,egg.emoji,72)}</div>
    <div class="modal-title" style="color:${color}">${egg.name}</div>
    <div class="modal-rarity" style="color:${color}">${egg.rarity} Pet Egg</div>
    <div class="modal-row"><em>Status</em><span style="color:var(--green2)">Ready to hatch</span></div>
    <div class="modal-row"><em>Hatching</em><span>No incubation needed</span></div>
    <div class="modal-row"><em>Market Value</em><span style="color:var(--gold3)">🪙${fmt(def.marketPrice||0)}</span></div>
    <div style="font-size:0.78rem;color:var(--text3);line-height:1.4;margin-top:0.75rem;text-align:center">Hatched pets are soulbound: they cannot be sold, listed, or equipped as normal items.</div>
    <div class="modal-actions">
      <button class="btn btn-gold" onclick="G.hatchEgg(${idx})">🥚 Hatch Egg</button>
      <button class="btn btn-purple" onclick="G.promptSell(${idx});G.closeModal()">List Egg on Market</button>
      <button class="btn btn-danger" onclick="G.dropInventory(${idx})">Drop Egg</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Close</button>
    </div>`);
}
export function hatchEgg(idx){
  const egg=(P.inventory||[])[idx];if(!egg||!egg.isEgg)return;
  const pet=rollEggHatch(egg.eggType);if(!pet){SFX.error();toast("Could not hatch egg.");return;}
  P.inventory=(P.inventory||[]).filter((_,i)=>i!==idx);P.petCollection=[...(P.petCollection||[]),pet];
  if(!P.activePetId)P.activePetId=pet.id;
  saveP();SFX.levelUp();const color=RARITY_COLOR[pet.rarity]||"#6b7280";
  showModal(`<div style="text-align:center">
    <div style="font-size:0.72rem;color:var(--gold3);font-family:'Cinzel',serif;text-transform:uppercase;margin-bottom:0.5rem">🥚 Egg Hatched!</div>
    <div style="width:90px;height:90px;margin:0 auto 0.5rem;display:flex;align-items:center;justify-content:center">${gfx(pet.image,pet.emoji,90)}</div>
    <div style="font-family:'Cinzel',serif;font-size:1.1rem;color:${color};font-weight:700;margin-bottom:0.2rem">${pet.isShiny?"✨ Shiny ":""}${pet.name}</div>
    <div style="font-size:0.72rem;color:${color};text-transform:uppercase;font-weight:700;margin-bottom:0.5rem">${pet.rarity} · Lv.${pet.petLevel}</div>
    <div style="font-size:0.82rem;color:var(--text3);font-style:italic;margin-bottom:1rem">"${pet.desc||"A loyal companion."}"</div>
    <div class="modal-row"><em>Stat</em><span style="color:${pet.stat==="str"?"var(--crimson2)":"var(--steel)"}">+${pet.val} ${pet.stat==="str"?"STR":"DEF"}</span></div>
    <div class="modal-row"><em>Hunger</em><span>${pet.hunger}/100</span></div>
    </div><div class="modal-actions">
      <button class="btn btn-gold" onclick="G.setActivePet('${pet.id}')">Set Active</button>
      <button class="btn btn-ghost" onclick="G.openPetCollection()">View Pets</button>
    </div>`);
}
export function openPetCollection(){
  const pets=P.petCollection||[];
  if(pets.length===0){showModal(`<div class="modal-title">🐾 Pets</div><div style="text-align:center;color:var(--text3);padding:1.5rem;font-style:italic">No pets yet. Find eggs in chests, then hatch them.</div><button class="btn btn-ghost" onclick="G.closeModal()">Close</button>`);return;}
  const rows=pets.map(pet=>{const color=RARITY_COLOR[pet.rarity]||"#6b7280",active=P.activePetId===pet.id,mood=getPetMood(pet),need=petExpNeeded(pet.petLevel||1),pct=Math.min(100,Math.round(((pet.petExp||0)/need)*100));
    return`<div style="border:1.5px solid ${active?"var(--gold2)":"var(--border)"};border-radius:12px;padding:0.75rem;margin-bottom:0.55rem;background:${active?"#fffbeb":"var(--surface)"}">
      <div style="display:flex;align-items:center;gap:0.75rem">
        <div style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${gfx(pet.image,pet.emoji,48)}</div>
        <div style="flex:1;min-width:0"><div style="font-family:'Cinzel',serif;font-size:0.9rem;color:${color};font-weight:700">${pet.isShiny?"✨ ":""}${pet.name}${active?" 🐾":""}</div>
          <div style="font-size:0.7rem;color:var(--text3)">${pet.rarity} · Lv.${pet.petLevel||1} · ${mood} · 🍖${pet.hunger??100}/100</div>
          <div style="font-size:0.7rem;color:${pet.stat==="str"?"var(--crimson2)":"var(--steel)"};font-weight:600">+${pet.val} ${pet.stat==="str"?"STR":"DEF"}</div>
          <div class="bar bar-exp" style="height:5px;margin-top:0.25rem"><div class="bar-fill" style="width:${pct}%"></div></div>
          <div style="font-size:0.62rem;color:var(--text3);margin-top:0.15rem">${pet.petExp||0}/${need} XP</div></div>
      </div>
      <div style="display:flex;gap:0.35rem;margin-top:0.6rem;flex-wrap:wrap">
        ${active?`<button class="btn btn-ghost btn-sm" disabled>Active</button>`:`<button class="btn btn-gold btn-sm" onclick="G.setActivePet('${pet.id}')">Set Active</button>`}
        <button class="btn btn-green btn-sm" onclick="G.feedPetUI('${pet.id}')">Feed</button>
        <button class="btn btn-danger btn-sm" onclick="G.releasePetUI('${pet.id}')">Release</button>
      </div></div>`;}).join("");
  showModal(`<div class="modal-title">🐾 Pet Collection (${pets.length})</div>
    <div style="font-size:0.78rem;color:var(--text3);text-align:center;margin-bottom:0.75rem">Active pets help in combat, gain XP from steps, and lose hunger from steps.</div>
    <div style="max-height:64vh;overflow-y:auto;margin-bottom:0.75rem">${rows}</div>
    <button class="btn btn-ghost" onclick="G.closeModal()">Close</button>`);
}
export function setActivePet(id){
  const pet=(P.petCollection||[]).find(p=>p.id===id);if(!pet)return;
  P.activePetId=id;saveP();SFX.equip();toast(`🐾 ${pet.name} is now active!`);openPetCollection();
}
export function feedPetUI(id){
  const pet=(P.petCollection||[]).find(p=>p.id===id);if(!pet)return;
  const res=feedPet(pet,P);if(!res.ok){SFX.error();toast(res.msg);return;}
  P.gold-=res.cost;saveActivePet(P,res.pet);saveP();SFX.gold();toast(`🍖 Fed ${pet.name}! -🪙${res.cost}`);openPetCollection();
}
export function releasePetUI(id){
  const pet=(P.petCollection||[]).find(p=>p.id===id);if(!pet)return;
  showModal(`<div class="modal-title">Release Pet?</div>
    <div style="text-align:center;font-size:3rem;margin:0.5rem 0">${pet.emoji}</div>
    <div style="text-align:center;color:var(--text3);font-size:0.88rem;margin-bottom:1rem">Release <strong style="color:${RARITY_COLOR[pet.rarity]||"#6b7280"}">${pet.name}</strong>? This cannot be undone.</div>
    <div class="modal-actions"><button class="btn btn-danger" onclick="G.confirmReleasePet('${id}')">Release</button>
      <button class="btn btn-ghost" onclick="G.openPetCollection()">Cancel</button></div>`);
}
export function confirmReleasePet(id){
  const pet=(P.petCollection||[]).find(p=>p.id===id);if(!pet)return;
  P.petCollection=(P.petCollection||[]).filter(p=>p.id!==id);if(P.activePetId===id)P.activePetId=P.petCollection[0]?.id||null;
  saveP();SFX.error();toast(`🌿 Released ${pet.name}.`);openPetCollection();
}

// ── DUNGEONS ─────────────────────────────────────────────────
function _dungeonRewardHtml(rewards){
  if(!rewards||rewards.length===0)return`<div style="text-align:center;color:var(--text3);font-style:italic;padding:0.5rem">No chest rewards this time.</div>`;
  return rewards.map(r=>{
    if(r.type==="gold")return`<div class="modal-row"><em>🪙 Gold Chest</em><span style="color:var(--gold3)">+${fmt(r.amount)}</span></div>`;
    if(r.type==="egg"&&r.item)return`<div class="modal-row"><em>${r.item.emoji||"🥚"} Egg</em><span style="color:${RARITY_COLOR[r.item.rarity]||"var(--gold3)"}">${r.item.name}</span></div>`;
    if(r.type==="item"&&r.item)return`<div class="modal-row"><em>${r.item.emoji||"🎁"} Item</em><span style="color:${RARITY_COLOR[r.item.rarity]||"var(--text)"}">${r.item.name} +${r.item.val}</span></div>`;
    return`<div class="modal-row"><em>Reward</em><span>${JSON.stringify(r)}</span></div>`;
  }).join("");
}
function _renderDungeonModal(){
  const prog=getDungeonProgress(P);
  if(prog){
    const pct=Math.round((prog.pct||0)*100);
    showModal(`<div class="modal-title">${prog.def.emoji} ${prog.def.name}</div>
      <div style="text-align:center;color:var(--text3);font-size:0.86rem;margin-bottom:0.75rem">${prog.def.desc}</div>
      <div class="bar-wrap"><div class="bar-labels"><span>Progress</span><span>${pct}%</span></div><div class="bar bar-exp"><div class="bar-fill" style="width:${pct}%"></div></div></div>
      <div style="text-align:center;color:${prog.done?"var(--green2)":"var(--text3)"};font-family:'Cinzel',serif;font-size:0.82rem;font-weight:700;margin:0.75rem 0">${prog.done?"Ready to claim!":"Remaining: "+fmtDuration(prog.remaining)}</div>
      <div class="modal-actions">
        ${prog.done?`<button class="btn btn-gold" onclick="G.claimDungeonUI()">Claim Rewards</button>`:`<button class="btn btn-ghost" disabled>Dungeon Running...</button>`}
        <button class="btn btn-danger" onclick="G.abandonDungeonUI()">Abandon</button>
        <button class="btn btn-ghost" onclick="G.closeModal()">Close</button>
      </div>`);
    return;
  }
  const rows=DUNGEONS.map(d=>`<div style="background:${d.bgColor||"var(--surface)"};border:1.5px solid ${d.borderColor||"var(--border)"};border-radius:12px;padding:0.85rem;margin-bottom:0.55rem">
    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
      <div style="font-size:2rem">${d.emoji}</div>
      <div style="flex:1"><div style="font-family:'Cinzel',serif;font-size:0.9rem;font-weight:700;color:${d.color||"var(--gold3)"}">${d.name}</div>
        <div style="font-size:0.76rem;color:var(--text3)">${d.desc}</div>
        <div style="font-size:0.68rem;color:var(--text3);margin-top:0.25rem">⏱ ${fmtDuration(d.durationMs)} · 📦 ${d.minChests}-${d.maxChests} chest${d.maxChests===1?"":"s"}</div></div>
    </div>
    <button class="btn btn-gold btn-sm" onclick="G.launchDungeon('${d.id}')">Start</button>
  </div>`).join("");
  showModal(`<div class="modal-title">🏰 Dungeons</div>
    <div style="text-align:center;color:var(--text3);font-size:0.84rem;margin-bottom:0.75rem">Send your hero on a timed dungeon run, then come back to claim rewards.</div>
    ${rows}
    <button class="btn btn-ghost" onclick="G.closeModal()">Close</button>`);
}
export function launchDungeon(dungeonId){
  if(!P){toast("Not logged in");return;}
  if(!dungeonId){_renderDungeonModal();return;}
  const res=startDungeon(P,dungeonId);
  if(!res.ok){SFX.error();toast(res.msg||"Could not start dungeon");_renderDungeonModal();return;}
  saveP();SFX.guild();toast(`${res.def.emoji} ${res.def.name} started!`);_renderDungeonModal();if(TAB==="home")renderHome();
}
export function abandonDungeonUI(){
  const prog=getDungeonProgress(P);
  if(!prog){toast("No active dungeon.");return;}
  showModal(`<div class="modal-title">Abandon Dungeon?</div>
    <div style="text-align:center;color:var(--text3);font-size:0.88rem;margin-bottom:1rem">Leave <strong>${prog.def.name}</strong>? You will lose this run's rewards.</div>
    <div class="modal-actions"><button class="btn btn-danger" onclick="G.confirmAbandonDungeon()">Abandon</button>
      <button class="btn btn-ghost" onclick="G.launchDungeon()">Cancel</button></div>`);
}
export function confirmAbandonDungeon(){
  abandonDungeon(P);saveP();closeModal();SFX.error();toast("🏃 Dungeon abandoned.");if(TAB==="home")renderHome();
}
export function claimDungeonUI(){
  const res=claimDungeon(P);
  if(!res.ok){SFX.error();toast(res.msg||"Could not claim dungeon");_renderDungeonModal();return;}
  checkLevelUp();saveP();SFX.chest();updateHdr();
  const rewardsHtml=_dungeonRewardHtml(res.allRewards);
  showModal(`<div class="modal-title">🏆 ${res.def.name} Complete!</div>
    <div style="text-align:center;color:var(--text3);font-size:0.88rem;margin:0.6rem 0 1rem">Base rewards: <strong style="color:var(--steel)">+${fmt(res.expGain)} EXP</strong> · <strong style="color:var(--gold3)">+🪙${fmt(res.goldGain)}</strong><br>Chests opened: <strong>${res.chestCount}</strong></div>
    ${rewardsHtml}
    <button class="btn btn-gold" onclick="G.closeModal();G.showTab('home')" style="margin-top:1rem">Continue</button>`);
  if(TAB==="home")renderHome();
}

// ── PROFILE ───────────────────────────────────────────────────
export function renderYou(){
  const{str:eStr,def:eDef}=equipStats(P.equipped);const tierIdx=arenaT(P.arenaWins||0),tier=ARENA_TIERS[tierIdx];
  const maxE=calcMaxEnergy(P),expNeed=expLv(P.level),expPct=clamp(Math.round((P.exp/expNeed)*100),0,100);
  document.getElementById("content").innerHTML=`
    <div class="profile-hero">
      <div class="profile-ava">${avatarGfx(84)}</div>
      <div class="profile-name">${P.username}</div>
      <div class="profile-level">Level ${P.level} · <span style="color:${tier.color};font-weight:700">${TIER_EMOJIS[tierIdx]} ${tier.name}</span></div>
      <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:10px;padding:0.75rem;margin-bottom:0.75rem;text-align:left">
        <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text3);margin-bottom:0.3rem;font-family:'Cinzel',serif">
          <span>✨ Experience</span><span>${fmt(P.exp)} / ${fmt(expNeed)}</span></div>
        <div class="bar bar-exp"><div class="bar-fill" style="width:${expPct}%"></div></div>
        <div style="font-size:0.68rem;color:var(--text3);margin-top:0.2rem">${fmt(expNeed-P.exp)} XP to Level ${P.level+1}</div>
      </div>
      <div class="profile-stats">
        <div class="ps-item"><div class="ps-val">${(P.baseStr||10)+eStr}</div><div class="ps-key">⚔️ STR</div></div>
        <div class="ps-item"><div class="ps-val">${(P.baseDef||5)+eDef}</div><div class="ps-key">🛡️ DEF</div></div>
        <div class="ps-item"><div class="ps-val">${P.maxHp}</div><div class="ps-key">❤️ Max HP</div></div>
        <div class="ps-item"><div class="ps-val">${maxE}</div><div class="ps-key">⚡ Max EP</div></div>
        <div class="ps-item"><div class="ps-val">${P.statPoints||0}</div><div class="ps-key">⬆️ Stat Pts</div></div>
        <div class="ps-item"><div class="ps-val">${P.shards||0}</div><div class="ps-key">🧩 Shards</div></div>
        <div class="ps-item"><div class="ps-val">${fmt(P.steps||0)}</div><div class="ps-key">👣 Steps</div></div>
        <div class="ps-item"><div class="ps-val">${P.npcKills||0}</div><div class="ps-key">💀 Kills</div></div>
        <div class="ps-item"><div class="ps-val">${P.pvpKills||0}W/${P.pvpLosses||0}L</div><div class="ps-key">⚔️ PvP</div></div>
        <div class="ps-item"><div class="ps-val">${fmt(P.gold||0)}</div><div class="ps-key">🪙 Gold</div></div>
        <div class="ps-item"><div class="ps-val">${(P.properties||[]).length}</div><div class="ps-key">🏠 Props</div></div>
        <div class="ps-item"><div class="ps-val">${(P.avatars||[]).length}/${AVATARS.length}</div><div class="ps-key">🎭 Avatars</div></div>
      </div>
    </div>
    <button class="btn btn-green" onclick="G.openPetCollection()" style="margin-bottom:0.5rem">🐾 My Pets (${(P.petCollection||[]).length})</button>
    <button class="btn btn-purple" onclick="G.openAvatarCollection()" style="margin-bottom:0.5rem">🎭 My Avatar Collection</button>
    ${P.statPoints>0?`<button class="btn btn-gold" onclick="G.openStatModal()" style="margin-bottom:0.5rem">⬆️ Spend ${P.statPoints} Stat Point${P.statPoints>1?"s":""}</button>`:""}
    <div class="card"><div class="card-title">⚙️ Account</div>
      <button class="btn btn-ghost" onclick="G.handleSignOut()">Sign Out</button></div>
    <button class="btn btn-ghost" onclick="G.showTab('home')" style="margin-top:0.5rem">← Back</button>`;
}
export async function handleSignOut(){clearInterval(energyInterval);clearInterval(partyHeartbeatInterval);if(P?.partyId)await updatePartyMemberStats(P.partyId,CU.uid,{...myPartyStats(),online:false,lastSeen:Date.now()}).catch(()=>{});await signOut(auth);}

// ── QUESTS ───────────────────────────────────────────────────
export function renderQuests(){
  const qs=getQuests(P),now=new Date();
  const msUntilReset=(24-now.getUTCHours())*3600000-now.getUTCMinutes()*60000;
  const hReset=Math.floor(msUntilReset/3600000),mReset=Math.floor((msUntilReset%3600000)/60000);
  const questsHtml=qs.map(q=>{const done=q.progress>=q.target,pct=Math.min(100,Math.round((q.progress/q.target)*100));
    return`<div class="quest-item"><div class="quest-top">
      <div class="quest-icon">${q.icon}</div>
      <div class="quest-info"><div class="quest-name ${done?"quest-done":""}">${q.name} ${done?"✓":""}</div>
        <div class="quest-desc">${q.desc}</div><div class="quest-reward">🎁 +${q.reward.exp} EXP · +${q.reward.gold}🪙</div></div>
      ${done&&!q.claimed?`<button class="btn btn-green btn-sm" onclick="G.claimQuest('${q.id}')">Claim</button>`:done?`<span style="color:var(--text3);font-size:0.72rem">Claimed</span>`:""}
    </div>
    <div class="bar bar-quest" style="height:5px"><div class="bar-fill" style="width:${pct}%"></div></div>
    <div style="font-size:0.7rem;color:var(--text3);margin-top:0.2rem">${q.progress}/${q.target}</div></div>`;}).join("");
  document.getElementById("content").innerHTML=`<div class="card"><div class="card-title">📜 Daily Quests</div>
    <div style="font-size:0.78rem;color:var(--text3);margin-bottom:0.75rem">Resets in ${hReset}h ${mReset}m</div>${questsHtml}</div>
    <button class="btn btn-ghost" onclick="G.showTab('home')" style="margin-top:0.5rem">← Back</button>`;
}
export function claimQuest(id){
  const q=P.quests.list.find(x=>x.id===id);if(!q||q.claimed||q.progress<q.target)return;
  q.claimed=true;P.exp=(P.exp||0)+q.reward.exp;P.gold=(P.gold||0)+q.reward.gold;
  checkLevelUp();saveP();SFX.gold();toast(`🎁 Claimed! +${q.reward.exp} EXP · +${q.reward.gold}🪙`);renderQuests();
}


// ── PARTY SYSTEM ─────────────────────────────────────────────
// Party members contribute STR/DEF like pets — they proc attacks in combat.
// Offline members contribute at 50% power. Max 4 members total.

let _partyCache=null;

function partyMemberStats(m){
  const str=(m.baseStr||10)+(m.equipStr||0);
  const def=(m.baseDef||5)+(m.equipDef||0);
  return{str,def};
}
function myPartyStats(){
  const{str:eStr,def:eDef}=equipStats(P.equipped||{});
  return{baseStr:P.baseStr||10,baseDef:P.baseDef||5,equipStr:eStr,equipDef:eDef,level:P.level||1,username:P.username,avatarId:P.activeAvatar||null};
}
export async function renderParty(){
  // Check for pending invites first
  if(P.pendingPartyInvite&&!P.partyId){
    const inv=P.pendingPartyInvite;
    const party=await getParty(inv);
    if(party&&(party.members||[]).length<4){
      const leader=party.members?.find(m=>m.uid===party.leaderId);
      showModal(`<div class="modal-title">⚔️ Party Invite!</div>
        <div style="text-align:center;padding:0.5rem;color:var(--text3);font-size:0.9rem;margin-bottom:1rem">
          <strong>${leader?.username||"Someone"}</strong> invited you to their party!</div>
        <div style="text-align:center;font-size:0.75rem;color:var(--text3);margin-bottom:1rem">Members: ${(party.members||[]).map(m=>m.username).join(", ")}</div>
        <div class="modal-actions">
          <button class="btn btn-steel" onclick="G.acceptParty('${inv}')">⚔️ Join Party</button>
          <button class="btn btn-ghost" onclick="G.declineParty('${inv}')">Decline</button>
        </div>`);
      return;
    }else{
      // Party full or gone — clear invite
      await updateDoc(doc(db,"players",CU.uid),{pendingPartyInvite:null});
      P.pendingPartyInvite=null;
    }
  }
  if(!P.partyId){renderPartySearch();return;}
  const party=await getParty(P.partyId);
  if(!party){P.partyId=null;saveP();renderPartySearch();return;}
  _partyCache=party;
  // Refresh my stats in the party doc
  await updatePartyMemberStats(P.partyId,CU.uid,myPartyStats()).catch(()=>{});
  renderPartyView(party);
}
function renderPartySearch(){
  const body=document.getElementById("party-body");if(!body)return;
  body.innerHTML=`
    <div style="text-align:center;padding:1.5rem 0.5rem">
      <div style="font-size:3rem;margin-bottom:0.5rem">⚔️</div>
      <div style="font-family:'Cinzel',serif;font-size:1rem;color:var(--text2);margin-bottom:0.4rem">No Party</div>
      <div style="font-size:0.82rem;color:var(--text3);margin-bottom:1.2rem;line-height:1.5">Party up with other players! Members boost your combat — even when offline they fight alongside you at 50% power.</div>
      <button class="btn btn-steel" onclick="G.createPartyUI()">⚔️ Create Party</button>
    </div>
    <div class="section-hdr">Invite a Player</div>
    <div id="party-invite-list" style="text-align:center;color:var(--text3);padding:1rem;font-style:italic">Loading players...</div>`;
  loadLeaderboard().then(all=>{
    const others=(all||[]).filter(p=>p.id!==CU.uid&&p.username&&!p.partyId).slice(0,20);
    const el=document.getElementById("party-invite-list");if(!el)return;
    if(others.length===0){el.innerHTML=`<div style="font-style:italic;color:var(--text3)">No available players.</div>`;return;}
    el.innerHTML=others.map(p=>`<div class="market-item">
      <div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${avatarGfxFor(p,34)}</div>
      <div class="market-info"><div class="market-name">${p.username}</div>
        <div class="market-stat">Lv.${p.level||1} · ⚔️${(p.baseStr||10)+(equipStats(p.equipped||{}).str)} 🛡️${(p.baseDef||5)+(equipStats(p.equipped||{}).def)}</div></div>
      <button class="btn btn-steel btn-sm" onclick="G.quickInvite('${p.id}','${p.username}')">Invite</button>
    </div>`).join("");
  });
}
async function renderPartyView(party){
  const body=document.getElementById("party-body");if(!body)return;
  const isLeader=party.leaderId===CU.uid;
  const members=party.members||[];
  const now=Date.now();
  const memberRows=members.map(m=>{
    const isMe=m.uid===CU.uid;
    const isOnline=(now-(m.lastSeen||m.joinedAt||0))<60000||isMe; // online if heartbeat within 60s
    const {str,def}=partyMemberStats(m);
    const powerMult=isOnline?1.0:0.5;
    const contribution=Math.round((str*0.12+def*0.06)*powerMult);
    return`<div style="border:1.5px solid ${isMe?"var(--gold2)":"var(--border)"};border-radius:12px;padding:0.75rem;margin-bottom:0.5rem;background:${isMe?"#fffbeb":"var(--surface)"}">
      <div style="display:flex;align-items:center;gap:0.65rem">
        <div style="font-size:1.6rem">${m.avatarId?AVATARS.find(a=>a.id===m.avatarId)?.emoji||"🧙":"🧙"}</div>
        <div style="flex:1;min-width:0">
          <div style="font-family:'Cinzel',serif;font-size:0.88rem;font-weight:700;color:${isMe?"var(--gold3)":"var(--text)"}">${m.username}${isMe?" (you)":""}${party.leaderId===m.uid?" 👑":""}</div>
          <div style="font-size:0.7rem;color:var(--text3)">Lv.${m.level||1} · ⚔️${str} 🛡️${def}</div>
          <div style="font-size:0.7rem;color:${isOnline?"var(--green2)":"var(--text3)"}">
            ${isOnline?"🟢 Online":"⚫ Offline (50% power)"} · +${contribution} dmg/round
          </div>
        </div>
        ${isLeader&&!isMe?`<button class="btn btn-danger btn-sm" style="font-size:0.62rem" onclick="G.kickPartyMember('${m.uid}')">Kick</button>`:""}
        ${isMe&&!isLeader?`<button class="btn btn-ghost btn-sm" style="font-size:0.62rem" onclick="G.leavePartyUI()">Leave</button>`:""}
      </div></div>`;}).join("");
  const canInvite=isLeader&&members.length<4;
  body.innerHTML=`
    <div style="background:var(--surface);border:1.5px solid var(--border2);border-radius:14px;padding:0.9rem;margin-bottom:0.75rem">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.6rem">
        <div style="font-family:'Cinzel',serif;font-size:0.9rem;font-weight:700">⚔️ Party (${members.length}/4)</div>
        ${isLeader?`<button class="btn btn-danger btn-sm" style="font-size:0.62rem" onclick="G.disbandPartyUI()">Disband</button>`:""}
      </div>
      <div style="font-size:0.75rem;color:var(--text3);margin-bottom:0.75rem">Members fight alongside you in combat — like pets but stronger!</div>
      ${memberRows}
    </div>
    ${canInvite?`<div class="section-hdr">Invite Member</div>
    <div id="party-invite-list" style="text-align:center;color:var(--text3);padding:0.5rem;font-style:italic">Loading...</div>`:""}`;
  if(canInvite){
    loadLeaderboard().then(all=>{
      const el=document.getElementById("party-invite-list");if(!el)return;
      const alreadyIn=new Set(members.map(m=>m.uid));
      const others=(all||[]).filter(p=>p.id!==CU.uid&&p.username&&!alreadyIn.has(p.id)).slice(0,15);
      if(others.length===0){el.innerHTML=`<div style="font-style:italic">No available players.</div>`;return;}
      el.innerHTML=others.map(p=>`<div class="market-item">
        <div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center">${avatarGfxFor(p,34)}</div>
        <div class="market-info"><div class="market-name">${p.username}</div>
          <div class="market-stat">Lv.${p.level||1}</div></div>
        <button class="btn btn-steel btn-sm" onclick="G.inviteToPartyUI('${p.id}','${p.username}')">Invite</button>
      </div>`).join("");
    });
  }
}
export async function createPartyUI(){
  SFX.click();
  const partyId=await createParty(CU.uid,P.username,myPartyStats());
  P.partyId=partyId;saveP();toast("⚔️ Party created! Invite friends.");
  renderParty();
}
export async function quickInvite(targetId,targetName){
  if(!P.partyId){
    const partyId=await createParty(CU.uid,P.username,myPartyStats());
    P.partyId=partyId;saveP();
  }
  await inviteToPartyUI(targetId,targetName);
}
export async function inviteToPartyUI(targetId,targetName){
  SFX.click();
  const party=await getParty(P.partyId);
  if(!party){P.partyId=null;saveP();renderParty();return;}
  if((party.members||[]).length>=4){SFX.error();toast("Party is full (max 4)!");return;}
  const already=(party.invites||[]).some(i=>i.uid===targetId)||(party.members||[]).some(m=>m.uid===targetId);
  if(already){toast("Already invited or in party!");return;}
  await inviteToParty(P.partyId,targetId,targetName,P.username);
  SFX.guild();toast(`📨 Invited ${targetName}!`);
}
export async function acceptParty(partyId){
  const ok=await acceptPartyInvite(partyId,CU.uid,P.username,myPartyStats());
  if(ok){P.partyId=partyId;P.pendingPartyInvite=null;saveP();SFX.guild();toast("⚔️ Joined the party!");closeModal();renderParty();}
  else{SFX.error();toast("Party full or expired.");P.pendingPartyInvite=null;saveP();closeModal();}
}
export async function declineParty(partyId){
  await updateDoc(doc(db,"players",CU.uid),{pendingPartyInvite:null});
  P.pendingPartyInvite=null;saveP();closeModal();renderParty();
}
export async function leavePartyUI(){
  if(!P.partyId)return;
  const party=await getParty(P.partyId);
  if(party){await leaveParty(P.partyId,CU.uid,party.members,party.leaderId);}
  P.partyId=null;saveP();SFX.click();toast("Left the party.");renderParty();
}
export async function kickPartyMember(targetUid){
  if(!P.partyId)return;const party=await getParty(P.partyId);if(!party)return;
  if(party.leaderId!==CU.uid){SFX.error();toast("Only the leader can kick!");return;}
  await kickFromParty(P.partyId,targetUid,party.members);
  SFX.click();toast("Member kicked.");renderParty();
}
export async function disbandPartyUI(){
  if(!P.partyId)return;const party=await getParty(P.partyId);
  if(party){await disbandParty(P.partyId,party.members);}
  P.partyId=null;saveP();SFX.click();toast("Party disbanded.");renderParty();
}

// ── PARTY COMBAT CONTRIBUTION ─────────────────────────────────
// Called during combat tick — returns damage dealt by party members this round
export async function getPartyMembers(){
  if(!P.partyId)return[];
  try{
    const party=await getParty(P.partyId);if(!party)return[];
    return(party.members||[]).filter(m=>m.uid!==CU.uid);
  }catch(e){return[];}
}

// ── BANK ─────────────────────────────────────────────────────
export function renderBank(){
  document.getElementById("content").innerHTML=`<div class="card"><div class="card-title">🏦 Royal Bank</div>
    <div class="bank-display"><div class="bank-amount">🏦 ${fmt(P.bank)}</div><div class="bank-label">Bank Balance</div></div>
    <div class="bank-display" style="margin-bottom:0.75rem"><div class="bank-amount">🪙 ${fmt(P.gold)}</div><div class="bank-label">On Hand</div></div>
    <div style="font-size:0.82rem;color:var(--text3);margin-bottom:0.6rem">Deposit Gold</div>
    <div class="bank-input-row"><input class="bank-input" id="deposit-amt" type="number" placeholder="Amount" min="1"/>
      <button class="btn btn-gold btn-sm" style="width:auto;padding:0.65rem 1rem" onclick="G.doDeposit()">Deposit</button></div>
    <div style="font-size:0.82rem;color:var(--text3);margin-bottom:0.6rem;margin-top:0.5rem">Withdraw Gold</div>
    <div class="bank-input-row"><input class="bank-input" id="withdraw-amt" type="number" placeholder="Amount" min="1"/>
      <button class="btn btn-ghost btn-sm" style="width:auto;padding:0.65rem 1rem" onclick="G.doWithdraw()">Withdraw</button></div>
  </div><button class="btn btn-ghost" onclick="G.showTab('home')" style="margin-top:0.5rem">← Back</button>`;
}
export function doDeposit(){
  const amt=Math.floor(Number(document.getElementById("deposit-amt").value));if(!amt||amt<1){toast("Enter a valid amount");return;}
  if(amt>(P.gold||0)){SFX.error();toast("Not enough gold!");return;}
  P.gold-=amt;P.bank=(P.bank||0)+amt;saveP();SFX.gold();toast(`🏦 Deposited 🪙${fmt(amt)}`);renderBank();
}
export function doWithdraw(){
  const amt=Math.floor(Number(document.getElementById("withdraw-amt").value));if(!amt||amt<1){toast("Enter a valid amount");return;}
  if(amt>(P.bank||0)){SFX.error();toast("Not enough in bank!");return;}
  P.bank-=amt;P.gold=(P.gold||0)+amt;saveP();SFX.gold();toast(`🪙 Withdrew ${fmt(amt)}`);renderBank();
}

// ── PROPERTIES ───────────────────────────────────────────────
export function renderProperties(){
  const owned=getOwnedProperties(P),rentalPending=getRentalIncome(P);
  const ownedHtml=owned.length===0?"":owned.map(op=>{const prop=PROPERTIES.find(p=>p.id===op.id);if(!prop)return"";
    const isHome=op.instanceId===P.homePropertyInstanceId,daily=Math.floor(prop.price*prop.rentalRate),sellPrice=Math.floor(prop.price*CFG.PROPERTY_SELL_RATE);
    return`<div style="background:var(--surface);border:1.5px solid ${isHome?"var(--gold2)":"var(--border)"};border-radius:12px;padding:0.9rem;margin-bottom:0.5rem">
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
        <div style="font-size:2rem">${prop.emoji}</div>
        <div style="flex:1"><div style="font-family:'Cinzel',serif;font-size:0.9rem;font-weight:700;color:${isHome?"var(--gold3)":"var(--text)"}">${prop.name}${isHome?" 🏠":""}</div>
          <div style="font-size:0.75rem;color:var(--text3)">${prop.desc}</div>
          ${isHome?`<div style="font-size:0.72rem;color:var(--steel);margin-top:0.2rem;font-weight:600">+${prop.energyBonus} Max Energy</div>`
            :`<div style="font-size:0.72rem;color:var(--green2);margin-top:0.2rem;font-weight:600">🪙${fmt(daily)}/day rental</div>`}
        </div></div>
      <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
        ${!isHome?`<button class="btn btn-steel btn-sm" onclick="G.setHome('${op.instanceId}','${prop.id}')">Move In</button>`:""}
        ${isHome&&owned.length>1?`<button class="btn btn-ghost btn-sm" onclick="G.unsetHome()">Move Out</button>`:""}
        <button class="btn btn-danger btn-sm" onclick="G.sellProperty('${op.instanceId}','${prop.id}')">Sell (🪙${fmt(sellPrice)})</button>
      </div></div>`;}).join("");
  const availHtml=PROPERTIES.map(prop=>{const ownedCount=countOwned(P,prop.id),nextPrice=propertyPrice(P,prop.id);
    return`<div style="background:var(--surface);border:1.5px solid var(--border);border-radius:12px;padding:0.9rem;margin-bottom:0.5rem">
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
        <div style="font-size:2rem">${prop.emoji}</div>
        <div style="flex:1"><div style="font-family:'Cinzel',serif;font-size:0.9rem;font-weight:700">${prop.name}${ownedCount>0?` <span style="font-size:0.65rem;color:var(--text3)">(own ${ownedCount})</span>`:""}</div>
          <div style="font-size:0.75rem;color:var(--text3)">${prop.desc}</div>
          <div style="display:flex;gap:0.6rem;margin-top:0.25rem;flex-wrap:wrap">
            <span style="font-size:0.7rem;color:var(--steel);font-weight:600">+${prop.energyBonus} energy if home</span>
            <span style="font-size:0.7rem;color:var(--green2);font-weight:600">🪙${fmt(Math.floor(prop.price*prop.rentalRate))}/day rent</span>
          </div></div>
        <div style="text-align:right;flex-shrink:0"><div style="font-family:'Cinzel',serif;color:var(--gold3);font-size:0.9rem;font-weight:700">🪙${fmt(nextPrice)}</div>
          ${ownedCount>0?`<div style="font-size:0.6rem;color:var(--text3)">+5% per copy</div>`:""}
        </div></div>
      <button class="btn btn-gold btn-sm" onclick="G.buyProperty('${prop.id}')" ${(P.gold||0)<nextPrice?"disabled":""}>${(P.gold||0)>=nextPrice?"Purchase":"Need 🪙"+fmt(nextPrice)}</button>
    </div>`;}).join("");
  document.getElementById("content").innerHTML=`
    ${rentalPending>0?`<div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:0.85rem;margin-bottom:0.7rem;display:flex;align-items:center;gap:0.75rem">
      <div style="font-size:1.5rem">🏠</div><div style="flex:1"><div style="font-family:'Cinzel',serif;font-size:0.82rem;color:var(--green);font-weight:700">🪙${fmt(rentalPending)} in Rental Income!</div></div>
      <button class="btn btn-green btn-sm" onclick="G.claimRent()">Collect</button></div>`:""}
    ${owned.length>0?`<div class="section-hdr">Your Properties (${owned.length})</div>${ownedHtml}`:""}
    <div class="section-hdr">Available to Buy</div>${availHtml}
    <button class="btn btn-ghost" onclick="G.showTab('home')" style="margin-top:0.5rem">← Back</button>`;
}
export function buyProperty(id){
  const prop=PROPERTIES.find(p=>p.id===id);if(!prop)return;const price=propertyPrice(P,id);
  if((P.gold||0)<price){SFX.error();toast("💰 Not enough gold!");return;}
  P.gold-=price;const instanceId=`${id}_${Date.now()}`;
  P.properties=[...(P.properties||[]),{id:prop.id,instanceId,purchasedAt:Date.now(),lastRentClaim:Date.now()}];
  if(!P.homePropertyInstanceId){P.homePropertyId=prop.id;P.homePropertyInstanceId=instanceId;}
  saveP();SFX.gold();toast(`🏠 Purchased ${prop.name}!`);renderProperties();
}
export function setHome(instanceId,propId){P.homePropertyInstanceId=instanceId;P.homePropertyId=propId;P.energy=Math.min(P.energy,calcMaxEnergy(P));saveP();toast("🏠 Moved in!");renderProperties();}
export function unsetHome(){P.homePropertyInstanceId=null;P.homePropertyId=null;saveP();toast("🏠 Moved out!");renderProperties();}
export function sellProperty(instanceId,propId){
  const prop=PROPERTIES.find(p=>p.id===propId);if(!prop)return;const sellPrice=Math.floor(prop.price*CFG.PROPERTY_SELL_RATE);
  showModal(`<div class="modal-title">Sell Property?</div>
    <div style="text-align:center;font-size:3rem;margin:0.5rem 0">${prop.emoji}</div>
    <div style="text-align:center;color:var(--text3);font-size:0.88rem;margin-bottom:1rem">Sell <strong>${prop.name}</strong> for <strong style="color:var(--gold3)">🪙${fmt(sellPrice)}</strong>?</div>
    <div class="modal-actions"><button class="btn btn-danger" onclick="G.confirmSellProperty('${instanceId}','${propId}')">Confirm Sale</button>
      <button class="btn btn-ghost" onclick="G.closeModal()">Cancel</button></div>`);
}
export function confirmSellProperty(instanceId,propId){
  const prop=PROPERTIES.find(p=>p.id===propId);if(!prop)return;
  P.properties=(P.properties||[]).filter(op=>op.instanceId!==instanceId);
  if(P.homePropertyInstanceId===instanceId){P.homePropertyInstanceId=null;P.homePropertyId=null;}
  P.gold=(P.gold||0)+Math.floor(prop.price*CFG.PROPERTY_SELL_RATE);
  saveP();closeModal();SFX.gold();toast(`🪙 Property sold!`);renderProperties();
}
