create or replace function public.create_open_student(p_user uuid,p_code text,p_name text,p_level int,p_term int)
returns void language plpgsql security invoker set search_path=public as $$
declare v_level academic_levels; v_sem semesters; v_email text;
begin
 if p_code !~ '^9252500[0-9]{2}$' or p_level not between 0 and 3 or p_term not between 1 and 2 then raise exception 'Invalid registration'; end if;
 v_email='student'||p_code||'@hnu-portal.example.com';
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
