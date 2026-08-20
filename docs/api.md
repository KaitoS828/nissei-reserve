# nissei予約システム API / MCP リファレンス

外部ツール・AIエージェントから空室確認や予約操作を行うための公式ドキュメント。

- ベースURL: `https://reserve.gh-nissei.jp`
- 対象施設: 一棟貸し宿「日靜」（1施設・1客室タイプ運用）

## 認証

書き込み・個人情報を含むエンドポイント（予約の閲覧・作成・変更・キャンセル、MCP全般）は
`EXTERNAL_API_KEY` をBearerトークンとして必須とする。

```
Authorization: Bearer <EXTERNAL_API_KEY>
```

キーは管理者のみが把握する（Vercel環境変数）。漏洩した場合は値を再生成し、
Vercelの環境変数を更新・再デプロイすること。

空室確認・プラン一覧のみ、個人情報を含まないため認証不要（公開）。

## レート制限

エンドポイントごとに簡易レート制限あり（1分あたり数十〜百数十リクエスト）。
超過時は `429` とともに `Retry-After`（秒）を返す。

---

## REST API (`/api/v1/*`)

### `GET /api/v1/availability?from=YYYY-MM-DD&to=YYYY-MM-DD`
認証不要。指定期間の各泊が空いているかを返す（チェックアウト日は含まない）。

```json
{ "from": "2026-09-01", "to": "2026-09-03", "days": { "2026-09-01": true, "2026-09-02": true } }
```

### `GET /api/v1/plans`
認証不要。有効な宿泊プラン一覧（料金・タグ・ギャラリー写真）。

```json
{ "plans": [{ "id": "...", "name": "素泊まりプラン", "pricePerNight": 7000, "guestPrices": {"1":7000,"2":14000}, "tags": ["1棟貸し"], "galleryImages": [] }] }
```

### `GET /api/v1/reservations?scope=upcoming&query=山田`
認証必須。予約一覧。`scope`: `today` / `upcoming`(既定) / `all`。`query`は氏名・予約番号・メールの部分一致。

### `GET /api/v1/reservations/:code`
認証必須。予約1件の詳細。存在しない場合は `404`。

### `POST /api/v1/reservations`
認証必須。新規予約を登録する（空室確認・料金計算・顧客登録・Googleカレンダー反映まで自動で行う）。

リクエスト body（JSON）:
```json
{
  "last_name": "山田", "first_name": "太郎",
  "email": "taro@example.com", "phone": "090-0000-0000",
  "check_in": "2026-10-01", "check_out": "2026-10-02",
  "num_guests": 2,
  "plan": "素泊まり",
  "payment_status": "unpaid",
  "note": "電話予約"
}
```
`plan`は部分一致検索（省略時はデフォルトプラン）。`amount`省略時は自動計算。
成功時は `201` と `{ message, reservation }`。満室・入力不備は `422`。

### `PATCH /api/v1/reservations/:code`
認証必須。日程・人数・ステータスの変更。日程変更時は自動で空室チェックする。

```json
{ "check_in": "2026-10-02", "check_out": "2026-10-04", "num_guests": 3 }
```

### `POST /api/v1/reservations/:code/cancel`
認証必須。キャンセル実行（取り消し不可）。ポリシーに従いStripe返金・Googleカレンダー削除・ドアPIN失効まで行う。

```json
{ "reason": "お客様都合" }
```

`?quote=1` を付けると、DBを変更せず返金見込み額だけ試算する（実行前の確認に使う）。

---

## MCP サーバー (`/api/mcp`)

[Model Context Protocol](https://modelcontextprotocol.io/) 準拠、Streamable HTTP（ステートレス）。
Claude Code / Claude Desktop などのMCP対応クライアントから直接、空室確認・予約作成・
キャンセル・休業日設定などをツール呼び出しできる。REST APIと同じ`EXTERNAL_API_KEY`で認証する。

利用できるツール: `check_availability` `list_reservations` `get_reservation`
`quote_cancellation` `cancel_reservation` `block_dates` `unblock_dates`
`create_reservation` `update_reservation`
（各ツールの説明・引数は `tools/list` で取得できる）

### Claude Codeから接続する

```
claude mcp add --transport http nissei https://reserve.gh-nissei.jp/api/mcp \
  --header "Authorization: Bearer <EXTERNAL_API_KEY>"
```

接続後、「明日から2泊、空いてる？」「山田様で2名、10/1〜10/2で予約入れて」のように
自然文で依頼すればツール経由で実行される。予約作成・キャンセルなど取り消せない操作は
必ず内容を確認してから実行させること。

### 動作確認（curlでの疎通テスト）

```
curl -X POST https://reserve.gh-nissei.jp/api/mcp \
  -H "Authorization: Bearer <EXTERNAL_API_KEY>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

---

## 注意事項

- `create_reservation` / `cancel_reservation` は実際の予約・返金・鍵の発行/失効まで行う。
  外部連携・AIエージェントに渡す際は、書き込み系操作の前に必ず内容確認のステップを挟むこと。
- キャンセルは取り消し不可。実行前に必ず `quote_cancellation`（またはcancelの`?quote=1`）で
  金額を提示し、明確な同意を得ること。
- 将来、外部パートナー（Airbnb連携等）に公開する場合は、キーをパートナーごとに分離し、
  権限（読み取り専用/書き込み可）を分けることを推奨する。現状は単一の共有キーのみ対応。
