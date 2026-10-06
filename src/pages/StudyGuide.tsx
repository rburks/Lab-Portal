// Exam study guide: AIF-C01 domains, what's been covered so far, flashcards, practice, and weak spots.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SESSIONS, type LensTerm, type QuizQ, type Session } from "../content/course";
import { useAuth } from "../auth";
import { store, type Flashcard } from "../lib/store";
import { useStudentData } from "./useStudentData";
import { isUnlocked } from "../lib/logic";

const DOMAINS = [
  { n: 1, name: "Fundamentals of AI and ML", weight: 20, plain: "What AI, machine learning, and deep learning are, how models learn, and how we measure them." },
  { n: 2, name: "Fundamentals of Generative AI", weight: 24, plain: "How language models and other generative models work, what they're good at, and where they fail." },
  { n: 3, name: "Applications of Foundation Models", weight: 28, plain: "Prompting, RAG, agents, choosing a model, and evaluating what you built." },
  { n: 4, name: "Guidelines for Responsible AI", weight: 14, plain: "Fairness, bias, transparency, human oversight, and the legal risks of generative AI." },
  { n: 5, name: "Security, Compliance, and Governance", weight: 14, plain: "Who secures what on AWS, least privilege, logging, and the rules and frameworks that apply." },
];
// Every session already carries its exam domains in the Exam Lens text ("Domain 1: ...", "Domains 2, 3: ..."). Parse them.
function domainsOf(text: string): number[] { const m = text.match(/Domains?\s+([\d,\s and]+)/i); if (!m) return []; return [...new Set((m[1].match(/\d/g) || []).map(Number))]; }
type Card = { key: string; term: LensTerm; session: Session; domains: number[] };
type PQ = { q: QuizQ; session: Session; domains: number[] };

