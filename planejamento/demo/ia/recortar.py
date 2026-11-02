"""Recorta as 4 poses de cada imagem gerada (tira o fundo cinza) e monta a vitrine e o hall."""
import sys
from collections import deque
from PIL import Image, ImageDraw, ImageFont

PASTA, FUNDO_HALL = sys.argv[1], sys.argv[2]  # pasta com ia-<n>.png e o fundo do hall em 1,5x
NOMES = {1: "Abreutz", 2: "Alemão", 3: "DD", 4: "Gamer", 5: "Grito", 6: "Guiperino", 7: "Le Bubu",
         8: "Henry", 9: "Pitoco", 10: "John", 11: "Veião", 12: "Max", 13: "Gordão", 14: "Pin"}


def sem_fundo(im):
    im = im.convert("RGBA")
    W, H = im.size
    px = im.load()
    ref = px[2, 2]

    def fundo(c):
        return abs(c[0] - ref[0]) + abs(c[1] - ref[1]) + abs(c[2] - ref[2]) < 40 and max(c[:3]) - min(c[:3]) < 22
    vis = bytearray(W * H)
    q = deque([(x, 0) for x in range(W)] + [(x, H - 1) for x in range(W)] + [(0, y) for y in range(H)] + [(W - 1, y) for y in range(H)])
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= W or y >= H or vis[y * W + x] or not fundo(px[x, y]):
            continue
        vis[y * W + x] = 1
        px[x, y] = (0, 0, 0, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return im


def poses(im):
    W, H = im.size
    a = im.getchannel("A").load()
    cols = [sum(1 for y in range(H) if a[x, y]) > 2 for x in range(W)]
    out, x = [], 0
    while x < W:
        if cols[x]:
            s = x
            while x < W and cols[x]:
                x += 1
            if x - s > 40:
                p = im.crop((s, 0, x, H))
                out.append(p.crop(p.getbbox()))
        x += 1
    return out


todos = {}
for n, nome in NOMES.items():
    try:
        im = Image.open(f"{PASTA}/ia-{n}.png")
    except FileNotFoundError:
        print("falta", nome)
        continue
    ps = poses(sem_fundo(im))
    print(nome, len(ps), [p.size for p in ps])
    if len(ps) >= 4:
        todos[nome] = ps[:4]
        for k, p in enumerate(ps[:4]):
            p.save(f"{PASTA}/pose-{n}-{k}.png")

# vitrine: 14 nanicos, 4 sentidos cada
F = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 16)
ALT = 170
cel = 96
viz = Image.new("RGB", (40 + 7 * (4 * cel + 30), 40 + 2 * (ALT + 60)), "#2E2E2D")
d = ImageDraw.Draw(viz)
for idx, (nome, ps) in enumerate(todos.items()):
    c, r = idx % 7, idx // 7
    x0, y0 = 30 + c * (4 * cel + 30), 30 + r * (ALT + 60)
    d.rounded_rectangle((x0 - 8, y0 - 8, x0 + 4 * cel + 8, y0 + ALT + 36), 12, fill="#3E4C59")
    for k, p in enumerate(ps):
        q = p.resize((round(p.width * ALT / p.height), ALT), Image.LANCZOS)
        viz.paste(q, (x0 + k * cel + (cel - q.width) // 2, y0), q)
    d.text((x0 + 2 * cel, y0 + ALT + 16), nome, fill="#D8B887", font=F, anchor="mm")
viz.save(f"{PASTA}/nanicos-ia.png")

# hall com todos (alternando os sentidos)
hall = Image.open(FUNDO_HALL).convert("RGBA")
Z = 1.5
P = lambda i, j: ((560 + (i - j) * 40) * Z, (318 + (i + j) * 20) * Z)
lugares = [(1.6, 2.2), (3.0, 2.0), (4.4, 2.4), (5.8, 2.6), (2.0, 3.8), (3.6, 3.6), (5.2, 3.9), (6.6, 3.7),
           (8.6, 2.6), (9.6, 3.6), (2.6, 5.4), (4.4, 5.4), (8.2, 6.0), (9.8, 5.2)]
fonte = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 14)
dr = ImageDraw.Draw(hall)
gente = [(lugares[k][0], lugares[k][1], nome, ps[k % 4]) for k, (nome, ps) in enumerate(todos.items()) if k < len(lugares)]
for i, j, nome, sp in sorted(gente, key=lambda g: g[0] + g[1]):
    alt = 190
    sp = sp.resize((round(sp.width * alt / sp.height), alt), Image.LANCZOS)
    x, y = P(i, j)
    dr.ellipse((x - 30, y - 8, x + 30, y + 8), fill=(0, 0, 0, 60))
    hall.alpha_composite(sp, (int(x - sp.width / 2), int(y - sp.height + 8)))
    w = len(nome) * 10 + 18
    dr.rounded_rectangle((x - w / 2, y - alt - 20, x + w / 2, y - alt), 6, fill=(38, 38, 38, 220))
    dr.text((x, y - alt - 10), nome.upper(), fill="#C4A06A", font=fonte, anchor="mm")
hall.crop((300, 120, 1640, 1080)).convert("RGB").save(f"{PASTA}/hall-nanicos-ia.png")
print("ok", len(todos))
