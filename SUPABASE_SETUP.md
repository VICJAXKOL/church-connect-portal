# Supabase Setup: Bypass "Email Confirmation Required" and "Email Logins are Disabled"

To fix the **"Email Confirmation Required"** or **"Email logins are disabled"** errors on your live application (such as Vercel) and bypass email verification / signUp rate limits, follow the setup instructions below.

Name-based login translates worker names into pseudo-emails (`victor.thompson.gcccigando@gmail.com`) under the hood, meaning the **Email Auth Provider must be enabled** in your Supabase dashboard, but email confirmation itself can be disabled.

---

## Quick Fix for "Email logins are disabled"

If you see this error on screen, it means the Email Provider is completely disabled in your Supabase project. To turn it on:

1. Open your **[Supabase Dashboard](https://supabase.com/dashboard)**.
2. Select your project **`church-connect-portal`**.
3. In the left-hand sidebar, click **Authentication** (the key icon).
4. Select **Providers** under the settings column.
5. Expand the **Email** provider accordion.
6. Toggle **"Enable Email provider"** to **ON**.
7. Toggle **"Confirm email"** to **OFF** (this bypasses SMTP/email confirmation).
8. Scroll to the bottom and click **Save**.

---

## Method 1: Apply SQL Bypass Function (Highly Recommended)

Running this SQL query creates a secure registrar function inside your database that automatically bypasses Supabase auth limits and confirmation queues for your follow-up workers.

### Step 1: Copy the SQL Script Below

```sql
-- This bypasses standard Supabase signUp rate-limiting (429) and email verification checks (400)
-- by inserting directly into auth.users and auth.identities with pre-confirmed statuses.
create or replace function public.register_worker(
  p_email text,
  p_password text,
  p_full_name text
) returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
begin
  -- Check if user already exists
  select id into v_user_id from auth.users where email = p_email;
  if v_user_id is not null then
    raise exception 'A user with this name already exists.';
  end if;

  v_user_id := gen_random_uuid();

  -- Insert into auth.users
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    is_super_admin,
    phone,
    phone_confirmed_at,
    email_change,
    email_change_token_new,
    recovery_sent_at
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name),
    now(),
    now(),
    '',
    '',
    false,
    null,
    null,
    '',
    '',
    null
  );

  -- Insert into auth.identities
  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at,
    provider_id
  ) values (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id, 'email', p_email, 'email_verified', true, 'phone_verified', false),
    'email',
    now(),
    now(),
    now(),
    v_user_id::text
  );

  return v_user_id;
end;
$$;

grant execute on function public.register_worker(text, text, text) to anon, authenticated;
```

### Step 2: Run it in Supabase

1. Go to your **[Supabase Dashboard](https://supabase.com/dashboard)**.
2. Select your project **`church-connect-portal`**.
3. In the left-hand sidebar, click on **SQL Editor** (the `>_` icon).
4. Click **New Query** (or use an existing one).
5. **Paste** the SQL script above into the editor.
6. Click the green **Run** button at the top right.

Once executed, any new worker who signs up will be registered as **pre-confirmed** automatically. They will be able to sign in instantly!

---

## Method 2: Turn OFF "Confirm email" in Supabase

If you prefer to disable the email confirmation requirement for standard signups entirely:

1. Open your **[Supabase Dashboard](https://supabase.com/dashboard)**.
2. Click on **Authentication** in the left sidebar (the key icon).
3. Under the settings menu on the left, click **Providers** under the Auth column.
4. Expand the **Email** provider accordion.
5. Find the **"Confirm email"** switch and toggle it to **OFF**.
6. Scroll down and click **Save**.

*Note: If you have already attempted a signup that failed with "Email not confirmed", go to **Authentication > Users** in the sidebar, find that user (e.g. `bola ahmed` or `Victor Thompson`), click the `...` menu next to them, and select **Delete User** so they can sign up fresh without errors.*
