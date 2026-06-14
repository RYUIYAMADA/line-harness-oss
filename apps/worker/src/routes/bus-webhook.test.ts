/**
 * bus-webhook.test.ts
 *
 * 旧 bus-reservation-api/workers/src/webhook.ts とのパリティを担保するテスト。
 *
 * 検証項目:
 *   ① バスアカウント判定（UUID 一致 / 不一致）
 *   ② follow: 共通登録後に greeting + Flex を返す
 *   ③ text message: 予約案内 Flex を返す
 *   ④ postback bus:myres → テキスト
 *   ⑤ 未知 postback（bus:menu 含む） → Flex（else セマンティクス）
 *   ⑥ BUS_LINE_ACCOUNT_ID 未設定時の fail-closed 挙動
 */

import { describe, expect, test, vi, beforeEach } from 'vitest';
import { isBusAccount, handleBusFollow, handleBusMessage, handleBusPostback } from './bus-webhook.js';
import type { WebhookEvent } from '@line-crm/line-sdk';

// ─── モック ──────────────────────────────────────────────────────────────────

const mockReplyMessage = vi.fn().mockResolvedValue(undefined);
const mockLineClient = {
  replyMessage: mockReplyMessage,
} as unknown as import('@line-crm/line-sdk').LineClient;

// D1Database 最小スタブ（messages_log INSERT / friends SELECT）
const mockFirst = vi.fn().mockResolvedValue(null); // friends レコードなし = ログ INSERT スキップ
const mockRun = vi.fn().mockResolvedValue(undefined);
const mockBind = vi.fn().mockReturnThis();
const mockPrepare = vi.fn().mockReturnValue({
  bind: mockBind,
  first: mockFirst,
  run: mockRun,
});
const mockDb = {
  prepare: mockPrepare,
} as unknown as D1Database;

// jstNow スタブ
vi.mock('@line-crm/db', () => ({
  jstNow: vi.fn().mockReturnValue('2026-06-14T00:00:00+09:00'),
}));

beforeEach(() => {
  vi.clearAllMocks();
  // デフォルト: friends テーブルに行なし（messages_log の friend_id 逆引きが NULL）
  mockFirst.mockResolvedValue(null);
});

// ─── ① バスアカウント判定 ────────────────────────────────────────────────────

describe('isBusAccount()', () => {
  test('UUID が一致する場合 true を返す', () => {
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    expect(isBusAccount(id, id)).toBe(true);
  });

  test('UUID が不一致の場合 false を返す', () => {
    expect(isBusAccount(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      '11111111-2222-3333-4444-555555555555',
    )).toBe(false);
  });

  test('matchedAccountId が null の場合 false を返す', () => {
    expect(isBusAccount(null, 'some-uuid')).toBe(false);
  });

  test('busLineAccountId が undefined の場合 false を返す', () => {
    expect(isBusAccount('some-uuid', undefined)).toBe(false);
  });
});

// ─── ② follow: greeting + Flex ───────────────────────────────────────────────

describe('handleBusFollow()', () => {
  const busAccountId = 'bus-uuid-1234';

  const followEvent = {
    type: 'follow',
    replyToken: 'reply-token-follow',
    source: { type: 'user', userId: 'U_test_user' },
  } as unknown as WebhookEvent & { type: 'follow' };

  test('replyMessage を1回呼び出す（greeting テキスト + 予約案内 Flex の2メッセージ）', async () => {
    await handleBusFollow(followEvent, mockLineClient, mockDb, busAccountId);

    expect(mockReplyMessage).toHaveBeenCalledTimes(1);
    const [replyToken, messages] = mockReplyMessage.mock.calls[0] as [string, unknown[]];
    expect(replyToken).toBe('reply-token-follow');
    expect(messages).toHaveLength(2);

    // メッセージ1: あいさつテキスト
    const greeting = messages[0] as { type: string; text: string };
    expect(greeting.type).toBe('text');
    expect(greeting.text).toContain('ご登録ありがとうございます');
    expect(greeting.text).toContain('秋田ノーザンハピネッツ');

    // メッセージ2: 予約案内 Flex（旧 buildReservationFlex と同内容）
    const flex = messages[1] as { type: string; altText: string; contents: { type: string } };
    expect(flex.type).toBe('flex');
    expect(flex.altText).toBe('🚌 プライウッド行きシャトルバス予約案内');
    expect(flex.contents.type).toBe('bubble');
  });

  test('replyToken が存在しない場合は replyMessage を呼ばない', async () => {
    const noTokenEvent = {
      type: 'follow',
      source: { type: 'user', userId: 'U_test_user' },
      // replyToken なし
    } as unknown as WebhookEvent & { type: 'follow' };

    await handleBusFollow(noTokenEvent, mockLineClient, mockDb, busAccountId);
    expect(mockReplyMessage).not.toHaveBeenCalled();
  });
});

