/**
 * Software/AI portal mail relay. Sends the portal's notification emails from your own Gmail.
 *
 * Setup (about 5 minutes):
 *  1. Go to script.google.com > New project. Name it "Portal mailer". Paste this whole file over the default code.
 *  2. Project Settings (gear icon) > Script properties > Add property: SECRET = a long random string.
 *     Use the same string as GAS_SECRET in Supabase.
 *  3. Deploy > New deployment > type: Web app. Execute as: Me. Who has access: Anyone. Deploy.
 *     Approve the permissions it asks for (it needs to send email as you).
 *  4. Copy the Web app URL (ends in /exec). That's GAS_URL in Supabase.
 * A personal Gmail account can send to 100 recipients a day through Apps Script. Twenty students is well within that.
 */
function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('SECRET');
    if (!secret || d.secret !== secret) return out({ ok: false, error: 'Bad secret' });
    var msgs = d.messages || [];
    if (msgs.length > MailApp.getRemainingDailyQuota()) return out({ ok: false, error: 'Daily Gmail quota would be exceeded (' + MailApp.getRemainingDailyQuota() + ' left today)' });
    msgs.forEach(function (m) { MailApp.sendEmail({ to: m.to, subject: m.subject, body: m.text, name: 'Software/AI Portal' }); });
    return out({ ok: true, sent: msgs.length, remaining: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
