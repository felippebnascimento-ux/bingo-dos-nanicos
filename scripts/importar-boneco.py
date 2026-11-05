"""
Importa uma folha de boneco gerada de novo (05/11/2026) para o formato do K-FOFO (public/arte/bonecos/<nome>.webp).

As folhas que vêm da ferramenta de imagem chegam sem transparência de verdade (o xadrez "transparente" está desenhado
no fundo), em outro tamanho e com os quadros fora da grade exata. Aqui:
  1. o fundo (xadrez claro e cinza, sem cor) sai a partir das bordas da imagem, sem atravessar o contorno escuro;
  2. cada boneco é achado pelos pixels que sobraram e vai para a célula da grade (5 colunas x 2 linhas) pelo centro;
  3. tudo é redimensionado na mesma escala (a altura do boneco parado de frente vira a dos bonecos atuais) e colocado
     na célula 252 x 402 com o pé na linha do chão e a cabeça no meio;
  4. por fim passa o acertar-bonecos.py (halo, branco entre as pernas, tamanho e altura da cabeça).

Uso (precisa do Pillow), da raiz do projeto:
  python3 scripts/importar-boneco.py ~/Downloads/henry.png henry
"""
import importlib.util
import os
import sys
from collections import deque
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("acertar", os.path.join(AQUI, "acertar-bonecos.py"))
acertar = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(acertar)

CW, CH, CHAO = acertar.CW, acertar.CH, acertar.CHAO
ALTURA = 375  # altura do boneco parado de frente nas folhas atuais (do topo do cabelo ao pé)


def fundo(p):
    """Pixel do xadrez desenhado: sem cor e claro (os dois tons do xadrez e as manchas da compressão)."""
    r, g, b, a = p
    if a == 0:
        return False
    return max(r, g, b) - min(r, g, b) <= 16 and r + g + b >= 420


def tira_fundo(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    W, H = im.size
    # quando a imagem já vem transparente, os pontinhos quase invisíveis em volta (alfa baixo) também saem
    for y in range(H):
        for x in range(W):
            if px[x, y][3] < 40:
                px[x, y] = (0, 0, 0, 0)
    visto = bytearray(W * H)
    q = deque()
    for x in range(W):
        for y in (0, H - 1):
            if fundo(px[x, y]):
                visto[y * W + x] = 1; q.append((x, y))
    for y in range(H):
        for x in (0, W - 1):
            if fundo(px[x, y]) and not visto[y * W + x]:
                visto[y * W + x] = 1; q.append((x, y))
    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and not visto[ny * W + nx] and fundo(px[nx, ny]):
                visto[ny * W + nx] = 1; q.append((nx, ny))
    return im


def quadros(im: Image.Image):
    """Os 10 bonecos da folha, cada um recortado sozinho, na ordem da grade [linha][coluna]."""
    W, H = im.size
    a = im.split()[3].load()
    visto = bytearray(W * H)
    grupos = [[[] for _ in range(5)] for _ in range(2)]
    for y in range(H):
        for x in range(W):
            if a[x, y] and not visto[y * W + x]:
                comp = []
                q = deque([(x, y)]); visto[y * W + x] = 1
                while q:
                    cx, cy = q.popleft(); comp.append((cx, cy))
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < W and 0 <= ny < H and not visto[ny * W + nx] and a[nx, ny]:
                            visto[ny * W + nx] = 1; q.append((nx, ny))
                if len(comp) < 40:
                    continue  # sujeira do fundo
                mx = sum(c[0] for c in comp) / len(comp); my = sum(c[1] for c in comp) / len(comp)
                grupos[min(1, int(my / (H / 2)))][min(4, int(mx / (W / 5)))].extend(comp)
    s = im.load(); out = []
    for linha in grupos:
        fila = []
        for comp in linha:
            xs = [c[0] for c in comp]; ys = [c[1] for c in comp]
            x0, y0 = min(xs), min(ys)
            q = Image.new("RGBA", (max(xs) - x0 + 1, max(ys) - y0 + 1), (0, 0, 0, 0)); o = q.load()
            for x, y in comp:
                o[x - x0, y - y0] = s[x, y]
            fila.append(q)
        out.append(fila)
    return out


def centro_cabeca(q: Image.Image) -> float:
    a = q.split()[3].point(lambda v: 255 if v > 128 else 0).load()
    cs = []
    for y in range(min(q.height, int(q.height * 0.25))):
        xs = [x for x in range(q.width) if a[x, y]]
        if xs:
            cs.append((xs[0] + xs[-1]) / 2)
    return sum(cs) / len(cs) if cs else q.width / 2


def importar(origem: str, nome: str):
    im = tira_fundo(Image.open(origem))
    qs = quadros(im)
    esc = ALTURA / qs[0][0].height
    folha = Image.new("RGBA", (CW * 5, CH * 2), (0, 0, 0, 0))
    for linha in range(2):
        for col in range(5):
            q = qs[linha][col]
            q = q.resize((round(q.width * esc), round(q.height * esc)), Image.LANCZOS)
            x = round(CW / 2 - centro_cabeca(q)); y = CHAO - q.height
            celula = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
            celula.alpha_composite(q.crop((max(0, -x), max(0, -y), q.width, q.height)), (max(0, x), max(0, y)))
            folha.alpha_composite(celula.crop((0, 0, CW, CH)), (col * CW, linha * CH))
    destino = os.path.join(AQUI, "..", "public", "arte", "bonecos", nome + ".webp")
    folha.save(destino, "WEBP", quality=92, method=6)
    acertar.acertar(destino)


if __name__ == "__main__":
    importar(os.path.expanduser(sys.argv[1]), sys.argv[2])
