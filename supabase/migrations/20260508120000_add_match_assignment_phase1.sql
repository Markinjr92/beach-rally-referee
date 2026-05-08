-- Phase 1 integration with the offline Referee Jukin app.
-- This adds assignment/release records and an idempotent final-result submission path.

create table if not exists public.match_assignments (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  referee_email text not null,
  referee_user_id uuid references public.users(id) on delete set null,
  assigned_by uuid references public.users(id) on delete set null default auth.uid(),
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_assignments_status_check check (status in ('active', 'revoked'))
);

create unique index if not exists match_assignments_active_match_email_idx
  on public.match_assignments (match_id, lower(referee_email))
  where revoked_at is null and status = 'active';

create index if not exists match_assignments_match_id_idx
  on public.match_assignments (match_id);

create index if not exists match_assignments_referee_user_id_idx
  on public.match_assignments (referee_user_id)
  where referee_user_id is not null;

create index if not exists match_assignments_referee_email_idx
  on public.match_assignments (lower(referee_email));

create table if not exists public.match_result_submissions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  referee_email text not null,
  submitted_by_user_id uuid references public.users(id) on delete set null,
  source_device_id text,
  operation_id text not null unique,
  payload_json jsonb not null,
  status text not null default 'pending',
  error_message text,
  submitted_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint match_result_submissions_status_check check (status in ('pending', 'accepted', 'rejected'))
);

create index if not exists match_result_submissions_match_id_idx
  on public.match_result_submissions (match_id);

create index if not exists match_result_submissions_referee_email_idx
  on public.match_result_submissions (lower(referee_email));

create unique index if not exists match_result_submissions_one_accepted_per_match_idx
  on public.match_result_submissions (match_id)
  where status = 'accepted';

alter table public.match_assignments enable row level security;
alter table public.match_result_submissions enable row level security;

create or replace function public.set_match_assignments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_match_assignments_updated_at on public.match_assignments;
create trigger set_match_assignments_updated_at
before update on public.match_assignments
for each row
execute procedure public.set_match_assignments_updated_at();

