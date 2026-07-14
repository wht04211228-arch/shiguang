-- 拾光 v0.8：定时开启、展示期限、情绪回应与收件人体验数据
-- 已部署 v0.7 的项目只需执行本文件一次。

alter table public.cards
  add column if not exists relationship_start_date date,
  add column if not exists release_at timestamptz,
  add column if not exists expires_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cards_valid_access_window'
  ) then
    alter table public.cards add constraint cards_valid_access_window
      check (expires_at is null or release_at is null or expires_at > release_at);
  end if;
end $$;

alter table public.card_replies add column if not exists mood text not null default 'touched';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'card_replies_mood_check'
  ) then
    alter table public.card_replies add constraint card_replies_mood_check
      check (mood in ('touched','happy','surprised','teary','calm'));
  end if;
end $$;

create table if not exists public.card_engagement_events (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  session_id text not null check (char_length(session_id) between 8 and 120),
  event_type text not null check (event_type in (
    'opened','countdown_viewed','unlocked','stage_viewed','quiz_completed',
    'surprise_opened','completed','reply_submitted'
  )),
  stage_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists card_engagement_card_created_idx
  on public.card_engagement_events(card_id, created_at desc);
create index if not exists card_engagement_card_event_idx
  on public.card_engagement_events(card_id, event_type, created_at desc);
create index if not exists card_engagement_session_idx
  on public.card_engagement_events(card_id, session_id);

alter table public.card_engagement_events enable row level security;

drop policy if exists "owners can read card engagement" on public.card_engagement_events;
create policy "owners can read card engagement"
on public.card_engagement_events for select to authenticated
using (
  exists (
    select 1 from public.cards
    where cards.id = card_engagement_events.card_id
      and cards.owner_id = (select auth.uid())
  )
);

revoke all on public.card_engagement_events from anon, authenticated;
grant select on public.card_engagement_events to authenticated;
