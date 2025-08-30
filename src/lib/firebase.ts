import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, 
  authDomain: "v-attendance-fcc06.firebaseapp.com",
  projectId: "v-attendance-fcc06",
  storageBucket: "v-attendance-fcc06.appspot.com",
  messagingSenderId: "415391567793",
  appId: "1:415391567793:web:36adc476ffb2374e703790",
  measurementId: "G-2YP2T5LWMJ"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app); // Analytics is not used in this app
export const auth = getAuth(app);
export const db = getFirestore(app);
