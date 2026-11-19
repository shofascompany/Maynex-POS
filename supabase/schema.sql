-- =============================================================================
-- Maynex POS: multi-business database setup
--
-- Run this whole file once on a NEW Supabase project:
--   Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- It is safe to run again (nothing is dropped or duplicated).
--
-- After it finishes:
--   1. Project Settings -> API: copy the Project URL and the anon/publishable key
--      into .env as VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).
--   2. Authentication -> Sign In / Providers -> Email: for instant sign-up, turn
--      "Confirm email" off. (If you keep it on, owners must click the email link
--      before their first sign-in.)
--   3. Create YOUR platform-admin login:
--        Authentication -> Users -> Add user (email + strong password), then run:
--        insert into public.platform_admins (user_id)
--          select id from auth.users where email = 'you@yourcompany.com'
--          on conflict do nothing;
--      Then open  https://<your-site>/admin2026  and sign in with that account.
--
-- Security model
--   * Every shop (business) is isolated by row level security on business_id.
--   * A shop's login can read and write only its own rows, and cannot write at all
--     while the business is suspended.
--   * Platform admins (listed in platform_admins) can read and change everything.
--   * The anon key alone can read only the public platform notice and sign-up flag.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Platform
-- ---------------------------------------------------------------------------
create table if not exists public.platform_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.platform_settings (
  id                 text primary key default 'main' check (id = 'main'),
  allow_signups      boolean not null default true,
  announcement       text not null default '',
  announcement_tone  text not null default 'info' check (announcement_tone in ('info', 'success', 'warning', 'danger')),
  updated_at         timestamptz not null default now()
);
insert into public.platform_settings (id) values ('main') on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Businesses (one per shop owner account)
-- ---------------------------------------------------------------------------
create table if not exists public.businesses (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(name) between 1 and 80),
  business_type     text,
  country           text,
  city              text,
  currency          text not null default 'USD',
  phone             text,
  owner_id          uuid not null references auth.users (id) on delete cascade,
  status            text not null default 'active' check (status in ('active', 'suspended')),
  suspended_reason  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists businesses_owner_idx on public.businesses (owner_id);

