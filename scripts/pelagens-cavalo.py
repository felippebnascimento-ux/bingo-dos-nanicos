"""
Faz as outras pelagens do cavalo de corrida a partir da folha castanha (public/arte/corrida/cavalo-castanho.webp),
trocando só a cor do pelo (os tons marrons): crina, patas pretas, jóquei e seda continuam. O rosto do jóquei fica de
fora pela posição (o pano da sela está no mesmo ponto em todos os quadros). O pampa ganha manchas brancas no corpo.
Uma folha gerada de verdade para a pelagem (scripts/importar-cavalo.py) fica melhor e substitui esta.

Uso: python3 scripts/pelagens-cavalo.py [pelagem ...]   (sem nada, faz todas)
"""
import colorsys
import math
import os
import sys
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
    # as 7 de 05/11/2026 (seção 76)
    "tostado": (11, 1.05, lambda v: v * 0.66),
    "palomino": (41, 0.8, lambda v: min(1, v * 1.38 + 0.14)),
    "lobuno": (30, 0.2, lambda v: min(1, 0.26 + v * 0.55)),
    "cremelo": (40, 0.2, lambda v: min(1, 0.72 + v * 0.3)),
    "mouro": (215, 0.12, lambda v: min(1, 0.2 + v * 0.55)),
    "malhado": (None, 0.3, lambda v: v * 0.36),
    "apaloosa": (None, 0.05, lambda v: min(1, 0.78 + v * 0.26)),
}
# crina, rabo e canelas claros (as outras ficam pretas): a cor (r, g, b) para o escuro dessas partes
CRINA_CLARA = {"palomino": (238, 220, 176), "cremelo": (242, 232, 210)}
# manchas brancas por cima da cor do corpo
MANCHAS = {"pampa", "malhado"}


def pelo(r, g, b, x, y, claro=False):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    if not (0.0 <= h * 360 <= 48 and v > 0.1 and (s > 0.22 or (claro and s > 0.1 and v > 0.34))): return None
    if 196 <= x <= 266 and y <= 58: return None  # rosto do jóquei
    return h, s, v


def ruido(x, y, sem):
    """Um ruído suave (soma de ondas) para as manchas terem borda irregular, sempre igual no mesmo ponto do corpo."""
    return (math.sin(x * 0.045 + sem) * math.cos(y * 0.06 - sem * 0.7) + 0.6 * math.sin((x + y) * 0.09 + sem * 1.3)
            + 0.35 * math.cos((x - y) * 0.16 + sem * 2.1))


def mancha(x, y):
    """Manchas brancas grandes e irregulares do pampa e do malhado, no corpo e na anca (coordenadas do quadro)."""
    if not (60 <= x <= 290 and 60 <= y <= 185): return False
    # perto da borda da área a mancha precisa de mais ruído: ela some aos poucos, sem corte reto
    d = min(x - 60, 290 - x, y - 60, 185 - y)
    return ruido(x * 0.7 + 40, y * 0.7, 2.3) > 0.25 + max(0, (26 - d) / 26) * 1.6


def pinta(x, y):
    """As pintas do apaloosa: manta clara na anca com pintas escuras de tamanhos diferentes."""
    if not (55 <= x <= 200 and 78 <= y <= 180): return False
    return ruido(x * 2.6, y * 2.6, 0.4) > 1.15


def fazer(nome, base):
    im = base.copy(); px = im.load(); W, H = im.size
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a == 0: continue
            if nome in CRINA_CLARA and crina_ou_canela(x % QW, y):
                h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                if v < 0.42 and s < 0.5:
                    cr, cg, cb = CRINA_CLARA[nome]; t = 0.45 + v * 1.3
                    px[x, y] = (min(255, round(cr * t)), min(255, round(cg * t)), min(255, round(cb * t)), a)
                    continue
            hsv = pelo(r, g, b, x % QW, y, nome in ('tordilho', 'branco', 'rosilho', 'pampa', 'apaloosa', 'cremelo', 'palomino'))
            if not hsv: continue
            h, s, v = hsv
            if nome in MANCHAS and mancha(x % QW, y):
                nh, ns, nv = h, 0.04, min(1, 0.6 + v * 0.55)
            elif nome == "pampa":
                continue
            elif nome == "apaloosa" and pinta(x % QW, y):
                nh, ns, nv = 0.07, 0.35, 0.12 + v * 0.3
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
    so = [a for a in sys.argv[1:] if not a.startswith("-")]
    for n in so or (list(PELAGENS) + ["pampa"]):
        fazer(n, base)
