import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  async function login() {
    await signInWithPopup(auth, new GoogleAuthProvider());
  }

  async function logout() {
    await signOut(auth);
  }

  // Firestore へテスト書き込み（後で events に変える）
  async function writeTest() {
    if (!user) return;
    await addDoc(collection(db, `users/${user.uid}/debugLogs`), {
      message: "Hello Firestore!",
      createdAt: serverTimestamp(),
    });
    await readLogs();
  }

  async function readLogs() {
    if (!user) return;
    const snap = await getDocs(collection(db, `users/${user.uid}/debugLogs`));
    setLogs(snap.docs.map((d) => `${d.id}: ${JSON.stringify(d.data())}`));
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Firebase 接続テスト</h1>

      {!user ? (
        <button onClick={login}>Googleでログイン</button>
      ) : (
        <>
          <p>こんにちは、{user.displayName} さん</p>
          <button onClick={logout}>ログアウト</button>

          <hr />
          <button onClick={writeTest}>Firestore に書き込む</button>
          <button onClick={readLogs} style={{ marginLeft: 8 }}>
            読み込む
          </button>
          <ul>{logs.map((l) => <li key={l}>{l}</li>)}</ul>
        </>
      )}
    </main>
  );
}
