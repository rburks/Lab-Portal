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

## Adding session content

All course content lives in `src/content/course.ts`. Week 1 is fully built; the other 57 sessions are shells with titles. To build a session, add its entry to the `W1`-style map (rename it as you go) with `goal`, `steps`, `stretch`, `doneWhen`, `lens`, `quiz`, and optionally `sandbox` and `submission`. The session becomes `built: true` automatically and shows its tabs. Unbuilt sessions show a "being built" notice when unlocked.

Sandboxes are React components in `src/components/`. Add a new one, give it a key in the `Session.sandbox` union, and render it in `SessionPage.tsx`.

## Calendar, office hours, messages, study guide

- **Calendar.** The schedule is generated from the start date (Oct 12, 2026) and class days (Mon, Tue, Thu). Add a **holiday** or **buffer** day on a class date and every later session shifts back one class day; the end date updates. Remove it to pull them forward. Change the start date or class days in the `course_settings` table.
- **Office hours.** Define recurring slots (day, start, length, capacity, location). Students book one of the next three dates for a slot, or propose any date and time, always with a topic. You accept, decline with an optional note, or mark done.
- **Messages.** Each student has one private thread with the instructor. The nav badge shows unread counts. Threads refresh every 20 seconds; there is no email notification yet (that needs a Supabase Edge Function plus an email provider; ask and I'll add it).
- **Announcements.** Class-wide posts, optionally pinned. The two most recent show at the top of every student's course page.
- **Exam study guide.** Built automatically from the Exam Lens terms and quiz questions of every unlocked session. Domain map shows the five AIF-C01 domains with weights, which sessions covered each, the student's quiz average per domain, and a "focus first" callout. Flashcards flip, with "Got it" and "Still fuzzy" piles saved per student. Practice pulls shuffled questions across covered sessions and reports a round score against the 70% passing line.

## How grading and insights work

- **Session state** per student: Locked → Not started → In progress → Complete (all steps and quiz) → Submitted → Graded.
- **Composite score**: labs 40%, quiz best scores 30%, graded work 30%. Missing parts are re-weighted so an ungraded student isn't penalised.
- **Flags** ("may be struggling"): labs under 50% done, quiz average under 60%, graded average under 70, or no activity for 7 or more days. Thresholds live in `src/lib/logic.ts`.
- **CSV export** respects the current filters and includes per-session lab %, quiz best, submission count, score, and feedback, ready for the master Google Sheet.

## Storage notes

Screenshots are compressed in the browser to 1400 px wide JPEG at 72% before upload (about 150 to 300 KB each). Twenty students over 60 sessions fits well within 1 GB. Files live in the private `submissions` bucket under `<student id>/<session id>/`; students see only their own, instructors see all.
