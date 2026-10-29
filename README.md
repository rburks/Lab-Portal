# Software/AI Portal

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

**Removing a student.** Class → Roster → Remove takes them off every class view (Dashboard, grading, attendance, exam readiness, Calendar, Showcase) and signs them out the next time the portal loads for them. Their work and grades stay in the database, so adding the same email back restores everything. Message history with them stays readable in Messages.
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

1. **Sessions**, pick the session, **Upload JSON file** (or paste). The page validates it against the rules in "Session JSON reference" below and shows a diff against the current content. Add a version note, click **Import**.
2. **Materials**: upload the student guide (Word .docx) and add the Gamma slides and lab deck links. Students see a Download button and tool links at the top of the session. Every guide is checked in the browser before it's saved (`src/lib/guideCheck.ts`): the build writes a hidden label into each guide's Word properties (`student-guide` or `instructor-guide`, plus `session:wNNdD`). An Instructor Guide, a guide labeled for a different session, or any file containing instructor-only text ("INSTRUCTOR GUIDE", "Quiz answer key", "How to read this guide") is blocked. A file with no label is checked by its text and its "WEEK n · DAY n" header, and uploads with a note. PDFs aren't accepted, because the check reads Word files.
   **Class recording** (after class): paste the Zoom cloud recording's share link and passcode. See "Class recordings" below.
3. **Verification** is not an instructor step. The build runs the live checks (tools and free tiers, links, facts and dates, every answer, guide match) and stamps `verified: {date, checks, note, sources}` into the JSON; the validator refuses a file without it. The Sessions page shows the stamp read-only, and the Access card flags a missing stamp before you unlock.
4. **Unlock** the session from the Access card at the top of the same page (whole class, or early access for chosen students). The readiness pills show what's still missing, and the Unlock button asks before opening a session that isn't ready.

Week 1's three files are in `content/week01/`. To seed a fresh deployment, import each one on the Sessions page.

**Export all content** downloads every session's JSON with version and verification dates, for backup and for your records of exactly what students saw.

Sandboxes (interactive concept pages like the Day 2 classifier) are the one thing still in code: `src/components/`. A session's JSON references one by id (`"sandbox": "classifier"`). New sandboxes are built and deployed ahead of the weeks that need them.

## Session JSON reference

One file per session at `content/weekNN/wNNdD.json` (for example `content/week02/w02d1.json`). The file name is the session ID and never changes, so student progress is never orphaned. All text is copied word for word from the student guide, which is the single source of truth. No em dashes anywhere.

**Build order.** A JSON is the fourth thing built for a session, after the Gamma prompt, the instructor guide, and the student guide. Before any of it, the session is checked against the AWS exam guide and the live verification runs. If the JSON fails the validator, the build fixes it before delivery; you never get a file that won't import.

**Top-level fields**

| Field | Required | What goes in it |
|---|---|---|
| `goal` | Yes | The goal-setting prompt that opens the lab ("What two things will your classifier tell apart?") |
| `steps` | Yes, 3 or more | The lab steps (see below) |
| `stretch` | No | List of Stretch tasks for students who finish early |
| `doneWhen` | Yes | List of "done when" checks, same wording as the lab deck |
| `submission` | Yes | `{prompt, kinds}`; kinds are `image`, `text`, or `link` |
| `lens` | Yes, 3 to 5 | Exam Lens terms: `{term, plain, exam}`; `exam` must name the Domain |
| `quiz` | Yes, exactly 5 | `{q, a[3+], c, why}`; `c` is the 0-based index of the right answer |
| `tools` | Yes, 1 or more | `{name, url, use, free}`; url starts with http; `free` states the verified free tier |
| `sandbox` | No | Id of an in-code sandbox (only `classifier` today) |
| `exam` | Yes | The exam block (see below) |
| `rubric` | Yes | The grading rubric (see below) |
| `verified` | Yes | The verification stamp (see below) |

**Steps.** Each step is `{label, why, do[], see, tip?, checkpoint}`. `do` is numbered instructions for someone who has never opened the tool. `see` is the "what you should see" line. `tip` is an optional "if it didn't work" line. The checkpoint is one of:
- `{kind: "text", prompt, placeholder?, minLength?}`: student types an answer (placeholder and minimum characters optional)
- `{kind: "choice", prompt, options[], correct, why}`: quick check; the right answer unlocks the step
- `{kind: "upload", prompt}`: screenshot or link
- `{kind: "confirm", prompt}`: a specific observation to tick

