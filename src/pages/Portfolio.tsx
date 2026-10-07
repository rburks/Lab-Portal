// Portfolio: students build a public page from their course work. Once published, anyone can open /p/<slug>
// without signing in, so it can go on a resume or LinkedIn. Images are copied into a public bucket; nothing else is exposed.
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SESSIONS } from "../content/course";
import { useAuth } from "../auth";
import { compressImage } from "../lib/logic";
import { store, type Portfolio as P, type PortfolioItem, type Submission } from "../lib/store";

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
const validSlug = (s: string) => /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/.test(s);
const blank = (name: string): Omit<P, "student_id" | "updated_at"> => ({ slug: slugify(name), published: false, display_name: name, headline: "", bio: "", location: "", linkedin: "", credly: "", email_public: "", capstone: null, items: [] });

// ---------------- Editor ----------------
export function PortfolioEditor() {
  const { user, toast } = useAuth();
  const [p, setP] = useState<Omit<P, "student_id" | "updated_at"> | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [subs, setSubs] = useState<Submission[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const load = useCallback(async () => {
    try { const cur = await store.myPortfolio(); const base = cur ? { ...cur } : blank(user!.full_name); delete (base as Partial<P>).student_id; delete (base as Partial<P>).updated_at; setP(base); setSaved(JSON.stringify(base)); setErr(null); }
    catch (e) { setErr((e as Error).message); setP(blank(user!.full_name)); }
    setSubs(await store.mySubmissions());
  }, [user]);
  useEffect(() => { load(); }, [load]);
  if (!p) return <div className="empty">Loading…</div>;
  const dirty = JSON.stringify(p) !== saved;
  const set = <K extends keyof typeof p>(k: K, v: (typeof p)[K]) => setP({ ...p, [k]: v });
  const setItem = (i: number, patch: Partial<PortfolioItem>) => set("items", p.items.map((x, j) => j === i ? { ...x, ...patch } : x));
  const move = (i: number, d: number) => { const a = [...p.items]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x); set("items", a); };
  const save = async (publish?: boolean) => {
    const next = { ...p, published: publish ?? p.published, slug: slugify(p.slug) };
    if (!validSlug(next.slug)) { setErr("The web address needs 3 to 40 letters, numbers, or dashes."); return; }
    setBusy(true); setErr(null);
    try { await store.savePortfolio(next); setP(next); setSaved(JSON.stringify(next)); toast(publish === true ? "Published" : publish === false ? "Unpublished" : "Saved"); }
    catch (e) { setErr(/relation|does not exist/i.test((e as Error).message) ? "Portfolios aren't turned on yet. Ask Roland to run the October 7 batch 2 database section." : (e as Error).message); }
    finally { setBusy(false); }
  };
  const pullCapstone = async () => { const c = (await store.capstones()).find(x => x.student_id === user!.id); if (!c?.title) { toast("Add your project on the Capstone tab first"); return; } set("capstone", { title: c.title, summary: c.problem || "" }); };
  const publicUrl = `${window.location.origin}/p/${p.slug}`;
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="callout small">Your portfolio is a public page you can put on your resume and LinkedIn. Nothing is public until you click Publish, and you choose exactly what goes on it. Write it for a hiring manager who has 90 seconds.</div>
      {err && <div className="tip-box small">{err}</div>}
      <div className="card stack" style={{ gap: 10 }}>
        <div className="row between"><h3>About you</h3><span className={`pill ${p.published ? "good" : ""}`}>{p.published ? "Published" : "Draft"}</span></div>
        <div className="form-2">
          <label className="stack" style={{ gap: 4 }}><span className="eyebrow">Name as shown</span><input id="pf-name" value={p.display_name || ""} onChange={e => set("display_name", e.target.value)} /></label>
          <label className="stack" style={{ gap: 4 }}><span className="eyebrow">Location (optional)</span><input id="pf-loc" value={p.location || ""} placeholder="Huntsville, AL" onChange={e => set("location", e.target.value)} /></label>
        </div>
        <label className="stack" style={{ gap: 4 }}><span className="eyebrow">Headline: who you are and where you're headed</span><input id="pf-head" maxLength={110} value={p.headline || ""} placeholder="Operations coordinator moving into AI automation" onChange={e => set("headline", e.target.value)} /></label>
        <label className="stack" style={{ gap: 4 }}><span className="eyebrow">Short bio (three or four sentences)</span><textarea id="pf-bio" rows={4} maxLength={700} value={p.bio || ""} placeholder="What you did before, what you build now, and the kind of problems you want to solve." onChange={e => set("bio", e.target.value)} /></label>
        <div className="form-2">
          <label className="stack" style={{ gap: 4 }}><span className="eyebrow">LinkedIn URL</span><input id="pf-li" type="url" value={p.linkedin || ""} placeholder="https://www.linkedin.com/in/…" onChange={e => set("linkedin", e.target.value)} /></label>
          <label className="stack" style={{ gap: 4 }}><span className="eyebrow">AWS badge link (Credly), once you pass</span><input id="pf-credly" type="url" value={p.credly || ""} placeholder="https://www.credly.com/badges/…" onChange={e => set("credly", e.target.value)} /></label>
        </div>
        <label className="stack" style={{ gap: 4 }}><span className="eyebrow">Contact email to show (optional; leave blank to hide)</span><input id="pf-email" type="email" value={p.email_public || ""} onChange={e => set("email_public", e.target.value)} /></label>
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        <div className="row between"><h3>Featured: your capstone</h3><button className="btn ghost xs" onClick={pullCapstone}>Fill from my Capstone tab</button></div>
        {p.capstone ? <>
          <input id="pf-cap-title" value={p.capstone.title} onChange={e => set("capstone", { ...p.capstone!, title: e.target.value })} />
          <textarea id="pf-cap-sum" rows={3} value={p.capstone.summary} placeholder="Problem, what you built, and the result in the stakeholder's numbers." onChange={e => set("capstone", { ...p.capstone!, summary: e.target.value })} />
          <div><button className="btn ghost xs" onClick={() => set("capstone", null)}>Remove</button></div>
        </> : <p className="small muted" style={{ margin: 0 }}>Nothing yet. Your capstone becomes the centerpiece once you have one.</p>}
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        <div className="row between"><h3>Selected work ({p.items.length})</h3><div className="row" style={{ gap: 6 }}><button className="btn ghost xs" onClick={() => setAdding(a => !a)} disabled={!subs.length}>{adding ? "Done" : "Add from my labs"}</button><button className="btn ghost xs" onClick={() => set("items", [...p.items, { title: "", blurb: "" }])}>Add blank</button></div></div>
        {adding && <div className="stack" style={{ gap: 6 }}>{subs.map(sb => { const se = SESSIONS.find(x => x.id === sb.session_id); return (
          <div key={sb.id} className="row between small" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><b>W{se?.week} D{se?.day}</b> · {se?.title} · {sb.kind === "image" ? "screenshot" : sb.kind}</span>
            <button className="btn xs" disabled={busy} onClick={async () => { setBusy(true); try { const image = sb.kind === "image" && sb.file_path ? await store.submissionToPortfolioImage(sb.file_path) : undefined; set("items", [...p.items, { title: se?.title || "Lab", blurb: sb.kind === "text" ? (sb.body || "").slice(0, 280) : "", url: sb.kind === "link" ? sb.body || undefined : undefined, image }]); toast("Added. Write a one-line description."); } catch (e) { toast("Couldn't copy the image: " + (e as Error).message); } finally { setBusy(false); } }}>Add</button></div>); })}</div>}
        {p.items.map((it, i) => (
          <div key={i} className="sub" style={{ gridTemplateColumns: "88px minmax(0,1fr) auto", alignItems: "start" }}>
            <ImageSlot url={it.image} onChange={url => setItem(i, { image: url })} />
            <div className="stack" style={{ gap: 6 }}>
              <input aria-label="Title" value={it.title} placeholder="Title" onChange={e => setItem(i, { title: e.target.value })} />
              <textarea aria-label="Description" rows={2} value={it.blurb} placeholder="One or two sentences: the problem and what you did" onChange={e => setItem(i, { blurb: e.target.value })} />
              <input aria-label="Link" type="url" value={it.url || ""} placeholder="Link (optional)" onChange={e => setItem(i, { url: e.target.value || undefined })} />
            </div>
            <div className="stack" style={{ gap: 4 }}><button className="btn ghost xs" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button><button className="btn ghost xs" disabled={i === p.items.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button><button className="btn ghost xs" onClick={() => set("items", p.items.filter((_, j) => j !== i))} aria-label="Remove">✕</button></div>
          </div>))}
        {!p.items.length && <p className="small muted" style={{ margin: 0 }}>Pick three to five pieces you'd want an employer to see. Quality beats quantity.</p>}
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        <h3>Publish</h3>
        <label className="stack" style={{ gap: 4 }}><span className="eyebrow">Your web address</span><div className="row" style={{ gap: 6, flexWrap: "nowrap" }}><span className="small muted mono" style={{ whiteSpace: "nowrap" }}>{window.location.host}/p/</span><input id="pf-slug" value={p.slug} onChange={e => set("slug", slugify(e.target.value))} style={{ flex: 1 }} /></div></label>
        <div className="row">
          <button className="btn" disabled={busy || !dirty} onClick={() => save()}>{busy ? "Saving…" : "Save draft"}</button>
          {p.published ? <button className="btn ghost" disabled={busy} onClick={() => save(false)}>Unpublish</button> : <button className="btn" disabled={busy || !p.headline?.trim() || !p.display_name?.trim()} title={p.headline?.trim() ? "" : "Add a headline first"} onClick={() => save(true)}>Publish</button>}
          <Link className="btn ghost" to={`/p/${p.slug}?preview=1`} target="_blank">Preview ↗</Link>
        </div>
        {p.published && <div className="see-box small">Live at <a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a>. Copy that into your resume and LinkedIn.</div>}
      </div>
    </div>
  );
}

function ImageSlot({ url, onChange }: { url?: string; onChange: (url?: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <label style={{ width: 88, height: 66, border: "1px dashed var(--line)", borderRadius: 6, display: "grid", placeItems: "center", overflow: "hidden", cursor: "pointer", background: "var(--panel-2)" }} title={url ? "Replace image" : "Add an image"}>
      {url ? <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span className="small muted">{busy ? "…" : "+ image"}</span>}
      <input type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (!f) return; setBusy(true); try { onChange(await store.portfolioImage(await compressImage(f))); } finally { setBusy(false); } }} />
    </label>
  );
}

