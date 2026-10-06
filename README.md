# Software/AI Lab Portal

A learning platform for the 20-week Software/AI course: locked sessions that unlock one by one, lab checklists, a concept sandbox, self-scoring quizzes, screenshot and link submissions, a course calendar with buffer and holiday days, office hours booking, direct messages and announcements, an interactive AIF-C01 study guide, and an instructor dashboard with performance insights, grouped progress grid, filters, grading, and CSV export.

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
4. Reload the site. You now have the **Instructor** tab. Go to **Roster**, paste your students' emails (one per line, a name before the email is optional), and add them.
5. Go to **Unlock sessions**, unlock Week 1 (or just Day 1). Students see everything else as locked.

### 4. Before each class

- Unlock the day's session (whole class, or one student at a time).
- The Supabase free project pauses after 7 days with no activity. Over a long break, open the Supabase dashboard the day before class and click **Restore** if it's paused. Class three nights a week keeps it awake otherwise.

## Updating an existing deployment

Push to `main` and Netlify redeploys. If the schema changed (check the bottom of `supabase/schema.sql` for dated sections), paste that dated section into the Supabase SQL editor and run it. All sections are safe to re-run.

October 6 additions: `calendar_days`, `office_hour_slots`, `office_hour_requests`, `messages`, `announcements`, `flashcards`, `course_settings`, a `responses` column on `progress`, and (second batch) `session_content`, `session_materials`, `attendance`, plus a public `materials` storage bucket.

## Guided labs

Each lab is a sequence of steps. A step has a short title, one line on why it matters, numbered instructions written for someone who has never opened the tool, a "what you should see" box, an optional "if it didn't work" tip, and a checkpoint. Checkpoint kinds: `text` (student types an answer, optional minimum length), `choice` (a quick check with instant feedback; the right answer unlocks the step), `upload` (screenshot or link), `confirm` (a specific observation to tick). Steps unlock in order. Every typed answer is saved to `progress.responses` and shows in the instructor's grading drawer.

## Session content: the weekly workflow (no code changes)

Content lives in the database, not in code. For each session you receive four things from the build: the Gamma prompt, the instructor guide, the student guide, and a portal JSON file (`content/weekNN/wNNdD.json`). Then, in the portal:

1. **Instructor → Content**, pick the session, **Upload JSON file** (or paste). The page validates it (exactly 5 quiz questions, 3 to 5 Exam Lens terms, every step has instructions and a checkpoint, every tool has a URL) and shows a diff against the current content. Add a version note, click **Import**.
2. **Materials**: upload the student guide (PDF or Word) and add the Gamma slides and lab deck links. Students see a Download button and tool links at the top of the session.
3. **Day of class, after the live check**: tick the five verification boxes, write what you checked, **Mark verified for today**. The session shows green. Unlock warns if a session isn't verified, and importing new content clears the verification so it has to be re-checked.
4. **Unlock** the session.

Week 1's three files are in `content/week01/`. To seed a fresh deployment, import each one on the Content page.

**Export all content** downloads every session's JSON with version and verification dates, for backup and for your records of exactly what students saw.

Sandboxes (interactive concept pages like the Day 2 classifier) are the one thing still in code: `src/components/`. A session's JSON references one by id (`"sandbox": "classifier"`). New sandboxes are built and deployed ahead of the weeks that need them.

## Attendance

**Instructor → Attendance** defaults to today's session (from the calendar). Mark present, late, or absent per student, or "Mark rest present" after marking the exceptions. Two or more absences add a flag on the dashboard.

## How grading and insights work

- **Session state** per student: Locked → Not started → In progress → Complete (all steps and quiz) → Submitted → Graded.
- **Composite score**: labs 40%, quiz best scores 30%, graded work 30%. Missing parts are re-weighted so an ungraded student isn't penalised.
- **Flags** ("may be struggling"): labs under 50% done, quiz average under 60%, graded average under 70, or no activity for 7 or more days. Thresholds live in `src/lib/logic.ts`.
- **CSV export** respects the current filters and includes per-session lab %, quiz best, submission count, score, and feedback, ready for the master Google Sheet.

## Storage notes

Screenshots are compressed in the browser to 1400 px wide JPEG at 72% before upload (about 150 to 300 KB each). Twenty students over 60 sessions fits well within 1 GB. Files live in the private `submissions` bucket under `<student id>/<session id>/`; students see only their own, instructors see all.
