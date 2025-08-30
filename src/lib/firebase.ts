
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCqexkqHM0JE4Zqso_beFs0RT6_tgYjd9k",
  authDomain: "attendabyte.firebaseapp.com",
  projectId: "attendabyte",
  storageBucket: "attendabyte.firebasestorage.app",
  messagingSenderId: "310565587694",
  appId: "1:310565587694:web:cd44b795b99dca2aa401ff",
  measurementId: "G-N00RVW8XB6"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Analytics is not used in this app, so getAnalytics is not imported or called.
export const auth = getAuth(app);
export const db = getFirestore(app);
