# Forms Page Setup — Artista Ent. Questionnaire

The questionnaire lives at `/forms` (file: `forms.html`). It is **not linked from the nav** and has `<meta name="robots" content="noindex,nofollow">`, so it is only reachable by direct URL.

## How submissions get to your email

The form uses **Formspree** — the simplest path for a static site on Vercel. No serverless function, no backend code, no env vars to manage. You sign up once, paste in an endpoint URL, and submissions email to you forever.

### Status: connected

Endpoint is wired to: `https://formspree.io/f/xaqkzjok`

Just commit and push to the Vercel repo — submissions will start flowing to the email you set on the Formspree dashboard.

### First submission

The very first time the form is submitted, Formspree will email you to **confirm** the address. Click the link in that email once; future submissions arrive silently in your inbox.

### Free tier limits

- 50 submissions / month
- All form features (file uploads, autoresponders, spam filter) included
- If you outgrow it, $10/mo bumps you to 1,000 submissions

## Alternative: Vercel Serverless Function (if you ever want it)

If you'd rather not depend on a third party, you can swap the action URL to `/api/submit` and add a serverless function that uses **Resend** (https://resend.com — free 100 emails/day) to send the email. Happy to wire that up if/when you want to switch.

Why I didn't default to it: it requires a Resend account, a `RESEND_API_KEY` env var configured in Vercel, and a verified sending domain. Formspree skips all of that.

## Anti-spam

The form already includes:
- A hidden honeypot field (`_gotcha`) — bots fill it, Formspree filters those out.
- Native browser validation on required fields.
- A custom subject line ("New Artista Ent. Questionnaire Submission").

## URL

After deploy, the form is reachable at:
- `https://your-site.vercel.app/forms`

Since there's no nav link and search engines are told to ignore it, you control who sees it — just share the URL directly with prospects.
