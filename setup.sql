-- Run this in Supabase → SQL Editor

-- Drop old profiles table if it exists and recreate with full schema
drop table if exists profiles;

create table profiles (
  id uuid references auth.users primary key,
  username text unique not null,
  display_name text,
  avatar_emoji text default '🎓',
  subjects text[] default '{}',
  study_level text,
  goal text,
  streak int default 0,
  last_active timestamp,
  created_at timestamp default now()
);

-- Row level security
alter table profiles enable row level security;

create policy "Users can read own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- user_data table (in case it doesn't exist yet)
create table if not exists user_data (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  feature text not null,
  data jsonb not null,
  updated_at timestamp default now(),
  constraint user_data_user_feature_unique unique (user_id, feature)
);

alter table user_data enable row level security;

drop policy if exists "Users can only access own data" on user_data;
create policy "Users can only access own data"
  on user_data for all using (auth.uid() = user_id);
