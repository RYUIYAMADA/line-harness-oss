#!/usr/bin/env python3
"""
秋田ノーザンハピネッツ チケットメニュー PNG生成
サイズ: 2500×1686（LINE大サイズ仕様）
ブランドカラー: brand-colors.md 2026-06-14 正本
"""

from PIL import Image, ImageDraw, ImageFont
import sys
import os
import math

# ─────────────────────────────────────────────────────────
# ブランドトークン（brand-colors.md 正本）
# ─────────────────────────────────────────────────────────
PINK    = (228, 0,   115)  # #E40073 ハピネッツピンク（マゼンタ）
BLACK   = (0,   0,   0  )  # #000000 ノーザンブラック
GOLD    = (190, 138, 35 )  # #BE8A23 いなほゴールド
WHITE   = (255, 255, 255)
BG_BASE = (12,  12,  12 )  # 漆黒ベース

W = 2500
H = 1686
DIVX = W // 2  # 1250

def alpha_composite(base, overlay, alpha):
    """手動アルファ合成"""
    return tuple(int(b * (1 - alpha) + o * alpha) for b, o in zip(base, overlay))

def draw_panel_bg(draw, img, x, w, h, glow_color):
    """パネル背景グロー（ラジアルグロー風）"""
    cx = x + w // 2
    cy = h // 2
    # 簡易ラジアルグロー: 同心楕円を薄く塗り重ねる
    glow_img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_img)
    steps = 18
    for i in range(steps, 0, -1):
        radius = int(680 * i / steps)
        alpha_val = int(38 * (1 - i / steps))
        glow_draw.ellipse(
            [cx - radius, cy - 180 - radius,
             cx + radius, cy - 180 + radius],
            fill=(*glow_color, alpha_val)
        )
    img.alpha_composite(glow_img)

def draw_diagonal_pattern(draw, x, w, h, color_rgba):
    """斜めストライプ背景テクスチャ"""
    spacing = 80
    for i in range(-h, w + h, spacing):
        x1 = x + i
        y1 = 0
        x2 = x + i + h
        y2 = h
        # クリッピングして描画
        draw.line([(max(x, x1), y1 if x1 >= x else int(y1 + (x - x1))),
                   (min(x + w - 1, x2), y2 if x2 <= x + w else int(y2 - (x2 - (x + w))))],
                  fill=color_rgba, width=2)

def draw_ticket_icon(draw, cx, cy, size, color):
    """チケットアイコン（モノクロ線・itshoverスタイル）"""
    tw = int(size * 0.88)
    th = int(size * 0.56)
    tx = cx - tw // 2
    ty = cy - th // 2
    notch_r = int(th * 0.20)
    lw = max(4, int(size * 0.055))

    # メイン外枠
    draw.rectangle([tx, ty, tx + tw, ty + th], outline=color, width=lw)

    # 左ノッチ（半円）
    draw.arc([tx - notch_r, cy - notch_r, tx + notch_r, cy + notch_r],
             -90, 90, fill=color, width=lw)

    # 右ノッチ（半円）
    draw.arc([tx + tw - notch_r, cy - notch_r, tx + tw + notch_r, cy + notch_r],
             90, 270, fill=color, width=lw)

    # 破線区切り（縦線で代替）
    dash_x = int(tx + tw * 0.38)
    dash_y1 = ty + int(th * 0.14)
    dash_y2 = ty + th - int(th * 0.14)
    dash_len = 12
    dash_gap = 10
    y = dash_y1
    thin_lw = max(3, int(size * 0.038))
    while y < dash_y2:
        draw.line([(dash_x, y), (dash_x, min(y + dash_len, dash_y2))],
                  fill=color, width=thin_lw)
        y += dash_len + dash_gap

    # 右エリア: 右向き三角形（矢印）
    ax = int(cx + tw * 0.18)
    arr_s = int(th * 0.22)
    draw.polygon([
        (ax - int(arr_s * 0.6), cy - arr_s),
        (ax + int(arr_s * 0.6), cy),
        (ax - int(arr_s * 0.6), cy + arr_s),
    ], outline=color, width=max(3, int(size * 0.045)))

    # 左エリア: 横線3本
    lx1 = int(tx + tw * 0.06)
    lx2 = int(tx + tw * 0.32)
    thin_lw = max(3, int(size * 0.038))
    for dy in [-int(th * 0.22), 0, int(th * 0.22)]:
        draw.line([(lx1, cy + dy), (lx2, cy + dy)], fill=color, width=thin_lw)

