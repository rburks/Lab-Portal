// Data layer. One interface, two implementations: Supabase (production) and Demo (in-memory, no backend).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SESSIONS, type Session } from "../content/course";
import type { Announcement, Attendance, CalendarDay, CapstoneRow, ContentRow, CourseSettings, Flashcard, FlashcardRow, Material, Message, MilestoneRow, MilestoneStatus, MockAttempt, ModeratePatch, NewPost, NotifyKind, NotifyLog, OHRequest, Portfolio, ReactionKey, ShowcaseComment, ShowcaseItem, Slot, StoreContent, StoreExt, StoreMore, Recording } from "./types-ext";
import type { SessionContent } from "../content/course";
import w01d1 from "../../content/week01/w01d1.json";
import w01d2 from "../../content/week01/w01d2.json";
import w01d3 from "../../content/week01/w01d3.json";
// Spaced review: fuzzy comes back next session (2 days), got it once in a week, twice in three weeks, then monthly.
export function scheduleCard(cur: Flashcard | undefined, got: boolean) {
  const streak = got ? (cur?.streak ?? 0) + 1 : 0;
  const days = got ? [7, 21, 45][Math.min(streak - 1, 2)] : 2;
  return { streak, due: new Date(Date.now() + days * 864e5).toISOString() };
}
// Classmates see first name and last initial only.
export const shortName = (full: string) => { const p = full.trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0]; };
export type { Announcement, Attendance, CalendarDay, CapstoneRow, ContentRow, CourseSettings, Flashcard, FlashcardRow, Material, Message, MilestoneRow, MilestoneStatus, MockAttempt, NewPost, NotifyKind, NotifyLog, OHRequest, Portfolio, PortfolioItem, PostType, Recording, ReactionKey, ShowcaseComment, ShowcaseItem, Slot } from "./types-ext";
export const REACTIONS: { key: ReactionKey; emoji: string; label: string }[] = [{ key: "like", emoji: "👍", label: "Like" }, { key: "learned", emoji: "💡", label: "Learned something" }, { key: "fire", emoji: "🔥", label: "Impressive" }, { key: "question", emoji: "🤔", label: "Question" }, { key: "clap", emoji: "👏", label: "Applause" }];
const noReactions = (): Record<ReactionKey, number> => ({ like: 0, learned: 0, fire: 0, question: 0, clap: 0 });

export type Role = "student" | "instructor";
export type Profile = { id: string; email: string; full_name: string; role: Role; created_at: string };
export type Progress = { student_id: string; session_id: string; steps: boolean[]; goal: string | null; quiz_best: number | null; quiz_last: number | null; quiz_attempts: number; sandbox: Record<string, unknown> | null; responses: Record<string, unknown>; updated_at: string;
  quiz_first?: (number | null)[] | null; quiz_picks?: (number | null)[] | null }; // option index picked per question: first try, most recent try
export type Submission = { id: number; student_id: string; session_id: string; kind: "image" | "link" | "text"; body: string | null; file_path: string | null; created_at: string; url?: string };
export type Grade = { student_id: string; session_id: string; score: number | null; feedback: string | null; graded_at: string; rubric?: string[] | null };
export type Release = { session_id: string; student_id: string | null; unlocked_at: string };

export interface Store extends StoreExt, StoreContent, StoreMore {
  demo: boolean;
  // auth
  currentUser(): Promise<Profile | null>;
  signInWithEmail(email: string): Promise<{ error?: string }>;
  sendSignInLink(email: string): Promise<{ error?: string }>;
  signOut(): Promise<void>;
  onAuthChange(cb: () => void): () => void;
  // student
  myProgress(): Promise<Progress[]>;
  saveProgress(p: Partial<Progress> & { session_id: string }): Promise<void>;
  mySubmissions(): Promise<Submission[]>;
  addSubmission(s: { session_id: string; kind: Submission["kind"]; body?: string; file?: Blob }): Promise<void>;
  deleteSubmission(id: number): Promise<void>;
  myGrades(): Promise<Grade[]>;
  releases(): Promise<Release[]>;
  // instructor
  allProfiles(): Promise<Profile[]>;
  allProgress(): Promise<Progress[]>;
  allSubmissions(): Promise<Submission[]>;
  allGrades(): Promise<Grade[]>;
  setRelease(session_id: string, student_id: string | null, unlocked: boolean): Promise<void>;
  saveGrade(g: { student_id: string; session_id: string; score: number | null; feedback: string; rubric?: string[] }): Promise<void>;
  roster(): Promise<{ email: string; full_name: string | null; role: Role }[]>;
  addToRoster(rows: { email: string; full_name?: string; role?: Role }[]): Promise<void>;
  removeFromRoster(email: string): Promise<void>;
  setRole(id: string, role: Role): Promise<void>;
  signedUrl(path: string): Promise<string>;
  // demo only
  demoSwitchUser?(id: string): void;
}

// ---------------- Supabase ----------------
class SupaStore implements Store {
  demo = false;
  sb: SupabaseClient;
  constructor(url: string, key: string) { this.sb = createClient(url, key); }
  async currentUser() {
    const { data: { user } } = await this.sb.auth.getUser();
    if (!user) return null;
    const { data } = await this.sb.from("profiles").select("*").eq("id", user.id).single();
    return data as Profile | null;
  }
  async signInWithEmail(email: string) {
    const { data: ok } = await this.sb.rpc("email_allowed", { e: email });
    if (ok === false) return { error: "That email isn't on the class roster. Check with your instructor." };
    const { error } = await this.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    return error ? { error: error.message } : {};
  }
  // Instructor sends a student their sign-in link. Doesn't touch the instructor's own session.
  async sendSignInLink(email: string) {
    const { error } = await this.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    return error ? { error: error.message } : {};
  }
  async signOut() { await this.sb.auth.signOut(); }
  onAuthChange(cb: () => void) { const { data } = this.sb.auth.onAuthStateChange(() => cb()); return () => data.subscription.unsubscribe(); }
  async myProgress() { const { data } = await this.sb.from("progress").select("*"); return (data || []) as Progress[]; }
  async saveProgress(p: Partial<Progress> & { session_id: string }) {
    const { data: { user } } = await this.sb.auth.getUser(); if (!user) return;
    const row = { student_id: user.id, ...p, updated_at: new Date().toISOString() };
    const { error } = await this.sb.from("progress").upsert(row, { onConflict: "student_id,session_id" });
    // Before the October 14 SQL runs, the per-question columns don't exist yet: save the score anyway.
    if (error && /quiz_first|quiz_picks/.test(error.message)) { const { quiz_first: _f, quiz_picks: _p, ...rest } = row; void _f; void _p; await this.sb.from("progress").upsert(rest, { onConflict: "student_id,session_id" }); }
  }
  async mySubmissions() { const { data } = await this.sb.from("submissions").select("*").order("created_at"); return this.withUrls((data || []) as Submission[]); }
  async addSubmission(s: { session_id: string; kind: Submission["kind"]; body?: string; file?: Blob }) {
    const { data: { user } } = await this.sb.auth.getUser(); if (!user) return;
    let file_path: string | null = null;
    if (s.file) {
      file_path = `${user.id}/${s.session_id}/${Date.now()}.jpg`;
      const { error } = await this.sb.storage.from("submissions").upload(file_path, s.file, { contentType: "image/jpeg" });
      if (error) throw error;
    }
    const { error } = await this.sb.from("submissions").insert({ student_id: user.id, session_id: s.session_id, kind: s.kind, body: s.body ?? null, file_path });
    if (error) throw error;
  }
  async deleteSubmission(id: number) {
    const { data } = await this.sb.from("submissions").select("file_path").eq("id", id).single();
    if (data?.file_path) await this.sb.storage.from("submissions").remove([data.file_path]);
    await this.sb.from("submissions").delete().eq("id", id);
  }
  async myGrades() { const { data } = await this.sb.from("grades").select("*"); return (data || []) as Grade[]; }
  async releases() { const { data } = await this.sb.from("releases").select("session_id,student_id,unlocked_at"); return (data || []) as Release[]; }
  async allProfiles() { const { data } = await this.sb.from("profiles").select("*").order("full_name"); return (data || []) as Profile[]; }
  async allProgress() { return this.myProgress(); }
  async allSubmissions() { const { data } = await this.sb.from("submissions").select("*").order("created_at"); return this.withUrls((data || []) as Submission[]); }
  async allGrades() { return this.myGrades(); }
  async setRelease(session_id: string, student_id: string | null, unlocked: boolean) {
    if (unlocked) await this.sb.from("releases").upsert({ session_id, student_id }, { onConflict: "session_id,student_id" });
    else { let q = this.sb.from("releases").delete().eq("session_id", session_id); q = student_id ? q.eq("student_id", student_id) : q.is("student_id", null); await q; }
  }
  async saveGrade(g: { student_id: string; session_id: string; score: number | null; feedback: string; rubric?: string[] }) {
    const { data: { user } } = await this.sb.auth.getUser();
    const { error } = await this.sb.from("grades").upsert({ ...g, rubric: g.rubric ?? null, graded_by: user?.id, graded_at: new Date().toISOString() }, { onConflict: "student_id,session_id" });
    if (error) throw error;
    if (g.score != null) this.notify("grade", { student_id: g.student_id, session_id: g.session_id });
  }
  async roster() { const { data } = await this.sb.from("roster").select("email,full_name,role").order("full_name"); return (data || []) as { email: string; full_name: string | null; role: Role }[]; }
  async addToRoster(rows: { email: string; full_name?: string; role?: Role }[]) { await this.sb.from("roster").upsert(rows.map(r => ({ email: r.email.toLowerCase(), full_name: r.full_name ?? null, role: r.role ?? "student" })), { onConflict: "email" }); }
  async removeFromRoster(email: string) { await this.sb.from("roster").delete().eq("email", email); }
  async setRole(id: string, role: Role) { await this.sb.from("profiles").update({ role }).eq("id", id); }
  async signedUrl(path: string) { const { data } = await this.sb.storage.from("submissions").createSignedUrl(path, 3600); return data?.signedUrl || ""; }

