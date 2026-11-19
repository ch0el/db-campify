# Staff invitations and password recovery

## Client experience

An administrator invites staff from Profile → Invite staff. The recipient opens the email, chooses a Campify password, then opens the dashboard. Forgot your password? on the sign-in screen sends a recovery link. Accounts never receive administrator privileges from user-editable metadata.

## Deployment prerequisites

1. Apply `supabase/migrations/202611190003_staff_invitations.sql`.
2. Explicitly add your own existing program membership to `program_admins` using its program UUID and auth user UUID. Do not grant this role to every invited staff member.
3. Configure an approved SMTP provider in Supabase Authentication → Emails → SMTP Settings. The built-in mailer is restricted to project team addresses. Verify your sender domain with your provider; keep SMTP credentials in Supabase, never Vite variables or Git.
4. Set Supabase's Site URL to the production site. Add the exact production `/?account=setup` URL to Redirect URLs (include a repository path if hosting under a subdirectory).
5. Set the Edge Function secret `CAMPIFY_SITE_URL` to that production origin, without a trailing slash. Deploy `supabase/functions/invite-staff`. The function uses Supabase's server-only service role environment variable, verifies the caller's JWT with Auth, and checks `program_admins` before sending anything. The UI never receives the service key.
6. Build/publish the frontend and test using an authorized test recipient. Confirm the invite opens the password setup screen, the new account sees the existing program, and a fresh recovery link permits password changes. Test expired links and an unauthorized caller.

## Current delivery limitations

No live invitation has been sent or live password changed during implementation. SMTP and the final production destination require owner input. Supabase can reject invitation of an already registered email; existing members should use Forgot your password. If email is sent but assigning membership fails, the UI reports the partial failure; an administrator must repair membership rather than repeatedly sending invitations.

The existing ChatGPT Site is owner-private: a client cannot reach an invite callback there until granted hosting access. Use the intended Vercel or other client-accessible production site for handoff.
