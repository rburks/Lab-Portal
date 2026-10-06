// Exam study guide, rebuilt around the official AIF-C01 objectives.
// Three views: the exam map (every objective, covered / coming / not tested), spaced flashcards (one question per card),
// and a timed mock at the real exam's pace with an estimated scaled score and a per-objective miss list.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { OBJECTIVES, SESSIONS, type ExamCard, type ExamQ, type Session } from "../content/course";
import { useAuth } from "../auth";
import { store, type Flashcard, type MockAttempt } from "../lib/store";
import { useStudentData } from "./useStudentData";
import { isUnlocked } from "../lib/logic";

type Obj = (typeof OBJECTIVES.objectives)[number];
type Card = { key: string; card: ExamCard; session: Session; obj: Obj };
type PQ = { q: ExamQ; session: Session; obj: Obj };
const EX = OBJECTIVES.exam;
const SECS_PER_Q = Math.round(EX.minutes * 60 / EX.questions); // 83 seconds, the real exam's pace
const dom = (id: string) => Number(id.split(".")[0]);
const objById = (id: string) => OBJECTIVES.objectives.find(o => o.id === id);
const sessById = (id: string) => SESSIONS.find(s => s.id === id);
const scaled = (correct: number, total: number) => total ? Math.round(EX.scaleMin + (EX.scaleMax - EX.scaleMin) * correct / total) : 0;
const fmtSecs = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function StudyGuide() {
  const { user } = useAuth();
  const { releases, loading } = useStudentData();
  const [fc, setFc] = useState<Flashcard[]>([]);
  const [mocks, setMocks] = useState<MockAttempt[]>([]);
  const [tab, setTab] = useState<"map" | "cards" | "mock">("map");
  const reload = useCallback(async () => { setFc(await store.flashcards()); setMocks(await store.mockAttempts()); }, []);
  useEffect(() => { reload(); }, [reload]);

  const covered = useMemo(() => SESSIONS.filter(s => s.built && isUnlocked(s.id, user!.id, releases)), [releases, user]);
  const coveredObjIds = useMemo(() => new Set(covered.flatMap(s => s.exam?.objectives || [])), [covered]);
  const cards: Card[] = useMemo(() => covered.flatMap(s => (s.exam?.cards || []).map(c => ({ key: `${s.id}|${c.id}`, card: c, session: s, obj: objById(c.obj)! })).filter(c => c.obj)), [covered]);
  const pqs: PQ[] = useMemo(() => covered.flatMap(s => (s.exam?.practice || []).map(q => ({ q, session: s, obj: objById(q.obj)! })).filter(p => p.obj)), [covered]);
  if (loading) return <div className="empty">Loading…</div>;

  const fcByKey = new Map(fc.map(f => [f.term_key, f]));
  const now = Date.now();
  const due = cards.filter(c => { const f = fcByKey.get(c.key); return !f || !f.due || new Date(f.due).getTime() <= now; });
  const mastered = new Set(cards.filter(c => (fcByKey.get(c.key)?.streak ?? 0) >= 2).map(c => c.obj.id));
  const lastMock = mocks[0];
  // weakest objective: most misses across saved mocks, then most fuzzy cards
  const missCount = new Map<string, number>();
  mocks.forEach(m => m.answers.forEach(a => { if (!a.correct) missCount.set(a.obj, (missCount.get(a.obj) || 0) + 1); }));
  cards.forEach(c => { if (fcByKey.get(c.key)?.status === "review") missCount.set(c.obj.id, (missCount.get(c.obj.id) || 0) + 1); });
  const weakest = [...missCount.entries()].sort((a, b) => b[1] - a[1])[0];
  const weightCovered = OBJECTIVES.domains.filter(d => [...coveredObjIds].some(o => dom(o) === d.n)).reduce((a, d) => a + d.weight, 0);

  return (
    <>
      <div className="hero">
        <div><span className="eyebrow">AWS Certified AI Practitioner (AIF-C01) · {EX.questions} questions · {EX.minutes} minutes · {EX.pass} to pass</span><h1>Exam study guide</h1>
          <p className="muted">Every objective on the real exam, marked as we cover it. {coveredObjIds.size} of {OBJECTIVES.objectives.length} objectives covered so far, from {covered.length} session{covered.length === 1 ? "" : "s"}.</p></div>
        <div className="tabs" style={{ borderBottom: 0 }}>
          <button className={tab === "map" ? "on" : ""} onClick={() => setTab("map")}>Exam map</button>
          <button className={tab === "cards" ? "on" : ""} onClick={() => setTab("cards")}>Flashcards{due.length ? ` (${due.length} due)` : ""}</button>
          <button className={tab === "mock" ? "on" : ""} onClick={() => setTab("mock")}>Mock exam</button>
        </div>
      </div>
      <div className="kpis" style={{ marginBottom: 16 }}>
        <div className="kpi"><span className="eyebrow">Objectives covered</span><div className="v">{coveredObjIds.size}<span className="muted" style={{ fontSize: "1rem" }}> / {OBJECTIVES.objectives.length}</span></div><div className="progress" style={{ marginTop: 6 }}><i style={{ width: `${100 * coveredObjIds.size / OBJECTIVES.objectives.length}%` }} /></div></div>
        <div className="kpi"><span className="eyebrow">Cards due</span><div className="v">{due.length}</div><div className="small muted">{cards.length ? `${mastered.size} objective${mastered.size === 1 ? "" : "s"} mastered (got it twice)` : "cards appear as sessions unlock"}</div></div>
        <div className="kpi"><span className="eyebrow">Last mock</span><div className="v" style={{ color: lastMock ? (lastMock.scaled >= EX.pass ? "var(--good)" : "var(--warn)") : undefined }}>{lastMock ? lastMock.scaled : "—"}</div><div className="small muted">{lastMock ? `${lastMock.correct}/${lastMock.total} right · estimate, ${EX.pass} passes` : "no mock taken yet"}</div></div>
        <div className="kpi"><span className="eyebrow">Exam weight covered</span><div className="v">{weightCovered}%</div><div className="small muted">{weakest ? `weakest: objective ${weakest[0]}` : "nothing flagged yet"}</div></div>
      </div>
      {tab === "map" && <ExamMap coveredObjIds={coveredObjIds} covered={covered} missCount={missCount} mastered={mastered} />}
      {tab === "cards" && <Flashcards cards={cards} due={due} fcByKey={fcByKey} onRate={async (c, got) => { await store.rateCard(c.key, c.obj.id, got); await reload(); }} />}
      {tab === "mock" && <Mock items={pqs} mocks={mocks} onSaved={reload} />}
    </>
  );
}

