"""Recorta e alinha o andar dos 14 (frente e costas), monta a vitrine e o GIF com todos andando no hall."""
import sys
from PIL import Image, ImageDraw, ImageFont

S = sys.argv[1]
exec(open(S + "/ia/recortar.py", encoding="utf-8").read().split("todos = {}")[0]
     .replace("PASTA, FUNDO_HALL = sys.argv[1], sys.argv[2]", "PASTA = ''"))

ALT = 190
QUADROS = {}  # n -> {"frente": [(img, centro_cabeca)], "costas": [...]}
for n in NOMES:
    QUADROS[n] = {}
    for lado in ("frente", "costas"):
        arq = f"{S}/ia/andar2-{lado}.png" if n == 4 else f"{S}/ia/andar-{lado}-{n}.png"
        try:
            ps = poses(sem_fundo(Image.open(arq)))[:4]
        except FileNotFoundError:
            print("falta", n, lado)
            continue
        if len(ps) < 4:
            print("poucos quadros", n, lado, len(ps))
            continue
        f = ALT / max(p.height for p in ps)
        alin = []
        for k, p in enumerate(ps):
            q = p.resize((round(p.width * f), round(p.height * f)), Image.LANCZOS)
            a = q.getchannel("A").load()
            topo = next(y for y in range(q.height) if any(a[x, y] for x in range(q.width)))
            xs = [x for y in range(topo, topo + int(q.height * .3)) for x in range(q.width) if a[x, y]]
            alin.append((q, sum(xs) / len(xs)))
            q.save(f"{S}/ia/andar-q-{n}-{lado}-{k}.png")
        QUADROS[n][lado] = alin
print({NOMES[n]: list(v) for n, v in QUADROS.items()})

# vitrine: cada nanico com 4 quadros de frente e 4 de costas
F = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 15)
A2, CEL = 120, 74
viz = Image.new("RGB", (30 + 4 * (8 * CEL + 40), 30 + 4 * (A2 + 50)), "#2E2E2D")
d = ImageDraw.Draw(viz)
for idx, (n, q) in enumerate(QUADROS.items()):
    c, r = idx % 4, idx // 4
    x0, y0 = 26 + c * (8 * CEL + 40), 24 + r * (A2 + 50)
    d.rounded_rectangle((x0 - 8, y0 - 8, x0 + 8 * CEL + 8, y0 + A2 + 30), 12, fill="#3E4C59")
    k = 0
    for lado in ("frente", "costas"):
        for im, _c in q.get(lado, []):
            s = im.resize((round(im.width * A2 / ALT), round(im.height * A2 / ALT)), Image.LANCZOS)
            viz.paste(s, (x0 + k * CEL + (CEL - s.width) // 2, y0 + A2 - s.height), s)
            k += 1
    d.text((x0 + 4 * CEL, y0 + A2 + 14), NOMES[n], fill="#D8B887", font=F, anchor="mm")
viz.save(f"{S}/ia/andar-todos.png")


# GIF: todos andando em volta do hall, cada um no seu ritmo
hall = Image.open(S + "/hall-vazio15.png").convert("RGBA")
Z = 1.5
P = lambda i, j: ((560 + (i - j) * 40) * Z, (318 + (i + j) * 20) * Z)
volta = [(3.4, 2.4), (7.2, 2.4), (7.2, 5.6), (3.4, 5.6)]


def ponto(t):
    """Posição e sentido ao longo da volta (t em 'passos' de 0,1 piso)."""
    lados = []
    for a, b in zip(volta, volta[1:] + volta[:1]):
        di, dj = b[0] - a[0], b[1] - a[1]
        n = round(max(abs(di), abs(dj)) / .1)
        s = "SE" if di > 0 else "SW" if dj > 0 else "NW" if di < 0 else "NE"
        lados += [(a[0] + di * k / n, a[1] + dj * k / n, s) for k in range(n)]
    return lados[t % len(lados)], len(lados)


_, total = ponto(0)
fonte = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 13)
andam = [4, 1, 12, 11, 5, 14]
parados = [n for n in QUADROS if n not in andam]
lugares = [(1.6, 2.4), (1.8, 4.2), (2.0, 6.4), (8.8, 1.8), (9.8, 3.0), (9.2, 6.6), (5.0, 7.6), (6.8, 7.8)]
fixos = []
for n, (i, j) in zip(parados, lugares):
    p = Image.open(f"{S}/ia/pose-{n}-{(n % 2)}.png")
    p = p.resize((round(p.width * ALT / p.height), ALT), Image.LANCZOS)
    fixos.append((i, j, p, p.width / 2, NOMES[n]))
gif = []
for t in range(total):
    fr = hall.copy()
    d = ImageDraw.Draw(fr)
    gente = list(fixos)
    for k, n in enumerate(andam):
        (i, j, s), _ = ponto(t + k * total // len(andam))
        q, cab = QUADROS[n]["frente" if s in ("SE", "SW") else "costas"][(t // 2 + k) % 4]
        if s in ("SW", "NW"):
            q, cab = q.transpose(Image.FLIP_LEFT_RIGHT), q.width - cab
        gente.append((i, j, q, cab, NOMES[n]))
    for i, j, q, cab, nome in sorted(gente, key=lambda g: g[0] + g[1]):
        x, y = P(i, j)
        d.ellipse((x - 26, y - 7, x + 26, y + 7), fill=(0, 0, 0, 55))
        fr.alpha_composite(q, (int(x - cab), int(y - q.height + 8)))
    for i, j, q, cab, nome in gente:
        x, y = P(i, j)
        w = len(nome) * 9 + 14
        d.rounded_rectangle((x - w / 2, y - ALT - 18, x + w / 2, y - ALT), 5, fill=(38, 38, 38, 210))
        d.text((x, y - ALT - 9), nome.upper(), fill="#C4A06A", font=fonte, anchor="mm")
    gif.append(fr.crop((300, 120, 1640, 1080)).convert("RGB"))
pal = gif[0].quantize(96, dither=Image.Dither.NONE)
gif = [g.quantize(palette=pal, dither=Image.Dither.NONE) for g in gif]
gif[0].save(f"{S}/ia/todos-andando.gif", save_all=True, append_images=gif[1:], duration=120, loop=0, optimize=True)
gif[20].convert("RGB").save(f"{S}/ia/ver50.png")
print("ok", len(gif))