  // ----- extension -----
  async settings() { const { data } = await this.sb.from("course_settings").select("*").eq("id", 1).single(); const d = data as (CourseSettings & { id?: number; updated_at?: string }) | null; if (!d) return { start_date: "2026-10-12", class_days: [1, 2, 4], email_on: false, showcase_posting: true, showcase_comments: true }; const { id: _i, updated_at: _u, ...rest } = d; void _i; void _u; return rest as CourseSettings; }
  async saveSettings(s: CourseSettings) { await this.sb.from("course_settings").upsert({ id: 1, ...s, updated_at: new Date().toISOString() }); }
  async calendarDays() { const { data } = await this.sb.from("calendar_days").select("day,kind,label").order("day"); return (data || []) as CalendarDay[]; }
  async setCalendarDay(d: CalendarDay | { day: string; remove: true }) { if ("remove" in d) await this.sb.from("calendar_days").delete().eq("day", d.day); else await this.sb.from("calendar_days").upsert(d, { onConflict: "day" }); }
  async slots() { const { data } = await this.sb.from("office_hour_slots").select("*").order("weekday").order("start_time"); return (data || []) as Slot[]; }
  async saveSlot(sl: Omit<Slot, "id"> & { id?: number }) { await this.sb.from("office_hour_slots").upsert(sl); }
  async deleteSlot(id: number) { await this.sb.from("office_hour_slots").delete().eq("id", id); }
  async ohRequests() { const { data } = await this.sb.from("office_hour_requests").select("*").order("requested_at"); return (data || []) as OHRequest[]; }
  async requestOH(r: { slot_id: number | null; requested_at: string; topic: string }) { const { data: { user } } = await this.sb.auth.getUser(); if (!user) return; const { error } = await this.sb.from("office_hour_requests").insert({ student_id: user.id, ...r }); if (error) throw error; this.notify("oh_request", { when: r.requested_at, topic: r.topic }); }
  async updateOH(id: number, patch: Partial<Pick<OHRequest, "status" | "instructor_note" | "proposed_at" | "requested_at">>) { const { error } = await this.sb.from("office_hour_requests").update(patch).eq("id", id); if (error) throw error; }
  async messages(threadStudentId?: string) { let q = this.sb.from("messages").select("*").order("created_at"); if (threadStudentId) q = q.eq("thread_student_id", threadStudentId); const { data } = await q; return (data || []) as Message[]; }
  async sendMessage(threadStudentId: string, body: string) { const { data: { user } } = await this.sb.auth.getUser(); if (!user) return; const { error } = await this.sb.from("messages").insert({ thread_student_id: threadStudentId, sender_id: user.id, body }); if (error) throw error; this.notify("message", { thread_student_id: threadStudentId }); }
  async markRead(threadStudentId: string) { const { data: { user } } = await this.sb.auth.getUser(); if (!user) return; await this.sb.from("messages").update({ read_at: new Date().toISOString() }).eq("thread_student_id", threadStudentId).neq("sender_id", user.id).is("read_at", null); }
  async announcements() { const { data } = await this.sb.from("announcements").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false }); return (data || []) as Announcement[]; }
  async postAnnouncement(a: { title: string; body: string; pinned: boolean }) { const { error } = await this.sb.from("announcements").insert(a); if (error) throw error; this.notify("announcement", { title: a.title, body: a.body }); }
  async deleteAnnouncement(id: number) { await this.sb.from("announcements").delete().eq("id", id); }
  async flashcards() { const { data } = await this.sb.from("flashcards").select("term_key,status,due,streak,obj"); return (data || []) as Flashcard[]; }
  async rateCard(term_key: string, obj: string, got: boolean) {
    const { data: { user } } = await this.sb.auth.getUser(); if (!user) return;
    const cur = (await this.flashcards()).find(f => f.term_key === term_key);
    const next = scheduleCard(cur, got);
    const { error } = await this.sb.from("flashcards").upsert({ student_id: user.id, term_key, obj, status: got ? "known" : "review", streak: next.streak, due: next.due, updated_at: new Date().toISOString() }, { onConflict: "student_id,term_key" });
    if (error) throw error;
  }
  async mockAttempts() { const { data } = await this.sb.from("mock_attempts").select("*").order("created_at", { ascending: false }); return (data || []) as MockAttempt[]; }
  async saveMock(m: MockAttempt) { const { data: { user } } = await this.sb.auth.getUser(); if (!user) return; const { error } = await this.sb.from("mock_attempts").insert({ ...m, student_id: user.id }); if (error) throw error; }
  async setFlashcard(term_key: string, status: "known" | "review" | null) { const { data: { user } } = await this.sb.auth.getUser(); if (!user) return; if (!status) await this.sb.from("flashcards").delete().eq("student_id", user.id).eq("term_key", term_key); else await this.sb.from("flashcards").upsert({ student_id: user.id, term_key, status, updated_at: new Date().toISOString() }, { onConflict: "student_id,term_key" }); }
  // ----- content, materials, attendance -----
  async allContent() { const { data } = await this.sb.from("session_content").select("session_id,content,version_note,updated_at,verified_at,verification"); return (data || []) as ContentRow[]; }
  async saveContent(session_id: string, content: SessionContent, version_note: string) { const { data: { user } } = await this.sb.auth.getUser(); const { error } = await this.sb.from("session_content").upsert({ session_id, content, version_note, updated_at: new Date().toISOString(), updated_by: user?.id, verified_at: content.verified ? `${content.verified.date}T12:00:00Z` : null, verified_by: user?.id, verification: content.verified ? { checks: Object.fromEntries(content.verified.checks.map(c => [c, true])), note: content.verified.note } : null }, { onConflict: "session_id" }); if (error) throw error; }
  async materials() { const { data } = await this.sb.from("session_materials").select("*").order("created_at"); return ((data || []) as Material[]).map(m => ({ ...m, url: m.file_path ? this.sb.storage.from("materials").getPublicUrl(m.file_path).data.publicUrl : m.url })); }
  async addMaterial(m: { session_id: string; kind: Material["kind"]; title: string; file?: File; url?: string }) {
    let file_path: string | null = null;
    if (m.file) { const ext = m.file.name.split(".").pop() || "bin"; file_path = `${m.session_id}/${m.kind}-${Date.now()}.${ext}`; const { error } = await this.sb.storage.from("materials").upload(file_path, m.file, { contentType: m.file.type || undefined }); if (error) throw error; }
    const { error } = await this.sb.from("session_materials").insert({ session_id: m.session_id, kind: m.kind, title: m.title, file_path, url: m.url ?? null }); if (error) throw error;
  }
  async recordings() { const { data, error } = await this.sb.from("session_recordings").select("*").order("created_at"); if (error && !/session_recordings/.test(error.message)) throw error; return (data || []) as Recording[]; }
  async addRecording(r: { session_id: string; title: string; url: string; passcode?: string; recorded_on?: string | null }) {
    const { error } = await this.sb.from("session_recordings").insert({ session_id: r.session_id, title: r.title, url: r.url, passcode: r.passcode || null, recorded_on: r.recorded_on || null });
    if (error) throw new Error(/session_recordings/.test(error.message) ? "The recordings table doesn't exist yet. Run supabase-run-once/schema-oct14-quiz-recordings.sql in the Supabase SQL editor." : error.message);
  }
  async deleteRecording(id: number) { const { error } = await this.sb.from("session_recordings").delete().eq("id", id); if (error) throw error; }
  async deleteMaterial(id: number) { const { data } = await this.sb.from("session_materials").select("file_path").eq("id", id).single(); if (data?.file_path) await this.sb.storage.from("materials").remove([data.file_path]); await this.sb.from("session_materials").delete().eq("id", id); }
  async attendance() { const { data } = await this.sb.from("attendance").select("student_id,session_id,status"); return (data || []) as Attendance[]; }
  async setAttendance(student_id: string, session_id: string, status: Attendance["status"] | null) { if (!status) await this.sb.from("attendance").delete().eq("student_id", student_id).eq("session_id", session_id); else await this.sb.from("attendance").upsert({ student_id, session_id, status, marked_at: new Date().toISOString() }, { onConflict: "student_id,session_id" }); }
  // ----- October 7: readiness, showcase, capstone, portfolio, email -----
  async allMocks() { const { data } = await this.sb.from("mock_attempts").select("*").order("created_at", { ascending: false }); return (data || []) as MockAttempt[]; }
  async allFlashcards() { const { data } = await this.sb.from("flashcards").select("student_id,term_key,status,streak,obj"); return (data || []) as FlashcardRow[]; }
  async showcase() {
    const { data: { user } } = await this.sb.auth.getUser();
    const { data, error } = await this.sb.from("showcase").select("*, submission:submissions(kind,body,file_path), author:profiles!showcase_student_id_fkey(full_name,role)").order("created_at", { ascending: false });
    if (error) throw error;
    type Row = ShowcaseItem & { submission: { kind: ShowcaseItem["kind"]; body: string | null; file_path: string | null } | null; author: unknown };
    const rows = (data || []) as unknown as Row[];
    const ids = rows.map(r => r.id);
    const [{ data: rx }, { data: cm }] = ids.length ? await Promise.all([
      this.sb.from("showcase_reactions").select("post_id,user_id,emoji").in("post_id", ids),
      this.sb.from("showcase_comments").select("post_id").in("post_id", ids),
    ]) : [{ data: [] }, { data: [] }];
    const subPaths = rows.map(r => r.submission?.file_path).filter((x): x is string => !!x);
    const subSigned = subPaths.length ? (await this.sb.storage.from("submissions").createSignedUrls(subPaths, 3600)).data || [] : [];
    const imgPaths = rows.flatMap(r => r.images || []);
    const imgSigned = imgPaths.length ? (await this.sb.storage.from("showcase").createSignedUrls(imgPaths, 3600)).data || [] : [];
    const url = new Map([...subSigned, ...imgSigned].map(d => [d.path, d.signedUrl]));
    return rows.filter(r => r.submission || r.post_type !== "lab").map(r => {
      const a = r.author as unknown as { full_name: string; role: string } | null;
      const reactions = noReactions(); const mine: ReactionKey[] = [];
      ((rx || []) as { post_id: number; user_id: string; emoji: ReactionKey }[]).filter(x => x.post_id === r.id).forEach(x => { reactions[x.emoji]++; if (x.user_id === user?.id) mine.push(x.emoji); });
      return { ...r, kind: r.submission?.kind ?? null, body: r.submission?.body ?? null, url: r.submission?.file_path ? url.get(r.submission.file_path) ?? undefined : undefined,
        images: r.images || [], image_urls: (r.images || []).map(p => url.get(p) || "").filter(Boolean),
        author: a?.role === "instructor" ? a.full_name : shortName(a?.full_name || "Classmate"), author_role: a?.role,
        reactions, my_reactions: mine, comment_count: ((cm || []) as { post_id: number }[]).filter(x => x.post_id === r.id).length };
    }) as ShowcaseItem[];
  }
  async share(submission_id: number, caption: string) {
    const { data: { user } } = await this.sb.auth.getUser(); if (!user) return;
    const { data: sub } = await this.sb.from("submissions").select("session_id").eq("id", submission_id).single();
    const { error } = await this.sb.from("showcase").insert({ submission_id, student_id: user.id, session_id: sub?.session_id, caption: caption || null, post_type: "lab" }); if (error) throw friendlyPostError(error);
  }
  async unshare(id: number) { const { error } = await this.sb.from("showcase").delete().eq("id", id); if (error) throw error; }
  async moderate(id: number, patch: ModeratePatch) { const { error } = await this.sb.from("showcase").update(patch).eq("id", id); if (error) throw error; }
  async createPost(p: NewPost) {
    const { data: { user } } = await this.sb.auth.getUser(); if (!user) throw new Error("Not signed in");
    const images: string[] = [];
    for (const b of p.images) { const path = `${user.id}/${Date.now()}-${images.length}.jpg`; const { error } = await this.sb.storage.from("showcase").upload(path, b, { contentType: "image/jpeg" }); if (error) throw error; images.push(path); }
    const { error } = await this.sb.from("showcase").insert({ student_id: user.id, post_type: p.post_type, title: p.title, text: p.text || null, link_url: p.link_url || null, images });
    if (error) { if (images.length) await this.sb.storage.from("showcase").remove(images); throw friendlyPostError(error); }
  }
  async deletePost(id: number) {
    const { data } = await this.sb.from("showcase").select("images").eq("id", id).single();
    const { error } = await this.sb.from("showcase").delete().eq("id", id); if (error) throw error;
    const imgs = (data as { images: string[] } | null)?.images || []; if (imgs.length) await this.sb.storage.from("showcase").remove(imgs);
  }
  async react(post_id: number, emoji: ReactionKey, on: boolean) {
    const { data: { user } } = await this.sb.auth.getUser(); if (!user) return;
    const { error } = on ? await this.sb.from("showcase_reactions").insert({ post_id, user_id: user.id, emoji }) : await this.sb.from("showcase_reactions").delete().eq("post_id", post_id).eq("user_id", user.id).eq("emoji", emoji);
    if (error && !/duplicate/i.test(error.message)) throw error;
  }
  async comments(post_id: number) {
    const { data, error } = await this.sb.from("showcase_comments").select("*, author:profiles!showcase_comments_author_id_fkey(full_name,role)").eq("post_id", post_id).order("created_at"); if (error) throw error;
    return ((data || []) as (ShowcaseComment & { author: unknown })[]).map(c => { const a = c.author as unknown as { full_name: string; role: string } | null; return { ...c, author: a?.role === "instructor" ? a.full_name : shortName(a?.full_name || "Classmate"), author_role: a?.role }; });
  }
  async addComment(post_id: number, body: string) {
    const { data: { user } } = await this.sb.auth.getUser(); if (!user) return;
    const { error } = await this.sb.from("showcase_comments").insert({ post_id, author_id: user.id, body }); if (error) throw friendlyPostError(error, true);
  }
  async deleteComment(id: number) { const { error } = await this.sb.from("showcase_comments").delete().eq("id", id); if (error) throw error; }
  async hideComment(id: number, hidden: boolean) { const { error } = await this.sb.from("showcase_comments").update({ hidden }).eq("id", id); if (error) throw error; }
  async showcaseMutes() { const { data } = await this.sb.from("showcase_mutes").select("student_id"); return ((data || []) as { student_id: string }[]).map(x => x.student_id); }
  async setMute(student_id: string, muted: boolean) { const { error } = muted ? await this.sb.from("showcase_mutes").upsert({ student_id }) : await this.sb.from("showcase_mutes").delete().eq("student_id", student_id); if (error) throw error; }
  async capstones() { const { data } = await this.sb.from("capstones").select("*"); return (data || []) as CapstoneRow[]; }
  async saveCapstone(c: Omit<CapstoneRow, "student_id" | "updated_at">) { const { data: { user } } = await this.sb.auth.getUser(); if (!user) return; const { error } = await this.sb.from("capstones").upsert({ student_id: user.id, ...c, updated_at: new Date().toISOString() }, { onConflict: "student_id" }); if (error) throw error; }
  async milestones() { const { data } = await this.sb.from("capstone_milestones").select("*"); return (data || []) as MilestoneRow[]; }
  async submitMilestone(m: { milestone: string; link: string; note: string }) { const { data: { user } } = await this.sb.auth.getUser(); if (!user) return; const { error } = await this.sb.from("capstone_milestones").upsert({ student_id: user.id, milestone: m.milestone, link: m.link || null, note: m.note || null, status: "submitted", updated_at: new Date().toISOString() }, { onConflict: "student_id,milestone" }); if (error) throw error; }
  async reviewMilestone(m: { student_id: string; milestone: string; status: MilestoneStatus; instructor_note: string }) { const { error } = await this.sb.from("capstone_milestones").upsert({ ...m, instructor_note: m.instructor_note || null, updated_at: new Date().toISOString() }, { onConflict: "student_id,milestone" }); if (error) throw error; this.notify("capstone", { student_id: m.student_id, milestone: m.milestone, status: m.status }); }
  async myPortfolio() { const { data: { user } } = await this.sb.auth.getUser(); if (!user) return null; const { data } = await this.sb.from("portfolios").select("*").eq("student_id", user.id).maybeSingle(); return (data as Portfolio) || null; }
  async allPortfolios() { const { data } = await this.sb.from("portfolios").select("*"); return (data || []) as Portfolio[]; }
  async savePortfolio(p: Omit<Portfolio, "student_id" | "updated_at">) { const { data: { user } } = await this.sb.auth.getUser(); if (!user) return; const { error } = await this.sb.from("portfolios").upsert({ student_id: user.id, ...p, updated_at: new Date().toISOString() }, { onConflict: "student_id" }); if (error) throw new Error(/duplicate|unique/i.test(error.message) ? "That web address is taken. Try another." : error.message); }
  async publicPortfolio(slug: string) { const { data } = await this.sb.from("portfolios").select("*").eq("slug", slug).eq("published", true).maybeSingle(); return (data as Portfolio) || null; }
  async portfolioImage(file: Blob) { const { data: { user } } = await this.sb.auth.getUser(); if (!user) throw new Error("Not signed in"); const path = `${user.id}/${Date.now()}.jpg`; const { error } = await this.sb.storage.from("portfolio").upload(path, file, { contentType: "image/jpeg" }); if (error) throw error; return this.sb.storage.from("portfolio").getPublicUrl(path).data.publicUrl; }
  async submissionToPortfolioImage(file_path: string) { const { data, error } = await this.sb.storage.from("submissions").download(file_path); if (error || !data) throw error || new Error("Download failed"); return this.portfolioImage(data); }
  async notify(kind: NotifyKind, payload: Record<string, unknown> = {}) {
    try {
      const { data, error } = await this.sb.functions.invoke("notify", { body: { kind, ...payload } });
      if (error) return { ok: false, error: await explainFnError(error) };
      return (data as { ok: boolean; error?: string; skipped?: string }) || { ok: true };
    }
    catch (e) { return { ok: false, error: (e as Error).message }; }
  }
  async notifyPrefs() { const { data: { user } } = await this.sb.auth.getUser(); if (!user) return { opt_out: false }; const { data } = await this.sb.from("notify_prefs").select("opt_out").eq("student_id", user.id).maybeSingle(); return { opt_out: !!data?.opt_out }; }
  async setNotifyPrefs(opt_out: boolean) { const { data: { user } } = await this.sb.auth.getUser(); if (!user) return; const { error } = await this.sb.from("notify_prefs").upsert({ student_id: user.id, opt_out }, { onConflict: "student_id" }); if (error) throw error; }
  async notifyLog() { const { data } = await this.sb.from("notify_log").select("*").order("created_at", { ascending: false }).limit(20); return (data || []) as NotifyLog[]; }
  private async withUrls(rows: Submission[]): Promise<Submission[]> {
    const paths = rows.filter(r => r.file_path).map(r => r.file_path!);
    if (!paths.length) return rows;
    const { data } = await this.sb.storage.from("submissions").createSignedUrls(paths, 3600);
    const map = new Map((data || []).map(d => [d.path, d.signedUrl]));
    return rows.map(r => ({ ...r, url: (r.file_path ? map.get(r.file_path) : undefined) ?? undefined }));
  }
}

