import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

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
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };