// Capstone tracker. Students: describe the project, then submit each milestone with a link and a note.
// Instructor: one matrix of students by milestones; open a cell to approve or ask for a revision.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MILESTONES, type Milestone } from "../content/capstone";
import { SESSIONS } from "../content/course";
import { useAuth } from "../auth";
import { store, type CapstoneRow, type MilestoneRow, type MilestoneStatus, type Portfolio, type Profile } from "../lib/store";
import { buildSchedule, fmtLong } from "../lib/schedule";
import { initials } from "../lib/logic";

const LABEL: Record<MilestoneStatus, string> = { not_started: "Not started", submitted: "Waiting for review", revise: "Needs revision", approved: "Approved" };
const PILL: Record<MilestoneStatus, string> = { not_started: "", submitted: "warn", revise: "bad", approved: "good" };

function useDueDates() {
  const [due, setDue] = useState<Record<string, string>>({});
  useEffect(() => { (async () => { const [st, days] = await Promise.all([store.settings(), store.calendarDays()]); const sched = buildSchedule(st, days); setDue(Object.fromEntries(sched.filter(d => d.kind === "session").map(d => [d.session!.id, d.date]))); })(); }, []);
  return due;
}

// ---------------- Student ----------------
export function StudentCapstone() {
  const { user, toast } = useAuth();
  const [cap, setCap] = useState<CapstoneRow | null>(null);
  const [rows, setRows] = useState<MilestoneRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const due = useDueDates();
  const reload = useCallback(async () => { try { const [c, m] = await Promise.all([store.capstones(), store.milestones()]); setCap(c.find(x => x.student_id === user!.id) || { student_id: user!.id, title: "", stakeholder: "", problem: "" }); setRows(m.filter(x => x.student_id === user!.id)); setErr(null); } catch (e) { setErr((e as Error).message); } }, [user]);
  useEffect(() => { reload(); }, [reload]);
  if (!cap) return <div className="empty">{err || "Loading…"}</div>;
  const approved = rows.filter(r => r.status === "approved").length;
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="callout small">Your capstone is a working AI solution for a real person's problem. It starts in Week 16 when you line up a stakeholder and finishes with a presentation in Week 20. Each milestone below says what to turn in and what "approved" means. {approved} of {MILESTONES.length} approved.</div>
      <CapstoneHeader cap={cap} onSave={async c => { try { await store.saveCapstone(c); await reload(); toast("Saved"); } catch (e) { toast("Couldn't save: " + (e as Error).message); } }} />
      <div className="stack" style={{ gap: 10 }}>{MILESTONES.map((m, i) => <MilestoneCard key={m.id} n={i + 1} m={m} row={rows.find(r => r.milestone === m.id)} due={due[m.session]} onSubmit={async (link, note) => { try { await store.submitMilestone({ milestone: m.id, link, note }); await reload(); toast("Submitted for review"); } catch (e) { toast("Couldn't submit: " + (e as Error).message); } }} />)}</div>
    </div>
  );
}

function CapstoneHeader({ cap, onSave }: { cap: CapstoneRow; onSave: (c: { title: string; stakeholder: string; problem: string }) => Promise<void> }) {
  const [f, setF] = useState({ title: cap.title || "", stakeholder: cap.stakeholder || "", problem: cap.problem || "" });
  const dirty = f.title !== (cap.title || "") || f.stakeholder !== (cap.stakeholder || "") || f.problem !== (cap.problem || "");
  return (
    <div className="card stack" style={{ gap: 10 }}>
      <h3>Your project</h3>
      <label className="stack" style={{ gap: 4 }}><span className="eyebrow">Working title</span><input id="cap-title" value={f.title} placeholder="Intake triage assistant for a physical therapy clinic" onChange={e => setF({ ...f, title: e.target.value })} /></label>
      <label className="stack" style={{ gap: 4 }}><span className="eyebrow">Stakeholder (role and organization; a name is optional)</span><input id="cap-stake" value={f.stakeholder} placeholder="Front desk manager, a local physical therapy clinic" onChange={e => setF({ ...f, stakeholder: e.target.value })} /></label>
      <label className="stack" style={{ gap: 4 }}><span className="eyebrow">The problem, in their words, with what it costs today</span><textarea id="cap-problem" rows={3} value={f.problem} placeholder="Staff spend about 6 hours a week sorting web inquiries by insurance, urgency, and location." onChange={e => setF({ ...f, problem: e.target.value })} /></label>
      <div><button className="btn sm" disabled={!dirty} onClick={() => onSave(f)}>Save</button></div>
    </div>
  );
}

