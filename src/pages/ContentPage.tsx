// Instructor: session content import with validation and diff, daily verification, materials, attendance, export.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SESSIONS, WEEKS, diffContent, validateContent, type SessionContent } from "../content/course";
import { useAuth } from "../auth";
import { store, type Attendance, type ContentRow, type Material, type Profile, type Release } from "../lib/store";
import { buildSchedule, fmtLong, iso } from "../lib/schedule";
import { download, fmtDate, initials, toCSV } from "../lib/logic";

function describe(e: unknown): string {
  const m = (e as { message?: string; code?: string; details?: string })?.message || String(e);
  if (/relation .* does not exist|Could not find the table|schema cache/i.test(m)) return `${m}. The database tables for this feature haven't been created yet: run the "Added October 6 (content in DB, materials, verification, attendance)" section of supabase/schema.sql in the Supabase SQL editor.`;
  if (/Bucket not found/i.test(m)) return `${m}. The "materials" storage bucket doesn't exist yet: run the same October 6 SQL section, which creates it.`;
  if (/row-level security|permission denied|not authorized/i.test(m)) return `${m}. Your account isn't being treated as an instructor by the database. Check that your row in the profiles table has role = instructor.`;
  return m;
}

export function ContentPage() {
  const { toast, reloadContent } = useAuth();
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [mats, setMats] = useState<Material[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [sel, setSel] = useState<string>("w01d1");
  const reload = useCallback(async () => { const [c, m, r, p] = await Promise.all([store.allContent(), store.materials(), store.releases(), store.allProfiles()]); setRows(c); setMats(m); setReleases(r); setStudents(p.filter(x => x.role === "student")); }, []);
  useEffect(() => { reload(); }, [reload]);
  const row = rows.find(r => r.session_id === sel);
  const s = SESSIONS.find(x => x.id === sel)!;
  const status = (r?: ContentRow) => { if (!r) return { cls: "", label: "No content" }; if (!r.content.verified) return { cls: "bad", label: "No verification stamp" }; const d = Math.floor((Date.now() - new Date(r.content.verified.date + "T12:00:00Z").getTime()) / 86400000); return d <= 7 ? { cls: "good", label: `Checked ${r.content.verified.date}` } : { cls: "warn", label: `Checked ${r.content.verified.date} (${d}d ago)` }; };
  const openForClass = (id: string) => releases.some(r => r.session_id === id && r.student_id === null);
  const earlyFor = (id: string) => releases.filter(r => r.session_id === id && r.student_id).map(r => r.student_id as string);
  const toggleWeek = async (w: number, on: boolean) => { for (const x of SESSIONS.filter(q => q.week === w)) await store.setRelease(x.id, null, on); await reload(); if (on) store.notify("unlock", { session_id: `week${w}`, title: `Week ${w}: ${WEEKS.find(x => x.n === w)?.theme ?? ""}` }); toast(`Week ${w} ${on ? "unlocked" : "locked"} for the class`); };
  const exportAll = () => download(`lab-portal-content-${iso(new Date())}.json`, JSON.stringify(Object.fromEntries(rows.map(r => [r.session_id, { ...r.content, _version_note: r.version_note, _updated_at: r.updated_at, _verified_at: r.verified_at }])), null, 2));
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row between"><p className="muted">One place per session: import its content, attach materials, and unlock it. Verification is stamped into the file by the build.</p><button className="btn ghost sm" onClick={exportAll}>Export all content (JSON)</button></div>
      <div className="lab" style={{ gridTemplateColumns: "320px minmax(0,1fr)" }}>
        <aside className="card" style={{ padding: 10, maxHeight: "78vh", overflowY: "auto" }}>
          {WEEKS.map(w => { const days = SESSIONS.filter(x => x.week === w.n); const allOpen = days.every(x => openForClass(x.id)); return (
            <div key={w.n} style={{ marginBottom: 10 }}>
              <div className="row between" style={{ padding: "6px 8px 2px" }}><span className="eyebrow">Week {w.n}</span><button className="btn xs ghost" style={{ padding: "1px 7px", fontSize: ".7rem" }} onClick={() => toggleWeek(w.n, !allOpen)}>{allOpen ? "Lock week" : "Unlock week"}</button></div>
              {days.map(x => { const r = rows.find(q => q.session_id === x.id); const st = status(r); const open = openForClass(x.id); const early = earlyFor(x.id).length; return (
                <button key={x.id} onClick={() => setSel(x.id)} className="sess" style={{ width: "100%", marginBottom: 4, borderColor: sel === x.id ? "var(--accent)" : "var(--line)", display: "grid", gridTemplateColumns: "18px minmax(0,1fr) auto", gap: 8, alignItems: "center", padding: "8px 10px" }} title={open ? "Open for the whole class" : early ? `Locked; open early for ${early}` : "Locked"}>
                  <span style={{ fontSize: ".9rem", color: open ? "var(--good)" : "var(--mute)" }}>{open ? "●" : early ? "◐" : "○"}</span>
                  <span className="small" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}><b>D{x.day}</b> · {x.title}</span>
                  <span className={`pill ${st.cls}`} style={{ fontSize: ".66rem" }}>{st.label}</span>
                </button>); })}
            </div>); })}
          <div className="small muted" style={{ padding: "4px 8px" }}>● open to class · ◐ early access for some · ○ locked</div>
        </aside>
        <section className="stack" style={{ gap: 14 }}>
          <div className="card"><span className="eyebrow">Week {s.week} · Day {s.day}</span><h2>{s.title}</h2>
            {row ? <div className="row small muted" style={{ marginTop: 6 }}><span className={`pill ${status(row).cls}`}>{status(row).label}</span><span>Imported {fmtDate(row.updated_at)}{row.version_note ? ` · ${row.version_note}` : ""}</span></div> : <p className="small muted" style={{ marginTop: 6 }}>No content imported yet. Students who open this session see a "being built" notice.</p>}</div>
          <Access sel={sel} row={row} mats={mats.filter(m => m.session_id === sel)} students={students} openForClass={openForClass(sel)} early={earlyFor(sel)} onChange={reload} toast={toast} />
          <Importer sel={sel} current={row?.content} onDone={async () => { await reload(); await reloadContent(); }} toast={toast} />
          {row && <Verify row={row} />}
          <Materials sel={sel} mats={mats.filter(m => m.session_id === sel)} onDone={reload} toast={toast} />
        </section>
      </div>
    </div>
  );
}

