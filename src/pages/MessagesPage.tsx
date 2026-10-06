// Messages: a student sees one private thread with the instructor. The instructor sees an inbox of threads.
// Announcements: instructor posts class-wide; everyone reads them here and on the course page.
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth";
import { store, type Announcement, type Message, type Profile } from "../lib/store";
import { initials } from "../lib/logic";

export default function MessagesPage() {
  const { user, toast } = useAuth();
  const isInstr = user?.role === "instructor";
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [anns, setAnns] = useState<Announcement[]>([]);
  const [thread, setThread] = useState<string | null>(isInstr ? null : user!.id);
  const [tab, setTab] = useState<"dm" | "ann">("dm");
  const reload = useCallback(async () => { const [m, a] = await Promise.all([store.messages(isInstr ? undefined : user!.id), store.announcements()]); setMsgs(m); setAnns(a); if (isInstr) setProfiles(await store.allProfiles()); }, [isInstr, user]);
  useEffect(() => { reload(); const t = setInterval(reload, 20000); return () => clearInterval(t); }, [reload]);
  useEffect(() => { if (thread) store.markRead(thread).then(reload); }, [thread]); // eslint-disable-line react-hooks/exhaustive-deps
  const students = profiles.filter(p => p.role === "student");
  const threads = isInstr ? students.map(s => { const tm = msgs.filter(m => m.thread_student_id === s.id); const last = tm[tm.length - 1]; const unread = tm.filter(m => m.sender_id === s.id && !m.read_at).length; return { s, last, unread }; }).sort((a, b) => (b.unread - a.unread) || ((b.last?.created_at || "").localeCompare(a.last?.created_at || ""))) : [];
  return (
    <>
      <div className="hero"><div><span className="eyebrow">{isInstr ? `${threads.filter(t => t.unread).length} unread threads` : "Private thread with your instructor"}</span><h1>Messages</h1></div>
        <div className="tabs" style={{ borderBottom: 0 }}><button className={tab === "dm" ? "on" : ""} onClick={() => setTab("dm")}>Direct messages</button><button className={tab === "ann" ? "on" : ""} onClick={() => setTab("ann")}>Announcements</button></div></div>
      {tab === "ann" ? <Announcements anns={anns} isInstr={!!isInstr} reload={reload} toast={toast} /> : (
        <div className="card" style={{ padding: 0, display: "grid", gridTemplateColumns: isInstr ? "minmax(220px, 300px) minmax(0,1fr)" : "1fr", minHeight: 520 }}>
          {isInstr && <div style={{ borderRight: "1px solid var(--line)", overflowY: "auto", maxHeight: "70vh" }}>
            {threads.map(t => <button key={t.s.id} onClick={() => setThread(t.s.id)} className="person" style={{ width: "100%", textAlign: "left", background: thread === t.s.id ? "var(--accent-soft)" : "none", border: 0, padding: "10px 14px", cursor: "pointer" }}>
              <div className="avatar">{initials(t.s.full_name)}</div><div style={{ minWidth: 0 }}><b>{t.s.full_name}</b><div className="small muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.last ? t.last.body : "No messages yet"}</div></div>{t.unread > 0 && <span className="pill acc">{t.unread}</span>}
            </button>)}</div>}
          {thread ? <Thread thread={thread} msgs={msgs.filter(m => m.thread_student_id === thread)} me={user!.id} other={isInstr ? (profiles.find(p => p.id === thread)?.full_name || "Student") : "Roland"} reload={reload} /> : <div className="empty">Pick a student to read their thread.</div>}
        </div>)}
    </>
  );
}

function Thread({ thread, msgs, me, other, reload }: { thread: string; msgs: Message[]; me: string; other: string; reload: () => Promise<void> }) {
  const [body, setBody] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);
  const send = async () => { if (!body.trim()) return; await store.sendMessage(thread, body.trim()); setBody(""); await reload(); };
  return (
    <div style={{ display: "grid", gridTemplateRows: "auto minmax(0,1fr) auto", maxHeight: "70vh" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }}><b>{other}</b></div>
      <div style={{ overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {msgs.map(m => { const mine = m.sender_id === me; return <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "min(78%, 560px)", background: mine ? "var(--accent)" : "var(--panel-2)", color: mine ? "var(--accent-ink)" : "var(--ink)", padding: "9px 12px", borderRadius: 12, borderBottomRightRadius: mine ? 4 : 12, borderBottomLeftRadius: mine ? 12 : 4 }}><div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div><div className="small" style={{ opacity: .7, marginTop: 3 }}>{new Date(m.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div></div>; })}
        {!msgs.length && <div className="empty small">No messages yet. Say hello.</div>}<div ref={end} />
      </div>
      <div style={{ padding: 12, borderTop: "1px solid var(--line)", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 8 }}>
        <textarea id="msg-body" style={{ minHeight: 44 }} placeholder="Write a message. Enter to send, Shift+Enter for a new line." value={body} onChange={e => setBody(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button className="btn" onClick={send} disabled={!body.trim()}>Send</button>
      </div>
    </div>
  );
}

export function Announcements({ anns, isInstr, reload, toast, compact }: { anns: Announcement[]; isInstr: boolean; reload: () => Promise<void>; toast: (m: string) => void; compact?: boolean }) {
  const [draft, setDraft] = useState<{ title: string; body: string; pinned: boolean } | null>(null);
  return (
    <div className="stack" style={{ gap: 12 }}>
      {isInstr && !compact && <div className="card stack">
        <div className="row between"><h3>Post an announcement</h3>{!draft && <button className="btn sm" onClick={() => setDraft({ title: "", body: "", pinned: false })}>New</button>}</div>
        {draft && <><input id="ann-title" placeholder="Title" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /><textarea id="ann-body" placeholder="What the class needs to know" value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} />
          <div className="row"><label className="row small" style={{ gap: 6 }}><input type="checkbox" style={{ width: "auto" }} checked={draft.pinned} onChange={e => setDraft({ ...draft, pinned: e.target.checked })} /> Pin to top</label><button className="btn" disabled={!draft.title.trim() || !draft.body.trim()} onClick={async () => { await store.postAnnouncement(draft); setDraft(null); await reload(); toast("Posted"); }}>Post</button><button className="btn ghost" onClick={() => setDraft(null)}>Cancel</button></div></>}
      </div>}
      {anns.slice(0, compact ? 2 : undefined).map(a => <div className="card" key={a.id} style={a.pinned ? { borderColor: "var(--accent)" } : {}}>
        <div className="row between"><div className="row" style={{ gap: 8 }}>{a.pinned && <span className="pill acc">Pinned</span>}<h3>{a.title}</h3></div><div className="row"><span className="small muted">{new Date(a.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>{isInstr && !compact && <button className="btn ghost xs" onClick={async () => { await store.deleteAnnouncement(a.id); await reload(); }}>Delete</button>}</div></div>
        <p style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{a.body}</p></div>)}
      {!anns.length && <div className="empty small">No announcements yet.</div>}
    </div>
  );
}
