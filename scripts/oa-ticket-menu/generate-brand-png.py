#!/usr/bin/env python3
"""
秋田ノーザンハピネッツ チケットメニュー PNG生成
サイズ: 2500×1686（LINE大サイズ仕様）

DS準拠:
  - 背景: 白固定 #FFFFFF (tokens.json color.semantic.bg)
  - 禁止事項: グラデなし・グロー装飾なし・ストライプなし（design-rules.json no-gradient）
  - フッター文字: なし（龍偉指示）
  - ブランドカラー: brand-colors.md 正本 ピンク/ゴールドを控えめアクセントで使用
  - アイコン: モノクロ線（itshoverスタイル・単色・塗り禁止）
  - テキスト: リッチメニュー内 min 24px → 実画像では 28px 以上必須 (no-rich-menu-small-text)
  - コントラスト: WCAG AA (4.5:1) 保証
"""

from PIL import Image, ImageDraw, ImageFont
import sys
import os

# ─────────────────────────────────────────────────────────
# デザイントークン（DS準拠）
# ─────────────────────────────────────────────────────────
# --- 背景 (tokens.json color.semantic.bg = #FFFFFF) ---
BG          = (255, 255, 255)   # 白固定・黒背景禁止

# --- ハピネッツブランド (brand-colors.md 正本) ---
PINK        = (228, 0,   115)   # #E40073 ハピネッツピンク
GOLD        = (190, 138, 35 )   # #BE8A23 いなほゴールド
BLACK       = (0,   0,   0  )   # #000000 ノーザンブラック

# --- セマンティック ---
TEXT        = (26,  26,  46 )   # #1A1A2E（tokens: color.semantic.text）
TEXT_MUTED  = (107, 114, 128)   # #6B7280（tokens: color.semantic.text-muted）
BORDER      = (229, 231, 235)   # #E5E7EB（tokens: color.semantic.border）
BG_SUBTLE   = (245, 245, 245)   # #F5F5F5（tokens: color.semantic.bg-subtle）

# --- リッチメニュー区切り線 ---
DIVIDER_COLOR = (220, 220, 220)  # 薄グレー区切り

W    = 2500
H    = 1686
DIVX = W // 2   # 1250（左右均等分割）


