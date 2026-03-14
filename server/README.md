# Chat App API (NestJS + Socket.IO + Supabase)

## Setup
```bash
cd server
cp .env.example .env
# fill SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + JWT_SECRET

yarn start:dev
```

## Database (Supabase SQL)
Run in Supabase SQL editor:

```sql
create table if not exists users (
  id uuid default gen_random_uuid() primary key,
  username text unique not null,
  full_name text not null,
  password_hash text not null,
  is_online boolean default false,
  created_at timestamptz default now()
);
```

Then create the refresh token table:

```sql
-- see sql/refresh_tokens.sql
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
```

Then create last-read tracking:

```sql
-- see sql/chat_reads.sql
create table if not exists public.chat_reads (
  user_id uuid references public.users (id) on delete cascade,
  peer_id uuid references public.users (id) on delete cascade,
  last_read_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, peer_id)
);

create index if not exists chat_reads_user_idx on public.chat_reads(user_id);
create index if not exists chat_reads_peer_idx on public.chat_reads(peer_id);
```

Enable RLS if you want, but backend uses service role key.

## API Docs (Scalar)
Scalar API Reference available at: `http://localhost:4000/docs`
