import { Link } from "react-router-dom";
import { PHASES, SESSIONS, WEEKS } from "../content/course";
import { useAuth } from "../auth";
import { useStudentData } from "./useStudentData";
import { isUnlocked, labPct, sessionState, STATE_LABEL } from "../lib/logic";
import { useEffect, useState } from "react";
import { store, type Announcement } from "../lib/store";
import { Announcements } from "./MessagesPage";

export default function CourseMap() {
  const { user } = useAuth();
  const { progress, subs, grades, releases, loading } = useStudentData();
  const [anns, setAnns] = useState<Announcement[]>([]);
  useEffect(() => { store.announcements().then(setAnns); }, []);
  if (loading) return <div className="empty">Loading your course…</div>;
  const open = SESSIONS.filter(s => isUnlocked(s.id, user!.id, releases));
  const next = open.find(s => { const p = progress.find(x => x.session_id === s.id); return sessionState(s, p, subs.filter(x => x.session_id === s.id), grades.find(g => g.session_id === s.id), true) !== "graded"; });
  return (
    <>
      <div className="hero">
        <div><span className="eyebrow">20 weeks · 60 sessions</span><h1>Your course</h1><p className="muted">Sessions unlock as the class moves forward. Finish the lab, take the quiz, and submit your work.</p></div>
        {next && <Link className="btn" to={`/session/${next.id}`}>Continue: Week {next.week} Day {next.day} →</Link>}
      </div>
      {anns.length > 0 && <section className="phase"><div className="phase-h"><h2>Announcements</h2><Link to="/messages" className="small">All announcements →</Link></div><Announcements anns={anns} isInstr={false} reload={async () => {}} toast={() => {}} compact /></section>}
      {PHASES.map(ph => (
        <section className="phase" key={ph.n}>
          <div className="phase-h"><h2>Phase {ph.n}: {ph.name}</h2><span className="q">{ph.question}</span></div>
          <div className="weeks">
            {ph.weeks.map(wn => {
              const w = WEEKS.find(x => x.n === wn)!;
              const days = SESSIONS.filter(s => s.week === wn);
              const anyOpen = days.some(d => isUnlocked(d.id, user!.id, releases));
              const pct = Math.round(days.reduce((a, d) => a + labPct(d, progress.find(p => p.session_id === d.id)), 0) / 3);
              return (
                <div className={`week ${anyOpen ? "" : "locked"}`} key={wn}>
                  <div className="week-h"><div><div className="n">WEEK {String(wn).padStart(2, "0")}</div><h3>{w.theme}</h3></div>{!anyOpen && <span className="pill lock">Locked</span>}</div>
                  <div className="days">
                    {days.map(d => {
                      const unlocked = isUnlocked(d.id, user!.id, releases);
                      const st = sessionState(d, progress.find(p => p.session_id === d.id), subs.filter(x => x.session_id === d.id), grades.find(g => g.session_id === d.id), unlocked);
                      const cls = `day ${!unlocked ? "locked" : st === "graded" || st === "complete" || st === "submitted" ? "done" : st === "in_progress" ? "open" : ""}`;
                      const inner = <><span className="ic">{st === "graded" || st === "complete" || st === "submitted" ? "✓" : d.day}</span><span><span className="t" title={d.title}>{d.title}</span><span className="s">{unlocked ? STATE_LABEL[st] : "Locked"}{!d.built && unlocked ? " · content coming" : ""}</span></span><span className="small muted">{unlocked && d.built ? `${labPct(d, progress.find(p => p.session_id === d.id))}%` : ""}</span></>;
                      return unlocked ? <Link key={d.id} className={cls} to={`/session/${d.id}`}>{inner}</Link> : <div key={d.id} className={cls} aria-disabled>{inner}</div>;
                    })}
                  </div>
                  {anyOpen && <div className="progress" aria-label={`Week ${wn} progress`}><i style={{ width: `${pct}%` }} /></div>}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
