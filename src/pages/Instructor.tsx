import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { SESSIONS, WEEKS, type Session } from "../content/course";
import { useAuth } from "../auth";
import { store, type Attendance, type ContentRow, type Grade, type Profile, type Progress, type Release, type Submission } from "../lib/store";
import type { OHRequest } from "../lib/store";
import { ContentPage, AttendancePage } from "./ContentPage";
import { buildSchedule, iso } from "../lib/schedule";
import { computeStats, download, fmtDate, initials, isUnlocked, labPct, sessionState, STATE_LABEL, toCSV, type SessionState, type StudentStat } from "../lib/logic";

type Data = { profiles: Profile[]; progress: Progress[]; subs: Submission[]; grades: Grade[]; releases: Release[]; attendance: Attendance[]; content: ContentRow[] };
function useInstructorData() {
  const [d, setD] = useState<Data | null>(null);
  const reload = useCallback(async () => { const [profiles, progress, subs, grades, releases, attendance, content] = await Promise.all([store.allProfiles(), store.allProgress(), store.allSubmissions(), store.allGrades(), store.releases(), store.attendance(), store.allContent()]); setD({ profiles, progress, subs, grades, releases, attendance, content }); }, []);
  useEffect(() => { reload(); }, [reload]);
  return { d, reload };
}

export default function Instructor() {
  const { d, reload } = useInstructorData();
  if (!d) return <div className="empty">Loading class data…</div>;
  const students = d.profiles.filter(p => p.role === "student");
  return (
    <>
      <div className="hero"><div><span className="eyebrow">{students.length} students · Week {Math.max(1, ...d.releases.map(r => SESSIONS.find(s => s.id === r.session_id)?.week || 1))} open</span><h1>Instructor</h1></div>
      </div>
      <Routes>
        <Route index element={<Dashboard d={d} reload={reload} />} />
        <Route path="grid" element={<Navigate to="/instructor" replace />} />
        <Route path="release" element={<Navigate to="/instructor/sessions" replace />} />
        <Route path="sessions" element={<ContentPage />} />
        <Route path="class" element={<ClassPage d={d} reload={reload} />} />
        <Route path="roster" element={<Navigate to="/instructor/class?tab=roster" replace />} />
        <Route path="attendance" element={<Navigate to="/instructor/class?tab=attendance" replace />} />
        <Route path="content" element={<Navigate to="/instructor/sessions" replace />} />
      </Routes>
    </>
  );
}

// ---------- Dashboard: overview on top, the full progress grid underneath ----------
function Dashboard({ d, reload }: { d: Data; reload: () => Promise<void> }) {
  const loc = useLocation();
  useEffect(() => { if (loc.hash === "#grid") document.getElementById("grid")?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [loc.hash, loc.search]);
  return (
    <div className="stack" style={{ gap: 22 }}>
      <Overview d={d} />
      <div id="grid" style={{ scrollMarginTop: 90 }}>
        <div className="row between" style={{ marginBottom: 10 }}><div><h2 style={{ fontSize: "1.2rem" }}>Progress by week</h2><p className="small muted">Click a cell to grade or review a student's work. Filters also drive the CSV export.</p></div></div>
        <Grid d={d} reload={reload} />
      </div>
    </div>
  );
}

// ---------- Class: attendance and roster on one page ----------
function ClassPage({ d, reload }: { d: Data; reload: () => Promise<void> }) {
  const loc = useLocation();
  const [isClassDay, setIsClassDay] = useState<boolean | null>(null);
  useEffect(() => { (async () => { const [st, days] = await Promise.all([store.settings(), store.calendarDays()]); const today = iso(new Date()); setIsClassDay(buildSchedule(st, days).some(x => x.kind === "session" && x.date === today)); })(); }, []);
  const fromUrl = new URLSearchParams(loc.search).get("tab");
  const [tab, setTab] = useState<"attendance" | "roster" | null>(fromUrl === "roster" || fromUrl === "attendance" ? fromUrl : null);
  useEffect(() => { if (fromUrl === "roster" || fromUrl === "attendance") setTab(fromUrl); }, [fromUrl]);
  const active = tab ?? (isClassDay == null ? null : isClassDay ? "attendance" : "roster");
  if (!active) return <div className="empty">Loading…</div>;
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row between">
        <div className="tabs" style={{ borderBottom: 0 }}><button className={active === "attendance" ? "on" : ""} onClick={() => setTab("attendance")}>Attendance</button><button className={active === "roster" ? "on" : ""} onClick={() => setTab("roster")}>Roster</button></div>
        {isClassDay && active === "roster" && <span className="small muted">Class meets today. Attendance is one tab over.</span>}
      </div>
      {active === "attendance" ? <AttendancePage /> : <Roster d={d} reload={reload} />}
    </div>
  );
}

