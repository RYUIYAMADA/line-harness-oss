/**
 * bus-webhook.ts
 *
 * バス予約アカウント専用 Webhook イベントハンドラ（スライス 0）
 *
 * 責務:
 *   - follow: バス予約ウェルカム Flex を返信
 *   - postback: bus:menu / bus:myres を処理（スライス 1 以降で拡充）
 *
 * 呼び出し元: apps/worker/src/routes/webhook.ts の handleEvent
 * 条件:       matchedAccountId が BUS_LINE_ACCOUNT_ID env に一致した場合
 *
 * creds 待ち（デプロイ未実施）:
 *   - BUS_LINE_ACCOUNT_ID は wrangler secret put で設定
 *     （harness の line_accounts テーブルに登録したバスアカウントの UUID）
 *   - BUS_DB は wrangler.toml に追加済み（バスのD1を別バインディングで参照）
 */

import type { WebhookEvent, Message } from '@line-crm/line-sdk';
import { LineClient } from '@line-crm/line-sdk';
import { jstNow } from '@line-crm/db';

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
 * バス予約アカウント向けの follow Flex メッセージ本体。
 * LINE Flex Message（bubble）形式。
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

  // ウェルカム Flex を返信
  try {
    await lineClient.replyMessage(replyToken, [buildBusFollowFlex()]);
    console.log(`[bus:follow] welcome flex sent to userId=${userId ?? 'unknown'}`);
  } catch (err) {
    console.error('[bus:follow] replyMessage failed:', err);
  }

  // messages_log に follow ウェルカム送信を記録
  if (userId) {
    try {
      const welcomeContent = JSON.stringify({
        type: 'flex',
        altText: 'ハピネッツ シャトルバス予約サービスへようこそ！',
        contents: (buildBusFollowFlex() as unknown as { contents: unknown }).contents,
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
 * バスアカウントの postback イベントを処理する（スライス 0 最小実装）。
 * bus:menu / bus:myres に対してテキスト応答を返す。
 * スライス 3（予約API移植）以降で LIFF URL 返信に差し替える。
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

  // bus:menu — 予約メニューへ誘導（スライス 3 以降で LIFF URL 返信に差し替え）
  if (postbackData === 'bus:menu') {
    try {
      await lineClient.replyMessage(replyToken, [
        { type: 'text', text: '予約ページの準備中です。しばらくお待ちください。' } as Message,
      ]);
    } catch (err) {
      console.error('[bus:postback] bus:menu reply failed:', err);
    }
    return;
  }

  // bus:myres — 予約確認へ誘導（スライス 3 以降で LIFF URL 返信に差し替え）
  if (postbackData === 'bus:myres') {
    try {
      await lineClient.replyMessage(replyToken, [
        { type: 'text', text: '予約確認ページの準備中です。しばらくお待ちください。' } as Message,
      ]);
    } catch (err) {
      console.error('[bus:postback] bus:myres reply failed:', err);
    }
    return;
  }

  // 未知の bus: プレフィックス postback は無視（通常ルートで処理させない）
  console.log(`[bus:postback] unhandled postback data=${postbackData}`);
}
