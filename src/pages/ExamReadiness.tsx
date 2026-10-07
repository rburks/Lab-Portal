// Instructor view of AWS exam readiness, built from students' saved mock attempts and flashcard reviews.
// Per student: latest and best estimated score, trend, mocks taken, weakest objectives.
// Class-wide: accuracy by domain per student (heatmap), and the objectives the class misses most.
import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { OBJECTIVES, SESSIONS } from "../content/course";
import { store, type FlashcardRow, type MockAttempt, type Profile } from "../lib/store";
import { initials } from "../lib/logic";

const PASS = OBJECTIVES.exam.pass;
const dom = (id: string) => Number(id.split(".")[0]);
const objText = (id: string) => OBJECTIVES.objectives.find(o => o.id === id)?.text ?? id;
// Prefer the earliest built session whose exam block covers the objective; fall back to the master list.
const firstSession = (id: string) => SESSIONS.find(s => s.built && s.exam?.objectives.includes(id)) || SESSIONS.find(s => s.id === OBJECTIVES.objectives.find(o => o.id === id)?.first);

type Row = { p: Profile; mocks: MockAttempt[]; latest?: MockAttempt; best?: number; trend: number | null; byDomain: Record<number, { c: number; t: number }>; weak: { obj: string; miss: number; total: number }[]; mastered: number; status: "ready" | "close" | "not_yet" | "none" };

