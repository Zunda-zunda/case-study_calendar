import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDfSD2cs2BSWEPG8BsvwsILEvLjpWF3CsY",
  authDomain: "case-study-daaef.firebaseapp.com",
  projectId: "case-study-daaef",
  storageBucket: "case-study-daaef.firebasestorage.app",
  messagingSenderId: "812719904117",
  appId: "1:812719904117:web:80690ac5c47f5f2f796f3c"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// 一時確認（コンソールで projectId / authDomain をチェック）
console.log("Firebase options:", app.options);