function MilestoneCard({ n, m, row, due, onSubmit }: { n: number; m: Milestone; row?: MilestoneRow; due?: string; onSubmit: (link: string, note: string) => Promise<void> }) {
  const status = row?.status || "not_started";
  const [open, setOpen] = useState(status === "revise");
  const [link, setLink] = useState(row?.link || "");
  const [note, setNote] = useState(row?.note || "");
  const [busy, setBusy] = useState(false);
  const s = SESSIONS.find(x => x.id === m.session);
  return (
    <div className="card" style={{ borderColor: status === "approved" ? "var(--good)" : status === "revise" ? "var(--bad)" : undefined }}>
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}><span className="eyebrow">Milestone {n}{s ? ` · Week ${s.week} Day ${s.day}` : ""}{due ? ` · due ${fmtLong(due)}` : ""}</span><h3>{m.title}</h3></div>
        <div className="row" style={{ gap: 6 }}><span className={`pill ${PILL[status]}`}>{LABEL[status]}</span>{status !== "approved" && <button className="btn ghost xs" onClick={() => setOpen(o => !o)}>{open ? "Close" : status === "not_started" ? "Submit" : "Resubmit"}</button>}</div>
      </div>
      <ul className="small" style={{ margin: "8px 0 0", paddingLeft: 18 }}>{m.deliver.map((d, i) => <li key={i}>{d}</li>)}</ul>
      <div className="small muted" style={{ marginTop: 6 }}><b>Approved when:</b> {m.approvedWhen}</div>
      {row?.link && <div className="small" style={{ marginTop: 6 }}>Submitted: <a href={row.link} target="_blank" rel="noreferrer" style={{ wordBreak: "break-all" }}>{row.link}</a></div>}
      {row?.instructor_note && <div className={status === "revise" ? "tip-box small" : "see-box small"} style={{ marginTop: 8 }}><b>From Roland:</b> {row.instructor_note}</div>}
      {open && status !== "approved" && <div className="stack" style={{ gap: 8, marginTop: 10 }}>
        <input id={`ms-link-${m.id}`} type="url" placeholder="Link to your doc, sheet, repo, or video (set to anyone with the link can view)" value={link} onChange={e => setLink(e.target.value)} />
        <textarea id={`ms-note-${m.id}`} rows={2} placeholder="A note for Roland: what's done, what you're unsure about" value={note} onChange={e => setNote(e.target.value)} />
        <div><button className="btn sm" disabled={busy || (!link.trim() && !note.trim())} onClick={async () => { setBusy(true); try { await onSubmit(link.trim(), note.trim()); setOpen(false); } finally { setBusy(false); } }}>{busy ? "Submitting…" : "Submit for review"}</button></div>
      </div>}
    </div>
  );
}

// ---------------- Instructor ----------------
export function InstructorCapstone({ profiles }: { profiles: Profile[] }) {
  const { toast } = useAuth();
  const [caps, setCaps] = useState<CapstoneRow[]>([]);
  const [rows, setRows] = useState<MilestoneRow[]>([]);
  const [ports, setPorts] = useState<Portfolio[]>([]);
  const [sel, setSel] = useState<{ student: Profile; m: Milestone } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const due = useDueDates();
  const reload = useCallback(async () => { try { const [c, m, p] = await Promise.all([store.capstones(), store.milestones(), store.allPortfolios()]); setCaps(c); setRows(m); setPorts(p); setErr(null); } catch (e) { setErr((e as Error).message); } }, []);
  useEffect(() => { reload(); }, [reload]);
  const students = profiles.filter(p => p.role === "student");
  const waiting = rows.filter(r => r.status === "submitted").length;
  const byStudent = useMemo(() => new Map(students.map(s => [s.id, rows.filter(r => r.student_id === s.id)])), [students, rows]);
  return (
    <div className="stack" style={{ gap: 14 }}>
      {err && <div className="tip-box small">{/relation|does not exist/i.test(err) ? "Run the October 7 batch 2 database section to turn on the capstone tracker." : err}</div>}
      <div className="row between"><p className="muted" style={{ margin: 0 }}>Seven milestones from Week 16 to Week 20. Click any cell to review it.</p>{waiting > 0 && <span className="pill warn">{waiting} waiting for review</span>}</div>
      <div className="card"><div className="grid-wrap"><table className="grid"><thead><tr><th>Student and project</th>{MILESTONES.map((m, i) => <th key={m.id} style={{ textAlign: "center", whiteSpace: "normal", minWidth: 92 }} title={m.title}>{i + 1}. {m.title}{due[m.session] ? <div className="muted small" style={{ fontWeight: 400 }}>{fmtLong(due[m.session])}</div> : null}</th>)}<th>Portfolio</th></tr></thead><tbody>
        {students.map(st => { const c = caps.find(x => x.student_id === st.id); const ms = byStudent.get(st.id) || []; const port = ports.find(p => p.student_id === st.id); return (
          <tr key={st.id}>
            <td style={{ whiteSpace: "normal", minWidth: 220 }}><div className="row" style={{ gap: 8, flexWrap: "nowrap", alignItems: "flex-start" }}><span className="avatar" style={{ width: 26, height: 26, fontSize: ".7rem", flexShrink: 0 }}>{initials(st.full_name)}</span><div><b>{st.full_name}</b><div className="small muted">{c?.title || "No project yet"}</div></div></div></td>
            {MILESTONES.map(m => { const r = ms.find(x => x.milestone === m.id); const status = r?.status || "not_started"; return <td key={m.id} style={{ textAlign: "center" }}><button className={`pill ${PILL[status]}`} style={{ cursor: "pointer", border: 0 }} onClick={() => setSel({ student: st, m })}>{status === "not_started" ? "·" : status === "submitted" ? "Review" : status === "revise" ? "Revise" : "✓"}</button></td>; })}
            <td>{port ? (port.published ? <Link to={`/p/${port.slug}`} className="pill good" style={{ textDecoration: "none" }} target="_blank">Live ↗</Link> : <span className="pill">Draft</span>) : <span className="muted small">—</span>}</td>
          </tr>); })}
      </tbody></table></div></div>
      {sel && <ReviewDrawer student={sel.student} m={sel.m} cap={caps.find(c => c.student_id === sel.student.id)} row={rows.find(r => r.student_id === sel.student.id && r.milestone === sel.m.id)} onClose={() => setSel(null)} onSaved={async (msg) => { await reload(); setSel(null); toast(msg); }} />}
    </div>
  );
}

