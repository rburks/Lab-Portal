// Instructor: session content import with validation and diff, daily verification, materials, attendance, export.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SESSIONS, WEEKS, diffContent, validateContent, type SessionContent } from "../content/course";
import { useAuth } from "../auth";
import { store, type Attendance, type ContentRow, type Material, type Profile } from "../lib/store";
import { buildSchedule, fmtLong, iso } from "../lib/schedule";
import { download, fmtDate, initials } from "../lib/logic";

function describe(e: unknown): string {
  const m = (e as { message?: string; code?: string; details?: string })?.message || String(e);
  if (/relation .* does not exist|Could not find the table|schema cache/i.test(m)) return `${m}. The database tables for this feature haven't been created yet: run the "Added October 6 (content in DB, materials, verification, attendance)" section of supabase/schema.sql in the Supabase SQL editor.`;
  if (/Bucket not found/i.test(m)) return `${m}. The "materials" storage bucket doesn't exist yet: run the same October 6 SQL section, which creates it.`;
  if (/row-level security|permission denied|not authorized/i.test(m)) return `${m}. Your account isn't being treated as an instructor by the database. Check that your row in the profiles table has role = instructor.`;
  return m;
}
const CHECKS: [string, string][] = [["tools", "Every tool opened live today; free tier and no-card status confirmed on the vendor's own page"], ["links", "Every link in steps, tools, and materials opens to the right page"], ["facts", "Dates, prices, version numbers, and regulatory facts re-checked against primary sources"], ["quiz", "All five quiz answers, every checkpoint answer, and every exam practice answer are correct"], ["guide", "Steps, Exam Lens, and quiz match the student guide word for word; exam objective IDs checked against the official guide"]];

export function ContentPage() {
  const { toast, reloadContent } = useAuth();
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [mats, setMats] = useState<Material[]>([]);
  const [sel, setSel] = useState<string>("w01d1");
  const reload = useCallback(async () => { setRows(await store.allContent()); setMats(await store.materials()); }, []);
  useEffect(() => { reload(); }, [reload]);
  const row = rows.find(r => r.session_id === sel);
  const s = SESSIONS.find(x => x.id === sel)!;
  const status = (r?: ContentRow) => { if (!r) return { cls: "", label: "No content" }; if (!r.verified_at || r.verified_at < r.updated_at) return { cls: "bad", label: r.verified_at ? "Changed since verified" : "Not verified" }; const d = Math.floor((Date.now() - new Date(r.verified_at).getTime()) / 86400000); return d === 0 ? { cls: "good", label: "Verified today" } : d <= 2 ? { cls: "good", label: `Verified ${d}d ago` } : { cls: "warn", label: `Verified ${d}d ago` }; };
  const exportAll = () => download(`lab-portal-content-${iso(new Date())}.json`, JSON.stringify(Object.fromEntries(rows.map(r => [r.session_id, { ...r.content, _version_note: r.version_note, _updated_at: r.updated_at, _verified_at: r.verified_at }])), null, 2));
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row between"><p className="muted">Session content lives here, not in code. Import the JSON for a session, verify it before class, and attach the student guide.</p><button className="btn ghost sm" onClick={exportAll}>Export all content (JSON)</button></div>
      <div className="lab" style={{ gridTemplateColumns: "300px minmax(0,1fr)" }}>
        <aside className="card" style={{ padding: 10, maxHeight: "75vh", overflowY: "auto" }}>
          {WEEKS.map(w => <div key={w.n} style={{ marginBottom: 8 }}><div className="eyebrow" style={{ padding: "6px 8px 2px" }}>Week {w.n}</div>
            {SESSIONS.filter(x => x.week === w.n).map(x => { const r = rows.find(q => q.session_id === x.id); const st = status(r); return <button key={x.id} onClick={() => setSel(x.id)} className="sess" style={{ width: "100%", marginBottom: 4, borderColor: sel === x.id ? "var(--accent)" : "var(--line)", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 8, alignItems: "center", padding: "8px 10px" }}><span className="small" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><b>D{x.day}</b> · {x.title}</span><span className={`pill ${st.cls}`} style={{ fontSize: ".66rem" }}>{st.label}</span></button>; })}</div>)}
        </aside>
        <section className="stack" style={{ gap: 14 }}>
          <div className="card"><span className="eyebrow">Week {s.week} · Day {s.day}</span><h2>{s.title}</h2>
            {row ? <div className="row small muted" style={{ marginTop: 6 }}><span className={`pill ${status(row).cls}`}>{status(row).label}</span><span>Imported {fmtDate(row.updated_at)}{row.version_note ? ` · ${row.version_note}` : ""}</span>{row.verification?.note && <span>· Last check: {row.verification.note}</span>}</div> : <p className="small muted" style={{ marginTop: 6 }}>No content imported yet. Students who open this session see a "being built" notice.</p>}</div>
          <Importer sel={sel} current={row?.content} onDone={async () => { await reload(); await reloadContent(); }} toast={toast} />
          {row && <Verify row={row} onDone={reload} toast={toast} />}
          <Materials sel={sel} mats={mats.filter(m => m.session_id === sel)} onDone={reload} toast={toast} />
        </section>
      </div>
    </div>
  );
}