// ---------- Exam map: every domain, task statement, and objective ----------
function ExamMap({ coveredObjIds, covered, missCount, mastered }: { coveredObjIds: Set<string>; covered: Session[]; missCount: Map<string, number>; mastered: Set<string> }) {
  const [open, setOpen] = useState<number | null>(1);
  const notTested = [...OBJECTIVES.notTested, ...covered.flatMap(s => (s.exam?.notTested || []).map(n => ({ ...n, first: s.id })))].filter((n, i, a) => a.findIndex(x => x.term === n.term) === i);
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="callout small"><b>How to read this.</b> The exam has 5 domains, 14 task statements, and {OBJECTIVES.objectives.length} objectives. Every question on the real exam maps to one objective. <span className="pill good">Covered</span> means a class session taught it and it has flashcards and practice questions here. <span className="pill">Coming</span> shows the week it arrives. Nothing is hidden, so you can always see what's left.</div>
      {OBJECTIVES.domains.map(d => {
        const objs = OBJECTIVES.objectives.filter(o => dom(o.id) === d.n);
        const cov = objs.filter(o => coveredObjIds.has(o.id)).length;
        const tasks = OBJECTIVES.tasks.filter(t => dom(t.id) === d.n);
        const isOpen = open === d.n;
        return (
          <div className="card" key={d.n}>
            <button className="row between" style={{ width: "100%", background: "none", border: 0, padding: 0, textAlign: "left", cursor: "pointer", color: "inherit" }} onClick={() => setOpen(isOpen ? null : d.n)} aria-expanded={isOpen}>
              <div><span className="eyebrow">Domain {d.n} · {d.weight}% of the exam · about {Math.round(EX.scored * d.weight / 100)} scored questions</span><h3>{d.name}</h3><p className="muted small" style={{ marginTop: 4 }}>{d.plain}</p></div>
              <div className="row"><span className={`pill ${cov === objs.length ? "good" : cov ? "acc" : ""}`}>{cov} / {objs.length} objectives</span><span className="muted">{isOpen ? "▾" : "▸"}</span></div>
            </button>
            <div className="progress" style={{ margin: "10px 0 0" }} aria-label="objectives covered in this domain"><i style={{ width: `${100 * cov / objs.length}%` }} /></div>
            {isOpen && <div className="stack" style={{ gap: 10, marginTop: 14 }}>
              {tasks.map(t => (
                <div key={t.id}>
                  <div className="eyebrow" style={{ marginBottom: 6 }}>Task {t.id} · {t.title}</div>
                  <div className="stack" style={{ gap: 6 }}>
                    {objs.filter(o => o.id.startsWith(t.id + ".")).map(o => {
                      const isCov = coveredObjIds.has(o.id); const s = sessById(o.first);
                      const firstCov = covered.find(x => x.exam?.objectives.includes(o.id));
                      const misses = missCount.get(o.id) || 0;
                      return (
                        <div key={o.id} className="term" style={{ gridTemplateColumns: "64px minmax(0,1fr) auto", alignItems: "start", opacity: isCov ? 1 : .8 }}>
                          <b>{o.id}</b>
                          <div><div>{o.text}</div>{o.examples && <div className="small muted" style={{ marginTop: 2 }}>For example: {o.examples}</div>}</div>
                          <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                            {mastered.has(o.id) && <span className="pill good" title="Got every card for this objective right twice">★ mastered</span>}
                            {misses > 0 && <span className="pill warn" title="Missed in a mock or marked fuzzy">{misses} miss{misses === 1 ? "" : "es"}</span>}
                            {isCov && firstCov ? <Link to={`/session/${firstCov.id}`} className="pill good" style={{ textDecoration: "none" }}>Covered · W{firstCov.week} D{firstCov.day}</Link>
                              : <span className="pill" title={s?.title}>Coming · Week {s?.week ?? "?"}</span>}
                          </div>
                        </div>);
                    })}
                  </div>
                </div>))}
            </div>}
          </div>);
      })}
      {notTested.length > 0 && <div className="card">
        <span className="eyebrow">Taught in class but not on the exam</span>
        <p className="muted small" style={{ margin: "4px 0 10px" }}>Learn these for understanding. Don't spend exam study time on them.</p>
        <div className="stack" style={{ gap: 6 }}>{notTested.map(n => { const s = sessById(n.first); return <div key={n.term} className="term" style={{ gridTemplateColumns: "minmax(120px,160px) minmax(0,1fr)" }}><b style={{ color: "var(--mute)" }}>{n.term}</b><div>{n.why} {s && <span className="muted small">(W{s.week} D{s.day})</span>}</div></div>; })}</div>
      </div>}
      <div className="small muted">Source: {OBJECTIVES.source}</div>
    </div>
  );
}

