import objectivesData from "./objectives.json";
export const OBJECTIVES = objectivesData;
const OBJECTIVE_IDS = new Set(objectivesData.objectives.map(o => o.id));
export type QuizQ = { q: string; a: string[]; c: number; why: string };
export type LensTerm = { term: string; plain: string; exam: string };
export type Checkpoint =
  | { kind: "text"; prompt: string; placeholder?: string; minLength?: number }
  | { kind: "choice"; prompt: string; options: string[]; correct: number; why: string }
  | { kind: "upload"; prompt: string }
  | { kind: "confirm"; prompt: string };
export type Step = {
  label: string;        // short title shown in the rail
  why?: string;         // one line on why this step matters
  do: string[];         // numbered instructions, written for someone who has never used the tool
  see: string;          // what the screen should show when it worked
  tip?: string;         // what to try if it didn't
  checkpoint?: Checkpoint;
};
export type Tool = { name: string; url: string; use: string; free: string };
// Exam block: built against the official AIF-C01 objective IDs in objectives.json.
// A card asks one question (front) and answers it in plain words (back). A practice item is an exam-style scenario.
export type ExamCard = { id: string; obj: string; q: string; a: string; term?: string };
export type ExamQ = { id: string; obj: string; q: string; a: string[]; c: number; why: string; wrong?: string[] };
export type ExamBlock = { objectives: string[]; cards: ExamCard[]; practice: ExamQ[]; notTested?: { term: string; why: string }[] };
export type SessionContent = {
  goal?: string; steps?: Step[]; stretch?: string[]; doneWhen?: string[]; lens?: LensTerm[]; quiz?: QuizQ[];
  sandbox?: "classifier"; submission?: { prompt: string; kinds: Array<"image" | "link" | "text"> }; tools?: Tool[];
  exam?: ExamBlock;
  // Stamped by the build, not by the instructor: when the live checks were run, what was checked, and what changed.
  verified?: Verified;
};
export type Verified = { date: string; checks: string[]; note: string; sources?: string[] };
export type Session = {
  id: string;            // e.g. "w01d2"
  week: number;
  day: 1 | 2 | 3;
  title: string;
  goal?: string;
  steps?: Step[];
  stretch?: string[];
  doneWhen?: string[];
  lens?: LensTerm[];
  quiz?: QuizQ[];
  sandbox?: "classifier";
  submission?: { prompt: string; kinds: Array<"image" | "link" | "text"> };
  tools?: Tool[];
  exam?: ExamBlock;
  built: boolean;        // false = shell only; true once content is loaded from the database
};
export type Week = { n: number; theme: string; phase: number };
export type Phase = { n: number; name: string; question: string; weeks: number[] };

export const PHASES: Phase[] = [
  { n: 1, name: "How AI Actually Works", question: "What is AI, what's happening inside a model, and how do I control it?", weeks: [1, 2, 3, 4] },
  { n: 2, name: "AI at Work and Programming Literacy", question: "How do I use AI for everyday work and data, and how does software actually think?", weeks: [5, 6, 7] },
  { n: 3, name: "Automation, Knowledge Bots, and Agents", question: "How do I automate real processes, ground AI in business knowledge, build applications and agents that act, and see what they did?", weeks: [8, 9, 10, 11, 12, 13] },
  { n: 4, name: "Reliable, Responsible, Business-Ready, and Certified", question: "How does AI break, how do I prove it keeps working, what does it cost, and am I ready for the exam?", weeks: [14, 15, 16, 17, 18] },
  { n: 5, name: "Capstone and Career", question: "Can I build, test, secure, and hand off a real AI solution for a real stakeholder?", weeks: [19, 20] },
];

export const WEEKS: Week[] = [
  [1, "What AI Is and How Machines Learn"], [2, "Inside Large Language Models"], [3, "The Model Landscape and Generative AI on AWS"], [4, "Prompt Engineering and Context Engineering"],
  [5, "AI Assistants for Everyday Work"], [6, "Data and Spreadsheets with AI"], [7, "How Software Thinks: Programming Fundamentals"],
  [8, "Workflow Automation I: Zapier and Make"], [9, "Workflow Automation II: n8n"], [10, "Knowledge Bots: RAG and Chatbots"], [11, "Building Applications with AI: Vibe Coding and GitHub"], [12, "AI Agents for Operations"], [13, "Visual Agent Builders, Multi-Agent Teams, and Connected Tools"],
  [14, "Breaking AI: How It Fails and How It's Attacked"], [15, "Evaluating, Defending, and Costing AI"], [16, "AI Across Industries"], [17, "Responsible AI, Governance, and AI Strategy"], [18, "AWS Certified AI Practitioner Exam Readiness"],
  [19, "Capstone Build"], [20, "Portfolio, Presentations, and Graduation"],
].map(([n, theme]) => ({ n: n as number, theme: theme as string, phase: PHASES.find(p => p.weeks.includes(n as number))!.n }));

