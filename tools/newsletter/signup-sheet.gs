/* Newsletter signups -> Google Sheet (temporary, until an email tool takes over).

   The site's newsletter forms (js/main.js, [data-subscribe]) POST
   email, page and form here; each signup becomes a row in the sheet this
   script is attached to. An address already on the list is not added twice.

   Set up (once), in the sheet "MatchPlay newsletter signups":
     1. Extensions -> Apps Script. Replace the editor's contents with this file. Save.
     2. Deploy -> New deployment -> type "Web app".
          Execute as:     Me
          Who has access: Anyone
        Deploy, and allow the access Google asks for (it only needs this sheet).
     3. Copy the Web app URL (https://script.google.com/macros/s/.../exec) into
        NEWSLETTER_ENDPOINT in js/main.js.
   After editing this script later: Deploy -> Manage deployments -> edit ->
   Version: New version, so the same URL serves the new code. */

const SHEET_NAME = 'Signups';

function doPost(e) {
  const p = (e && e.parameter) || {};
  const email = String(p.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return reply({ ok: false, error: 'invalid email' });
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const last = sheet.getLastRow();
    const known = last > 1 ? sheet.getRange(2, 2, last - 1, 1).getValues().flat()
      .map(function (v) { return String(v).toLowerCase(); }) : [];
    if (known.indexOf(email) < 0) {
      sheet.appendRow([new Date(), email, String(p.page || '').slice(0, 200), String(p.form || '').slice(0, 50)]);
    }
  } finally {
    lock.releaseLock();
  }
  return reply({ ok: true });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
