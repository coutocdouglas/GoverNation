"""Gera retratos provisórios (111.webp em diante) no estilo dos retratos do jogo: busto ilustrado, 192x192.
São placeholders: o Douglas melhora numa IA de imagem e devolve com o mesmo nome de arquivo.
Uso: python3 scripts/retratos-provisorios.py  (lista em SPECS; mesmo resultado sempre)."""
import random
from PIL import Image, ImageDraw, ImageFilter

SKINS = ['#f1c9a5', '#e0ac85', '#c68b62', '#a8704a', '#8a5636', '#5f3a24']
HAIRS = ['#1d1612', '#3b2618', '#6b4428', '#a07040', '#cfc6bb', '#8e8a86']
SUITS = ['#1f2a44', '#2d3a2e', '#3a2a3f', '#40342a', '#22313a', '#4a1f24', '#2b2b30']
BGS = [('#1b3b5a', '#0f1d2c'), ('#3a2d4f', '#1a1426'), ('#2d4a3a', '#13241b'), ('#4a3a24', '#221a10'), ('#4a2430', '#22101a'), ('#24414a', '#0f2026')]

# (id, gênero, idade j/m/o, extras)
SPECS = []
for i in range(30):
    g = 'f' if i % 2 else 'm'
    age = 'jmmo'[i % 4]
    SPECS.append((111 + i, g, age))

def hexrgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def shade(c, k):
    r, g, b = hexrgb(c) if isinstance(c, str) else c
    return (max(0, min(255, int(r * k))), max(0, min(255, int(g * k))), max(0, min(255, int(b * k))))

