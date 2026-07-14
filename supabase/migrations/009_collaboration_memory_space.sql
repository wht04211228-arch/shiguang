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
