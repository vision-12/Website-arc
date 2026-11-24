begin;
select plan(2);
-- MP §7.3 requires these. The RPC is built in Phase 12a (spec §4.6), which must remove this todo
-- and make both assertions pass; a todo keeps the gap visible in every test run until then.
-- Tracked in https://github.com/vision-12/Website-arc/issues/3
select todo('submit_application arrives in Phase 12a', 2);
select ok(false, 'submit_application rejects a client-supplied status');
select ok(false, 'submit_application rejects a client-supplied reference');
select * from finish();
rollback;