def portrait(pid, g, age):
    rnd = random.Random(pid * 7919)
    S = 384  # desenha em 2x e reduz
    im = Image.new('RGBA', (S, S))
    d = ImageDraw.Draw(im)
    top, bot = BGS[rnd.randrange(len(BGS))]
    for y in range(S):
        t = y / S
        a, b = hexrgb(top), hexrgb(bot)
        d.line([(0, y), (S, y)], fill=tuple(int(a[k] + (b[k] - a[k]) * t) for k in range(3)) + (255,))
    skin = SKINS[rnd.randrange(len(SKINS))]
    hair = HAIRS[4 + rnd.randrange(2)] if age == 'o' else HAIRS[rnd.randrange(4)]
    suit = SUITS[rnd.randrange(len(SUITS))]
    cx = S // 2
    # cabelo longo atrás de tudo
    long_hair = g == 'f' and rnd.random() < 0.75
    if long_hair:
        d.rounded_rectangle([cx - 95, 80, cx + 95, 300], 80, fill=hair)
    # ombros e roupa
    d.ellipse([cx - 175, 270, cx + 175, 520], fill=suit)
    if g == 'm':
        d.polygon([(cx - 40, 280), (cx + 40, 280), (cx, 360)], fill='#f2f2f2')
        tie = ['#8b1e2d', '#1e3f8b', '#2d6b3a', '#6b5a1e'][rnd.randrange(4)]
        d.polygon([(cx - 10, 292), (cx + 10, 292), (cx + 16, 350), (cx, 368), (cx - 16, 350)], fill=tie)
        d.polygon([(cx - 70, 275), (cx - 8, 285), (cx - 30, 380)], fill=shade(suit, 0.75))
        d.polygon([(cx + 70, 275), (cx + 8, 285), (cx + 30, 380)], fill=shade(suit, 0.75))
    else:
        d.polygon([(cx - 55, 278), (cx + 55, 278), (cx, 345)], fill=shade(skin, 0.92))
        if rnd.random() < 0.6:
            d.arc([cx - 50, 290, cx + 50, 350], 20, 160, fill='#e8d9a8', width=4)  # colar
    # pescoço
    d.rectangle([cx - 32, 225, cx + 32, 290], fill=shade(skin, 0.88))
    # cabelo atrás (mulheres, cabelo longo)
    # rosto
    fw, fh = (78, 98) if g == 'm' else (72, 92)
    d.ellipse([cx - fw, 150 - fh + 10, cx + fw, 150 + fh + 10], fill=skin)
    # orelhas
    d.ellipse([cx - fw - 12, 150, cx - fw + 10, 195], fill=shade(skin, 0.93))
    d.ellipse([cx + fw - 10, 150, cx + fw + 12, 195], fill=shade(skin, 0.93))
    # cabelo frente
    bald = g == 'm' and age == 'o' and rnd.random() < 0.5
    if not bald:
        if g == 'm':
            d.chord([cx - fw - 6, 52, cx + fw + 6, 200], 180, 360, fill=hair)
            d.rectangle([cx - fw - 4, 118, cx - fw + 14, 165], fill=hair)
            d.rectangle([cx + fw - 14, 118, cx + fw + 4, 165], fill=hair)
        else:
            d.chord([cx - fw - 10, 48, cx + fw + 10, 210], 180, 360, fill=hair)
            side = rnd.choice([-1, 1])
            d.pieslice([cx - fw - 10, 48, cx + fw + 10, 230], 200 if side < 0 else 250, 290 if side < 0 else 340, fill=hair)
    else:
        d.chord([cx - fw - 4, 120, cx - fw + 22, 190], 90, 270, fill=hair)
        d.chord([cx + fw - 22, 120, cx + fw + 4, 190], 270, 90, fill=hair)
    # olhos, sobrancelhas, nariz, boca
    ey = 158
    for sx in (-1, 1):
        ex = cx + sx * 30
        d.ellipse([ex - 11, ey - 7, ex + 11, ey + 7], fill='#ffffff')
        d.ellipse([ex - 6, ey - 6, ex + 6, ey + 6], fill='#2a1d14')
        d.line([(ex - 16, ey - 20 - (3 if age == 'o' else 0)), (ex + 14, ey - 22)], fill=shade(hair if not bald else '#555555', 0.9), width=6)
    d.line([(cx, ey + 8), (cx - 7, ey + 38), (cx + 5, ey + 40)], fill=shade(skin, 0.7), width=4)
    smile = rnd.random() < 0.6
    if smile:
        d.arc([cx - 26, ey + 40, cx + 26, ey + 72], 20, 160, fill='#7a3b33', width=5)
    else:
        d.line([(cx - 20, ey + 60), (cx + 20, ey + 60)], fill='#7a3b33', width=5)
    if g == 'f':
        d.arc([cx - 24, ey + 42, cx + 24, ey + 70], 20, 160, fill='#a8424a', width=7) if smile else None
    if age == 'o':
        d.arc([cx - 50, ey + 20, cx - 20, ey + 60], 200, 260, fill=shade(skin, 0.8), width=3)
        d.arc([cx + 20, ey + 20, cx + 50, ey + 60], 280, 340, fill=shade(skin, 0.8), width=3)
    if g == 'm' and rnd.random() < 0.35:
        d.chord([cx - fw + 6, 150, cx + fw - 6, 262], 10, 170, fill=shade(hair, 1.0))  # barba
        d.arc([cx - 26, ey + 40, cx + 26, ey + 72], 20, 160, fill='#7a3b33', width=5)
    if rnd.random() < 0.35:
        for sx in (-1, 1):
            ex = cx + sx * 30
            d.rounded_rectangle([ex - 20, ey - 15, ex + 20, ey + 15], 8, outline='#111111', width=4)
        d.line([(cx - 10, ey), (cx + 10, ey)], fill='#111111', width=4)
    # selo de provisório
    d.rounded_rectangle([S - 92, S - 40, S - 10, S - 12], 10, fill=(0, 0, 0, 150))
    d.text((S - 84, S - 34), 'PROV.', fill=(255, 220, 120, 255))
    im = im.filter(ImageFilter.SMOOTH).resize((192, 192), Image.LANCZOS)
    # recorte redondo suave, como os outros retratos ficam no jogo (o jogo já recorta em círculo)
    return im

if __name__ == '__main__':
    import os
    out = os.path.join(os.path.dirname(__file__), '..', 'public', 'portraits')
    for pid, g, age in SPECS:
        portrait(pid, g, age).save(os.path.join(out, f'{pid:03d}.webp'), 'WEBP', quality=90)
    print(len(SPECS), 'retratos provisórios gerados')
