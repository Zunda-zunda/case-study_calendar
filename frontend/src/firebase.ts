import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCxwuArH610M1Z9cHMm1KaA6buY8yZ9ilQ",
  authDomain: "case-study-daaef.firebaseapp.com",
  projectId: "case-study-daaef",
  storageBucket: "case-study-daaef.appspot.com",
  messagingSenderId: "812719904117",
  appId: "1:812719904117:web:1573f2b2d4ae75d7796f3c"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// 一時確認（コンソールで projectId / authDomain をチェック）
console.log("Firebase options:", app.options);
