-- Track last-read per chat pair
create table if not exists public.chat_reads (
  user_id uuid references public.users (id) on delete cascade,
  peer_id uuid references public.users (id) on delete cascade,
  last_read_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, peer_id)
);

create index if not exists chat_reads_user_idx on public.chat_reads(user_id);
create index if not exists chat_reads_peer_idx on public.chat_reads(peer_id);
