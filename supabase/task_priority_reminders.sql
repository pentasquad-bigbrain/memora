alter table public.tasks
  add column if not exists reminder_at timestamptz,
  add column if not exists priority text;

update public.tasks
set priority = 'med'
where priority is null or priority not in ('low', 'med', 'high');

alter table public.tasks
  alter column priority set default 'med';

alter table public.tasks
  drop constraint if exists tasks_priority_check;

alter table public.tasks
  add constraint tasks_priority_check
  check (priority in ('low', 'med', 'high'));
