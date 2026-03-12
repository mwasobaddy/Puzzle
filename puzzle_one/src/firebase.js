import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase, ref, set, onValue, update, remove, onDisconnect, push, runTransaction, get, increment } from 'firebase/database';
import { nanoid } from 'nanoid';


const firebaseConfig = {
  apiKey: "AIzaSyB3TF4ZHqHumrUDSyxaR7lNQzS-43PPK9s",
  authDomain: "mwasobaddy.firebaseapp.com",
  projectId: "mwasobaddy",
  storageBucket: "mwasobaddy.firebasestorage.app",
  messagingSenderId: "108027559981",
  appId: "1:108027559981:web:44a95c4cf2246c742bf8a4",
  measurementId: "G-B2DW15NH30",
  databaseURL: "https://mwasobaddy-default-rtdb.firebaseio.com/",
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

const storage = getStorage(app);
// experimentalForceLongPolling uses plain HTTP long-polling instead of
// gRPC-web WebChannel. This is required for Brave / Safari where the
// WebChannel transport is blocked, causing all Firestore writes to hang.
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
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


