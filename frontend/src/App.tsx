import { useEffect, useMemo, useState } from "react";
import { auth, db } from "./firebase";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import dayjs from "dayjs";

/** 予定入力用の型 */
type EventInput = {
  title: string;
  date: string;       // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string;   // HH:mm
  location?: string;
  notes?: string;
};

type UserLite = {
  uid: string;
  displayName?: string | null;
  email?: string | null;
};

export default function App() {
  const [user, setUser] = useState<UserLite | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<EventInput>({
    title: "",
    date: dayjs().format("YYYY-MM-DD"),
    startTime: "",
    endTime: "",
    location: "",
    notes: "",
  });

  // ---- Auth: 永続化 & 状態監視 ----
  useEffect(() => {
    // ブラウザを閉じてもログイン状態を保持
    setPersistence(auth, browserLocalPersistence).catch((e) =>
      console.error("setPersistence error:", e)
    );

    // ログイン状態の監視
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser({ uid: u.uid, displayName: u.displayName, email: u.email });
        fetchEvents(u.uid);
      } else {
        setUser(null);
        setEvents([]);
      }
    });
    return () => unsub();
  }, []);

  // ---- Firestore: 自分の予定を取得 ----
  async function fetchEvents(uid: string) {
    setLoading(true);
    try {
      const col = collection(db, `users/${uid}/events`);
      const q = query(col, orderBy("startAt", "asc"));
      const snap = await getDocs(q);
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("fetchEvents error:", e);
    } finally {
      setLoading(false);
    }
  }

  // ---- Firestore: 予定を追加 ----
  async function addEvent() {
    if (!user) return;
    if (!form.title || !form.date) {
      alert("タイトルと日付は必須です");
      return;
    }

    // "YYYY-MM-DD HH:mm" を Timestamp に変換
    const start = dayjs(`${form.date} ${form.startTime || "00:00"}`);
    const end = form.endTime ? dayjs(`${form.date} ${form.endTime}`) : null;

    try {
      const col = collection(db, `users/${user.uid}/events`);
      await addDoc(col, {
        title: form.title,
        startAt: Timestamp.fromDate(start.toDate()),
        endAt: end ? Timestamp.fromDate(end.toDate()) : null,
        allDay: !form.startTime && !form.endTime,
        dateKey: dayjs(form.date).format("YYYY-MM-DD"),
        location: form.location || "",
        notes: form.notes || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 入力の一部をリセット & 再取得
      setForm((f) => ({ ...f, title: "", notes: "" }));
      await fetchEvents(user.uid);
    } catch (e) {
      console.error("addEvent error:", e);
      alert("保存に失敗しました。コンソールのエラーをご確認ください。");
    }
  }

  // ---- ログイン/ログアウト ----
  async function login() {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      // onAuthStateChanged が発火して画面が切り替わります
    } catch (e) {
      console.error("popup error:", e);
      alert("ログインに失敗しました。コンソールのエラーをご確認ください。");
    }
  }
  function logout() {
    signOut(auth);
  }

  // ---- 日付ごとにグルーピング（簡易カレンダー表示用）----
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const ev of events) {
      const d = ev.dateKey || "未設定";
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(ev);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  // ---- UI ----
  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 900, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>マイカレンダー（ユーザー別）</h1>
        {!user ? (
          <button onClick={login} style={btnStyle}>Googleでログイン</button>
        ) : (
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span>こんにちは、{user.displayName || user.email}</span>
            <button onClick={logout} style={btnStyle}>ログアウト</button>
          </div>
        )}
      </header>

      {!user ? (
        <p style={{ marginTop: 16 }}>ログインすると予定を追加・表示できます。</p>
      ) : (
        <>
          {/* 予定追加フォーム */}
          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>予定を追加</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 120px 120px", gap: 12 }}>
              <input
                placeholder="タイトル"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                placeholder="開始"
              />
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                placeholder="終了"
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <input
                placeholder="場所（任意）"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
              <input
                placeholder="メモ（任意）"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <button onClick={addEvent} style={btnPrimary}>追加する</button>
            </div>
          </section>

          {/* 予定一覧（簡易カレンダー） */}
          <section style={{ marginTop: 24 }}>
            <h2 style={{ marginTop: 0 }}>予定一覧</h2>
            {loading && <p>読み込み中…</p>}
            {!loading && grouped.length === 0 && <p>予定はまだありません。</p>}
            {!loading &&
              grouped.map(([date, list]) => (
                <div key={date} style={{ marginBottom: 16 }}>
                  <h3 style={{ margin: "12px 0 4px" }}>
                    {dayjs(date).isValid() ? dayjs(date).format("YYYY/MM/DD (ddd)") : date}
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {list.map((ev) => (
                      <li key={ev.id}>
                        <strong>{ev.title}</strong>
                        {ev.startAt?.seconds &&
                          ` / ${dayjs(
                            ev.startAt.toDate?.() ?? new Date(ev.startAt.seconds * 1000)
                          ).format("HH:mm")}`
                        }
                        {ev.endAt?.seconds &&
                          ` - ${dayjs(
                            ev.endAt.toDate?.() ?? new Date(ev.endAt.seconds * 1000)
                          ).format("HH:mm")}`
                        }
                        {ev.location && ` @ ${ev.location}`}
                        {ev.notes && ` ｜ ${ev.notes}`}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </section>
        </>
      )}
    </main>
  );
}

/* --- ちょっとした見た目用 --- */
const btnStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
};
const btnPrimary: React.CSSProperties = {
  ...btnStyle,
  background: "#2563eb",
  color: "#fff",
  border: "none",
};
const cardStyle: React.CSSProperties = {
  marginTop: 24,
  padding: 16,
  border: "1px solid #eee",
  borderRadius: 12,
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};
