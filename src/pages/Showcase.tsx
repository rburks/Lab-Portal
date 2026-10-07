// Lab showcase: students share one of their own submissions with the class, with a one-line caption.
// Classmates see first name and last initial. The instructor can feature or hide any item.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SESSIONS } from "../content/course";
import { useAuth } from "../auth";
import { store, type ShowcaseItem, type Submission } from "../lib/store";

export default function Showcase({ embedded = false }: { embedded?: boolean }) {
  const { user, toast, mode } = useAuth();
  const isInstr = user?.role === "instructor" && mode === "instructor";
  const [items, setItems] = useState<ShowcaseItem[] | null>(null);
  const [mine, setMine] = useState<Submission[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [sharing, setSharing] = useState(false);
  const reload = useCallback(async () => {
    try { setItems(await store.showcase()); setErr(null); } catch (e) { setErr((e as Error).message); setItems([]); }
    if (!isInstr) setMine(await store.mySubmissions());
  }, [isInstr]);
  useEffect(() => { reload(); }, [reload]);
  const sessions = useMemo(() => SESSIONS.filter(s => (items || []).some(i => i.session_id === s.id)), [items]);
  if (!items) return <div className="empty">Loading showcase…</div>;
  const shown = items.filter(i => filter === "all" || (filter === "featured" ? i.featured : i.session_id === filter)).sort((a, b) => Number(b.featured) - Number(a.featured) || b.created_at.localeCompare(a.created_at));
  const sharedIds = new Set(items.filter(i => i.student_id === user?.id).map(i => i.submission_id));
  const shareable = mine.filter(s => !sharedIds.has(s.id));

  return (
    <>
      {!embedded && <div className="hero"><div><span className="eyebrow">Work from the class, shared by choice</span><h1>Showcase</h1><p className="muted">See how classmates tackled the same lab. Share one of your own submissions with a one-line note on what you learned. Only first names and last initials show.</p></div>
        {!isInstr && <button className="btn" onClick={() => setSharing(x => !x)} disabled={!shareable.length}>{sharing ? "Done" : shareable.length ? "Share your work" : "Nothing new to share"}</button>}</div>}
      {err && <div className="tip-box small" style={{ marginBottom: 12 }}><b>The showcase couldn't load.</b> {/relation|does not exist/i.test(err) ? "The October 7 batch 2 database section hasn't been run yet. Paste it into the Supabase SQL editor." : err}</div>}
      {sharing && <SharePicker subs={shareable} onDone={async () => { setSharing(false); await reload(); toast("Shared with the class"); }} />}
      <div className="chips" style={{ marginBottom: 14 }}>
        <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>All ({items.length})</button>
        <button className={filter === "featured" ? "on" : ""} onClick={() => setFilter("featured")}>★ Featured</button>
        {sessions.map(s => <button key={s.id} className={filter === s.id ? "on" : ""} onClick={() => setFilter(s.id)}>W{s.week} D{s.day}</button>)}
      </div>
      {!shown.length ? <div className="card empty">{items.length ? "Nothing here for this filter." : "Nobody has shared yet. Be first: open a session's Submit tab or use Share your work."}</div> :
        <div className="showcase-grid">{shown.map(i => <ShowcaseCard key={i.id} i={i} mine={i.student_id === user?.id} isInstr={isInstr} onChange={async (msg) => { await reload(); toast(msg); }} />)}</div>}
    </>
  );
}

function ShowcaseCard({ i, mine, isInstr, onChange }: { i: ShowcaseItem; mine: boolean; isInstr: boolean; onChange: (msg: string) => Promise<void> }) {
  const s = SESSIONS.find(x => x.id === i.session_id);
  return (
    <div className="card showcase-card" style={{ opacity: i.hidden ? 0.55 : 1, borderColor: i.featured ? "var(--accent)" : undefined }}>
      {i.kind === "image" && i.url && <a href={i.url} target="_blank" rel="noreferrer" className="showcase-media"><img src={i.url} alt={i.caption || "Shared screenshot"} loading="lazy" /></a>}
      {i.kind === "link" && i.body && <a href={i.body} target="_blank" rel="noreferrer" className="showcase-link">{(() => { try { return new URL(i.body).hostname.replace(/^www\./, ""); } catch { return "Open link"; } })()} ↗</a>}
      {i.kind === "text" && i.body && <blockquote className="showcase-quote">{i.body.length > 420 ? i.body.slice(0, 420) + "…" : i.body}</blockquote>}
      {i.caption && <p style={{ margin: 0 }}>{i.caption}</p>}
      <div className="row between small" style={{ marginTop: "auto" }}>
        <span className="muted"><b style={{ color: "var(--ink)" }}>{i.author}</b>{s && <> · <Link to={`/session/${s.id}`} className="muted">W{s.week} D{s.day}</Link></>}</span>
        <span className="row" style={{ gap: 4 }}>{i.featured && <span className="pill acc">★ Featured</span>}{i.hidden && <span className="pill bad">Hidden</span>}</span>
      </div>
      {(isInstr || mine) && <div className="row" style={{ gap: 6 }}>
        {isInstr && <button className="btn ghost xs" onClick={async () => { await store.moderate(i.id, { featured: !i.featured }); await onChange(i.featured ? "Unfeatured" : "Featured"); }}>{i.featured ? "Unfeature" : "★ Feature"}</button>}
        {isInstr && <button className="btn ghost xs" onClick={async () => { await store.moderate(i.id, { hidden: !i.hidden }); await onChange(i.hidden ? "Visible to the class again" : "Hidden from the class"); }}>{i.hidden ? "Unhide" : "Hide"}</button>}
        {mine && !isInstr && <button className="btn ghost xs" onClick={async () => { await store.unshare(i.id); await onChange("Removed from the showcase"); }}>Remove</button>}
        {mine && i.hidden && <span className="small muted">Your instructor hid this one. Message them if you're not sure why.</span>}
      </div>}
    </div>
  );
}

export function SharePicker({ subs, onDone, preselect }: { subs: Submission[]; onDone: () => Promise<void>; preselect?: number }) {
  const [pick, setPick] = useState<number | null>(preselect ?? subs[0]?.id ?? null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!subs.length) return null;
  return (
    <div className="card stack" style={{ gap: 10, marginBottom: 14 }}>
      <span className="eyebrow">Share with the class</span>
      {!preselect && <div className="stack" style={{ gap: 6 }}>{subs.map(s => { const se = SESSIONS.find(x => x.id === s.session_id); return (
        <label key={s.id} className="row" style={{ gap: 10, cursor: "pointer", alignItems: "flex-start" }}><input type="radio" name="share-pick" checked={pick === s.id} onChange={() => setPick(s.id)} />
          <span className="small"><b>W{se?.week} D{se?.day}</b> · {s.kind === "image" ? "Screenshot" : s.kind === "link" ? s.body : (s.body || "").slice(0, 90) + ((s.body || "").length > 90 ? "…" : "")}</span></label>); })}</div>}
      <input id="share-caption" maxLength={160} placeholder="One line: what did you learn or what surprised you? (shown with your work)" value={caption} onChange={e => setCaption(e.target.value)} />
      <div className="small muted">Classmates will see your first name and last initial. You can remove it any time.</div>
      {err && <div className="tip-box small">{err}</div>}
      <div><button className="btn sm" disabled={busy || pick == null || !caption.trim()} onClick={async () => { setBusy(true); setErr(null); try { await store.share(pick!, caption.trim()); await onDone(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } }}>{busy ? "Sharing…" : "Share"}</button></div>
    </div>
  );
}
