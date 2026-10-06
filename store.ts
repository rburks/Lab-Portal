// Data layer. One interface, two implementations: Supabase (production) and Demo (in-memory, no backend).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SESSIONS, type Session } from "../content/course";
import type { Announcement, Attendance, CalendarDay, ContentRow, CourseSettings, Flashcard, Material, Message, MockAttempt, OHRequest, Slot, StoreContent, StoreExt } from "./types-ext";
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
export type { Announcement, Attendance, CalendarDay, ContentRow, CourseSettings, Flashcard, Material, Message, MockAttempt, OHRequest, Slot } from "./types-ext";

export type Role = "student" | "instructor";
export type Profile = { id: string; email: string; full_name: string; role: Role; created_at: string };
export type Progress = { student_id: string; session_id: string; steps: boolean[]; goal: string | null; quiz_best: number | null; quiz_last: number | null; quiz_attempts: number; sandbox: Record<string, unknown> | null; responses: Record<string, unknown>; updated_at: string };
export type Submission = { id: number; student_id: string; session_id: string; kind: "image" | "link" | "text"; body: string | null; file_path: string | null; created_at: string; url?: string };
export type Grade = { student_id: string; session_id: string; score: number | null; feedback: string | null; graded_at: string };
export type Release = { session_id: string; student_id: string | null; unlocked_at: string };