function Importer({ sel, current, onDone, toast }: { sel: string; current?: SessionContent; onDone: () => Promise<void>; toast: (m: string) => void }) {
  const [text, setText] = useState(""); const [note, setNote] = useState(""); const [err, setErr] = useState(""); const fileRef = useRef<HTMLInputElement>(null);
  type Parsed = { ok: SessionContent; err?: undefined } | { err: string; ok?: undefined };
  const parsed = useMemo<Parsed | null>(() => { if (!text.trim()) return null; try { return { ok: JSON.parse(text) as SessionContent }; } catch (e) { return { err: (e as Error).message }; } }, [text]);
  const good = parsed && parsed.ok ? parsed.ok : null;
  const problems = good ? validateContent(good) : [];
  const diff = good && !problems.length ? diffContent(current, good) : [];
  useEffect(() => { setText(""); setNote(""); }, [sel]);
  return (
    <div className="card stack">
      <div className="row between"><h3>Import content</h3><div className="row"><button className="btn ghost sm" onClick={() => fileRef.current?.click()}>Upload JSON file</button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />{current && <button className="btn ghost sm" onClick={() => setText(JSON.stringify(current, null, 2))}>Load current for editing</button>}</div></div>
      <textarea id="content-json" value={text} onChange={e => setText(e.target.value)} placeholder="Paste the session JSON here, or upload the file." style={{ minHeight: 160, fontFamily: "var(--mono)", fontSize: ".8rem" }} />
      {parsed && parsed.err && <div className="tip-box small"><b>Not valid JSON:</b> {parsed.err}</div>}
      {good && problems.length > 0 && <div className="tip-box small"><b>{problems.length} problem{problems.length === 1 ? "" : "s"} to fix before import:</b><ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{problems.map((p, i) => <li key={i}>{p}</li>)}</ul></div>}
      {good && !problems.length && <>
        <div className="see-box small"><b>Valid.</b> {good.steps!.length} steps, {good.quiz!.length} quiz questions, {good.lens!.length} Exam Lens terms, {good.tools!.length} tools{good.sandbox ? `, sandbox: ${good.sandbox}` : ""}. Exam block: {good.exam!.cards.length} cards, {good.exam!.practice.length} practice questions, objectives {good.exam!.objectives.join(", ") || "none (not tested)"}.</div>
        <div className="callout small"><b>Changes vs current:</b><ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{diff.map((d, i) => <li key={i}>{d}</li>)}</ul></div>
        {err && <div className="tip-box small"><b>Import failed:</b> {err}</div>}
        <div className="row"><input id="version-note" placeholder="Version note, e.g. Built Oct 9; revised quiz Q3" value={note} onChange={e => setNote(e.target.value)} style={{ flex: 1, minWidth: 220 }} /><button className="btn" disabled={!note.trim()} onClick={async () => { try { await store.saveContent(sel, good, note.trim()); setText(""); setNote(""); await onDone(); toast("Content imported. Verify it before unlocking."); } catch (e) { setErr(describe(e)); } }}>Import</button></div>
      </>}
    </div>
  );
}