// ---------- Flashcards: one question per card, spaced review ----------
function Flashcards({ cards, due, fcByKey, onRate }: { cards: Card[]; due: Card[]; fcByKey: Map<string, Flashcard>; onRate: (c: Card, got: boolean) => Promise<void> }) {
  const [mode, setMode] = useState<"due" | "all">("due");
  const [domainFilter, setDomainFilter] = useState<number | "all">("all");
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sessionDone, setSessionDone] = useState(0);
  const base = mode === "due" ? due : cards;
  const deck = base.filter(c => domainFilter === "all" || dom(c.obj.id) === domainFilter);
  useEffect(() => { setI(0); setFlipped(false); }, [mode, domainFilter]);
  useEffect(() => { if (i >= deck.length) setI(Math.max(0, deck.length - 1)); }, [deck.length, i]);
  const domainsPresent = [...new Set(cards.map(c => dom(c.obj.id)))].sort();
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return; if (e.key === " ") { e.preventDefault(); setFlipped(f => !f); } if (e.key === "ArrowRight") setI(x => Math.min(x + 1, deck.length - 1)); if (e.key === "ArrowLeft") setI(x => Math.max(0, x - 1)); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [deck.length]);

  if (!cards.length) return <div className="card empty">No cards yet. They appear as sessions unlock.</div>;
  if (!deck.length) return (
    <div className="stack" style={{ gap: 12 }}>
      <Chips mode={mode} setMode={setMode} domainFilter={domainFilter} setDomainFilter={setDomainFilter} domainsPresent={domainsPresent} dueCount={due.length} />
      <div className="card pad-lg reading stack"><span className="eyebrow">All caught up</span><h2>Nothing due right now{sessionDone ? `. You reviewed ${sessionDone} card${sessionDone === 1 ? "" : "s"}` : ""}.</h2><p className="muted">Cards you got right come back in 7 days, then 21, then 45. Fuzzy ones come back in 2 days. Switch to <b>All cards</b> to browse anyway, or try a mock.</p><div><button className="btn ghost" onClick={() => setMode("all")}>Browse all cards</button></div></div>
    </div>);

  const c = deck[Math.min(i, deck.length - 1)]; const f = fcByKey.get(c.key);
  const rate = async (got: boolean) => { if (busy) return; setBusy(true); try { await onRate(c, got); setSessionDone(n => n + 1); setFlipped(false); if (mode === "all") setI(x => (x + 1) % deck.length); } finally { setBusy(false); } };
  return (
    <div className="stack reading" style={{ gap: 12 }}>
      <Chips mode={mode} setMode={setMode} domainFilter={domainFilter} setDomainFilter={setDomainFilter} domainsPresent={domainsPresent} dueCount={due.length} />
      <div className="row between"><span className="small muted">Answer it in your head, then flip. Space flips, arrows move.</span><span className="small muted mono">{i + 1} / {deck.length}</span></div>
      <button className="card pad-lg" onClick={() => setFlipped(x => !x)} style={{ textAlign: "left", minHeight: 240, display: "grid", alignContent: "space-between", gap: 14, cursor: "pointer", borderColor: flipped ? "var(--accent)" : "var(--line)", borderWidth: flipped ? 2 : 1 }} aria-label="Flip card">
        <div className="row between">
          <span className="eyebrow">{flipped ? "Answer" : "Question"}</span>
          <span className="row" style={{ gap: 6 }}><span className="pill acc" title={c.obj.text}>Objective {c.obj.id}</span>{f?.status === "known" && <span className="pill good">{f.streak ?? 1}× right</span>}{f?.status === "review" && <span className="pill warn">fuzzy</span>}</span>
        </div>
        {flipped
          ? <div><p style={{ fontSize: "1.15rem", lineHeight: 1.5 }}>{c.card.a}</p>{c.card.term && <p className="small" style={{ marginTop: 10 }}><span className="muted">Exam term: </span><b className="mono" style={{ color: "var(--accent)" }}>{c.card.term}</b></p>}</div>
          : <h2 style={{ fontSize: "1.55rem", lineHeight: 1.3 }}>{c.card.q}</h2>}
        <div className="small muted">{flipped ? <>Objective {c.obj.id}: {c.obj.text}. From W{c.session.week} D{c.session.day}.</> : "Tap to flip"}</div>
      </button>
      <div className="row between">
        <div className="row"><button className="btn ghost" onClick={() => { setFlipped(false); setI(x => Math.max(0, x - 1)); }} disabled={i === 0}>← Back</button><button className="btn ghost" onClick={() => { setFlipped(false); setI(x => Math.min(x + 1, deck.length - 1)); }} disabled={i >= deck.length - 1}>Skip →</button></div>
        <div className="row">
          <button className="btn ghost" style={{ color: "var(--warn)", borderColor: "var(--warn)" }} disabled={!flipped || busy} title={flipped ? "Comes back in 2 days" : "Flip the card first"} onClick={() => rate(false)}>Still fuzzy</button>
          <button className="btn" disabled={!flipped || busy} title={flipped ? `Comes back in ${[7, 21, 45][Math.min((f?.streak ?? 0), 2)]} days` : "Flip the card first"} onClick={() => rate(true)}>Got it</button>
        </div>
      </div>
    </div>
  );
}
function Chips({ mode, setMode, domainFilter, setDomainFilter, domainsPresent, dueCount }: { mode: "due" | "all"; setMode: (m: "due" | "all") => void; domainFilter: number | "all"; setDomainFilter: (d: number | "all") => void; domainsPresent: number[]; dueCount: number }) {
  return (
    <div className="row between">
      <div className="chips"><button className={mode === "due" ? "on" : ""} onClick={() => setMode("due")}>Due now ({dueCount})</button><button className={mode === "all" ? "on" : ""} onClick={() => setMode("all")}>All cards</button></div>
      <div className="chips"><button className={domainFilter === "all" ? "on" : ""} onClick={() => setDomainFilter("all")}>All domains</button>{OBJECTIVES.domains.map(d => <button key={d.n} className={domainFilter === d.n ? "on" : ""} disabled={!domainsPresent.includes(d.n)} onClick={() => setDomainFilter(d.n)}>D{d.n}</button>)}</div>
    </div>);
}