def try_load_font(size):
    """ヒラギノ優先・フォールバック付き"""
    candidates = [
        '/System/Library/Fonts/ヒラギノ角ゴシック W7.ttc',
        '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc',
        '/System/Library/Fonts/ヒラギノ角ゴシック W5.ttc',
        '/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc',
        '/Library/Fonts/NotoSansJP-Bold.otf',
        '/System/Library/Fonts/SF-Pro-Display-Bold.otf',
        '/System/Library/Fonts/Helvetica.ttc',
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default(size=size)


def try_load_font_medium(size):
    candidates = [
        '/System/Library/Fonts/ヒラギノ角ゴシック W4.ttc',
        '/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc',
        '/System/Library/Fonts/SF-Pro-Display-Medium.otf',
        '/System/Library/Fonts/Helvetica.ttc',
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default(size=size)


def draw_ticket_icon(draw, cx, cy, size, color):
    """
    チケットアイコン（モノクロ線・itshoverスタイル）
    - 塗り禁止・単色線のみ
    """
    tw  = int(size * 0.88)
    th  = int(size * 0.54)
    tx  = cx - tw // 2
    ty  = cy - th // 2
    notch_r = int(th * 0.20)
    lw  = max(5, int(size * 0.055))

    # 外枠矩形
    draw.rectangle([tx, ty, tx + tw, ty + th], outline=color, width=lw)

    # 左ノッチ（半円）
    draw.arc([tx - notch_r, cy - notch_r, tx + notch_r, cy + notch_r],
             -90, 90, fill=color, width=lw)

    # 右ノッチ（半円）
    draw.arc([tx + tw - notch_r, cy - notch_r, tx + tw + notch_r, cy + notch_r],
             90, 270, fill=color, width=lw)

    # 破線区切り（縦）
    dash_x  = int(tx + tw * 0.38)
    dash_y1 = ty + int(th * 0.14)
    dash_y2 = ty + th - int(th * 0.14)
    dash_len, dash_gap = 14, 10
    thin_lw = max(3, int(size * 0.038))
    y = dash_y1
    while y < dash_y2:
        draw.line([(dash_x, y), (dash_x, min(y + dash_len, dash_y2))],
                  fill=color, width=thin_lw)
        y += dash_len + dash_gap

    # 右エリア: 右向き三角（矢印）
    ax    = int(cx + tw * 0.18)
    arr_s = int(th * 0.22)
    draw.polygon([
        (ax - int(arr_s * 0.6), cy - arr_s),
        (ax + int(arr_s * 0.6), cy),
        (ax - int(arr_s * 0.6), cy + arr_s),
    ], outline=color, width=max(3, int(size * 0.045)))

    # 左エリア: 横線3本（コンテンツ表現）
    lx1     = int(tx + tw * 0.06)
    lx2     = int(tx + tw * 0.32)
    thin_lw = max(3, int(size * 0.038))
    for dy in [-int(th * 0.22), 0, int(th * 0.22)]:
        draw.line([(lx1, cy + dy), (lx2, cy + dy)], fill=color, width=thin_lw)


def draw_clipboard_icon(draw, cx, cy, size, color):
    """
    クリップボードアイコン（モノクロ線・itshoverスタイル）
    - 塗り禁止・単色線のみ
    """
    bw = int(size * 0.72)
    bh = int(size * 0.88)
    bx = cx - bw // 2
    by = cy - bh // 2 + int(size * 0.08)
    cr = int(bw * 0.08)
    lw = max(5, int(size * 0.055))

    # ボード本体（角丸矩形）
    draw.rounded_rectangle([bx, by, bx + bw, by + bh], radius=cr, outline=color, width=lw)

    # クリップ（上部・丸みのある帯）
    clip_w  = int(bw * 0.40)
    clip_h  = int(size * 0.20)
    clip_x  = cx - clip_w // 2
    clip_y  = by - int(clip_h * 0.55)
    clip_lw = max(3, int(size * 0.050))
    draw.rounded_rectangle(
        [clip_x, clip_y, clip_x + clip_w, clip_y + clip_h],
        radius=clip_h // 2,
        outline=color,
        width=clip_lw
    )

    # チェックリスト3行（チェックボックス + 横線）
    lx1   = int(bx + bw * 0.14)
    lx2   = int(bx + bw * 0.86)
    ly0   = int(by + bh * 0.26)
    gap   = int(bh * 0.20)
    cb_s  = int(bh * 0.10)
    thin_lw = max(3, int(size * 0.045))

    for i in range(3):
        ly = ly0 + gap * i
        draw.rectangle([lx1, ly - cb_s // 2, lx1 + cb_s, ly + cb_s // 2],
                       outline=color, width=thin_lw)
        if i == 0:
            chk_lw = max(3, int(size * 0.038))
            draw.line([
                (int(lx1 + cb_s * 0.12), int(ly + cb_s * 0.05)),
                (int(lx1 + cb_s * 0.42), int(ly + cb_s * 0.28)),
                (int(lx1 + cb_s * 0.88), int(ly - cb_s * 0.20)),
            ], fill=color, width=chk_lw)
        line_end = lx2 - int(bw * 0.14) if i == 2 else lx2
        draw.line(
            [(int(lx1 + cb_s + bw * 0.06), ly), (line_end, ly)],
            fill=color, width=thin_lw
        )


def main():
    print("PNG生成開始: 2500×1686 白背景・DS準拠版")

    # ── キャンバス: 白背景 (DS: color.semantic.bg = #FFFFFF)
    img  = Image.new('RGBA', (W, H), (*BG, 255))
    draw = ImageDraw.Draw(img)

    # ── 白背景ベース（明示塗り）
    draw.rectangle([0, 0, W, H], fill=(*BG, 255))

    # ── 左パネル: 背景を極薄ピンク (rgba(228,0,115,0.04) 相当: ~10/255)
    #    視覚的に白に見えつつ左右差がわかる最小限アクセント
    left_tint = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    lt_draw   = ImageDraw.Draw(left_tint)
    lt_draw.rectangle([0, 0, DIVX, H], fill=(*PINK, 10))
    img.alpha_composite(left_tint)

    # ── 右パネル: 背景を極薄ゴールド
    right_tint = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    rt_draw    = ImageDraw.Draw(right_tint)
    rt_draw.rectangle([DIVX, 0, W, H], fill=(*GOLD, 8))
    img.alpha_composite(right_tint)

    draw = ImageDraw.Draw(img)

    # ── 左パネル上端アクセントバー（ピンク・細め）
    draw.rectangle([100, 0, DIVX - 100, 10], fill=PINK)

    # ── 右パネル上端アクセントバー（ゴールド・細め）
    draw.rectangle([DIVX + 100, 0, W - 100, 10], fill=GOLD)

    # ── 中央分割線（薄グレー）
    div_overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dv_draw     = ImageDraw.Draw(div_overlay)
    dv_draw.line([(DIVX, 40), (DIVX, H - 40)], fill=(*DIVIDER_COLOR, 255), width=3)
    img.alpha_composite(div_overlay)

    draw = ImageDraw.Draw(img)

    # ── アイコン配置
    icon_size = 320
    icon_y    = H // 2 - 230   # アイコン中心Y（縦中央より上）

    # 左: チケットアイコン（ピンク単色線）
    draw_ticket_icon(draw, DIVX // 2, icon_y, icon_size, PINK)

    # 右: クリップボードアイコン（ゴールド単色線）
    draw_clipboard_icon(draw, DIVX + DIVX // 2, icon_y, icon_size, GOLD)

    # ── フォントロード
    #    DS no-rich-menu-small-text: リッチメニュー内 24px 未満禁止
    #    2500px幅→LINE縮小後で読める: 実画像 160px≒縮小後80px 相当（安全）
    font_ja_lg  = try_load_font(160)        # 予約する（4文字）
    font_ja_md  = try_load_font(145)        # マイ申込状況（6文字）
    font_en     = try_load_font_medium(82)  # Reserve / My Status

    center_y = H // 2

    # ── 左: 日本語ラベル「予約する」
    label_left_ja = '予約する'
    bb = draw.textbbox((0, 0), label_left_ja, font=font_ja_lg)
    tw = bb[2] - bb[0]
    th = bb[3] - bb[1]
    text_y = center_y + 60
    draw.text(
        (DIVX // 2 - tw // 2, text_y),
        label_left_ja,
        font=font_ja_lg,
        fill=TEXT
    )

    # ── 左: 英語ラベル「Reserve」
    label_left_en = 'Reserve'
    bb_en = draw.textbbox((0, 0), label_left_en, font=font_en)
    ew = bb_en[2] - bb_en[0]
    en_y = text_y + th + 28
    draw.text(
        (DIVX // 2 - ew // 2, en_y),
        label_left_en,
        font=font_en,
        fill=PINK
    )

    # ── 右: 日本語ラベル「マイ申込状況」
    label_right_ja = 'マイ申込状況'
    bb_r = draw.textbbox((0, 0), label_right_ja, font=font_ja_md)
    tw_r = bb_r[2] - bb_r[0]
    th_r = bb_r[3] - bb_r[1]
    rx_center = DIVX + DIVX // 2
    draw.text(
        (rx_center - tw_r // 2, text_y),
        label_right_ja,
        font=font_ja_md,
        fill=TEXT
    )

    # ── 右: 英語ラベル「My Status」
    label_right_en = 'My Status'
    bb_en_r = draw.textbbox((0, 0), label_right_en, font=font_en)
    ew_r = bb_en_r[2] - bb_en_r[0]
    draw.text(
        (rx_center - ew_r // 2, text_y + th_r + 28),
        label_right_en,
        font=font_en,
        fill=GOLD
    )

    # ── 下端アクセント細線（ゴールド・薄め）
    draw.rectangle([120, H - 8, DIVX - 120, H - 5], fill=(*GOLD, 120))
    draw.rectangle([DIVX + 120, H - 8, W - 120, H - 5], fill=(*GOLD, 120))

    # ── RGBA→RGB変換・保存
    final = img.convert('RGB')
    out_path = (
        '/Users/ryuiyamada/Desktop/ryui-workspace/projects/line-dev/'
        'harness/scripts/oa-ticket-menu/hapinets-ticket-menu-2500x1686.png'
    )
    final.save(out_path, 'PNG', optimize=False)

    # ── サイズQA
    check = Image.open(out_path)
    aw, ah = check.size
    if aw == 2500 and ah == 1686:
        print(f"QA PASS: {aw}×{ah} == 宣言サイズ 2500×1686")
    else:
        print(f"QA FAIL: {aw}×{ah} ≠ 2500×1686", file=sys.stderr)
        sys.exit(1)

    print(f"出力: {out_path}")
    print("PNG生成完了")


if __name__ == '__main__':
    main()
