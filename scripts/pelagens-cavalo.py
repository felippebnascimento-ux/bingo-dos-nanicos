"""
Faz as outras pelagens do cavalo de corrida a partir da folha castanha (public/arte/corrida/cavalo-castanho.webp),
trocando só a cor do pelo (os tons marrons): crina, patas pretas, jóquei e seda continuam. O rosto do jóquei fica de
fora pela posição (o pano da sela está no mesmo ponto em todos os quadros). O pampa ganha manchas brancas no corpo.
Uma folha gerada de verdade para a pelagem (scripts/importar-cavalo.py) fica melhor e substitui esta.

Uso: python3 scripts/pelagens-cavalo.py
"""
import colorsys
import math
import os
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
PASTA = os.path.join(AQUI, "..", "public", "arte", "corrida")
QW = 400

# (matiz em graus ou None para manter, multiplica a saturação, função do brilho)
PELAGENS = {
    "alazao": (17, 1.2, lambda v: min(1, v * 1.16 + 0.03)),
    "baio": (35, 0.95, lambda v: min(1, v * 1.32 + 0.08)),
    "preto": (None, 0.3, lambda v: v * 0.36),
    "tordilho": (None, 0.04, lambda v: min(1, 0.5 + v * 0.62)),
    "branco": (None, 0.05, lambda v: min(1, 0.8 + v * 0.26)),
    "rosilho": (8, 0.5, lambda v: min(1, 0.36 + v * 0.62)),
}


def pelo(r, g, b, x, y, claro=False):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    if not (0.0 <= h * 360 <= 48 and v > 0.1 and (s > 0.22 or (claro and s > 0.1 and v > 0.34))): return None
    if 196 <= x <= 266 and y <= 58: return None  # rosto do jóquei
    return h, s, v


def mancha(x, y):
    """Manchas do pampa, presas ao corpo (coordenadas do quadro)."""
    blobs = ((150, 124, 40, 22), (98, 110, 22, 30), (258, 140, 18, 30))
    for cx, cy, rx, ry in blobs:
        d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + 0.25 * math.sin(x * 0.13 + y * 0.07) * math.cos(y * 0.11)
        if d < 1: return True
    return False


def fazer(nome, base):
    im = base.copy(); px = im.load(); W, H = im.size
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a == 0: continue
            hsv = pelo(r, g, b, x % QW, y, nome in ('tordilho', 'branco', 'rosilho', 'pampa'))
            if not hsv: continue
            h, s, v = hsv
            if nome == "pampa":
                if not mancha(x % QW, y): continue
                nh, ns, nv = h, 0.04, min(1, 0.6 + v * 0.55)
            else:
                mh, ms, fv = PELAGENS[nome]
                nh = h if mh is None else mh / 360 + (h - 25 / 360) * 0.4
                ns = min(1, s * ms); nv = fv(v)
            nr, ng, nb = colorsys.hsv_to_rgb(nh % 1, ns, nv)
            px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    im.save(os.path.join(PASTA, f"cavalo-{nome}.webp"), "WEBP", quality=90, method=6)
    print("ok", nome)


if __name__ == "__main__":
    base = Image.open(os.path.join(PASTA, "cavalo-castanho.webp")).convert("RGBA")
    for n in list(PELAGENS) + ["pampa"]:
        fazer(n, base)