**Exam block.** `{objectives, cards, practice, notTested?}`
- `objectives`: official AIF-C01 IDs the day covers (`"1.1.5"`). Must exist in `src/content/objectives.json`. Use `[]` for a day the exam doesn't test.
- `cards`: at least 6 for a tested day. `{id, obj, q, a, term}`. The front (`q`) is one question ending in "?". The answer is plain words, 320 characters max, one idea per card. `obj` must be in `objectives`.
- `practice`: at least 6 for a tested day (the build standard is 8 or more). `{id, obj, q, a[4], c, why, wrong[4]}`. Exactly four options, like the real exam. `wrong` has one line per option explaining why it's wrong, with `""` in the slot of the correct answer.
- `notTested`: `{term, why}` for anything taught that the exam won't ask about (AGI and ASI, AUC).
- Card and practice IDs (`c01`, `p01`) must be unique within the session.

**Rubric.** `{items, allMet}`
- 3 to 6 items whose points add to exactly 100.
- Each item: `{id, label, points, good[], fix[], quoteStep?}`. Write two `good` lines and two `fix` lines in your voice.
- `{name}` drops in the student's first name, once, mid or end of sentence.
- `{quote}` drops in the student's own checkpoint answer. It needs `quoteStep`, the 0-based index of a `text` checkpoint step.
- `allMet` is the line used when every item is ticked.
- Feedback rules: specific, no openers or closers, no em dashes.

**Verification stamp.** `{date, checks[], note, sources[]}`
- `date` is YYYY-MM-DD and can't be in the future.
- `checks` has at least 3 entries covering tools and free tiers, links, facts and dates, every answer, and the guide match.
- `note` says what changed since the last build, or "nothing changed".
- `sources` lists the URLs used.

**Changing a session after import.** Edit the student guide first, rebuild the JSON from it, and re-import. The diff lists what changed (steps, quiz, Exam Lens, tools, rubric, exam block, stamp) before you confirm.

## Exam study guide

Built around the official AIF-C01 objective list in `src/content/objectives.json` (69 objectives, exam guide v1.1, April 30, 2026). Each session's JSON carries an `exam` block: `objectives` (official IDs like `1.1.2`), `cards` (one question per card, answer in plain words), `practice` (exam-style scenarios with four options and a reason each wrong option is wrong), and optional `notTested`. The validator rejects unknown objective IDs, card fronts that aren't questions, and questions without exactly four options.

Students see three views. **Exam map**: every domain, task statement, and objective, marked Covered (links to the session), Coming (week number), or taught but not tested. **Flashcards**: spaced review; fuzzy cards return in 2 days, correct ones in 7, 21, then 45. **Mock exam**: timed at the real pace (83 seconds per question), no feedback until the end, an estimated scaled score against 700, and a per-objective miss list. Attempts are saved in `mock_attempts` (instructors can read all).

If the official guide changes, update `objectives.json` and the `first` session for any new objective; nothing else needs to change.

## Office hours

Students book a recurring slot or propose a custom time, with a topic. The instructor works from **Calendar → Office hours** (the Calendar badge shows how many are waiting) or the dashboard card: **Accept**, **Decline** with a note, or **Propose new time**, which sends the student a counter-offer they accept or decline from their own Calendar. Every decision also posts a message in the student's thread. The Instructor / Student view toggle applies here too, so switching to Student view shows the booking form.

## Exam readiness (instructor)

**Class → Exam readiness** reads every student's saved mock attempts. Each student gets a status from their latest mock (Ready at 750 and up, Close at 700 to 749, Not yet under 700, or No mock), their best score, trend, accuracy by domain, and their three weakest objectives. Above that, "What the class misses most" lists the objectives with the highest miss rate and links to the session to reteach. Scores are the portal's straight-line estimate, so watch the trend more than the number.

## Showcase (class feed)

Run `supabase-run-once/schema-oct12-showcase.sql` once before deploying this version.

Students post a **Project, Article, Idea, Video, Resource, or Question**, or share one of their lab submissions. Every post needs a title. It can also have text, a link, and up to 4 images; images are compressed and stored in a private `showcase` bucket that only signed-in class members can see. YouTube, Vimeo, and Loom links play right in the post. Other links show as a link card. Articles and videos require a link.