const DAY_TITLES: Record<number, [string, string, string]> = {
  1: ["What Is AI? The Family Tree, the Timeline, and When Not to Use It", "How Machines Learn from Data", "The ML Lifecycle and How We Measure Models"],
  2: ["Neural Networks and Deep Learning, No Math Required", "Tokens, Embeddings, and Transformers", "How LLMs Generate Answers and How They're Trained"],
  3: ["LLMs, SLMs, Open and Closed Models, and Running AI Locally", "Multimodal Generative AI: Images, Audio, and Video", "Generative AI on AWS: Foundation Models, Bedrock, and PartyRock"],
  4: ["Prompt Engineering That Works", "Context Engineering: Projects, Memory, and Grounding", "AI for Research and Writing, and the Risks Hidden in Prompts"],
  5: ["Designing Reusable AI Assistants", "Meetings, Email, and Documents with AI", "Presentations and Visual Communication"],
  6: ["Spreadsheet Foundations with an AI Co-Pilot", "Cleaning and Analyzing Messy Data", "Dashboards and Data Stories"],
  7: ["Thinking Like a Programmer", "JSON, APIs, and Webhooks in Plain Language", "Reading and Editing Code with AI"],
  8: ["Automation Logic and Your First Zap", "AI Steps in Make Scenarios", "Reliable Automations: Errors, Testing, and Documentation"],
  9: ["n8n Basics: Open-Source Automation", "AI Nodes and Structured Output in n8n", "Multi-System Data Pipelines"],
  10: ["Embeddings and RAG Without Code", "Build a Grounded Chatbot", "Conversation Design and Chatbot Testing"],
  11: ["Vibe Coding a Real Application", "GitHub and VS Code: Versioning and Growing Your App", "Publishing Safely"],
  12: ["From Chatbots to Agents", "How Agents Use Tools, and Tracing What They Did", "Agents with Memory, Planning, and Human Approval"],
  13: ["Visual Agent Builders Compared", "Multi-Agent Teams Without Code", "MCP Trust, A2A, and Skills for Power Users"],
  14: ["How AI Fails on Its Own", "Prompt Injection and Jailbreaks", "Attacking Agents, Automations, and Browser Agents"],
  15: ["Continuous Evaluation: Proving It Keeps Working", "Guardrails and Logging in Workflows", "Choosing How to Improve AI, and What It Costs"],
  16: ["Marketing, Content, and Personalization", "Customer Service, Operations, and Finance", "HR, Healthcare, and Legal: High-Stakes AI"],
  17: ["Responsible AI in Practice", "Security, Compliance, and Governance for AI", "Requirements, ROI, and Capstone Proposals"],
  18: ["Exam Review: AI, ML, and Generative AI Fundamentals", "Exam Review: Applications, Responsible AI, and Security", "Practice Exam and Capstone Architecture"],
  19: ["Build the Core on Budget", "Evaluate, Red Team, and Harden", "Package and Hand Off the Capstone"],
  20: ["Portfolio and the AI Job Market", "Capstone Presentations", "Final Presentations, What's Next, and Graduation"],
};

export const sid = (w: number, d: number) => `w${String(w).padStart(2, "0")}d${d}`;

export const SESSIONS: Session[] = WEEKS.flatMap(w =>
  ([1, 2, 3] as const).map(d => ({ id: sid(w.n, d), week: w.n, day: d, title: DAY_TITLES[w.n][d - 1], built: false } as Session))
);

// Content registry: the database holds each session's content; this loads it into the shells above.
const CONTENT_KEYS: (keyof SessionContent)[] = ["goal", "steps", "stretch", "doneWhen", "lens", "quiz", "sandbox", "submission", "tools", "exam", "verified"];
export function applyContent(map: Record<string, SessionContent>) {
  for (const s of SESSIONS) {
    const c = map[s.id];
    for (const k of CONTENT_KEYS) delete (s as unknown as Record<string, unknown>)[k];
    if (c) { Object.assign(s, c); s.built = true; } else s.built = false;
  }
}

