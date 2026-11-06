/**
 * Corgi Talent Desk — submission backend.
 *
 * Deploy this from the londoncafe@corgi.com account so the Google Sheet
 * is owned by that account. Setup steps are in the repo README.
 *
 * @OnlyCurrentDoc
 *
 * That annotation, plus the absence of any open-by-ID call, holds the Sheets
 * grant down to spreadsheets.currentonly — this one bound Sheet — instead of
 * "all your spreadsheets". Do not reintroduce one without understanding
 * that it widens the OAuth scope for the whole account.
 */

// ─────────────────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────────────────

/** Email a notification to NOTIFY_TO on every new submission. Flip to false to silence. */
var SEND_EMAIL_NOTIFICATIONS = true;

/** Where notifications go. */
var NOTIFY_TO = 'londoncafe@corgi.com';

/** Tab the submissions are written to. Created automatically if missing. */
var SHEET_NAME = 'Submissions';

// ─────────────────────────────────────────────────────────────

var HEADERS = [
  'Timestamp',
  'Full name',
  'Email',
  'Company',
  'Role at company',
  'Job title',
  'Job description',
  'Location',
  'Work type',
  'Employment type',
  'Salary range',
  'Application link',
  'Application deadline',
  'Consent given',
  'Submitted from'
];

var REQUIRED = [
  'full_name',
  'email',
  'company',
  'role_at_company',
  'job_title',
  'job_description',
  'application_url'
];

/** Health check — open the Web App URL in a browser to see this. */
function doGet() {
  return json({
    ok: true,
    service: 'corgi-talent-desk',
    notifications: SEND_EMAIL_NOTIFICATIONS ? NOTIFY_TO : 'off'
  });
}

function doPost(e) {
  try {
    var data = parseBody(e);

    var missing = REQUIRED.filter(function (key) {
      return !String(data[key] == null ? '' : data[key]).trim();
    });
    if (missing.length) {
      return json({ ok: false, error: 'Missing required fields: ' + missing.join(', ') });
    }
    if (data.consent !== true && String(data.consent).toLowerCase() !== 'true') {
      return json({ ok: false, error: 'Consent is required.' });
    }
    if (String(data.job_description).length > 2000) {
      return json({ ok: false, error: 'Job description exceeds 2000 characters.' });
    }
    if (!/^https?:\/\/[^\s.]+\.[^\s]+$/.test(String(data.application_url).trim())) {
      return json({ ok: false, error: 'Application link must be a valid URL.' });
    }

    var submittedAt = new Date();
    var row = appendRow_(data, submittedAt);

    if (SEND_EMAIL_NOTIFICATIONS) {
      try {
        notify_(data, submittedAt, row);
      } catch (mailErr) {
        // Never fail a submission because the notification bounced.
        console.error('Notification failed: ' + mailErr);
      }
    }

    return json({ ok: true, row: row });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

// ─────────────────────────────────────────────────────────────
//  internals
// ─────────────────────────────────────────────────────────────

function parseBody(e) {
  if (e && e.postData && e.postData.contents) {
    var raw = e.postData.contents;
    try {
      return JSON.parse(raw);
    } catch (ignore) {
      // fall through to form-encoded parameters
    }
  }
  if (e && e.parameter && Object.keys(e.parameter).length) return e.parameter;
  throw new Error('Empty request body.');
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No spreadsheet — this script must be bound to one (Extensions → Apps Script).');

  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
  }
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setBackground('#ffdecc');
  }
  return sh;
}

function appendRow_(data, submittedAt) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_();
    sh.appendRow([
      submittedAt,
      str(data.full_name),
      str(data.email),
      str(data.company),
      str(data.role_at_company),
      str(data.job_title),
      str(data.job_description),
      str(data.location),
      str(data.work_type),
      str(data.employment_type),
      str(data.salary_range),
      str(data.application_url),
      str(data.deadline),
      'Yes',
      str(data.page_url)
    ]);
    return sh.getLastRow();
  } finally {
    lock.releaseLock();
  }
}

function notify_(data, submittedAt, row) {
  var subject = 'New job post: ' + str(data.job_title) + ' at ' + str(data.company);

  var lines = [
    'A new role was submitted to the Corgi Talent Desk.',
    '',
    'JOB',
    '  Title:            ' + str(data.job_title),
    '  Company:          ' + str(data.company),
    '  Location:         ' + or_(data.location, '—'),
    '  Work type:        ' + or_(data.work_type, '—'),
    '  Employment type:  ' + or_(data.employment_type, '—'),
    '  Salary range:     ' + or_(data.salary_range, '—'),
    '  Deadline:         ' + or_(data.deadline, '—'),
    '  Apply:            ' + str(data.application_url),
    '',
    'SUBMITTED BY',
    '  Name:   ' + str(data.full_name),
    '  Email:  ' + str(data.email),
    '  Role:   ' + str(data.role_at_company),
    '',
    'DESCRIPTION',
    str(data.job_description),
    '',
    '—',
    'Confirmed real and shareable: yes',
    'Received: ' + submittedAt.toUTCString(),
    'Sheet row: ' + row
  ];

  MailApp.sendEmail({
    to: NOTIFY_TO,
    replyTo: str(data.email),
    subject: subject,
    body: lines.join('\n')
  });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function str(v) {
  return v == null ? '' : String(v).trim();
}

function or_(v, fallback) {
  return str(v) || fallback;
}

/** Run once from the editor to create the tab and headers up front. Optional. */
function setup() {
  sheet_();
  console.log('Sheet ready. Notifications: ' + (SEND_EMAIL_NOTIFICATIONS ? NOTIFY_TO : 'off'));
}
