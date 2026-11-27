create table public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references public.student_profiles(user_id) on delete cascade,
  requested_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null,
  outcome text check (outcome in ('reset', 'dismissed')),
  busy_until timestamptz,
  check ((handled_at is null) = (outcome is null))
);

create unique index password_reset_one_pending_per_student
  on public.password_reset_requests (student_user_id) where handled_at is null;
create index password_reset_pending_order
  on public.password_reset_requests (requested_at, id) where handled_at is null;

alter table public.password_reset_requests enable row level security;
revoke all on public.password_reset_requests from public, anon, authenticated;
grant select, insert, update on public.password_reset_requests to service_role;