create table if not exists public.business_members (
  business_id  uuid not null references public.businesses (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'owner',
  created_at   timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index if not exists business_members_user_idx on public.business_members (user_id);

-- ---------------------------------------------------------------------------
-- Helpers used by the policies (SECURITY DEFINER avoids recursive policies)
-- ---------------------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.is_member(bid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.business_members where business_id = bid and user_id = auth.uid());
$$;

create or replace function public.can_write(bid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.business_members m
    join public.businesses b on b.id = m.business_id
    where m.business_id = bid and m.user_id = auth.uid() and b.status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- Shop data. Every row carries business_id; ids are generated by the app.
-- ---------------------------------------------------------------------------
create table if not exists public.business_settings (
  business_id  uuid primary key references public.businesses (id) on delete cascade,
  data         jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

create table if not exists public.categories (
  id           text primary key,
  business_id  uuid not null references public.businesses (id) on delete cascade,
  name         text not null,
  icon         text,
  color        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.products (
  id           text primary key,
  business_id  uuid not null references public.businesses (id) on delete cascade,
  name         text not null,
  category_id  text references public.categories (id) on delete set null,
  price        numeric(14, 2) not null default 0,
  cost         numeric(14, 2) not null default 0,
  icon         text,
  track_stock  boolean not null default true,
  barcode      text,
  sku          text,
  stock        integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.customers (
  id           text primary key,
  business_id  uuid not null references public.businesses (id) on delete cascade,
  name         text not null,
  phone        text,
  email        text,
  notes        text,
  points       integer not null default 0,
  total_spent  numeric(14, 2) not null default 0,
  visits       integer not null default 0,
  last_visit   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Staff sign in on the shop's devices with their username + 4-digit PIN; roles decide what they see.
-- `owner` marks the manager profile of the person who created the business (used by the email sign-in).
create table if not exists public.staff (
  id           text primary key,
  business_id  uuid not null references public.businesses (id) on delete cascade,
  name         text not null,
  username     text,
  role         text not null check (role in ('manager', 'supervisor', 'cashier', 'procurement', 'accountant', 'support')),
  pin          text not null check (pin ~ '^[0-9]{4}$'),
  color        text,
  owner        boolean not null default false,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.staff add column if not exists username text;
alter table public.staff add column if not exists owner boolean not null default false;
create unique index if not exists staff_username_idx on public.staff (business_id, lower(username));

create table if not exists public.shifts (
  id             text primary key,
  business_id    uuid not null references public.businesses (id) on delete cascade,
  staff_id       text,
  closed_by      text,
  opened_at      timestamptz not null,
  closed_at      timestamptz,
  opening_float  numeric(14, 2) not null default 0,
  movements      jsonb not null default '[]'::jsonb,
  note           text,
  expected       numeric(14, 2),
  counted        numeric(14, 2),
  difference     numeric(14, 2),
  updated_at     timestamptz not null default now()
);

-- Order lines and payments are JSON snapshots, so a receipt never changes later.
create table if not exists public.orders (
  id               text primary key,
  business_id      uuid not null references public.businesses (id) on delete cascade,
  number           integer not null,
  created_at       timestamptz not null,
  items            jsonb not null default '[]'::jsonb,
  subtotal         numeric(14, 2) not null default 0,
  discount         numeric(14, 2) not null default 0,
  tax              numeric(14, 2) not null default 0,
  total            numeric(14, 2) not null default 0,
  tax_rate         numeric(7, 3),
  tax_inclusive    boolean not null default false,
  payments         jsonb not null default '[]'::jsonb,
  change           numeric(14, 2) not null default 0,
  customer_id      text,
  staff_id         text,
  shift_id         text,
  status           text not null default 'completed' check (status in ('completed', 'refunded')),
  note             text,
  points_earned    integer not null default 0,
  points_redeemed  integer not null default 0,
  refunded_at      timestamptz,
  refund_reason    text,
  refunded_by      text,
  refund_shift_id  text,
  restocked        boolean,
  updated_at       timestamptz not null default now()
);

create table if not exists public.held_sales (
  id           text primary key,
  business_id  uuid not null references public.businesses (id) on delete cascade,
  label        text,
  cart         jsonb not null default '{}'::jsonb,
  total        numeric(14, 2) not null default 0,
  count        integer not null default 0,
  staff_id     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists categories_business_idx on public.categories (business_id);
create index if not exists products_business_idx   on public.products (business_id);
create index if not exists customers_business_idx  on public.customers (business_id);
create index if not exists staff_business_idx      on public.staff (business_id);
create index if not exists shifts_business_idx     on public.shifts (business_id, opened_at desc);
create index if not exists orders_business_idx     on public.orders (business_id, created_at desc);
create index if not exists held_business_idx       on public.held_sales (business_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.maynex_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security, triggers and realtime for every shop table
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'business_settings', 'categories', 'products', 'customers', 'staff', 'shifts', 'orders', 'held_sales'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Members read" on public.%I', t);
    execute format('drop policy if exists "Members insert" on public.%I', t);
    execute format('drop policy if exists "Members update" on public.%I', t);
    execute format('drop policy if exists "Members delete" on public.%I', t);
    execute format('create policy "Members read" on public.%I for select to authenticated using (public.is_member(business_id) or public.is_platform_admin())', t);
    execute format('create policy "Members insert" on public.%I for insert to authenticated with check (public.can_write(business_id))', t);
    execute format('create policy "Members update" on public.%I for update to authenticated using (public.can_write(business_id)) with check (public.can_write(business_id))', t);
    execute format('create policy "Members delete" on public.%I for delete to authenticated using (public.can_write(business_id))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);

    execute format('drop trigger if exists touch_updated_at on public.%I', t);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.maynex_touch_updated_at()', t);

    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- businesses: members read their own; only platform admins change status or delete.
alter table public.businesses enable row level security;
drop policy if exists "Members read business" on public.businesses;
drop policy if exists "Admins update business" on public.businesses;
drop policy if exists "Admins delete business" on public.businesses;
create policy "Members read business" on public.businesses for select to authenticated using (public.is_member(id) or public.is_platform_admin());
create policy "Admins update business" on public.businesses for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "Admins delete business" on public.businesses for delete to authenticated using (public.is_platform_admin());
grant select, update, delete on public.businesses to authenticated;
revoke all on public.businesses from anon;
drop trigger if exists touch_updated_at on public.businesses;
create trigger touch_updated_at before update on public.businesses for each row execute function public.maynex_touch_updated_at();

alter table public.business_members enable row level security;
drop policy if exists "Read own membership" on public.business_members;
create policy "Read own membership" on public.business_members for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());
grant select on public.business_members to authenticated;
revoke all on public.business_members from anon;

alter table public.platform_admins enable row level security;
drop policy if exists "Admins read admins" on public.platform_admins;
create policy "Admins read admins" on public.platform_admins for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());
grant select on public.platform_admins to authenticated;
revoke all on public.platform_admins from anon;

alter table public.platform_settings enable row level security;
drop policy if exists "Anyone reads platform settings" on public.platform_settings;
drop policy if exists "Admins update platform settings" on public.platform_settings;
create policy "Anyone reads platform settings" on public.platform_settings for select to anon, authenticated using (true);
create policy "Admins update platform settings" on public.platform_settings for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
grant select on public.platform_settings to anon, authenticated;
grant update on public.platform_settings to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'businesses') then
    alter publication supabase_realtime add table public.businesses;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'platform_settings') then
    alter publication supabase_realtime add table public.platform_settings;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Shop owner functions
-- ---------------------------------------------------------------------------

-- Sign-up: creates the business, makes the caller its owner, stores the first settings.
create or replace function public.create_business(p jsonb)
returns public.businesses
language plpgsql security definer set search_path = public as $$
declare
  b public.businesses;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  -- staff browser sessions are anonymous logins: they can never create a business
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then raise exception 'Create an owner account to start a business.'; end if;
  if not (select allow_signups from public.platform_settings where id = 'main') then
    raise exception 'New sign-ups are closed right now. Please try again later.';
  end if;
  if exists (select 1 from public.business_members where user_id = auth.uid()) then
    raise exception 'This account already has a business. Sign in instead.';
  end if;
  insert into public.businesses (name, business_type, country, city, currency, phone, owner_id)
  values (
    trim(p ->> 'name'), nullif(trim(p ->> 'business_type'), ''), nullif(trim(p ->> 'country'), ''),
    nullif(trim(p ->> 'city'), ''), coalesce(nullif(p ->> 'currency', ''), 'USD'), nullif(trim(p ->> 'phone'), ''),
    auth.uid()
  )
  returning * into b;
  insert into public.business_members (business_id, user_id, role) values (b.id, auth.uid(), 'owner');
  insert into public.business_settings (business_id, data) values (b.id, coalesce(p -> 'settings', '{}'::jsonb));
  return b;
end;
$$;

-- Keeps the business directory in step with the profile edited in Settings.
create or replace function public.update_business_profile(bid uuid, p jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_write(bid) then raise exception 'Not allowed'; end if;
  update public.businesses set
    name          = coalesce(nullif(trim(p ->> 'name'), ''), name),
    phone         = coalesce(p ->> 'phone', phone),
    city          = coalesce(p ->> 'city', city),
    country       = coalesce(p ->> 'country', country),
    business_type = coalesce(p ->> 'business_type', business_type),
    currency      = coalesce(nullif(p ->> 'currency', ''), currency)
  where id = bid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Platform admin functions (each one checks is_platform_admin first)
-- ---------------------------------------------------------------------------
create or replace function public.admin_overview()
returns table (
  id uuid, name text, business_type text, country text, city text, currency text, phone text,
  status text, suspended_reason text, created_at timestamptz, owner_email text,
  staff_count bigint, product_count bigint, customer_count bigint,
  order_count bigint, revenue numeric, last_order_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'Platform admins only'; end if;
  return query
  select b.id, b.name, b.business_type, b.country, b.city, b.currency, b.phone,
         b.status, b.suspended_reason, b.created_at, u.email::text,
         (select count(*) from public.staff s where s.business_id = b.id),
         (select count(*) from public.products p where p.business_id = b.id),
         (select count(*) from public.customers c where c.business_id = b.id),
         (select count(*) from public.orders o where o.business_id = b.id and o.status = 'completed'),
         (select coalesce(sum(o.total), 0) from public.orders o where o.business_id = b.id and o.status = 'completed'),
         (select max(o.created_at) from public.orders o where o.business_id = b.id)
  from public.businesses b
  left join auth.users u on u.id = b.owner_id
  order by b.created_at desc;
end;
$$;

create or replace function public.admin_list_admins()
returns table (user_id uuid, email text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'Platform admins only'; end if;
  return query select a.user_id, u.email::text, a.created_at
  from public.platform_admins a join auth.users u on u.id = a.user_id order by a.created_at;
end;
$$;

create or replace function public.admin_add_admin(target_email text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
begin
  if not public.is_platform_admin() then raise exception 'Platform admins only'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(target_email));
  if uid is null then raise exception 'No account uses that email. Create the user in Supabase first.'; end if;
  insert into public.platform_admins (user_id) values (uid) on conflict do nothing;
end;
$$;

create or replace function public.admin_remove_admin(target uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'Platform admins only'; end if;
  if (select count(*) from public.platform_admins) <= 1 then raise exception 'Keep at least one platform admin'; end if;
  delete from public.platform_admins where user_id = target;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff sign-in from any browser
--
-- Each shop gets a short shop code. A team member opens the site in any browser and
-- signs in with the shop code + their username + PIN. The browser gets an anonymous
-- Supabase login, and staff_sign_in() checks the PIN on the server and makes that
-- login a 'staff' member of the shop. Wrong PINs lock that username for a while.
--
-- REQUIRED once in the dashboard: Authentication -> Sign In / Providers ->
-- "Allow anonymous sign-ins" = ON. (Anonymous logins can't do anything until
-- staff_sign_in() accepts a correct PIN, and can never create a business.)
-- ---------------------------------------------------------------------------
create or replace function public.maynex_new_code()
returns text language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O or 1/I
  c text;
begin
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.businesses where code = c);
  end loop;
  return c;
end;
$$;

alter table public.businesses add column if not exists code text;
update public.businesses set code = public.maynex_new_code() where code is null;
alter table public.businesses alter column code set default public.maynex_new_code();
create unique index if not exists businesses_code_idx on public.businesses (code);

create table if not exists public.staff_login_attempts (
  business_id   uuid not null references public.businesses (id) on delete cascade,
  username      text not null,
  fails         integer not null default 0,
  level         integer not null default 0,
  locked_until  timestamptz,
  primary key (business_id, username)
);
alter table public.staff_login_attempts enable row level security;
revoke all on public.staff_login_attempts from anon, authenticated;

-- Returns { ok, staff_id } or { ok: false, message }. It returns instead of raising so a
-- wrong PIN is still counted (an exception would roll the counter back).
create or replace function public.staff_sign_in(p_code text, p_username text, p_pin text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b      public.businesses;
  s      public.staff;
  att    public.staff_login_attempts;
  uname  text := lower(trim(coalesce(p_username, '')));
  wait   integer;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'message', 'Sign-in session missing. Reload and try again.'); end if;
  select * into b from public.businesses where code = upper(trim(coalesce(p_code, '')));
  if not found then return jsonb_build_object('ok', false, 'message', 'No shop uses that code. Check it with your manager.'); end if;

  select * into att from public.staff_login_attempts where business_id = b.id and username = uname;
  if att.locked_until is not null and att.locked_until > now() then
    wait := ceil(extract(epoch from att.locked_until - now()) / 60.0);
    return jsonb_build_object('ok', false, 'message', format('Too many wrong PINs. Try again in %s minute%s.', wait, case when wait = 1 then '' else 's' end));
  end if;

  select * into s from public.staff
   where business_id = b.id and lower(username) = uname and active and pin = coalesce(p_pin, '');
  if not found then
    insert into public.staff_login_attempts (business_id, username, fails) values (b.id, uname, 1)
    on conflict (business_id, username) do update set fails = staff_login_attempts.fails + 1;
    -- 5 wrong tries: lock for 1, 2, 4, 8… minutes
    update public.staff_login_attempts
       set level = level + 1, fails = 0, locked_until = now() + make_interval(mins => power(2, level)::int)
     where business_id = b.id and username = uname and fails >= 5;
    return jsonb_build_object('ok', false, 'message', 'That username and PIN don’t match.');
  end if;

  delete from public.staff_login_attempts where business_id = b.id and username = uname;
  -- an owner login keeps its own business; staff browser logins belong to one shop at a time
  if exists (select 1 from public.business_members where user_id = auth.uid() and role <> 'staff') then
    return jsonb_build_object('ok', false, 'message', 'This browser is signed in to an owner account. Sign it out first.');
  end if;
  delete from public.business_members where user_id = auth.uid() and business_id <> b.id;
  insert into public.business_members (business_id, user_id, role) values (b.id, auth.uid(), 'staff')
  on conflict (business_id, user_id) do nothing;
  return jsonb_build_object('ok', true, 'staff_id', s.id);
end;
$$;

grant execute on function public.staff_sign_in(text, text, text) to authenticated;
revoke execute on function public.staff_sign_in(text, text, text) from anon, public;
revoke execute on function public.maynex_new_code() from anon, authenticated, public;

grant execute on function public.create_business(jsonb) to authenticated;
grant execute on function public.update_business_profile(uuid, jsonb) to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_list_admins() to authenticated;
grant execute on function public.admin_add_admin(text) to authenticated;
grant execute on function public.admin_remove_admin(uuid) to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
revoke execute on function public.create_business(jsonb) from anon;
revoke execute on function public.admin_overview() from anon;
revoke execute on function public.admin_list_admins() from anon;
revoke execute on function public.admin_add_admin(text) from anon;
revoke execute on function public.admin_remove_admin(uuid) from anon;
