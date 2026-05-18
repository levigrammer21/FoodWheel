// ============================================================
//  MicroMMO — game.js  (entry point)
//  Handles auth state, starts the game, exposes window.G.
//  All logic lives in data.js / engine.js / firebase.js / ui.js
// ============================================================

import { auth, loadP, onAuthStateChanged } from "./firebase.js";
import { unlockAudio } from "./engine.js";

import {
  startGame, showScreen,
  switchAuthTab, handleEmailAuth, handleGoogleAuth, handleSetUsername,
  showTab, hideWalk, closeModal,
  takeStep, openAreaSelect, selectArea,
  openStatModal, spendStat, claimRent,
  openItemModal, equipItem, unequipItem, dropInventory, dropEquipped,
  renderMarket, mTab, promptSell, confirmSell, buyListing, cancelListing,
  buyShopItem, buyConsumable, sellToNpc, openMysteryChest,
  pvpTab, attackPlayer,
  openPostBounty, confirmPostBounty, cancelBounty, claimBounty,
  openCreateGuild, confirmCreateGuild, openJoinGuild, joinGuild,
  donateToGuild, confirmDonateGold, donateItemToGuild, confirmDonateItem,
  giveVaultItem, confirmGiveItem, startGuildRaid, contributeToRaid,
  promoteGuildMember, kickGuildMember, leaveGuild, confirmLeaveGuild,
  claimQuest, doDeposit, doWithdraw,
  buyProperty, setHome, unsetHome, sellProperty, confirmSellProperty,
  lbTab, handleSignOut, equipAvatar, openAvatarCollection,
  fleeCombat, healInCombat, resumeCombat, abandonCombat,
  resolveChoice, salvageItem, confirmSalvage, upgradeItem,
  launchDungeon, abandonDungeonUI, confirmAbandonDungeon, claimDungeonUI,
  setCU, setP
} from "./ui.js";

onAuthStateChanged(auth, async user => {
  setCU(user);

  if (user) {
    const data = await loadP(user.uid);
    setP(data);

    if (data) {
      startGame();
    } else {
      showScreen("username-screen");
    }
  } else {
    showScreen("auth-screen");
  }
});

document.addEventListener("touchstart", unlockAudio, { once: true });
document.addEventListener("click", unlockAudio, { once: true });

window.G = {
  switchAuthTab, handleEmailAuth, handleGoogleAuth, handleSetUsername,
  showTab, hideWalk, closeModal,
  takeStep, openAreaSelect, selectArea,
  openStatModal, spendStat, claimRent,
  openItemModal, equipItem, unequipItem, dropInventory, dropEquipped,
  renderMarket, mTab, promptSell, confirmSell, buyListing, cancelListing,
  buyShopItem, buyConsumable, sellToNpc, openMysteryChest,
  pvpTab, attackPlayer,
  openPostBounty, confirmPostBounty, cancelBounty, claimBounty,
  openCreateGuild, confirmCreateGuild, openJoinGuild, joinGuild,
  donateToGuild, confirmDonateGold, donateItemToGuild, confirmDonateItem,
  giveVaultItem, confirmGiveItem, startGuildRaid, contributeToRaid,
  promoteGuildMember, kickGuildMember, leaveGuild, confirmLeaveGuild,
  claimQuest, doDeposit, doWithdraw,
  buyProperty, setHome, unsetHome, sellProperty, confirmSellProperty,
  lbTab, handleSignOut, equipAvatar, openAvatarCollection,
  fleeCombat, healInCombat, resumeCombat, abandonCombat,
  resolveChoice, salvageItem, confirmSalvage, upgradeItem,
  launchDungeon, abandonDungeonUI, confirmAbandonDungeon, claimDungeonUI
};
