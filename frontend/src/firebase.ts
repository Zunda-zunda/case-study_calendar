// frontend/src/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCxwuArH610M1Z9cHMm1KaA6buY8yZ9ilQ",
  authDomain: "case-study-daaef.firebaseapp.com",
  projectId: "case-study-daaef",
  storageBucket: "case-study-daaef.firebasestorage.app",
  messagingSenderId: "812719904117",
  appId: "1:812719904117:web:e6e537db016b3274796f3c"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