// ---------------- Demo (in-memory, seeded) ----------------
const DEMO_NAMES = ["Dana Reyes", "Marcus Hill", "Priya Nair", "Tom Okafor", "Leah Brooks", "Sam Whitfield", "Ana Castillo", "Devin Park", "Rosa Lindqvist", "Jamal Carter", "Kim Nguyen", "Owen Hart"];
function seedDemo() {
  const profiles: Profile[] = [{ id: "u-instr", email: "instructor@example.com", full_name: "Roland (Instructor)", role: "instructor", created_at: new Date().toISOString() }];
  DEMO_NAMES.forEach((n, i) => profiles.push({ id: `u${i + 1}`, email: `${n.toLowerCase().replace(/[^a-z]/g, ".")}@example.com`, full_name: n, role: "student", created_at: new Date(Date.now() - 86400000 * 14).toISOString() }));
  const progress: Progress[] = []; const grades: Grade[] = []; const submissions: Submission[] = [];
  const rnd = (seed: number) => { let x = seed; return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }; };
  const R = rnd(42);
  const SEED_JSON: Record<string, unknown> = { w01d1, w01d2, w01d3 };
  const SEED: Record<string, { steps?: unknown[]; sandbox?: string }> = { w01d1: w01d1 as never, w01d2: w01d2 as never, w01d3: w01d3 as never };
  const built = SESSIONS.filter(s => SEED[s.id]).map(s => ({ ...s, steps: (SEED[s.id].steps || []) as unknown as Session["steps"], sandbox: SEED[s.id].sandbox as Session["sandbox"] }));
  DEMO_NAMES.forEach((_, i) => {
    const uid = `u${i + 1}`;
    const ability = i === 1 || i === 7 ? 0.35 : i === 3 ? 0.5 : 0.8 + R() * 0.2; // two struggling, one middling
    const daysAgo = i === 7 ? 9 : Math.floor(R() * 3);
    built.forEach((s, k) => {
      const n = s.steps?.length || 0;
      const done = Math.round(n * Math.min(1, ability * (1.2 - k * 0.15) + (R() - 0.5) * 0.3));
      const steps = Array.from({ length: n }, (_, j) => j < Math.max(0, done));
      // First-try picks: one question per session is a trap most people miss, and they miss it toward the same wrong option.
      const quiz = s.quiz?.length ? s.quiz : ((({ w01d1, w01d2, w01d3 } as Record<string, { quiz?: { a: string[]; c: number }[] }>)[s.id]?.quiz) || []);
      const trap = (k * 2 + 2) % Math.max(1, quiz.length);
      const first = quiz.map((q, qi) => { const pRight = Math.min(0.95, ability * (qi === trap ? 0.45 : 1.05)); if (R() < pRight) return q.c; const wrong = q.a.map((_, j) => j).filter(j => j !== q.c); return R() < 0.7 ? wrong[0] : wrong[Math.floor(R() * wrong.length)]; });
      const firstScore = first.filter((x, qi) => x === quiz[qi].c).length;
      const attempts = done > 0 ? 1 + (firstScore < 4 && R() < 0.6 ? 1 : 0) : 0;
      const qb = Math.min(quiz.length || 5, firstScore + (attempts > 1 ? 1 + Math.round(R()) : 0));
      progress.push({ student_id: uid, session_id: s.id, steps, goal: done > 0 ? "Compare three assistants on my job's weekly reporting task." : null, quiz_best: done > 0 ? qb : null, quiz_last: done > 0 ? qb : null, quiz_attempts: attempts, quiz_first: done > 0 ? first : null, quiz_picks: done > 0 ? first : null, sandbox: s.sandbox && done > 2 ? { train: 92, test: 71 } : null, responses: done > 1 ? { "1": "1. What does a data engineer do day to day?\n2. Which skills should I learn first?\n3. How is AI changing the role?" } : {}, updated_at: new Date(Date.now() - 86400000 * (daysAgo + k)).toISOString() });
      if (done === n && n > 0) {
        submissions.push({ id: submissions.length + 1, student_id: uid, session_id: s.id, kind: k === 2 ? "link" : "text", body: k === 2 ? "https://docs.google.com/spreadsheets/d/example" : "The model learned the background, not the mug. Every mug photo was on the brown desk.", file_path: null, created_at: new Date(Date.now() - 86400000 * (daysAgo + k)).toISOString() });
        if (R() < 0.7) grades.push({ student_id: uid, session_id: s.id, score: Math.round(60 + ability * 40 - R() * 8), feedback: "Clear failure sentence. Add what data would fix it next time.", graded_at: new Date().toISOString() });
      }
    });
  });
  const releases: Release[] = [{ session_id: "w01d1", student_id: null, unlocked_at: "" }, { session_id: "w01d2", student_id: null, unlocked_at: "" }, { session_id: "w01d3", student_id: null, unlocked_at: "" }];
  const settings: CourseSettings = { start_date: "2026-10-12", class_days: [1, 2, 4], email_on: false, showcase_posting: true, showcase_comments: true };
  const calendar: CalendarDay[] = [{ day: "2026-11-26", kind: "holiday", label: "Thanksgiving" }, { day: "2026-12-22", kind: "holiday", label: "Winter break" }, { day: "2026-12-24", kind: "holiday", label: "Winter break" }, { day: "2026-12-29", kind: "holiday", label: "Winter break" }, { day: "2026-12-31", kind: "holiday", label: "Winter break" }];
  const slots: Slot[] = [{ id: 1, weekday: 2, start_time: "17:00", minutes: 15, capacity: 1, location: "Zoom (link in announcement)", active: true }, { id: 2, weekday: 2, start_time: "17:15", minutes: 15, capacity: 1, location: "Zoom (link in announcement)", active: true }, { id: 3, weekday: 2, start_time: "17:30", minutes: 15, capacity: 1, location: "Zoom (link in announcement)", active: true }, { id: 4, weekday: 4, start_time: "17:30", minutes: 15, capacity: 1, location: "Classroom, before class", active: true }];
  const oh: OHRequest[] = [{ id: 1, student_id: "u2", slot_id: 1, requested_at: "2026-10-13T17:00:00", topic: "I keep getting different answers from the three assistants and don't know which to trust.", status: "pending", instructor_note: null, created_at: new Date().toISOString() }, { id: 2, student_id: "u8", slot_id: null, requested_at: "2026-10-14T12:00:00", topic: "Missed Day 2. Can we go over Teachable Machine?", status: "pending", instructor_note: null, created_at: new Date().toISOString() }];
  const msgs: Message[] = [{ id: 1, thread_student_id: "u2", sender_id: "u2", body: "Hi Roland, my Teachable Machine model keeps saying 'mug' for everything. I retrained twice.", created_at: new Date(Date.now() - 3600e3 * 20).toISOString(), read_at: null }, { id: 2, thread_student_id: "u1", sender_id: "u1", body: "Is it okay to use my work's actual sales sheet for the Week 6 lab, or should I use the Bloom & Vine one?", created_at: new Date(Date.now() - 3600e3 * 5).toISOString(), read_at: null }, { id: 3, thread_student_id: "u1", sender_id: "u-instr", body: "Use Bloom & Vine in class so we're all looking at the same numbers. Your own sheet is a great Stretch though.", created_at: new Date(Date.now() - 3600e3 * 4).toISOString(), read_at: null }];
  const anns: Announcement[] = [{ id: 1, title: "Welcome to Software/AI", body: "Before Thursday: make sure you have a Google account and a laptop you can install software on. Bring one task from your job or target job that you'd like AI to help with.", pinned: true, created_at: new Date(Date.now() - 86400e3 * 2).toISOString() }, { id: 2, title: "Office hours are open", body: "Tuesdays 5 to 5:45 PM on Zoom and Thursdays 5:30 PM in the classroom. Book from the Calendar page.", pinned: false, created_at: new Date(Date.now() - 86400e3).toISOString() }];
  const flashcards: Flashcard[] = [{ term_key: "w01d1|c01", status: "known", streak: 1, due: new Date(Date.now() + 5 * 864e5).toISOString(), obj: "1.1.2" }, { term_key: "w01d1|c04", status: "review", streak: 0, due: new Date().toISOString(), obj: "1.2.2" }];
  // Mock attempts for most students, built from the real Week 1 practice questions so the readiness panel has something to show.
  const PQ = (["w01d1", "w01d2", "w01d3"] as const).flatMap(id => (((SEED_JSON[id] as { exam?: { practice?: { id: string; obj: string }[] } }).exam?.practice) || []).map(q => ({ id: `${id}|${q.id}`, obj: q.obj })));
  const mocks: MockAttempt[] = [];
  const ability = (i: number) => i === 1 || i === 7 ? 0.45 : i === 3 ? 0.6 : 0.72 + ((i * 37) % 23) / 100;
  DEMO_NAMES.forEach((_, i) => {
    if (i === 10) return; // one student hasn't tried a mock yet
    const n = i % 3 === 0 ? 3 : i % 3 === 1 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const pick = PQ.filter((_, j) => (j + k + i) % 2 === 0).slice(0, 12);
      const a = Math.min(0.97, ability(i) + k * 0.06);
      const answers = pick.map((q, j) => ({ id: q.id, obj: q.obj, correct: ((j * 7 + i * 3 + k) % 100) / 100 < a }));
      const correct = answers.filter(x => x.correct).length;
      mocks.push({ id: `m${i}-${k}`, student_id: `u${i + 1}`, scope: "all", total: answers.length, correct, scaled: Math.round(100 + 900 * correct / answers.length), seconds: 60 * answers.length, answers, created_at: new Date(Date.now() - 864e5 * (6 - k * 2 - (i % 2))).toISOString() });
    }
  });
  mocks.sort((x, y) => (y.created_at || "").localeCompare(x.created_at || ""));
  const showcase: ShowcaseItem[] = submissions.filter((_, j) => j % 4 === 0).slice(0, 6).map((x, j) => ({ id: j + 1, submission_id: x.id, student_id: x.student_id, session_id: x.session_id, caption: ["My model learned the desk, not the mug. Here's the sentence that explains it.", "Three assistants, one question about my warehouse job. Gemini was the most confident and the most wrong.", "My confusion matrix. Recall dropped from 0.9 to 0.7 when I moved one count.", "Turns out 'formal' means something different to me and my partner.", "Spam filter vs smoke detector: which mistake costs more in my job.", "Sorting eight applications was harder than it looked."][j], hidden: false, featured: j === 0, created_at: x.created_at, kind: x.kind, body: x.body, author: shortName(profiles.find(p => p.id === x.student_id)!.full_name), post_type: "lab" as const, title: null, text: null, link_url: null, images: [], pinned: false, comments_locked: false, reactions: noReactions(), my_reactions: [], comment_count: 0 }));
  const ago = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();
  const post = (id: number, student_id: string, post_type: ShowcaseItem["post_type"], title: string, text: string, link_url: string | null, h: number, extra: Partial<ShowcaseItem> = {}): ShowcaseItem => ({ id, submission_id: null, student_id, session_id: null, caption: null, hidden: false, featured: false, created_at: ago(h), kind: null, body: null, author: "", post_type, title, text, link_url, images: [], pinned: false, comments_locked: false, reactions: noReactions(), my_reactions: [], comment_count: 0, ...extra });
  showcase.unshift(
    post(101, "u-instr", "question", "Show us one task you'd hand to an AI tomorrow", "Post one task from your current job you'd trust an AI with, and one you never would. Comment on two classmates' posts with a question.", null, 2, { pinned: true }),
    post(102, "u1", "project", "I rebuilt my team's shift-swap form with a no-code automation", "Before: a group text and a spreadsheet nobody updated. After: a form, a sheet, and an email to the manager. Took one evening. Still deciding whether an AI step adds anything.", null, 5),
    post(103, "u2", "video", "Short explainer: why classifiers cheat", "This 5-minute video made the skew trap from Day 2 click for me.", "https://www.youtube.com/watch?v=aircAruvnKk", 9),
    post(104, "u3", "article", "Plain-English read on how LLMs predict the next word", "Good companion to Week 2. No math needed.", "https://www.anthropic.com/research", 20),
    post(105, "u4", "idea", "Idea: an AI checklist for warehouse safety walk-throughs", "Photos in, missing-guardrail flags out. Is this a classification problem or object detection?", null, 30),
  );
  const reactions: { post_id: number; user_id: string; emoji: ReactionKey }[] = [];
  [[101, "u1", "like"], [101, "u2", "like"], [101, "u3", "clap"], [102, "u2", "fire"], [102, "u3", "fire"], [102, "u4", "like"], [102, "u-instr", "clap"], [103, "u1", "learned"], [103, "u4", "learned"], [105, "u1", "question"], [1, "u2", "learned"]].forEach(([post_id, user_id, emoji]) => reactions.push({ post_id: post_id as number, user_id: user_id as string, emoji: emoji as ReactionKey }));
  const comments: (Omit<ShowcaseComment, "author" | "author_role">)[] = [
    { id: 1, post_id: 102, author_id: "u2", body: "Did your manager actually start using it? That's always the hard part for us.", hidden: false, created_at: ago(4) },
    { id: 2, post_id: 102, author_id: "u1", body: "Two weeks in, yes. The email step is what sold her.", hidden: false, created_at: ago(3) },
    { id: 3, post_id: 105, author_id: "u-instr", body: "Great question for Week 2. If you only need 'guardrail missing yes or no', classification. If you need to point at where, object detection.", hidden: false, created_at: ago(25) },
  ];
  const showcaseMutes: string[] = [];
  const recordings: Recording[] = [{ id: 1, session_id: "w01d1", title: "Class recording, Mon, Oct 12", url: "https://us06web.zoom.us/rec/share/example-w01d1", passcode: "Ai#2026x", recorded_on: "2026-10-12", created_at: new Date().toISOString() }];
  const capstones: CapstoneRow[] = [{ student_id: "u1", title: "Intake triage assistant for a physical therapy clinic", stakeholder: "Front desk manager, Riverbend PT", problem: "Staff spend about 6 hours a week sorting web inquiries by insurance, urgency, and location." }, { student_id: "u3", title: "Grant deadline tracker for a food bank", stakeholder: "Development director", problem: "Deadlines live in five inboxes and two were missed last year." }];
  const milestones: MilestoneRow[] = [{ student_id: "u1", milestone: "stakeholder", status: "approved", link: null, note: "Met with the front desk manager on Oct 2.", instructor_note: "Good fit. Real pain, measurable." }, { student_id: "u1", milestone: "proposal", status: "submitted", link: "https://docs.google.com/document/d/example", note: "Requirements and ROI case attached.", instructor_note: null }, { student_id: "u3", milestone: "stakeholder", status: "submitted", link: null, note: "Interview booked for next week.", instructor_note: null }];
  const portfolios: Portfolio[] = [{ student_id: "u1", slug: "dana-reyes", published: true, display_name: "Dana Reyes", headline: "Operations coordinator moving into AI automation", bio: "Ten years running front-office operations. I build small, measurable AI tools that take repetitive work off busy teams.", location: "Huntsville, AL", linkedin: "https://www.linkedin.com/", credly: null, email_public: null, capstone: { title: "Intake triage assistant for a physical therapy clinic", summary: "Sorts web inquiries by insurance, urgency, and location so the front desk starts each day with a ranked list." }, items: [{ title: "Three assistants, one question", blurb: "Compared ChatGPT, Claude, and Gemini on a real reporting task and marked every error." }, { title: "Breaking a classifier on purpose", blurb: "Trained an image model, then skewed its data to show how it learns shortcuts." }] }];
  const notifyLog: NotifyLog[] = [];
  const notifyPrefs: Record<string, boolean> = {};
  const content: ContentRow[] = [["w01d1", w01d1], ["w01d2", w01d2], ["w01d3", w01d3]].map(([id, c], i) => ({ session_id: id as string, content: c as unknown as SessionContent, version_note: "Built Oct 6, 2026", updated_at: new Date(Date.now() - 86400e3).toISOString(), verified_at: i === 0 ? new Date().toISOString() : i === 1 ? new Date(Date.now() - 86400e3 * 4).toISOString() : null, verification: i < 2 ? { checks: { tools: true, links: true, facts: true, quiz: true, guide: true }, note: "Free tiers confirmed on vendor pricing pages." } : null }));
  const materials: Material[] = [{ id: 1, session_id: "w01d1", kind: "student_guide", title: "Week 1 Day 1 Student Guide", file_path: null, url: "#", created_at: new Date().toISOString() }, { id: 2, session_id: "w01d1", kind: "slides", title: "Slides (Gamma)", file_path: null, url: "https://gamma.app", created_at: new Date().toISOString() }];
  const attendance: Attendance[] = [];
  return { content, materials, attendance, settings, calendar, slots, oh, msgs, anns, flashcards, mocks, showcase, capstones, milestones, portfolios, notifyLog, notifyPrefs, reactions, comments, showcaseMutes, recordings, profiles, progress, grades, submissions, releases, roster: profiles.map(p => ({ email: p.email, full_name: p.full_name as string | null, role: p.role })) };
}

