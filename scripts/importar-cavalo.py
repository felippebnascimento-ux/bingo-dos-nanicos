"""
Importa a folha do cavalo de corrida (05/11/2026) para public/arte/corrida/.

A folha vem da ferramenta de imagem: 8 quadros do galope numa grade 4 x 2, fundo verde (#00FF00; o branco antigo também serve), o cavalo virado para a
esquerda e a seda do jóquei, o capacete, o capuz e o pano da sela em magenta (#FF00FF). Aqui:
  1. o fundo sai: o verde inteiro (com a franja da borda) ou o branco a partir das bordas;
  2. cada quadro é achado pelos pixels que sobraram e vai para a célula da grade pelo centro;
  3. os quadros são espelhados (o cavalo corre para a direita) e postos lado a lado numa fita, todos na mesma escala,
     alinhados pelo pano da sela (que anda junto com o corpo);
  4. o magenta vira cinza (o claro e o escuro da dobra) e sai também uma máscara só com ele: na tela, a cor da raia
     é pintada por cima, multiplicando, então a seda fica na cor da raia com a mesma sombra.

Uso (precisa do Pillow), da raiz do projeto:
  python3 scripts/importar-cavalo.py ~/Downloads/cavalo.webp castanho
Sai public/arte/corrida/cavalo-<pelagem>.webp e, se ainda não existir, public/arte/corrida/cavalo-seda.webp.
"""
import os
import sys
from collections import deque
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
DESTINO = os.path.join(AQUI, "..", "public", "arte", "corrida")
QW, QH = 400, 280   # tamanho de cada quadro na fita
QUADROS = 8


def fundo(p):
    r, g, b, a = p
    return a > 0 and min(r, g, b) >= 232 and max(r, g, b) - min(r, g, b) <= 14


