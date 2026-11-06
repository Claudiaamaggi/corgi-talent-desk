# Corgi Talent Desk

A single-page, Corgi-branded form where people submit a job post. Submissions land in a
Google Sheet owned by `londoncafe@corgi.com`, with an optional email notification per
submission.

No build step, no dependencies — it's three static files plus an Apps Script backend.

```
index.html          the page
assets/styles.css   Corgi styling (light + dark), on the corgi.insure palette
assets/corgi-hiring.{webp,png}  the hiring-corgi illustration
assets/app.js       validation + submission
config.js           ← paste your Apps Script URL here
apps-script/Code.gs the backend: writes the row, sends the notification
```

## Connect the Google Sheet

Do this signed in as **londoncafe@corgi.com**, so that account owns the Sheet.

1. Create a new Google Sheet (`sheets.new`) and name it **Corgi Talent Desk — Submissions**.
2. **Extensions → Apps Script**. Delete the starter code and paste in all of
   `apps-script/Code.gs`.
3. Check the CONFIG block at the top of the file:
   - `SEND_EMAIL_NOTIFICATIONS` — `true` sends an email per submission, `false` silences it.
   - `NOTIFY_TO` — currently `londoncafe@corgi.com`.
4. Save, then **Run → `setup`** once. Approve the permission prompt (it needs to write to
   the Sheet and send mail as you). This creates the `Submissions` tab and its headers.
5. **Deploy → New deployment → Web app**, with:
   - *Execute as*: **Me (londoncafe@corgi.com)**
   - *Who has access*: **Anyone**

   "Anyone" is required — the people filling in the form aren't signed in to Google. They
   can only POST a submission; they get no access to the Sheet.
6. Copy the Web App URL (`https://script.google.com/macros/s/…/exec`) and paste it into
   `config.js` as `ENDPOINT`. Commit and push.

To check it's live, open the Web App URL directly in a browser — it returns
`{"ok":true,"service":"corgi-talent-desk",…}`.

### Re-deploying after a change to Code.gs

Apps Script serves the *deployed* version, not the saved one. After editing, use
**Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy**. That
keeps the same URL, so `config.js` doesn't change.

## Email notifications

The toggle is the first setting in `apps-script/Code.gs`:

```js
var SEND_EMAIL_NOTIFICATIONS = true;
var NOTIFY_TO = 'londoncafe@corgi.com';
```

Each notification carries the full submission, with the submitter's address as `Reply-To`,
so replying goes straight back to them. A notification that fails is logged but never
blocks the submission from being written to the Sheet.

Gmail accounts are capped around 100 recipients/day for `MailApp` (1,500 on Workspace) —
not a practical limit here, but worth knowing.

## Form fields

**About you** — full name\*, email\*, company\*, role at company\*

**The job** — job title\*, job description\* (2,000 chars, with a live counter), location,
work type (On-site / Hybrid / Remote), employment type (Full-time / Part-time / Contract /
Internship), salary range, application link\* (must be a valid URL), application deadline

**Consent\*** — "I confirm this role is real and I'm happy for Corgi to share it."

\* required. Required fields and the 2,000-character cap are enforced both in the browser
and again in `Code.gs`, so a crafted POST can't bypass them.

## Running it locally

Any static server works, e.g. `python3 -m http.server 8080`, then open
<http://localhost:8080>. With `config.js` still holding the placeholder URL, the page shows
a "not connected" banner and refuses to send — the rest of the form is fully testable.

## Hosting

- **GitHub Pages** — serves `main` from the repo root.
- **Vercel** — static, no build command.

Both read the same `config.js`, so updating the endpoint is one commit.
