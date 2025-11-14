// frontend/src/App.tsx
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

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
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";

import dayjs from "dayjs";

// FullCalendar
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventInput as FCEventInput } from "@fullcalendar/core";

type EventInput = {
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string;
  endTime?: string;
  location?: string;
  notes?: string;
};

type UserLite = {
  uid: string;
  displayName?: string | null;
  email?: string | null;
};

type EventDoc = {
  id: string;
  title: string;
  startAt?: any;
  endAt?: any;
  allDay?: boolean;
  dateKey?: string;
  location?: string;
  notes?: string;
};

export default function App() {
  const [user, setUser] = useState<UserLite | null>(null);
  const [events, setEvents] = useState<EventDoc[]>([]);
  const [loading, setLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar");

  const [form, setForm] = useState<EventInput>({
    title: "",
    date: dayjs().format("YYYY-MM-DD"),
    startTime: "",
    endTime: "",
    location: "",
    notes: "",
  });

  // 編集ポップアップ
  const [isModalOpen, setIsModalOpen] = useState(false);

  // --- Auth ---
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch((e) =>
      console.error("setPersistence error:", e)
    );

    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        const lite: UserLite = {
          uid: u.uid,
          displayName: u.displayName,
          email: u.email,
        };
        setUser(lite);
        fetchEvents(lite.uid);
      } else {
        setUser(null);
        setEvents([]);
      }
    });

    return () => unsub();
  }, []);

  async function fetchEvents(uid: string) {
    setLoading(true);
    try {
      const col = collection(db, `users/${uid}/events`);
      const q = query(col, orderBy("startAt", "asc"));
      const snap = await getDocs(q);
      setEvents(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    } catch (e) {
      console.error("fetchEvents error:", e);
    } finally {
      setLoading(false);
    }
  }

  // --- 保存（新規 or 更新） ---
  async function saveEvent() {
    if (!user) return;
    if (!form.title || !form.date) {
      alert("タイトルと日付は必須です");
      return;
    }

    const start = dayjs(`${form.date} ${form.startTime || "00:00"}`);
    const end = form.endTime ? dayjs(`${form.date} ${form.endTime}`) : null;

    const base = {
      title: form.title,
      startAt: Timestamp.fromDate(start.toDate()),
      endAt: end ? Timestamp.fromDate(end.toDate()) : null,
      allDay: !form.startTime && !form.endTime,
      dateKey: dayjs(form.date).format("YYYY-MM-DD"),
      location: form.location || "",
      notes: form.notes || "",
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, `users/${user.uid}/events/${editingId}`), base);
      } else {
        await addDoc(collection(db, `users/${user.uid}/events`), {
          ...base,
          createdAt: serverTimestamp(),
        });
      }
      resetForm();
      await fetchEvents(user.uid);
    } catch (e) {
      console.error("saveEvent error:", e);
      alert("保存に失敗しました。コンソールを確認してください。");
    }
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      title: "",
      date: dayjs().format("YYYY-MM-DD"),
      startTime: "",
      endTime: "",
      location: "",
      notes: "",
    });
  }

  // 編集開始（リスト or カレンダーから）
  function startEdit(ev: EventDoc) {
    setEditingId(ev.id);
    const start = tsToDayjs(ev.startAt);
    const end = tsToDayjs(ev.endAt);

    setForm({
      title: ev.title || "",
      date: start.format("YYYY-MM-DD"),
      startTime: ev.allDay ? "" : start.format("HH:mm"),
      endTime: end?.format("HH:mm") || "",
      location: ev.location || "",
      notes: ev.notes || "",
    });

    setIsModalOpen(true);
  }

  async function removeEvent(id: string) {
    if (!user) return;
    if (!confirm("この予定を削除しますか？")) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/events/${id}`));
      if (editingId === id) {
        resetForm();
      }
      await fetchEvents(user.uid);
    } catch (e) {
      console.error("delete error:", e);
      alert("削除に失敗しました。");
    }
  }

  function login() {
    signInWithPopup(auth, new GoogleAuthProvider()).catch((e) => {
      console.error("signIn error:", e);
      alert("ログインに失敗しました。");
    });
  }

  function logout() {
    signOut(auth);
  }

  // --- FullCalendar 用イベント配列 ---
  const calendarEvents = useMemo<FCEventInput[]>(
    () =>
      events.map((ev) => ({
        id: ev.id,
        title: ev.title,
        start: tsToDate(ev.startAt) ?? undefined,
        end: tsToDate(ev.endAt) ?? undefined,
        allDay: !!ev.allDay,
      })),
    [events]
  );

  // --- 日付ごとにグループ化（リスト表示用） ---
  const grouped = useMemo<[string, EventDoc[]][]>(() => {
    const map = new Map<string, EventDoc[]>();
    for (const ev of events) {
      const key = ev.dateKey || "未設定";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    const entries = Array.from(map.entries());
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    return entries;
  }, [events]);

  // --- UI ---
  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 1000, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>マイカレンダー（ユーザー別）</h1>
        {!user ? (
          <button onClick={login} style={btnStyle}>
            Googleでログイン
          </button>
        ) : (
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span>こんにちは、{user.displayName || user.email}</span>
            <button onClick={logout} style={btnStyle}>
              ログアウト
            </button>
          </div>
        )}
      </header>

      {!user ? (
        <p style={{ marginTop: 16 }}>ログインすると予定を追加・編集・削除でき、カレンダーにも表示されます。</p>
      ) : (
        <>
          {/* クイック追加フォーム（上部） */}
          <section style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ marginTop: 0 }}>予定を追加</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setViewMode("list")}
                  style={{ ...btnStyle, ...(viewMode === "list" ? btnActive : {}) }}
                >
                  リスト
                </button>
                <button
                  onClick={() => setViewMode("calendar")}
                  style={{ ...btnStyle, ...(viewMode === "calendar" ? btnActive : {}) }}
                >
                  カレンダー
                </button>
              </div>
            </div>

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
              />
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
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
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button
                onClick={async () => {
                  await saveEvent();
                }}
                style={btnPrimary}
              >
                {editingId ? "保存する" : "追加する"}
              </button>
              {editingId && (
                <button
                  onClick={() => {
                    resetForm();
                  }}
                  style={btnStyle}
                >
                  キャンセル
                </button>
              )}
            </div>
          </section>

          {/* リスト or カレンダー */}
          {viewMode === "list" ? (
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
                        <li key={ev.id} style={{ marginBottom: 6 }}>
                          <strong>{ev.title}</strong>
                          {ev.startAt?.seconds &&
                            ` / ${dayjs(tsToDate(ev.startAt)!).format("HH:mm")}`}
                          {ev.endAt?.seconds &&
                            ` - ${dayjs(tsToDate(ev.endAt)!).format("HH:mm")}`}
                          {ev.location && ` @ ${ev.location}`}
                          {ev.notes && ` ｜ ${ev.notes}`}
                          <span style={{ marginLeft: 10 }}>
                            <button style={btnMini} onClick={() => startEdit(ev)}>
                              編集
                            </button>
                            <button style={btnMiniDanger} onClick={() => removeEvent(ev.id)}>
                              削除
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </section>
          ) : (
            <section style={{ marginTop: 24 }}>
              <h2 style={{ marginTop: 0 }}>月カレンダー</h2>
              <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                height={650}
                events={calendarEvents}
                editable={true} // ドラッグ移動を有効化
                eventClick={(info) => {
                  const id = info.event.id;
                  const ev = events.find((e) => e.id === id);
                  if (ev) startEdit(ev);
                }}
                eventDrop={async (arg: any) => {
                  if (!user) return;
                  const start = arg.event.start as Date | null;
                  const end = arg.event.end as Date | null;
                  if (!start) {
                    arg.revert();
                    return;
                  }
                  try {
                    await updateDoc(
                      doc(db, `users/${user.uid}/events/${arg.event.id}`),
                      {
                        startAt: Timestamp.fromDate(start),
                        endAt: end ? Timestamp.fromDate(end) : null,
                        allDay: arg.event.allDay,
                        dateKey: dayjs(start).format("YYYY-MM-DD"),
                        updatedAt: serverTimestamp(),
                      }
                    );
                    await fetchEvents(user.uid);
                  } catch (e) {
                    console.error("eventDrop error:", e);
                    arg.revert();
                    alert("移動の保存に失敗しました。");
                  }
                }}
                dateClick={(arg) => {
                  // 日付クリックで新規予定
                  setEditingId(null);
                  setForm({
                    title: "",
                    date: dayjs(arg.date).format("YYYY-MM-DD"),
                    startTime: "",
                    endTime: "",
                    location: "",
                    notes: "",
                  });
                  setIsModalOpen(true);
                }}
              />
            </section>
          )}

          {/* 編集ポップアップ */}
          {isModalOpen && (
            <div style={modalOverlayStyle}>
              <div style={modalBodyStyle}>
                <h3 style={{ marginTop: 0 }}>
                  {editingId ? "予定を編集" : "予定を追加"}
                </h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 160px 120px 120px",
                    gap: 12,
                    marginTop: 8,
                  }}
                >
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
                    onChange={(e) =>
                      setForm({ ...form, startTime: e.target.value })
                    }
                  />
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) =>
                      setForm({ ...form, endTime: e.target.value })
                    }
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginTop: 12,
                  }}
                >
                  <input
                    placeholder="場所（任意）"
                    value={form.location}
                    onChange={(e) =>
                      setForm({ ...form, location: e.target.value })
                    }
                  />
                  <input
                    placeholder="メモ（任意）"
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                  />
                </div>

                <div
                  style={{
                    marginTop: 16,
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                  }}
                >
                  <button
                    style={btnStyle}
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingId(null);
                    }}
                  >
                    閉じる
                  </button>

                  {editingId && (
                    <button
                      style={btnMiniDanger}
                      onClick={async () => {
                        await removeEvent(editingId);
                        setIsModalOpen(false);
                      }}
                    >
                      削除
                    </button>
                  )}

                  <button
                    style={btnPrimary}
                    onClick={async () => {
                      await saveEvent();
                      setIsModalOpen(false);
                    }}
                  >
                    {editingId ? "保存する" : "追加する"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

/* helpers */

function tsToDate(ts?: any): Date | null {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return null;
}

function tsToDayjs(ts?: any) {
  const d = tsToDate(ts) || new Date();
  return dayjs(d);
}

/* styles */

const btnStyle: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
};

const btnActive: CSSProperties = {
  background: "#eef2ff",
  borderColor: "#6366f1",
  color: "#3730a3",
};

const btnPrimary: CSSProperties = {
  ...btnStyle,
  background: "#2563eb",
  color: "#fff",
  border: "none",
};

const btnMini: CSSProperties = {
  ...btnStyle,
  padding: "4px 8px",
  fontSize: 12,
  marginRight: 6,
};

const btnMiniDanger: CSSProperties = {
  ...btnMini,
  background: "#ef4444",
  color: "#fff",
  border: "none",
};

const cardStyle: CSSProperties = {
  marginTop: 24,
  padding: 16,
  border: "1px solid #eee",
  borderRadius: 12,
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalBodyStyle: CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  width: "min(720px, 100% - 32px)",
  boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
};
