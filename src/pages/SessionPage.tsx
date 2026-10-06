import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { byId, type Session } from "../content/course";
import { useAuth } from "../auth";
import { useStudentData } from "./useStudentData";
import { store, type Progress, type Submission } from "../lib/store";
import { compressImage, isUnlocked } from "../lib/logic";
import Sandbox from "../components/Sandbox";

type Tab = "lab" | "sandbox" | "lens" | "quiz" | "submit";

export default function SessionPage() {
  const { id } = useParams();
  const s = byId(id || "");
  const { user, toast } = useAuth();
  const data = useStudentData();
  const [tab, setTab] = useState<Tab>("lab");
  if (!s) return <Navigate to="/" />;
  if (data.loading) return <div className="empty">Loading…</div>;
  if (!isUnlocked(s.id, user!.id, data.releases)) return <div className="card empty">This session is locked. Your instructor will open it when the class gets there.<br /><Link to="/">Back to course</Link></div>;
  const p = data.progress.find(x => x.session_id === s.id);
  const subs = data.subs.filter(x => x.session_id === s.id);
  const grade = data.grades.find(g => g.session_id === s.id);
  const save = async (patch: Partial<Progress>) => { await store.saveProgress({ session_id: s.id, ...patch }); await data.reload(); };
  const tabs: [Tab, string][] = [["lab", "Lab"], ...(s.sandbox ? [["sandbox", "Sandbox"] as [Tab, string]] : []), ["lens", "Exam Lens"], ["quiz", "Quiz"], ["submit", subs.length ? `Submit (${subs.length})` : "Submit"]];

  if (!s.built) return (
    <div className="card pad-lg reading stack">
      <span className="eyebrow">Week {s.week} · Day {s.day}</span><h1>{s.title}</h1>
      <div className="callout">This session's lab, quiz, and Exam Lens are being built. Check back before class.</div>
      <Link to="/">← Back to course</Link>
    </div>
  );
  return (
    <div className="session">
      <div className="row between">
        <div><Link to="/" className="small">← Course</Link><div className="eyebrow" style={{ marginTop: 6 }}>Week {s.week} · Day {s.day}</div><h1>{s.title}</h1></div>
        {grade?.score != null && <div className="card" style={{ padding: "10px 14px" }}><span className="eyebrow">Graded</span><div className="bignum">{grade.score}</div>{grade.feedback && <p className="small muted" style={{ maxWidth: 320 }}>{grade.feedback}</p>}</div>}
      </div>
      <div className="card pad-lg">
        <div className="tabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
        <div style={{ marginTop: 18 }}>
          {tab === "lab" && <Lab s={s} p={p} save={save} toast={toast} />}
          {tab === "sandbox" && <Sandbox onRecord={r => { save({ sandbox: r }); toast("Sandbox result recorded"); }} />}
          {tab === "lens" && <Lens s={s} />}
          {tab === "quiz" && <Quiz s={s} p={p} save={save} toast={toast} />}
          {tab === "submit" && <Submit s={s} subs={subs} reload={data.reload} toast={toast} />}
        </div>
      </div>
    </div>
  );
}

