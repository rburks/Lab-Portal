# Software/AI Lab Portal

A learning platform for the 20-week Software/AI course: locked sessions that unlock one by one, lab checklists, a concept sandbox, self-scoring quizzes, screenshot and link submissions, a course calendar with buffer and holiday days, office hours booking, direct messages and announcements, an interactive AIF-C01 study guide, and an instructor dashboard (performance insights with the grouped progress grid, filters, grading, and CSV export on one page), a Class page for attendance and roster, and a Calendar that holds the schedule and office hours.

Stack: React + Vite + TypeScript, Supabase (auth, Postgres, storage), Netlify hosting. Everything runs on free tiers at class scale (verified October 2026: Supabase Free 500 MB DB, 1 GB storage; Netlify Free 300 credits/month).

## Run the demo (no backend)

```bash
npm install
npm run dev
```

Open the local URL. With no `.env` file the app runs in demo mode with 12 example students. Use the dropdown at the top right to switch between a strong student, a struggling student, and the instructor.

## Deploy for real (about 20 minutes)

### 1. Supabase

1. Create a free project at supabase.com. Pick a region near Alabama (US East).
2. Open **SQL Editor**, paste the contents of `supabase/schema.sql`, run it. This creates the tables, security rules, the `submissions` storage bucket, and the trigger that creates a profile on first sign-in.
3. Open **Authentication → Providers**, make sure **Email** is on. Under **Email → Confirm email**, you can leave defaults; the app uses magic links, so no passwords.
4. Open **Authentication → URL Configuration**. Set **Site URL** to your Netlify URL (you'll have it after step 2; come back and set it). Add the same URL to **Redirect URLs**.
5. Open **Project Settings → API**. Copy the **Project URL** and the **anon public** key.

### 2. Netlify

1. Push this folder to a GitHub repository.
2. In Netlify, **Add new site → Import from Git**, pick the repo. Build command `npm run build`, publish directory `dist` (already in `netlify.toml`).
3. Under **Site configuration → Environment variables**, add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
4. Deploy. Copy the site URL back into Supabase's Site URL and Redirect URLs (step 1.4).

### 3. First sign-in and roster

1. In Supabase **Table Editor → roster**, insert a row with your email and role `instructor`.
2. Open the site, sign in with that email, click the link in the mail.
3. Confirm in **Table Editor → profiles** that your row has role `instructor`. If not, run:
   `update public.profiles set role = 'instructor' where email = 'you@example.com';`
4. Reload the site. You now have the **Instructor** tab. Go to **Class → Roster** and add your students (name and email per row, or paste a list).
5. Go to **Sessions**, pick Week 1 Day 1, and click **Unlock for class**. Students see everything else as locked.

### 4. Before each class

- Unlock the day's session (whole class, or one student at a time).
- The Supabase free project pauses after 7 days with no activity. Over a long break, open the Supabase dashboard the day before class and click **Restore** if it's paused. Class three nights a week keeps it awake otherwise.

## Updating an existing deployment

Push to `main` and Netlify redeploys. If the schema changed (check the bottom of `supabase/schema.sql` for dated sections), paste that dated section into the Supabase SQL editor and run it. All sections are safe to re-run.

October 6 additions: `calendar_days`, `office_hour_slots`, `office_hour_requests`, `messages`, `announcements`, `flashcards`, `course_settings`, a `responses` column on `progress`, and (second batch) `session_content`, `session_materials`, `attendance`, plus a public `materials` storage bucket. Third batch (exam guide): `due`, `streak`, `obj` on `flashcards`, and `mock_attempts`. October 7: `proposed` status and `proposed_at` on `office_hour_requests`. October 7 batch 2: `rubric` on grades, `showcase`, `capstones`, `capstone_milestones`, `portfolios` (plus a public `portfolio` bucket), `notify_prefs`, `notify_log`, and `email_on` on course settings.

## Guided labs

Each lab is a sequence of steps. A step has a short title, one line on why it matters, numbered instructions written for someone who has never opened the tool, a "what you should see" box, an optional "if it didn't work" tip, and a checkpoint. Checkpoint kinds: `text` (student types an answer, optional minimum length), `choice` (a quick check with instant feedback; the right answer unlocks the step), `upload` (screenshot or link), `confirm` (a specific observation to tick). Steps unlock in order. Every typed answer is saved to `progress.responses` and shows in the instructor's grading drawer.

## Session content: the weekly workflow (no code changes)

Content lives in the database, not in code. The **Sessions** page is the one place per session for import, materials, verification status, and unlocking. For each session you receive four things from the build: the Gamma prompt, the instructor guide, the student guide, and a portal JSON file (`content/weekNN/wNNdD.json`). Then, in the portal:

1. **Sessions**, pick the session, **Upload JSON file** (or paste). The page validates it (exactly 5 quiz questions, 3 to 5 Exam Lens terms, every step has instructions and a checkpoint, every tool has a URL, an exam block, and a verification stamp) and shows a diff against the current content. Add a version note, click **Import**.
2. **Materials**: upload the student guide (PDF or Word) and add the Gamma slides and lab deck links. Students see a Download button and tool links at the top of the session.
3. **Verification** is not an instructor step. The build runs the live checks (tools and free tiers, links, facts and dates, every answer, guide match) and stamps `verified: {date, checks, note, sources}` into the JSON; the validator refuses a file without it. The Sessions page shows the stamp read-only, and the Access card flags a missing stamp before you unlock.
4. **Unlock** the session from the Access card at the top of the same page (whole class, or early access for chosen students). The readiness pills show what's still missing, and the Unlock button asks before opening a session that isn't ready.

Week 1's three files are in `content/week01/`. To seed a fresh deployment, import each one on the Sessions page.

**Export all content** downloads every session's JSON with version and verification dates, for backup and for your records of exactly what students saw.

Sandboxes (interactive concept pages like the Day 2 classifier) are the one thing still in code: `src/components/`. A session's JSON references one by id (`"sandbox": "classifier"`). New sandboxes are built and deployed ahead of the weeks that need them.

## Exam study guide

Built around the official AIF-C01 objective list in `src/content/objectives.json` (69 objectives, exam guide v1.1, April 30, 2026). Each session's JSON carries an `exam` block: `objectives` (official IDs like `1.1.2`), `cards` (one question per card, answer in plain words), `practice` (exam-style scenarios with four options and a reason each wrong option is wrong), and optional `notTested`. The validator rejects unknown objective IDs, card fronts that aren't questions, and questions without exactly four options.

Students see three views. **Exam map**: every domain, task statement, and objective, marked Covered (links to the session), Coming (week number), or taught but not tested. **Flashcards**: spaced review; fuzzy cards return in 2 days, correct ones in 7, 21, then 45. **Mock exam**: timed at the real pace (83 seconds per question), no feedback until the end, an estimated scaled score against 700, and a per-objective miss list. Attempts are saved in `mock_attempts` (instructors can read all).

If the official guide changes, update `objectives.json` and the `first` session for any new objective; nothing else needs to change.

## Office hours

Students book a recurring slot or propose a custom time, with a topic. The instructor works from **Office hours** in the nav (badge shows how many are waiting) or the dashboard card: **Accept**, **Decline** with a note, or **Propose new time**, which sends the student a counter-offer they accept or decline from their own Calendar. Every decision also posts a message in the student's thread. The Instructor / Student view toggle applies here too, so switching to Student view shows the booking form.

## Exam readiness (instructor)

**Class → Exam readiness** reads every student's saved mock attempts. Each student gets a status from their latest mock (Ready at 750 and up, Close at 700 to 749, Not yet under 700, or No mock), their best score, trend, accuracy by domain, and their three weakest objectives. Above that, "What the class misses most" lists the objectives with the highest miss rate and links to the session to reteach. Scores are the portal's straight-line estimate, so watch the trend more than the number.

## Lab showcase

Students share one of their own submissions with a one-line caption, from the session's Submit tab or the **Showcase** page. Classmates see first name and last initial only. You can feature or hide anything from **Class → Showcase**. Shared screenshots become visible to classmates only while the item is shared and not hidden.

## Rubrics and drafted feedback

Every lab's JSON carries a `rubric`: 3 to 6 items that add to 100 points, each with two "what worked" lines and two "what to fix" lines in your voice. In the grading drawer, tick what's there and the score follows. **Draft from rubric** writes a two-sentence note: one thing that worked (quoting the student's own checkpoint answer where it can) and the most valuable thing to fix. No AI is involved; it assembles lines written ahead of time and varies the phrasing per student. Edit it before saving. Students see the rubric breakdown with their grade.

## Capstone tracker

Seven milestones from the curriculum (stakeholder, proposal, architecture, core build, eval and red team, handoff, presentation), each with due dates from the calendar. Students submit a link and a note under **My work → Capstone**. You review from **Class → Capstone**: approve, or send back with a note. Students can only ever mark their own milestones as submitted.

## Portfolio pages

Under **My work → Portfolio**, students build a public page: headline, bio, their capstone, selected lab work (screenshots are copied into a public `portfolio` bucket), LinkedIn, and their AWS badge link once they pass. Nothing is public until they click Publish. The page lives at `/p/their-name` and opens without signing in, so it can go on a resume.

## Email notifications

Off until you turn them on. Students get a short email when a session unlocks, a grade posts, you reply to a message, you review a capstone milestone, or you post an announcement. You get one when a student messages you or requests office hours. Message emails are limited to one per thread every 30 minutes. Students can opt out under **Messages → Email**.

Supabase Edge Functions can't send email directly (outbound mail ports are blocked), so the function hands messages to a mail provider. Two options:

- **Gmail through Google Apps Script (default, no domain needed).** Sends from your own Gmail. A personal Gmail account can send to 100 recipients a day this way, which covers 20 students.
- **Resend (only if you own a domain).** Set `MAIL_PROVIDER=resend` and verify your domain in Resend.

Setup, about 15 minutes:

1. **Apps Script relay.** Open script.google.com → New project → paste `email/Mailer.gs`. Project Settings → Script properties → add `SECRET` with a long random string. Deploy → New deployment → Web app, Execute as **Me**, Who has access **Anyone**. Approve the permissions. Copy the Web app URL (ends in `/exec`).
2. **Edge Function.** In Supabase, Edge Functions → Deploy a new function → Via Editor. Name it exactly `notify`. Replace the code with `supabase/functions/notify/index.ts`. Deploy.
3. **Secrets.** Edge Functions → Secrets. Add `PORTAL_URL` (your Netlify address), `MAIL_PROVIDER` = `gas`, `GAS_URL` (from step 1), `GAS_SECRET` (the same string as step 1).
4. **Turn on and test.** In the portal, **Messages → Email → Turn on**, then **Send me a test email**. The Recent sends list shows each send and any error.

## Attendance

**Class → Attendance** defaults to today's session (from the calendar). Mark present, late, or absent per student, or "Mark rest present" after marking the exceptions. Two or more absences add a flag on the dashboard.

## How grading and insights work

- **Session state** per student: Locked → Not started → In progress → Complete (all steps and quiz) → Submitted → Graded.
- **Composite score**: labs 40%, quiz best scores 30%, graded work 30%. Missing parts are re-weighted so an ungraded student isn't penalised.
- **Flags** ("may be struggling"): labs under 50% done, quiz average under 60%, graded average under 70, or no activity for 7 or more days. Thresholds live in `src/lib/logic.ts`.
- **CSV export** respects the current filters and includes per-session lab %, quiz best, submission count, score, and feedback, ready for the master Google Sheet.

## Storage notes

Screenshots are compressed in the browser to 1400 px wide JPEG at 72% before upload (about 150 to 300 KB each). Twenty students over 60 sessions fits well within 1 GB. Files live in the private `submissions` bucket under `<student id>/<session id>/`; students see only their own, instructors see all.
