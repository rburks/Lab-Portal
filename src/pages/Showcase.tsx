// Showcase: the class feed. Students post projects, articles, ideas, videos, resources, questions, or share a lab
// submission. Everyone reacts and comments. Posts go live instantly; the instructor moderates everything:
// pin, feature, hide, lock comments, delete, mute a student, and turn posting or comments off for the class.
// Classmates see first name and last initial; the instructor shows by full name.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SESSIONS } from "../content/course";
import { useAuth } from "../auth";
import { REACTIONS, store, type CourseSettings, type PostType, type Profile, type ReactionKey, type ShowcaseComment, type ShowcaseItem, type Submission } from "../lib/store";
import { compressImage, initials } from "../lib/logic";

const TYPES: { key: Exclude<PostType, "lab">; label: string; icon: string; hint: string }[] = [
  { key: "project", label: "Project", icon: "🛠", hint: "Something you built or automated" },
  { key: "article", label: "Article", icon: "📰", hint: "A read worth the class's time" },
  { key: "idea", label: "Idea", icon: "💭", hint: "Something you want to try" },
  { key: "video", label: "Video", icon: "🎬", hint: "YouTube, Vimeo, or Loom link" },
  { key: "resource", label: "Resource", icon: "🧰", hint: "A tool, template, or prompt" },
  { key: "question", label: "Question", icon: "❓", hint: "Ask the class" },
];
const typeMeta = (t: PostType) => t === "lab" ? { label: "Lab", icon: "🧪" } : TYPES.find(x => x.key === t)!;

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m}m ago`; const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24); return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
// Turn a YouTube, Vimeo, or Loom link into a player address; anything else stays a link card.
export function embedUrl(u: string | null): string | null {
  if (!u) return null;
  try {
    const url = new URL(u); const h = url.hostname.replace(/^www\.|^m\./, "");
    if (h === "youtube.com") { const id = url.searchParams.get("v") || url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/)?.[1]; return id ? `https://www.youtube-nocookie.com/embed/${id}` : null; }
    if (h === "youtu.be") { const id = url.pathname.slice(1).split("/")[0]; return id ? `https://www.youtube-nocookie.com/embed/${id}` : null; }
    if (h === "vimeo.com") { const id = url.pathname.match(/^\/(\d+)/)?.[1]; return id ? `https://player.vimeo.com/video/${id}` : null; }
    if (h === "loom.com") { const id = url.pathname.match(/^\/(?:share|embed)\/([\w]+)/)?.[1]; return id ? `https://www.loom.com/embed/${id}` : null; }
  } catch { /* not a URL */ }
  return null;
}

