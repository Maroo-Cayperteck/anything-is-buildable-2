-- Open access to planning, with private academic records still isolated by ownership.
create table public.personal_plans (
 student_user_id uuid not null references public.student_profiles(user_id) on delete cascade,
 semester_id uuid not null references public.semesters(id), level_id uuid not null references public.academic_levels(id),
 items jsonb not null default '[]' check(jsonb_typeof(items)='array'),
 updated_at timestamptz not null default now(), primary key(student_user_id,semester_id)
);
create table public.planning_roster (
 student_code text not null check(student_code ~ '^9252500[0-9]{2}$'),
 semester_id uuid not null references public.semesters(id), level_id uuid not null references public.academic_levels(id),
 group_number int check(group_number between 1 and 20), section_number int check(section_number between 1 and 30), lab_number int check(lab_number between 1 and 30),
 updated_at timestamptz not null default now(), primary key(student_code,semester_id)
);
create table public.schedule_exceptions (
 id uuid primary key default gen_random_uuid(), slot_id uuid not null references public.schedule_slots(id) on delete cascade,
 occurrence_date date not null, cancelled boolean not null default false,
 replacement_date date, start_time time, end_time time, location text,
 note text not null default '' check(length(note)<=500), updated_at timestamptz not null default now(),
 unique(slot_id,occurrence_date), check(cancelled or (replacement_date is not null and start_time is not null and end_time > start_time and location is not null))
);
create table public.personal_events (
 id uuid primary key default gen_random_uuid(), student_user_id uuid not null references public.student_profiles(user_id) on delete cascade,
 title text not null check(length(title) between 1 and 120), event_date date not null,
 start_time time not null, end_time time not null check(end_time>start_time), note text not null default '' check(length(note)<=500)
);
create table public.schedule_history (
 id uuid primary key default gen_random_uuid(), slot_id uuid not null references public.schedule_slots(id), actor_id uuid references auth.users(id),
 before_data jsonb not null, after_data jsonb not null, created_at timestamptz not null default now(), undone_at timestamptz
);
alter table public.schedule_slots add column version int not null default 1;
alter table public.schedule_slots add column is_deleted boolean not null default false;
alter table public.personal_plans enable row level security;
alter table public.planning_roster enable row level security;
alter table public.schedule_exceptions enable row level security;
alter table public.personal_events enable row level security;
alter table public.schedule_history enable row level security;
grant select on public.personal_plans,public.planning_roster,public.schedule_exceptions,public.personal_events,public.schedule_history to authenticated;
revoke all on public.personal_plans,public.planning_roster,public.schedule_exceptions,public.personal_events,public.schedule_history from anon;
grant all on public.personal_plans,public.planning_roster,public.schedule_exceptions,public.personal_events,public.schedule_history to service_role;
create policy own_plan on public.personal_plans for select to authenticated using ((student_user_id=auth.uid() and is_active_student()) or has_role(auth.uid(),'admin'));
create policy admin_roster on public.planning_roster for select to authenticated using (has_role(auth.uid(),'admin'));
create policy shared_exceptions on public.schedule_exceptions for select to authenticated using (is_active_student() or has_role(auth.uid(),'admin'));
create policy own_events on public.personal_events for select to authenticated using ((student_user_id=auth.uid() and is_active_student()) or has_role(auth.uid(),'admin'));
create policy admin_history on public.schedule_history for select to authenticated using (has_role(auth.uid(),'admin'));
drop policy schedule_slots_read on public.schedule_slots;
create policy schedule_slots_read on public.schedule_slots for select to authenticated using (is_active_student() or has_role(auth.uid(),'admin'));

create function public.create_open_student(p_user uuid,p_code text,p_name text,p_level int,p_term int)
returns void language plpgsql security invoker set search_path=public as $$
declare v_level academic_levels; v_sem semesters; v_email text;
begin
 if p_code !~ '^9252500[0-9]{2}$' or p_level not between 0 and 3 or p_term not between 1 and 2 then raise exception 'Invalid registration'; end if;
 select email into strict v_email from auth.users where id=p_user;
 if v_email<>('student'||p_code||'@hnu-portal.example.com') then raise exception 'Identity mismatch'; end if;
 if exists(select 1 from user_roles where user_id=p_user and role='admin') then raise exception 'Invalid account'; end if;
 select l.* into strict v_level from academic_levels l join academic_programs p on p.id=l.program_id where p.code='NCSE' and l.level_number=p_level;
 select s.* into strict v_sem from semesters s join academic_years y on y.id=s.academic_year_id where y.is_current and s.season=(case when p_term=1 then 'FALL' else 'SPRING' end) limit 1;
 insert into student_profiles(user_id,username,full_name_ar,student_code,email,program_id,level_id,academic_year_id,account_status,academic_status)
 values(p_user,p_code,p_name,p_code,v_email,v_level.program_id,v_level.id,v_sem.academic_year_id,'active','في الانتظار');
 insert into user_roles(user_id,role) values(p_user,'student') on conflict do nothing;
 insert into registration_requests(auth_user_id,student_code,email,full_name_ar,status,requested_level,requested_term,roster_verified)
 values(p_user,p_code,v_email,p_name,'active',p_level,p_term,false);
end $$;
revoke all on function public.create_open_student(uuid,text,text,int,int) from public,anon,authenticated;
grant execute on function public.create_open_student(uuid,text,text,int,int) to service_role;

create function public.change_schedule_slot(p_actor uuid,p_id uuid,p_expected int,p_values jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare old_row schedule_slots; new_row schedule_slots;
begin
 if not has_role(p_actor,'admin') then raise exception 'Forbidden'; end if;
 select * into strict old_row from schedule_slots where id=p_id for update;
 if old_row.version<>p_expected then raise exception 'الموعد تغير؛ أعد تحميل الصفحة'; end if;
 new_row=jsonb_populate_record(old_row,p_values);
 update schedule_slots set day_of_week=new_row.day_of_week,start_time=new_row.start_time,end_time=new_row.end_time,
 location=new_row.location,instructor=new_row.instructor,kind=new_row.kind,group_number=new_row.group_number,
 section_number=new_row.section_number,lab_number=new_row.lab_number,is_deleted=new_row.is_deleted,version=old_row.version+1
 where id=p_id returning * into new_row;
 insert into schedule_history(slot_id,actor_id,before_data,after_data) values(p_id,p_actor,to_jsonb(old_row),to_jsonb(new_row));
end $$;
create function public.undo_schedule_slot(p_actor uuid,p_history uuid)
returns void language plpgsql security invoker set search_path=public as $$
declare h schedule_history; v int;
begin
 if not has_role(p_actor,'admin') then raise exception 'Forbidden'; end if;
 select * into strict h from schedule_history where id=p_history for update;
 if h.undone_at is not null then raise exception 'تم التراجع بالفعل'; end if;
 select version into v from schedule_slots where id=h.slot_id for update;
 if v<>(h.after_data->>'version')::int then raise exception 'يوجد تعديل أحدث؛ لا يمكن استبداله'; end if;
 perform change_schedule_slot(p_actor,h.slot_id,v,h.before_data);
 update schedule_history set undone_at=now() where id=p_history;
end $$;
revoke all on function public.change_schedule_slot(uuid,uuid,int,jsonb),public.undo_schedule_slot(uuid,uuid) from public,anon,authenticated;
grant execute on function public.change_schedule_slot(uuid,uuid,int,jsonb),public.undo_schedule_slot(uuid,uuid) to service_role;
