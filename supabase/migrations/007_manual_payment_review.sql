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
  select * into proof_row
  from public.manual_payment_proofs
  where id = target_proof_id and order_id = target_order_id
  for update;

  if not found then
    raise exception 'manual payment proof not found';
  end if;

  select * into order_row
  from public.orders
  where id = target_order_id
  for update;

  if not found then
    raise exception 'order not found';
  end if;
  if order_row.payment_provider <> 'manual' then
    raise exception 'order is not a manual payment order';
  end if;
  if proof_row.amount <> order_row.amount then
    raise exception 'proof amount does not match order amount';
  end if;
  if order_row.status in ('cancelled','refunded') then
    raise exception 'order cannot be paid in current status';
  end if;

  was_changed := not (
    proof_row.review_status = 'approved'
    and order_row.status in ('paid','in_progress','fulfilled')
  );

  update public.manual_payment_proofs
  set review_status = 'approved',
      reviewer_id = target_reviewer_id,
      reviewed_at = coalesce(reviewed_at, now()),
      review_note = coalesce(nullif(target_review_note, ''), '已核对真实到账、金额与交易单号')
  where id = target_proof_id;

  update public.orders
  set status = case
        when status in ('in_progress','fulfilled') then status
        else 'paid'
      end,
      paid_at = coalesce(paid_at, now()),
      payment_session_id = coalesce(payment_session_id, 'manual_' || target_proof_id::text),
      payment_review_status = 'approved'
  where id = target_order_id
  returning * into order_row;

  if was_changed then
    insert into public.order_events(order_id, event_type, payload)
    values (
      target_order_id,
      'payment.succeeded',
      jsonb_build_object(
        'provider', 'manual',
        'proofId', target_proof_id,
        'transactionReferenceTail', right(proof_row.transaction_reference, 6)
      )
    );
  end if;

  return jsonb_build_object(
    'id', order_row.id,
    'owner_id', order_row.owner_id,
    'plan_id', order_row.plan_id,
    'amount', order_row.amount,
    'customer_email', order_row.customer_email,
    'referred_by_code', order_row.referred_by_code,
    'changed', was_changed
  );
end;
$$;

revoke all on function public.approve_manual_payment(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.approve_manual_payment(uuid, uuid, uuid, text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'merchant-assets',
  'merchant-assets',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 商户收款码由 Supabase Dashboard 或 service_role 管理，不授予浏览器直接读取权限。
