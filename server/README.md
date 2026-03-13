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

Enable RLS if you want, but backend uses service role key.