function Verify({ row, onDone, toast }: { row: ContentRow; onDone: () => Promise<void>; toast: (m: string) => void }) {
  const [checks, setChecks] = useState<Record<string, boolean>>({}); const [note, setNote] = useState("");
  useEffect(() => { setChecks({}); setNote(""); }, [row.session_id, row.updated_at]);
  const all = CHECKS.every(([k]) => checks[k]);
  return (
    <div className="card stack">
      <div className="row between"><h3>Daily verification</h3>{row.verified_at && <span className="small muted">Last verified {new Date(row.verified_at).toLocaleString()}</span>}</div>
      <p className="small muted">Run this the day of class, after the live check. All five must be true to mark verified.</p>
      {CHECKS.map(([k, label]) => <label key={k} className="row" style={{ gap: 10, alignItems: "flex-start", cursor: "pointer" }}><input type="checkbox" checked={!!checks[k]} onChange={e => setChecks({ ...checks, [k]: e.target.checked })} /><span className="small">{label}</span></label>)}
      <input id="verify-note" placeholder="What you checked and anything that changed, e.g. 'Gemini free tier confirmed; Teachable Machine URL unchanged'" value={note} onChange={e => setNote(e.target.value)} />
      <div><button className="btn" disabled={!all || !note.trim()} onClick={async () => { try { await store.setVerification(row.session_id, { checks, note: note.trim() }); await onDone(); toast("Marked verified"); } catch (e) { toast("Could not save: " + describe(e)); } }}>Mark verified for today</button></div>
      <div className="row small muted" style={{ gap: 6 }}><span>Tools in this session:</span>{(row.content.tools || []).map(t => <a key={t.name} href={t.url} target="_blank" rel="noreferrer" className="pill acc" style={{ textDecoration: "none" }}>{t.name} ↗</a>)}</div>
    </div>
  );
}

function Materials({ sel, mats, onDone, toast }: { sel: string; mats: Material[]; onDone: () => Promise<void>; toast: (m: string) => void }) {
  const [kind, setKind] = useState<Material["kind"]>("student_guide"); const [title, setTitle] = useState(""); const [url, setUrl] = useState(""); const [busy, setBusy] = useState(false); const [mErr, setMErr] = useState(""); const fileRef = useRef<HTMLInputElement>(null);
  const s = SESSIONS.find(x => x.id === sel)!;
  useEffect(() => { setTitle(kind === "student_guide" ? `Week ${s.week} Day ${s.day} Student Guide` : kind === "slides" ? "Slides (Gamma)" : kind === "lab_deck" ? "Lab deck (Gamma)" : ""); }, [kind, s]);
  return (
    <div className="card stack">
      <h3>Materials</h3>
      <p className="small muted">Upload the student guide (PDF or Word) and add the Gamma links. Students see these at the top of the session and under Resources.</p>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <label className="stack" style={{ gap: 4, width: "auto" }}><span className="eyebrow">Type</span><select style={{ width: "auto" }} value={kind} onChange={e => setKind(e.target.value as Material["kind"])}><option value="student_guide">Student guide (file)</option><option value="slides">Slides link</option><option value="lab_deck">Lab deck link</option><option value="other">Other</option></select></label>
        <label className="stack" style={{ gap: 4, flex: 1, minWidth: 180 }}><span className="eyebrow">Title</span><input value={title} onChange={e => setTitle(e.target.value)} /></label>
        {kind === "student_guide" ? <><button className="btn" disabled={busy || !title.trim()} onClick={() => fileRef.current?.click()}>{busy ? "Uploading…" : "Choose file and upload"}</button><input ref={fileRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={async e => { const f = e.target.files?.[0]; if (!f) return; setBusy(true); try { await store.addMaterial({ session_id: sel, kind, title: title.trim(), file: f }); await onDone(); toast("Uploaded"); setMErr(""); } catch (err) { setMErr(describe(err)); } finally { setBusy(false); e.target.value = ""; } }} /></>
          : <><label className="stack" style={{ gap: 4, flex: 2, minWidth: 220 }}><span className="eyebrow">URL</span><input type="url" placeholder="https://gamma.app/docs/…" value={url} onChange={e => setUrl(e.target.value)} /></label><button className="btn" disabled={!url.trim() || !title.trim()} onClick={async () => { try { await store.addMaterial({ session_id: sel, kind, title: title.trim(), url: url.trim() }); setUrl(""); await onDone(); toast("Added"); setMErr(""); } catch (err) { setMErr(describe(err)); } }}>Add link</button></>}
      </div>
      {mErr && <div className="tip-box small"><b>Upload failed:</b> {mErr}</div>}
      <div className="stack" style={{ gap: 6 }}>{mats.map(m => <div key={m.id} className="row between" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}><span className="small"><span className="pill" style={{ marginRight: 8 }}>{m.kind.replace("_", " ")}</span>{m.url ? <a href={m.url} target="_blank" rel="noreferrer">{m.title}</a> : m.title}</span><button className="btn ghost xs" onClick={async () => { await store.deleteMaterial(m.id); await onDone(); }}>Remove</button></div>)}{!mats.length && <div className="small muted">Nothing attached yet.</div>}</div>
    </div>
  );
}