export default function StudyGuide() {
  const { user, toast } = useAuth();
  const { progress, releases, loading } = useStudentData();
  const [fc, setFc] = useState<Flashcard[]>([]);
  const [tab, setTab] = useState<"map" | "cards" | "practice">("map");
  const [domainFilter, setDomainFilter] = useState<number | "all">("all");
  const reload = useCallback(async () => setFc(await store.flashcards()), []);
  useEffect(() => { reload(); }, [reload]);
  const covered = useMemo(() => SESSIONS.filter(s => s.built && isUnlocked(s.id, user!.id, releases)), [releases, user]);
  const cards: Card[] = useMemo(() => covered.flatMap(s => (s.lens || []).map(t => ({ key: `${s.id}|${t.term}`, term: t, session: s, domains: domainsOf(t.exam) }))), [covered]);
  const pqs: PQ[] = useMemo(() => covered.flatMap(s => (s.quiz || []).map(q => ({ q, session: s, domains: domainsOf(s.lens?.[0]?.exam || "") }))), [covered]);
  if (loading) return <div className="empty">Loading…</div>;
  const status = (k: string) => fc.find(f => f.term_key === k)?.status;
  const known = cards.filter(c => status(c.key) === "known").length;
  const review = cards.filter(c => status(c.key) === "review").length;
  // weak domains from quiz results
  const domainScores = DOMAINS.map(d => { const ss = covered.filter(s => (s.lens || []).some(t => domainsOf(t.exam).includes(d.n))); const qs = ss.map(s => progress.find(p => p.session_id === s.id)?.quiz_best).filter((q): q is number => q != null); const avg = qs.length ? Math.round(100 * qs.reduce((a, b) => a + b, 0) / (qs.length * 5)) : null; const rv = cards.filter(c => c.domains.includes(d.n) && status(c.key) === "review").length; return { ...d, sessions: ss, avg, review: rv, terms: cards.filter(c => c.domains.includes(d.n)).length }; });
  const weak = domainScores.filter(d => (d.avg != null && d.avg < 70) || d.review > 0).sort((a, b) => (a.avg ?? 100) - (b.avg ?? 100));
  const filteredCards = cards.filter(c => domainFilter === "all" || c.domains.includes(domainFilter));
  const filteredPQ = pqs.filter(p => domainFilter === "all" || p.domains.includes(domainFilter));
  return (
    <>
      <div className="hero">
        <div><span className="eyebrow">AWS Certified AI Practitioner (AIF-C01) · 65 questions · 90 minutes · 700 to pass</span><h1>Exam study guide</h1>
          <p className="muted">Built from what the class has covered so far. It grows as sessions unlock. {cards.length} terms from {covered.length} session{covered.length === 1 ? "" : "s"}.</p></div>
        <div className="tabs" style={{ borderBottom: 0 }}><button className={tab === "map" ? "on" : ""} onClick={() => setTab("map")}>Domain map</button><button className={tab === "cards" ? "on" : ""} onClick={() => setTab("cards")}>Flashcards ({cards.length})</button><button className={tab === "practice" ? "on" : ""} onClick={() => setTab("practice")}>Practice ({pqs.length})</button></div>
      </div>
      <div className="kpis" style={{ marginBottom: 16 }}>
        <div className="kpi"><span className="eyebrow">Terms known</span><div className="v">{known}<span className="muted" style={{ fontSize: "1rem" }}> / {cards.length}</span></div><div className="progress" style={{ marginTop: 6 }}><i style={{ width: `${cards.length ? 100 * known / cards.length : 0}%` }} /></div></div>
        <div className="kpi"><span className="eyebrow">Marked for review</span><div className="v">{review}</div><div className="small muted">come back to these first</div></div>
        <div className="kpi"><span className="eyebrow">Exam weight covered</span><div className="v">{domainScores.filter(d => d.terms > 0).reduce((a, d) => a + d.weight, 0)}%</div><div className="small muted">of the exam has had at least one session</div></div>
        <div className="kpi"><span className="eyebrow">Weakest domain</span><div className="v" style={{ fontSize: "1.1rem" }}>{weak[0] ? `Domain ${weak[0].n}` : "—"}</div><div className="small muted">{weak[0] ? (weak[0].avg != null ? `quiz average ${weak[0].avg}%` : `${weak[0].review} terms to review`) : "nothing flagged yet"}</div></div>
      </div>
      {tab !== "map" && <div className="chips" style={{ marginBottom: 14 }}><button className={domainFilter === "all" ? "on" : ""} onClick={() => setDomainFilter("all")}>All domains</button>{DOMAINS.map(d => <button key={d.n} className={domainFilter === d.n ? "on" : ""} onClick={() => setDomainFilter(d.n)} disabled={!domainScores[d.n - 1].terms}>Domain {d.n}</button>)}</div>}
      {tab === "map" && <div className="stack" style={{ gap: 12 }}>
        {weak.length > 0 && <div className="callout"><b>Focus first:</b> {weak.map(d => `Domain ${d.n} (${d.avg != null && d.avg < 70 ? `quiz ${d.avg}%` : `${d.review} term${d.review === 1 ? "" : "s"} marked fuzzy`})`).join(", ")}. Open the flashcards for that domain, then retake the quizzes in the sessions listed below.</div>}
        {domainScores.map(d => (
          <div className="card" key={d.n}>
            <div className="row between"><div><span className="eyebrow">Domain {d.n} · {d.weight}% of the exam</span><h3>{d.name}</h3><p className="muted small" style={{ marginTop: 4 }}>{d.plain}</p></div>
              <div className="row">{d.avg != null && <span className={`pill ${d.avg >= 80 ? "good" : d.avg >= 60 ? "warn" : "bad"}`}>Quiz avg {d.avg}%</span>}<span className="pill">{d.terms} terms</span>{d.review > 0 && <span className="pill warn">{d.review} to review</span>}</div></div>
            <div className="progress" style={{ margin: "10px 0" }} aria-label="share of this domain's weight"><i style={{ width: `${d.weight * 100 / 28}%`, opacity: d.terms ? 1 : .35 }} /></div>
            {d.sessions.length ? <div className="row small" style={{ gap: 6 }}><span className="muted">Covered in:</span>{d.sessions.map(s => <Link key={s.id} to={`/session/${s.id}`} className="pill" style={{ textDecoration: "none" }}>W{s.week} D{s.day} · {s.title.length > 40 ? s.title.slice(0, 40) + "…" : s.title}</Link>)}</div>
              : <div className="small muted">Not covered yet. It arrives in later weeks.</div>}
          </div>))}
      </div>}
      {tab === "cards" && <Flashcards cards={filteredCards} status={status} onMark={async (k, s) => { await store.setFlashcard(k, s); await reload(); if (s === "known") toast("Marked known"); }} />}
      {tab === "practice" && <Practice items={filteredPQ} />}
    </>
  );
}

