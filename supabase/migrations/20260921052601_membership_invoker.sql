begin;
alter function public.set_building_member(uuid,text,text) security invoker;
grant insert,update,delete on public.building_members to authenticated;
create policy member_admin_insert on public.building_members for insert to authenticated with check ((select private.is_qlkt_admin()));
create policy member_admin_update on public.building_members for update to authenticated using ((select private.is_qlkt_admin())) with check ((select private.is_qlkt_admin()));
create policy member_admin_delete on public.building_members for delete to authenticated using ((select private.is_qlkt_admin()));
commit;
