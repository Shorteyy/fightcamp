-- ============================================================
-- Every profile now gets a fighters row on signup, regardless of role,
-- so coaches get full fighter functionality (weight, nutrition, joining
-- trainings) on top of their admin powers. No RLS policy changes needed:
-- every existing policy already keys off profile_id = auth.uid() OR
-- is_coach(), not role.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role public.user_role;
begin
  perform pg_advisory_xact_lock(hashtext('profiles_bootstrap'));

  if not exists (select 1 from public.profiles) then
    v_role := 'coach';
  else
    v_role := 'fighter';
  end if;

  insert into public.profiles (id, role, full_name)
  values (new.id, v_role, coalesce(new.raw_user_meta_data->>'full_name', new.email));

  insert into public.fighters (profile_id) values (new.id);

  return new;
end;
$$;

-- Backfill any existing profile missing a fighters row (covers the
-- coach account created before this migration existed).
insert into public.fighters (profile_id)
select p.id from public.profiles p
left join public.fighters f on f.profile_id = p.id
where f.profile_id is null;
