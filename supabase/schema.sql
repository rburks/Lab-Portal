-- Software/AI Lab Portal schema. Run once in the Supabase SQL editor.

-- Profiles: one row per auth user. Role is set by the instructor (default student).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'student' check (role in ('student','instructor')),
  created_at timestamptz not null default now()
);

-- Allowlist: emails the instructor has invited. Sign-in works for anyone in this list.
create table if not exists public.roster (
  email text primary key,
  full_name text,
  role text not null default 'student' check (role in ('student','instructor')),
  added_at timestamptz not null default now()
);

-- Releases: which sessions are unlocked. student_id null = unlocked for everyone.
create table if not exists public.releases (
  id bigserial primary key,
  session_id text not null,
  student_id uuid references public.profiles(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  unique (session_id, student_id)
);

-- Progress: one row per student per session.
create table if not exists public.progress (
  student_id uuid not null references public.profiles(id) on delete cascade,
  session_id text not null,
  steps jsonb not null default '[]',
  goal text,
  quiz_best int,
  quiz_last int,
  quiz_attempts int not null default 0,
  sandbox jsonb,
  responses jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (student_id, session_id)
);

-- Submissions: text, link, or an image stored in the 'submissions' bucket.
create table if not exists public.submissions (
  id bigserial primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  session_id text not null,
  kind text not null check (kind in ('image','link','text')),
  body text,            -- link URL or text body
  file_path text,       -- storage path for images
  created_at timestamptz not null default now()
);

-- Grades: instructor score and feedback per student per session.
create table if not exists public.grades (
  student_id uuid not null references public.profiles(id) on delete cascade,
  session_id text not null,
  score int check (score between 0 and 100),
  feedback text,
  graded_by uuid references public.profiles(id),
  graded_at timestamptz not null default now(),
  primary key (student_id, session_id)
);

-- Create a profile automatically when an allowlisted user signs in the first time.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare r public.roster%rowtype;
begin
  select * into r from public.roster where lower(email) = lower(new.email);
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(r.full_name, split_part(new.email,'@',1)), coalesce(r.role,'student'))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Helpers
create or replace function public.is_instructor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'instructor');
$$;

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.roster enable row level security;
alter table public.releases enable row level security;
alter table public.progress enable row level security;
alter table public.submissions enable row level security;
alter table public.grades enable row level security;

-- profiles: everyone signed in reads all (names for the class), only self or instructor writes
create policy "profiles read" on public.profiles for select to authenticated using (true);
create policy "profiles self update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
create policy "profiles instructor all" on public.profiles for all to authenticated using (public.is_instructor()) with check (public.is_instructor());

-- roster: instructor only
create policy "roster instructor" on public.roster for all to authenticated using (public.is_instructor()) with check (public.is_instructor());

-- releases: students read their own and global, instructor writes
create policy "releases read" on public.releases for select to authenticated using (student_id is null or student_id = auth.uid() or public.is_instructor());
create policy "releases instructor" on public.releases for all to authenticated using (public.is_instructor()) with check (public.is_instructor());

-- progress: own rows, instructor reads all
create policy "progress own" on public.progress for all to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "progress instructor read" on public.progress for select to authenticated using (public.is_instructor());

-- submissions: own rows, instructor reads all
create policy "submissions own" on public.submissions for all to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "submissions instructor read" on public.submissions for select to authenticated using (public.is_instructor());

-- grades: students read own, instructor writes
create policy "grades own read" on public.grades for select to authenticated using (student_id = auth.uid());
create policy "grades instructor" on public.grades for all to authenticated using (public.is_instructor()) with check (public.is_instructor());

-- Storage bucket for screenshots (private). Paths are <student_id>/<session_id>/<file>.
insert into storage.buckets (id, name, public) values ('submissions','submissions', false) on conflict (id) do nothing;
create policy "sub upload own" on storage.objects for insert to authenticated with check (bucket_id = 'submissions' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "sub read own or instructor" on storage.objects for select to authenticated using (bucket_id = 'submissions' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_instructor()));
create policy "sub delete own" on storage.objects for delete to authenticated using (bucket_id = 'submissions' and (storage.foldername(name))[1] = auth.uid()::text);

-- Block sign-in for emails not on the roster (hook: run in Auth > Hooks as a "before user created" hook,
-- or simply rely on the roster check in the app). Optional hardening:
create or replace function public.email_allowed(e text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.roster where lower(email) = lower(e));
$$;
grant execute on function public.email_allowed(text) to anon, authenticated;

