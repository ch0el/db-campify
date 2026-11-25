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

## Current deployment status

The invitation function is deployed with the Vercel origin as its fallback redirect. Legacy JWT gateway verification is disabled, as declared in `supabase/config.toml`; the handler verifies sessions through Supabase Auth and checks program_admins before sending email or assigning membership. The Duke account is an invitation administrator. The Gmail account belongs to the same existing Duke Baseball Camps program.

Gmail SMTP has been configured, and Supabase previously confirmed sending the Gmail invitation. No passwords are stored in this repository. An existing email may be rejected by the invite API; existing members should use Forgot your password. If membership assignment fails after an email is sent, the function reports that partial failure rather than claiming success.

A live administrator-session test is required to confirm the complete invitation flow. The Vercel hosting access barrier must also be resolved before handing the app to a new client.
