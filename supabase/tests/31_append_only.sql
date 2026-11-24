begin;
select plan(6);
select tests.seed_fixtures();

-- Even the database owner cannot rewrite history (MP §7.3): no UPDATE/DELETE policy plus a trigger.
select throws_ok($$update public.activity_logs set summary = 'tampered'$$, 'P0001', 'APPEND_ONLY', 'activity_logs cannot be updated');
select throws_ok($$delete from public.activity_logs$$, 'P0001', 'APPEND_ONLY', 'activity_logs cannot be deleted');
select throws_ok($$update public.admission_status_history set public_message = 'x'$$, 'P0001', 'APPEND_ONLY', 'status history cannot be updated');
select throws_ok($$delete from public.admission_notes$$, 'P0001', 'APPEND_ONLY', 'admission notes cannot be deleted');
select is(
  (select count(*)::int from pg_policies where tablename in ('activity_logs', 'admission_status_history', 'admission_notes')
     and cmd in ('UPDATE', 'DELETE', 'ALL')),
  0, 'no UPDATE/DELETE policies exist on append-only tables');

-- Staff can write audit entries only as themselves, through log_activity().
create temp table u on commit drop as select tests.create_user('ce@example.test', 'content_editor') as ce;
grant select on u to authenticated;
select tests.authenticate_as((select ce from u));
select public.log_activity(p_action => 'pages.update', p_summary => 'Updated a page', p_entity_type => 'page', p_entity_id => 'x');
select tests.as_system();
select is((select actor_id from public.activity_logs where action = 'pages.update'), (select ce from u),
  'log_activity records the caller as the actor (it cannot be spoofed)');

select * from finish();
rollback;
