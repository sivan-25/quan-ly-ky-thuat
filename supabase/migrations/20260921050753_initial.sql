begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null, display_name text not null default '',
  is_admin boolean not null default false
);
create table public.buildings (id text primary key, name text not null);
insert into public.buildings values ('68PĐL','L’MAK 68 · Phan Đăng Lưu'),('62THL','62 Trần Huy Liệu'),('127HH','127 Hồng Hà'),('130HH','130 Hồng Hà'),('399CH','399CH');
create table public.building_members (
  building_id text references public.buildings(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null check(role in ('editor','viewer')),
  primary key(building_id,user_id)
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  building_id text not null references public.buildings(id),
  title text not null check(char_length(trim(title)) between 1 and 500),
  priority text not null default 'Bình thường' check(priority in ('Bình thường','Quan trọng','Khẩn cấp')),
  start_date date not null, end_date date not null check(end_date >= start_date),
  assignee text not null default '' check(char_length(assignee)<=200),
  status text not null default 'Đang thực hiện' check(status in ('Bắt đầu','Đang thực hiện','Hoàn thành')),
  notes text not null default '' check(char_length(notes)<=20000),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleting_at timestamptz,
  completed_at timestamptz
);
create index tasks_building_dates on public.tasks(building_id,start_date,end_date);
create index tasks_order on public.tasks(created_at desc,id);
create index membership_user on public.building_members(user_id);
create function private.is_qlkt_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select coalesce((select is_admin from public.profiles where id=auth.uid()),false);
$$;
create function private.can_access_building(target text, writing boolean default false) returns boolean language sql stable security definer set search_path = '' as $$
 select private.is_qlkt_admin() or exists(select 1 from public.building_members where user_id=auth.uid() and building_id=target and (not writing or role='editor'));
$$;
create function private.create_qlkt_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,email,display_name) values(new.id,coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'display_name',''));
 return new;
end;
$$;
create trigger qlkt_new_user after insert on auth.users for each row execute function private.create_qlkt_profile();
insert into public.profiles(id,email,display_name) select id,coalesce(email,''),coalesce(raw_user_meta_data->>'display_name','') from auth.users on conflict(id) do nothing;
create function private.guard_qlkt_task() returns trigger language plpgsql set search_path = '' as $$
begin
 if TG_OP='UPDATE' and old.deleting_at is not null then raise exception 'Công việc đang xóa, không thể sửa.'; end if;
 if TG_OP='INSERT' then new.created_at=now(); new.deleting_at=null; end if;
 if TG_OP='UPDATE' and (new.id<>old.id or new.created_by<>old.created_by or new.created_at<>old.created_at or new.building_id<>old.building_id) then
   raise exception 'Không thể đổi tòa nhà hoặc người tạo của công việc đã lưu.';
 end if;
 new.updated_at=clock_timestamp();
 if new.status='Hoàn thành' then
   if TG_OP='INSERT' then new.completed_at=now();
   elsif old.status<>'Hoàn thành' then new.completed_at=now();
   else new.completed_at=old.completed_at; end if;
 else new.completed_at=null; end if;
 return new;
end;
$$;
create trigger qlkt_task_guard before insert or update on public.tasks for each row execute function private.guard_qlkt_task();
alter table public.profiles enable row level security;
alter table public.buildings enable row level security;
alter table public.building_members enable row level security;
alter table public.tasks enable row level security;
revoke all on public.profiles,public.buildings,public.building_members,public.tasks from anon,authenticated;
grant select on public.profiles,public.buildings,public.building_members to authenticated;
grant select,insert,update,delete on public.tasks to authenticated;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or private.is_qlkt_admin());
create policy building_read on public.buildings for select to authenticated using(private.can_access_building(id));
create policy member_read on public.building_members for select to authenticated using(user_id=auth.uid() or private.is_qlkt_admin());
create policy task_read on public.tasks for select to authenticated using(private.can_access_building(building_id));
create policy task_insert on public.tasks for insert to authenticated with check(created_by=auth.uid() and private.can_access_building(building_id,true));
create policy task_update on public.tasks for update to authenticated using(private.can_access_building(building_id,true)) with check(private.can_access_building(building_id,true));
create policy task_delete on public.tasks for delete to authenticated using(private.can_access_building(building_id,true));
create function public.set_building_member(target_user uuid,target_building text,target_role text) returns void language plpgsql security definer set search_path = '' as $$
begin
 if not private.is_qlkt_admin() then raise exception 'Không có quyền quản trị.'; end if;
 if target_role is null then delete from public.building_members where user_id=target_user and building_id=target_building;
 elsif target_role in ('editor','viewer') then
 insert into public.building_members(user_id,building_id,role) values(target_user,target_building,target_role)
 on conflict(building_id,user_id) do update set role=excluded.role;
 else raise exception 'Vai trò không hợp lệ.'; end if;
end;
$$;
revoke all on function private.is_qlkt_admin(), private.can_access_building(text,boolean), public.set_building_member(uuid,text,text),private.create_qlkt_profile(),private.guard_qlkt_task() from public,anon;
grant execute on function private.is_qlkt_admin(),private.can_access_building(text,boolean),public.set_building_member(uuid,text,text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('task-images','task-images',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
create function private.can_access_task_image(object_name text, writing boolean default false) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.tasks t where t.id::text=split_part(object_name,'/',2) and t.building_id=split_part(object_name,'/',1) and private.can_access_building(t.building_id,writing));
$$;
revoke all on function private.can_access_task_image(text,boolean) from public,anon;
grant execute on function private.can_access_task_image(text,boolean) to authenticated;
create policy qlkt_image_read on storage.objects for select to authenticated using(bucket_id='task-images' and private.can_access_task_image(name));
create policy qlkt_image_insert on storage.objects for insert to authenticated with check(bucket_id='task-images' and private.can_access_task_image(name,true) and exists(select 1 from public.tasks t where t.id::text=split_part(name,'/',2) and t.deleting_at is null));
create policy qlkt_image_delete on storage.objects for delete to authenticated using(bucket_id='task-images' and private.can_access_task_image(name,true));
create function private.guard_task_delete() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if exists(select 1 from storage.objects where bucket_id='task-images' and split_part(name,'/',2)=old.id::text) then raise exception 'Còn ảnh chưa xóa. Vui lòng thử xóa lại công việc.'; end if;
 return old;
end;
$$;
revoke all on function private.guard_task_delete() from public,anon,authenticated;
create trigger qlkt_delete_guard before delete on public.tasks for each row execute function private.guard_task_delete();
commit;