// Validation for imported JSON. Returns a list of problems; empty means valid.
export function validateContent(c: unknown): string[] {
  const e: string[] = [];
  if (!c || typeof c !== "object") return ["Not a JSON object."];
  const x = c as Record<string, unknown>;
  if (typeof x.goal !== "string" || !x.goal) e.push("goal: missing");
  if (!Array.isArray(x.steps) || x.steps.length < 3) e.push("steps: need at least 3");
  else x.steps.forEach((st: unknown, i: number) => { const t = st as Record<string, unknown>; if (!t.label) e.push(`steps[${i}]: label missing`); if (!Array.isArray(t.do) || !t.do.length) e.push(`steps[${i}]: do[] missing`); if (!t.see) e.push(`steps[${i}]: see missing`); if (t.checkpoint) { const cp = t.checkpoint as Record<string, unknown>; if (!["text", "choice", "upload", "confirm"].includes(cp.kind as string)) e.push(`steps[${i}]: checkpoint kind invalid`); if (!cp.prompt) e.push(`steps[${i}]: checkpoint prompt missing`); if (cp.kind === "choice" && (!Array.isArray(cp.options) || typeof cp.correct !== "number" || !cp.why)) e.push(`steps[${i}]: choice needs options, correct, why`); } });
  if (!Array.isArray(x.quiz) || x.quiz.length !== 5) e.push("quiz: must have exactly 5 questions");
  else x.quiz.forEach((q: unknown, i: number) => { const t = q as Record<string, unknown>; if (!t.q || !Array.isArray(t.a) || (t.a as unknown[]).length < 3 || typeof t.c !== "number" || !t.why) e.push(`quiz[${i}]: needs q, a[3+], c, why`); if (Array.isArray(t.a) && typeof t.c === "number" && (t.c < 0 || t.c >= (t.a as unknown[]).length)) e.push(`quiz[${i}]: c out of range`); });
  if (!Array.isArray(x.lens) || x.lens.length < 3 || x.lens.length > 5) e.push("lens: need 3 to 5 Exam Lens terms");
  else x.lens.forEach((t: unknown, i: number) => { const l = t as Record<string, unknown>; if (!l.term || !l.plain || !l.exam) e.push(`lens[${i}]: needs term, plain, exam`); if (l.exam && !/Domain/i.test(String(l.exam))) e.push(`lens[${i}]: exam text should name a Domain`); });
  if (!Array.isArray(x.doneWhen) || !x.doneWhen.length) e.push("doneWhen: missing");
  if (!Array.isArray(x.tools) || !x.tools.length) e.push("tools: list at least one tool");
  else x.tools.forEach((t: unknown, i: number) => { const tl = t as Record<string, unknown>; if (!tl.name || !tl.url || !tl.use || !tl.free) e.push(`tools[${i}]: needs name, url, use, free`); if (tl.url && !/^https?:\/\//.test(String(tl.url))) e.push(`tools[${i}]: url must start with http`); });
  if (x.sandbox && x.sandbox !== "classifier") e.push("sandbox: unknown sandbox id");
  // Exam block: every session that is tested needs cards and practice mapped to official objective IDs.
  if (!x.exam || typeof x.exam !== "object") e.push("exam: missing (objectives, cards, practice). Every session needs an exam block; use objectives: [] for a day that isn't tested.");
  else {
    const ex = x.exam as Record<string, unknown>;
    const objs = Array.isArray(ex.objectives) ? (ex.objectives as unknown[]).map(String) : [];
    if (!Array.isArray(ex.objectives)) e.push("exam.objectives: must be a list of objective IDs like \"1.1.1\"");
    objs.forEach(o => { if (!OBJECTIVE_IDS.has(o)) e.push(`exam.objectives: ${o} is not in the official AIF-C01 objective list`); });
    const tested = objs.length > 0;
    const cards = Array.isArray(ex.cards) ? (ex.cards as unknown[]) : [];
    const prac = Array.isArray(ex.practice) ? (ex.practice as unknown[]) : [];
    if (tested && cards.length < 6) e.push("exam.cards: need at least 6 cards for a tested session");
    cards.forEach((c, i) => { const k = c as Record<string, unknown>; if (!k.id || !k.obj || !k.q || !k.a) e.push(`exam.cards[${i}]: needs id, obj, q, a`); if (k.q && !/\?\s*$/.test(String(k.q))) e.push(`exam.cards[${i}]: front must be a question ending in "?"`); if (k.obj && !objs.includes(String(k.obj))) e.push(`exam.cards[${i}]: obj ${k.obj} is not in exam.objectives`); if (k.a && String(k.a).length > 320) e.push(`exam.cards[${i}]: answer over 320 characters; one idea per card`); });
    if (tested && prac.length < 6) e.push("exam.practice: need at least 6 scenario questions for a tested session");
    prac.forEach((p, i) => { const k = p as Record<string, unknown>; if (!k.id || !k.obj || !k.q || !Array.isArray(k.a) || typeof k.c !== "number" || !k.why) e.push(`exam.practice[${i}]: needs id, obj, q, a[], c, why`); if (Array.isArray(k.a) && (k.a as unknown[]).length !== 4) e.push(`exam.practice[${i}]: exactly 4 options, like the real exam`); if (Array.isArray(k.a) && typeof k.c === "number" && (k.c < 0 || k.c >= (k.a as unknown[]).length)) e.push(`exam.practice[${i}]: c out of range`); if (k.obj && !objs.includes(String(k.obj))) e.push(`exam.practice[${i}]: obj ${k.obj} is not in exam.objectives`); if (k.wrong && (!Array.isArray(k.wrong) || (k.wrong as unknown[]).length !== (k.a as unknown[])?.length)) e.push(`exam.practice[${i}]: wrong[] must have one line per option (use "" for the correct one)`); });
    const ids = [...cards, ...prac].map(z => String((z as Record<string, unknown>).id)); if (new Set(ids).size !== ids.length) e.push("exam: card and practice ids must be unique within the session");
  }
  // Verification stamp from the build. The portal never asks the instructor to verify; the JSON carries proof it was done.
  const v = x.verified as Record<string, unknown> | undefined;
  if (!v || typeof v !== "object") e.push("verified: missing. The build must run the live checks and stamp {date, checks[], note} before this file is importable.");
  else {
    if (typeof v.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.date)) e.push("verified.date: must be YYYY-MM-DD");
    else if (new Date(v.date).getTime() > Date.now() + 864e5) e.push("verified.date: is in the future");
    if (!Array.isArray(v.checks) || v.checks.length < 3) e.push("verified.checks: list what was checked (tools and free tiers, links, facts and dates, answers, guide match)");
    if (typeof v.note !== "string" || !v.note.trim()) e.push("verified.note: say what changed since the last build, or 'nothing changed'");
  }
  return e;
}


// Human-readable diff between two contents, for the import preview.
export function diffContent(a: SessionContent | undefined, b: SessionContent): string[] {
  if (!a) return ["New content (nothing imported before)."];
  const out: string[] = [];
  if (a.goal !== b.goal) out.push("Goal text changed.");
  const as = a.steps || [], bs = b.steps || [];
  if (as.length !== bs.length) out.push(`Steps: ${as.length} → ${bs.length}.`);
  bs.forEach((st, i) => { const o = as[i]; if (!o) out.push(`Step ${i + 1} added: ${st.label}`); else if (JSON.stringify(o) !== JSON.stringify(st)) out.push(`Step ${i + 1} changed: ${st.label}`); });
  (a.quiz || []).forEach((q, i) => { const n = (b.quiz || [])[i]; if (!n || JSON.stringify(q) !== JSON.stringify(n)) out.push(`Quiz question ${i + 1} changed.`); });
  if (JSON.stringify(a.lens) !== JSON.stringify(b.lens)) out.push("Exam Lens terms changed.");
  if (JSON.stringify(a.tools) !== JSON.stringify(b.tools)) out.push("Tools list changed.");
  if (a.verified?.date !== b.verified?.date) out.push(`Verification stamp: ${a.verified?.date ?? "none"} → ${b.verified?.date ?? "none"}.`);
  if (JSON.stringify(a.exam) !== JSON.stringify(b.exam)) { const ac = a.exam?.cards.length ?? 0, bc = b.exam?.cards.length ?? 0, ap = a.exam?.practice.length ?? 0, bp = b.exam?.practice.length ?? 0; out.push(`Exam block changed: cards ${ac} → ${bc}, practice ${ap} → ${bp}, objectives ${(b.exam?.objectives || []).join(", ") || "none"}.`); }
  if (JSON.stringify(a.doneWhen) !== JSON.stringify(b.doneWhen) || JSON.stringify(a.stretch) !== JSON.stringify(b.stretch)) out.push("Done-when or Stretch changed.");
  if (!out.length) out.push("No differences from the current content.");
  return out;
}
export const byId = (id: string) => SESSIONS.find(s => s.id === id);