def tira_fundo(im):
    px = im.load(); W, H = im.size
    visto = bytearray(W * H); q = deque()
    for x in range(W):
        for y in (0, H - 1):
            if fundo(px[x, y]): visto[y * W + x] = 1; q.append((x, y))
    for y in range(H):
        for x in (0, W - 1):
            if fundo(px[x, y]) and not visto[y * W + x]: visto[y * W + x] = 1; q.append((x, y))
    while q:
        x, y = q.popleft(); px[x, y] = (0, 0, 0, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and not visto[ny * W + nx] and fundo(px[nx, ny]):
                visto[ny * W + nx] = 1; q.append((nx, ny))
    # a franja clara que sobra em volta (antisserrilhado com o branco) fica meio transparente
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a and min(r, g, b) >= 215 and max(r, g, b) - min(r, g, b) <= 18:
                if any(0 <= x + dx < W and 0 <= y + dy < H and px[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    px[x, y] = (r, g, b, 90)
    return im


def tira_verde(im):
    """Fundo verde (#00FF00): sai todo pixel verde, e a franja meio verde da borda perde o verde e fica meio transparente."""
    px = im.load(); W, H = im.size
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            dom = g - max(r, b)
            if dom > 70 and g > 120:
                px[x, y] = (0, 0, 0, 0)
            elif dom > 18:
                # mistura com o fundo: tira o verde e deixa transparente na mesma medida
                t = min(1.0, (dom - 18) / 70)
                px[x, y] = (r, max(r, b), b, round(a * (1 - t)))
    return im


def magenta(p):
    """Quanto o pixel é magenta (0 a 1)."""
    r, g, b, a = p
    if a == 0: return 0.0
    m = min(r, b) - g
    if m <= 18 or abs(r - b) > 90: return 0.0
    return max(0.0, min(1.0, (m - 18) / 50))


def quadros(im):
    W, H = im.size
    a = im.split()[3].load()
    visto = bytearray(W * H)
    grupos = [[[] for _ in range(4)] for _ in range(2)]
    for y in range(H):
        for x in range(W):
            if a[x, y] and not visto[y * W + x]:
                comp = []; q = deque([(x, y)]); visto[y * W + x] = 1
                while q:
                    cx, cy = q.popleft(); comp.append((cx, cy))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            nx, ny = cx + dx, cy + dy
                            if 0 <= nx < W and 0 <= ny < H and not visto[ny * W + nx] and a[nx, ny]:
                                visto[ny * W + nx] = 1; q.append((nx, ny))
                if len(comp) < 30: continue
                mx = sum(c[0] for c in comp) / len(comp); my = sum(c[1] for c in comp) / len(comp)
                grupos[min(1, int(my / (H / 2)))][min(3, int(mx / (W / 4)))].extend(comp)
    s = im.load(); out = []
    for linha in grupos:
        for comp in linha:
            xs = [c[0] for c in comp]; ys = [c[1] for c in comp]
            x0, y0 = min(xs), min(ys)
            q = Image.new("RGBA", (max(xs) - x0 + 1, max(ys) - y0 + 1), (0, 0, 0, 0)); o = q.load()
            for x, y in comp: o[x - x0, y - y0] = s[x, y]
            out.append(q.transpose(Image.FLIP_LEFT_RIGHT))
    return out


def ancora(q):
    """O centro do pano da sela: o magenta da metade de baixo do que é magenta."""
    px = q.load(); W, H = q.size
    pts = [(x, y) for y in range(H) for x in range(W) if magenta(px[x, y]) > 0.5]
    ys = sorted(p[1] for p in pts)
    corte = ys[int(len(ys) * 0.55)]
    baixo = [p for p in pts if p[1] >= corte]
    return sum(p[0] for p in baixo) / len(baixo), sum(p[1] for p in baixo) / len(baixo)


def tira_vaos(q):
    """O branco do fundo que ficou preso (embaixo da barriga, entre as pernas e entre os fios do rabo): manchas de branco
    puro fechadas. A calça do jóquei (em cima, no meio) e as meias pequenas das patas ficam."""
    px = q.load(); W, H = q.size
    branco = lambda p: p[3] > 0 and min(p[:3]) >= 238 and max(p[:3]) - min(p[:3]) <= 14
    visto = bytearray(W * H)
    for y0 in range(H):
        for x0 in range(W):
            if visto[y0 * W + x0] or not branco(px[x0, y0]) or magenta(px[x0, y0]) > 0: continue
            comp = []; fila = deque([(x0, y0)]); visto[y0 * W + x0] = 1
            while fila:
                x, y = fila.popleft(); comp.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < W and 0 <= ny < H and not visto[ny * W + nx] and branco(px[nx, ny]):
                        visto[ny * W + nx] = 1; fila.append((nx, ny))
            cx = sum(c[0] for c in comp) / len(comp); cy = sum(c[1] for c in comp) / len(comp)
            # o quadro já está virado para a direita: o jóquei fica no meio, em cima; o rabo, à esquerda
            joquei = 0.3 * W < cx < 0.7 * W and cy < 0.42 * H
            barriga = cy > 0.45 * H and len(comp) >= 60
            rabo = cx < 0.28 * W and len(comp) >= 12
            if not joquei and (barriga or rabo):
                for c in comp:
                    px[c] = (0, 0, 0, 0)
                    # a franja clara em volta da mancha também sai
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            nx, ny = c[0] + dx, c[1] + dy
                            if 0 <= nx < W and 0 <= ny < H:
                                p = px[nx, ny]
                                if p[3] and min(p[:3]) >= 200 and max(p[:3]) - min(p[:3]) <= 24: px[nx, ny] = (0, 0, 0, 0)
    return q


def importar(origem, pelagem):
    im = Image.open(origem).convert("RGBA")
    c = im.getpixel((2, 2))
    im = tira_verde(im) if c[1] - max(c[0], c[2]) > 70 else tira_fundo(im)
    qs = quadros(im)
    assert len(qs) == QUADROS, f"achei {len(qs)} quadros"
    # a ordem que forma a passada (a folha gerada não vem na ordem certa); --ordem 0,3,2,...
    ordem = next((a.split("=")[1] for a in sys.argv if a.startswith("--ordem=")), None)
    if ordem: qs = [qs[int(k)] for k in ordem.split(",")]
    qs = [tira_vaos(q) for q in qs]
    # escala: o maior quadro cabe no quadro da fita com folga
    esc = min(min((QW - 16) / q.width, (QH - 12) / q.height) for q in qs)
    ancs = [ancora(q) for q in qs]
    # o pano fica no mesmo ponto em todos; o ponto é escolhido para o quadro mais largo caber
    ax = max(a[0] for a in ancs) * esc + 8
    ay = max(a[1] for a in ancs) * esc + 6
    fita = Image.new("RGBA", (QW * QUADROS, QH), (0, 0, 0, 0))
    seda = Image.new("L", (QW * QUADROS, QH), 0)
    for k, (q, (cx, cy)) in enumerate(zip(qs, ancs)):
        q = q.resize((round(q.width * esc), round(q.height * esc)), Image.LANCZOS)
        x = round(ax - cx * esc); y = round(ay - cy * esc)
        px = q.load(); m = Image.new("L", q.size, 0); mp = m.load()
        for yy in range(q.height):
            for xx in range(q.width):
                p = px[xx, yy]; t = magenta(p)
                if t > 0:
                    v = max(p[0], p[2])
                    cinza = round(v * t + (p[0] + p[1] + p[2]) / 3 * (1 - t))
                    px[xx, yy] = (cinza, cinza, cinza, p[3])
                    mp[xx, yy] = round(255 * t * p[3] / 255)
        fita.alpha_composite(q.crop((max(0, -x), max(0, -y), q.width, q.height)), (k * QW + max(0, x), max(0, y)))
        seda.paste(m.crop((max(0, -x), max(0, -y), q.width, q.height)), (k * QW + max(0, x), max(0, y)))
    os.makedirs(DESTINO, exist_ok=True)
    fita.save(os.path.join(DESTINO, f"cavalo-{pelagem}.webp"), "WEBP", quality=90, method=6)
    caminho_seda = os.path.join(DESTINO, "cavalo-seda.webp")
    if not os.path.exists(caminho_seda) or "--seda" in sys.argv:
        Image.merge("RGBA", (seda, seda, seda, seda)).save(caminho_seda, "WEBP", quality=90, method=6)
    print("ok", pelagem, fita.size, "escala", round(esc, 3))


if __name__ == "__main__":
    importar(os.path.expanduser(sys.argv[1]), sys.argv[2])
