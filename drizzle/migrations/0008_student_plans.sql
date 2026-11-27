-- Additive scheduling and code-only registration; existing history is retained.
alter table public.academic_levels drop constraint if exists academic_levels_level_number_check;
alter table public.academic_levels add constraint academic_levels_level_number_check check(level_number between 0 and 10);
alter table public.registration_requests add column requested_level int check(requested_level between 0 and 3), add column requested_term int check(requested_term between 1 and 2);
alter table public.enrollments add column group_number int check(group_number between 1 and 20), add column section_number int check(section_number between 1 and 30), add column lab_number int check(lab_number between 1 and 30);
create table public.schedule_slots (
 id uuid primary key default gen_random_uuid(), offering_id uuid not null references public.course_offerings(id) on delete cascade,
 kind public.slot_kind not null, day_of_week text not null check(day_of_week in ('Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday')),
 start_time time not null, end_time time not null check(end_time>start_time), location text not null, instructor text,
 group_number int check(group_number between 1 and 20), section_number int check(section_number between 1 and 30), lab_number int check(lab_number between 1 and 30),
 source text, created_at timestamptz not null default now()
);
create index schedule_slots_offering_idx on public.schedule_slots(offering_id);
create table public.schedule_overrides (
 id uuid primary key default gen_random_uuid(), student_user_id uuid not null references public.student_profiles(user_id) on delete cascade,
 slot_id uuid not null, scope text not null check(scope in ('personal','admin')),
 day_of_week text not null check(day_of_week in ('Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday')),
 start_time time not null, end_time time not null check(end_time>start_time), location text not null,
 updated_at timestamptz not null default now(), unique(student_user_id,slot_id,scope)
);
create table public.schedule_requests (
 id uuid primary key default gen_random_uuid(), student_user_id uuid not null references public.student_profiles(user_id) on delete cascade,
 message text not null check(length(message) between 5 and 2000), status text not null default 'pending' check(status in ('pending','resolved','rejected')),
 admin_reply text, created_at timestamptz not null default now(), reviewed_at timestamptz
);
create index schedule_requests_student_idx on public.schedule_requests(student_user_id,created_at desc);
alter table public.schedule_slots enable row level security;
alter table public.schedule_overrides enable row level security;
alter table public.schedule_requests enable row level security;
grant select on public.schedule_slots,public.schedule_overrides,public.schedule_requests to authenticated;
revoke all on public.schedule_slots,public.schedule_overrides,public.schedule_requests from anon;
grant all on public.schedule_slots,public.schedule_overrides,public.schedule_requests to service_role;
create policy schedule_slots_read on public.schedule_slots for select to authenticated using (exists(select 1 from public.user_roles where user_id=(select auth.uid()) and role='admin') or exists(select 1 from public.enrollments e join public.student_profiles p on p.user_id=e.student_user_id where e.student_user_id=(select auth.uid()) and e.offering_id=schedule_slots.offering_id and e.status='enrolled' and p.account_status='active'));
create policy schedule_overrides_read on public.schedule_overrides for select to authenticated using (student_user_id=(select auth.uid()) or exists(select 1 from public.user_roles where user_id=(select auth.uid()) and role='admin'));
create policy schedule_requests_read on public.schedule_requests for select to authenticated using (student_user_id=(select auth.uid()) or exists(select 1 from public.user_roles where user_id=(select auth.uid()) and role='admin'));

create or replace function public.apply_student_plan(p_actor uuid,p_student uuid,p_level uuid,p_semester uuid,p_courses uuid[],p_group int,p_section int,p_lab int)
returns void language plpgsql security invoker set search_path=public as $$
declare v_program uuid; v_year uuid; v_course uuid; v_off uuid; v_group uuid; v_enr uuid; v_offs uuid[]='{}';
begin
 if not exists(select 1 from user_roles where user_id=p_actor and role='admin') then raise exception 'Forbidden'; end if;
 perform 1 from student_profiles where user_id=p_student for update;
 if not found then raise exception 'Student not found'; end if;
 select program_id into strict v_program from academic_levels where id=p_level;
 select academic_year_id into strict v_year from semesters where id=p_semester and not is_closed;
 if cardinality(p_courses)<1 or cardinality(p_courses)>20 then raise exception 'Choose 1 to 20 courses'; end if;
 if p_group not between 1 and 20 or p_section not between 1 and 30 or p_lab not between 1 and 30 then raise exception 'Invalid group'; end if;
 update student_profiles set program_id=v_program,level_id=p_level,academic_year_id=v_year,
 academic_level=(select name_ar from academic_levels where id=p_level),academic_year=(select name from academic_years where id=v_year) where user_id=p_student;
 foreach v_course in array p_courses loop
  if not exists(select 1 from courses where id=v_course and is_active) then raise exception 'Invalid course'; end if;
  select id into v_off from course_offerings where course_id=v_course and semester_id=p_semester and program_id=v_program and level_id=p_level;
  if v_off is null then insert into course_offerings(course_id,semester_id,program_id,level_id) values(v_course,p_semester,v_program,p_level) returning id into v_off; end if;
  v_offs=array_append(v_offs,v_off);
  insert into academic_groups(offering_id,name) values(v_off,format('G%s / S%s / L%s',p_group,p_section,p_lab)) on conflict(offering_id,name) do update set name=excluded.name returning id into v_group;
  select id into v_enr from enrollments where student_user_id=p_student and offering_id=v_off and status in ('enrolled','completed');
  if v_enr is null then insert into enrollments(student_user_id,offering_id,group_id,group_number,section_number,lab_number) values(p_student,v_off,v_group,p_group,p_section,p_lab);
  elsif exists(select 1 from enrollments where id=v_enr and status='enrolled') then update enrollments set group_id=v_group,group_number=p_group,section_number=p_section,lab_number=p_lab where id=v_enr;
  end if;
 end loop;
 update enrollments set status='dropped' where student_user_id=p_student and status='enrolled' and offering_id in(select id from course_offerings where semester_id=p_semester) and not(offering_id=any(v_offs));
 insert into admin_activity_logs(actor_user_id,action,entity_type,entity_id,metadata) values(p_actor,'apply_student_plan','student_profiles',p_student::text,jsonb_build_object('courses',p_courses,'group',p_group,'section',p_section,'lab',p_lab,'semester',p_semester));
end $$;
revoke all on function public.apply_student_plan(uuid,uuid,uuid,uuid,uuid[],int,int,int) from public,anon,authenticated;
grant execute on function public.apply_student_plan(uuid,uuid,uuid,uuid,uuid[],int,int,int) to service_role;