// ---------- Mock exam: timed, no feedback until the end, scaled estimate, per-objective misses ----------
type Answer = { pick: number | null; flagged: boolean };
function Mock({ items, mocks, onSaved }: { items: PQ[]; mocks: MockAttempt[]; onSaved: () => Promise<void> }) {
  const [scope, setScope] = useState<"all" | number>("all");
  const [count, setCount] = useState<number>(10);
  const [phase, setPhase] = useState<"setup" | "run" | "result">("setup");
  const [order, setOrder] = useState<PQ[]>([]);
  const [ans, setAns] = useState<Answer[]>([]);
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [saved, setSaved] = useState<MockAttempt | null>(null);
  const timer = useRef<number | null>(null);
  const pool = items.filter(p => scope === "all" || dom(p.obj.id) === scope);
  const domainsPresent = [...new Set(items.map(p => dom(p.obj.id)))].sort();
  const n = Math.min(count, pool.length);

  const finish = useCallback(async (o: PQ[], a: Answer[], secs: number) => {
    if (timer.current) { window.clearInterval(timer.current); timer.current = null; }
    const answers = o.map((p, k) => ({ id: `${p.session.id}|${p.q.id}`, obj: p.obj.id, correct: a[k]?.pick === p.q.c }));
    const correct = answers.filter(x => x.correct).length;
    const m: MockAttempt = { scope: String(scope), total: o.length, correct, scaled: scaled(correct, o.length), seconds: secs, answers };
    setSaved(m); setPhase("result");
    try { await store.saveMock(m); await onSaved(); } catch { /* result still shows; saving is best effort */ }
  }, [scope, onSaved]);

  const start = () => {
    const o = [...pool].sort(() => Math.random() - 0.5).slice(0, n);
    const a = o.map(() => ({ pick: null, flagged: false }));
    setOrder(o); setAns(a); setI(0); setElapsed(0); setLeft(SECS_PER_Q * o.length); setPhase("run"); setSaved(null);
  };
  // countdown
  const ansRef = useRef(ans); ansRef.current = ans; const orderRef = useRef(order); orderRef.current = order;
  useEffect(() => {
    if (phase !== "run") return;
    timer.current = window.setInterval(() => { setElapsed(e => e + 1); setLeft(l => { if (l <= 1) { finish(orderRef.current, ansRef.current, SECS_PER_Q * orderRef.current.length); return 0; } return l - 1; }); }, 1000);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [phase, finish]);

  if (!items.length) return <div className="card empty">No practice questions yet. They appear as sessions unlock.</div>;

  if (phase === "setup") return (
    <div className="stack reading" style={{ gap: 14 }}>
      <div className="card pad-lg stack" style={{ gap: 14 }}>
        <div><span className="eyebrow">Set up a mock</span><h2>Practice at the real exam's pace</h2><p className="muted">The real exam gives you {EX.minutes} minutes for {EX.questions} questions, about {SECS_PER_Q} seconds each. This mock uses the same pace, shows no feedback until the end, and estimates a scaled score against the {EX.pass} pass mark.</p></div>
        <div><span className="eyebrow">Scope</span><div className="chips" style={{ marginTop: 6 }}><button className={scope === "all" ? "on" : ""} onClick={() => setScope("all")}>Everything covered ({items.length})</button>{OBJECTIVES.domains.map(d => { const k = items.filter(p => dom(p.obj.id) === d.n).length; return <button key={d.n} className={scope === d.n ? "on" : ""} disabled={!domainsPresent.includes(d.n)} onClick={() => setScope(d.n)}>Domain {d.n} ({k})</button>; })}</div></div>
        <div><span className="eyebrow">Questions</span><div className="chips" style={{ marginTop: 6 }}>{[5, 10, 20, 35, 65].map(k => <button key={k} className={count === k ? "on" : ""} disabled={k > pool.length && k !== 5} onClick={() => setCount(k)}>{k}</button>)}<button className={count === 999 ? "on" : ""} onClick={() => setCount(999)}>All available ({pool.length})</button></div></div>
        <div className="row between"><span className="small muted">{n} question{n === 1 ? "" : "s"} · {fmtSecs(SECS_PER_Q * n)} on the clock</span><button className="btn" disabled={!n} onClick={start}>Start mock</button></div>
      </div>
      {mocks.length > 0 && <div className="card">
        <span className="eyebrow">Your mock history</span>
        <div className="stack" style={{ gap: 6, marginTop: 8 }}>{mocks.slice(0, 8).map((m, k) => <div key={m.id ?? k} className="row between small" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}><span>{m.created_at ? new Date(m.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""} · {m.scope === "all" ? "All domains" : `Domain ${m.scope}`} · {m.total} questions</span><span className="row" style={{ gap: 8 }}><span className="muted">{m.correct}/{m.total}</span><span className={`pill ${m.scaled >= EX.pass ? "good" : "warn"}`}>{m.scaled}</span></span></div>)}</div>
      </div>}
    </div>
  );

  if (phase === "run") {
    const p = order[i]; const a = ans[i];
    const answered = ans.filter(x => x.pick !== null).length;
    const low = left <= 60;
    return (
      <div className="stack reading" style={{ gap: 12 }}>
        <div className="row between">
          <span className="small muted mono">Question {i + 1} of {order.length} · {answered} answered</span>
          <span className={`pill ${low ? "bad" : ""} mono`} style={{ fontSize: ".95rem", padding: "4px 12px" }} aria-live="polite">⏱ {fmtSecs(left)}</span>
        </div>
        <div className="progress"><i style={{ width: `${100 * answered / order.length}%` }} /></div>
        <div className="q">
          <div className="row between" style={{ marginBottom: 8 }}><span className="pill acc">Domain {dom(p.obj.id)}</span><button className={`btn xs ${a.flagged ? "" : "ghost"}`} onClick={() => setAns(x => x.map((y, k) => k === i ? { ...y, flagged: !y.flagged } : y))}>{a.flagged ? "⚑ Flagged" : "Flag for review"}</button></div>
          <div className="prompt" style={{ fontSize: "1.05rem", lineHeight: 1.5 }}>{p.q.q}</div>
          {p.q.a.map((opt, j) => <label key={j} className={a.pick === j ? "picked" : ""} style={a.pick === j ? { borderColor: "var(--accent)", background: "var(--accent-soft)" } : undefined}><input type="radio" name={`mq${i}`} checked={a.pick === j} onChange={() => setAns(x => x.map((y, k) => k === i ? { ...y, pick: j } : y))} /><span><b className="mono muted" style={{ marginRight: 8 }}>{"ABCD"[j]}</b>{opt}</span></label>)}
        </div>
        <div className="row between">
          <div className="row"><button className="btn ghost" onClick={() => setI(x => Math.max(0, x - 1))} disabled={i === 0}>← Previous</button><button className="btn ghost" onClick={() => setI(x => Math.min(order.length - 1, x + 1))} disabled={i >= order.length - 1}>Next →</button></div>
          <button className="btn" onClick={() => { if (answered < order.length && !window.confirm(`${order.length - answered} unanswered. Submit anyway? Unanswered counts as wrong, like the real exam.`)) return; finish(order, ans, elapsed); }}>Submit mock</button>
        </div>
        <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>{order.map((_, k) => <button key={k} onClick={() => setI(k)} className="btn xs ghost" style={{ minWidth: 30, borderColor: k === i ? "var(--accent)" : ans[k].flagged ? "var(--warn)" : undefined, background: ans[k].pick !== null ? "var(--panel-2)" : undefined }} title={ans[k].flagged ? "Flagged" : ans[k].pick !== null ? "Answered" : "Unanswered"}>{k + 1}</button>)}</div>
      </div>
    );
  }

  // result
  const m = saved!;
  const byObj = new Map<string, { total: number; correct: number }>();
  m.answers.forEach(a => { const r = byObj.get(a.obj) || { total: 0, correct: 0 }; r.total++; if (a.correct) r.correct++; byObj.set(a.obj, r); });
  const weak = [...byObj.entries()].filter(([, r]) => r.correct < r.total).sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total));
  const passed = m.scaled >= EX.pass;
  return (
    <div className="stack reading" style={{ gap: 14 }}>
      <div className="card pad-lg stack" style={{ gap: 10, borderColor: passed ? "var(--good)" : "var(--warn)" }}>
        <span className="eyebrow">Mock complete · {fmtSecs(m.seconds)} used of {fmtSecs(SECS_PER_Q * m.total)}</span>
        <div className="row" style={{ alignItems: "baseline", gap: 14 }}><span className="bignum" style={{ color: passed ? "var(--good)" : "var(--warn)" }}>{m.scaled}</span><span className="muted">estimated scaled score · {m.correct} of {m.total} right ({Math.round(100 * m.correct / m.total)}%)</span></div>
        <div className="progress" style={{ height: 10 }} aria-label="score against pass mark"><i style={{ width: `${100 * (m.scaled - EX.scaleMin) / (EX.scaleMax - EX.scaleMin)}%`, background: passed ? "var(--good)" : "var(--warn)" }} /></div>
        <p className="muted small">AWS scores the real exam from {EX.scaleMin} to {EX.scaleMax} and passes at {EX.pass}. The real scaling isn't published, so this estimate is a straight line: roughly {Math.round(100 * (EX.pass - EX.scaleMin) / (EX.scaleMax - EX.scaleMin))}% right to pass. Only {EX.scored} of the {EX.questions} real questions are scored; the other 15 are unscored trial items.</p>
        {weak.length > 0 && <div className="callout"><b>Study these objectives first</b><ul>{weak.map(([o, r]) => { const ob = objById(o); return <li key={o}><b className="mono">{o}</b> {ob?.text} <span className="muted">({r.correct}/{r.total})</span></li>; })}</ul></div>}
        <div className="row"><button className="btn" onClick={() => setPhase("setup")}>Another mock</button></div>
      </div>
      <span className="eyebrow">Review every question</span>
      {order.map((p, k) => { const a = ans[k]; const right = a.pick === p.q.c; return (
        <div key={k} className="q" style={{ borderColor: right ? "var(--good)" : "var(--bad)" }}>
          <div className="row between" style={{ marginBottom: 8 }}><span className="small muted">Question {k + 1} · Objective {p.obj.id}</span><span className={`pill ${right ? "good" : "bad"}`}>{right ? "Right" : a.pick === null ? "Unanswered" : "Wrong"}</span></div>
          <div className="prompt">{p.q.q}</div>
          {p.q.a.map((opt, j) => { const cls = j === p.q.c ? "right" : a.pick === j ? "wrong" : ""; return <label key={j} className={cls} style={{ cursor: "default" }}><input type="radio" disabled checked={a.pick === j} readOnly /><span><b className="mono muted" style={{ marginRight: 8 }}>{"ABCD"[j]}</b>{opt}{p.q.wrong?.[j] && j !== p.q.c && <div className="small muted" style={{ marginTop: 3 }}>{p.q.wrong[j]}</div>}</span></label>; })}
          <div className="why"><b>Why {"ABCD"[p.q.c]} is right.</b> {p.q.why} <Link to={`/session/${p.session.id}`} className="muted">Review W{p.session.week} D{p.session.day}</Link></div>
        </div>); })}
    </div>
  );
}