drop policy if exists "assigned referees can read own assignments" on public.match_assignments;
create policy "assigned referees can read own assignments"
  on public.match_assignments
  for select
  using (
    auth.uid() is not null
    and (
      referee_user_id = auth.uid()
      or lower(referee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      or public.user_has_permission(auth.uid(), 'tournament.manage')
    )
  );

drop policy if exists "tournament managers can manage assignments" on public.match_assignments;
create policy "tournament managers can manage assignments"
  on public.match_assignments
  for all
  using (public.user_has_permission(auth.uid(), 'tournament.manage'))
  with check (public.user_has_permission(auth.uid(), 'tournament.manage'));

drop policy if exists "assigned referees can read own submissions" on public.match_result_submissions;
create policy "assigned referees can read own submissions"
  on public.match_result_submissions
  for select
  using (
    auth.uid() is not null
    and (
      submitted_by_user_id = auth.uid()
      or lower(referee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      or public.user_has_permission(auth.uid(), 'tournament.manage')
    )
  );

drop policy if exists "assigned referees can create own submissions" on public.match_result_submissions;
-- Final-result writes must go through submit_match_result(), which validates
-- assignment, idempotency, match status and score rules transactionally.

drop policy if exists "tournament managers can manage submissions" on public.match_result_submissions;
create policy "tournament managers can manage submissions"
  on public.match_result_submissions
  for all
  using (public.user_has_permission(auth.uid(), 'tournament.manage'))
  with check (public.user_has_permission(auth.uid(), 'tournament.manage'));

-- Harden broad operational write policies added before assignments existed.
-- Tournament match operation remains available to referee-role users and tournament managers.
-- Casual-match owner policies are left intact in their original migrations.
drop policy if exists "authenticated can insert match_states" on public.match_states;
drop policy if exists "authenticated can update match_states" on public.match_states;
drop policy if exists "authenticated can insert match_events" on public.match_events;
drop policy if exists "authenticated can update match_events" on public.match_events;
drop policy if exists "authenticated can insert match_timeouts" on public.match_timeouts;
drop policy if exists "authenticated can update match_timeouts" on public.match_timeouts;

drop policy if exists "referee role can insert tournament match_states" on public.match_states;
create policy "referee role can insert tournament match_states"
  on public.match_states
  for insert
  with check (
    match_id is not null
    and (
      public.user_has_permission(auth.uid(), 'tournament.manage')
      or public.has_role('arbitro', auth.uid())
    )
  );

drop policy if exists "referee role can update tournament match_states" on public.match_states;
create policy "referee role can update tournament match_states"
  on public.match_states
  for update
  using (
    match_id is not null
    and (
      public.user_has_permission(auth.uid(), 'tournament.manage')
      or public.has_role('arbitro', auth.uid())
    )
  )
  with check (
    match_id is not null
    and (
      public.user_has_permission(auth.uid(), 'tournament.manage')
      or public.has_role('arbitro', auth.uid())
    )
  );

drop policy if exists "referee role can insert tournament match_events" on public.match_events;
create policy "referee role can insert tournament match_events"
  on public.match_events
  for insert
  with check (
    match_id is not null
    and (
      public.user_has_permission(auth.uid(), 'tournament.manage')
      or public.has_role('arbitro', auth.uid())
    )
  );

drop policy if exists "referee role can update tournament match_events" on public.match_events;
create policy "referee role can update tournament match_events"
  on public.match_events
  for update
  using (
    match_id is not null
    and (
      public.user_has_permission(auth.uid(), 'tournament.manage')
      or public.has_role('arbitro', auth.uid())
    )
  )
  with check (
    match_id is not null
    and (
      public.user_has_permission(auth.uid(), 'tournament.manage')
      or public.has_role('arbitro', auth.uid())
    )
  );

drop policy if exists "referee role can insert tournament match_timeouts" on public.match_timeouts;
create policy "referee role can insert tournament match_timeouts"
  on public.match_timeouts
  for insert
  with check (
    match_id is not null
    and (
      public.user_has_permission(auth.uid(), 'tournament.manage')
      or public.has_role('arbitro', auth.uid())
    )
  );

drop policy if exists "referee role can update tournament match_timeouts" on public.match_timeouts;
create policy "referee role can update tournament match_timeouts"
  on public.match_timeouts
  for update
  using (
    match_id is not null
    and (
      public.user_has_permission(auth.uid(), 'tournament.manage')
      or public.has_role('arbitro', auth.uid())
    )
  )
  with check (
    match_id is not null
    and (
      public.user_has_permission(auth.uid(), 'tournament.manage')
      or public.has_role('arbitro', auth.uid())
    )
  );

create or replace function public.assign_referee_to_matches(
  p_match_ids uuid[],
  p_referee_emails text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match_id uuid;
  v_email text;
  v_normalized_email text;
  v_referee_user_id uuid;
  v_assignment_id uuid;
  v_match_status text;
  v_created_count integer := 0;
  v_existing_count integer := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  if not public.user_has_permission(auth.uid(), 'tournament.manage') then
    return jsonb_build_object('success', false, 'error', 'permission_denied');
  end if;

  if coalesce(array_length(p_match_ids, 1), 0) = 0 then
    return jsonb_build_object('success', false, 'error', 'no_matches');
  end if;

  if coalesce(array_length(p_referee_emails, 1), 0) = 0 then
    return jsonb_build_object('success', false, 'error', 'no_referee_emails');
  end if;

  foreach v_match_id in array p_match_ids loop
    select coalesce(m.status, 'scheduled')
      into v_match_status
    from public.matches m
    where m.id = v_match_id;

    if v_match_status is null then
      return jsonb_build_object('success', false, 'error', 'match_not_found', 'match_id', v_match_id);
    end if;

    if v_match_status in ('completed', 'canceled') then
      return jsonb_build_object(
        'success', false,
        'error', 'match_not_assignable',
        'match_id', v_match_id,
        'match_status', v_match_status
      );
    end if;

    foreach v_email in array p_referee_emails loop
      v_normalized_email := lower(trim(v_email));

      if v_normalized_email = '' or v_normalized_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
        return jsonb_build_object('success', false, 'error', 'invalid_email', 'email', v_email);
      end if;

      select u.id
        into v_referee_user_id
      from public.users u
      where lower(u.email) = v_normalized_email
      limit 1;

      select ma.id
        into v_assignment_id
      from public.match_assignments ma
      where ma.match_id = v_match_id
        and lower(ma.referee_email) = v_normalized_email
        and ma.revoked_at is null
        and ma.status = 'active'
      limit 1;

      if v_assignment_id is not null then
        v_existing_count := v_existing_count + 1;
      else
        insert into public.match_assignments (
          match_id,
          referee_email,
          referee_user_id,
          assigned_by,
          status
        )
        values (
          v_match_id,
          v_normalized_email,
          v_referee_user_id,
          auth.uid(),
          'active'
        );

        v_created_count := v_created_count + 1;
      end if;
    end loop;
  end loop;

  return jsonb_build_object(
    'success', true,
    'created_count', v_created_count,
    'existing_count', v_existing_count
  );
end;
$$;

create or replace function public.list_assigned_matches()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'success', true,
    'matches', coalesce(jsonb_agg(
      jsonb_build_object(
        'assignment_id', ma.id,
        'assignment_status', ma.status,
        'assigned_at', ma.assigned_at,
        'match', jsonb_build_object(
          'id', m.id,
          'tournament_id', m.tournament_id,
          'scheduled_at', m.scheduled_at,
          'court', m.court,
          'phase', m.phase,
          'status', m.status,
          'best_of', m.best_of,
          'points_per_set', m.points_per_set,
          'side_switch_sum', m.side_switch_sum,
          'modality', m.modality,
          'team_a', jsonb_build_object('id', ta.id, 'name', ta.name),
          'team_b', jsonb_build_object('id', tb.id, 'name', tb.name),
          'tournament', jsonb_build_object('id', t.id, 'name', t.name)
        )
      )
      order by m.scheduled_at nulls last, ma.assigned_at desc
    ), '[]'::jsonb)
  )
  from public.match_assignments ma
  join public.matches m on m.id = ma.match_id
  join public.teams ta on ta.id = m.team_a_id
  join public.teams tb on tb.id = m.team_b_id
  join public.tournaments t on t.id = m.tournament_id
  where auth.uid() is not null
    and ma.status = 'active'
    and ma.revoked_at is null
    and (
      ma.referee_user_id = auth.uid()
      or lower(ma.referee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

create or replace function public.submit_match_result(
  p_match_id uuid,
  p_operation_id text,
  p_payload_json jsonb,
  p_source_device_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_assignment public.match_assignments%rowtype;
  v_existing public.match_result_submissions%rowtype;
  v_match public.matches%rowtype;
  v_sets jsonb := '[]'::jsonb;
  v_scores_team_a jsonb := '[]'::jsonb;
  v_scores_team_b jsonb := '[]'::jsonb;
  v_set record;
  v_index integer;
  v_sets_won_a integer := 0;
  v_sets_won_b integer := 0;
  v_current_set integer := 1;
  v_best_of integer;
  v_sets_to_win integer;
  v_target_points integer;
  v_min_points integer;
  v_point_diff integer;
  v_seen_set_numbers integer[] := '{}';
  v_submission_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  if p_operation_id is null or trim(p_operation_id) = '' then
    return jsonb_build_object('success', false, 'error', 'missing_operation_id');
  end if;

  select *
    into v_existing
  from public.match_result_submissions
  where operation_id = p_operation_id
  limit 1;

  if v_existing.id is not null then
    if v_existing.match_id = p_match_id
      and (
        v_existing.submitted_by_user_id = auth.uid()
        or lower(v_existing.referee_email) = v_auth_email
      ) then
      return jsonb_build_object(
        'success', v_existing.status = 'accepted',
        'idempotent', true,
        'submission_id', v_existing.id,
        'status', v_existing.status,
        'error', v_existing.error_message
      );
    end if;

    return jsonb_build_object('success', false, 'error', 'duplicate_operation_id');
  end if;

  select *
    into v_assignment
  from public.match_assignments ma
  where ma.match_id = p_match_id
    and ma.status = 'active'
    and ma.revoked_at is null
    and (
      ma.referee_user_id = auth.uid()
      or lower(ma.referee_email) = v_auth_email
    )
  order by ma.assigned_at desc
  limit 1;

  if v_assignment.id is null then
    return jsonb_build_object('success', false, 'error', 'match_not_assigned');
  end if;

  select *
    into v_match
  from public.matches
  where id = p_match_id
  limit 1
  for update;

  if v_match.id is null then
    return jsonb_build_object('success', false, 'error', 'match_not_found');
  end if;

  select *
    into v_existing
  from public.match_result_submissions
  where operation_id = p_operation_id
  limit 1;

  if v_existing.id is not null then
    if v_existing.match_id = p_match_id
      and (
        v_existing.submitted_by_user_id = auth.uid()
        or lower(v_existing.referee_email) = v_auth_email
      ) then
      return jsonb_build_object(
        'success', v_existing.status = 'accepted',
        'idempotent', true,
        'submission_id', v_existing.id,
        'status', v_existing.status,
        'error', v_existing.error_message
      );
    end if;

    return jsonb_build_object('success', false, 'error', 'duplicate_operation_id');
  end if;

  if coalesce(v_match.status, 'scheduled') in ('completed', 'canceled') then
    return jsonb_build_object('success', false, 'error', 'match_not_open_for_result', 'match_status', v_match.status);
  end if;

  if jsonb_typeof(p_payload_json) <> 'object' then
    return jsonb_build_object('success', false, 'error', 'invalid_payload');
  end if;

  if jsonb_typeof(p_payload_json -> 'sets') = 'array' then
    v_sets := p_payload_json -> 'sets';
  elsif jsonb_typeof(p_payload_json -> 'scores') = 'object'
    and jsonb_typeof(p_payload_json -> 'scores' -> 'teamA') = 'array'
    and jsonb_typeof(p_payload_json -> 'scores' -> 'teamB') = 'array' then
    if jsonb_array_length(p_payload_json -> 'scores' -> 'teamA') <> jsonb_array_length(p_payload_json -> 'scores' -> 'teamB') then
      return jsonb_build_object('success', false, 'error', 'invalid_payload_score_lengths');
    end if;

    for v_index in 1..jsonb_array_length(p_payload_json -> 'scores' -> 'teamA') loop
      v_sets := v_sets || jsonb_build_object(
        'set_number', v_index,
        'team_a_points', ((p_payload_json -> 'scores' -> 'teamA' ->> (v_index - 1))::int),
        'team_b_points', ((p_payload_json -> 'scores' -> 'teamB' ->> (v_index - 1))::int)
      );
    end loop;
  else
    return jsonb_build_object('success', false, 'error', 'invalid_payload_sets');
  end if;

  if jsonb_array_length(v_sets) = 0 then
    return jsonb_build_object('success', false, 'error', 'empty_result');
  end if;

  v_best_of := coalesce(v_match.best_of, coalesce(array_length(v_match.points_per_set, 1), 3));
  if v_best_of not in (1, 3, 5) then
    return jsonb_build_object('success', false, 'error', 'unsupported_best_of', 'best_of', v_best_of);
  end if;

  v_sets_to_win := floor(v_best_of::numeric / 2)::int + 1;

  for v_set in
    select *
    from jsonb_to_recordset(v_sets) as x(set_number int, team_a_points int, team_b_points int)
    order by set_number
  loop
    if v_set.set_number is null
      or v_set.set_number < 1
      or v_set.team_a_points is null
      or v_set.team_b_points is null
      or v_set.team_a_points < 0
      or v_set.team_b_points < 0 then
      return jsonb_build_object('success', false, 'error', 'invalid_set_score');
    end if;

    if v_set.set_number = any(v_seen_set_numbers) then
      return jsonb_build_object('success', false, 'error', 'duplicate_set_number', 'set_number', v_set.set_number);
    end if;

    if v_set.set_number > v_best_of then
      return jsonb_build_object('success', false, 'error', 'too_many_sets_for_format', 'set_number', v_set.set_number, 'best_of', v_best_of);
    end if;

    if v_set.set_number <> coalesce(array_length(v_seen_set_numbers, 1), 0) + 1 then
      return jsonb_build_object('success', false, 'error', 'non_sequential_set_number', 'set_number', v_set.set_number);
    end if;

    if v_set.team_a_points = v_set.team_b_points then
      return jsonb_build_object('success', false, 'error', 'tied_set_score', 'set_number', v_set.set_number);
    end if;

    v_target_points := coalesce(
      v_match.points_per_set[least(v_set.set_number, coalesce(array_length(v_match.points_per_set, 1), 0))],
      case
        when v_best_of = 1 then 21
        when v_set.set_number = v_best_of then 15
        else 21
      end
    );
    v_min_points := greatest(v_set.team_a_points, v_set.team_b_points);
    v_point_diff := abs(v_set.team_a_points - v_set.team_b_points);

    if v_min_points < v_target_points then
      return jsonb_build_object(
        'success', false,
        'error', 'set_target_not_reached',
        'set_number', v_set.set_number,
        'target_points', v_target_points
      );
    end if;

    if v_point_diff < 2 then
      return jsonb_build_object(
        'success', false,
        'error', 'set_point_difference_too_small',
        'set_number', v_set.set_number,
        'minimum_difference', 2
      );
    end if;

    if coalesce(v_match.direct_win_format, false)
      and least(v_set.team_a_points, v_set.team_b_points) = v_target_points - 1
      and greatest(v_set.team_a_points, v_set.team_b_points) < v_target_points + 2 then
      return jsonb_build_object(
        'success', false,
        'error', 'direct_win_target_not_reached',
        'set_number', v_set.set_number,
        'target_points', v_target_points + 2
      );
    end if;

    if v_set.team_a_points > v_set.team_b_points then
      v_sets_won_a := v_sets_won_a + 1;
    else
      v_sets_won_b := v_sets_won_b + 1;
    end if;

    if greatest(v_sets_won_a, v_sets_won_b) > v_sets_to_win then
      return jsonb_build_object('success', false, 'error', 'too_many_won_sets');
    end if;

    if greatest(v_sets_won_a, v_sets_won_b) = v_sets_to_win
      and v_set.set_number < jsonb_array_length(v_sets) then
      return jsonb_build_object('success', false, 'error', 'sets_after_match_winner', 'set_number', v_set.set_number);
    end if;

    v_current_set := greatest(v_current_set, v_set.set_number);
    v_scores_team_a := v_scores_team_a || to_jsonb(v_set.team_a_points);
    v_scores_team_b := v_scores_team_b || to_jsonb(v_set.team_b_points);
    v_seen_set_numbers := array_append(v_seen_set_numbers, v_set.set_number);
  end loop;

  if jsonb_array_length(v_sets) > v_best_of then
    return jsonb_build_object('success', false, 'error', 'too_many_sets_for_format', 'best_of', v_best_of);
  end if;

  if greatest(v_sets_won_a, v_sets_won_b) <> v_sets_to_win then
    return jsonb_build_object(
      'success', false,
      'error', 'match_winner_not_reached',
      'sets_to_win', v_sets_to_win,
      'sets_won', jsonb_build_object('teamA', v_sets_won_a, 'teamB', v_sets_won_b)
    );
  end if;

  if v_sets_won_a = v_sets_won_b then
    return jsonb_build_object('success', false, 'error', 'match_winner_tied');
  end if;

  insert into public.match_result_submissions (
    match_id,
    referee_email,
    submitted_by_user_id,
    source_device_id,
    operation_id,
    payload_json,
    status
  )
  values (
    p_match_id,
    v_assignment.referee_email,
    auth.uid(),
    p_source_device_id,
    p_operation_id,
    p_payload_json,
    'pending'
  )
  returning id into v_submission_id;

  delete from public.match_scores
  where match_id = p_match_id;

  insert into public.match_scores (match_id, set_number, team_a_points, team_b_points)
  select p_match_id, x.set_number, x.team_a_points, x.team_b_points
  from jsonb_to_recordset(v_sets) as x(set_number int, team_a_points int, team_b_points int)
  order by x.set_number;

  update public.match_states
  set
    current_set = v_current_set,
    sets_won = jsonb_build_object('teamA', v_sets_won_a, 'teamB', v_sets_won_b),
    scores = jsonb_build_object('teamA', v_scores_team_a, 'teamB', v_scores_team_b),
    is_game_ended = true,
    active_timer = null,
    updated_at = now()
  where match_id = p_match_id;

  if not found then
    insert into public.match_states (
      match_id,
      current_set,
      sets_won,
      scores,
      is_game_ended,
      active_timer
    )
    values (
      p_match_id,
      v_current_set,
      jsonb_build_object('teamA', v_sets_won_a, 'teamB', v_sets_won_b),
      jsonb_build_object('teamA', v_scores_team_a, 'teamB', v_scores_team_b),
      true,
      null
    );
  end if;

  update public.matches
  set status = 'completed',
      referee_id = coalesce(referee_id, v_assignment.referee_user_id, auth.uid())
  where id = p_match_id;

  update public.match_result_submissions
  set status = 'accepted',
      processed_at = now(),
      error_message = null
  where id = v_submission_id;

  return jsonb_build_object(
    'success', true,
    'idempotent', false,
    'submission_id', v_submission_id,
    'status', 'accepted',
    'sets_won', jsonb_build_object('teamA', v_sets_won_a, 'teamB', v_sets_won_b)
  );
exception
  when others then
    if v_submission_id is not null then
      update public.match_result_submissions
      set status = 'rejected',
          processed_at = now(),
          error_message = sqlerrm
      where id = v_submission_id;
    end if;

    return jsonb_build_object('success', false, 'error', 'processing_failed', 'message', sqlerrm);
end;
$$;

grant execute on function public.assign_referee_to_matches(uuid[], text[]) to authenticated;
grant execute on function public.list_assigned_matches() to authenticated;
grant execute on function public.submit_match_result(uuid, text, jsonb, text) to authenticated;
