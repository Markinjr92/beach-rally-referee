-- Phase 1 app contract hardening:
-- submit_match_result accepts one final-result payload format only:
-- { "sets": [{ "set_number": 1, "team_a_points": 21, "team_b_points": 18 }] }

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
  v_set_item jsonb;
  v_payload_key text;
  v_set_key text;
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

  if coalesce(v_match.status, 'scheduled') is distinct from 'scheduled' then
    return jsonb_build_object(
      'success', false,
      'error', 'match_already_in_progress_or_completed',
      'match_status', v_match.status
    );
  end if;

  if p_payload_json is null or jsonb_typeof(p_payload_json) <> 'object' then
    return jsonb_build_object('success', false, 'error', 'invalid_payload');
  end if;

  for v_payload_key in select jsonb_object_keys(p_payload_json) loop
    if v_payload_key <> 'sets' then
      return jsonb_build_object(
        'success', false,
        'error', 'unsupported_payload_field',
        'field', v_payload_key
      );
    end if;
  end loop;

  if jsonb_typeof(p_payload_json -> 'sets') is distinct from 'array' then
    return jsonb_build_object('success', false, 'error', 'invalid_payload_sets');
  end if;

  v_sets := p_payload_json -> 'sets';

  if jsonb_array_length(v_sets) = 0 then
    return jsonb_build_object('success', false, 'error', 'empty_result');
  end if;

  for v_set_item in select value from jsonb_array_elements(v_sets) loop
    if jsonb_typeof(v_set_item) <> 'object' then
      return jsonb_build_object('success', false, 'error', 'invalid_set');
    end if;

    for v_set_key in select jsonb_object_keys(v_set_item) loop
      if v_set_key not in ('set_number', 'team_a_points', 'team_b_points') then
        return jsonb_build_object(
          'success', false,
          'error', 'unsupported_set_field',
          'field', v_set_key
        );
      end if;
    end loop;

    if not (v_set_item ? 'set_number')
      or not (v_set_item ? 'team_a_points')
      or not (v_set_item ? 'team_b_points') then
      return jsonb_build_object('success', false, 'error', 'missing_set_field');
    end if;

    if jsonb_typeof(v_set_item -> 'set_number') is distinct from 'number'
      or jsonb_typeof(v_set_item -> 'team_a_points') is distinct from 'number'
      or jsonb_typeof(v_set_item -> 'team_b_points') is distinct from 'number'
      or (v_set_item ->> 'set_number') !~ '^[0-9]+$'
      or (v_set_item ->> 'team_a_points') !~ '^[0-9]+$'
      or (v_set_item ->> 'team_b_points') !~ '^[0-9]+$' then
      return jsonb_build_object('success', false, 'error', 'invalid_set_score');
    end if;
  end loop;

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

grant execute on function public.submit_match_result(uuid, text, jsonb, text) to authenticated;
