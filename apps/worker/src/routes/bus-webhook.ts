/**
 * bus-webhook.ts
 *
 * バス予約アカウント専用 Webhook イベントハンドラ（フルパリティ実装）
 *
 * 責務:
 *   - follow:   あいさつテキスト + 予約案内 Flex を返信（旧 bus-reservation-api/webhook.ts 相当）
 *   - message:  任意テキスト受信 → 予約案内 Flex を返信
 *   - postback: bus:menu → 予約案内 Flex / bus:myres → マイ予約 LIFF URL テキスト
 *
 * 呼び出し元: apps/worker/src/routes/webhook.ts の handleEvent
 * 条件:       matchedAccountId が BUS_LINE_ACCOUNT_ID env に一致した場合
 *
 * creds 待ち（デプロイ未実施）:
 *   - BUS_LINE_ACCOUNT_ID は wrangler secret put で設定
 *     （harness の line_accounts テーブルに登録したバスアカウントの UUID）
 *   - BUS_DB は wrangler.toml に追加済み（バスのD1を別バインディングで参照）
 *
 * [注意] OA（公式アカウント）あいさつが有効の場合、follow 時にあいさつが二重になる。
 *        LINE Developers Console → Messaging API → あいさつメッセージ を OFF 推奨。
 */

import type { WebhookEvent, Message } from '@line-crm/line-sdk';
import { LineClient } from '@line-crm/line-sdk';
import { jstNow } from '@line-crm/db';

// ─── LIFF URL（旧 bus-reservation-api/workers/src/webhook.ts WEBHOOK_LINKS と同値）─
// LIFF再発行時はここを変更する。
const BUS_LIFF_RESERVE = 'https://liff.line.me/2010371178-BqRvQ1H1';
const BUS_RESERVE_DIRECT = 'https://bus-reservation-api.row2014-2015-k.workers.dev/reserve'; // PC版LINE用
const BUS_GUIDE = 'https://bus-reservation-api.row2014-2015-k.workers.dev/guide';
// ────────────────────────────────────────────────────────────────────────────────────

/**
 * バスアカウントかどうかを判定する。
 * line_accounts テーブルの id（UUID）を BUS_LINE_ACCOUNT_ID env と照合。
 *
 * @param matchedAccountId  - webhook.ts が署名検証後に解決した line_accounts.id
 * @param busLineAccountId  - env.BUS_LINE_ACCOUNT_ID（wrangler secret put で設定）
 */
export function isBusAccount(
  matchedAccountId: string | null,
  busLineAccountId: string | undefined,
): boolean {
  if (!matchedAccountId || !busLineAccountId) return false;
  return matchedAccountId === busLineAccountId;
}

/**
 * あいさつテキスト（follow イベント用）。
 * 旧 webhook.ts の buildGreetingText() と同内容。
 */
function buildBusGreetingText(): Message {
  return {
    type: 'text',
    text: 'ご登録ありがとうございます！🎉\n秋田ノーザンハピネッツ シャトルバス予約サービスです。',
  } as unknown as Message;
}

/**
 * バス予約案内 Flex メッセージ（bubble）。
 * 旧 webhook.ts の buildReservationFlex() と同内容。
 * follow / message(text) / postback bus:menu で共用する。
 */
function buildBusReservationFlex(): Message {
  return {
    type: 'flex',
    altText: '🚌 プライウッド行きシャトルバス予約案内',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🚌 プライウッド行きシャトルバス',
            weight: 'bold',
            size: 'md',
            color: '#ffffff',
            wrap: true,
          },
        ],
        backgroundColor: '#EC008C',
        paddingAll: '16px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: '・予約優先でご乗車いただけます',
            wrap: true,
            size: 'sm',
            color: '#333333',
          },
          {
            type: 'text',
            text: '・お連れ様を含めて1〜8名までまとめて予約OK',
            wrap: true,
            size: 'sm',
            color: '#333333',
          },
          {
            type: 'text',
            text: '・出発時刻は決まり次第LINEでお知らせします',
            wrap: true,
            size: 'sm',
            color: '#333333',
          },
        ],
        paddingAll: '16px',
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#EC008C',
            action: {
              type: 'uri',
              label: 'バスを予約する',
              uri: BUS_LIFF_RESERVE,
              altUri: { desktop: BUS_RESERVE_DIRECT },
            },
          },
          {
            type: 'button',
            style: 'link',
            action: {
              type: 'uri',
              label: '乗車案内を見る',
              uri: BUS_GUIDE,
            },
          },
        ],
        paddingAll: '12px',
      },
    },
  } as unknown as Message;
}