export interface Store extends StoreExt, StoreContent {
  demo: boolean;
  // auth
  currentUser(): Promise<Profile | null>;
  signInWithEmail(email: string): Promise<{ error?: string }>;
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
  saveGrade(g: { student_id: string; session_id: string; score: number | null; feedback: string }): Promise<void>;
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
  async signOut() { await this.sb.auth.signOut(); }
  onAuthChange(cb: () => void) { const { data } = this.sb.auth.onAuthStateChange(() => cb()); return () => data.subscription.unsubscribe(); }
  async myProgress() { const { data } = await this.sb.from("progress").select("*"); return (data || []) as Progress[]; }
  async saveProgress(p: Partial<Progress> & { session_id: string }) {
    const { data: { user } } = await this.sb.auth.getUser(); if (!user) return;
    await this.sb.from("progress").upsert({ student_id: user.id, ...p, updated_at: new Date().toISOString() }, { onConflict: "student_id,session_id" });
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
  async saveGrade(g: { student_id: string; session_id: string; score: number | null; feedback: string }) {
    const { data: { user } } = await this.sb.auth.getUser();
    await this.sb.from("grades").upsert({ ...g, graded_by: user?.id, graded_at: new Date().toISOString() }, { onConflict: "student_id,session_id" });
  }
  async roster() { const { data } = await this.sb.from("roster").select("email,full_name,role").order("full_name"); return (data || []) as { email: string; full_name: string | null; role: Role }[]; }
  async addToRoster(rows: { email: string; full_name?: string; role?: Role }[]) { await this.sb.from("roster").upsert(rows.map(r => ({ email: r.email.toLowerCase(), full_name: r.full_name ?? null, role: r.role ?? "student" })), { onConflict: "email" }); }
  async removeFromRoster(email: string) { await this.sb.from("roster").delete().eq("email", email); }
  async setRole(id: string, role: Role) { await this.sb.from("profiles").update({ role }).eq("id", id); }
  async signedUrl(path: string) { const { data } = await this.sb.storage.from("submissions").createSignedUrl(path, 3600); return data?.signedUrl || ""; }

  // ----- extension -----
  async settings() { const { data } = await this.sb.from("course_settings").select("start_date,class_days").eq("id", 1).single(); return (data as CourseSettings) || { start_date: "2026-10-12", class_days: [1, 2, 4] }; }
  async saveSettings(s: CourseSettings) { await this.sb.from("course_settings").upsert({ id: 1, ...s, updated_at: new Date().toISOString() }); }
  async calendarDays() { const { data } = await this.sb.from("calendar_days").select("day,kind,label").order("day"); return (data || []) as CalendarDay[]; }
  async setCalendarDay(d: CalendarDay | { day: string; remove: true }) { if ("remove" in d) await this.sb.from("calendar_days").delete().eq("day", d.day); else await this.sb.from("calendar_days").upsert(d, { onConflict: "day" }); }
  async slots() { const { data } = await this.sb.from("office_hour_slots").select("*").order("weekday").order("start_time"); return (data || []) as Slot[]; }
  async saveSlot(sl: Omit<Slot, "id"> & { id?: number }) { await this.sb.from("office_hour_slots").upsert(sl); }
  async deleteSlot(id: number) { await this.sb.from("office_hour_slots").delete().eq("id", id); }
  async ohRequests() { const { data } = await this.sb.from("office_hour_requests").select("*").order("requested_at"); return (data || []) as OHRequest[]; }
  async requestOH(r: { slot_id: number | null; requested_at: string; topic: string }) { const { data: { user } } = await this.sb.auth.getUser(); if (!user) return; const { error } = await this.sb.from("office_hour_requests").insert({ student_id: user.id, ...r }); if (error) throw error; }
  async updateOH(id: number, patch: Partial<Pick<OHRequest, "status" | "instructor_note">>) { await this.sb.from("office_hour_requests").update(patch).eq("id", id); }
  async messages(threadStudentId?: string) { let q = this.sb.from("messages").select("*").order("created_at"); if (threadStudentId) q = q.eq("thread_student_id", threadStudentId); const { data } = await q; return (data || []) as Message[]; }
  async sendMessage(threadStudentId: string, body: string) { const { data: { user } } = await this.sb.auth.getUser(); if (!user) return; const { error } = await this.sb.from("messages").insert({ thread_student_id: threadStudentId, sender_id: user.id, body }); if (error) throw error; }
  async markRead(threadStudentId: string) { const { data: { user } } = await this.sb.auth.getUser(); if (!user) return; await this.sb.from("messages").update({ read_at: new Date().toISOString() }).eq("thread_student_id", threadStudentId).neq("sender_id", user.id).is("read_at", null); }
  async announcements() { const { data } = await this.sb.from("announcements").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false }); return (data || []) as Announcement[]; }
  async postAnnouncement(a: { title: string; body: string; pinned: boolean }) { await this.sb.from("announcements").insert(a); }
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
  async saveContent(session_id: string, content: SessionContent, version_note: string) { const { data: { user } } = await this.sb.auth.getUser(); const { error } = await this.sb.from("session_content").upsert({ session_id, content, version_note, updated_at: new Date().toISOString(), updated_by: user?.id, verified_at: null, verification: null }, { onConflict: "session_id" }); if (error) throw error; }
  async setVerification(session_id: string, v: { checks: Record<string, boolean>; note: string }) { const { data: { user } } = await this.sb.auth.getUser(); const { error } = await this.sb.from("session_content").update({ verified_at: new Date().toISOString(), verified_by: user?.id, verification: v }).eq("session_id", session_id); if (error) throw error; }
  async materials() { const { data } = await this.sb.from("session_materials").select("*").order("created_at"); return ((data || []) as Material[]).map(m => ({ ...m, url: m.file_path ? this.sb.storage.from("materials").getPublicUrl(m.file_path).data.publicUrl : m.url })); }
  async addMaterial(m: { session_id: string; kind: Material["kind"]; title: string; file?: File; url?: string }) {
    let file_path: string | null = null;
    if (m.file) { const ext = m.file.name.split(".").pop() || "bin"; file_path = `${m.session_id}/${m.kind}-${Date.now()}.${ext}`; const { error } = await this.sb.storage.from("materials").upload(file_path, m.file, { contentType: m.file.type || undefined }); if (error) throw error; }
    const { error } = await this.sb.from("session_materials").insert({ session_id: m.session_id, kind: m.kind, title: m.title, file_path, url: m.url ?? null }); if (error) throw error;
  }
  async deleteMaterial(id: number) { const { data } = await this.sb.from("session_materials").select("file_path").eq("id", id).single(); if (data?.file_path) await this.sb.storage.from("materials").remove([data.file_path]); await this.sb.from("session_materials").delete().eq("id", id); }
  async attendance() { const { data } = await this.sb.from("attendance").select("student_id,session_id,status"); return (data || []) as Attendance[]; }
  async setAttendance(student_id: string, session_id: string, status: Attendance["status"] | null) { if (!status) await this.sb.from("attendance").delete().eq("student_id", student_id).eq("session_id", session_id); else await this.sb.from("attendance").upsert({ student_id, session_id, status, marked_at: new Date().toISOString() }, { onConflict: "student_id,session_id" }); }
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
      const qb = R() < ability ? 4 + Math.round(R()) : 2 + Math.round(R() * 2);
      progress.push({ student_id: uid, session_id: s.id, steps, goal: done > 0 ? "Compare three assistants on my job's weekly reporting task." : null, quiz_best: done > 0 ? qb : null, quiz_last: done > 0 ? qb : null, quiz_attempts: done > 0 ? 1 + Math.round(R()) : 0, sandbox: s.sandbox && done > 2 ? { train: 92, test: 71 } : null, responses: done > 1 ? { "1": "1. What does a data engineer do day to day?\n2. Which skills should I learn first?\n3. How is AI changing the role?" } : {}, updated_at: new Date(Date.now() - 86400000 * (daysAgo + k)).toISOString() });
      if (done === n && n > 0) {
        submissions.push({ id: submissions.length + 1, student_id: uid, session_id: s.id, kind: k === 2 ? "link" : "text", body: k === 2 ? "https://docs.google.com/spreadsheets/d/example" : "The model learned the background, not the mug. Every mug photo was on the brown desk.", file_path: null, created_at: new Date(Date.now() - 86400000 * (daysAgo + k)).toISOString() });
        if (R() < 0.7) grades.push({ student_id: uid, session_id: s.id, score: Math.round(60 + ability * 40 - R() * 8), feedback: "Clear failure sentence. Add what data would fix it next time.", graded_at: new Date().toISOString() });
      }
    });
  });
  const releases: Release[] = [{ session_id: "w01d1", student_id: null, unlocked_at: "" }, { session_id: "w01d2", student_id: null, unlocked_at: "" }, { session_id: "w01d3", student_id: null, unlocked_at: "" }];
  const settings: CourseSettings = { start_date: "2026-10-12", class_days: [1, 2, 4] };
  const calendar: CalendarDay[] = [{ day: "2026-11-26", kind: "holiday", label: "Thanksgiving" }, { day: "2026-12-22", kind: "holiday", label: "Winter break" }, { day: "2026-12-24", kind: "holiday", label: "Winter break" }, { day: "2026-12-29", kind: "holiday", label: "Winter break" }, { day: "2026-12-31", kind: "holiday", label: "Winter break" }];
  const slots: Slot[] = [{ id: 1, weekday: 2, start_time: "17:00", minutes: 15, capacity: 1, location: "Zoom (link in announcement)", active: true }, { id: 2, weekday: 2, start_time: "17:15", minutes: 15, capacity: 1, location: "Zoom (link in announcement)", active: true }, { id: 3, weekday: 2, start_time: "17:30", minutes: 15, capacity: 1, location: "Zoom (link in announcement)", active: true }, { id: 4, weekday: 4, start_time: "17:30", minutes: 15, capacity: 1, location: "Classroom, before class", active: true }];
  const oh: OHRequest[] = [{ id: 1, student_id: "u2", slot_id: 1, requested_at: "2026-10-13T17:00:00", topic: "I keep getting different answers from the three assistants and don't know which to trust.", status: "pending", instructor_note: null, created_at: new Date().toISOString() }, { id: 2, student_id: "u8", slot_id: null, requested_at: "2026-10-14T12:00:00", topic: "Missed Day 2. Can we go over Teachable Machine?", status: "pending", instructor_note: null, created_at: new Date().toISOString() }];
  const msgs: Message[] = [{ id: 1, thread_student_id: "u2", sender_id: "u2", body: "Hi Roland, my Teachable Machine model keeps saying 'mug' for everything. I retrained twice.", created_at: new Date(Date.now() - 3600e3 * 20).toISOString(), read_at: null }, { id: 2, thread_student_id: "u1", sender_id: "u1", body: "Is it okay to use my work's actual sales sheet for the Week 6 lab, or should I use the Bloom & Vine one?", created_at: new Date(Date.now() - 3600e3 * 5).toISOString(), read_at: null }, { id: 3, thread_student_id: "u1", sender_id: "u-instr", body: "Use Bloom & Vine in class so we're all looking at the same numbers. Your own sheet is a great Stretch though.", created_at: new Date(Date.now() - 3600e3 * 4).toISOString(), read_at: null }];
  const anns: Announcement[] = [{ id: 1, title: "Welcome to Software/AI", body: "Before Thursday: make sure you have a Google account and a laptop you can install software on. Bring one task from your job or target job that you'd like AI to help with.", pinned: true, created_at: new Date(Date.now() - 86400e3 * 2).toISOString() }, { id: 2, title: "Office hours are open", body: "Tuesdays 5 to 5:45 PM on Zoom and Thursdays 5:30 PM in the classroom. Book from the Calendar page.", pinned: false, created_at: new Date(Date.now() - 86400e3).toISOString() }];
  const flashcards: Flashcard[] = [{ term_key: "w01d1|c01", status: "known", streak: 1, due: new Date(Date.now() + 5 * 864e5).toISOString(), obj: "1.1.2" }, { term_key: "w01d1|c04", status: "review", streak: 0, due: new Date().toISOString(), obj: "1.2.2" }];
  const mocks: MockAttempt[] = [{ id: "m1", student_id: "u1", scope: "all", total: 8, correct: 6, scaled: 775, seconds: 410, answers: [], created_at: new Date(Date.now() - 2 * 864e5).toISOString() }];
  const content: ContentRow[] = [["w01d1", w01d1], ["w01d2", w01d2], ["w01d3", w01d3]].map(([id, c], i) => ({ session_id: id as string, content: c as unknown as SessionContent, version_note: "Built Oct 6, 2026", updated_at: new Date(Date.now() - 86400e3).toISOString(), verified_at: i === 0 ? new Date().toISOString() : i === 1 ? new Date(Date.now() - 86400e3 * 4).toISOString() : null, verification: i < 2 ? { checks: { tools: true, links: true, facts: true, quiz: true, guide: true }, note: "Free tiers confirmed on vendor pricing pages." } : null }));
  const materials: Material[] = [{ id: 1, session_id: "w01d1", kind: "student_guide", title: "Week 1 Day 1 Student Guide", file_path: null, url: "#", created_at: new Date().toISOString() }, { id: 2, session_id: "w01d1", kind: "slides", title: "Slides (Gamma)", file_path: null, url: "https://gamma.app", created_at: new Date().toISOString() }];
  const attendance: Attendance[] = [];
  return { content, materials, attendance, settings, calendar, slots, oh, msgs, anns, flashcards, mocks, profiles, progress, grades, submissions, releases, roster: profiles.map(p => ({ email: p.email, full_name: p.full_name as string | null, role: p.role })) };
}