-- First instructor: after you sign in once, run
-- update public.profiles set role = 'instructor' where email = 'you@example.com';

-- ===================== Added October 6: calendar, office hours, messages, announcements, study guide =====================

-- Course settings (single row): start date and class weekdays (0=Sun..6=Sat).
create table if not exists public.course_settings (
  id int primary key default 1 check (id = 1),
  start_date date not null default '2026-10-12',
  class_days int[] not null default '{1,2,4}',
  updated_at timestamptz not null default now()
);
insert into public.course_settings (id) values (1) on conflict do nothing;

-- Calendar exceptions: a holiday or buffer on a class date pushes every later session back one class day.
create table if not exists public.calendar_days (
  day date primary key,
  kind text not null check (kind in ('holiday','buffer')),
  label text,
  created_at timestamptz not null default now()
);

-- Office hours: recurring slots the instructor offers.
create table if not exists public.office_hour_slots (
  id bigserial primary key,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  minutes int not null default 15,
  capacity int not null default 1,
  location text,              -- Zoom link or room
  active boolean not null default true
);

-- Bookings: a slot booking (slot_id set, for a specific date) or a custom request (slot_id null, requested_at set).
create table if not exists public.office_hour_requests (
  id bigserial primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  slot_id bigint references public.office_hour_slots(id) on delete set null,
  requested_at timestamptz not null,
  topic text not null,
  status text not null default 'pending' check (status in ('pending','accepted','declined','done','cancelled')),
  instructor_note text,
  created_at timestamptz not null default now()
);