/**
 * バス予約アカウント向けの follow Flex メッセージ本体（旧 buildBusFollowFlex）。
 * 現在は buildBusReservationFlex に統一したため未使用。
 * follow 応答は handleBusFollow 内で buildBusGreetingText + buildBusReservationFlex を返す。
 * @deprecated 削除予定。旧参照用に残す。
 */
function buildBusFollowFlex(): Message {
  return {
    type: 'flex',
    altText: 'ハピネッツ シャトルバス予約サービスへようこそ！',
    contents: {
      type: 'bubble',
      size: 'giga',
      header: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '20px',
        backgroundColor: '#1e3a5f',
        contents: [
          {
            type: 'text',
            text: 'ハピネッツ シャトルバス',
            size: 'xl',
            weight: 'bold',
            color: '#ffffff',
          },
          {
            type: 'text',
            text: '公式予約サービス',
            size: 'sm',
            color: '#93c5fd',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '20px',
        contents: [
          {
            type: 'text',
            text: 'ご登録ありがとうございます！',
            size: 'md',
            weight: 'bold',
            color: '#1e293b',
          },
          {
            type: 'text',
            text: 'このアカウントでシャトルバスの予約・確認ができます。下のメニューからご利用ください。',
            size: 'sm',
            color: '#475569',
            wrap: true,
            margin: 'md',
          },
          {
            type: 'separator',
            margin: 'lg',
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            contents: [
              {
                type: 'text',
                text: '利用方法',
                size: 'xs',
                color: '#64748b',
                weight: 'bold',
              },
              {
                type: 'text',
                text: '① 試合日程を確認する\n② 乗りたい便を選んで予約する\n③ 当日、QRコードで乗車',
                size: 'sm',
                color: '#1e293b',
                wrap: true,
                margin: 'sm',
              },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '16px',
        gap: 'sm',
        contents: [
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '予約する',
              data: 'bus:menu',
              displayText: 'バスを予約する',
            },
            style: 'primary',
            color: '#1e3a5f',
          },
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '予約を確認する',
              data: 'bus:myres',
              displayText: '予約を確認する',
            },
            style: 'secondary',
          },
        ],
      },
    },
  } as unknown as Message;
}

/**
 * バスアカウントの follow イベントを処理する。
 * ウェルカム Flex を replyMessage で返す。
 *
 * @param event         - LINE WebhookEvent（type === 'follow' であること）
 * @param lineClient    - 署名検証済みの LineClient（バスアカウントのトークン）
 * @param db            - harness の D1Database（友だち登録・ログ用）
 * @param lineAccountId - バスアカウントの line_accounts.id
 */