// Readiness checklist plus unlock controls for one session.
function Access({ sel, row, mats, students, openForClass, early, onChange, toast }: { sel: string; row?: ContentRow; mats: Material[]; students: Profile[]; openForClass: boolean; early: string[]; onChange: () => Promise<void>; toast: (m: string) => void }) {
  const [pickEarly, setPickEarly] = useState(false);
  const [busy, setBusy] = useState(false);
  const checks: [boolean, string][] = [[!!row, "Content imported"], [!!row?.content.verified, "Verification stamp from the build"], [mats.some(m => m.kind === "student_guide"), "Student guide uploaded"], [mats.some(m => m.kind === "slides"), "Slides link added"]];
  const ready = checks.every(([ok]) => ok);
  const missing = checks.filter(([ok]) => !ok).map(([, l]) => l);
  const setClass = async (on: boolean) => {
    if (on && !ready && !window.confirm(`Not everything is in place: ${missing.join(", ")}. Unlock anyway?`)) return;
    setBusy(true); try { await store.setRelease(sel, null, on); await onChange(); if (on) { const ss = SESSIONS.find(x => x.id === sel)!; const r = await store.notify("unlock", { session_id: sel, title: `Week ${ss.week} Day ${ss.day}: ${ss.title}` }); toast(r.ok && !r.skipped ? "Unlocked and the class was emailed" : "Unlocked for the whole class"); } else toast("Locked for the class"); } finally { setBusy(false); }
  };
  const toggleEarly = async (sid: string) => { const on = !early.includes(sid); setBusy(true); try { await store.setRelease(sel, sid, on); await onChange(); if (on) { const ss = SESSIONS.find(x => x.id === sel)!; store.notify("unlock", { session_id: sel, title: `Week ${ss.week} Day ${ss.day}: ${ss.title}`, student_ids: [sid] }); } } finally { setBusy(false); } };
  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <div><h3>Access</h3><p className="small muted" style={{ marginTop: 2 }}>{openForClass ? "Open for the whole class." : early.length ? `Locked for the class; open early for ${early.length} student${early.length === 1 ? "" : "s"}.` : "Locked. Students see it as coming soon."}</p></div>
        <div className="row">
          {openForClass ? <button className="btn ghost" disabled={busy} onClick={() => setClass(false)}>Lock for class</button> : <button className="btn" disabled={busy} onClick={() => setClass(true)}>Unlock for class</button>}
          {!openForClass && <button className="btn ghost sm" onClick={() => setPickEarly(p => !p)}>{pickEarly ? "Done" : "Early access…"}</button>}
        </div>
      </div>
      <div className="row" style={{ gap: 6 }}>{checks.map(([ok, l]) => <span key={l} className={`pill ${ok ? "good" : "warn"}`}>{ok ? "✓" : "•"} {l}</span>)}</div>
      {!openForClass && pickEarly && <div>
        <span className="eyebrow">Open early for</span>
        <div className="chips" style={{ marginTop: 6 }}>{students.map(st => <button key={st.id} className={early.includes(st.id) ? "on" : ""} disabled={busy} onClick={() => toggleEarly(st.id)}>{st.full_name}</button>)}</div>
        {!students.length && <div className="small muted">No students on the roster yet.</div>}
      </div>}
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
        <div className="see-box small"><b>Valid.</b> {good.steps!.length} steps, {good.quiz!.length} quiz questions, {good.lens!.length} Exam Lens terms, {good.tools!.length} tools{good.sandbox ? `, sandbox: ${good.sandbox}` : ""}. Exam block: {good.exam!.cards.length} cards, {good.exam!.practice.length} practice questions, objectives {good.exam!.objectives.join(", ") || "none (not tested)"}. Rubric: {good.rubric!.items.length} items.</div>
        <div className="callout small"><b>Changes vs current:</b><ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{diff.map((d, i) => <li key={i}>{d}</li>)}</ul></div>
        {err && <div className="tip-box small"><b>Import failed:</b> {err}</div>}
        <div className="row"><input id="version-note" placeholder="Version note, e.g. Built Oct 9; revised quiz Q3" value={note} onChange={e => setNote(e.target.value)} style={{ flex: 1, minWidth: 220 }} /><button className="btn" disabled={!note.trim()} onClick={async () => { try { await store.saveContent(sel, good, note.trim()); setText(""); setNote(""); await onDone(); toast("Content imported. Verify it before unlocking."); } catch (e) { setErr(describe(e)); } }}>Import</button></div>
      </>}
    </div>
  );
}

