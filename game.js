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
  CU,P,startGame,showScreen,
  showErr,hideErr,switchAuthTab,handleEmailAuth,handleGoogleAuth,handleSetUsername,
  showTab,hideWalk,closeModal,
  takeStep,openAreaSelect,selectArea,
  openStatModal,spendStat,claimRent,
  openItemModal,equipItem,unequipItem,dropInventory,dropEquipped,
  renderMarket,mTab,promptSell,confirmSell,buyListing,cancelListing,
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
  resolveChoice,salvageItem,confirmSalvage,upgradeItem,
  updateHdr,
  // dungeons
  launchDungeon,abandonDungeonUI,confirmAbandonDungeon,claimDungeonUI,
  // eggs
  buyEgg,hatchEgg,openItemModalEgg,
  // pets
  setActivePet,openPetCollection,feedPetUI,releasePetUI,confirmReleasePet,
  // party
  renderParty,socialTab,createPartyUI,quickInvite,inviteToPartyUI,acceptParty,declineParty,
  leavePartyUI,kickPartyMember,disbandPartyUI,
  // gear sort + mass actions + lock
  setInvSort,toggleLock,
  openMassSalvage,openMassSalvageFilter,confirmMassSalvage,
  openMassSell,openMassSellFilter,confirmMassSell,
}from"./ui.js";
import{setCU,setP}from"./ui.js";

onAuthStateChanged(auth,async u=>{
  setCU(u);
  if(u){const data=await loadP(u.uid);setP(data);if(data)startGame();else showScreen("username-screen");}
  else showScreen("auth-screen");
});

document.addEventListener("touchstart",unlockAudio,{once:true});
document.addEventListener("click",unlockAudio,{once:true});

window.G={
  switchAuthTab,handleEmailAuth,handleGoogleAuth,handleSetUsername,
  showTab,hideWalk,closeModal,
  takeStep,openAreaSelect,selectArea,
  openStatModal,spendStat,claimRent,
  openItemModal,equipItem,unequipItem,dropInventory,dropEquipped,
  renderMarket,mTab,promptSell,confirmSell,buyListing,cancelListing,
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
  resolveChoice,salvageItem,confirmSalvage,upgradeItem,
  // dungeons
  launchDungeon,abandonDungeonUI,confirmAbandonDungeon,claimDungeonUI,
  // eggs
  buyEgg,hatchEgg,openItemModalEgg,
  // pets
  setActivePet,openPetCollection,feedPetUI,releasePetUI,confirmReleasePet,
  // party
  renderParty,socialTab,createPartyUI,quickInvite,inviteToPartyUI,acceptParty,declineParty,
  leavePartyUI,kickPartyMember,disbandPartyUI,
  // gear sort + mass actions + lock
  setInvSort,toggleLock,
  openMassSalvage,openMassSalvageFilter,confirmMassSalvage,
  openMassSell,openMassSellFilter,confirmMassSell,
};
