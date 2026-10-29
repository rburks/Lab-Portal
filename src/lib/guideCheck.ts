// Student guide upload check: makes sure an instructor guide (or another session's guide) is never posted to students.
// Reads the .docx in the browser (a .docx is a zip). No libraries: uses the browser's built-in DecompressionStream.
//
// 1. The build stamps every guide's Word properties: subject "student-guide" or "instructor-guide",
//    keywords "student-guide; session:w03d3". That label is checked first.
// 2. Files without the label (older builds) are checked by their text: instructor-only phrases block the upload,
//    and the "WEEK n · DAY n" header must match the selected session.

export type GuideCheck = { ok: boolean; message: string; warn?: string };

const INSTRUCTOR_PHRASES = ["INSTRUCTOR GUIDE", "Quiz answer key", "How to read this guide", "Pacing (instructor only"];

async function readZip(file: Blob): Promise<Map<string, () => Promise<string>>> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // Find the end-of-central-directory record (signature 0x06054b50) near the end of the file.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const entries = new Map<string, () => Promise<string>>();
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));
    entries.set(name, async () => {
      const lName = dv.getUint16(local + 26, true), lExtra = dv.getUint16(local + 28, true);
      const start = local + 30 + lName + lExtra;
      const raw = buf.subarray(start, start + csize);
      if (method === 0) return dec.decode(raw);
      if (method !== 8) throw new Error("unsupported compression");
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return await new Response(stream).text();
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? m[1].trim() : "";
};

function docText(xml: string): string {
  // Join the text runs of each paragraph, one paragraph per line.
  return xml.split(/<\/w:p>/).map(par => (par.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, "")).join("")).join("\n")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

export async function checkStudentGuide(file: File, session: { id: string; week: number; day: number }): Promise<GuideCheck> {
  const label = `${session.id.toUpperCase()} (Week ${session.week} Day ${session.day})`;
  if (!/\.docx$/i.test(file.name)) {
    return { ok: false, message: `Upload the Word (.docx) version of the student guide. The portal can only check Word files for instructor content.` };
  }
  let zip: Map<string, () => Promise<string>>;
  try { zip = await readZip(file); } catch {
    return { ok: false, message: `This file couldn't be opened as a Word document. Re-save it as .docx and upload again.` };
  }
  const core = zip.get("docProps/core.xml") ? await zip.get("docProps/core.xml")!() : "";
  const subject = tag(core, "dc:subject").toLowerCase();
  const keywords = tag(core, "cp:keywords").toLowerCase();
  const stampedSession = keywords.match(/session:(w\d{2}d\d)/)?.[1];

  // 1. The build's label.
  if (subject === "instructor-guide" || keywords.includes("instructor-guide")) {
    return { ok: false, message: `Blocked: this is the Instructor Guide${stampedSession ? ` for ${stampedSession.toUpperCase()}` : ""}. Upload the Student Guide instead.` };
  }
  if (stampedSession && stampedSession !== session.id) {
    return { ok: false, message: `Blocked: this student guide is for ${stampedSession.toUpperCase()}, but ${label} is selected. Pick the matching session on the left, or upload the ${session.id.toUpperCase()} guide.` };
  }

  // 2. The text itself (catches older files and anything relabeled by hand).
  const body = zip.get("word/document.xml") ? docText(await zip.get("word/document.xml")!()) : "";
  if (!body) return { ok: false, message: `This Word file has no readable text. Upload the Student Guide .docx from the build.` };
  const hit = INSTRUCTOR_PHRASES.find(ph => body.toLowerCase().includes(ph.toLowerCase()));
  if (hit) {
    return { ok: false, message: `Blocked: this file contains instructor-only content ("${hit}"). It looks like an Instructor Guide. Upload the Student Guide instead.` };
  }
  const head = body.match(/WEEK\s+(\d+)\s*·\s*DAY\s+(\d+)/i);
  if (head && (Number(head[1]) !== session.week || Number(head[2]) !== session.day)) {
    return { ok: false, message: `Blocked: this guide is for Week ${head[1]} Day ${head[2]}, but ${label} is selected. Pick the matching session on the left, or upload the right guide.` };
  }

  if (subject === "student-guide" && stampedSession === session.id) {
    return { ok: true, message: `Checked: Student Guide for ${session.id.toUpperCase()}.` };
  }
  return { ok: true, message: `Checked: no instructor content found.`, warn: `This file has no build label, so the portal checked its text instead. Newer guides from the build carry a label.` };
}