// ─── ③ text message → Flex ───────────────────────────────────────────────────

describe('handleBusMessage()', () => {
  const busAccountId = 'bus-uuid-1234';

  const textMessageEvent = {
    type: 'message',
    replyToken: 'reply-token-msg',
    source: { type: 'user', userId: 'U_test_user' },
    message: { type: 'text', text: '予約したい' },
  } as unknown as WebhookEvent & { type: 'message' };

  test('テキスト受信 → 予約案内 Flex を1件返す', async () => {
    await handleBusMessage(textMessageEvent, mockLineClient, mockDb, busAccountId);

    expect(mockReplyMessage).toHaveBeenCalledTimes(1);
    const [replyToken, messages] = mockReplyMessage.mock.calls[0] as [string, unknown[]];
    expect(replyToken).toBe('reply-token-msg');
    expect(messages).toHaveLength(1);

    const flex = messages[0] as { type: string; altText: string };
    expect(flex.type).toBe('flex');
    expect(flex.altText).toBe('🚌 プライウッド行きシャトルバス予約案内');
  });

  test('非テキスト（スタンプ等）は replyMessage を呼ばない', async () => {
    const stickerEvent = {
      type: 'message',
      replyToken: 'reply-token-sticker',
      source: { type: 'user', userId: 'U_test_user' },
      message: { type: 'sticker', packageId: '1', stickerId: '1' },
    } as unknown as WebhookEvent & { type: 'message' };

    await handleBusMessage(stickerEvent, mockLineClient, mockDb, busAccountId);
    expect(mockReplyMessage).not.toHaveBeenCalled();
  });
});

// ─── ④ postback bus:myres → テキスト ────────────────────────────────────────

describe('handleBusPostback() — bus:myres', () => {
  const busAccountId = 'bus-uuid-1234';

  test('bus:myres → マイ予約テキストを返す（旧workerと同内容）', async () => {
    const event = {
      type: 'postback',
      replyToken: 'reply-token-myres',
      source: { type: 'user', userId: 'U_test_user' },
      postback: { data: 'bus:myres' },
    } as unknown as WebhookEvent & { type: 'postback' };

    await handleBusPostback(event, mockLineClient, mockDb, busAccountId);

    expect(mockReplyMessage).toHaveBeenCalledTimes(1);
    const [replyToken, messages] = mockReplyMessage.mock.calls[0] as [string, unknown[]];
    expect(replyToken).toBe('reply-token-myres');
    expect(messages).toHaveLength(1);

    const msg = messages[0] as { type: string; text: string };
    expect(msg.type).toBe('text');
    // 旧 webhook.ts: `マイ予約・QRコードの確認はこちらをタップ👇\n${LIFF_RESERVE}`
    expect(msg.text).toContain('マイ予約・QRコードの確認はこちらをタップ👇');
    expect(msg.text).toContain('liff.line.me/2010371178-BqRvQ1H1');
  });
});

// ─── ⑤ 未知 postback（bus:menu 含む） → Flex（else セマンティクス） ───────────

describe('handleBusPostback() — else セマンティクス', () => {
  const busAccountId = 'bus-uuid-1234';

  const testCases = [
    { data: 'bus:menu', label: 'bus:menu' },
    { data: 'bus:unknown', label: '未知のbus:プレフィックス' },
    { data: 'other', label: 'その他の任意postback' },
  ];

  for (const { data, label } of testCases) {
    test(`${label} → 予約案内 Flex を返す`, async () => {
      const event = {
        type: 'postback',
        replyToken: `reply-token-${data}`,
        source: { type: 'user', userId: 'U_test_user' },
        postback: { data },
      } as unknown as WebhookEvent & { type: 'postback' };

      await handleBusPostback(event, mockLineClient, mockDb, busAccountId);

      expect(mockReplyMessage).toHaveBeenCalledTimes(1);
      const [replyToken, messages] = mockReplyMessage.mock.calls[0] as [string, unknown[]];
      expect(replyToken).toBe(`reply-token-${data}`);
      expect(messages).toHaveLength(1);

      const flex = messages[0] as { type: string; altText: string };
      expect(flex.type).toBe('flex');
      expect(flex.altText).toBe('🚌 プライウッド行きシャトルバス予約案内');

      vi.clearAllMocks();
    });
  }
});

