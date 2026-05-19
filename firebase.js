// ============================================================
//  MicroMMO — firebase.js
//  Firebase init, auth listeners, and all Firestore helpers.
//  Import this; never reference firebase directly from other files.
// ============================================================

import{initializeApp}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import{getAuth,onAuthStateChanged,signInWithEmailAndPassword,
  createUserWithEmailAndPassword,signInWithPopup,GoogleAuthProvider,signOut
}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import{getFirestore,doc,getDoc,setDoc,deleteDoc,updateDoc,collection,
  getDocs,addDoc,query,where,orderBy,limit,serverTimestamp,arrayUnion,arrayRemove,increment
}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const FIREBASE_CONFIG={
  apiKey:"AIzaSyA4-X-N-wAFnmPwZcJ-SnWJKMI-mNa2kQs",
  authDomain:"micrommo-77c6e.firebaseapp.com",
  projectId:"micrommo-77c6e",
  storageBucket:"micrommo-77c6e.firebasestorage.app",
  messagingSenderId:"639233695341",
  appId:"1:639233695341:web:d0df1515a79c9df6afa964"
};

const fbApp=initializeApp(FIREBASE_CONFIG);
export const auth =getAuth(fbApp);
export const db   =getFirestore(fbApp);
export const gp   =new GoogleAuthProvider();

// Re-export arrayUnion/arrayRemove/increment so callers don't import Firebase directly
export {arrayUnion,arrayRemove,increment,onAuthStateChanged,
  signInWithEmailAndPassword,createUserWithEmailAndPassword,
  signInWithPopup,signOut,doc,getDoc,setDoc,deleteDoc,updateDoc,
  collection,getDocs,addDoc};

// ── PLAYER CRUD ───────────────────────────────────────────────
export async function loadP(uid){
  const s=await getDoc(doc(db,"players",uid));
  return s.exists()?s.data():null;
}
export async function saveP(uid,P){
  if(!uid||!P)return;
  await setDoc(doc(db,"players",uid),P);
}

// ── LEADERBOARD ───────────────────────────────────────────────
export async function loadLeaderboard(){
  const s=await getDocs(collection(db,"players"));
  return s.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p&&p.username);
}

// ── MARKET ────────────────────────────────────────────────────
export async function getListings(){
  const s=await getDocs(collection(db,"market"));
  return s.docs.map(d=>({id:d.id,...d.data()}));
}
export async function addListing(sellerId,sellerName,item,price){
  await addDoc(collection(db,"market"),{sellerId,sellerName,item,price,listedAt:Date.now()});
}
export async function removeListing(id){
  await deleteDoc(doc(db,"market",id));
}

// ── BOUNTIES ──────────────────────────────────────────────────
export async function getBounties(){
  const s=await getDocs(collection(db,"bounties"));
  return s.docs.map(d=>({id:d.id,...d.data()}));
}

// ── GUILDS ────────────────────────────────────────────────────
export async function getGuild(id){
  if(!id)return null;
  const s=await getDoc(doc(db,"guilds",id));
  return s.exists()?{id:s.id,...s.data()}:null;
}

// ── CIRCULATION ───────────────────────────────────────────────
import{slug}from"./data.js";

export async function trackCirculation(itemName){
  try{
    const ref=doc(db,"circulation",slug(itemName));
    await setDoc(ref,{count:increment(1),name:itemName},{merge:true});
  }catch(e){}
}
export async function getCirculation(itemName){
  try{
    const snap=await getDoc(doc(db,"circulation",slug(itemName)));
    return snap.exists()?snap.data().count:0;
  }catch(e){return 0;}
}

// ── PARTY ─────────────────────────────────────────────────────
export async function getParty(partyId){
  if(!partyId)return null;
  const s=await getDoc(doc(db,"parties",partyId));
  return s.exists()?{id:s.id,...s.data()}:null;
}
export async function createParty(leaderId,leaderName,leaderStats){
  const ref=await addDoc(collection(db,"parties"),{
    leaderId,members:[{uid:leaderId,username:leaderName,...leaderStats,online:true,joinedAt:Date.now()}],
    invites:[],createdAt:Date.now()
  });
  await updateDoc(doc(db,"players",leaderId),{partyId:ref.id});
  return ref.id;
}
export async function inviteToParty(partyId,targetUid,targetName,fromName){
  await updateDoc(doc(db,"parties",partyId),{invites:arrayUnion({uid:targetUid,username:targetName,sentAt:Date.now()})});
  await updateDoc(doc(db,"players",targetUid),{notifications:arrayUnion(`⚔️ ${fromName} invited you to their party! Check Social → Party tab.`),pendingPartyInvite:partyId});
}
export async function acceptPartyInvite(partyId,uid,username,stats){
  const party=await getParty(partyId);if(!party)return false;
  if((party.members||[]).length>=4)return false;
  const newMember={uid,username,...stats,online:true,joinedAt:Date.now()};
  await updateDoc(doc(db,"parties",partyId),{members:arrayUnion(newMember),invites:(party.invites||[]).filter(i=>i.uid!==uid)});
  await updateDoc(doc(db,"players",uid),{partyId,pendingPartyInvite:null});
  return true;
}
export async function leaveParty(partyId,uid,members,leaderId){
  const remaining=(members||[]).filter(m=>m.uid!==uid);
  if(remaining.length===0){await deleteDoc(doc(db,"parties",partyId));}
  else{
    const newLeaderId=remaining[0].uid;
    await updateDoc(doc(db,"parties",partyId),{members:remaining,leaderId:remaining[0].uid===leaderId?leaderId:newLeaderId});
  }
  await updateDoc(doc(db,"players",uid),{partyId:null,pendingPartyInvite:null});
}
export async function kickFromParty(partyId,targetUid,members){
  const remaining=(members||[]).filter(m=>m.uid!==targetUid);
  await updateDoc(doc(db,"parties",partyId),{members:remaining});
  await updateDoc(doc(db,"players",targetUid),{partyId:null,notifications:arrayUnion("You were kicked from the party.")});
}
export async function updatePartyMemberStats(partyId,uid,stats){
  try{
    const party=await getParty(partyId);if(!party)return;
    const members=(party.members||[]).map(m=>m.uid===uid?{...m,...stats,online:true,lastSeen:Date.now()}:m);
    await updateDoc(doc(db,"parties",partyId),{members});
  }catch(e){}
}
export async function disbandParty(partyId,members){
  for(const m of(members||[]))await updateDoc(doc(db,"players",m.uid),{partyId:null}).catch(()=>{});
  await deleteDoc(doc(db,"parties",partyId));
}
