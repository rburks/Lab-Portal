// Drafts a two-sentence feedback note from the rubric items the instructor ticked.
// No AI involved: it picks one "what worked" line and one "what to fix" line written ahead of time in the instructor's voice,
// fills in the student's first name and a short quote from their own checkpoint answer, and varies the phrasing per student.
import type { Rubric, RubricItem } from "../content/course";

const hash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

function quoteFrom(responses: Record<string, unknown>, step?: number): string | null {
  if (step == null) return null;
  const r = responses[String(step)];
  if (typeof r !== "string" || r.trim().length < 12) return null;
  const first = r.trim().replace(/\s+/g, " ").split(/(?<=[.!?])\s/)[0];
  return first.length > 110 ? first.slice(0, 107).replace(/\s+\S*$/, "") + "…" : first;
}

function fill(t: string, name: string, quote: string | null) {
  return t.replace(/\{name\}/g, name).replace(/\{quote\}/g, quote ?? "");
}

export function scoreFrom(rubric: Rubric, checked: string[]) {
  return rubric.items.filter(i => checked.includes(i.id)).reduce((a, i) => a + i.points, 0);
}

export function draftFeedback(rubric: Rubric, checked: string[], fullName: string, responses: Record<string, unknown>, seed = ""): string {
  const name = fullName.trim().split(/\s+/)[0] || "there";
  const v = hash(seed + fullName);
  const met = rubric.items.filter(i => checked.includes(i.id)).sort((a, b) => b.points - a.points);
  const unmet = rubric.items.filter(i => !checked.includes(i.id)).sort((a, b) => b.points - a.points);
  const pickGood = (i: RubricItem) => { const q = quoteFrom(responses, i.quoteStep); const quoting = q ? i.good.filter(t => t.includes("{quote}")) : []; const opts = quoting.length ? quoting : i.good.filter(t => !t.includes("{quote}")); return opts.length ? fill(opts[v % opts.length], name, q) : null; };
  const pickFix = (i: RubricItem, k = 0) => fill(i.fix[(v + k) % i.fix.length], name, null);
  // Prefer a "what worked" line that can quote the student, so the note fits this student's work.
  const ordered = [...met.filter(i => i.quoteStep != null && quoteFrom(responses, i.quoteStep)), ...met];
  let good: string | null = null;
  for (const i of ordered) { good = pickGood(i); if (good) break; }
  const parts: string[] = [];
  if (good) parts.push(good);
  if (unmet.length) { parts.push(pickFix(unmet[0])); if (!good && unmet[1]) parts.push(pickFix(unmet[1], 1)); }
  else parts.push(fill(rubric.allMet, name, null));
  // Use the name once: drop later ", Name" occurrences.
  let seen = false;
  const text = parts.join(" ").replace(new RegExp(`, ${name}(?=[.,:!?\\s])`, "g"), m => { if (seen) return ""; seen = true; return m; });
  return text;
}
