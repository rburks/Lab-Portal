// Guided lab: one step at a time, each with numbered instructions, "what you should see", a tip, and a checkpoint
// that must be satisfied before the step can be marked complete. Checkpoint answers are saved to progress.responses.
import { useEffect, useRef, useState } from "react";
import type { Checkpoint, Session, Step } from "../content/course";
import { store, type Progress, type Submission } from "../lib/store";
import { compressImage } from "../lib/logic";

type Props = { s: Session; p?: Progress; subs: Submission[]; save: (x: Partial<Progress>) => Promise<void>; reload: () => Promise<void>; toast: (m: string) => void; onGoTo: (tab: "quiz" | "submit" | "sandbox") => void };

export default function GuidedLab({ s, p, subs, save, reload, toast, onGoTo }: Props) {
  const steps = s.steps || [];
  const done = (p?.steps || []).map(Boolean);
  const firstOpen = Math.max(0, done.findIndex((d, i) => !d && i < steps.length));
  const [cur, setCur] = useState(() => (done.every(Boolean) && steps.length ? steps.length : (firstOpen === -1 ? 0 : firstOpen)));
  const responses = (p?.responses || {}) as Record<string, unknown>;
  const [goal, setGoal] = useState(p?.goal || "");
  useEffect(() => setGoal(p?.goal || ""), [p?.goal]);
  const completed = done.filter(Boolean).length;
  const allDone = steps.length > 0 && completed >= steps.length;

  const markDone = async (i: number) => {
    const n = [...done]; while (n.length < steps.length) n.push(false); n[i] = true;
    await save({ steps: n }); setCur(i + 1);
  };
  const saveResponse = async (i: number, v: unknown) => { await save({ responses: { ...responses, [String(i)]: v } }); };

  if (cur >= steps.length && allDone) return (
    <div className="lab-done">
      <div className="big">🎉</div><h2>Lab complete</h2>
      <p className="muted reading">You finished all {steps.length} steps. Check the list below, then submit your work and take the quiz.</p>
      <div className="callout" style={{ textAlign: "left", width: "100%", maxWidth: 560 }}><b>Done when</b><ul>{s.doneWhen!.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
      <div className="row"><button className="btn" onClick={() => onGoTo("submit")}>Submit your work</button><button className="btn ghost" onClick={() => onGoTo("quiz")}>Take the quiz</button><button className="btn ghost" onClick={() => setCur(0)}>Review steps</button></div>
      {s.stretch && <div style={{ textAlign: "left", width: "100%", maxWidth: 560 }}><span className="eyebrow">Finished early? Stretch path</span><ul className="muted" style={{ margin: "6px 0 0", paddingLeft: 18 }}>{s.stretch.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
    </div>
  );

  const i = Math.min(cur, steps.length - 1); const st = steps[i];
  const locked = i > 0 && !done[i - 1] && !done[i];
  return (
    <div className="lab">
      <aside className="step-rail">
        <div className="row between" style={{ padding: "0 4px 6px" }}><span className="eyebrow">{completed} of {steps.length} steps</span></div>
        <div className="progress" style={{ margin: "0 4px 8px" }}><i style={{ width: `${100 * completed / steps.length}%` }} /></div>
        {steps.map((x, k) => { const reach = k === 0 || done[k - 1] || done[k]; return (
          <button key={k} className={`${done[k] ? "done" : ""} ${k === i ? "cur" : ""} ${!reach ? "todo" : ""}`} disabled={!reach} onClick={() => setCur(k)} title={x.label}><span className="n">{done[k] ? "✓" : k + 1}</span><span>{x.label}</span></button>); })}
        {allDone && <button className="done" onClick={() => setCur(steps.length)}><span className="n">★</span><span>Finish</span></button>}
      </aside>
      <section className="step-card reading">
        <div><span className="eyebrow">Step {i + 1} of {steps.length}</span><h2>{st.label}</h2>{st.why && <p className="muted" style={{ marginTop: 4 }}>{st.why}</p>}</div>
        {i === 0 && s.goal && !st.checkpoint && <div className="stack" style={{ gap: 6 }}><span className="eyebrow">Your goal first</span><p className="muted">{s.goal}</p><textarea id="goal" value={goal} onChange={e => setGoal(e.target.value)} onBlur={() => { if (goal !== (p?.goal || "")) { save({ goal }); toast("Goal saved"); } }} placeholder="Write your goal in one or two sentences" /></div>}
        <div><span className="eyebrow">Do this</span><ol className="do-list" style={{ marginTop: 8 }}>{st.do.map((d, k) => <li key={k}><span>{d}</span></li>)}</ol></div>
        <div className="see-box"><b>What you should see:</b> {st.see}</div>
        {st.tip && <div className="tip-box"><b>If it didn't work:</b> {st.tip}</div>}
        {st.checkpoint && <CheckpointBox cp={st.checkpoint} value={responses[String(i)]} subs={subs} sessionId={s.id} onSave={async v => { await saveResponse(i, v); if (i === 0 && st.checkpoint!.kind === "text" && s.goal) await save({ goal: String(v) }); }} reload={reload} toast={toast} />}
        <StepFooter st={st} done={!!done[i]} locked={locked} responses={responses} i={i} subs={subs} sessionId={s.id} onDone={() => markDone(i)} onNext={() => setCur(i + 1)} onBack={() => setCur(Math.max(0, i - 1))} />
      </section>
    </div>
  );
}

function satisfied(cp: Checkpoint | undefined, v: unknown, subs: Submission[]) {
  if (!cp) return true;
  if (cp.kind === "confirm") return v === true;
  if (cp.kind === "text") return typeof v === "string" && v.trim().length >= (cp.minLength ?? 1);
  if (cp.kind === "choice") return typeof v === "number" && v === cp.correct;
  if (cp.kind === "upload") return subs.length > 0;
  return false;
}

function StepFooter({ st, done, locked, responses, i, subs, onDone, onNext, onBack }: { st: Step; done: boolean; locked: boolean; responses: Record<string, unknown>; i: number; subs: Submission[]; sessionId: string; onDone: () => void; onNext: () => void; onBack: () => void }) {
  const ok = satisfied(st.checkpoint, responses[String(i)], subs);
  return (
    <div className="row between" style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
      <button className="btn ghost" onClick={onBack} disabled={i === 0}>← Back</button>
      {done ? <div className="row"><span className="pill good">Step complete</span><button className="btn" onClick={onNext}>Next step →</button></div>
        : <button className="btn" disabled={!ok || locked} onClick={onDone} title={ok ? "" : "Complete the checkpoint first"}>{st.checkpoint ? (ok ? "Mark step complete →" : "Complete the checkpoint to continue") : "Mark step complete →"}</button>}
    </div>
  );
}

function CheckpointBox({ cp, value, subs, sessionId, onSave, reload, toast }: { cp: Checkpoint; value: unknown; subs: Submission[]; sessionId: string; onSave: (v: unknown) => Promise<void>; reload: () => Promise<void>; toast: (m: string) => void }) {
  const [text, setText] = useState(typeof value === "string" ? value : "");
  const [picked, setPicked] = useState<number | null>(typeof value === "number" ? value : null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setText(typeof value === "string" ? value : ""); setPicked(typeof value === "number" ? value : null); }, [value, cp]);
  const ok = satisfied(cp, cp.kind === "text" ? text : cp.kind === "choice" ? picked : value, subs);
  return (
    <div className="checkpoint">
      <div className="row between"><span className="eyebrow">Checkpoint</span>{ok && <span className="pill good">Done</span>}</div>
      <b>{cp.prompt}</b>
      {cp.kind === "text" && <>
        <textarea id={`cp-text`} value={text} onChange={e => setText(e.target.value)} placeholder={cp.placeholder} rows={4} />
        <div className="row between"><span className="small muted">{cp.minLength ? `At least ${cp.minLength} characters. ${text.trim().length}/${cp.minLength}` : ""}</span><button className="btn sm" disabled={text.trim().length < (cp.minLength ?? 1) || text === value} onClick={async () => { await onSave(text); toast("Saved"); }}>Save answer</button></div></>}
      {cp.kind === "choice" && <div>
        {cp.options.map((o, j) => { const cls = picked === null ? "" : j === cp.correct ? "right" : picked === j ? "wrong" : ""; return <label key={j} className={`q-opt ${cls}`} style={{ display: "grid", gridTemplateColumns: "18px minmax(0,1fr)", gap: 10, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 6, marginBottom: 6, cursor: "pointer", background: cls === "right" ? "var(--good-soft)" : cls === "wrong" ? "var(--bad-soft)" : "transparent" }}><input type="radio" name="cp" checked={picked === j} onChange={async () => { setPicked(j); await onSave(j); }} /><span>{o}</span></label>; })}
        {picked !== null && <div className={picked === cp.correct ? "see-box" : "tip-box"}><b>{picked === cp.correct ? "Right." : "Not quite, try again."}</b> {picked === cp.correct ? cp.why : "Think about it once more and pick again."}</div>}
      </div>}
      {cp.kind === "confirm" && <label className="row" style={{ gap: 10, cursor: "pointer" }}><input type="checkbox" checked={value === true} onChange={e => onSave(e.target.checked)} /><span>Yes, I've checked this.</span></label>}
      {cp.kind === "upload" && <div className="stack" style={{ gap: 8 }}>
        <div className="row">
          <button className="btn sm" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? "Uploading…" : "Upload screenshot"}</button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={async e => { if (!e.target.files?.length) return; setBusy(true); try { for (const f of Array.from(e.target.files)) { const b = await compressImage(f); await store.addSubmission({ session_id: sessionId, kind: "image", file: b }); } await reload(); toast("Uploaded"); } catch (err) { toast("Upload failed: " + (err as Error).message); } finally { setBusy(false); } }} />
          <span className="small muted">or paste a link</span>
          <input type="url" placeholder="https://…" value={link} onChange={e => setLink(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
          <button className="btn ghost sm" disabled={!link.trim()} onClick={async () => { await store.addSubmission({ session_id: sessionId, kind: "link", body: link.trim() }); setLink(""); await reload(); toast("Link saved"); }}>Save link</button>
        </div>
        {subs.length > 0 && <div className="small muted">{subs.length} item{subs.length === 1 ? "" : "s"} submitted. See the Submit tab to review or remove.</div>}
      </div>}
    </div>
  );
}