function Lab({ s, p, save, toast }: { s: Session; p?: Progress; save: (x: Partial<Progress>) => Promise<void>; toast: (m: string) => void }) {
  const steps = p?.steps || [];
  const [goal, setGoal] = useState(p?.goal || "");
  useEffect(() => setGoal(p?.goal || ""), [p?.goal]);
  return (
    <div className="reading stack" style={{ gap: 18 }}>
      <div className="stack" style={{ gap: 6 }}><span className="eyebrow">Your goal first</span><p className="muted">{s.goal}</p>
        <textarea id="goal" value={goal} onChange={e => setGoal(e.target.value)} onBlur={() => { if (goal !== (p?.goal || "")) { save({ goal }); toast("Goal saved"); } }} placeholder="Write your goal in one or two sentences" /></div>
      <div className="stack" style={{ gap: 8 }}><span className="eyebrow">Core path</span>
        <div className="steps">{s.steps!.map((st, i) => (
          <label key={i} className={`step ${steps[i] ? "done" : ""}`}>
            <input type="checkbox" checked={!!steps[i]} onChange={e => { const n = [...steps]; while (n.length < s.steps!.length) n.push(false); n[i] = e.target.checked; save({ steps: n }); }} />
            <div><div className="lbl">{st.label}</div><div className="see">What you should see: {st.see}</div></div>
          </label>))}</div></div>
      <div><span className="eyebrow">Stretch path</span><ul className="muted" style={{ margin: "6px 0 0", paddingLeft: 18 }}>{s.stretch!.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
      <div className="callout"><b>Done when</b><ul>{s.doneWhen!.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
    </div>
  );
}

function Lens({ s }: { s: Session }) {
  return (
    <div className="reading stack">
      <p className="muted">The day's exam terms, in plain words first and exam words second. Add each to your flashcard deck.</p>
      {s.lens!.map((t, i) => <div className="term" key={i}><b>{t.term}</b><div>{t.plain}<div className="exam">{t.exam}</div></div></div>)}
    </div>
  );
}

function Quiz({ s, p, save, toast }: { s: Session; p?: Progress; save: (x: Partial<Progress>) => Promise<void>; toast: (m: string) => void }) {
  const [picks, setPicks] = useState<(number | null)[]>(Array(s.quiz!.length).fill(null));
  const [result, setResult] = useState<number | null>(null);
  const check = async () => {
    if (picks.some(x => x === null)) return toast("Answer every question first");
    const sc = picks.filter((x, i) => x === s.quiz![i].c).length;
    setResult(sc);
    await save({ quiz_last: sc, quiz_best: Math.max(sc, p?.quiz_best ?? 0), quiz_attempts: (p?.quiz_attempts ?? 0) + 1 });
  };
  return (
    <div className="reading stack">
      <div className="row between"><p className="muted">Five concept questions. Your best score is kept.</p>{p?.quiz_best != null && <span className="pill acc">Best so far: {p.quiz_best}/5</span>}</div>
      {s.quiz!.map((q, i) => (
        <div className="q" key={i}><div className="prompt">{i + 1}. {q.q}</div>
          {q.a.map((a, j) => { const cls = result === null ? "" : j === q.c ? "right" : picks[i] === j ? "wrong" : ""; return (
            <label key={j} className={cls}><input type="radio" name={`q${i}`} disabled={result !== null} checked={picks[i] === j} onChange={() => setPicks(ps => ps.map((v, k) => k === i ? j : v))} /> <span>{a}</span></label>); })}
          {result !== null && <div className="why">{q.why}</div>}
        </div>))}
      <div className="row">{result === null ? <button className="btn" onClick={check}>Check answers</button> : <><span className="bignum">{result}/5</span><span className={`pill ${result >= 4 ? "good" : "warn"}`}>{result >= 4 ? "Solid" : "Review the Exam Lens and retake"}</span><button className="btn ghost" onClick={() => { setPicks(Array(s.quiz!.length).fill(null)); setResult(null); }}>Retake</button></>}</div>
    </div>
  );
}

function Submit({ s, subs, reload, toast }: { s: Session; subs: Submission[]; reload: () => Promise<void>; toast: (m: string) => void }) {
  const kinds = s.submission?.kinds || ["image", "link", "text"];
  const [kind, setKind] = useState<Submission["kind"]>(kinds[0]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return; setBusy(true);
    try { for (const f of Array.from(files)) { if (!f.type.startsWith("image/")) continue; const blob = await compressImage(f); await store.addSubmission({ session_id: s.id, kind: "image", file: blob }); } await reload(); toast("Screenshot uploaded"); }
    catch (e) { toast("Upload failed: " + (e as Error).message); } finally { setBusy(false); }
  };
  const send = async () => {
    if (!body.trim()) return; setBusy(true);
    try { await store.addSubmission({ session_id: s.id, kind, body: body.trim() }); setBody(""); await reload(); toast("Submitted"); } finally { setBusy(false); }
  };
  return (
    <div className="reading submit-box">
      <p className="muted">{s.submission?.prompt || "Submit your work for this lab."}</p>
      <div className="chips">{kinds.map(k => <button key={k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>{k === "image" ? "Screenshot" : k === "link" ? "Link" : "Text"}</button>)}</div>
      {kind === "image" ? (
        <div className={`drop ${over ? "over" : ""}`} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); }}>
          <div>Drop screenshots here, or <button className="btn ghost sm" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? "Uploading…" : "choose files"}</button></div>
          <div className="small" style={{ marginTop: 6 }}>Images are compressed before upload, so a full-screen capture is fine.</div>
          <input ref={fileRef} id="file" type="file" accept="image/*" multiple hidden onChange={e => upload(e.target.files)} />
        </div>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          {kind === "link" ? <input id="link" type="url" placeholder="https://…" value={body} onChange={e => setBody(e.target.value)} /> : <textarea id="text" placeholder="Paste or type your answer" value={body} onChange={e => setBody(e.target.value)} />}
          <div><button className="btn" onClick={send} disabled={busy || !body.trim()}>Submit</button></div>
        </div>
      )}
      {subs.length > 0 && <div className="stack" style={{ gap: 8, marginTop: 8 }}><span className="eyebrow">Your submissions</span>
        {subs.map(x => (
          <div className="sub" key={x.id}>
            <div style={{ minWidth: 0 }}>
              {x.kind === "image" ? (x.url ? <img src={x.url} alt="Submitted screenshot" style={{ maxHeight: 140, maxWidth: "100%", borderRadius: 6 }} /> : <span className="muted">Screenshot</span>) : x.kind === "link" ? <a href={x.body!} target="_blank" rel="noreferrer" style={{ wordBreak: "break-all" }}>{x.body}</a> : <span style={{ whiteSpace: "pre-wrap" }}>{x.body}</span>}
              <div className="small muted">{new Date(x.created_at).toLocaleString()}</div>
            </div>
            <button className="btn ghost xs" onClick={async () => { await store.deleteSubmission(x.id); await reload(); }}>Remove</button>
          </div>))}</div>}
    </div>
  );
}
