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
