"""
Importa a folha do cenário da corrida (05/11/2026) para public/arte/corrida/: três faixas sobre fundo verde (#00FF00),
geradas na mesma ferramenta do cavalo (o fundo com a arquibancada; a pista vista de lado; o poste da chegada e o portão).

Sai:
  fundo.webp          a arquibancada, as árvores, os morros e o gramado, com o céu transparente (o azul é da tela);
  pista.webp          a pista e a sua cópia espelhada lado a lado (emenda sem costura em qualquer ponto);
  pista-frente.webp   só a cerca de fora da pista, transparente, para passar na frente dos cavalos;
  chegada.webp e portao.webp, recortados do verde (os vãos do portão também saem).

Uso (precisa do Pillow), da raiz do projeto: python3 scripts/importar-cenario.py ~/Downloads/cenario.webp
Os recortes abaixo são da folha verde de 05/11/2026 (1536 x 1024); outra folha precisa conferir as faixas e as
medidas da pista em src/features/corrida/camera3d.ts.
"""
import os
import sys
from PIL import Image, ImageOps

AQUI = os.path.dirname(os.path.abspath(__file__))
DESTINO = os.path.join(AQUI, "..", "public", "arte", "corrida")
FUNDO = (18, 23, 1518, 344)
PISTA = (18, 395, 1518, 600)
CERCA_DE = 140  # a cerca de fora fica da linha 140 da pista para baixo
POSTE = (280, 640, 450, 972)
PORTAO = (505, 640, 1445, 972)


def croma(p):
    """O verde do fundo (puro e quase puro)."""
    r, g, b = p[:3]
    return g > 170 and g - max(r, b) > 90


def tira_verde(im, franja=2):
    """Tira o verde do fundo e, na franja da borda (até `franja` px), o verde que vazou para o desenho."""
    im = im.convert("RGBA"); px = im.load(); W, H = im.size
    for y in range(H):
        for x in range(W):
            if croma(px[x, y]): px[x, y] = (0, 0, 0, 0)
    for _ in range(franja):
        mudar = []
        for y in range(H):
            for x in range(W):
                r, g, b, a = px[x, y]
                if not a or g - max(r, b) <= 12: continue
                if any(0 <= x + dx < W and 0 <= y + dy < H and px[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    t = min(1.0, (g - max(r, b)) / 90)
                    mudar.append((x, y, (r, max(r, b), b, round(a * (1 - 0.8 * t)))))
        for x, y, p in mudar: px[x, y] = p
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def tira_grama_do_pe(im, linhas=16):
    """O tufo de grama embaixo do poste: o que é verde nas últimas linhas sai."""
    px = im.load(); W, H = im.size
    for y in range(max(0, H - linhas), H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a and g > r + 6 and g > b + 14: px[x, y] = (0, 0, 0, 0)
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def importar(origem):
    im = Image.open(origem).convert("RGB")
    os.makedirs(DESTINO, exist_ok=True)
    fundo = tira_verde(im.crop(FUNDO))
    fundo.save(os.path.join(DESTINO, "fundo.webp"), "WEBP", quality=88, method=6)
    pista = im.crop(PISTA)
    w, h = pista.size
    dupla = Image.new("RGB", (w * 2, h)); dupla.paste(pista, (0, 0)); dupla.paste(ImageOps.mirror(pista), (w, 0))
    dupla.save(os.path.join(DESTINO, "pista.webp"), "WEBP", quality=88, method=6)
    frente = Image.new("RGBA", dupla.size, (0, 0, 0, 0)); fp = frente.load(); dp = dupla.load()
    for y in range(CERCA_DE, h):
        for x in range(w * 2):
            r, g, b = dp[x, y]
            if min(r, g, b) > 118 and max(r, g, b) - min(r, g, b) < 46:
                fp[x, y] = (r, g, b, 255)
    frente.save(os.path.join(DESTINO, "pista-frente.webp"), "WEBP", quality=88, method=6)
    poste = tira_grama_do_pe(tira_verde(im.crop(POSTE)))
    poste.save(os.path.join(DESTINO, "chegada.webp"), "WEBP", quality=90, method=6)
    portao = tira_verde(im.crop(PORTAO))
    # o branco esverdeado que ficou nos triângulos do treliçado (o verde visto pelo vão) também sai
    pp = portao.load()
    for y in range(portao.height):
        for x in range(portao.width):
            r, g, b, a = pp[x, y]
            if a and g > 150 and g - max(r, b) > 14: pp[x, y] = (0, 0, 0, 0)
    portao.save(os.path.join(DESTINO, "portao.webp"), "WEBP", quality=90, method=6)
    print("ok fundo", fundo.size, "pista", dupla.size, "poste", poste.size, "portão", portao.size)


if __name__ == "__main__":
    importar(os.path.expanduser(sys.argv[1]))