function Flashcards({ cards, status, onMark }: { cards: Card[]; status: (k: string) => string | undefined; onMark: (k: string, s: "known" | "review" | null) => Promise<void> }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mode, setMode] = useState<"all" | "review">("all");
  const deck = mode === "review" ? cards.filter(c => status(c.key) === "review") : cards;
  useEffect(() => { setI(0); setFlipped(false); }, [mode, cards.length]);
  if (!deck.length) return <div className="card empty">{mode === "review" ? "Nothing marked for review. Nice." : "No terms yet. Flashcards appear as sessions unlock."}</div>;
  const c = deck[Math.min(i, deck.length - 1)]; const st = status(c.key);
  const next = () => { setFlipped(false); setI(x => (x + 1) % deck.length); };
  return (
    <div className="stack reading" style={{ gap: 12 }}>
      <div className="row between"><div className="chips"><button className={mode === "all" ? "on" : ""} onClick={() => setMode("all")}>All terms</button><button className={mode === "review" ? "on" : ""} onClick={() => setMode("review")}>Review pile</button></div><span className="small muted mono">{i + 1} / {deck.length}</span></div>
      <button className="card pad-lg" onClick={() => setFlipped(f => !f)} style={{ textAlign: "left", minHeight: 220, display: "grid", alignContent: "space-between", cursor: "pointer", borderColor: flipped ? "var(--accent)" : "var(--line)" }} aria-label="Flip card">
        <div className="row between"><span className="eyebrow">{flipped ? "Plain words, then exam words" : "Term"}</span><span className="row" style={{ gap: 6 }}>{c.domains.map(d => <span key={d} className="pill acc">D{d}</span>)}{st && <span className={`pill ${st === "known" ? "good" : "warn"}`}>{st}</span>}</span></div>
        {flipped ? <div><p style={{ fontSize: "1.1rem" }}>{c.term.plain}</p><p className="muted small" style={{ marginTop: 8 }}>{c.term.exam}</p></div> : <h2 style={{ fontSize: "1.8rem" }}>{c.term.term}</h2>}
        <div className="small muted">{flipped ? `From Week ${c.session.week} Day ${c.session.day}: ${c.session.title}` : "Tap to flip"}</div>
      </button>
      <div className="row between">
        <div className="row"><button className="btn ghost" onClick={() => { setFlipped(false); setI(x => (x - 1 + deck.length) % deck.length); }}>← Back</button><button className="btn ghost" onClick={next}>Next →</button></div>
        <div className="row"><button className="btn ghost" style={{ color: "var(--warn)" }} onClick={async () => { await onMark(c.key, "review"); next(); }}>Still fuzzy</button><button className="btn" onClick={async () => { await onMark(c.key, "known"); next(); }}>Got it</button></div>
      </div>
    </div>
  );
}

function Practice({ items }: { items: PQ[] }) {
  const [order, setOrder] = useState<number[]>([]);
  const [i, setI] = useState(0); const [pick, setPick] = useState<number | null>(null); const [score, setScore] = useState({ right: 0, done: 0 });
  useEffect(() => { setOrder(items.map((_, k) => k).sort(() => Math.random() - 0.5)); setI(0); setPick(null); setScore({ right: 0, done: 0 }); }, [items.length]);
  if (!items.length) return <div className="card empty">No practice questions yet. They appear as sessions unlock.</div>;
  if (i >= order.length) return <div className="card pad-lg reading stack"><span className="eyebrow">Round complete</span><h2>{score.right} of {score.done} right ({Math.round(100 * score.right / Math.max(1, score.done))}%)</h2><p className="muted">The real exam passes at 700 of 1,000, roughly 70%. Retake the sessions' quizzes for anything you missed, then run another round.</p><div><button className="btn" onClick={() => { setOrder(o => [...o].sort(() => Math.random() - 0.5)); setI(0); setPick(null); setScore({ right: 0, done: 0 }); }}>Another round</button></div></div>;
  const it = items[order[i]];
  return (
    <div className="stack reading" style={{ gap: 12 }}>
      <div className="row between"><span className="small muted mono">Question {i + 1} of {order.length}</span><span className="row" style={{ gap: 6 }}>{it.domains.map(d => <span key={d} className="pill acc">Domain {d}</span>)}<span className="pill">{score.right}/{score.done}</span></span></div>
      <div className="q"><div className="prompt" style={{ fontSize: "1.05rem" }}>{it.q.q}</div>
        {it.q.a.map((a, j) => { const cls = pick === null ? "" : j === it.q.c ? "right" : pick === j ? "wrong" : ""; return <label key={j} className={cls}><input type="radio" name="pq" disabled={pick !== null} checked={pick === j} onChange={() => { setPick(j); setScore(s => ({ right: s.right + (j === it.q.c ? 1 : 0), done: s.done + 1 })); }} /> <span>{a}</span></label>; })}
        {pick !== null && <div className="why"><b>{pick === it.q.c ? "Right." : "Not quite."}</b> {it.q.why} <span className="muted">From W{it.session.week} D{it.session.day}.</span></div>}</div>
      <div><button className="btn" disabled={pick === null} onClick={() => { setI(x => x + 1); setPick(null); }}>{i + 1 === order.length ? "Finish" : "Next question"}</button></div>
    </div>
  );
}
