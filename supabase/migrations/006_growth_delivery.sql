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
