// ============================================================
//  MicroMMO — game.js  (entry point)
//  Handles auth state, starts the game, exposes window.G.
//  All logic lives in data.js / engine.js / firebase.js / ui.js
// ============================================================

import{auth,loadP,saveP}from"./firebase.js";
import{onAuthStateChanged,signOut,doc,setDoc}from"./firebase.js";
import{db}from"./firebase.js";
import{newPlayer,unlockAudio}from"./engine.js";
import{
  // state setters
  CU,P,
  // game lifecycle
  startGame,showScreen,
  // auth UI
  showErr,hideErr,switchAuthTab,handleEmailAuth,handleGoogleAuth,handleSetUsername,
  // navigation
  showTab,hideWalk,closeModal,
  // walk
  takeStep,openAreaSelect,selectArea,
  // home
  openStatModal,spendStat,claimRent,
  // gear
  openItemModal,equipItem,unequipItem,dropInventory,dropEquipped,
  // market
  renderMarket,mTab,promptSell,confirmSell,buyListing,cancelListing,
  buyShopItem,buyConsumable,sellToNpc,openMysteryChest,
  // pvp
  pvpTab,attackPlayer,
  // bounties
  openPostBounty,confirmPostBounty,cancelBounty,claimBounty,
  // guilds
  openCreateGuild,confirmCreateGuild,openJoinGuild,joinGuild,
  donateToGuild,confirmDonateGold,donateItemToGuild,confirmDonateItem,
  giveVaultItem,confirmGiveItem,startGuildRaid,contributeToRaid,
  promoteGuildMember,kickGuildMember,leaveGuild,confirmLeaveGuild,
  // misc
  claimQuest,doDeposit,doWithdraw,
  buyProperty,setHome,unsetHome,sellProperty,confirmSellProperty,
  lbTab,handleSignOut,equipAvatar,openAvatarCollection,
  fleeCombat,healInCombat,resumeCombat,abandonCombat,
  resolveChoice,
  salvageItem,confirmSalvage,upgradeItem,
  updateHdr,
  // pets & eggs
  buyEgg,hatchEgg,openPetCollection,setActivePet,feedPetUI,releasePetUI,confirmReleasePet,
}from"./ui.js";

// ── AUTH STATE LISTENER ────────────────────────────────────────
import{setCU,setP}from"./ui.js";

onAuthStateChanged(auth,async u=>{
  setCU(u);
  if(u){
    const data=await loadP(u.uid);
    setP(data);
    if(data)startGame();
    else showScreen("username-screen");
  }else{
    showScreen("auth-screen");
  }
});

// ── AUDIO UNLOCK (touch/click) ────────────────────────────────
document.addEventListener("touchstart",unlockAudio,{once:true});
document.addEventListener("click",unlockAudio,{once:true});

// ── EXPOSE GLOBAL API ─────────────────────────────────────────
window.G={
  switchAuthTab,handleEmailAuth,handleGoogleAuth,handleSetUsername,
  showTab,hideWalk,closeModal,
  takeStep,openAreaSelect,selectArea,
  openStatModal,spendStat,claimRent,
  openItemModal,equipItem,unequipItem,dropInventory,dropEquipped,
  renderMarket,mTab,
  promptSell,confirmSell,buyListing,cancelListing,
  buyShopItem,buyConsumable,sellToNpc,openMysteryChest,
  pvpTab,attackPlayer,
  openPostBounty,confirmPostBounty,cancelBounty,claimBounty,
  openCreateGuild,confirmCreateGuild,openJoinGuild,joinGuild,
  donateToGuild,confirmDonateGold,donateItemToGuild,confirmDonateItem,
  giveVaultItem,confirmGiveItem,startGuildRaid,contributeToRaid,
  promoteGuildMember,kickGuildMember,leaveGuild,confirmLeaveGuild,
  claimQuest,doDeposit,doWithdraw,
  buyProperty,setHome,unsetHome,sellProperty,confirmSellProperty,
  lbTab,handleSignOut,equipAvatar,openAvatarCollection,
  fleeCombat,healInCombat,resumeCombat,abandonCombat,
  resolveChoice,
  salvageItem,confirmSalvage,upgradeItem,
  // pets & eggs
  buyEgg,hatchEgg,openPetCollection,setActivePet,feedPetUI,releasePetUI,confirmReleasePet,
};
