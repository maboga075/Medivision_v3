import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  query,
  orderBy,
  where,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAxyHoWo94Gt-7o1KcgXFVmdObg8UjWhyU',
  authDomain: 'medivision-187ed.firebaseapp.com',
  projectId: 'medivision-187ed',
  storageBucket: 'medivision-187ed.firebasestorage.app',
  messagingSenderId: '331555739342',
  appId: '1:331555739342:web:c6b1cc9d79e90b729f229f',
};

const app = initializeApp(firebaseConfig);

// API de persistance correcte pour Firebase v9+ (remplace enableIndexedDbPersistence dépréciée)
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export {
  db,
  getFirestore,
  collection,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  query,
  orderBy,
  where,
};