// ---------- Overview: KPIs, top performers, needs attention, grading queue ----------
function Overview({ d }: { d: Data }) {
  const stats = useMemo(() => computeStats(d.profiles, d.progress, d.subs, d.grades, d.releases, d.attendance), [d]);
  const top = [...stats].filter(s => s.openSessions > 0).sort((a, b) => b.composite - a.composite).slice(0, 5);
  const struggling = stats.filter(s => s.flags.length).sort((a, b) => b.flags.length - a.flags.length || a.composite - b.composite);
  const ungraded = d.subs.filter(s => !d.grades.some(g => g.student_id === s.student_id && g.session_id === s.session_id && g.score != null));
  const ungradedPairs = new Set(ungraded.map(s => `${s.student_id}|${s.session_id}`)).size;
  const classLab = stats.length ? Math.round(stats.reduce((a, s) => a + s.labAvg, 0) / stats.length) : 0;
  const qs = stats.map(s => s.quizAvg).filter((q): q is number => q != null);
  const classQuiz = qs.length ? Math.round(qs.reduce((a, b) => a + b, 0) / qs.length) : null;
  const active7 = stats.filter(s => s.daysSinceActive != null && s.daysSinceActive < 7).length;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="kpis">
        <div className="kpi"><span className="eyebrow">Class lab completion</span><div className="v">{classLab}%</div><div className="small muted">average across open sessions</div></div>
        <div className="kpi"><span className="eyebrow">Class quiz average</span><div className="v">{classQuiz == null ? "—" : classQuiz + "%"}</div><div className="small muted">best score per student per session</div></div>
        <div className="kpi"><span className="eyebrow">Active this week</span><div className="v">{active7}<span className="muted" style={{ fontSize: "1rem" }}> / {stats.length}</span></div><div className="small muted">students with activity in 7 days</div></div>
        <div className="kpi"><span className="eyebrow">Content verified</span><div className="v">{d.content.filter(c => c.content.verified).length}<span className="muted" style={{ fontSize: "1rem" }}> / {d.content.length}</span></div><div className="small muted">imported sessions carrying a build-time verification stamp</div></div>
        <div className="kpi"><span className="eyebrow">Waiting for grading</span><div className="v">{ungradedPairs}</div><div className="small muted">submitted labs without a score</div></div>
      </div>
      <div className="insights">
        <div className="card"><div className="row between"><h3>Top performers</h3><span className="pill good">Composite score</span></div>
          <p className="small muted" style={{ margin: "4px 0 8px" }}>Labs 40%, quizzes 30%, graded work 30%.</p>
          {top.map((s, i) => <PersonRow key={s.profile.id} s={s} right={<b className="mono">{s.composite}</b>} rank={i + 1} />)}
          {!top.length && <div className="empty small">No activity yet.</div>}
        </div>
        <div className="card"><div className="row between"><h3>May be struggling</h3><span className="pill bad">{struggling.length} flagged</span></div>
          <p className="small muted" style={{ margin: "4px 0 8px" }}>Flagged on low lab completion, quiz average under 60%, graded work under 70, or a week of inactivity.</p>
          {struggling.map(s => <PersonRow key={s.profile.id} s={s} right={<div className="stack" style={{ gap: 3, alignItems: "flex-end" }}>{s.flags.map(f => <span key={f} className="pill warn">{f}</span>)}</div>} />)}
          {!struggling.length && <div className="empty small">Nobody flagged. Nice.</div>}
        </div>
        <OHCard />
        <div className="card"><div className="row between"><h3>Grading queue</h3><NavLink to="/instructor?status=submitted#grid" className="small">Open in grid ↓</NavLink></div>
          <p className="small muted" style={{ margin: "4px 0 8px" }}>Most recent submissions without a score.</p>
          {[...ungraded].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8).map(s => { const p = d.profiles.find(x => x.id === s.student_id); const se = SESSIONS.find(x => x.id === s.session_id)!; return (
            <div className="person" key={s.id}><div className="avatar">{initials(p?.full_name || "?")}</div><div style={{ minWidth: 0 }}><b>{p?.full_name}</b><div className="small muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>W{se.week} D{se.day} · {se.title}</div></div><span className="small muted">{fmtDate(s.created_at)}</span></div>); })}
          {!ungraded.length && <div className="empty small">All caught up.</div>}
        </div>
      </div>
    </div>
  );
}
function PersonRow({ s, right, rank }: { s: StudentStat; right: React.ReactNode; rank?: number }) {
  return (
    <div className="person"><div className="avatar">{rank ?? initials(s.profile.full_name)}</div>
      <div style={{ minWidth: 0 }}><b>{s.profile.full_name}</b><div className="small muted">Labs {s.labAvg}% · Quiz {s.quizAvg == null ? "—" : s.quizAvg + "%"} · Graded {s.gradeAvg ?? "—"} · Last active {fmtDate(s.lastActive)}</div></div>
      {right}</div>
  );
}

// ---------- Grid: grouped by week and day, filterable, with grading drawer ----------
type Cell = { student: Profile; session: Session; p?: Progress; subs: Submission[]; g?: Grade; state: SessionState };
function Grid({ d, reload }: { d: Data; reload: () => Promise<void> }) {
  const params = new URLSearchParams(window.location.search);
  const [q, setQ] = useState("");
  const [week, setWeek] = useState<string>("open");
  const [status, setStatus] = useState<string>(params.get("status") || "any");
  const [quiz, setQuiz] = useState<string>("any");
  const [flag, setFlag] = useState<string>("any");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [sel, setSel] = useState<Cell | null>(null);
  const stats = useMemo(() => computeStats(d.profiles, d.progress, d.subs, d.grades, d.releases, d.attendance), [d]);
  const students = d.profiles.filter(p => p.role === "student");
  const openWeeks = WEEKS.filter(w => SESSIONS.some(s => s.week === w.n && d.releases.some(r => r.session_id === s.id)));
  const weeks = week === "open" ? openWeeks : week === "all" ? WEEKS : WEEKS.filter(w => w.n === +week);
  const cellOf = (st: Profile, s: Session): Cell => { const p = d.progress.find(x => x.student_id === st.id && x.session_id === s.id); const subs = d.subs.filter(x => x.student_id === st.id && x.session_id === s.id); const g = d.grades.find(x => x.student_id === st.id && x.session_id === s.id); return { student: st, session: s, p, subs, g, state: sessionState(s, p, subs, g, isUnlocked(s.id, st.id, d.releases)) }; };
  const rows = students.filter(st => {
    if (q && !st.full_name.toLowerCase().includes(q.toLowerCase()) && !st.email.toLowerCase().includes(q.toLowerCase())) return false;
    const stat = stats.find(x => x.profile.id === st.id)!;
    if (flag === "struggling" && !stat.flags.length) return false;
    if (flag === "top" && stat.composite < 80) return false;
    if (quiz !== "any") { const v = stat.quizAvg; if (quiz === "low" && !(v != null && v < 60)) return false; if (quiz === "high" && !(v != null && v >= 80)) return false; if (quiz === "none" && v != null) return false; }
    if (status !== "any") { const cells = weeks.flatMap(w => SESSIONS.filter(s => s.week === w.n).map(s => cellOf(st, s))); if (!cells.some(c => c.state === status)) return false; }
    return true;
  });
  const exportCSV = () => {
    const sess = weeks.flatMap(w => SESSIONS.filter(s => s.week === w.n));
    const head = ["Student", "Email", "Composite", "Lab avg %", "Quiz avg %", "Graded avg", ...sess.flatMap(s => [`${s.id} lab %`, `${s.id} quiz best`, `${s.id} submitted`, `${s.id} score`, `${s.id} feedback`])];
    const body = rows.map(st => { const stat = stats.find(x => x.profile.id === st.id)!; return [st.full_name, st.email, stat.composite, stat.labAvg, stat.quizAvg ?? "", stat.gradeAvg ?? "", ...sess.flatMap(s => { const c = cellOf(st, s); return [labPct(s, c.p), c.p?.quiz_best ?? "", c.subs.length, c.g?.score ?? "", c.g?.feedback ?? ""]; })]; });
    download(`lab-portal-grades-${new Date().toISOString().slice(0, 10)}.csv`, toCSV([head, ...body]));
  };
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="card"><div className="filters">
        <label>Search<input id="f-q" placeholder="Name or email" value={q} onChange={e => setQ(e.target.value)} /></label>
        <label>Weeks<select id="f-week" value={week} onChange={e => setWeek(e.target.value)}><option value="open">Open weeks</option><option value="all">All 20 weeks</option>{WEEKS.map(w => <option key={w.n} value={w.n}>Week {w.n}</option>)}</select></label>
        <label>Status<select id="f-status" value={status} onChange={e => setStatus(e.target.value)}><option value="any">Any</option>{(Object.keys(STATE_LABEL) as SessionState[]).map(k => <option key={k} value={k}>{STATE_LABEL[k]}</option>)}</select></label>
        <label>Quiz average<select id="f-quiz" value={quiz} onChange={e => setQuiz(e.target.value)}><option value="any">Any</option><option value="low">Below 60%</option><option value="high">80% and up</option><option value="none">No quizzes yet</option></select></label>
        <label>Performance<select id="f-flag" value={flag} onChange={e => setFlag(e.target.value)}><option value="any">Everyone</option><option value="top">Top (80+)</option><option value="struggling">Flagged</option></select></label>
        <label>&nbsp;<button className="btn ghost" onClick={exportCSV}>Export CSV</button></label>
      </div></div>
      <div className="card" style={{ padding: 0 }}><div className="grid-wrap" style={{ maxHeight: "70vh" }}>
        <table className="grid">
          <thead>
            <tr><th className="sticky" rowSpan={2}>Student</th><th rowSpan={2}>Composite</th>
              {weeks.map(w => <th key={w.n} className="grp" colSpan={collapsed.has(w.n) ? 1 : 3}><button className="btn ghost xs" onClick={() => setCollapsed(c => { const n = new Set(c); n.has(w.n) ? n.delete(w.n) : n.add(w.n); return n; })} title={w.theme}>{collapsed.has(w.n) ? "▸" : "▾"} Week {w.n}</button></th>)}</tr>
            <tr>{weeks.map(w => collapsed.has(w.n) ? <th key={w.n} className="day-cell">Avg</th> : [1, 2, 3].map(dn => <th key={`${w.n}-${dn}`} className={dn === 1 ? "day-cell" : ""} title={SESSIONS.find(s => s.week === w.n && s.day === dn)?.title}>Day {dn}</th>))}</tr>
          </thead>
          <tbody>
            {rows.map(st => { const stat = stats.find(x => x.profile.id === st.id)!; return (
              <tr key={st.id}>
                <td className="sticky"><div className="row" style={{ gap: 8 }}><span className="avatar" style={{ width: 26, height: 26, fontSize: ".7rem" }}>{initials(st.full_name)}</span><div><b>{st.full_name}</b>{stat.flags.length > 0 && <span className="pill bad" style={{ marginLeft: 6 }}>{stat.flags.length}</span>}<div className="small muted">Last active {fmtDate(stat.lastActive)}</div></div></div></td>
                <td><b className="mono">{stat.composite}</b></td>
                {weeks.map(w => collapsed.has(w.n)
                  ? <td key={w.n} className="day-cell mono">{Math.round(SESSIONS.filter(s => s.week === w.n).reduce((a, s) => a + labPct(s, cellOf(st, s).p), 0) / 3)}%</td>
                  : SESSIONS.filter(s => s.week === w.n).map((s, i) => { const c = cellOf(st, s); return (
                    <td key={s.id} className={i === 0 ? "day-cell" : ""}>
                      <button className={`cell ${c.state === "locked" ? "locked" : c.state === "submitted" ? "submitted" : c.state === "graded" ? "graded" : c.state === "in_progress" || c.state === "complete" ? "inprog" : ""}`} onClick={() => setSel(c)} title={`${s.title}\n${STATE_LABEL[c.state]}`}>
                        {c.state === "locked" ? "🔒" : c.state === "graded" ? `${c.g!.score}` : c.state === "submitted" ? "Review" : c.state === "not_started" ? "·" : `${labPct(s, c.p)}%`}
                        {c.p?.quiz_best != null && c.state !== "locked" && <span className="muted" style={{ fontWeight: 500 }}>q{c.p.quiz_best}</span>}
                      </button>
                    </td>); }))}
              </tr>); })}
            {!rows.length && <tr><td colSpan={99} className="empty">No students match these filters.</td></tr>}
          </tbody>
        </table>
      </div></div>
      <div className="row small muted"><span className="cell locked">🔒</span> locked <span className="cell">·</span> not started <span className="cell inprog">40%</span> lab progress, q = quiz best <span className="cell submitted">Review</span> submitted, needs grading <span className="cell graded">88</span> graded</div>
      {sel && <GradeDrawer cell={sel} onClose={() => setSel(null)} onSaved={async () => { await reload(); setSel(null); }} />}
    </div>
  );
}

function GradeDrawer({ cell, onClose, onSaved }: { cell: Cell; onClose: () => void; onSaved: () => Promise<void> }) {
  const { toast } = useAuth();
  const [score, setScore] = useState<string>(cell.g?.score != null ? String(cell.g.score) : "");
  const [fb, setFb] = useState(cell.g?.feedback || "");
  const [busy, setBusy] = useState(false);
  const s = cell.session;
  const save = async () => { setBusy(true); await store.saveGrade({ student_id: cell.student.id, session_id: s.id, score: score === "" ? null : Math.max(0, Math.min(100, +score)), feedback: fb }); toast("Grade saved"); await onSaved(); };
  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Grade submission">
        <div className="row between"><div><span className="eyebrow">Week {s.week} · Day {s.day}</span><h3>{cell.student.full_name}</h3><div className="small muted">{s.title}</div></div><button className="btn ghost sm" onClick={onClose}>Close</button></div>
        <div className="row"><span className={`pill ${cell.state === "graded" ? "good" : cell.state === "submitted" ? "warn" : "acc"}`}>{STATE_LABEL[cell.state]}</span><span className="pill">Lab {labPct(s, cell.p)}%</span>{cell.p?.quiz_best != null && <span className={`pill ${cell.p.quiz_best >= 4 ? "good" : "warn"}`}>Quiz {cell.p.quiz_best}/5 · {cell.p.quiz_attempts} attempt{cell.p.quiz_attempts === 1 ? "" : "s"}</span>}</div>
        {cell.p?.goal && <div><span className="eyebrow">Student's goal</span><p>{cell.p.goal}</p></div>}
        {s.steps && <div><span className="eyebrow">Steps and checkpoint answers</span><div className="stack" style={{ gap: 8, marginTop: 6 }}>{s.steps.map((st, i) => { const r = (cell.p?.responses || {})[String(i)]; return (<div key={i} className="small" style={{ display: "grid", gridTemplateColumns: "16px minmax(0,1fr)", gap: 8 }}><span style={{ color: cell.p?.steps?.[i] ? "var(--good)" : "var(--mute)" }}>{cell.p?.steps?.[i] ? "✓" : "○"}</span><div><b>{st.label}</b>{r !== undefined && st.checkpoint && <div className="muted" style={{ whiteSpace: "pre-wrap", marginTop: 2 }}>{st.checkpoint.kind === "choice" ? `Picked: ${st.checkpoint.options[r as number]}${r === st.checkpoint.correct ? " ✓" : ""}` : st.checkpoint.kind === "confirm" ? (r ? "Confirmed" : "") : String(r)}</div>}</div></div>); })}</div></div>}
        {cell.p?.sandbox && <div className="callout small">Sandbox: {String((cell.p.sandbox as Record<string, unknown>).train)}% on training data, {String((cell.p.sandbox as Record<string, unknown>).test)}% on test data.</div>}
        <div><span className="eyebrow">Submissions ({cell.subs.length})</span>
          <div className="stack" style={{ gap: 8, marginTop: 6 }}>{cell.subs.map(x => (
            <div className="sub" key={x.id}><div style={{ minWidth: 0 }}>
              {x.kind === "image" ? (x.url ? <a href={x.url} target="_blank" rel="noreferrer"><img src={x.url} alt="Submitted screenshot" style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 6 }} /></a> : <span className="muted">Screenshot (open to view)</span>) : x.kind === "link" ? <a href={x.body!} target="_blank" rel="noreferrer" style={{ wordBreak: "break-all" }}>{x.body}</a> : <span style={{ whiteSpace: "pre-wrap" }}>{x.body}</span>}
              <div className="small muted">{new Date(x.created_at).toLocaleString()}</div></div></div>))}
            {!cell.subs.length && <div className="small muted">Nothing submitted yet.</div>}</div></div>
        <div className="stack" style={{ gap: 8 }}>
          <label className="stack" style={{ gap: 4 }}><span className="eyebrow">Score (0 to 100)</span><input id="g-score" type="number" min={0} max={100} value={score} onChange={e => setScore(e.target.value)} placeholder="Leave blank to keep ungraded" /></label>
          <label className="stack" style={{ gap: 4 }}><span className="eyebrow">Feedback to the student</span><textarea id="g-fb" value={fb} onChange={e => setFb(e.target.value)} placeholder="One or two specific sentences. What worked, what to try next time." /></label>
          <div className="row"><button className="btn" onClick={save} disabled={busy}>Save grade</button>{cell.g?.score != null && <button className="btn ghost" onClick={() => { setScore(""); }}>Clear score</button>}</div>
        </div>
      </aside>
    </>
  );
}