export default function ExamReadiness({ profiles }: { profiles: Profile[] }) {
  const [mocks, setMocks] = useState<MockAttempt[] | null>(null);
  const [cards, setCards] = useState<FlashcardRow[]>([]);
  const [sort, setSort] = useState<"risk" | "name" | "score">("risk");
  useEffect(() => { (async () => { const [m, f] = await Promise.all([store.allMocks(), store.allFlashcards()]); setMocks(m); setCards(f); })(); }, []);
  const students = profiles.filter(p => p.role === "student");

  const rows: Row[] = useMemo(() => students.map(p => {
    const ms = (mocks || []).filter(m => m.student_id === p.id).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    const latest = ms[0];
    const best = ms.length ? Math.max(...ms.map(m => m.scaled)) : undefined;
    const trend = ms.length >= 2 ? ms[0].scaled - ms[1].scaled : null;
    const byDomain: Row["byDomain"] = {};
    const perObj = new Map<string, { miss: number; total: number }>();
    ms.forEach(m => m.answers.forEach(a => {
      const d = dom(a.obj); byDomain[d] = byDomain[d] || { c: 0, t: 0 }; byDomain[d].t++; if (a.correct) byDomain[d].c++;
      const o = perObj.get(a.obj) || { miss: 0, total: 0 }; o.total++; if (!a.correct) o.miss++; perObj.set(a.obj, o);
    }));
    const weak = [...perObj.entries()].map(([obj, v]) => ({ obj, ...v })).filter(x => x.miss > 0).sort((a, b) => b.miss / b.total - a.miss / a.total || b.miss - a.miss).slice(0, 3);
    const mastered = cards.filter(c => c.student_id === p.id && (c.streak ?? 0) >= 2).length;
    const status: Row["status"] = !latest ? "none" : latest.scaled >= PASS + 50 ? "ready" : latest.scaled >= PASS ? "close" : "not_yet";
    return { p, mocks: ms, latest, best, trend, byDomain, weak, mastered, status };
  }), [students, mocks, cards]);

  if (!mocks) return <div className="empty">Loading mock results…</div>;
  const order = { not_yet: 0, none: 1, close: 2, ready: 3 };
  const sorted = [...rows].sort((a, b) => sort === "name" ? a.p.full_name.localeCompare(b.p.full_name) : sort === "score" ? (b.latest?.scaled ?? 0) - (a.latest?.scaled ?? 0) : order[a.status] - order[b.status] || (a.latest?.scaled ?? 0) - (b.latest?.scaled ?? 0));
  const tried = rows.filter(r => r.latest);
  const avg = tried.length ? Math.round(tried.reduce((a, r) => a + r.latest!.scaled, 0) / tried.length) : null;
  const counts = { ready: rows.filter(r => r.status === "ready").length, close: rows.filter(r => r.status === "close").length, not_yet: rows.filter(r => r.status === "not_yet").length, none: rows.filter(r => r.status === "none").length };

  // Class-wide misses by objective.
  const classObj = new Map<string, { miss: number; total: number; students: Set<string> }>();
  (mocks || []).forEach(m => m.answers.forEach(a => { const o = classObj.get(a.obj) || { miss: 0, total: 0, students: new Set<string>() }; o.total++; if (!a.correct) { o.miss++; o.students.add(m.student_id || ""); } classObj.set(a.obj, o); }));
  const classWeak = [...classObj.entries()].filter(([, v]) => v.total >= 3).map(([obj, v]) => ({ obj, rate: v.miss / v.total, n: v.students.size, total: v.total })).sort((a, b) => b.rate - a.rate).slice(0, 6);
  const domainsSeen = [...new Set((mocks || []).flatMap(m => m.answers.map(a => dom(a.obj))))].sort();

  const cell = (v?: { c: number; t: number }) => { if (!v || !v.t) return <td className="muted small" style={{ textAlign: "center" }}>·</td>; const pct = Math.round(100 * v.c / v.t); const bg = pct >= 80 ? "var(--good-soft)" : pct >= 65 ? "var(--warn-soft)" : "var(--bad-soft)"; const fg = pct >= 80 ? "var(--good)" : pct >= 65 ? "var(--warn)" : "var(--bad)"; return <td style={{ textAlign: "center", background: bg, color: fg, fontWeight: 600 }} className="mono small" title={`${v.c} of ${v.t} right`}>{pct}%</td>; };

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="kpis">
        <div className="kpi"><span className="eyebrow">Class average, latest mock</span><div className="v" style={{ color: avg != null ? (avg >= PASS ? "var(--good)" : "var(--warn)") : undefined }}>{avg ?? "—"}</div><div className="small muted">estimated scaled score · {PASS} passes</div></div>
        <div className="kpi"><span className="eyebrow">Ready</span><div className="v" style={{ color: "var(--good)" }}>{counts.ready}</div><div className="small muted">latest mock {PASS + 50} or higher</div></div>
        <div className="kpi"><span className="eyebrow">Close</span><div className="v" style={{ color: "var(--warn)" }}>{counts.close}</div><div className="small muted">{PASS} to {PASS + 49}: passing, no margin</div></div>
        <div className="kpi"><span className="eyebrow">Not yet</span><div className="v" style={{ color: "var(--bad)" }}>{counts.not_yet}</div><div className="small muted">under {PASS} on the latest mock</div></div>
        <div className="kpi"><span className="eyebrow">No mock yet</span><div className="v">{counts.none}</div><div className="small muted">nudge them toward the Exam guide</div></div>
      </div>
      <div className="callout small">Scores are the portal's straight-line estimate from practice questions on covered objectives only, so early in the course they read high. Watch the trend and the weak objectives more than the number. "Ready" leaves a 50-point margin over the pass mark.</div>

      {classWeak.length > 0 && <div className="card">
        <div className="row between"><h3>What the class misses most</h3><span className="small muted">objectives answered at least 3 times across all mocks</span></div>
        <div className="stack" style={{ gap: 6, marginTop: 10 }}>{classWeak.map(w => { const s = firstSession(w.obj); return (
          <div key={w.obj} className="row between" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)", gap: 10 }}>
            <div style={{ minWidth: 0 }}><b className="mono" style={{ color: "var(--accent)" }}>{w.obj}</b> <span className="small">{objText(w.obj)}</span></div>
            <div className="row" style={{ gap: 6, flexShrink: 0 }}><span className={`pill ${w.rate >= 0.4 ? "bad" : "warn"}`}>{Math.round(100 * w.rate)}% missed</span><span className="pill">{w.n} student{w.n === 1 ? "" : "s"}</span>{s && <Link to={`/session/${s.id}`} className="pill acc" style={{ textDecoration: "none" }}>Reteach: W{s.week} D{s.day}</Link>}</div>
          </div>); })}</div>
      </div>}

      <div className="card">
        <div className="row between"><h3>By student</h3><div className="chips"><button className={sort === "risk" ? "on" : ""} onClick={() => setSort("risk")}>Needs help first</button><button className={sort === "score" ? "on" : ""} onClick={() => setSort("score")}>Highest score</button><button className={sort === "name" ? "on" : ""} onClick={() => setSort("name")}>Name</button></div></div>
        <div className="grid-wrap" style={{ marginTop: 10 }}><table className="grid"><thead><tr><th>Student</th><th>Status</th><th>Latest</th><th>Best</th><th>Trend</th><th>Mocks</th>{domainsSeen.map(d => <th key={d} style={{ textAlign: "center" }} title={OBJECTIVES.domains[d - 1]?.name}>D{d}</th>)}<th>Weakest objectives</th><th>Cards mastered</th></tr></thead><tbody>
          {sorted.map(r => (
            <tr key={r.p.id}>
              <td><div className="row" style={{ gap: 8 }}><span className="avatar" style={{ width: 26, height: 26, fontSize: ".7rem" }}>{initials(r.p.full_name)}</span><span>{r.p.full_name}</span></div></td>
              <td>{r.status === "ready" ? <span className="pill good">Ready</span> : r.status === "close" ? <span className="pill warn">Close</span> : r.status === "not_yet" ? <span className="pill bad">Not yet</span> : <span className="pill">No mock</span>}</td>
              <td className="mono"><b>{r.latest?.scaled ?? "—"}</b>{r.latest && <span className="muted small"> · {r.latest.correct}/{r.latest.total}</span>}</td>
              <td className="mono">{r.best ?? "—"}</td>
              <td className="mono small">{r.trend == null ? <span className="muted">—</span> : r.trend > 0 ? <span style={{ color: "var(--good)" }}>▲ {r.trend}</span> : r.trend < 0 ? <span style={{ color: "var(--bad)" }}>▼ {-r.trend}</span> : <span className="muted">flat</span>}</td>
              <td className="mono">{r.mocks.length}</td>
              {domainsSeen.map(d => <Fragment key={d}>{cell(r.byDomain[d])}</Fragment>)}
              <td style={{ whiteSpace: "normal", minWidth: 200 }}>{r.weak.length ? <div className="row" style={{ gap: 4 }}>{r.weak.map(w => <span key={w.obj} className="pill warn mono" title={objText(w.obj)}>{w.obj} · {w.miss}/{w.total}</span>)}</div> : <span className="muted small">{r.latest ? "nothing missed" : "—"}</span>}</td>
              <td className="mono">{r.mastered}</td>
            </tr>))}
        </tbody></table></div>
        <p className="small muted" style={{ marginTop: 8 }}>Domain cells show accuracy across all of that student's mocks: green 80% and up, amber 65 to 79%, red under 65%. Hover a weak objective for its full text.</p>
      </div>
    </div>
  );
}
