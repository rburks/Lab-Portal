import { Link } from "react-router-dom";
import { SESSIONS, WEEKS } from "../content/course";
import { useAuth } from "../auth";
import { useStudentData } from "./useStudentData";
import { isUnlocked, labPct, sessionState, STATE_LABEL } from "../lib/logic";

export default function MyProgress() {
  const { user } = useAuth();
  const { progress, subs, grades, releases, loading } = useStudentData();
  if (loading) return <div className="empty">Loading…</div>;
  const open = SESSIONS.filter(s => isUnlocked(s.id, user!.id, releases) && s.built);
  const labAvg = open.length ? Math.round(open.reduce((a, s) => a + labPct(s, progress.find(p => p.session_id === s.id)), 0) / open.length) : 0;
  const quizzes = open.map(s => progress.find(p => p.session_id === s.id)?.quiz_best).filter((q): q is number => q != null);
  const quizAvg = quizzes.length ? Math.round(100 * quizzes.reduce((a, b) => a + b, 0) / (quizzes.length * 5)) : null;
  const gs = grades.filter(g => g.score != null);
  const gradeAvg = gs.length ? Math.round(gs.reduce((a, g) => a + (g.score || 0), 0) / gs.length) : null;
  const weeks = WEEKS.filter(w => SESSIONS.some(s => s.week === w.n && isUnlocked(s.id, user!.id, releases)));
  return (
    <>
      <div className="hero"><div><span className="eyebrow">{user!.full_name}</span><h1>My progress</h1></div></div>
      <div className="kpis" style={{ marginBottom: 18 }}>
        <div className="kpi"><span className="eyebrow">Labs complete</span><div className="v">{labAvg}%</div><div className="small muted">across {open.length} open sessions</div></div>
        <div className="kpi"><span className="eyebrow">Quiz average</span><div className="v">{quizAvg == null ? "—" : quizAvg + "%"}</div><div className="small muted">best score per session</div></div>
        <div className="kpi"><span className="eyebrow">Graded average</span><div className="v">{gradeAvg == null ? "—" : gradeAvg}</div><div className="small muted">{gs.length} graded lab{gs.length === 1 ? "" : "s"}</div></div>
        <div className="kpi"><span className="eyebrow">Submissions</span><div className="v">{new Set(subs.map(s => s.session_id)).size}</div><div className="small muted">sessions with work turned in</div></div>
      </div>
      {weeks.map(w => (
        <div className="card" key={w.n} style={{ marginBottom: 12 }}>
          <div className="row between"><h3>Week {w.n}: {w.theme}</h3></div>
          <div className="grid-wrap"><table className="grid" style={{ marginTop: 8 }}><thead><tr><th>Day</th><th>Session</th><th>Lab</th><th>Quiz</th><th>Submitted</th><th>Grade</th><th>Status</th></tr></thead><tbody>
            {SESSIONS.filter(s => s.week === w.n).map(s => { const p = progress.find(x => x.session_id === s.id); const g = grades.find(x => x.session_id === s.id); const sub = subs.filter(x => x.session_id === s.id); const un = isUnlocked(s.id, user!.id, releases); const st = sessionState(s, p, sub, g, un);
              return (<tr key={s.id}><td className="mono">{s.day}</td><td style={{ whiteSpace: "normal", minWidth: 220 }}>{un ? <Link to={`/session/${s.id}`}>{s.title}</Link> : <span className="muted">{s.title}</span>}</td>
                <td><div className="row" style={{ gap: 6 }}><span className="progress" style={{ width: 70 }}><i style={{ width: `${labPct(s, p)}%` }} /></span><span className="mono small">{labPct(s, p)}%</span></div></td>
                <td>{p?.quiz_best != null ? <span className={`pill ${p.quiz_best >= 4 ? "good" : "warn"}`}>{p.quiz_best}/5</span> : <span className="muted">—</span>}</td>
                <td>{sub.length ? <span className="pill">{sub.length}</span> : <span className="muted">—</span>}</td>
                <td>{g?.score != null ? <b className="mono">{g.score}</b> : <span className="muted">—</span>}</td>
                <td><span className={`pill ${st === "graded" ? "good" : st === "submitted" ? "warn" : st === "in_progress" || st === "complete" ? "acc" : st === "locked" ? "lock" : ""}`}>{STATE_LABEL[st]}</span></td></tr>); })}
          </tbody></table></div>
        </div>))}
    </>
  );
}
