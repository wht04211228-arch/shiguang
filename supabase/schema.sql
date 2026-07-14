-- 拾光 Cloud MVP schema
-- 在 Supabase Dashboard → SQL Editor 中完整执行一次。

create extension if not exists pgcrypto;

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique check (char_length(slug) between 1 and 100),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  theme text not null default 'film' check (theme in ('cinema', 'starlight', 'film')),
  sender_name text not null,
  recipient_name text not null,
  occasion text not null,
  important_date date,
  unlock_question text not null default '',
  unlock_answer_hash text,
  cover_kicker text not null default 'A PRIVATE MEMORY GIFT',
  cover_title text not null,
  cover_subtitle text not null default '',
  content jsonb not null default '{}'::jsonb,
  view_count bigint not null default 0,
  reply_count bigint not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cards_owner_updated_idx on public.cards(owner_id, updated_at desc);
create index if not exists cards_published_slug_idx on public.cards(slug) where status = 'published';

create table if not exists public.card_replies (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 1500),
  created_at timestamptz not null default now()
);

create index if not exists card_replies_card_created_idx on public.card_replies(card_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cards_set_updated_at on public.cards;
create trigger cards_set_updated_at
before update on public.cards
for each row execute function public.set_updated_at();

create or replace function public.sync_card_reply_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.cards set reply_count = reply_count + 1 where id = new.card_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.cards set reply_count = greatest(reply_count - 1, 0) where id = old.card_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists card_replies_sync_count on public.card_replies;
create trigger card_replies_sync_count
after insert or delete on public.card_replies
for each row execute function public.sync_card_reply_count();

create or replace function public.increment_card_view(target_card_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.cards set view_count = view_count + 1 where id = target_card_id;
$$;

revoke all on function public.increment_card_view(uuid) from public, anon, authenticated;
grant execute on function public.increment_card_view(uuid) to service_role;

alter table public.cards enable row level security;
alter table public.card_replies enable row level security;

-- 制作人只可访问自己的礼物。
drop policy if exists "owners can read cards" on public.cards;
create policy "owners can read cards" on public.cards
for select to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists "owners can insert cards" on public.cards;
create policy "owners can insert cards" on public.cards
for insert to authenticated with check ((select auth.uid()) = owner_id);

drop policy if exists "owners can update cards" on public.cards;
create policy "owners can update cards" on public.cards
for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "owners can delete cards" on public.cards;
create policy "owners can delete cards" on public.cards
for delete to authenticated using ((select auth.uid()) = owner_id);

-- 收件人回复通过受控 Route Handler 写入；制作人只可读取自己礼物的回复。
drop policy if exists "owners can read replies" on public.card_replies;
create policy "owners can read replies" on public.card_replies
for select to authenticated using (
  exists (
    select 1 from public.cards
    where cards.id = card_replies.card_id
      and cards.owner_id = (select auth.uid())
  )
);

revoke all on public.cards from anon;
revoke all on public.card_replies from anon;
grant select, insert, update, delete on public.cards to authenticated;
grant select on public.card_replies to authenticated;

-- 私有媒体桶。对象路径的第一级目录必须等于当前用户 UUID。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'card-media',
  'card-media',
  false,
  6291456,
  array['image/jpeg','image/png','image/webp','image/gif','image/avif','audio/mpeg','audio/mp4','audio/wav','audio/ogg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "owners can upload card media" on storage.objects;
create policy "owners can upload card media" on storage.objects
for insert to authenticated with check (
  bucket_id = 'card-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "owners can read card media" on storage.objects;
create policy "owners can read card media" on storage.objects
for select to authenticated using (
  bucket_id = 'card-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "owners can update card media" on storage.objects;
create policy "owners can update card media" on storage.objects
for update to authenticated
using (bucket_id = 'card-media' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'card-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "owners can delete card media" on storage.objects;
create policy "owners can delete card media" on storage.objects
for delete to authenticated using (
  bucket_id = 'card-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
-- M4 商业闭环：订单、支付状态、订单事件与贺卡权益绑定
-- 可在已经执行过 v0.3 schema 的 Supabase 项目中单独执行。

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null check (plan_id in ('light', 'deep', 'private')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'in_progress', 'fulfilled', 'cancelled', 'refunded')),
  payment_provider text not null default 'demo' check (payment_provider in ('demo', 'stripe', 'manual')),
  payment_session_id text unique,
  amount integer not null check (amount >= 0),
  currency text not null default 'cny',
  customer_email text not null,
  customer_name text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_owner_created_idx on public.orders(owner_id, created_at desc);
create index if not exists orders_status_created_idx on public.orders(status, created_at desc);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists order_events_order_created_idx on public.order_events(order_id, created_at desc);

alter table public.cards add column if not exists order_id uuid references public.orders(id) on delete set null;
create unique index if not exists cards_order_id_unique_idx on public.cards(order_id) where order_id is not null;

create or replace function public.set_order_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_order_updated_at();

alter table public.orders enable row level security;
alter table public.order_events enable row level security;

drop policy if exists "owners can read orders" on public.orders;
create policy "owners can read orders" on public.orders
for select to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists "owners can read order events" on public.order_events;
create policy "owners can read order events" on public.order_events
for select to authenticated using (
  exists (
    select 1 from public.orders
    where orders.id = order_events.order_id
      and orders.owner_id = (select auth.uid())
  )
);

revoke all on public.orders from anon;
revoke all on public.order_events from anon;
grant select on public.orders to authenticated;
grant select on public.order_events to authenticated;

alter table public.orders add column if not exists ai_drafts_used integer not null default 0 check (ai_drafts_used >= 0);

create or replace function public.consume_order_ai_draft(target_order_id uuid, maximum_drafts integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  update public.orders
  set ai_drafts_used = ai_drafts_used + 1
  where id = target_order_id
    and ai_drafts_used < maximum_drafts
  returning ai_drafts_used into next_count;
  return next_count;
end;
$$;

revoke all on function public.consume_order_ai_draft(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_order_ai_draft(uuid, integer) to service_role;
-- 拾光 M5：售卖问卷、运营后台、售后与转化分析
-- 已运行 v0.4 的项目仅执行本文件。

alter table public.orders add column if not exists service_stage text not null default 'waiting_brief'
  check (service_stage in ('waiting_brief','brief_submitted','planning','producing','reviewing','delivered','closed'));
alter table public.orders add column if not exists priority text not null default 'normal'
  check (priority in ('low','normal','high','urgent'));
alter table public.orders add column if not exists due_at timestamptz;
alter table public.orders add column if not exists assignee text;
alter table public.orders add column if not exists internal_notes text;
alter table public.orders add column if not exists discount_amount integer not null default 0 check (discount_amount >= 0);
alter table public.orders add column if not exists promotion_code text;

create table if not exists public.order_briefs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  recipient_name text not null,
  relationship text not null,
  occasion text not null,
  delivery_date date,
  preferred_theme text not null default 'film' check (preferred_theme in ('cinema','starlight','film','unsure')),
  tone text not null default 'warm' check (tone in ('warm','romantic','restrained','playful','solemn')),
  story_facts jsonb not null default '[]'::jsonb,
  must_include text,
  avoid_content text,
  contact_method text,
  special_requests text,
  status text not null default 'draft' check (status in ('draft','submitted','reviewed')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists order_briefs_owner_updated_idx on public.order_briefs(owner_id, updated_at desc);

create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 8 and 2000),
  status text not null default 'pending' check (status in ('pending','approved','rejected','refunded','cancelled')),
  admin_response text,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists refund_requests_owner_created_idx on public.refund_requests(owner_id, created_at desc);
create index if not exists refund_requests_status_created_idx on public.refund_requests(status, created_at desc);

create table if not exists public.conversion_events (
  id bigint generated by default as identity primary key,
  session_id text not null check (char_length(session_id) between 8 and 100),
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null check (char_length(event_name) between 2 and 80),
  path text not null default '/',
  referrer text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists conversion_events_name_created_idx on public.conversion_events(event_name, created_at desc);
create index if not exists conversion_events_session_created_idx on public.conversion_events(session_id, created_at desc);

create or replace function public.set_sales_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists order_briefs_set_updated_at on public.order_briefs;
create trigger order_briefs_set_updated_at before update on public.order_briefs
for each row execute function public.set_sales_updated_at();

drop trigger if exists refund_requests_set_updated_at on public.refund_requests;
create trigger refund_requests_set_updated_at before update on public.refund_requests
for each row execute function public.set_sales_updated_at();

alter table public.order_briefs enable row level security;
alter table public.refund_requests enable row level security;
alter table public.conversion_events enable row level security;

drop policy if exists "owners can read own briefs" on public.order_briefs;
create policy "owners can read own briefs" on public.order_briefs for select to authenticated
using ((select auth.uid()) = owner_id);
drop policy if exists "owners can insert own briefs" on public.order_briefs;
create policy "owners can insert own briefs" on public.order_briefs for insert to authenticated
with check ((select auth.uid()) = owner_id and exists (
  select 1 from public.orders where orders.id = order_briefs.order_id and orders.owner_id = (select auth.uid())
));
drop policy if exists "owners can update own briefs" on public.order_briefs;
create policy "owners can update own briefs" on public.order_briefs for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "owners can read own refund requests" on public.refund_requests;
create policy "owners can read own refund requests" on public.refund_requests for select to authenticated
using ((select auth.uid()) = owner_id);
drop policy if exists "owners can create own refund requests" on public.refund_requests;
create policy "owners can create own refund requests" on public.refund_requests for insert to authenticated
with check ((select auth.uid()) = owner_id and exists (
  select 1 from public.orders where orders.id = refund_requests.order_id and orders.owner_id = (select auth.uid())
));

revoke all on public.order_briefs from anon;
revoke all on public.refund_requests from anon;
revoke all on public.conversion_events from anon, authenticated;
grant select, insert, update on public.order_briefs to authenticated;
grant select, insert on public.refund_requests to authenticated;
-- conversion_events 只能经服务端 API 使用 service_role 写入与读取。
-- 拾光 M6：初稿确认、修改管理、任务、提醒、评价、案例授权与推荐追踪
-- 已运行 v0.5 的项目仅执行本文件。

alter table public.orders add column if not exists review_status text not null default 'not_ready'
  check (review_status in ('not_ready','awaiting_review','changes_requested','approved'));
alter table public.orders add column if not exists revision_count integer not null default 0 check (revision_count >= 0);
alter table public.orders add column if not exists review_requested_at timestamptz;
alter table public.orders add column if not exists approved_at timestamptz;
alter table public.orders add column if not exists referred_by_code text;

create table if not exists public.order_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  round_no integer not null check (round_no > 0),
  status text not null default 'pending' check (status in ('pending','approved','changes_requested','superseded')),
  preview_url text,
  admin_note text,
  customer_note text,
  submitted_at timestamptz not null default now(),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id, round_no)
);
create index if not exists order_reviews_owner_created_idx on public.order_reviews(owner_id, created_at desc);
create index if not exists order_reviews_order_round_idx on public.order_reviews(order_id, round_no desc);

create table if not exists public.production_tasks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 200),
  description text,
  status text not null default 'todo' check (status in ('todo','doing','blocked','done')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assignee text,
  due_at timestamptz,
  sort_order integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists production_tasks_order_status_idx on public.production_tasks(order_id, status, sort_order);
create index if not exists production_tasks_due_idx on public.production_tasks(due_at) where status <> 'done';

create table if not exists public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  testimonial text check (char_length(testimonial) <= 2000),
  display_name text,
  public_consent boolean not null default false,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customer_reviews_status_created_idx on public.customer_reviews(status, created_at desc);

create table if not exists public.case_permissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  allow_anonymous_case boolean not null default false,
  allow_quote boolean not null default false,
  allow_media boolean not null default false,
  public_alias text,
  consent_note text,
  granted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{6,16}$'),
  status text not null default 'active' check (status in ('active','paused','disabled')),
  click_count integer not null default 0 check (click_count >= 0),
  paid_order_count integer not null default 0 check (paid_order_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists referral_codes_owner_created_idx on public.referral_codes(owner_id, created_at desc);

create table if not exists public.referral_attributions (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null references public.referral_codes(id) on delete cascade,
  order_id uuid unique references public.orders(id) on delete set null,
  session_id text not null check (char_length(session_id) between 8 and 100),
  clicked_at timestamptz not null default now(),
  converted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists referral_attributions_code_created_idx on public.referral_attributions(referral_code_id, created_at desc);

create table if not exists public.reminder_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('brief_pending','review_pending','delivery_due','review_request','feedback_request')),
  recipient text not null,
  status text not null default 'sent' check (status in ('sent','failed','skipped')),
  error_message text,
  sent_at timestamptz not null default now(),
  unique(order_id, reminder_type, recipient, sent_at)
);
create index if not exists reminder_logs_order_sent_idx on public.reminder_logs(order_id, sent_at desc);

create or replace function public.set_growth_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists order_reviews_set_updated_at on public.order_reviews;
create trigger order_reviews_set_updated_at before update on public.order_reviews
for each row execute function public.set_growth_updated_at();
drop trigger if exists production_tasks_set_updated_at on public.production_tasks;
create trigger production_tasks_set_updated_at before update on public.production_tasks
for each row execute function public.set_growth_updated_at();
drop trigger if exists customer_reviews_set_updated_at on public.customer_reviews;
create trigger customer_reviews_set_updated_at before update on public.customer_reviews
for each row execute function public.set_growth_updated_at();
drop trigger if exists case_permissions_set_updated_at on public.case_permissions;
create trigger case_permissions_set_updated_at before update on public.case_permissions
for each row execute function public.set_growth_updated_at();
drop trigger if exists referral_codes_set_updated_at on public.referral_codes;
create trigger referral_codes_set_updated_at before update on public.referral_codes
for each row execute function public.set_growth_updated_at();

alter table public.order_reviews enable row level security;
alter table public.production_tasks enable row level security;
alter table public.customer_reviews enable row level security;
alter table public.case_permissions enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referral_attributions enable row level security;
alter table public.reminder_logs enable row level security;

drop policy if exists "owners can read own order reviews" on public.order_reviews;
create policy "owners can read own order reviews" on public.order_reviews for select to authenticated
using ((select auth.uid()) = owner_id);
drop policy if exists "owners can respond to own order reviews" on public.order_reviews;
create policy "owners can respond to own order reviews" on public.order_reviews for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "owners can read own customer reviews" on public.customer_reviews;
create policy "owners can read own customer reviews" on public.customer_reviews for select to authenticated
using ((select auth.uid()) = owner_id);
drop policy if exists "owners can create own customer reviews" on public.customer_reviews;
create policy "owners can create own customer reviews" on public.customer_reviews for insert to authenticated
with check ((select auth.uid()) = owner_id and exists (
  select 1 from public.orders where orders.id = customer_reviews.order_id and orders.owner_id = (select auth.uid())
));
drop policy if exists "owners can update own customer reviews" on public.customer_reviews;
create policy "owners can update own customer reviews" on public.customer_reviews for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "owners can read own case permissions" on public.case_permissions;
create policy "owners can read own case permissions" on public.case_permissions for select to authenticated
using ((select auth.uid()) = owner_id);
drop policy if exists "owners can create own case permissions" on public.case_permissions;
create policy "owners can create own case permissions" on public.case_permissions for insert to authenticated
with check ((select auth.uid()) = owner_id and exists (
  select 1 from public.orders where orders.id = case_permissions.order_id and orders.owner_id = (select auth.uid())
));
drop policy if exists "owners can update own case permissions" on public.case_permissions;
create policy "owners can update own case permissions" on public.case_permissions for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "owners can read own referral codes" on public.referral_codes;
create policy "owners can read own referral codes" on public.referral_codes for select to authenticated
using ((select auth.uid()) = owner_id);
drop policy if exists "owners can create own referral codes" on public.referral_codes;
create policy "owners can create own referral codes" on public.referral_codes for insert to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "owners can read own referral attributions" on public.referral_attributions;
create policy "owners can read own referral attributions" on public.referral_attributions for select to authenticated
using (exists (
  select 1 from public.referral_codes where referral_codes.id = referral_attributions.referral_code_id and referral_codes.owner_id = (select auth.uid())
));

revoke all on public.order_reviews, public.production_tasks, public.customer_reviews, public.case_permissions, public.referral_codes, public.referral_attributions, public.reminder_logs from anon;
grant select, update on public.order_reviews to authenticated;
grant select, insert, update on public.customer_reviews to authenticated;
grant select, insert, update on public.case_permissions to authenticated;
grant select, insert on public.referral_codes to authenticated;
grant select on public.referral_attributions to authenticated;
-- production_tasks 与 reminder_logs 只允许后台 service_role 读写。

create or replace function public.increment_referral_click(target_code_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.referral_codes set click_count = click_count + 1 where id = target_code_id and status = 'active';
$$;
create or replace function public.increment_referral_paid_order(target_code_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.referral_codes set paid_order_count = paid_order_count + 1 where id = target_code_id and status = 'active';
$$;
revoke all on function public.increment_referral_click(uuid) from public, anon, authenticated;
revoke all on function public.increment_referral_paid_order(uuid) from public, anon, authenticated;
grant execute on function public.increment_referral_click(uuid) to service_role;
grant execute on function public.increment_referral_paid_order(uuid) to service_role;
create unique index if not exists referral_attributions_code_session_unique
  on public.referral_attributions(referral_code_id, session_id);

-- M6 writes are validated by server APIs; authenticated clients receive read-only access.
revoke insert, update, delete on public.order_reviews from authenticated;
revoke insert, update, delete on public.customer_reviews from authenticated;
revoke insert, update, delete on public.case_permissions from authenticated;
revoke insert, update, delete on public.referral_codes from authenticated;
grant select on public.order_reviews, public.customer_reviews, public.case_permissions, public.referral_codes, public.referral_attributions to authenticated;

-- Cron can be delivered more than once; claim each daily reminder with a unique key before sending.
alter table public.reminder_logs add column if not exists dedupe_key text unique;
alter table public.reminder_logs drop constraint if exists reminder_logs_status_check;
alter table public.reminder_logs add constraint reminder_logs_status_check
  check (status in ('processing','sent','failed','skipped'));
-- 拾光 v0.7：人工付款凭证、私有凭证存储与管理员审核
-- 已运行 v0.6 schema 的项目只需执行本迁移。

alter table public.orders add column if not exists payment_review_status text not null default 'not_submitted'
  check (payment_review_status in ('not_submitted','submitted','reviewing','approved','rejected'));

create index if not exists orders_payment_review_status_idx
  on public.orders(payment_review_status, created_at desc);

create table if not exists public.manual_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  payment_channel text not null check (payment_channel in ('wechat','alipay','other')),
  amount integer not null check (amount > 0),
  transaction_reference text not null check (char_length(transaction_reference) between 6 and 100),
  proof_path text not null,
  paid_at timestamptz not null,
  review_status text not null default 'submitted' check (review_status in ('submitted','reviewing','approved','rejected')),
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists manual_payment_reference_unique_idx
  on public.manual_payment_proofs(transaction_reference);
create index if not exists manual_payment_review_queue_idx
  on public.manual_payment_proofs(review_status, created_at desc);
create index if not exists manual_payment_owner_created_idx
  on public.manual_payment_proofs(owner_id, created_at desc);

create or replace function public.set_manual_payment_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists manual_payment_proofs_set_updated_at on public.manual_payment_proofs;
create trigger manual_payment_proofs_set_updated_at
before update on public.manual_payment_proofs
for each row execute function public.set_manual_payment_updated_at();

alter table public.manual_payment_proofs enable row level security;

drop policy if exists "owners can read own manual payment proofs" on public.manual_payment_proofs;
create policy "owners can read own manual payment proofs"
on public.manual_payment_proofs for select to authenticated
using ((select auth.uid()) = owner_id and exists (
  select 1 from public.orders
  where orders.id = manual_payment_proofs.order_id
    and orders.owner_id = (select auth.uid())
));

-- 写入、更新和审核全部经过服务端 API，客户端仅可读取自己的审核状态。
revoke all on public.manual_payment_proofs from anon, authenticated;
grant select on public.manual_payment_proofs to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  6291456,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- payment-proofs 不开放浏览器直传或直读策略；仅 service_role 上传并签发短时预览地址。

create or replace function public.approve_manual_payment(
  target_proof_id uuid,
  target_order_id uuid,
  target_reviewer_id uuid,
  target_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  proof_row public.manual_payment_proofs%rowtype;
  order_row public.orders%rowtype;
  was_changed boolean;
begin
  select * into proof_row from public.manual_payment_proofs
  where id = target_proof_id and order_id = target_order_id for update;
  if not found then raise exception 'manual payment proof not found'; end if;

  select * into order_row from public.orders where id = target_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if order_row.payment_provider <> 'manual' then raise exception 'order is not a manual payment order'; end if;
  if proof_row.amount <> order_row.amount then raise exception 'proof amount does not match order amount'; end if;
  if order_row.status in ('cancelled','refunded') then raise exception 'order cannot be paid in current status'; end if;

  was_changed := not (proof_row.review_status = 'approved' and order_row.status in ('paid','in_progress','fulfilled'));

  update public.manual_payment_proofs
  set review_status = 'approved', reviewer_id = target_reviewer_id,
      reviewed_at = coalesce(reviewed_at, now()),
      review_note = coalesce(nullif(target_review_note, ''), '已核对真实到账、金额与交易单号')
  where id = target_proof_id;

  update public.orders
  set status = case when status in ('in_progress','fulfilled') then status else 'paid' end,
      paid_at = coalesce(paid_at, now()),
      payment_session_id = coalesce(payment_session_id, 'manual_' || target_proof_id::text),
      payment_review_status = 'approved'
  where id = target_order_id returning * into order_row;

  if was_changed then
    insert into public.order_events(order_id, event_type, payload)
    values (target_order_id, 'payment.succeeded', jsonb_build_object('provider','manual','proofId',target_proof_id,'transactionReferenceTail',right(proof_row.transaction_reference,6)));
  end if;

  return jsonb_build_object('id',order_row.id,'owner_id',order_row.owner_id,'plan_id',order_row.plan_id,'amount',order_row.amount,'customer_email',order_row.customer_email,'referred_by_code',order_row.referred_by_code,'changed',was_changed);
end;
$$;
revoke all on function public.approve_manual_payment(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.approve_manual_payment(uuid, uuid, uuid, text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('merchant-assets','merchant-assets',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
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
-- 拾光 v0.9：多人秘密共创、自助权益、保存期限、收件人纪念空间与共同管理
-- 已部署 v0.8 的项目只需执行本文件一次。

alter table public.orders
  add column if not exists order_kind text not null default 'base',
  add column if not exists parent_order_id uuid references public.orders(id) on delete set null,
  add column if not exists invite_tier text not null default 'none',
  add column if not exists invite_limit integer not null default 0,
  add column if not exists retention_tier text not null default 'days30',
  add column if not exists retention_expires_at timestamptz,
  add column if not exists entitlement_snapshot jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_kind_check') then
    alter table public.orders add constraint orders_kind_check
      check (order_kind in ('base','upgrade'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_invite_tier_check') then
    alter table public.orders add constraint orders_invite_tier_check
      check (invite_tier in ('none','three','ten','thirty','hundred'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_invite_limit_check') then
    alter table public.orders add constraint orders_invite_limit_check
      check (invite_limit in (0,3,10,30,100));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_retention_tier_check') then
    alter table public.orders add constraint orders_retention_tier_check
      check (retention_tier in ('days30','year1','years3','longterm'));
  end if;
end $$;

create index if not exists orders_parent_order_idx on public.orders(parent_order_id, created_at desc);

alter table public.cards
  add column if not exists retention_expires_at timestamptz,
  add column if not exists recipient_owner_id uuid references auth.users(id) on delete set null,
  add column if not exists primary_manager_id uuid references auth.users(id) on delete set null,
  add column if not exists management_phase text not null default 'creator_managed';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cards_management_phase_check') then
    alter table public.cards add constraint cards_management_phase_check
      check (management_phase in ('creator_managed','co_managed','recipient_managed'));
  end if;
end $$;

create table if not exists public.collaboration_spaces (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  card_id uuid unique references public.cards(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'secret' check (mode in ('secret','wall')),
  invite_tier text not null default 'none' check (invite_tier in ('none','three','ten','thirty','hundred')),
  invite_limit integer not null default 0 check (invite_limit in (0,3,10,30,100)),
  public_token_hash text unique,
  public_token_hint text,
  public_password_hash text,
  submissions_open boolean not null default true,
  allow_existing_edits_after_deadline boolean not null default true,
  contribution_deadline timestamptz,
  locked_at timestamptz,
  recipient_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collaboration_invites (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.collaboration_spaces(id) on delete cascade,
  token_hash text not null unique,
  token_hint text not null,
  invite_type text not null default 'personal' check (invite_type in ('public','personal','recipient_granted')),
  label text,
  expected_name text,
  status text not null default 'active' check (status in ('active','opened','submitted','revoked','expired')),
  deadline_override timestamptz,
  opened_at timestamptz,
  submitted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists collaboration_invites_space_status_idx
  on public.collaboration_invites(space_id, status, created_at desc);

create table if not exists public.collaboration_contributions (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.collaboration_spaces(id) on delete cascade,
  invite_id uuid references public.collaboration_invites(id) on delete set null,
  submitter_user_id uuid references auth.users(id) on delete set null,
  guest_edit_token_hash text,
  display_name text not null check (char_length(display_name) between 1 and 80),
  anonymous_to_recipient boolean not null default false,
  message text not null check (char_length(message) between 2 and 5000),
  media jsonb not null default '[]'::jsonb,
  status text not null default 'submitted' check (status in (
    'submitted','approved','changes_requested','hidden','withdrawal_pending','withdrawn','deleted'
  )),
  sort_order integer not null default 0,
  moderation_note text,
  submitted_at timestamptz not null default now(),
  approved_at timestamptz,
  hidden_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists collaboration_contributions_space_status_idx
  on public.collaboration_contributions(space_id, status, sort_order, created_at);
create index if not exists collaboration_contributions_submitter_idx
  on public.collaboration_contributions(submitter_user_id, created_at desc)
  where submitter_user_id is not null;

create table if not exists public.contribution_versions (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references public.collaboration_contributions(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null check (actor_type in ('guest','participant','owner','admin','system')),
  snapshot jsonb not null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.contribution_withdrawals (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references public.collaboration_contributions(id) on delete cascade,
  requester_user_id uuid references auth.users(id) on delete set null,
  requester_token_hash text,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  temporarily_hidden_at timestamptz not null default now(),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.memory_space_members (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('creator','recipient','co_manager','participant')),
  status text not null default 'active' check (status in ('invited','active','suspended','removed')),
  permissions jsonb not null default '{}'::jsonb,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique(card_id, user_id)
);

create table if not exists public.recipient_entries (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete set null,
  entry_type text not null check (entry_type in ('reply','photo','audio','future_update','memory')),
  content text,
  media jsonb not null default '[]'::jsonb,
  status text not null default 'visible' check (status in ('visible','owner_hidden','deletion_requested','deleted','moderated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.management_requests (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid references auth.users(id) on delete set null,
  request_type text not null check (request_type in (
    'recipient_invite_permission','transfer_primary_manager','permanent_close','permanent_delete','full_export','remove_manager'
  )),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','under_appeal','completed')),
  response_deadline timestamptz not null,
  responded_at timestamptz,
  appeal_reason text,
  appeal_evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references auth.users(id) on delete set null,
  card_id uuid references public.cards(id) on delete cascade,
  contribution_id uuid references public.collaboration_contributions(id) on delete cascade,
  recipient_entry_id uuid references public.recipient_entries(id) on delete cascade,
  category text not null check (category in ('privacy','copyright','harassment','unsafe','illegal','other')),
  detail text,
  status text not null default 'submitted' check (status in ('submitted','reviewing','resolved','rejected')),
  temporary_hidden boolean not null default false,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.set_v09_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


drop trigger if exists collaboration_spaces_set_updated_at on public.collaboration_spaces;
create trigger collaboration_spaces_set_updated_at before update on public.collaboration_spaces
for each row execute function public.set_v09_updated_at();
drop trigger if exists collaboration_invites_set_updated_at on public.collaboration_invites;
create trigger collaboration_invites_set_updated_at before update on public.collaboration_invites
for each row execute function public.set_v09_updated_at();
drop trigger if exists collaboration_contributions_set_updated_at on public.collaboration_contributions;
create trigger collaboration_contributions_set_updated_at before update on public.collaboration_contributions
for each row execute function public.set_v09_updated_at();
drop trigger if exists recipient_entries_set_updated_at on public.recipient_entries;
create trigger recipient_entries_set_updated_at before update on public.recipient_entries
for each row execute function public.set_v09_updated_at();
drop trigger if exists management_requests_set_updated_at on public.management_requests;
create trigger management_requests_set_updated_at before update on public.management_requests
for each row execute function public.set_v09_updated_at();

alter table public.collaboration_spaces enable row level security;
alter table public.collaboration_invites enable row level security;
alter table public.collaboration_contributions enable row level security;
alter table public.contribution_versions enable row level security;
alter table public.contribution_withdrawals enable row level security;
alter table public.memory_space_members enable row level security;
alter table public.recipient_entries enable row level security;
alter table public.management_requests enable row level security;
alter table public.content_reports enable row level security;

create policy "owners read collaboration spaces" on public.collaboration_spaces
for select to authenticated using ((select auth.uid()) = owner_id);
create policy "owners read collaboration invites" on public.collaboration_invites
for select to authenticated using (exists (
  select 1 from public.collaboration_spaces s
  where s.id = collaboration_invites.space_id and s.owner_id = (select auth.uid())
));
create policy "owners and submitters read contributions" on public.collaboration_contributions
for select to authenticated using (
  submitter_user_id = (select auth.uid()) or exists (
    select 1 from public.collaboration_spaces s
    where s.id = collaboration_contributions.space_id and s.owner_id = (select auth.uid())
  )
);
create policy "members read memory spaces" on public.memory_space_members
for select to authenticated using (
  user_id = (select auth.uid()) or exists (
    select 1 from public.cards c where c.id = memory_space_members.card_id
      and (c.owner_id = (select auth.uid()) or c.recipient_owner_id = (select auth.uid()))
  )
);
create policy "members read recipient entries" on public.recipient_entries
for select to authenticated using (exists (
  select 1 from public.cards c where c.id = recipient_entries.card_id
    and (c.owner_id = (select auth.uid()) or c.recipient_owner_id = (select auth.uid()))
));
create policy "participants read management requests" on public.management_requests
for select to authenticated using (
  requester_id = (select auth.uid()) or target_user_id = (select auth.uid()) or exists (
    select 1 from public.cards c where c.id = management_requests.card_id and c.owner_id = (select auth.uid())
  )
);

revoke all on public.collaboration_spaces, public.collaboration_invites,
  public.collaboration_contributions, public.contribution_versions,
  public.contribution_withdrawals, public.memory_space_members,
  public.recipient_entries, public.management_requests, public.content_reports
from anon, authenticated;
grant select on public.collaboration_spaces, public.collaboration_invites,
  public.collaboration_contributions, public.memory_space_members,
  public.recipient_entries, public.management_requests
to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'collaboration-media', 'collaboration-media', false, 52428800,
  array['image/jpeg','image/png','image/webp','image/avif','audio/mpeg','audio/mp4','audio/wav','audio/ogg','video/mp4','video/webm','video/quicktime']
)
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipient-media', 'recipient-media', false, 52428800,
  array['image/jpeg','image/png','image/webp','image/avif','audio/mpeg','audio/mp4','audio/wav','audio/ogg']
)
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- 补差价订单通过后，将目标权益同步到原订单和共创空间。
create or replace function public.approve_manual_payment(
  target_proof_id uuid,
  target_order_id uuid,
  target_reviewer_id uuid,
  target_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  proof_row public.manual_payment_proofs%rowtype;
  order_row public.orders%rowtype;
  base_order_row public.orders%rowtype;
  was_changed boolean;
begin
  select * into proof_row from public.manual_payment_proofs
  where id = target_proof_id and order_id = target_order_id for update;
  if not found then raise exception 'manual payment proof not found'; end if;

  select * into order_row from public.orders where id = target_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if order_row.payment_provider <> 'manual' then raise exception 'order is not a manual payment order'; end if;
  if proof_row.amount <> order_row.amount then raise exception 'proof amount does not match order amount'; end if;
  if order_row.status in ('cancelled','refunded') then raise exception 'order cannot be paid in current status'; end if;

  was_changed := not (proof_row.review_status = 'approved' and order_row.status in ('paid','in_progress','fulfilled'));

  update public.manual_payment_proofs set
    review_status='approved', reviewer_id=target_reviewer_id,
    reviewed_at=coalesce(reviewed_at,now()),
    review_note=coalesce(nullif(target_review_note,''),'已核对真实到账、金额与交易单号')
  where id=target_proof_id;

  update public.orders set
    status=case when status in ('in_progress','fulfilled') then status else 'paid' end,
    paid_at=coalesce(paid_at,now()),
    payment_session_id=coalesce(payment_session_id,'manual_'||target_proof_id::text),
    payment_review_status='approved'
  where id=target_order_id returning * into order_row;

  if order_row.order_kind = 'upgrade' and order_row.parent_order_id is not null then
    update public.orders set
      invite_tier=order_row.invite_tier,
      invite_limit=order_row.invite_limit,
      retention_tier=order_row.retention_tier,
      retention_expires_at=order_row.retention_expires_at,
      entitlement_snapshot=order_row.entitlement_snapshot
    where id=order_row.parent_order_id returning * into base_order_row;

    update public.collaboration_spaces set
      invite_tier=order_row.invite_tier,
      invite_limit=order_row.invite_limit
    where order_id=order_row.parent_order_id;
  else
    base_order_row := order_row;
  end if;

  if was_changed then
    insert into public.order_events(order_id,event_type,payload) values (
      target_order_id,
      case when order_row.order_kind='upgrade' then 'entitlement.upgrade.paid' else 'payment.succeeded' end,
      jsonb_build_object('provider','manual','proofId',target_proof_id,'transactionReferenceTail',right(proof_row.transaction_reference,6))
    );
  end if;

  return jsonb_build_object(
    'id',order_row.id,'owner_id',order_row.owner_id,'plan_id',order_row.plan_id,
    'amount',order_row.amount,'customer_email',order_row.customer_email,
    'referred_by_code',order_row.referred_by_code,'changed',was_changed,
    'base_order_id',coalesce(order_row.parent_order_id,order_row.id)
  );
end;
$$;

revoke all on function public.approve_manual_payment(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.approve_manual_payment(uuid, uuid, uuid, text) to service_role;
