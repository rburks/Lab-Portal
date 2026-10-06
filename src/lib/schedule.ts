// Schedule generator: walks class days from the start date, skipping holidays and buffer days,
// and assigns the 60 sessions in order. A holiday or buffer on a class date pushes everything later back.
import { SESSIONS, type Session } from "../content/course";
import type { CalendarDay, CourseSettings } from "./types-ext";

export type ScheduledDay = { date: string; kind: "session" | "holiday" | "buffer"; session?: Session; label?: string };

export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const parse = (s: string) => new Date(s + "T12:00:00");

export function buildSchedule(settings: CourseSettings, exceptions: CalendarDay[]): ScheduledDay[] {
  const out: ScheduledDay[] = [];
  const ex = new Map(exceptions.map(e => [e.day, e]));
  const d = parse(settings.start_date);
  let i = 0, guard = 0;
  while (i < SESSIONS.length && guard++ < 800) {
    if (settings.class_days.includes(d.getDay())) {
      const key = iso(d); const e = ex.get(key);
      if (e) out.push({ date: key, kind: e.kind, label: e.label || (e.kind === "holiday" ? "Holiday" : "Buffer day") });
      else out.push({ date: key, kind: "session", session: SESSIONS[i++] });
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}
export const dateOf = (schedule: ScheduledDay[], sessionId: string) => schedule.find(s => s.session?.id === sessionId)?.date;
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const fmtLong = (s: string) => parse(s).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).replace(",", "");
export const fmtTime = (t: string) => { const [h, m] = t.split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${ap}`; };

// Next N occurrences of a weekday from today.
export function nextDates(weekday: number, n = 4, from = new Date()) {
  const out: string[] = []; const d = new Date(from); d.setHours(12, 0, 0, 0);
  while (out.length < n) { d.setDate(d.getDate() + 1); if (d.getDay() === weekday) out.push(iso(d)); }
  return out;
}