export function AttendancePage() {
  const { toast } = useAuth();
  const [students, setStudents] = useState<Profile[]>([]); const [att, setAtt] = useState<Attendance[]>([]); const [sched, setSched] = useState<string>("");
  const [sel, setSel] = useState<string>("w01d1");
  const reload = useCallback(async () => { const [p, a, st, days] = await Promise.all([store.allProfiles(), store.attendance(), store.settings(), store.calendarDays()]); setStudents(p.filter(x => x.role === "student")); setAtt(a); const schedule = buildSchedule(st, days); const today = iso(new Date()); const todayS = schedule.find(d => d.date === today && d.session) || [...schedule].reverse().find(d => d.date <= today && d.session) || schedule.find(d => d.session); if (todayS?.session) setSel(todayS.session.id); setSched(JSON.stringify(schedule.map(d => [d.date, d.session?.id]))); }, []);
  useEffect(() => { reload(); }, [reload]);
  const schedule = useMemo(() => (sched ? JSON.parse(sched) as [string, string | undefined][] : []), [sched]);
  const dateFor = (id: string) => schedule.find(([, s]) => s === id)?.[0];
  const get = (sid: string) => att.find(a => a.student_id === sid && a.session_id === sel)?.status;
  const set = async (sid: string, st: Attendance["status"] | null) => { await store.setAttendance(sid, sel, st); setAtt(await store.attendance()); };
  const counts = { present: 0, late: 0, absent: 0 }; students.forEach(s => { const g = get(s.id); if (g) counts[g]++; });
  const s = SESSIONS.find(x => x.id === sel)!;
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="card row between">
        <div className="row"><label className="row" style={{ gap: 8 }}><span className="small muted">Session</span><select style={{ width: "auto" }} value={sel} onChange={e => setSel(e.target.value)}>{SESSIONS.map(x => <option key={x.id} value={x.id}>W{x.week} D{x.day} · {dateFor(x.id) ? fmtLong(dateFor(x.id)!) : ""} · {x.title.slice(0, 40)}</option>)}</select></label></div>
        <div className="row"><span className="pill good">{counts.present} present</span><span className="pill warn">{counts.late} late</span><span className="pill bad">{counts.absent} absent</span><span className="pill">{students.length - counts.present - counts.late - counts.absent} unmarked</span><button className="btn ghost sm" onClick={async () => { for (const st of students) if (!get(st.id)) await store.setAttendance(st.id, sel, "present"); setAtt(await store.attendance()); toast("Unmarked set to present"); }}>Mark rest present</button></div>
      </div>
      <div className="card"><span className="eyebrow">Week {s.week} · Day {s.day}{dateFor(sel) ? ` · ${fmtLong(dateFor(sel)!)}` : ""}</span><h3>{s.title}</h3>
        <div className="stack" style={{ gap: 4, marginTop: 10 }}>{students.map(st => { const g = get(st.id); const abs = att.filter(a => a.student_id === st.id && a.status === "absent").length; return (
          <div key={st.id} className="person"><div className="avatar">{initials(st.full_name)}</div><div><b>{st.full_name}</b>{abs > 0 && <span className="small muted"> · {abs} absence{abs === 1 ? "" : "s"} total</span>}</div>
            <div className="chips">{(["present", "late", "absent"] as const).map(k => <button key={k} className={g === k ? "on" : ""} style={g === k ? { borderColor: k === "present" ? "var(--good)" : k === "late" ? "var(--warn)" : "var(--bad)", color: k === "present" ? "var(--good)" : k === "late" ? "var(--warn)" : "var(--bad)", background: k === "present" ? "var(--good-soft)" : k === "late" ? "var(--warn-soft)" : "var(--bad-soft)" } : {}} onClick={() => set(st.id, g === k ? null : k)}>{k}</button>)}</div></div>); })}</div>
      </div>
    </div>
  );
}