def draw_clipboard_icon(draw, cx, cy, size, color):
    """クリップボードアイコン（モノクロ線・itshoverスタイル）"""
    bw = int(size * 0.72)
    bh = int(size * 0.88)
    bx = cx - bw // 2
    by = cy - bh // 2 + int(size * 0.08)
    cr = int(bw * 0.08)
    lw = max(4, int(size * 0.055))

    # ボード本体（角丸矩形）
    draw.rounded_rectangle([bx, by, bx + bw, by + bh], radius=cr, outline=color, width=lw)

    # クリップ（上部）
    clip_w = int(bw * 0.40)
    clip_h = int(size * 0.20)
    clip_x = cx - clip_w // 2
    clip_y = by - int(clip_h * 0.55)
    clip_lw = max(3, int(size * 0.050))
    draw.rounded_rectangle(
        [clip_x, clip_y, clip_x + clip_w, clip_y + clip_h],
        radius=clip_h // 2,
        outline=color,
        width=clip_lw
    )

    # チェックリスト3行
    lx1 = int(bx + bw * 0.14)
    lx2 = int(bx + bw * 0.86)
    ly0 = int(by + bh * 0.26)
    gap = int(bh * 0.20)
    cb_s = int(bh * 0.10)
    thin_lw = max(3, int(size * 0.045))

    for i in range(3):
        ly = ly0 + gap * i

        # チェックボックス
        draw.rectangle([lx1, ly - cb_s // 2, lx1 + cb_s, ly + cb_s // 2],
                       outline=color, width=thin_lw)

        # 1行目チェックマーク
        if i == 0:
            chk_lw = max(3, int(size * 0.038))
            draw.line([
                (int(lx1 + cb_s * 0.12), int(ly + cb_s * 0.05)),
                (int(lx1 + cb_s * 0.42), int(ly + cb_s * 0.28)),
                (int(lx1 + cb_s * 0.88), int(ly - cb_s * 0.20)),
            ], fill=color, width=chk_lw)

        # テキスト横線
        line_end = lx2 - int(bw * 0.14) if i == 2 else lx2
        draw.line(
            [(int(lx1 + cb_s + bw * 0.06), ly), (line_end, ly)],
            fill=color, width=thin_lw
        )

def draw_rounded_rect_outline(draw, x, y, w, h, r, color, width):
    """角丸矩形アウトライン"""
    draw.rounded_rectangle([x, y, x + w, y + h], radius=r, outline=color, width=width)

def try_load_font(size):
    """システムフォントを試みる"""
    candidates = [
        '/System/Library/Fonts/ヒラギノ角ゴシック W7.ttc',
        '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc',
        '/System/Library/Fonts/ヒラギノ角ゴシック W5.ttc',
        '/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc',
        '/System/Library/Fonts/Hiragino Sans GB.ttc',
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

def main():
    print("PNG生成開始: 2500×1686 ハピネッツブランドカラー適用版")

    img = Image.new('RGBA', (W, H), (*BG_BASE, 255))
    draw = ImageDraw.Draw(img)

    # ── ベース背景（漆黒）
    draw.rectangle([0, 0, W, H], fill=(*BG_BASE, 255))

    # ── 左右微差サブ背景
    # 左: ピンク極薄
    left_overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    left_draw = ImageDraw.Draw(left_overlay)
    left_draw.rectangle([0, 0, DIVX, H], fill=(*PINK, 14))
    img.alpha_composite(left_overlay)

    # 右: ゴールド極薄
    right_overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    right_draw = ImageDraw.Draw(right_overlay)
    right_draw.rectangle([DIVX, 0, W, H], fill=(*GOLD, 14))
    img.alpha_composite(right_overlay)

    # ── ラジアルグロー（左: ピンク、右: ゴールド）
    draw_panel_bg(draw, img, 0,    DIVX, H, PINK)
    draw_panel_bg(draw, img, DIVX, DIVX, H, GOLD)

    # ── 斜めストライプ
    stripe_overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    stripe_draw = ImageDraw.Draw(stripe_overlay)
    draw_diagonal_pattern(stripe_draw, 0,    DIVX, H, (255, 255, 255, 10))
    draw_diagonal_pattern(stripe_draw, DIVX, DIVX, H, (255, 255, 255, 10))
    img.alpha_composite(stripe_overlay)

    draw = ImageDraw.Draw(img)

    # ── 上端アクセントバー（ピンク: 左 / ゴールド: 右）
    draw.rectangle([80,        0, DIVX - 80, 12], fill=PINK)
    draw.rectangle([DIVX + 80, 0, W    - 80, 12], fill=GOLD)

    # ── 下端アクセント細線（ゴールド）
    draw.rectangle([60,        H - 8, DIVX - 60, H - 5], fill=(*GOLD, 140))
    draw.rectangle([DIVX + 60, H - 8, W    - 60, H - 5], fill=(*GOLD, 140))

    # ── 中央分割線
    overlay_div = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    div_draw = ImageDraw.Draw(overlay_div)
    div_draw.line([(DIVX, 30), (DIVX, H - 30)], fill=(255, 255, 255, 46), width=3)
    div_draw.line([(DIVX, 0),  (DIVX, H)],       fill=(*GOLD, 140), width=2)
    img.alpha_composite(overlay_div)

    draw = ImageDraw.Draw(img)

    # ── アイコン描画
    icon_size = 300
    icon_y_left  = H // 2 - 205
    icon_y_right = H // 2 - 205

    # 左: チケットアイコン（ピンク）
    icon_overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    icon_draw = ImageDraw.Draw(icon_overlay)
    draw_ticket_icon(icon_draw, DIVX // 2, icon_y_left, icon_size, (*PINK, 255))
    img.alpha_composite(icon_overlay)

    # 右: クリップボードアイコン（ゴールド）
    icon_overlay2 = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    icon_draw2 = ImageDraw.Draw(icon_overlay2)
    draw_clipboard_icon(icon_draw2, DIVX + DIVX // 2, icon_y_right, icon_size, (*GOLD, 255))
    img.alpha_composite(icon_overlay2)

    draw = ImageDraw.Draw(img)

    # ── フォントロード
    font_ja_left  = try_load_font(165)   # 予約する (4文字)
    font_ja_right = try_load_font(148)   # マイ申込状況 (7文字)
    font_en       = try_load_font_medium(86)
    font_footer   = try_load_font_medium(34)

    center_y = H // 2

    # ── 左: 日本語ラベル「予約する」
    label_ja_left = '予約する'
    bbox = draw.textbbox((0, 0), label_ja_left, font=font_ja_left)
    lw_left = bbox[2] - bbox[0]
    draw.text(
        (DIVX // 2 - lw_left // 2, center_y + 100 - (bbox[3] - bbox[1])),
        label_ja_left,
        font=font_ja_left,
        fill=WHITE
    )

    # ── 左: 英語ラベル「Reserve」
    label_en_left = 'Reserve'
    bbox_en = draw.textbbox((0, 0), label_en_left, font=font_en)
    ew_left = bbox_en[2] - bbox_en[0]
    draw.text(
        (DIVX // 2 - ew_left // 2, center_y + 220 - (bbox_en[3] - bbox_en[1])),
        label_en_left,
        font=font_en,
        fill=(*PINK, 230)
    )

    # ── 右: 日本語ラベル「マイ申込状況」
    label_ja_right = 'マイ申込状況'
    bbox_r = draw.textbbox((0, 0), label_ja_right, font=font_ja_right)
    lw_right = bbox_r[2] - bbox_r[0]
    rx_center = DIVX + DIVX // 2
    draw.text(
        (rx_center - lw_right // 2, center_y + 100 - (bbox_r[3] - bbox_r[1])),
        label_ja_right,
        font=font_ja_right,
        fill=WHITE
    )

    # ── 右: 英語ラベル「My Status」
    label_en_right = 'My Status'
    bbox_en_r = draw.textbbox((0, 0), label_en_right, font=font_en)
    ew_right = bbox_en_r[2] - bbox_en_r[0]
    draw.text(
        (rx_center - ew_right // 2, center_y + 220 - (bbox_en_r[3] - bbox_en_r[1])),
        label_en_right,
        font=font_en,
        fill=(*GOLD, 230)
    )

    # ── CTAボタン外枠（角丸矩形アウトライン）
    btn_w = DIVX - 260
    btn_h = 148
    btn_y  = center_y + 265

    # 左ボタン
    btn_overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    btn_draw = ImageDraw.Draw(btn_overlay)
    bx_left = 130
    btn_draw.rounded_rectangle(
        [bx_left, btn_y, bx_left + btn_w, btn_y + btn_h],
        radius=38,
        outline=(*PINK, 165),
        width=5
    )

    # 右ボタン
    bx_right = DIVX + 130
    btn_draw.rounded_rectangle(
        [bx_right, btn_y, bx_right + btn_w, btn_y + btn_h],
        radius=38,
        outline=(*GOLD, 165),
        width=5
    )

    # ボタン内 矢印
    def draw_arrow(d, acx, acy, color_a):
        arr_s = 28
        d.polygon([
            (acx - int(arr_s * 0.7), acy - arr_s),
            (acx + int(arr_s * 0.9), acy),
            (acx - int(arr_s * 0.7), acy + arr_s),
        ], fill=(*color_a[:3], 200))

    draw_arrow(btn_draw, DIVX // 2,              btn_y + btn_h // 2, PINK)
    draw_arrow(btn_draw, DIVX + DIVX // 2,       btn_y + btn_h // 2, GOLD)

    img.alpha_composite(btn_overlay)
    draw = ImageDraw.Draw(img)

    # ── フッター
    footer_h = 90
    footer_overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    footer_draw = ImageDraw.Draw(footer_overlay)
    for i in range(footer_h):
        alpha = int(190 * i / footer_h)
        footer_draw.line([(0, H - footer_h + i), (W, H - footer_h + i)],
                         fill=(0, 0, 0, alpha))
    img.alpha_composite(footer_overlay)

    draw = ImageDraw.Draw(img)

    # フッターブランド名
    footer_text = 'AKITA NORTHERN HAPPINETS'
    bbox_f = draw.textbbox((0, 0), footer_text, font=font_footer)
    fw = bbox_f[2] - bbox_f[0]
    fh = bbox_f[3] - bbox_f[1]
    draw.text(
        (W // 2 - fw // 2, H - 44 - fh // 2),
        footer_text,
        font=font_footer,
        fill=(255, 255, 255, 102)
    )

    # ゴールドドット
    dot_y = H - 44
    dot_r = 4
    draw.ellipse([W//2 - 320 - dot_r, dot_y - dot_r, W//2 - 320 + dot_r, dot_y + dot_r],
                 fill=(*GOLD, 140))
    draw.ellipse([W//2 + 320 - dot_r, dot_y - dot_r, W//2 + 320 + dot_r, dot_y + dot_r],
                 fill=(*GOLD, 140))

    # ── RGBAをRGBに変換して保存
    final = img.convert('RGB')
    out_path = '/Users/ryuiyamada/Desktop/ryui-workspace/projects/line-dev/harness/scripts/oa-ticket-menu/hapinets-ticket-menu-2500x1686.png'
    final.save(out_path, 'PNG', optimize=False)

    # ── QAチェック（サイズ確認）
    check = Image.open(out_path)
    actual_w, actual_h = check.size
    if actual_w == 2500 and actual_h == 1686:
        print(f"QA PASS: 実サイズ {actual_w}×{actual_h} == 宣言サイズ 2500×1686")
    else:
        print(f"QA FAIL: 実サイズ {actual_w}×{actual_h} ≠ 2500×1686", file=sys.stderr)
        sys.exit(1)

    print(f"出力: {out_path}")
    print("PNG生成完了")

if __name__ == '__main__':
    main()
