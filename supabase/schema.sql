-- ============================================================
-- MEMORA — Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- SPACES
-- ────────────────────────────────────────────────────────────
create table spaces (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  type text check (type in ('personal','work','custom')) default 'custom',
  color text default '#3B82F6',
  created_at timestamptz default now()
);

-- ────────────────────────────────────────────────────────────
-- PEOPLE
-- ────────────────────────────────────────────────────────────
create table people (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  space_id uuid references spaces(id) on delete set null,
  name text not null,
  role text check (role in ('client','team','personal','other')) default 'other',
  avatar_url text,
  last_interaction timestamptz,
  created_at timestamptz default now()
);

-- ────────────────────────────────────────────────────────────
-- PROJECTS
-- ────────────────────────────────────────────────────────────
create table projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  space_id uuid references spaces(id) on delete set null,
  name text not null,
  description text,
  status text check (status in ('active','paused','completed')) default 'active',
  created_at timestamptz default now()
);

-- ────────────────────────────────────────────────────────────
-- TASKS
-- ────────────────────────────────────────────────────────────
create table tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  space_id uuid references spaces(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  person_id uuid references people(id) on delete set null,
  title text not null,
  notes text,
  due_at timestamptz,
  reminder_at timestamptz,
  priority text check (priority in ('low','med','high')) default 'med',
  progress integer default 0 check (progress >= 0 and progress <= 100),
  status text check (status in ('todo','in_progress','done')) default 'todo',
  source text check (source in ('manual','ai_capture','voice','screenshot')) default 'manual',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ────────────────────────────────────────────────────────────
-- IDEAS
-- ────────────────────────────────────────────────────────────
create table ideas (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  space_id uuid references spaces(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  title text not null,
  body text,
  tags text[] default '{}',
  status text check (status in ('raw','developing','archived')) default 'raw',
  source text check (source in ('capture','screenshot','voice','manual')) default 'capture',
  created_at timestamptz default now()
);

-- ────────────────────────────────────────────────────────────
-- VAULT (files, screenshots, documents, receipts)
-- ────────────────────────────────────────────────────────────
create table vault_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  space_id uuid references spaces(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  idea_id uuid references ideas(id) on delete set null,
  type text check (type in ('screenshot','document','receipt','image','note')) not null,
  title text,
  file_url text,
  ocr_text text,
  tags text[] default '{}',
  created_at timestamptz default now()
);

-- ────────────────────────────────────────────────────────────
-- EXPENSES
-- ────────────────────────────────────────────────────────────
create table expenses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  space_id uuid references spaces(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  vault_item_id uuid references vault_items(id) on delete set null,
  vendor text,
  amount numeric(10,2) not null,
  currency text default 'INR',
  category text,
  date date default current_date,
  notes text,
  created_at timestamptz default now()
);

-- ────────────────────────────────────────────────────────────
-- CAPTURES (raw AI-parsed inputs, before classification)
-- ────────────────────────────────────────────────────────────
create table captures (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  raw_input text not null,
  input_type text check (input_type in ('text','voice','image','file')) default 'text',
  ai_result jsonb,
  classified_as text check (classified_as in ('task','idea','expense','note','person','unknown')),
  linked_id uuid,
  linked_table text,
  created_at timestamptz default now()
);

-- ────────────────────────────────────────────────────────────
-- JOURNAL
-- ────────────────────────────────────────────────────────────
create table journal_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  date date not null default current_date,
  auto_summary jsonb,
  personal_note text,
  created_at timestamptz default now(),
  unique(user_id, date)
);

-- ────────────────────────────────────────────────────────────
-- NUDGES (AI suggestions)
-- ────────────────────────────────────────────────────────────
create table nudges (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  type text check (type in ('followup','stuck_task','expense_alert','idea_prompt','general')),
  message text not null,
  entity_type text,
  entity_id uuid,
  dismissed boolean default false,
  created_at timestamptz default now()
);

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY — all tables
-- ────────────────────────────────────────────────────────────
alter table spaces enable row level security;
alter table people enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table ideas enable row level security;
alter table vault_items enable row level security;
alter table expenses enable row level security;
alter table captures enable row level security;
alter table journal_entries enable row level security;
alter table nudges enable row level security;

-- Policy: users can only see their own data
create policy "own data" on spaces for all using (auth.uid() = user_id);
create policy "own data" on people for all using (auth.uid() = user_id);
create policy "own data" on projects for all using (auth.uid() = user_id);
create policy "own data" on tasks for all using (auth.uid() = user_id);
create policy "own data" on ideas for all using (auth.uid() = user_id);
create policy "own data" on vault_items for all using (auth.uid() = user_id);
create policy "own data" on expenses for all using (auth.uid() = user_id);
create policy "own data" on captures for all using (auth.uid() = user_id);
create policy "own data" on journal_entries for all using (auth.uid() = user_id);
create policy "own data" on nudges for all using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- SEED: Default spaces for new user
-- (Call this after user signs up via Edge Function or trigger)
-- ────────────────────────────────────────────────────────────
-- insert into spaces (user_id, name, type) values
--   (auth.uid(), 'Personal', 'personal'),
--   (auth.uid(), 'Work', 'work');