class DemoStore implements Store {
  demo = true;
  d = seedDemo();
  me: string | null = "u1";
  listeners = new Set<() => void>();
  private emit() { this.listeners.forEach(f => f()); }
  demoSwitchUser(id: string) { this.me = id; this.emit(); }
  async currentUser() { return this.d.profiles.find(p => p.id === this.me) || null; }
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
  async saveGrade(g: { student_id: string; session_id: string; score: number | null; feedback: string }) {
    this.d.grades = this.d.grades.filter(x => !(x.student_id === g.student_id && x.session_id === g.session_id));
    this.d.grades.push({ ...g, graded_at: new Date().toISOString() });
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
  async updateOH(id: number, patch: Partial<Pick<OHRequest, "status" | "instructor_note">>) { const r = this.d.oh.find(x => x.id === id); if (r) Object.assign(r, patch); }
  async messages(threadStudentId?: string) { const me = this.d.profiles.find(p => p.id === this.me); const t = threadStudentId ?? (me?.role === "instructor" ? undefined : this.me!); return this.d.msgs.filter(m => !t || m.thread_student_id === t); }
  async sendMessage(threadStudentId: string, body: string) { this.d.msgs.push({ id: Date.now(), thread_student_id: threadStudentId, sender_id: this.me!, body, created_at: new Date().toISOString(), read_at: null }); }
  async markRead(threadStudentId: string) { this.d.msgs.forEach(m => { if (m.thread_student_id === threadStudentId && m.sender_id !== this.me && !m.read_at) m.read_at = new Date().toISOString(); }); }
  async announcements() { return [...this.d.anns].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at)); }
  async postAnnouncement(a: { title: string; body: string; pinned: boolean }) { this.d.anns.push({ id: Date.now(), ...a, created_at: new Date().toISOString() }); }
  async deleteAnnouncement(id: number) { this.d.anns = this.d.anns.filter(a => a.id !== id); }
  async flashcards() { return this.me === "u1" ? this.d.flashcards : []; }
  async rateCard(term_key: string, obj: string, got: boolean) { const cur = this.d.flashcards.find(f => f.term_key === term_key); const next = scheduleCard(cur, got); this.d.flashcards = this.d.flashcards.filter(f => f.term_key !== term_key); this.d.flashcards.push({ term_key, obj, status: got ? "known" : "review", streak: next.streak, due: next.due }); }
  async mockAttempts() { return this.d.mocks.filter(m => this.me === "instructor" || m.student_id === this.me); }
  async saveMock(m: MockAttempt) { this.d.mocks.unshift({ ...m, id: String(Date.now()), student_id: this.me ?? "u1", created_at: new Date().toISOString() }); }
  async setFlashcard(term_key: string, status: "known" | "review" | null) { this.d.flashcards = this.d.flashcards.filter(f => f.term_key !== term_key); if (status) this.d.flashcards.push({ term_key, status }); }
  async allContent() { return this.d.content; }
  async saveContent(session_id: string, content: SessionContent, version_note: string) { this.d.content = this.d.content.filter(c => c.session_id !== session_id); this.d.content.push({ session_id, content, version_note, updated_at: new Date().toISOString(), verified_at: null, verification: null }); }
  async setVerification(session_id: string, v: { checks: Record<string, boolean>; note: string }) { const c = this.d.content.find(x => x.session_id === session_id); if (c) { c.verified_at = new Date().toISOString(); c.verification = v; } }
  async materials() { return this.d.materials; }
  async addMaterial(m: { session_id: string; kind: Material["kind"]; title: string; file?: File; url?: string }) { this.d.materials.push({ id: Date.now(), session_id: m.session_id, kind: m.kind, title: m.title, file_path: m.file ? "demo" : null, url: m.file ? URL.createObjectURL(m.file) : (m.url ?? null), created_at: new Date().toISOString() }); }
  async deleteMaterial(id: number) { this.d.materials = this.d.materials.filter(m => m.id !== id); }
  async attendance() { return this.d.attendance; }
  async setAttendance(student_id: string, session_id: string, status: Attendance["status"] | null) { this.d.attendance = this.d.attendance.filter(a => !(a.student_id === student_id && a.session_id === session_id)); if (status) this.d.attendance.push({ student_id, session_id, status }); }
  async signedUrl() { return ""; }
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const store: Store = url && key ? new SupaStore(url, key) : new DemoStore();
