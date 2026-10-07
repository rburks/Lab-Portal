// Types and store methods for calendar, office hours, messages, announcements, flashcards.
export type CourseSettings = { start_date: string; class_days: number[]; email_on?: boolean };
export type CalendarDay = { day: string; kind: "holiday" | "buffer"; label: string | null };
export type Slot = { id: number; weekday: number; start_time: string; minutes: number; capacity: number; location: string | null; active: boolean };
export type OHRequest = { id: number; student_id: string; slot_id: number | null; requested_at: string; topic: string; status: "pending" | "accepted" | "declined" | "done" | "cancelled" | "proposed"; instructor_note: string | null; proposed_at?: string | null; created_at: string };
export type Message = { id: number; thread_student_id: string; sender_id: string; body: string; created_at: string; read_at: string | null };
export type Announcement = { id: number; title: string; body: string; pinned: boolean; created_at: string };
export type Flashcard = { term_key: string; status: "known" | "review"; due?: string; streak?: number; obj?: string | null };
export type MockAttempt = { id?: string; student_id?: string; scope: string; total: number; correct: number; scaled: number; seconds: number; answers: { id: string; obj: string; correct: boolean }[]; created_at?: string };

export interface StoreExt {
  settings(): Promise<CourseSettings>;
  saveSettings(s: CourseSettings): Promise<void>;
  calendarDays(): Promise<CalendarDay[]>;
  setCalendarDay(d: CalendarDay | { day: string; remove: true }): Promise<void>;
  slots(): Promise<Slot[]>;
  saveSlot(s: Omit<Slot, "id"> & { id?: number }): Promise<void>;
  deleteSlot(id: number): Promise<void>;
  ohRequests(): Promise<OHRequest[]>;           // own for students, all for instructor
  requestOH(r: { slot_id: number | null; requested_at: string; topic: string }): Promise<void>;
  updateOH(id: number, patch: Partial<Pick<OHRequest, "status" | "instructor_note" | "proposed_at" | "requested_at">>): Promise<void>;
  messages(threadStudentId?: string): Promise<Message[]>;
  sendMessage(threadStudentId: string, body: string): Promise<void>;
  markRead(threadStudentId: string): Promise<void>;
  announcements(): Promise<Announcement[]>;
  postAnnouncement(a: { title: string; body: string; pinned: boolean }): Promise<void>;
  deleteAnnouncement(id: number): Promise<void>;
  flashcards(): Promise<Flashcard[]>;
  setFlashcard(term_key: string, status: "known" | "review" | null): Promise<void>;
  // Spaced review: rate a card and schedule when it comes back.
  rateCard(term_key: string, obj: string, got: boolean): Promise<void>;
  mockAttempts(): Promise<MockAttempt[]>;         // own for students, all for instructor
  saveMock(m: MockAttempt): Promise<void>;
}

import type { SessionContent } from "../content/course";
export type ContentRow = { session_id: string; content: SessionContent; version_note: string | null; updated_at: string; verified_at: string | null; verification: { checks: Record<string, boolean>; note: string } | null };
export type Material = { id: number; session_id: string; kind: "student_guide" | "slides" | "lab_deck" | "other"; title: string; file_path: string | null; url: string | null; created_at: string };
export type Attendance = { student_id: string; session_id: string; status: "present" | "late" | "absent" };
export interface StoreContent {
  allContent(): Promise<ContentRow[]>;
  saveContent(session_id: string, content: SessionContent, version_note: string): Promise<void>;
  materials(): Promise<Material[]>;
  addMaterial(m: { session_id: string; kind: Material["kind"]; title: string; file?: File; url?: string }): Promise<void>;
  deleteMaterial(id: number): Promise<void>;
  attendance(): Promise<Attendance[]>;
  setAttendance(student_id: string, session_id: string, status: Attendance["status"] | null): Promise<void>;
}

// ---------- October 7 additions: readiness, showcase, rubrics, capstone, portfolio, email ----------
export type ShowcaseItem = { id: number; submission_id: number; student_id: string; session_id: string; caption: string | null; hidden: boolean; featured: boolean; created_at: string;
  kind: "image" | "link" | "text"; body: string | null; url?: string; author: string };
export type CapstoneRow = { student_id: string; title: string | null; stakeholder: string | null; problem: string | null; updated_at?: string };
export type MilestoneStatus = "not_started" | "submitted" | "revise" | "approved";
export type MilestoneRow = { student_id: string; milestone: string; status: MilestoneStatus; link: string | null; note: string | null; instructor_note: string | null; updated_at?: string };
export type PortfolioItem = { title: string; blurb: string; url?: string; image?: string };
export type Portfolio = { student_id: string; slug: string; published: boolean; display_name: string | null; headline: string | null; bio: string | null; location: string | null; linkedin: string | null; credly: string | null; email_public: string | null; capstone: { title: string; summary: string } | null; items: PortfolioItem[]; updated_at?: string };
export type NotifyKind = "test" | "unlock" | "announcement" | "grade" | "message" | "oh_request" | "capstone";
export type NotifyLog = { id: number; kind: string; recipients: number; ok: boolean; error: string | null; created_at: string };
export type FlashcardRow = { student_id: string; term_key: string; status: string; streak: number | null; obj: string | null };

export interface StoreMore {
  allMocks(): Promise<MockAttempt[]>;
  allFlashcards(): Promise<FlashcardRow[]>;
  showcase(): Promise<ShowcaseItem[]>;
  share(submission_id: number, caption: string): Promise<void>;
  unshare(id: number): Promise<void>;
  moderate(id: number, patch: { hidden?: boolean; featured?: boolean }): Promise<void>;
  capstones(): Promise<CapstoneRow[]>;                 // own for students, all for instructor
  saveCapstone(c: Omit<CapstoneRow, "student_id" | "updated_at">): Promise<void>;
  milestones(): Promise<MilestoneRow[]>;
  submitMilestone(m: { milestone: string; link: string; note: string }): Promise<void>;
  reviewMilestone(m: { student_id: string; milestone: string; status: MilestoneStatus; instructor_note: string }): Promise<void>;
  myPortfolio(): Promise<Portfolio | null>;
  allPortfolios(): Promise<Portfolio[]>;
  savePortfolio(p: Omit<Portfolio, "student_id" | "updated_at">): Promise<void>;
  publicPortfolio(slug: string): Promise<Portfolio | null>;
  portfolioImage(file: Blob): Promise<string>;           // upload, returns public URL
  submissionToPortfolioImage(file_path: string): Promise<string>;
  notify(kind: NotifyKind, payload?: Record<string, unknown>): Promise<{ ok: boolean; error?: string; skipped?: string }>;
  notifyPrefs(): Promise<{ opt_out: boolean }>;
  setNotifyPrefs(opt_out: boolean): Promise<void>;
  notifyLog(): Promise<NotifyLog[]>;
}
