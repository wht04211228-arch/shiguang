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
