-- ============================================================
-- register-bus-account.sql
-- バス予約アカウントを harness の line_accounts テーブルに登録する
-- ============================================================
--
-- 使い方（creds を受け取った後）:
--   1. プレースホルダ 4 箇所を実値に置換する
--   2. 以下コマンドで harness D1 に実行（BUS_DB ではなく DB）:
--
--   # 開発環境（ローカル D1）:
--   npx wrangler d1 execute line-harness --local --file=scripts/register-bus-account.sql
--
--   # 本番環境:
--   npx wrangler d1 execute line-crm --env production --remote --file=scripts/register-bus-account.sql
--
-- 実行後:
--   取得した UUID（= BUS_LINE_ACCOUNT_ID）を wrangler secret put で登録する:
--   npx wrangler secret put BUS_LINE_ACCOUNT_ID
--   → プロンプトに UUID を貼り付けて Enter
--   （本番: npx wrangler secret put BUS_LINE_ACCOUNT_ID --env production）
-- ============================================================

-- プレースホルダ一覧（REPLACE_ME → 実値に置換）:
--   REPLACE_ME_UUID              : 新規 UUID。`node -e "console.log(crypto.randomUUID())"` で生成
--   REPLACE_ME_CHANNEL_ID        : バスアカウントの LINE Channel ID
--   REPLACE_ME_CHANNEL_SECRET    : バスアカウントの LINE Channel Secret（Messaging API）
--   REPLACE_ME_CHANNEL_ACCESS_TOKEN : バスアカウントの LINE Channel Access Token（長期）

INSERT INTO line_accounts (
  id,
  name,
  channel_id,
  channel_secret,
  channel_access_token,
  is_active,
  created_at,
  updated_at
) VALUES (
  'REPLACE_ME_UUID',
  'バス予約（ハピネッツ シャトル）',
  'REPLACE_ME_CHANNEL_ID',
  'REPLACE_ME_CHANNEL_SECRET',
  'REPLACE_ME_CHANNEL_ACCESS_TOKEN',
  1,
  datetime('now', '+9 hours'),
  datetime('now', '+9 hours')
);

-- INSERT 確認:
-- SELECT id, name, channel_id, is_active FROM line_accounts WHERE id = 'REPLACE_ME_UUID';