class DemoStore implements Store {
  demo = true;
  d = seedDemo();
  me: string | null = "u1";
  listeners = new Set<() => void>();
  private emit() { this.listeners.forEach(f => f()); }
  demoSwitchUser(id: string) { this.me = id; this.emit(); }
  async currentUser() { return this.d.profiles.find(p => p.id === this.me) || null; }
  async sendSignInLink(_email: string) { void _email; return {}; }
  async signInWithEmail(email: string) { const p = this.d.profiles.find(p => p.email === email.toLowerCase()); if (!p) return { error: "Demo mode: use one of the example emails, or click a demo user." }; this.me = p.id; this.emit(); return {}; }
  async signOut() { this.me = null; this.emit(); }
  onAuthChange(cb: () => void) { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; }
  async myProgress() { return this.d.progress.filter(p => p.student_id === this.me); }
  async saveProgress(p: Partial<Progress> & { session_id: string }) {
    const i = this.d.progress.findIndex(x => x.student_id === this.me && x.session_id === p.session_id);
    const base: Progress = i >= 0 ? this.d.progress[i] : { student_id: this.me!, session_id: p.session_id, steps: [], goal: null, quiz_best: null, quiz_last: null, quiz_attempts: 0, sandbox: null, responses: {}, updated_at: "" };
    const next = { ...base, ...p, updated_at: new Date().toISOString() };
    if (i >= 0) this.d.progress[i] = next; else this.d.progress.push(next);
  }
  async mySubmissions() { return this.d.submissions.filter(s => s.student_id === this.me); }
  async addSubmission(s: { session_id: string; kind: Submission["kind"]; body?: string; file?: Blob }) {
    const url = s.file ? URL.createObjectURL(s.file) : undefined;
    this.d.submissions.push({ id: Date.now(), student_id: this.me!, session_id: s.session_id, kind: s.kind, body: s.body ?? null, file_path: s.file ? "demo" : null, created_at: new Date().toISOString(), url });
  }
  async deleteSubmission(id: number) { this.d.submissions = this.d.submissions.filter(s => s.id !== id); }
  async myGrades() { return this.d.grades.filter(g => g.student_id === this.me); }
  async releases() { return this.d.releases; }
  async allProfiles() { return this.d.profiles; }
  async allProgress() { return this.d.progress; }
  async allSubmissions() { return this.d.submissions; }
  async allGrades() { return this.d.grades; }
  async setRelease(session_id: string, student_id: string | null, unlocked: boolean) {
    this.d.releases = this.d.releases.filter(r => !(r.session_id === session_id && r.student_id === student_id));
    if (unlocked) this.d.releases.push({ session_id, student_id, unlocked_at: new Date().toISOString() });
  }
  async saveGrade(g: { student_id: string; session_id: string; score: number | null; feedback: string; rubric?: string[] }) {
    this.d.grades = this.d.grades.filter(x => !(x.student_id === g.student_id && x.session_id === g.session_id));
    this.d.grades.push({ ...g, rubric: g.rubric ?? null, graded_at: new Date().toISOString() });
  }
  async roster() { return this.d.roster; }
  async addToRoster(rows: { email: string; full_name?: string; role?: Role }[]) { rows.forEach(r => { if (!this.d.roster.find(x => x.email === r.email.toLowerCase())) this.d.roster.push({ email: r.email.toLowerCase(), full_name: r.full_name ?? null, role: r.role ?? "student" }); }); }
  async removeFromRoster(email: string) { this.d.roster = this.d.roster.filter(r => r.email !== email); }
  async setRole(id: string, role: Role) { const p = this.d.profiles.find(p => p.id === id); if (p) p.role = role; }
  async settings() { return this.d.settings; }
  async saveSettings(s: CourseSettings) { this.d.settings = s; }
  async calendarDays() { return [...this.d.calendar].sort((a, b) => a.day.localeCompare(b.day)); }
  async setCalendarDay(d: CalendarDay | { day: string; remove: true }) { this.d.calendar = this.d.calendar.filter(x => x.day !== d.day); if (!("remove" in d)) this.d.calendar.push(d); }
  async slots() { return this.d.slots; }
  async saveSlot(sl: Omit<Slot, "id"> & { id?: number }) { if (sl.id) { const i = this.d.slots.findIndex(x => x.id === sl.id); this.d.slots[i] = sl as Slot; } else this.d.slots.push({ ...sl, id: Date.now() }); }
  async deleteSlot(id: number) { this.d.slots = this.d.slots.filter(s => s.id !== id); }
  async ohRequests() { const me = this.d.profiles.find(p => p.id === this.me); return me?.role === "instructor" ? this.d.oh : this.d.oh.filter(r => r.student_id === this.me); }
  async requestOH(r: { slot_id: number | null; requested_at: string; topic: string }) { this.d.oh.push({ id: Date.now(), student_id: this.me!, ...r, status: "pending", instructor_note: null, created_at: new Date().toISOString() }); }
  async updateOH(id: number, patch: Partial<Pick<OHRequest, "status" | "instructor_note" | "proposed_at" | "requested_at">>) { const r = this.d.oh.find(x => x.id === id); if (r) Object.assign(r, patch); }
  async messages(threadStudentId?: string) { const me = this.d.profiles.find(p => p.id === this.me); const t = threadStudentId ?? (me?.role === "instructor" ? undefined : this.me!); return this.d.msgs.filter(m => !t || m.thread_student_id === t); }
  async sendMessage(threadStudentId: string, body: string) { this.d.msgs.push({ id: Date.now(), thread_student_id: threadStudentId, sender_id: this.me!, body, created_at: new Date().toISOString(), read_at: null }); }
  async markRead(threadStudentId: string) { this.d.msgs.forEach(m => { if (m.thread_student_id === threadStudentId && m.sender_id !== this.me && !m.read_at) m.read_at = new Date().toISOString(); }); }
  async announcements() { return [...this.d.anns].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at)); }
  async postAnnouncement(a: { title: string; body: string; pinned: boolean }) { this.d.anns.push({ id: Date.now(), ...a, created_at: new Date().toISOString() }); }
  async deleteAnnouncement(id: number) { this.d.anns = this.d.anns.filter(a => a.id !== id); }
  async flashcards() { return this.me === "u1" ? this.d.flashcards : []; }
  async rateCard(term_key: string, obj: string, got: boolean) { const cur = this.d.flashcards.find(f => f.term_key === term_key); const next = scheduleCard(cur, got); this.d.flashcards = this.d.flashcards.filter(f => f.term_key !== term_key); this.d.flashcards.push({ term_key, obj, status: got ? "known" : "review", streak: next.streak, due: next.due }); }
  async mockAttempts() { return this.d.mocks.filter(m => m.student_id === this.me); }
  async saveMock(m: MockAttempt) { this.d.mocks.unshift({ ...m, id: String(Date.now()), student_id: this.me ?? "u1", created_at: new Date().toISOString() }); }
  async setFlashcard(term_key: string, status: "known" | "review" | null) { this.d.flashcards = this.d.flashcards.filter(f => f.term_key !== term_key); if (status) this.d.flashcards.push({ term_key, status }); }
  async allContent() { return this.d.content; }
  async saveContent(session_id: string, content: SessionContent, version_note: string) { this.d.content = this.d.content.filter(c => c.session_id !== session_id); this.d.content.push({ session_id, content, version_note, updated_at: new Date().toISOString(), verified_at: content.verified ? `${content.verified.date}T12:00:00Z` : null, verification: content.verified ? { checks: Object.fromEntries(content.verified.checks.map(c => [c, true])), note: content.verified.note } : null }); }
  async materials() { return this.d.materials; }
  async addMaterial(m: { session_id: string; kind: Material["kind"]; title: string; file?: File; url?: string }) { this.d.materials.push({ id: Date.now(), session_id: m.session_id, kind: m.kind, title: m.title, file_path: m.file ? "demo" : null, url: m.file ? URL.createObjectURL(m.file) : (m.url ?? null), created_at: new Date().toISOString() }); }
  async deleteMaterial(id: number) { this.d.materials = this.d.materials.filter(m => m.id !== id); }
  async recordings() { const instr = this.d.profiles.find(p => p.id === this.me)?.role === "instructor"; return this.d.recordings.filter(r => instr || this.d.releases.some(x => x.session_id === r.session_id && (x.student_id === null || x.student_id === this.me))); }
  async addRecording(r: { session_id: string; title: string; url: string; passcode?: string; recorded_on?: string | null }) { this.d.recordings.push({ id: Date.now(), session_id: r.session_id, title: r.title, url: r.url, passcode: r.passcode || null, recorded_on: r.recorded_on || null, created_at: new Date().toISOString() }); }
  async deleteRecording(id: number) { this.d.recordings = this.d.recordings.filter(r => r.id !== id); }
  async attendance() { return this.d.attendance; }
  async setAttendance(student_id: string, session_id: string, status: Attendance["status"] | null) { this.d.attendance = this.d.attendance.filter(a => !(a.student_id === student_id && a.session_id === session_id)); if (status) this.d.attendance.push({ student_id, session_id, status }); }
  async signedUrl() { return ""; }
  // ----- October 7 -----
  async allMocks() { return this.d.mocks; }
  async allFlashcards() { return this.d.flashcards.map(f => ({ student_id: "u1", term_key: f.term_key, status: f.status, streak: f.streak ?? null, obj: f.obj ?? null })); }
  private isInstr() { return this.d.profiles.find(p => p.id === this.me)?.role === "instructor"; }
  private nameOf(id: string) { const p = this.d.profiles.find(x => x.id === id); return p?.role === "instructor" ? p.full_name : shortName(p?.full_name || "Classmate"); }
  async showcase() {
    const instr = this.isInstr();
    return this.d.showcase.filter(x => !x.hidden || instr || x.student_id === this.me).map(x => {
      const reactions = noReactions(); const mine: ReactionKey[] = [];
      this.d.reactions.filter(r => r.post_id === x.id).forEach(r => { reactions[r.emoji]++; if (r.user_id === this.me) mine.push(r.emoji); });
      return { ...x, url: this.d.submissions.find(s => s.id === x.submission_id)?.url, author: this.nameOf(x.student_id), author_role: this.d.profiles.find(p => p.id === x.student_id)?.role, image_urls: x.images, reactions, my_reactions: mine, comment_count: this.d.comments.filter(c => c.post_id === x.id && (!c.hidden || instr)).length };
    });
  }
  async share(submission_id: number, caption: string) { const sub = this.d.submissions.find(s => s.id === submission_id); if (!sub) return; if (this.d.showcase.some(x => x.submission_id === submission_id)) throw new Error("Already shared"); this.d.showcase.unshift({ id: Date.now(), submission_id, student_id: this.me!, session_id: sub.session_id, caption: caption || null, hidden: false, featured: false, created_at: new Date().toISOString(), kind: sub.kind, body: sub.body, url: sub.url, author: "", post_type: "lab", title: null, text: null, link_url: null, images: [], pinned: false, comments_locked: false, reactions: noReactions(), my_reactions: [], comment_count: 0 }); }
  async unshare(id: number) { this.d.showcase = this.d.showcase.filter(x => x.id !== id); }
  async moderate(id: number, patch: ModeratePatch) { const x = this.d.showcase.find(y => y.id === id); if (x) Object.assign(x, patch); }
  async createPost(p: NewPost) {
    if (!this.isInstr() && (this.d.settings.showcase_posting === false || this.d.showcaseMutes.includes(this.me!))) throw new Error("Posting is paused right now. Your instructor can turn it back on.");
    this.d.showcase.unshift({ id: Date.now(), submission_id: null, student_id: this.me!, session_id: null, caption: null, hidden: false, featured: false, created_at: new Date().toISOString(), kind: null, body: null, author: "", post_type: p.post_type, title: p.title, text: p.text || null, link_url: p.link_url || null, images: p.images.map(b => URL.createObjectURL(b)), pinned: false, comments_locked: false, reactions: noReactions(), my_reactions: [], comment_count: 0 });
  }
  async deletePost(id: number) { this.d.showcase = this.d.showcase.filter(x => x.id !== id); this.d.comments = this.d.comments.filter(c => c.post_id !== id); this.d.reactions = this.d.reactions.filter(r => r.post_id !== id); }
  async react(post_id: number, emoji: ReactionKey, on: boolean) { this.d.reactions = this.d.reactions.filter(r => !(r.post_id === post_id && r.user_id === this.me && r.emoji === emoji)); if (on) this.d.reactions.push({ post_id, user_id: this.me!, emoji }); }
  async comments(post_id: number) { const instr = this.isInstr(); return this.d.comments.filter(c => c.post_id === post_id && (!c.hidden || instr || c.author_id === this.me)).map(c => ({ ...c, author: this.nameOf(c.author_id), author_role: this.d.profiles.find(p => p.id === c.author_id)?.role })); }
  async addComment(post_id: number, body: string) {
    const post = this.d.showcase.find(x => x.id === post_id);
    if (!this.isInstr() && (this.d.settings.showcase_comments === false || post?.comments_locked || this.d.showcaseMutes.includes(this.me!))) throw new Error("Comments are turned off for this post or for the class right now.");
    this.d.comments.push({ id: Date.now(), post_id, author_id: this.me!, body, hidden: false, created_at: new Date().toISOString() });
  }
  async deleteComment(id: number) { this.d.comments = this.d.comments.filter(c => c.id !== id); }
  async hideComment(id: number, hidden: boolean) { const c = this.d.comments.find(x => x.id === id); if (c) c.hidden = hidden; }
  async showcaseMutes() { return [...this.d.showcaseMutes]; }
  async setMute(student_id: string, muted: boolean) { this.d.showcaseMutes = this.d.showcaseMutes.filter(x => x !== student_id); if (muted) this.d.showcaseMutes.push(student_id); }
  async capstones() { const instr = this.d.profiles.find(p => p.id === this.me)?.role === "instructor"; return this.d.capstones.filter(c => instr || c.student_id === this.me); }
  async saveCapstone(c: Omit<CapstoneRow, "student_id" | "updated_at">) { this.d.capstones = this.d.capstones.filter(x => x.student_id !== this.me); this.d.capstones.push({ student_id: this.me!, ...c }); }
  async milestones() { const instr = this.d.profiles.find(p => p.id === this.me)?.role === "instructor"; return this.d.milestones.filter(m => instr || m.student_id === this.me); }
  async submitMilestone(m: { milestone: string; link: string; note: string }) { const cur = this.d.milestones.find(x => x.student_id === this.me && x.milestone === m.milestone); this.d.milestones = this.d.milestones.filter(x => x !== cur); this.d.milestones.push({ student_id: this.me!, milestone: m.milestone, link: m.link || null, note: m.note || null, status: "submitted", instructor_note: cur?.instructor_note ?? null }); }
  async reviewMilestone(m: { student_id: string; milestone: string; status: MilestoneStatus; instructor_note: string }) { const cur = this.d.milestones.find(x => x.student_id === m.student_id && x.milestone === m.milestone); if (cur) Object.assign(cur, { status: m.status, instructor_note: m.instructor_note || null }); else this.d.milestones.push({ student_id: m.student_id, milestone: m.milestone, status: m.status, link: null, note: null, instructor_note: m.instructor_note || null }); }
  async myPortfolio() { return this.d.portfolios.find(p => p.student_id === this.me) || null; }
  async allPortfolios() { return this.d.portfolios; }
  async savePortfolio(p: Omit<Portfolio, "student_id" | "updated_at">) { if (this.d.portfolios.some(x => x.slug === p.slug && x.student_id !== this.me)) throw new Error("That web address is taken. Try another."); this.d.portfolios = this.d.portfolios.filter(x => x.student_id !== this.me); this.d.portfolios.push({ student_id: this.me!, ...p }); }
  async publicPortfolio(slug: string) { return this.d.portfolios.find(p => p.slug === slug && p.published) || null; }
  async portfolioImage(file: Blob) { return URL.createObjectURL(file); }
  async submissionToPortfolioImage(file_path: string) { return this.d.submissions.find(s => s.file_path === file_path)?.url || ""; }
  async notify(kind: NotifyKind, payload: Record<string, unknown> = {}) { if (!this.d.settings.email_on && kind !== "test") return { ok: true, skipped: "Email is off" }; this.d.notifyLog.unshift({ id: Date.now(), kind, recipients: kind === "unlock" || kind === "announcement" ? 12 : 1, ok: true, error: null, created_at: new Date().toISOString() }); void payload; return { ok: true }; }
  async notifyPrefs() { return { opt_out: !!this.d.notifyPrefs[this.me!] }; }
  async setNotifyPrefs(opt_out: boolean) { this.d.notifyPrefs[this.me!] = opt_out; }
  async notifyLog() { return this.d.notifyLog; }
}

