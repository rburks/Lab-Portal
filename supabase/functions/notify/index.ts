// notify: sends portal email notifications. Called by the portal after an action (unlock, grade, message...).
// It checks who is calling, works out the recipients with the service key, skips anyone who opted out,
// writes plain-text emails, and hands them to a mail provider.
//
// Secrets to set in Supabase (Edge Functions > Secrets):
//   PORTAL_URL      the site address, e.g. https://your-site.netlify.app
//   MAIL_PROVIDER   "gas" (Gmail via Google Apps Script, no domain needed) or "resend" (needs your own domain)
//   GAS_URL, GAS_SECRET          when MAIL_PROVIDER=gas
//   RESEND_API_KEY, MAIL_FROM    when MAIL_PROVIDER=resend (MAIL_FROM like "Software/AI <portal@yourdomain.com>")
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
type Mail = { to: string; subject: string; text: string };
const first = (n?: string | null) => (n || "").trim().split(/\s+/)[0] || "there";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const env = (k: string) => Deno.env.get(k) || "";
  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const asUser = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ ok: false, error: "Not signed in" }, 401);
  const { data: me } = await admin.from("profiles").select("id,full_name,email,role").eq("id", user.id).single();
  if (!me) return json({ ok: false, error: "No profile" }, 403);
  const isInstr = me.role === "instructor";
  const body = await req.json().catch(() => ({}));
  const kind = String(body.kind || "");
  const portal = env("PORTAL_URL").replace(/\/$/, "");
  const { data: settings } = await admin.from("course_settings").select("email_on").eq("id", 1).single();
  if (kind !== "test" && !settings?.email_on) return json({ ok: true, skipped: "Email notifications are off" });

  const { data: profiles } = await admin.from("profiles").select("id,full_name,email,role");
  const { data: prefs } = await admin.from("notify_prefs").select("student_id,opt_out");
  const optedOut = new Set((prefs || []).filter(p => p.opt_out).map(p => p.student_id));
  const students = (profiles || []).filter(p => p.role === "student" && !optedOut.has(p.id));
  const instructors = (profiles || []).filter(p => p.role === "instructor");
  const byId = (id: string) => (profiles || []).find(p => p.id === id);
  const footer = (forStudent: boolean) => `\n\n${portal}\n${forStudent ? "You can turn these emails off on the Messages page in the portal." : ""}`;
  const mails: Mail[] = [];
  let ref: string | null = null;

  const instrOnly = () => { if (!isInstr) throw new Error("Instructor only"); };
  try {
    if (kind === "test") {
      instrOnly();
      mails.push({ to: me.email, subject: "Software/AI portal: test email", text: `This is a test from the portal. If you're reading it, email notifications are set up correctly.${footer(false)}` });
    } else if (kind === "unlock") {
      instrOnly();
      const title = String(body.title || "A new session"); const ids: string[] | undefined = body.student_ids;
      const to = ids ? students.filter(s => ids.includes(s.id)) : students;
      to.forEach(s => mails.push({ to: s.email, subject: `Open now: ${title}`, text: `Hi ${first(s.full_name)},\n\n${title} is open in the portal. The lab, slides, and student guide are there, and your progress saves as you go.${footer(true)}` }));
      ref = String(body.session_id || title);
    } else if (kind === "announcement") {
      instrOnly();
      students.forEach(s => mails.push({ to: s.email, subject: `Announcement: ${String(body.title || "").slice(0, 80)}`, text: `${String(body.title || "")}\n\n${String(body.body || "")}\n\nFrom ${me.full_name}${footer(true)}` }));
    } else if (kind === "grade") {
      instrOnly();
      const s = students.find(x => x.id === body.student_id);
      if (s) mails.push({ to: s.email, subject: "Your lab was graded", text: `Hi ${first(s.full_name)},\n\nYour work for ${String(body.session_id || "a session").replace(/^w0?(\d+)d(\d)$/, "Week $1 Day $2")} has a grade and a note from ${first(me.full_name)}. Open the session in the portal to read it.${footer(true)}` });
    } else if (kind === "capstone") {
      instrOnly();
      const s = students.find(x => x.id === body.student_id);
      const verdict = body.status === "approved" ? "was approved" : "needs a revision";
      if (s) mails.push({ to: s.email, subject: `Capstone milestone ${verdict}`, text: `Hi ${first(s.full_name)},\n\nYour capstone milestone "${String(body.milestone || "")}" ${verdict}. The note is on your Capstone tab under My work.${footer(true)}` });
    } else if (kind === "oh_request") {
      if (isInstr) throw new Error("Students only");
      instructors.forEach(i => mails.push({ to: i.email, subject: `Office hours request from ${me.full_name}`, text: `${me.full_name} asked for office hours on ${String(body.when || "").replace("T", " at ").slice(0, 19)}.\n\nTopic: ${String(body.topic || "")}\n\nAccept, decline, or propose a new time on the Calendar page.${footer(false)}` }));
    } else if (kind === "message") {
      const thread = String(body.thread_student_id || "");
      ref = `msg:${thread}:${isInstr ? "to-student" : "to-instr"}`;
      // One email per thread per 30 minutes, so a back-and-forth chat doesn't flood anyone's inbox.
      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: recent } = await admin.from("notify_log").select("id").eq("ref", ref).eq("ok", true).gte("created_at", since).limit(1);
      if (recent && recent.length) return json({ ok: true, skipped: "Already emailed about this thread in the last 30 minutes" });
      if (isInstr) { const s = students.find(x => x.id === thread); if (s) mails.push({ to: s.email, subject: `New message from ${me.full_name}`, text: `Hi ${first(s.full_name)},\n\n${first(me.full_name)} sent you a message in the portal. Open Messages to read and reply.${footer(true)}` }); }
      else { if (thread !== me.id) throw new Error("Not your thread"); instructors.forEach(i => mails.push({ to: i.email, subject: `New message from ${me.full_name}`, text: `${me.full_name} sent you a message. Open Messages in the portal to reply.${footer(false)}` })); }
    } else return json({ ok: false, error: `Unknown kind: ${kind}` }, 400);
  } catch (e) { return json({ ok: false, error: (e as Error).message }, 403); }

  if (!mails.length) return json({ ok: true, skipped: "No recipients" });
  let ok = true, error: string | null = null;
  try { await send(mails, env); } catch (e) { ok = false; error = (e as Error).message; }
  await admin.from("notify_log").insert({ kind, ref, recipients: mails.length, ok, error });
  return json(ok ? { ok, sent: mails.length } : { ok, error }, ok ? 200 : 502);
});

async function send(mails: Mail[], env: (k: string) => string) {
  const provider = env("MAIL_PROVIDER") || "gas";
  if (provider === "resend") {
    for (const m of mails) {
      const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: env("MAIL_FROM"), to: [m.to], subject: m.subject, text: m.text }) });
      if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
    }
    return;
  }
  // Google Apps Script relay: sends from the instructor's own Gmail.
  const r = await fetch(env("GAS_URL"), { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ secret: env("GAS_SECRET"), messages: mails }), redirect: "follow" });
  const t = await r.text();
  let res: { ok?: boolean; error?: string } = {};
  try { res = JSON.parse(t); } catch { throw new Error(`Mail relay returned something unexpected (status ${r.status}). Check the Apps Script deployment URL and that it's deployed as "Anyone".`); }
  if (!res.ok) throw new Error(`Mail relay: ${res.error || "failed"}`);
}