-- Direct messages: one thread per student (thread = student_id).
create table if not exists public.messages (
  id bigserial primary key,
  thread_student_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists messages_thread_idx on public.messages (thread_student_id, created_at);

-- Announcements: class-wide posts from the instructor.
create table if not exists public.announcements (
  id bigserial primary key,
  title text not null,
  body text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

-- Study guide: per-student flashcard state. term_key = "<session_id>|<term>".
create table if not exists public.flashcards (
  student_id uuid not null references public.profiles(id) on delete cascade,
  term_key text not null,
  status text not null check (status in ('known','review')),
  updated_at timestamptz not null default now(),
  primary key (student_id, term_key)
);

alter table public.course_settings enable row level security;
alter table public.calendar_days enable row level security;
alter table public.office_hour_slots enable row level security;
alter table public.office_hour_requests enable row level security;
alter table public.messages enable row level security;
alter table public.announcements enable row level security;
alter table public.flashcards enable row level security;

create policy "settings read" on public.course_settings for select to authenticated using (true);
create policy "settings instructor" on public.course_settings for all to authenticated using (public.is_instructor()) with check (public.is_instructor());
create policy "calendar read" on public.calendar_days for select to authenticated using (true);
create policy "calendar instructor" on public.calendar_days for all to authenticated using (public.is_instructor()) with check (public.is_instructor());
create policy "slots read" on public.office_hour_slots for select to authenticated using (true);
create policy "slots instructor" on public.office_hour_slots for all to authenticated using (public.is_instructor()) with check (public.is_instructor());
create policy "oh own" on public.office_hour_requests for all to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "oh instructor" on public.office_hour_requests for all to authenticated using (public.is_instructor()) with check (public.is_instructor());
create policy "msg own thread" on public.messages for select to authenticated using (thread_student_id = auth.uid() or public.is_instructor());
create policy "msg send" on public.messages for insert to authenticated with check (sender_id = auth.uid() and (thread_student_id = auth.uid() or public.is_instructor()));
create policy "msg mark read" on public.messages for update to authenticated using (thread_student_id = auth.uid() or public.is_instructor());
create policy "ann read" on public.announcements for select to authenticated using (true);
create policy "ann instructor" on public.announcements for all to authenticated using (public.is_instructor()) with check (public.is_instructor());
create policy "flashcards own" on public.flashcards for all to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "flashcards instructor read" on public.flashcards for select to authenticated using (public.is_instructor());

-- Added October 6 (guided labs): per-step checkpoint answers. Safe to re-run.
alter table public.progress add column if not exists responses jsonb not null default '{}';

-- ===================== Added October 6 (content in DB, materials, verification, attendance) =====================

-- Session content lives here, not in code. One row per session id (w01d1 ...). content is the session JSON.
create table if not exists public.session_content (
  session_id text primary key,
  content jsonb not null,
  version_note text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  verified_at timestamptz,
  verified_by uuid references public.profiles(id),
  verification jsonb            -- { checks: {tools:true, links:true, facts:true, quiz:true, guide:true}, note: "" }
);

-- Materials per session: uploaded files (student guide) or links (slides, lab deck).
create table if not exists public.session_materials (
  id bigserial primary key,
  session_id text not null,
  kind text not null check (kind in ('student_guide','slides','lab_deck','other')),
  title text not null,
  file_path text,
  url text,
  created_at timestamptz not null default now()
);

-- Attendance per student per session.
create table if not exists public.attendance (
  student_id uuid not null references public.profiles(id) on delete cascade,
  session_id text not null,
  status text not null check (status in ('present','late','absent')),
  marked_at timestamptz not null default now(),
  primary key (student_id, session_id)
);

alter table public.session_content enable row level security;
alter table public.session_materials enable row level security;
alter table public.attendance enable row level security;
create policy "content read" on public.session_content for select to authenticated using (true);
create policy "content instructor" on public.session_content for all to authenticated using (public.is_instructor()) with check (public.is_instructor());
create policy "materials read" on public.session_materials for select to authenticated using (true);
create policy "materials instructor" on public.session_materials for all to authenticated using (public.is_instructor()) with check (public.is_instructor());
create policy "attendance own read" on public.attendance for select to authenticated using (student_id = auth.uid());
create policy "attendance instructor" on public.attendance for all to authenticated using (public.is_instructor()) with check (public.is_instructor());

-- Public-read bucket for materials (student guides). Only instructors write.
insert into storage.buckets (id, name, public) values ('materials','materials', true) on conflict (id) do nothing;
create policy "materials upload instructor" on storage.objects for insert to authenticated with check (bucket_id = 'materials' and public.is_instructor());
create policy "materials delete instructor" on storage.objects for delete to authenticated using (bucket_id = 'materials' and public.is_instructor());
create policy "materials read all" on storage.objects for select to authenticated using (bucket_id = 'materials');

-- ===================== Added October 6 (exam study guide: spaced flashcards, timed mocks)
-- Flashcards gain a review schedule. status stays for backwards compatibility; due and streak drive spacing.
alter table public.flashcards add column if not exists due timestamptz not null default now();
alter table public.flashcards add column if not exists streak int not null default 0;
alter table public.flashcards add column if not exists obj text;

-- One row per finished mock. answers: [{id, obj, correct}] so weak objectives can be computed later.
create table if not exists public.mock_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null,                 -- 'all' or a domain number as text
  total int not null,
  correct int not null,
  scaled int not null,                 -- estimated 100 to 1000
  seconds int not null,
  answers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.mock_attempts enable row level security;
create policy "mock own" on public.mock_attempts for all to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "mock instructor read" on public.mock_attempts for select to authenticated using (public.is_instructor());

-- ===================== Added October 7 (office hours: instructor can propose a new time)
alter table public.office_hour_requests drop constraint if exists office_hour_requests_status_check;
alter table public.office_hour_requests add constraint office_hour_requests_status_check check (status in ('pending','accepted','declined','done','cancelled','proposed'));
alter table public.office_hour_requests add column if not exists proposed_at timestamptz;

-- ===================== Added October 7, batch 2 (readiness, showcase, rubrics, capstone, portfolio, email)
-- Rubric items the instructor ticked when grading.
alter table public.grades add column if not exists rubric jsonb;

-- Lab showcase: a student shares one of their own submissions with the class. Instructor can hide or feature.
create table if not exists public.showcase (
  id bigserial primary key,
  submission_id bigint not null unique references public.submissions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  session_id text not null,
  caption text,
  hidden boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.showcase enable row level security;
drop policy if exists "showcase read" on public.showcase;
drop policy if exists "showcase own insert" on public.showcase;
drop policy if exists "showcase own delete" on public.showcase;
drop policy if exists "showcase instructor" on public.showcase;
create policy "showcase read" on public.showcase for select to authenticated using (hidden = false or student_id = auth.uid() or public.is_instructor());
create policy "showcase own insert" on public.showcase for insert to authenticated with check (student_id = auth.uid() and hidden = false and featured = false);
create policy "showcase own delete" on public.showcase for delete to authenticated using (student_id = auth.uid());
create policy "showcase instructor" on public.showcase for all to authenticated using (public.is_instructor()) with check (public.is_instructor());
-- Classmates can read a submission (and its screenshot) only while it's shared and not hidden.
create or replace function public.is_shared_submission(sub_id bigint) returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.showcase where submission_id = sub_id and hidden = false)
$$;
create or replace function public.is_shared_file(path text) returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.showcase sh join public.submissions s on s.id = sh.submission_id where s.file_path = path and sh.hidden = false)
$$;
drop policy if exists "submissions shared read" on public.submissions;
create policy "submissions shared read" on public.submissions for select to authenticated using (public.is_shared_submission(id));
drop policy if exists "sub read shared" on storage.objects;
create policy "sub read shared" on storage.objects for select to authenticated using (bucket_id = 'submissions' and public.is_shared_file(name));

-- Capstone: one record per student, plus one row per milestone.
create table if not exists public.capstones (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  title text, stakeholder text, problem text,
  updated_at timestamptz not null default now()
);
create table if not exists public.capstone_milestones (
  student_id uuid not null references public.profiles(id) on delete cascade,
  milestone text not null,
  status text not null default 'not_started' check (status in ('not_started','submitted','revise','approved')),
  link text, note text, instructor_note text,
  updated_at timestamptz not null default now(),
  primary key (student_id, milestone)
);
alter table public.capstones enable row level security;
alter table public.capstone_milestones enable row level security;
drop policy if exists "capstone own" on public.capstones;
drop policy if exists "capstone instructor" on public.capstones;
drop policy if exists "milestone own read" on public.capstone_milestones;
drop policy if exists "milestone own write" on public.capstone_milestones;
drop policy if exists "milestone own update" on public.capstone_milestones;
drop policy if exists "milestone instructor" on public.capstone_milestones;
create policy "capstone own" on public.capstones for all to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "capstone instructor" on public.capstones for all to authenticated using (public.is_instructor()) with check (public.is_instructor());
create policy "milestone own read" on public.capstone_milestones for select to authenticated using (student_id = auth.uid());
-- Students can only ever set their own milestone to submitted; approving is the instructor's call.
create policy "milestone own write" on public.capstone_milestones for insert to authenticated with check (student_id = auth.uid() and status = 'submitted');
create policy "milestone own update" on public.capstone_milestones for update to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid() and status = 'submitted');
create policy "milestone instructor" on public.capstone_milestones for all to authenticated using (public.is_instructor()) with check (public.is_instructor());