export async function handleBusFollow(
  event: WebhookEvent & { type: 'follow' },
  lineClient: LineClient,
  db: D1Database,
  lineAccountId: string,
): Promise<void> {
  const replyToken = (event as unknown as { replyToken?: string }).replyToken;
  if (!replyToken) return;

  const userId =
    event.source.type === 'user' ? event.source.userId : undefined;

  console.log(`[bus:follow] userId=${userId ?? 'unknown'} accountId=${lineAccountId}`);

  // あいさつテキスト + 予約案内 Flex を返信（旧 bus-reservation-api 相当の2メッセージ）
  // [注意] OA あいさつが有効だと二重になる → LINE Developers Console でOFF推奨
  try {
    await lineClient.replyMessage(replyToken, [buildBusGreetingText(), buildBusReservationFlex()]);
    console.log(`[bus:follow] greeting+flex sent to userId=${userId ?? 'unknown'}`);
  } catch (err) {
    console.error('[bus:follow] replyMessage failed:', err);
  }

  // messages_log に follow ウェルカム送信を記録
  if (userId) {
    try {
      const welcomeContent = JSON.stringify({
        type: 'flex',
        altText: '🚌 プライウッド行きシャトルバス予約案内',
        contents: (buildBusReservationFlex() as unknown as { contents: unknown }).contents,
      });

      // friends テーブルから friend.id を逆引き
      const friend = await db
        .prepare('SELECT id FROM friends WHERE line_user_id = ?')
        .bind(userId)
        .first<{ id: string }>();

      if (friend) {
        await db
          .prepare(
            `INSERT INTO messages_log (id, friend_id, direction, message_type, content, broadcast_id, scenario_step_id, delivery_type, source, line_account_id, created_at)
             VALUES (?, ?, 'outgoing', 'flex', ?, NULL, NULL, 'reply', 'bus_welcome', ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            friend.id,
            welcomeContent,
            lineAccountId,
            jstNow(),
          )
          .run();
      }
    } catch (err) {
      // ログ失敗は致命的ではない
      console.error('[bus:follow] messages_log insert failed:', err);
    }
  }
}

/**
 * バスアカウントの text message イベントを処理する。
 * 任意のテキスト受信 → 予約案内 Flex を返す（旧 bus-reservation-api 相当）。
 *
 * @param event         - LINE WebhookEvent（type === 'message' かつ message.type === 'text'）
 * @param lineClient    - 署名検証済みの LineClient（バスアカウントのトークン）
 * @param db            - harness の D1Database（未使用だが一貫性のため引数に含む）
 * @param lineAccountId - バスアカウントの line_accounts.id
 */
export async function handleBusMessage(
  event: WebhookEvent & { type: 'message' },
  lineClient: LineClient,
  db: D1Database,
  lineAccountId: string,
): Promise<void> {
  const replyToken = (event as unknown as { replyToken?: string }).replyToken;
  const userId = event.source.type === 'user' ? event.source.userId : undefined;

  console.log(`[bus:message] userId=${userId ?? 'unknown'} accountId=${lineAccountId}`);

  if (!replyToken) return;

  // テキスト以外（スタンプ・画像等）は無視（通常ルートのログ処理に任せる）
  const msg = event.message as { type: string };
  if (msg.type !== 'text') return;

  try {
    await lineClient.replyMessage(replyToken, [buildBusReservationFlex()]);
    console.log(`[bus:message] reservation flex sent to userId=${userId ?? 'unknown'}`);
  } catch (err) {
    console.error('[bus:message] replyMessage failed:', err);
  }
}

/**
 * バスアカウントの postback イベントを処理する（フルパリティ実装）。
 * bus:menu → 予約案内 Flex / bus:myres → マイ予約 LIFF URL テキスト
 * 旧 bus-reservation-api/workers/src/webhook.ts の postback 処理と同等。
 *
 * @param event         - LINE WebhookEvent（type === 'postback' であること）
 * @param lineClient    - 署名検証済みの LineClient（バスアカウントのトークン）
 * @param db            - harness の D1Database（ログ用）
 * @param lineAccountId - バスアカウントの line_accounts.id
 */
export async function handleBusPostback(
  event: WebhookEvent & { type: 'postback' },
  lineClient: LineClient,
  db: D1Database,
  lineAccountId: string,
): Promise<void> {
  const postbackData = (event as unknown as { postback: { data: string } }).postback.data;
  const userId = event.source.type === 'user' ? event.source.userId : undefined;
  const replyToken = (event as unknown as { replyToken?: string }).replyToken;

  console.log(`[bus:postback] data=${postbackData} userId=${userId ?? 'unknown'}`);

  if (!replyToken) return;

  // bus:menu — 旧workerと同じ: 予約案内 Flex を返す
  if (postbackData === 'bus:menu') {
    try {
      await lineClient.replyMessage(replyToken, [buildBusReservationFlex()]);
    } catch (err) {
      console.error('[bus:postback] bus:menu reply failed:', err);
    }
    return;
  }

  // bus:myres — 旧workerと同じ: マイ予約・QRの LIFF URL をテキストで返す
  if (postbackData === 'bus:myres') {
    try {
      await lineClient.replyMessage(replyToken, [
        {
          type: 'text',
          text: `マイ予約・QRコードの確認はこちらをタップ👇\n${BUS_LIFF_RESERVE}`,
        } as unknown as Message,
      ]);
    } catch (err) {
      console.error('[bus:postback] bus:myres reply failed:', err);
    }
    return;
  }

  // 未知の bus: プレフィックス postback は無視（通常ルートで処理させない）
  console.log(`[bus:postback] unhandled postback data=${postbackData}`);
}
