-- View for unread message counts per sender
create or replace view public.unread_counts as
select
  to_user_id,
  from_user_id,
  count(*)::int as unread_count
from public.messages
where status != 'read'
group by to_user_id, from_user_id;