function Verify({ row }: { row: ContentRow }) {
  const v = row.content.verified;
  return (
    <div className="card stack" style={{ gap: 8 }}>
      <div className="row between"><h3>Verification</h3>{v ? <span className="pill good">Checked at build on {v.date}</span> : <span className="pill bad">No stamp</span>}</div>
      <p className="small muted">Live checks (tools and free tiers, links, facts and dates, every answer, guide match) are run by the build before this file is generated. Nothing to do here; re-import a newer file if something changed.</p>
      {v && <>
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{v.checks.map((c, i) => <li key={i}>{c}</li>)}</ul>
        <div className="small"><b>What changed:</b> {v.note}</div>
        {v.sources && v.sources.length > 0 && <div className="row small muted" style={{ gap: 6 }}><span>Checked against:</span>{v.sources.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" className="pill" style={{ textDecoration: "none" }}>{new URL(u).hostname.replace(/^www\./, "")} ↗</a>)}</div>}
      </>}
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
  const LABEL = { present: "Present", late: "Late", absent: "Absent" } as const;
  const stamp = iso(new Date());
  const sorted = [...students].sort((a, b) => a.full_name.localeCompare(b.full_name));
  const exportSession = () => {
    const rows = sorted.map(st => { const g = get(st.id); return [st.full_name, st.email, `W${s.week} D${s.day}`, dateFor(sel) || "", s.title, g ? LABEL[g] : "Not marked"]; });
    download(`attendance-w${s.week}d${s.day}-${stamp}.csv`, toCSV([["Student", "Email", "Session", "Date", "Title", "Status"], ...rows]));
  };
  const exportAll = () => {
    // Every session that has happened (dated today or earlier) or already has marks, in course order.
    const marked = new Set(att.map(a => a.session_id));
    const cols = SESSIONS.filter(x => { const d = dateFor(x.id); return (d && d <= stamp) || marked.has(x.id); });
    const head = ["Student", "Email", ...cols.map(x => `W${x.week} D${x.day}${dateFor(x.id) ? ` (${dateFor(x.id)})` : ""}`), "Present", "Late", "Absent", "Not marked", "Attendance %"];
    const body = sorted.map(st => {
      const vals = cols.map(x => att.find(a => a.student_id === st.id && a.session_id === x.id)?.status);
      const n = { present: vals.filter(v => v === "present").length, late: vals.filter(v => v === "late").length, absent: vals.filter(v => v === "absent").length };
      const total = n.present + n.late + n.absent;
      return [st.full_name, st.email, ...vals.map(v => (v ? LABEL[v] : "")), n.present, n.late, n.absent, cols.length - total, total ? `${Math.round(100 * (n.present + n.late) / total)}%` : ""];
    });
    download(`attendance-all-${stamp}.csv`, toCSV([head, ...body]));
  };
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
        <button className="btn ghost sm" onClick={exportSession} disabled={!students.length}>Export this session</button>
        <button className="btn ghost sm" onClick={exportAll} disabled={!students.length} title="One row per student, one column per session so far, with totals">Export full course</button>
      </div>
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
