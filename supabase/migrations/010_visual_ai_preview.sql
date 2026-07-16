-- 拾光 v1.0：付款前一次 AI 预览草稿
create table if not exists public.ai_preview_drafts (
  id uuid primary key default gen_random_uuid(),
  draft_key text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  input jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  used_count integer not null default 1 check (used_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

create index if not exists ai_preview_drafts_user_id_idx on public.ai_preview_drafts(user_id);
create index if not exists ai_preview_drafts_expires_at_idx on public.ai_preview_drafts(expires_at);

alter table public.ai_preview_drafts enable row level security;

-- 浏览器草稿由服务端 service role 管理；登录用户后续绑定时再通过服务端写入 user_id。
revoke all on public.ai_preview_drafts from anon, authenticated;
