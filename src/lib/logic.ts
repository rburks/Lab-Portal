// Shared helpers: lock logic, progress math, performance insights, image compression, CSV.
import { SESSIONS, type Session } from "../content/course";
import type { Attendance, Grade, Profile, Progress, Release, Submission } from "./store";

export function isUnlocked(sessionId: string, studentId: string | null, releases: Release[]) {
  return releases.some(r => r.session_id === sessionId && (r.student_id === null || r.student_id === studentId));
}
export function weekUnlocked(week: number, studentId: string | null, releases: Release[]) {
  return SESSIONS.filter(s => s.week === week).some(s => isUnlocked(s.id, studentId, releases));
}

export type SessionState = "locked" | "not_started" | "in_progress" | "complete" | "submitted" | "graded";

export function sessionState(s: Session, p: Progress | undefined, subs: Submission[], g: Grade | undefined, unlocked: boolean): SessionState {
  if (!unlocked) return "locked";
  if (g && g.score != null) return "graded";
  if (subs.length) return "submitted";
  const n = s.steps?.length || 0;
  const done = (p?.steps || []).filter(Boolean).length;
  if (!p || (done === 0 && p.quiz_best == null)) return "not_started";
  if (n && done >= n && p.quiz_best != null) return "complete";
  return "in_progress";
}
export const STATE_LABEL: Record<SessionState, string> = { locked: "Locked", not_started: "Not started", in_progress: "In progress", complete: "Complete", submitted: "Submitted", graded: "Graded" };

export function labPct(s: Session, p?: Progress) {
  const n = s.steps?.length || 0; if (!n) return 0;
  return Math.round(100 * (p?.steps || []).filter(Boolean).length / n);
}

// ----- performance insights -----
export type StudentStat = {
  profile: Profile; labAvg: number; quizAvg: number | null; gradeAvg: number | null; submitted: number; graded: number;
  openSessions: number; lastActive: string | null; daysSinceActive: number | null; composite: number; flags: string[]; absences: number;
};
export function computeStats(profiles: Profile[], progress: Progress[], subs: Submission[], grades: Grade[], releases: Release[], attendance: Attendance[] = []): StudentStat[] {
  const students = profiles.filter(p => p.role === "student");
  const built = SESSIONS.filter(s => s.built);
  return students.map(profile => {
    const open = built.filter(s => isUnlocked(s.id, profile.id, releases));
    const my = (sid: string) => progress.find(p => p.student_id === profile.id && p.session_id === sid);
    const labs = open.map(s => labPct(s, my(s.id)));
    const labAvg = labs.length ? Math.round(labs.reduce((a, b) => a + b, 0) / labs.length) : 0;
    const quizzes = open.map(s => my(s.id)?.quiz_best).filter((q): q is number => q != null);
    const quizAvg = quizzes.length ? Math.round(100 * quizzes.reduce((a, b) => a + b, 0) / (quizzes.length * 5)) : null;
    const gs = grades.filter(g => g.student_id === profile.id && g.score != null);
    const gradeAvg = gs.length ? Math.round(gs.reduce((a, g) => a + (g.score || 0), 0) / gs.length) : null;
    const submitted = new Set(subs.filter(s => s.student_id === profile.id).map(s => s.session_id)).size;
    const acts = progress.filter(p => p.student_id === profile.id).map(p => p.updated_at).concat(subs.filter(s => s.student_id === profile.id).map(s => s.created_at)).filter(Boolean).sort();
    const lastActive = acts.length ? acts[acts.length - 1] : null;
    const daysSinceActive = lastActive ? Math.floor((Date.now() - new Date(lastActive).getTime()) / 86400000) : null;
    // composite: labs 40, quiz 30, grades 30 (missing parts re-weighted)
    const parts: [number, number][] = [[labAvg, 40]]; if (quizAvg != null) parts.push([quizAvg, 30]); if (gradeAvg != null) parts.push([gradeAvg, 30]);
    const wsum = parts.reduce((a, [, w]) => a + w, 0);
    const composite = Math.round(parts.reduce((a, [v, w]) => a + v * w, 0) / wsum);
    const flags: string[] = [];
    if (open.length && labAvg < 50) flags.push("Labs under half done");
    if (quizAvg != null && quizAvg < 60) flags.push("Quiz average below 60%");
    if (gradeAvg != null && gradeAvg < 70) flags.push("Graded work below 70");
    if (daysSinceActive != null && daysSinceActive >= 7) flags.push(`No activity for ${daysSinceActive} days`);
    if (open.length && lastActive === null) flags.push("Hasn't started");
    const absences = attendance.filter(a => a.student_id === profile.id && a.status === "absent").length;
    if (absences >= 2) flags.push(`Missed ${absences} sessions`);
    return { profile, labAvg, quizAvg, gradeAvg, submitted, graded: gs.length, openSessions: open.length, lastActive, daysSinceActive, composite, flags, absences };
  });
}

// ----- image compression (client side) -----
export async function compressImage(file: File, maxW = 1400, quality = 0.72): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bmp.width);
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(res => c.toBlob(b => res(b!), "image/jpeg", quality));
}

export function toCSV(rows: (string | number | null | undefined)[][]) {
  return rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
}
export function download(name: string, text: string) {
  // The byte-order mark makes Excel read names with accents correctly when the CSV is double-clicked.
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
export const initials = (n: string) => n.split(/\s+/).map(x => x[0]).join("").slice(0, 2).toUpperCase();
export const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";