Everyone can react (👍 Like, 💡 Learned something, 🔥 Impressive, 🤔 Question, 👏 Applause) and comment. Classmates show as first name and last initial; you show by full name with an Instructor tag. Posts go live instantly.

**Your controls** (Showcase page or Class → Showcase):
- Per post: Pin to the top, Feature, Hide, Lock comments, Delete, Mute the author.
- Per comment: Hide or Delete.
- Class-wide, under **Instructor controls → Manage**: pause posting for students, turn comments off, and mute or unmute specific students. Muted students can still read and react.

The database enforces all of this, not just the screen: a student can't post while posting is paused or they're muted, can't comment on a locked or hidden post, and can't pin, feature, or hide their own posts.

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
2. **Edge Function.** In Supabase, Edge Functions → Deploy a new function → Via Editor. Name it exactly `notify`. Replace the code with `supabase/functions/notify/index.ts`. Deploy. Then open the function's **Details** and turn **Verify JWT** off; the function checks the sign-in itself.
3. **Secrets.** Edge Functions → Secrets. Add `PORTAL_URL` (your Netlify address), `MAIL_PROVIDER` = `gas`, `GAS_URL` (from step 1), `GAS_SECRET` (the same string as step 1).
4. **Turn on and test.** In the portal, **Messages → Email → Turn on**, then **Send me a test email**. The Recent sends list shows each send and any error. If the test fails, the message says why (function not deployed, sign-in refused, a missing secret, or a secret that doesn't match Apps Script).

## Attendance

**Class → Attendance** defaults to today's session (from the calendar). Mark present, late, or absent per student, or "Mark rest present" after marking the exceptions. Two or more absences add a flag on the dashboard.

## Class recordings

Run `supabase-run-once/schema-oct14-quiz-recordings.sql` once before deploying this version.

After class, open the session on the **Sessions** page and use the **Class recording** card: paste the Zoom share link (in Zoom: Recordings, open the cloud recording, Share, copy link), add the passcode if it has one, and click **Post recording**. The class date fills in from the calendar. Zoom keeps hosting the video; the portal stores only the link and passcode, so it uses none of your 1 GB storage.

Students see a **Watch the class recording** button at the top of the session, with the passcode and a Copy button, plus a "🎥 Recording" tag on the course page. The database only shows a recording to students the session is unlocked for (whole class or early access). If the Zoom link expires or you re-share it, remove the old one and post the new link.

## Dashboard: class progress

The Dashboard's lower half has two parts.

**Sessions: what to reteach.** One row per open session: how many students finished the lab, the class's average best quiz score, the hardest question (lowest percent right), and how many submissions wait for a grade. Click a row to see all five questions with the percent who got each right, the wrong option picked most often, and the names of everyone who missed it. Click a name to open that student's work. Question stats use each student's first try, so retakes don't hide what was confusing. Quizzes taken before October 14 have no per-question record and are counted only in the averages.

**Students.** "Needs attention" lists flagged students at the top. Below, a heatmap has one row per student and one cell per open session. Cell color comes from labs and quizzes only (lab 60%, best quiz 40%; lab alone until the quiz is taken): green 80 and up, amber 50 to 79, red under 50. Grading never affects the color. A dot means a submission is waiting for a grade, ✓ means graded. Click any cell to review and grade. Search, sort (needs attention first, or by name), and Export CSV sit above the heatmap.

## How grading and insights work

- **Session state** per student: Locked → Not started → In progress → Complete (all steps and quiz) → Submitted → Graded.
- **Composite score**: labs 40%, quiz best scores 30%, graded work 30%. Missing parts are re-weighted so an ungraded student isn't penalised.
- **Flags** ("may be struggling"): labs under 50% done, quiz average under 60%, graded average under 70, or no activity for 7 or more days. Thresholds live in `src/lib/logic.ts`.
- **CSV export** (Dashboard, above the heatmap) respects the search box and includes flags plus per-session lab %, quiz best, submission count, score, and feedback, ready for the master Google Sheet.

## Storage notes

Screenshots are compressed in the browser to 1400 px wide JPEG at 72% before upload (about 150 to 300 KB each). Twenty students over 60 sessions fits well within 1 GB. Files live in the private `submissions` bucket under `<student id>/<session id>/`; students see only their own, instructors see all.