function ReviewDrawer({ student, m, cap, row, onClose, onSaved }: { student: Profile; m: Milestone; cap?: CapstoneRow; row?: MilestoneRow; onClose: () => void; onSaved: (msg: string) => Promise<void> }) {
  const [note, setNote] = useState(row?.instructor_note || "");
  const [busy, setBusy] = useState(false);
  const review = async (status: MilestoneStatus) => { setBusy(true); try { await store.reviewMilestone({ student_id: student.id, milestone: m.id, status, instructor_note: note.trim() }); await onSaved(status === "approved" ? "Approved" : "Sent back for revision"); } finally { setBusy(false); } };
  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Review milestone">
        <div className="row between"><div><span className="eyebrow">{m.title}</span><h3>{student.full_name}</h3>{cap?.title && <div className="small muted">{cap.title}</div>}</div><button className="btn ghost sm" onClick={onClose}>Close</button></div>
        {cap?.problem && <div className="callout small"><b>Problem:</b> {cap.problem}{cap.stakeholder && <><br /><b>Stakeholder:</b> {cap.stakeholder}</>}</div>}
        <div><span className="eyebrow">What to look for</span><ul className="small" style={{ margin: "6px 0 0", paddingLeft: 18 }}>{m.deliver.map((d, i) => <li key={i}>{d}</li>)}</ul><div className="small muted" style={{ marginTop: 6 }}><b>Approved when:</b> {m.approvedWhen}</div></div>
        <div><span className="eyebrow">Submitted</span>{row && row.status !== "not_started" ? <div className="stack small" style={{ gap: 6, marginTop: 6 }}>{row.link && <a href={row.link} target="_blank" rel="noreferrer" style={{ wordBreak: "break-all" }}>{row.link}</a>}{row.note && <div style={{ whiteSpace: "pre-wrap" }}>{row.note}</div>}<span className={`pill ${PILL[row.status]}`} style={{ alignSelf: "flex-start" }}>{LABEL[row.status]}</span></div> : <p className="small muted">Nothing submitted yet. You can still approve, for example after a conversation in class.</p>}</div>
        <label className="stack" style={{ gap: 4 }}><span className="eyebrow">Note to {student.full_name.split(" ")[0]}</span><textarea id="rev-note" rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder="What's working, and the one thing to change before this is approved." /></label>
        <div className="row"><button className="btn" disabled={busy} onClick={() => review("approved")}>Approve</button><button className="btn ghost" disabled={busy || !note.trim()} title={note.trim() ? "" : "Add a note saying what to change"} onClick={() => review("revise")}>Needs revision</button></div>
        <p className="small muted">The student sees your note on their Capstone page and gets an email if notifications are on.</p>
      </aside>
    </>
  );
}
