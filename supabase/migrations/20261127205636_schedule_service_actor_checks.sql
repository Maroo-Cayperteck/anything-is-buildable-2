create or replace function public.change_schedule_slot(p_actor uuid,p_id uuid,p_expected int,p_values jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare old_row schedule_slots; new_row schedule_slots;
begin
 if not exists(select 1 from user_roles where user_id=p_actor and role='admin') then raise exception 'Forbidden'; end if;
 select * into strict old_row from schedule_slots where id=p_id for update;
 if old_row.version<>p_expected then raise exception 'الموعد تغير؛ أعد تحميل الصفحة'; end if;
 new_row=jsonb_populate_record(old_row,p_values);
 update schedule_slots set day_of_week=new_row.day_of_week,start_time=new_row.start_time,end_time=new_row.end_time,
 location=new_row.location,instructor=new_row.instructor,kind=new_row.kind,group_number=new_row.group_number,
 section_number=new_row.section_number,lab_number=new_row.lab_number,is_deleted=new_row.is_deleted,version=old_row.version+1
 where id=p_id returning * into new_row;
 insert into schedule_history(slot_id,actor_id,before_data,after_data) values(p_id,p_actor,to_jsonb(old_row),to_jsonb(new_row));
end $$;
create or replace function public.undo_schedule_slot(p_actor uuid,p_history uuid)
returns void language plpgsql security invoker set search_path=public as $$
declare h schedule_history; v int;
begin
 if not exists(select 1 from user_roles where user_id=p_actor and role='admin') then raise exception 'Forbidden'; end if;
 select * into strict h from schedule_history where id=p_history for update;
 if h.undone_at is not null then raise exception 'تم التراجع بالفعل'; end if;
 select version into v from schedule_slots where id=h.slot_id for update;
 if v<>(h.after_data->>'version')::int then raise exception 'يوجد تعديل أحدث؛ لا يمكن استبداله'; end if;
 perform change_schedule_slot(p_actor,h.slot_id,v,h.before_data);
 update schedule_history set undone_at=now() where id=p_history;
end $$;
revoke all on function public.change_schedule_slot(uuid,uuid,int,jsonb),public.undo_schedule_slot(uuid,uuid) from public,anon,authenticated;
grant execute on function public.change_schedule_slot(uuid,uuid,int,jsonb),public.undo_schedule_slot(uuid,uuid) to service_role;
