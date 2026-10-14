import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { SESSIONS, type Session } from "../content/course";
import { useAuth } from "../auth";
import { store, type Attendance, type ContentRow, type Grade, type Profile, type Progress, type Release, type Submission } from "../lib/store";
import type { OHRequest } from "../lib/store";
import { ContentPage, AttendancePage } from "./ContentPage";
import { buildSchedule, iso } from "../lib/schedule";
import { draftFeedback, scoreFrom } from "../lib/feedback";
import ExamReadiness from "./ExamReadiness";
import { InstructorCapstone } from "./Capstone";
import Showcase from "./Showcase";
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
        <ClassProgress d={d} reload={reload} />
      </div>
    </div>
  );
}

// ---------- Class: attendance and roster on one page ----------
type ClassTab = "attendance" | "roster" | "exam" | "capstone" | "showcase";
const CLASS_TABS: [ClassTab, string][] = [["attendance", "Attendance"], ["roster", "Roster"], ["exam", "Exam readiness"], ["capstone", "Capstone"], ["showcase", "Showcase"]];
function ClassPage({ d, reload }: { d: Data; reload: () => Promise<void> }) {
  const loc = useLocation();
  const [isClassDay, setIsClassDay] = useState<boolean | null>(null);
  useEffect(() => { (async () => { const [st, days] = await Promise.all([store.settings(), store.calendarDays()]); const today = iso(new Date()); setIsClassDay(buildSchedule(st, days).some(x => x.kind === "session" && x.date === today)); })(); }, []);
  const fromUrl = new URLSearchParams(loc.search).get("tab") as ClassTab | null;
  const valid = (t: string | null): t is ClassTab => !!t && CLASS_TABS.some(([k]) => k === t);
  const [tab, setTab] = useState<ClassTab | null>(valid(fromUrl) ? fromUrl : null);
  useEffect(() => { if (valid(fromUrl)) setTab(fromUrl); }, [fromUrl]);
  const active = tab ?? (isClassDay == null ? null : isClassDay ? "attendance" : "roster");
  if (!active) return <div className="empty">Loading…</div>;
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row between">
        <div className="tabs" style={{ borderBottom: 0 }}>{CLASS_TABS.map(([k, label]) => <button key={k} className={active === k ? "on" : ""} onClick={() => setTab(k)}>{label}</button>)}</div>
        {isClassDay && active !== "attendance" && <span className="small muted">Class meets today. Attendance is the first tab.</span>}
      </div>
      {active === "attendance" ? <AttendancePage /> : active === "roster" ? <Roster d={d} reload={reload} /> : active === "exam" ? <ExamReadiness profiles={d.profiles} /> : active === "capstone" ? <InstructorCapstone profiles={d.profiles} /> : <Showcase embedded />}
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
// ---------- Class progress: what to reteach (per session, per question) and who needs a nudge (heatmap) ----------
type QStat = { i: number; q: string; options: string[]; c: number; answered: number; right: number; pct: number; topWrong: { j: number; n: number } | null; missed: Profile[] };
type SStat = { s: Session; n: number; labDone: number; labAvg: number; quizTakers: number; quizAvg: number | null; qs: QStat[]; hardest: QStat | null; review: number; noPicks: number };
const pctColor = (v: number) => v >= 80 ? "var(--good)" : v >= 60 ? "var(--warn)" : "var(--bad)";
const heat = (lab: number, quiz: number | null) => quiz == null ? lab : Math.round(lab * 0.6 + quiz * 0.4); // labs and quizzes only; grading stays out

function ClassProgress({ d, reload }: { d: Data; reload: () => Promise<void> }) {
  const [openS, setOpenS] = useState<string | null>(null);
  const [sel, setSel] = useState<Cell | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"attention" | "name">("attention");
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const students = useMemo(() => d.profiles.filter(p => p.role === "student"), [d.profiles]);
  const stats = useMemo(() => computeStats(d.profiles, d.progress, d.subs, d.grades, d.releases, d.attendance), [d]);
  const sessions = useMemo(() => SESSIONS.filter(s => s.built && d.releases.some(r => r.session_id === s.id)), [d.releases]);
  const cellOf = useCallback((st: Profile, s: Session): Cell => { const p = d.progress.find(x => x.student_id === st.id && x.session_id === s.id); const subs = d.subs.filter(x => x.student_id === st.id && x.session_id === s.id); const g = d.grades.find(x => x.student_id === st.id && x.session_id === s.id); return { student: st, session: s, p, subs, g, state: sessionState(s, p, subs, g, isUnlocked(s.id, st.id, d.releases)) }; }, [d]);

  const sstats: SStat[] = useMemo(() => sessions.map(s => {
    const who = students.filter(st => isUnlocked(s.id, st.id, d.releases));
    const ps = who.map(st => ({ st, p: d.progress.find(x => x.student_id === st.id && x.session_id === s.id) }));
    const labs = ps.map(x => labPct(s, x.p));
    const takers = ps.filter(x => x.p?.quiz_best != null);
    const withPicks = ps.map(x => ({ st: x.st, picks: x.p?.quiz_first ?? x.p?.quiz_picks ?? null })).filter(x => Array.isArray(x.picks)) as { st: Profile; picks: (number | null)[] }[];
    const qs: QStat[] = (s.quiz || []).map((qq, i) => {
      const answered = withPicks.filter(x => x.picks[i] != null);
      const right = answered.filter(x => x.picks[i] === qq.c);
      const wrongCounts = new Map<number, number>(); answered.forEach(x => { const j = x.picks[i]!; if (j !== qq.c) wrongCounts.set(j, (wrongCounts.get(j) || 0) + 1); });
      const top = [...wrongCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      return { i, q: qq.q, options: qq.a, c: qq.c, answered: answered.length, right: right.length, pct: answered.length ? Math.round(100 * right.length / answered.length) : 0, topWrong: top ? { j: top[0], n: top[1] } : null, missed: answered.filter(x => x.picks[i] !== qq.c).map(x => x.st) };
    });
    const scored = qs.filter(x => x.answered > 0);
    const hardest = scored.length ? [...scored].sort((a, b) => a.pct - b.pct)[0] : null;
    return { s, n: who.length, labDone: labs.filter(v => v === 100).length, labAvg: labs.length ? Math.round(labs.reduce((a, b) => a + b, 0) / labs.length) : 0,
      quizTakers: takers.length, quizAvg: takers.length ? Math.round(100 * takers.reduce((a, x) => a + (x.p!.quiz_best || 0), 0) / (takers.length * (s.quiz?.length || 5))) : null,
      qs, hardest, review: who.filter(st => cellOf(st, s).state === "submitted").length, noPicks: takers.length - withPicks.length };
  }), [sessions, students, d, cellOf]);

  const rows = students.filter(st => !q || st.full_name.toLowerCase().includes(q.toLowerCase()) || st.email.toLowerCase().includes(q.toLowerCase()))
    .map(st => { const stat = stats.find(x => x.profile.id === st.id)!; const cells = sessions.map(s => cellOf(st, s)); const open = cells.filter(c => c.state !== "locked");
      const avg = open.length ? Math.round(open.reduce((a, c) => a + heat(labPct(c.session, c.p), c.p?.quiz_best != null ? 100 * c.p.quiz_best / (c.session.quiz?.length || 5) : null), 0) / open.length) : 0;
      return { st, stat, cells, avg }; })
    .filter(r => !onlyFlagged || r.stat.flags.length)
    .sort((a, b) => sort === "name" ? a.st.full_name.localeCompare(b.st.full_name) : (b.stat.flags.length - a.stat.flags.length) || (a.avg - b.avg));
  const flagged = stats.filter(x => x.flags.length).sort((a, b) => b.flags.length - a.flags.length);
  const openLatest = (st: Profile) => { const s = [...sessions].reverse().find(x => isUnlocked(x.id, st.id, d.releases)); if (s) setSel(cellOf(st, s)); };

  const exportCSV = () => {
    const head = ["Student", "Email", "Composite", "Lab avg %", "Quiz avg %", "Graded avg", "Flags", ...sessions.flatMap(s => [`${s.id} lab %`, `${s.id} quiz best`, `${s.id} submitted`, `${s.id} score`, `${s.id} feedback`])];
    const body = rows.map(({ st, stat }) => [st.full_name, st.email, stat.composite, stat.labAvg, stat.quizAvg ?? "", stat.gradeAvg ?? "", stat.flags.join("; "), ...sessions.flatMap(s => { const c = cellOf(st, s); return [labPct(s, c.p), c.p?.quiz_best ?? "", c.subs.length, c.g?.score ?? "", c.g?.feedback ?? ""]; })]);
    download(`class-progress-${new Date().toISOString().slice(0, 10)}.csv`, toCSV([head, ...body]));
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div>
        <div className="row between" style={{ marginBottom: 10 }}><div><h2 style={{ fontSize: "1.2rem" }}>Sessions: what to reteach</h2><p className="small muted">One row per open session. Click a row to see every quiz question, the wrong answer the class picked most, and who missed it.</p></div></div>
        <div className="card" style={{ padding: 0 }}>
          {!sstats.length && <div className="empty">No sessions are open yet. Unlock one on the Sessions page.</div>}
          {sstats.map(x => { const isOpen = openS === x.s.id; return (
            <div key={x.s.id} className={`sess-row ${isOpen ? "open" : ""}`}>
              <button className="sess-head" onClick={() => setOpenS(isOpen ? null : x.s.id)} aria-expanded={isOpen}>
                <span className="caret">{isOpen ? "▾" : "▸"}</span>
                <span className="sess-title"><span className="eyebrow">W{x.s.week} D{x.s.day}</span><b title={x.s.title}>{x.s.title}</b></span>
                <span className="sess-metric"><span className="eyebrow">Lab finished</span><span><b>{x.labDone}</b>/{x.n}</span><span className="bar"><i style={{ width: `${x.n ? 100 * x.labDone / x.n : 0}%` }} /></span></span>
                <span className="sess-metric"><span className="eyebrow">Avg quiz</span>{x.quizAvg == null ? <span className="muted">No attempts</span> : <span><b style={{ color: pctColor(x.quizAvg) }}>{x.quizAvg}%</b> <span className="muted small">{x.quizTakers} took it</span></span>}</span>
                <span className="sess-hard"><span className="eyebrow">Hardest question</span>{x.hardest ? <span><b style={{ color: pctColor(x.hardest.pct) }}>Q{x.hardest.i + 1} · {x.hardest.pct}% right</b> <span className="muted small">{x.hardest.q}</span></span> : <span className="muted small">Not enough answers yet</span>}</span>
                {x.review > 0 && <span className="pill warn" title="Submitted, waiting for a grade">{x.review} to grade</span>}
              </button>
              {isOpen && <div className="qbreak">
                {x.qs.map(qs => (
                  <div key={qs.i} className={`qrow ${qs.answered && qs.pct < 60 ? "bad" : qs.answered && qs.pct < 80 ? "mid" : ""}`}>
                    <div className="qnum">Q{qs.i + 1}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="qtext">{qs.q}</div>
                      <div className="small muted">Answer: {qs.options[qs.c]}</div>
                      {qs.topWrong && <div className="small" style={{ color: "var(--bad)" }}>Most common wrong pick: "{qs.options[qs.topWrong.j]}" ({qs.topWrong.n} student{qs.topWrong.n === 1 ? "" : "s"})</div>}
                      {qs.missed.length > 0 && <div className="row" style={{ gap: 4, marginTop: 6 }}><span className="small muted">Missed it:</span>{qs.missed.map(st => <button key={st.id} className="chip-btn" onClick={() => setSel(cellOf(st, x.s))} title="Open their work">{st.full_name}</button>)}</div>}
                    </div>
                    <div className="qpct">{qs.answered ? <><b style={{ color: pctColor(qs.pct) }}>{qs.pct}%</b><span className="small muted">{qs.right}/{qs.answered} right</span><span className="bar"><i style={{ width: `${qs.pct}%`, background: pctColor(qs.pct) }} /></span></> : <span className="small muted">No answers</span>}</div>
                  </div>))}
                <p className="small muted" style={{ margin: 0 }}>Based on each student's first try, so retakes don't hide what was confusing.{x.noPicks > 0 ? ` ${x.noPicks} student${x.noPicks === 1 ? "" : "s"} took this quiz before per-question tracking started and aren't counted here.` : ""}</p>
              </div>}
            </div>); })}
        </div>
      </div>

      <div>
        <div className="row between" style={{ marginBottom: 10 }}><div><h2 style={{ fontSize: "1.2rem" }}>Students</h2><p className="small muted">Color comes from labs and quizzes only (grading stays out). Click any cell to review or grade.</p></div></div>
        {flagged.length > 0 && <div className="card attention">
          <div className="row between"><b>Needs attention ({flagged.length})</b><button className="btn ghost xs" onClick={() => setOnlyFlagged(f => !f)}>{onlyFlagged ? "Show everyone" : "Show only these"}</button></div>
          <div className="stack" style={{ gap: 6, marginTop: 8 }}>{flagged.slice(0, 6).map(f => <div key={f.profile.id} className="row" style={{ gap: 8 }}>
            <button className="linkish" onClick={() => openLatest(f.profile)}><b>{f.profile.full_name}</b></button>{f.flags.map(fl => <span key={fl} className="pill bad">{fl}</span>)}</div>)}
            {flagged.length > 6 && <span className="small muted">and {flagged.length - 6} more below</span>}</div>
        </div>}
        <div className="card" style={{ marginTop: 10 }}><div className="filters">
          <label>Search<input id="f-q" placeholder="Name or email" value={q} onChange={e => setQ(e.target.value)} /></label>
          <label>Sort<select id="f-sort" value={sort} onChange={e => setSort(e.target.value as "attention" | "name")}><option value="attention">Needs attention first</option><option value="name">Name</option></select></label>
          <label>&nbsp;<button className="btn ghost" onClick={exportCSV}>Export CSV</button></label>
        </div></div>
        <div className="card" style={{ padding: 0, marginTop: 10 }}><div className="grid-wrap" style={{ maxHeight: "70vh" }}>
          <table className="grid heatmap">
            <thead><tr><th className="sticky">Student</th>{sessions.map(s => <th key={s.id} className="day-cell" title={s.title}>W{s.week} D{s.day}</th>)}</tr></thead>
            <tbody>
              {rows.map(({ st, stat, cells }) => (
                <tr key={st.id}>
                  <td className="sticky"><div className="row" style={{ gap: 8 }}><span className="avatar" style={{ width: 26, height: 26, fontSize: ".7rem" }}>{initials(st.full_name)}</span><div><b>{st.full_name}</b>{stat.flags.length > 0 && <span className="pill bad" style={{ marginLeft: 6 }} title={stat.flags.join("\n")}>{stat.flags.length}</span>}<div className="small muted">Last active {fmtDate(stat.lastActive)}</div></div></div></td>
                  {cells.map(c => { const lab = labPct(c.session, c.p); const qz = c.p?.quiz_best != null ? Math.round(100 * c.p.quiz_best / (c.session.quiz?.length || 5)) : null; const h = heat(lab, qz);
                    const cls = c.state === "locked" ? "locked" : c.state === "not_started" ? "none" : h >= 80 ? "good" : h >= 50 ? "mid" : "low";
                    return (
                    <td key={c.session.id} className="day-cell">
                      <button className={`hcell ${cls}`} onClick={() => setSel(c)} title={`${c.session.title}\n${STATE_LABEL[c.state]} · lab ${lab}%${qz != null ? ` · quiz ${c.p!.quiz_best}/${c.session.quiz?.length || 5}` : " · no quiz yet"}${c.g?.score != null ? ` · graded ${c.g.score}` : ""}`}>
                        {c.state === "locked" ? "🔒" : c.state === "not_started" ? "·" : <><span>{lab}%</span>{qz != null && <span className="hq">q{c.p!.quiz_best}</span>}</>}
                        {c.state === "submitted" && <span className="dot" aria-label="needs grading" />}
                        {c.state === "graded" && <span className="g">✓</span>}
                      </button>
                    </td>); })}
                </tr>))}
              {!rows.length && <tr><td colSpan={99} className="empty">No students match.</td></tr>}
            </tbody>
          </table>
        </div></div>
        <div className="row small muted" style={{ marginTop: 8, gap: 10 }}><span className="hcell good">85%</span> on track <span className="hcell mid">60%</span> partway <span className="hcell low">20%</span> behind <span className="hcell none">·</span> not started <span className="hcell locked">🔒</span> locked <span>q = best quiz score</span> <span className="row" style={{ gap: 4 }}><span className="dot" style={{ position: "static" }} /> needs grading</span> <span>✓ graded</span></div>
      </div>
      {sel && <GradeDrawer cell={sel} onClose={() => setSel(null)} onSaved={async () => { await reload(); setSel(null); }} />}
    </div>
  );
}

function GradeDrawer({ cell, onClose, onSaved }: { cell: Cell; onClose: () => void; onSaved: () => Promise<void> }) {
  const { toast } = useAuth();
  const s = cell.session;
  const rubric = s.rubric;
  const [checked, setChecked] = useState<string[]>(cell.g?.rubric ?? []);
  const [score, setScore] = useState<string>(cell.g?.score != null ? String(cell.g.score) : "");
  const [scoreTouched, setScoreTouched] = useState(cell.g?.score != null);
  const [fb, setFb] = useState(cell.g?.feedback || "");
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) => { const next = checked.includes(id) ? checked.filter(x => x !== id) : [...checked, id]; setChecked(next); if (rubric && !scoreTouched) setScore(String(scoreFrom(rubric, next))); };
  const draft = () => { if (!rubric) return; setFb(draftFeedback(rubric, checked, cell.student.full_name, (cell.p?.responses || {}) as Record<string, unknown>, s.id)); if (!scoreTouched) setScore(String(scoreFrom(rubric, checked))); };
  const save = async () => { setBusy(true); try { await store.saveGrade({ student_id: cell.student.id, session_id: s.id, score: score === "" ? null : Math.max(0, Math.min(100, +score)), feedback: fb, rubric: rubric ? checked : undefined }); toast("Grade saved"); await onSaved(); } catch (e) { toast("Couldn't save: " + (e as Error).message + (/rubric/.test((e as Error).message) ? " Run the October 7 batch 2 SQL section." : "")); } finally { setBusy(false); } };
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
        {rubric && <div className="stack" style={{ gap: 6 }}>
          <div className="row between"><span className="eyebrow">Rubric · tick what's there</span><span className="mono small">{scoreFrom(rubric, checked)} / 100</span></div>
          {rubric.items.map(it => <label key={it.id} className={`step ${checked.includes(it.id) ? "done" : ""}`} style={{ cursor: "pointer" }}><input type="checkbox" checked={checked.includes(it.id)} onChange={() => toggle(it.id)} /><span className="small"><b>{it.label}</b> <span className="muted mono">· {it.points}</span></span></label>)}
        </div>}
        <div className="stack" style={{ gap: 8 }}>
          <label className="stack" style={{ gap: 4 }}><span className="eyebrow">Score (0 to 100){rubric && !scoreTouched ? " · follows the rubric" : ""}</span><input id="g-score" type="number" min={0} max={100} value={score} onChange={e => { setScore(e.target.value); setScoreTouched(true); }} placeholder="Leave blank to keep ungraded" /></label>
          <label className="stack" style={{ gap: 4 }}><span className="row between"><span className="eyebrow">Feedback to the student</span>{rubric && <button type="button" className="btn ghost xs" onClick={draft}>Draft from rubric</button>}</span><textarea id="g-fb" rows={5} value={fb} onChange={e => setFb(e.target.value)} placeholder="One or two specific sentences. What worked, what to try next time." /></label>
          {rubric && <div className="small muted">The draft quotes the student's own checkpoint answer where it can. Edit it before saving; it's a starting point, not the final word.</div>}
          <div className="row"><button className="btn" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save grade"}</button>{cell.g?.score != null && <button className="btn ghost" onClick={() => { setScore(""); setScoreTouched(true); }}>Clear score</button>}</div>
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
  const [sending, setSending] = useState<Record<string, "sending" | "sent" | string>>({});
  const signedIn = (email: string) => d.profiles.some(p => p.email.toLowerCase() === email);
  const sendOne = async (email: string) => {
    setSending(s => ({ ...s, [email]: "sending" }));
    const r = await store.sendSignInLink(email);
    setSending(s => ({ ...s, [email]: r.error ? r.error : "sent" }));
    return r.error || null;
  };
  const notYet = rows.filter(r => r.role === "student" && !signedIn(r.email));
  const sendAll = async () => {
    if (!notYet.length || !confirm(`Email a sign-in link to ${notYet.length} student${notYet.length === 1 ? "" : "s"} who haven't signed in yet?`)) return;
    let ok = 0;
    for (const r of notYet) { if (!(await sendOne(r.email))) ok++; await new Promise(res => setTimeout(res, 1200)); } // spaced out so Supabase doesn't throttle
    toast(ok === notYet.length ? `Sign-in links sent to ${ok}` : `Sent ${ok} of ${notYet.length}. Check the red notes in the table.`);
  };
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
      <div className="card"><div className="row between"><h3>Roster ({rows.length})</h3>
          <button className="btn sm" disabled={!notYet.length || Object.values(sending).includes("sending")} onClick={sendAll} title="Emails each student a fresh sign-in link from your Gmail">{notYet.length ? `Send sign-in links to ${notYet.length} not signed in` : "Everyone has signed in"}</button></div>
        <div className="grid-wrap"><table className="grid" style={{ marginTop: 8 }}><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Signed in</th><th>Absences</th><th></th></tr></thead><tbody>
          {rows.map(r => { const prof = d.profiles.find(p => p.email.toLowerCase() === r.email); return (
            <tr key={r.email}><td>{r.full_name || prof?.full_name || <span className="muted">—</span>}</td><td className="mono small">{r.email}</td>
              <td>{prof ? <select style={{ width: "auto", padding: "3px 6px" }} value={prof.role} onChange={async e => { await store.setRole(prof.id, e.target.value as "student" | "instructor"); await reload(); toast("Role updated"); }}><option value="student">Student</option><option value="instructor">Instructor</option></select> : <span className="pill">{r.role}</span>}</td>
              <td>{prof ? <span className="pill good">Yes</span> : <span className="pill">Not yet</span>}</td>
              <td>{(() => { const n = prof ? d.attendance.filter(a => a.student_id === prof.id && a.status === "absent").length : 0; return n ? <span className={`pill ${n >= 2 ? "bad" : "warn"}`}>{n}</span> : <span className="muted">0</span>; })()}</td>
              <td><div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                {(() => { const st = sending[r.email]; return st === "sending" ? <span className="small muted">Sending…</span> : st === "sent" ? <span className="pill good" title="Ask them to use the newest email">Link sent</span> : <>
                  {st && <span className="pill bad" title={st}>Failed</span>}
                  <button className="btn ghost xs" title={st || "Email this student a sign-in link"} onClick={async () => { const err = await sendOne(r.email); toast(err ? `Couldn't send: ${err}` : `Sign-in link sent to ${r.email}`); }}>{st ? "Retry" : "Send link"}</button></>; })()}
                <button className="btn ghost xs" onClick={async () => { await store.removeFromRoster(r.email); await load(); toast("Removed"); }}>Remove</button></div></td></tr>); })}
        </tbody></table></div></div>
    </div>
  );
}