// Row-level security refusals arrive as a generic policy error. Say what actually happened.
function friendlyPostError(e: { message: string }, comment = false) {
  if (/row-level security|violates/i.test(e.message)) return new Error(comment ? "Comments are turned off for this post or for the class right now." : "Posting is paused right now. Your instructor can turn it back on.");
  return new Error(e.message);
}

// supabase-js hides the function's reply behind "Edge Function returned a non-2xx status code".
// Read the reply itself and translate the common setup mistakes into plain words.
async function explainFnError(error: unknown): Promise<string> {
  const e = error as { message?: string; name?: string; context?: Response };
  const res = e.context;
  if (!res || typeof res.status !== "number") return e.name === "FunctionsFetchError" ? "Couldn't reach the notify function. Check it's deployed in Supabase under the exact name notify." : e.message || "Unknown error";
  let detail = "";
  try { const t = await res.clone().text(); try { const j = JSON.parse(t); detail = j.error || j.msg || j.message || t; } catch { detail = t; } } catch { /* body already read */ }
  detail = String(detail || "").slice(0, 300);
  if (res.status === 404) return "The notify function isn't deployed (404). In Supabase, Edge Functions, create it with the exact name notify.";
  if (res.status === 401) return `Supabase refused the sign-in (401${detail ? `: ${detail}` : ""}). Open the notify function's Details and turn off "Verify JWT" (the function checks sign-in itself), then try again.`;
  return `${detail || e.message} (status ${res.status})`;
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const store: Store = url && key ? new SupaStore(url, key) : new DemoStore();