// ---------- Release panel ----------
function OHCard() {
  const [reqs, setReqs] = useState<OHRequest[]>([]);
  useEffect(() => { store.ohRequests().then(setReqs); }, []);
  const pending = reqs.filter(r => r.status === "pending" || r.status === "proposed");
  return (
    <div className="card"><div className="row between"><h3>Office hours</h3><NavLink to="/calendar?tab=office" className="small">Open office hours</NavLink></div>
      {pending.length ? <div className="stack" style={{ gap: 6, marginTop: 8 }}>{pending.slice(0, 5).map(r => <div key={r.id} className="row between small" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.requested_at.slice(5, 10).replace("-", "/")} {r.requested_at.slice(11, 16)} · {r.topic}</span><span className={`pill ${r.status === "pending" ? "warn" : ""}`}>{r.status === "pending" ? "needs reply" : "awaiting student"}</span></div>)}</div>
        : <div className="small muted" style={{ marginTop: 8 }}>No requests waiting.</div>}
    </div>
  );
}

function Roster({ d, reload }: { d: Data; reload: () => Promise<void> }) {
  const { toast } = useAuth();
  const [rows, setRows] = useState<{ email: string; full_name: string | null; role: "student" | "instructor" }[]>([]);
  const blank = () => ({ name: "", email: "" });
  const [draft, setDraft] = useState([blank(), blank(), blank()]);
  const [bulk, setBulk] = useState(false);
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => setRows(await store.roster()), []);
  useEffect(() => { load(); }, [load]);
  const validEmail = (e: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(e.trim());
  const existing = new Set(rows.map(r => r.email));
  const filled = draft.filter(r => r.name.trim() || r.email.trim());
  const problems = filled.map((r, i) => !r.email.trim() ? `Row ${i + 1}: email is missing` : !validEmail(r.email) ? `Row ${i + 1}: "${r.email}" doesn't look like an email` : existing.has(r.email.trim().toLowerCase()) ? `Row ${i + 1}: ${r.email.trim().toLowerCase()} is already on the roster` : null).filter((x): x is string => !!x);
  const dupes = filled.map(r => r.email.trim().toLowerCase()).filter((e, i, a) => e && a.indexOf(e) !== i);
  if (dupes.length) problems.push(`Entered twice: ${[...new Set(dupes)].join(", ")}`);
  const set = (i: number, k: "name" | "email", v: string) => setDraft(ds => ds.map((r, j) => j === i ? { ...r, [k]: v } : r));
  const submit = async (list: { email: string; full_name: string | undefined }[]) => {
    setBusy(true);
    try { await store.addToRoster(list); await load(); await reload(); toast(`${list.length} student${list.length === 1 ? "" : "s"} added`); }
    catch (e) { toast("Couldn't add: " + (e as Error).message); }
    finally { setBusy(false); }
  };
  const addRows = async () => { if (!filled.length || problems.length) return; await submit(filled.map(r => ({ email: r.email.trim().toLowerCase(), full_name: r.name.trim() || undefined }))); setDraft([blank(), blank(), blank()]); };
  const addPaste = async () => {
    const parsed = paste.split(/\n|;/).map(l => l.trim()).filter(Boolean).map(l => { const m = l.match(/^(.*?)[\s,<]*([^\s<>,]+@[^\s<>,]+)>?$/); return m ? { email: m[2].toLowerCase(), full_name: m[1].trim().replace(/["',]/g, "") || undefined } : null; }).filter((x): x is { email: string; full_name: string | undefined } => !!x && validEmail(x.email) && !existing.has(x.email));
    if (!parsed.length) return toast("Nothing new to add. One student per line: Jane Doe jane@example.com");
    await submit(parsed); setPaste(""); setBulk(false);
  };
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="card stack" style={{ gap: 12 }}>
        <div className="row between"><div><h3>Add students</h3><p className="small muted" style={{ marginTop: 2 }}>Only emails on the roster can sign in. Students get a magic link by email; no passwords.</p></div>
          <button className="btn ghost xs" onClick={() => setBulk(b => !b)}>{bulk ? "Enter one by one" : "Paste a list instead"}</button></div>
        {!bulk ? <>
          <div className="roster-form">
            <div className="eyebrow">Name</div><div className="eyebrow">Email</div><div />
            {draft.map((r, i) => { const bad = r.email.trim() && !validEmail(r.email); return (
              <Fragment key={i}>
                <input id={`rn-${i}`} value={r.name} placeholder="Jane Doe" autoComplete="off" onChange={e => set(i, "name", e.target.value)} />
                <input id={`re-${i}`} type="email" value={r.email} placeholder="jane@example.com" autoComplete="off" style={bad ? { borderColor: "var(--bad)" } : undefined} onChange={e => set(i, "email", e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (i === draft.length - 1) setDraft(ds => [...ds, blank()]); const n = document.getElementById(`rn-${i + 1}`); n?.focus(); } }} />
                <button className="btn ghost xs" title="Remove row" disabled={draft.length === 1} onClick={() => setDraft(ds => ds.filter((_, j) => j !== i))}>✕</button>
              </Fragment>); })}
          </div>
          {problems.length > 0 && <div className="tip-box small">{problems.map((p, i) => <div key={i}>{p}</div>)}</div>}
          <div className="row between">
            <button className="btn ghost sm" onClick={() => setDraft(ds => [...ds, blank()])}>+ Add another row</button>
            <button className="btn" disabled={busy || !filled.length || problems.length > 0} onClick={addRows}>{busy ? "Adding…" : `Add ${filled.length || ""} to roster`}</button>
          </div>
        </> : <>
          <p className="small muted">One student per line, name first then email, or just the email. Pasting a two-column spreadsheet selection works.</p>
          <textarea id="roster-paste" value={paste} onChange={e => setPaste(e.target.value)} placeholder={"Jane Doe\tjane@example.com\nsam@example.com"} style={{ minHeight: 120, fontFamily: "var(--mono)", fontSize: ".85rem" }} />
          <div><button className="btn" disabled={busy || !paste.trim()} onClick={addPaste}>{busy ? "Adding…" : "Add to roster"}</button></div>
        </>}
      </div>
      <div className="card"><h3>Roster ({rows.length})</h3>
        <div className="grid-wrap"><table className="grid" style={{ marginTop: 8 }}><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Signed in</th><th>Absences</th><th></th></tr></thead><tbody>
          {rows.map(r => { const prof = d.profiles.find(p => p.email.toLowerCase() === r.email); return (
            <tr key={r.email}><td>{r.full_name || prof?.full_name || <span className="muted">—</span>}</td><td className="mono small">{r.email}</td>
              <td>{prof ? <select style={{ width: "auto", padding: "3px 6px" }} value={prof.role} onChange={async e => { await store.setRole(prof.id, e.target.value as "student" | "instructor"); await reload(); toast("Role updated"); }}><option value="student">Student</option><option value="instructor">Instructor</option></select> : <span className="pill">{r.role}</span>}</td>
              <td>{prof ? <span className="pill good">Yes</span> : <span className="pill">Not yet</span>}</td>
              <td>{(() => { const n = prof ? d.attendance.filter(a => a.student_id === prof.id && a.status === "absent").length : 0; return n ? <span className={`pill ${n >= 2 ? "bad" : "warn"}`}>{n}</span> : <span className="muted">0</span>; })()}</td>
              <td><button className="btn ghost xs" onClick={async () => { await store.removeFromRoster(r.email); await load(); toast("Removed"); }}>Remove</button></td></tr>); })}
        </tbody></table></div></div>
    </div>
  );
}
