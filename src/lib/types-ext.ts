// Types and store methods for calendar, office hours, messages, announcements, flashcards.
export type CourseSettings = { start_date: string; class_days: number[] };
export type CalendarDay = { day: string; kind: "holiday" | "buffer"; label: string | null };
export type Slot = { id: number; weekday: number; start_time: string; minutes: number; capacity: number; location: string | null; active: boolean };
export type OHRequest = { id: number; student_id: string; slot_id: number | null; requested_at: string; topic: string; status: "pending" | "accepted" | "declined" | "done" | "cancelled"; instructor_note: string | null; created_at: string };
export type Message = { id: number; thread_student_id: string; sender_id: string; body: string; created_at: string; read_at: string | null };
export type Announcement = { id: number; title: string; body: string; pinned: boolean; created_at: string };
export type Flashcard = { term_key: string; status: "known" | "review" };

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
  updateOH(id: number, patch: Partial<Pick<OHRequest, "status" | "instructor_note">>): Promise<void>;
  messages(threadStudentId?: string): Promise<Message[]>;
  sendMessage(threadStudentId: string, body: string): Promise<void>;
  markRead(threadStudentId: string): Promise<void>;
  announcements(): Promise<Announcement[]>;
  postAnnouncement(a: { title: string; body: string; pinned: boolean }): Promise<void>;
  deleteAnnouncement(id: number): Promise<void>;
  flashcards(): Promise<Flashcard[]>;
  setFlashcard(term_key: string, status: "known" | "review" | null): Promise<void>;
}