// ---------------- Public page (no sign-in) ----------------
export function PublicPortfolio() {
  const { slug } = useParams();
  const [p, setP] = useState<P | null | undefined>(undefined);
  const preview = new URLSearchParams(window.location.search).get("preview") === "1";
  useEffect(() => { (async () => { let r = await store.publicPortfolio(slug || ""); if (!r && preview) { const mine = await store.myPortfolio().catch(() => null); if (mine && mine.slug === slug) r = mine; } setP(r); if (r) document.title = `${r.display_name || "Portfolio"} · Portfolio`; })(); }, [slug, preview]);
  if (p === undefined) return <div className="pf-page"><div className="empty">Loading…</div></div>;
  if (!p) return <div className="pf-page"><div className="pf-wrap"><h1>Portfolio not found</h1><p className="muted">This page doesn't exist or hasn't been published yet.</p></div></div>;
  return (
    <div className="pf-page">
      {!p.published && <div className="mode-banner">Preview. This page isn't published yet, so only you can see it.</div>}
      <div className="pf-wrap">
        <header className="pf-head">
          <div>
            <h1>{p.display_name}</h1>
            {p.headline && <p className="pf-headline">{p.headline}</p>}
            <div className="pf-meta">{p.location && <span>{p.location}</span>}{p.linkedin && <a href={p.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a>}{p.email_public && <a href={`mailto:${p.email_public}`}>{p.email_public}</a>}</div>
          </div>
          {p.credly && <a className="pf-badge" href={p.credly} target="_blank" rel="noreferrer"><span className="pf-badge-k">AWS Certified</span><span>AI Practitioner</span><span className="pf-badge-v">Verify on Credly ↗</span></a>}
        </header>
        {p.bio && <p className="pf-bio">{p.bio}</p>}
        {p.capstone && <section className="pf-cap"><span className="pf-label">Capstone project</span><h2>{p.capstone.title}</h2>{p.capstone.summary && <p>{p.capstone.summary}</p>}</section>}
        {p.items.length > 0 && <section><span className="pf-label">Selected work</span>
          <div className="pf-grid">{p.items.map((it, i) => (
            <article key={i} className="pf-item">
              {it.image && <img src={it.image} alt={it.title} loading="lazy" />}
              <div className="pf-item-body"><h3>{it.url ? <a href={it.url} target="_blank" rel="noreferrer">{it.title} ↗</a> : it.title}</h3>{it.blurb && <p>{it.blurb}</p>}</div>
            </article>))}</div></section>}
        <footer className="pf-foot">Built during the Software/AI program: AI tools, automation, and AWS Certified AI Practitioner preparation.</footer>
      </div>
    </div>
  );
}
