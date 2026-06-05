/**
 * nissei予約システム ↔ Googleカレンダー 双方向同期（GAS Webアプリ）
 *
 * 【セットアップ】
 * 1. script.google.com で新規プロジェクト作成、このコードを貼り付け
 * 2. プロジェクトの設定 → スクリプト プロパティ に以下を登録:
 *    - SHARED_SECRET     : Next.js と共有する秘密文字列（.env.local の GAS_SHARED_SECRET と一致させる）
 *    - SUPABASE_URL      : https://<ref>.supabase.co
 *    - SUPABASE_SERVICE_KEY : service_role キー
 *    - CALENDAR_ID       : 同期先カレンダーID（個人なら 'primary'、専用カレンダーならそのID）
 * 3. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」
 *    - 実行ユーザー: 自分
 *    - アクセスできるユーザー: 全員
 *    → 発行された URL を .env.local の GAS_WEBAPP_URL に設定
 * 4. （任意）カレンダー→システムの取り込み: トリガー で syncBlockedDates を15分毎などに設定
 */

function prop(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}
function calendar() {
  return CalendarApp.getCalendarById(prop('CALENDAR_ID') || 'primary');
}
const MARKER = '[nissei]'; // 当システムが作成したイベントの目印

// ---- Next.js → GAS（予約をカレンダーに反映）----
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.secret !== prop('SHARED_SECRET')) {
      return json({ ok: false, error: 'unauthorized' });
    }

    const cal = calendar();
    const action = body.action;

    if (action === 'create') {
      const ev = cal.createAllDayEvent(
        `${MARKER} 予約 ${body.code} ${body.customer || ''}`.trim(),
        new Date(body.check_in),
        new Date(body.check_out),
        { description: `予約番号: ${body.code}\nプラン: ${body.plan || ''}\n人数: ${body.guests || ''}名\n金額: ¥${body.amount || ''}` }
      );
      appendToSheet(body); // 宿泊者台帳スプレッドシートに追記
      return json({ ok: true, event_id: ev.getId() });
    }

    if (action === 'update' && body.event_id) {
      const ev = cal.getEventById(body.event_id);
      if (ev) {
        ev.setTitle(`${MARKER} 予約 ${body.code} ${body.customer || ''}`.trim());
        ev.setAllDayDates(new Date(body.check_in), new Date(body.check_out));
      }
      return json({ ok: true, event_id: body.event_id });
    }

    if (action === 'delete' && body.event_id) {
      const ev = cal.getEventById(body.event_id);
      if (ev) ev.deleteEvent();
      return json({ ok: true });
    }

    return json({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---- カレンダー → システム（手動で塞いだ枠を blocked_dates に反映）----
// 時間主導トリガーで定期実行する。当システム作成イベント([nissei])は除外し、
// 手動予定の日付範囲を blocked_dates(reason='gcal-sync') として同期する。
function syncBlockedDates() {
  const cal = calendar();
  const now = new Date();
  const until = new Date();
  until.setMonth(until.getMonth() + 6);

  const events = cal.getEvents(now, until);
  const blocks = [];
  events.forEach(function (ev) {
    if (ev.getTitle().indexOf(MARKER) !== -1) return; // 自分の予約は除外
    const start = ev.isAllDayEvent() ? ev.getAllDayStartDate() : ev.getStartTime();
    const end = ev.isAllDayEvent() ? ev.getAllDayEndDate() : ev.getEndTime();
    blocks.push({
      start_date: fmtDate(start),
      end_date: fmtDate(new Date(end.getTime() - 86400000)), // 終了日は排他なので1日戻す
      reason: 'gcal-sync',
    });
  });

  const base = prop('SUPABASE_URL') + '/rest/v1/blocked_dates';
  const headers = {
    apikey: prop('SUPABASE_SERVICE_KEY'),
    Authorization: 'Bearer ' + prop('SUPABASE_SERVICE_KEY'),
    'Content-Type': 'application/json',
  };
  // 既存の gcal-sync 分を一旦削除してから再投入（全置換）
  UrlFetchApp.fetch(base + '?reason=eq.gcal-sync', { method: 'delete', headers: headers, muteHttpExceptions: true });
  if (blocks.length) {
    UrlFetchApp.fetch(base, { method: 'post', headers: headers, payload: JSON.stringify(blocks), muteHttpExceptions: true });
  }
}

function fmtDate(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// ---- 宿泊者台帳スプレッドシートに自動追記 ----
// SPREADSHEET_ID が未設定なら「日靜 宿泊者台帳」を自動作成して ID を保存する。
function appendToSheet(body) {
  try {
    const props = PropertiesService.getScriptProperties();
    let sid = props.getProperty('SPREADSHEET_ID');
    let ss;
    if (sid) {
      ss = SpreadsheetApp.openById(sid);
    } else {
      ss = SpreadsheetApp.create('日靜 宿泊者台帳');
      sid = ss.getId();
      props.setProperty('SPREADSHEET_ID', sid);
      ss.getActiveSheet().appendRow([
        '受付日時', '予約番号', '氏名', 'メール', '電話',
        'プラン', 'チェックイン', 'チェックアウト', '泊数', '人数', '金額',
      ]);
    }
    const sheet = ss.getActiveSheet();
    const nights = Math.round(
      (new Date(body.check_out) - new Date(body.check_in)) / 86400000
    );
    sheet.appendRow([
      new Date(),
      body.code || '',
      body.customer || '',
      body.email || '',
      body.phone || '',
      body.plan || '',
      body.check_in || '',
      body.check_out || '',
      nights,
      body.guests || '',
      body.amount || '',
    ]);
  } catch (err) {
    // 台帳追記に失敗してもカレンダー登録は継続させる
  }
}