// ─── ⑥ BUS_LINE_ACCOUNT_ID 未設定時の挙動 ───────────────────────────────────

describe('isBusAccount() — BUS_LINE_ACCOUNT_ID 未設定', () => {
  test('BUS_LINE_ACCOUNT_ID が空文字の場合 false を返す（ルーティングが行われない）', () => {
    expect(isBusAccount('some-uuid', '')).toBe(false);
  });

  test('BUS_LINE_ACCOUNT_ID が undefined の場合 false を返す（ルーティングが行われない）', () => {
    expect(isBusAccount('some-uuid', undefined)).toBe(false);
  });

  // handleBusFollow/Message/Postback はルーティング前に isBusAccount が false を返すため
  // 実際には呼ばれない。呼ばれた場合でも正常動作することを確認する（防御的テスト）。
  test('BUS_LINE_ACCOUNT_ID が未設定の状態で handleBusPostback を直接呼んでも replyMessage は実行される', async () => {
    // 未設定シナリオの直接呼び出し（実際の運用では isBusAccount が false になるためここに来ない）
    const event = {
      type: 'postback',
      replyToken: 'reply-token-test',
      source: { type: 'user', userId: 'U_test_user' },
      postback: { data: 'bus:menu' },
    } as unknown as WebhookEvent & { type: 'postback' };

    // BUS_LINE_ACCOUNT_ID が未設定であっても、handleBusPostback 自体は独立して動作する
    // （呼び出し元の webhook.ts が isBusAccount チェックで保護している）
    await handleBusPostback(event, mockLineClient, mockDb, 'some-account-id');
    expect(mockReplyMessage).toHaveBeenCalledTimes(1);
  });
});

// ─── Flex 内容のパリティ検証（旧 buildReservationFlex との一致） ─────────────

describe('Flex メッセージのパリティ（旧 bus-reservation-api/workers/src/webhook.ts）', () => {
  test('フッターの1つ目ボタンは style=primary color=#EC008C label=バスを予約する', async () => {
    const event = {
      type: 'postback',
      replyToken: 'reply-token-flex',
      source: { type: 'user', userId: 'U_test_user' },
      postback: { data: 'bus:menu' },
    } as unknown as WebhookEvent & { type: 'postback' };

    await handleBusPostback(event, mockLineClient, mockDb, 'bus-account-id');

    const [, messages] = mockReplyMessage.mock.calls[0] as [string, unknown[]];
    const flex = messages[0] as {
      contents: {
        footer: {
          contents: Array<{
            style: string;
            color?: string;
            action: { label: string; uri: string; altUri?: { desktop: string } };
          }>;
        };
      };
    };

    const primaryBtn = flex.contents.footer.contents[0];
    expect(primaryBtn.style).toBe('primary');
    expect(primaryBtn.color).toBe('#EC008C');
    expect(primaryBtn.action.label).toBe('バスを予約する');
    expect(primaryBtn.action.uri).toBe('https://liff.line.me/2010371178-BqRvQ1H1');
    expect(primaryBtn.action.altUri?.desktop).toBe(
      'https://bus-reservation-api.row2014-2015-k.workers.dev/reserve',
    );
  });

  test('フッターの2つ目ボタンは style=link label=乗車案内を見る', async () => {
    const event = {
      type: 'message',
      replyToken: 'reply-token-msg2',
      source: { type: 'user', userId: 'U_test_user' },
      message: { type: 'text', text: 'test' },
    } as unknown as WebhookEvent & { type: 'message' };

    await handleBusMessage(event, mockLineClient, mockDb, 'bus-account-id');

    const [, messages] = mockReplyMessage.mock.calls[0] as [string, unknown[]];
    const flex = messages[0] as {
      contents: {
        footer: {
          contents: Array<{ style: string; action: { label: string; uri: string } }>;
        };
      };
    };

    const linkBtn = flex.contents.footer.contents[1];
    expect(linkBtn.style).toBe('link');
    expect(linkBtn.action.label).toBe('乗車案内を見る');
    expect(linkBtn.action.uri).toBe(
      'https://bus-reservation-api.row2014-2015-k.workers.dev/guide',
    );
  });
});