-- Portfolio: readable by anyone on the internet once published.
create table if not exists public.portfolios (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$'),
  published boolean not null default false,
  display_name text, headline text, bio text, location text,
  linkedin text, credly text, email_public text,
  capstone jsonb,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.portfolios enable row level security;
drop policy if exists "portfolio public read" on public.portfolios;
drop policy if exists "portfolio own" on public.portfolios;
drop policy if exists "portfolio instructor read" on public.portfolios;
create policy "portfolio public read" on public.portfolios for select to anon, authenticated using (published = true);
create policy "portfolio own" on public.portfolios for all to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "portfolio instructor read" on public.portfolios for select to authenticated using (public.is_instructor());
insert into storage.buckets (id, name, public) values ('portfolio', 'portfolio', true) on conflict (id) do nothing;
drop policy if exists "portfolio upload own" on storage.objects;
drop policy if exists "portfolio delete own" on storage.objects;
create policy "portfolio upload own" on storage.objects for insert to authenticated with check (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "portfolio delete own" on storage.objects for delete to authenticated using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);

-- Email notifications: master switch, per-student opt-out, and a send log written by the notify Edge Function.
alter table public.course_settings add column if not exists email_on boolean not null default false;
create table if not exists public.notify_prefs (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  opt_out boolean not null default false
);
create table if not exists public.notify_log (
  id bigserial primary key,
  kind text not null,
  ref text,
  recipients int not null default 0,
  ok boolean not null,
  error text,
  created_at timestamptz not null default now()
);
alter table public.notify_prefs enable row level security;
alter table public.notify_log enable row level security;
drop policy if exists "prefs own" on public.notify_prefs;
drop policy if exists "prefs instructor read" on public.notify_prefs;
drop policy if exists "log instructor read" on public.notify_log;
create policy "prefs own" on public.notify_prefs for all to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "prefs instructor read" on public.notify_prefs for select to authenticated using (public.is_instructor());
create policy "log instructor read" on public.notify_log for select to authenticated using (public.is_instructor());
