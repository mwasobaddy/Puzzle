import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase, ref, set, onValue, update, remove, onDisconnect, push, runTransaction, get, increment } from 'firebase/database';
import { nanoid } from 'nanoid';


const firebaseConfig = {
  apiKey: "AIzaSyAuzyxG9Cs1ma9chjR-uJZegoMAc1Vp2Ig",
  authDomain: "nash-ac5c0.firebaseapp.com",
  projectId: "nash-ac5c0",
  storageBucket: "nash-ac5c0.firebasestorage.app",
  messagingSenderId: "49955314335",
  appId: "1:49955314335:web:e12140aa04351c658060aa",
  measurementId: "G-Y1LW4LFGR2",
  databaseURL: "https://nash-ac5c0-default-rtdb.firebaseio.com/",
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

const storage = getStorage(app);
const db = getFirestore(app);
const database = getDatabase(app);

export {
  auth,
  googleProvider,
  storage,
  app,
  remove,
  push,
  db,
  database,
  onDisconnect,
  ref,
  set,
  onValue,
  update,
  nanoid,
  runTransaction,
  get,
  increment
};