export default function Showcase({ embedded = false }: { embedded?: boolean }) {
  const { user, toast, mode } = useAuth();
  const isInstr = user?.role === "instructor" && mode === "instructor";
  const realInstr = user?.role === "instructor";
  const [items, setItems] = useState<ShowcaseItem[] | null>(null);
  const [mine, setMine] = useState<Submission[]>([]);
  const [settings, setSettings] = useState<CourseSettings | null>(null);
  const [mutes, setMutes] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [composing, setComposing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const reload = useCallback(async () => {
    try { setItems(await store.showcase()); setErr(null); } catch (e) { setErr((e as Error).message); setItems([]); }
    setSettings(await store.settings());
    setMutes(await store.showcaseMutes().catch(() => [])); // students only ever see their own row
    if (!isInstr) setMine(await store.mySubmissions().catch(() => []));
  }, [isInstr, realInstr]);
  useEffect(() => { reload(); }, [reload]);

  const counts = useMemo(() => { const c: Record<string, number> = {}; (items || []).forEach(i => { c[i.post_type] = (c[i.post_type] || 0) + 1; }); return c; }, [items]);
  if (!items || !settings) return <div className="empty">Loading showcase…</div>;
  const postingOn = settings.showcase_posting !== false; const commentsOn = settings.showcase_comments !== false;
  const muted = !realInstr && !!user && mutes.includes(user.id);
  const canPost = isInstr || (postingOn && !muted);
  const shown = items
    .filter(i => filter === "all" || (filter === "featured" ? i.featured : filter === "mine" ? i.student_id === user?.id : i.post_type === filter))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at));
  const sharedIds = new Set(items.filter(i => i.student_id === user?.id).map(i => i.submission_id));
  const shareable = mine.filter(s => !sharedIds.has(s.id));
  const after = async (msg: string) => { await reload(); toast(msg); };

  return (
    <>
      {!embedded && <div className="hero"><div><span className="eyebrow">The class feed</span><h1>Showcase</h1><p className="muted">Post projects, articles, ideas, videos, and questions. React and comment on classmates' posts. Classmates see your first name and last initial.</p></div></div>}
      {err && <div className="tip-box small" style={{ marginBottom: 12 }}><b>The showcase couldn't load.</b> {/column|relation|does not exist/i.test(err) ? "The October 12 Showcase database section hasn't been run yet. Paste it into the Supabase SQL editor." : err}</div>}
      <div className="feed">
        {isInstr && <Controls settings={settings} mutes={mutes} onChange={after} />}
        {!isInstr && (!postingOn || muted) && <div className="tip-box small">{muted ? "Your instructor has paused posting for your account. You can still react. Message them if you're not sure why." : "Posting is paused for the class right now. You can still react and comment."}</div>}
        {canPost && <div className="card feed-start">
          {!composing && !sharing ? <div className="row" style={{ gap: 10 }}>
            <span className="avatar">{initials(user?.full_name || "?")}</span>
            <button className="feed-prompt" onClick={() => setComposing(true)}>Share a project, idea, link, or question…</button>
            {!isInstr && shareable.length > 0 && <button className="btn ghost sm" onClick={() => setSharing(true)}>🧪 Share a lab</button>}
          </div> : composing ? <Composer onCancel={() => setComposing(false)} onDone={async () => { setComposing(false); await after("Posted to the showcase"); }} /> :
            <SharePicker subs={shareable} onCancel={() => setSharing(false)} onDone={async () => { setSharing(false); await after("Shared with the class"); }} />}
        </div>}
        <div className="chips">
          <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>All ({items.length})</button>
          <button className={filter === "featured" ? "on" : ""} onClick={() => setFilter("featured")}>★ Featured</button>
          {!isInstr && <button className={filter === "mine" ? "on" : ""} onClick={() => setFilter("mine")}>Mine</button>}
          {[...TYPES, { key: "lab" as const, label: "Labs", icon: "🧪" }].filter(t => counts[t.key]).map(t => <button key={t.key} className={filter === t.key ? "on" : ""} onClick={() => setFilter(t.key)}>{t.icon} {t.label} ({counts[t.key]})</button>)}
        </div>
        {!shown.length ? <div className="card empty">{items.length ? "Nothing here for this filter." : "Nobody has posted yet. Be first."}</div> :
          shown.map(i => <PostCard key={i.id} i={i} meId={user?.id || ""} isInstr={isInstr} commentsOn={commentsOn} muted={muted} mutedAuthor={mutes.includes(i.student_id)} onChange={after} onQuiet={reload} />)}
      </div>
    </>
  );
}

function Controls({ settings, mutes, onChange }: { settings: CourseSettings; mutes: string[]; onChange: (msg: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<Profile[]>([]);
  useEffect(() => { if (open) store.allProfiles().then(p => setStudents(p.filter(x => x.role === "student"))); }, [open]);
  const flip = async (k: "showcase_posting" | "showcase_comments") => { const v = settings[k] === false; await store.saveSettings({ ...settings, [k]: v }); await onChange(k === "showcase_posting" ? (v ? "Students can post again" : "Posting paused for students") : (v ? "Comments turned on" : "Comments turned off for students")); };
  const postingOn = settings.showcase_posting !== false, commentsOn = settings.showcase_comments !== false;
  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div className="row between"><div className="row" style={{ gap: 8 }}><b>Instructor controls</b>
        <span className={`pill ${postingOn ? "good" : "bad"}`}>Posting {postingOn ? "on" : "paused"}</span><span className={`pill ${commentsOn ? "good" : "bad"}`}>Comments {commentsOn ? "on" : "off"}</span>{mutes.length > 0 && <span className="pill warn">{mutes.length} muted</span>}</div>
        <button className="btn ghost xs" onClick={() => setOpen(o => !o)}>{open ? "Close" : "Manage"}</button></div>
      {open && <>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost sm" onClick={() => flip("showcase_posting")}>{postingOn ? "Pause posting for students" : "Let students post again"}</button>
          <button className="btn ghost sm" onClick={() => flip("showcase_comments")}>{commentsOn ? "Turn comments off" : "Turn comments on"}</button>
        </div>
        <div className="small muted">Every post also has its own controls: pin, feature, hide, lock comments, delete. Muting a student stops them posting and commenting; they can still read and react.</div>
        {students.length > 0 && <div className="stack" style={{ gap: 6 }}><span className="eyebrow">Muted students</span>
          <div className="row" style={{ gap: 6 }}>{mutes.length ? mutes.map(id => { const s = students.find(x => x.id === id); return <span key={id} className="pill warn">{s?.full_name || "Student"} <button className="linkish" onClick={async () => { await store.setMute(id, false); await onChange("Unmuted"); }} aria-label="Unmute">✕</button></span>; }) : <span className="small muted">None</span>}
            <select style={{ width: "auto" }} value="" onChange={async e => { if (!e.target.value) return; await store.setMute(e.target.value, true); await onChange("Muted. They can still read and react."); }}>
              <option value="">Mute a student…</option>{students.filter(s => !mutes.includes(s.id)).map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></div></div>}
      </>}
    </div>
  );
}

function Composer({ onCancel, onDone }: { onCancel: () => void; onDone: () => Promise<void> }) {
  const [type, setType] = useState<Exclude<PostType, "lab">>("project");
  const [title, setTitle] = useState(""); const [text, setText] = useState(""); const [link, setLink] = useState("");
  const [files, setFiles] = useState<{ blob: Blob; preview: string }[]>([]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const linkOk = !link.trim() || /^https?:\/\/\S+\.\S+/.test(link.trim());
  const needsLink = type === "video" || type === "article";
  const ready = title.trim() && linkOk && (!needsLink || link.trim()) && (type !== "video" || embedUrl(link.trim()) || link.trim());
  const addFiles = async (list: FileList | null) => {
    if (!list) return; const room = 4 - files.length;
    const picked = [...list].filter(f => f.type.startsWith("image/")).slice(0, room);
    const out = await Promise.all(picked.map(async f => { const blob = await compressImage(f); return { blob, preview: URL.createObjectURL(blob) }; }));
    setFiles(fs => [...fs, ...out]);
  };
  const submit = async () => {
    setBusy(true); setErr(null);
    try { await store.createPost({ post_type: type, title: title.trim(), text: text.trim(), link_url: link.trim(), images: files.map(f => f.blob) }); await onDone(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const meta = TYPES.find(t => t.key === type)!;
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="chips">{TYPES.map(t => <button key={t.key} className={type === t.key ? "on" : ""} onClick={() => setType(t.key)} title={t.hint}>{t.icon} {t.label}</button>)}</div>
      <input id="post-title" maxLength={120} placeholder={type === "question" ? "Your question in one line" : `Title: ${meta.hint.toLowerCase()}`} value={title} onChange={e => setTitle(e.target.value)} />
      <textarea id="post-text" maxLength={2000} placeholder={type === "question" ? "Add context so classmates can help." : "What is it, and what did you learn or want feedback on?"} value={text} onChange={e => setText(e.target.value)} style={{ minHeight: 90 }} />
      <input id="post-link" placeholder={needsLink ? `Link (required): ${type === "video" ? "YouTube, Vimeo, or Loom" : "the article"}` : "Link (optional)"} value={link} onChange={e => setLink(e.target.value)} style={!linkOk ? { borderColor: "var(--bad)" } : undefined} />
      {link.trim() && linkOk && embedUrl(link.trim()) && <div className="small muted">▶ This video will play right in the post.</div>}
      {files.length > 0 && <div className={`post-images n${files.length}`}>{files.map((f, i) => <div key={i} className="thumb"><img src={f.preview} alt="" /><button className="btn ghost xs" onClick={() => setFiles(fs => fs.filter((_, j) => j !== i))} aria-label="Remove image">✕</button></div>)}</div>}
      {err && <div className="tip-box small">{err}</div>}
      <div className="row between">
        <div className="row" style={{ gap: 6 }}>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
          <button className="btn ghost sm" disabled={files.length >= 4} onClick={() => fileRef.current?.click()}>🖼 Add images {files.length ? `(${files.length}/4)` : ""}</button>
        </div>
        <div className="row" style={{ gap: 6 }}><button className="btn ghost sm" onClick={onCancel}>Cancel</button><button className="btn sm" disabled={busy || !ready} onClick={submit}>{busy ? "Posting…" : "Post"}</button></div>
      </div>
    </div>
  );
}

function PostCard({ i, meId, isInstr, commentsOn, muted, mutedAuthor, onChange, onQuiet }: { i: ShowcaseItem; meId: string; isInstr: boolean; commentsOn: boolean; muted: boolean; mutedAuthor: boolean; onChange: (msg: string) => Promise<void>; onQuiet: () => Promise<void> }) {
  const s = i.session_id ? SESSIONS.find(x => x.id === i.session_id) : undefined;
  const mine = i.student_id === meId;
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [rx, setRx] = useState({ counts: i.reactions, mine: i.my_reactions });
  useEffect(() => setRx({ counts: i.reactions, mine: i.my_reactions }), [i.reactions, i.my_reactions]);
  const toggle = async (k: ReactionKey) => {
    const on = !rx.mine.includes(k);
    setRx(r => ({ counts: { ...r.counts, [k]: r.counts[k] + (on ? 1 : -1) }, mine: on ? [...r.mine, k] : r.mine.filter(x => x !== k) }));
    try { await store.react(i.id, k, on); } catch { await onQuiet(); }
  };
  const meta = typeMeta(i.post_type);
  const embed = embedUrl(i.link_url);
  const longText = (i.text || "").length > 360;
  const mod = (patch: Parameters<typeof store.moderate>[1], msg: string) => async () => { await store.moderate(i.id, patch); await onChange(msg); };
  return (
    <article className={`card post ${i.pinned ? "pinned" : ""} ${i.featured ? "featured" : ""}`} style={{ opacity: i.hidden ? 0.6 : 1 }}>
      <header className="row between" style={{ alignItems: "flex-start" }}>
        <div className="row" style={{ gap: 10 }}>
          <span className="avatar">{initials(i.author)}</span>
          <div><div className="row" style={{ gap: 6 }}><b>{i.author}</b>{i.author_role === "instructor" && <span className="pill acc">Instructor</span>}</div>
            <div className="small muted">{ago(i.created_at)} · {meta.icon} {meta.label}{s && <> · <Link to={`/session/${s.id}`} className="muted">W{s.week} D{s.day}</Link></>}</div></div>
        </div>
        <div className="row" style={{ gap: 4 }}>{i.pinned && <span className="pill acc">📌 Pinned</span>}{i.featured && <span className="pill acc">★ Featured</span>}{i.hidden && <span className="pill bad">Hidden</span>}{i.comments_locked && <span className="pill">🔒 Comments locked</span>}</div>
      </header>

      {i.title && <h3 className="post-title">{i.title}</h3>}
      {i.text && <p className="post-text">{longText && !more ? i.text.slice(0, 360) + "…" : i.text}{longText && <button className="linkish" onClick={() => setMore(m => !m)}>{more ? " Show less" : " Show more"}</button>}</p>}
      {i.post_type === "lab" && <>
        {i.kind === "image" && i.url && <a href={i.url} target="_blank" rel="noreferrer" className="showcase-media"><img src={i.url} alt={i.caption || "Shared screenshot"} loading="lazy" /></a>}
        {i.kind === "link" && i.body && <a href={i.body} target="_blank" rel="noreferrer" className="link-card"><span className="small muted">{host(i.body)}</span><b>Open the shared link ↗</b></a>}
        {i.kind === "text" && i.body && <blockquote className="showcase-quote">{i.body.length > 420 ? i.body.slice(0, 420) + "…" : i.body}</blockquote>}
        {i.caption && <p className="post-text">{i.caption}</p>}
      </>}
      {embed ? <div className="embed"><iframe src={embed} title={i.title || "Video"} loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen /></div>
        : i.link_url && <a href={i.link_url} target="_blank" rel="noreferrer" className="link-card"><span className="small muted">{host(i.link_url)}</span><b>{i.post_type === "article" ? "Read the article" : "Open link"} ↗</b></a>}
      {(i.image_urls || []).length > 0 && <div className={`post-images n${Math.min(i.image_urls!.length, 4)}`}>{i.image_urls!.map((u, k) => <a key={k} href={u} target="_blank" rel="noreferrer" className="thumb"><img src={u} alt="" loading="lazy" /></a>)}</div>}

      <div className="post-bar">
        <div className="reactions">{REACTIONS.map(r => <button key={r.key} className={`rx ${rx.mine.includes(r.key) ? "on" : ""}`} onClick={() => toggle(r.key)} title={r.label} aria-label={`${r.label}${rx.counts[r.key] ? `, ${rx.counts[r.key]}` : ""}`} aria-pressed={rx.mine.includes(r.key)}><span>{r.emoji}</span>{rx.counts[r.key] > 0 && <span className="n">{rx.counts[r.key]}</span>}</button>)}</div>
        <button className="btn ghost xs" onClick={() => setOpen(o => !o)}>💬 {i.comment_count ? `${i.comment_count} comment${i.comment_count === 1 ? "" : "s"}` : "Comment"}</button>
      </div>

      {(isInstr || mine) && <div className="post-admin">
        {isInstr && <>
          <button className="btn ghost xs" onClick={mod({ pinned: !i.pinned }, i.pinned ? "Unpinned" : "Pinned to the top")}>{i.pinned ? "Unpin" : "📌 Pin"}</button>
          <button className="btn ghost xs" onClick={mod({ featured: !i.featured }, i.featured ? "Unfeatured" : "Featured")}>{i.featured ? "Unfeature" : "★ Feature"}</button>
          <button className="btn ghost xs" onClick={mod({ hidden: !i.hidden }, i.hidden ? "Visible to the class again" : "Hidden from the class")}>{i.hidden ? "Unhide" : "Hide"}</button>
          <button className="btn ghost xs" onClick={mod({ comments_locked: !i.comments_locked }, i.comments_locked ? "Comments unlocked" : "Comments locked")}>{i.comments_locked ? "Unlock comments" : "🔒 Lock comments"}</button>
          {i.author_role !== "instructor" && <button className="btn ghost xs" onClick={async () => { await store.setMute(i.student_id, !mutedAuthor); await onChange(mutedAuthor ? "Unmuted" : "Muted. They can still read and react."); }}>{mutedAuthor ? "Unmute author" : "Mute author"}</button>}
        </>}
        <button className="btn ghost xs del" onClick={async () => { if (!confirm(isInstr && !mine ? "Delete this post for everyone? This can't be undone." : "Delete your post? This can't be undone.")) return; await store.deletePost(i.id); await onChange("Post deleted"); }}>Delete</button>
        {mine && i.hidden && !isInstr && <span className="small muted">Your instructor hid this post. Message them if you're not sure why.</span>}
      </div>}

      {open && <Comments post={i} meId={meId} isInstr={isInstr} canComment={isInstr || (commentsOn && !i.comments_locked && !i.hidden && !muted)} reason={!commentsOn ? "Comments are off for the class right now." : i.comments_locked ? "Comments are locked on this post." : muted ? "Commenting is paused for your account." : ""} onCount={onQuiet} />}
    </article>
  );
}

function Comments({ post, meId, isInstr, canComment, reason, onCount }: { post: ShowcaseItem; meId: string; isInstr: boolean; canComment: boolean; reason: string; onCount: () => Promise<void> }) {
  const { toast } = useAuth();
  const [list, setList] = useState<ShowcaseComment[] | null>(null);
  const [body, setBody] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => setList(await store.comments(post.id)), [post.id]);
  useEffect(() => { load(); }, [load]);
  const send = async () => {
    if (!body.trim()) return; setBusy(true);
    try { await store.addComment(post.id, body.trim()); setBody(""); await load(); await onCount(); } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  const act = (fn: () => Promise<void>, msg: string) => async () => { await fn(); await load(); await onCount(); toast(msg); };
  if (!list) return <div className="small muted">Loading comments…</div>;
  return (
    <div className="comments">
      {list.map(c => (
        <div key={c.id} className="comment" style={{ opacity: c.hidden ? 0.55 : 1 }}>
          <span className="avatar sm">{initials(c.author)}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="small"><b>{c.author}</b>{c.author_role === "instructor" && <span className="pill acc" style={{ marginLeft: 6 }}>Instructor</span>} <span className="muted">· {ago(c.created_at)}</span>{c.hidden && <span className="pill bad" style={{ marginLeft: 6 }}>Hidden</span>}</div>
            <div className="comment-body">{c.body}</div>
            {(isInstr || c.author_id === meId) && <div className="row" style={{ gap: 6, marginTop: 2 }}>
              {isInstr && <button className="linkish small" onClick={act(() => store.hideComment(c.id, !c.hidden), c.hidden ? "Comment visible again" : "Comment hidden")}>{c.hidden ? "Unhide" : "Hide"}</button>}
              <button className="linkish small" onClick={act(() => store.deleteComment(c.id), "Comment deleted")}>Delete</button></div>}
          </div>
        </div>))}
      {!list.length && <div className="small muted">No comments yet.</div>}
      {canComment ? <div className="comment-box">
        <textarea id={`c-${post.id}`} maxLength={2000} placeholder={post.post_type === "question" ? "Answer or add to the question…" : "Ask a question or say what worked…"} value={body} onChange={e => setBody(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button className="btn sm" disabled={busy || !body.trim()} onClick={send}>Reply</button>
      </div> : <div className="small muted">{reason}</div>}
    </div>
  );
}

export function SharePicker({ subs, onDone, onCancel, preselect }: { subs: Submission[]; onDone: () => Promise<void>; onCancel?: () => void; preselect?: number }) {
  const [pick, setPick] = useState<number | null>(preselect ?? subs[0]?.id ?? null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!subs.length) return null;
  return (
    <div className="stack" style={{ gap: 10, marginBottom: preselect ? 14 : 0 }} >
      <span className="eyebrow">Share a lab with the class</span>
      {!preselect && <div className="stack" style={{ gap: 6 }}>{subs.map(s => { const se = SESSIONS.find(x => x.id === s.session_id); return (
        <label key={s.id} className="row" style={{ gap: 10, cursor: "pointer", alignItems: "flex-start" }}><input type="radio" name="share-pick" checked={pick === s.id} onChange={() => setPick(s.id)} />
          <span className="small"><b>W{se?.week} D{se?.day}</b> · {s.kind === "image" ? "Screenshot" : s.kind === "link" ? s.body : (s.body || "").slice(0, 90) + ((s.body || "").length > 90 ? "…" : "")}</span></label>); })}</div>}
      <input id="share-caption" maxLength={160} placeholder="One line: what did you learn or what surprised you? (shown with your work)" value={caption} onChange={e => setCaption(e.target.value)} />
      <div className="small muted">Classmates will see your first name and last initial. You can delete it any time.</div>
      {err && <div className="tip-box small">{err}</div>}
      <div className="row" style={{ gap: 6 }}>{onCancel && <button className="btn ghost sm" onClick={onCancel}>Cancel</button>}<button className="btn sm" disabled={busy || pick == null || !caption.trim()} onClick={async () => { setBusy(true); setErr(null); try { await store.share(pick!, caption.trim()); await onDone(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } }}>{busy ? "Sharing…" : "Share"}</button></div>
    </div>
  );
}
