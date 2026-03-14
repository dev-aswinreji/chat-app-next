-- Supabase SQL: refresh token table
create table if not exists public.refresh_tokens (
  id uuid primary key,
  user_id uuid references public.users (id) on delete cascade,
  token_hash text not null unique,
  family_id uuid not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz null,
  replaced_by uuid null,
  ip text null,
  user_agent text null
);

create index if not exists refresh_tokens_user_id_idx on public.refresh_tokens(user_id);
create index if not exists refresh_tokens_family_id_idx on public.refresh_tokens(family_id);
create index if not exists refresh_tokens_expires_at_idx on public.refresh_tokens(expires_at);
