"""
Acerta as folhas dos bonecos do K-FOFO (public/arte/bonecos/*.webp) para o andar não "pular" (05/11/2026).

As folhas geradas tinham três defeitos que apareciam com o boneco andando:
  1. a borda branca de adesivo em volta do boneco (fica um halo claro no piso);
  2. a cabeça muda de tamanho de um quadro para outro (o boneco "pulsa");
  3. a cabeça sobe e desce até 7% da altura entre os quadros (quique exagerado).

Para cada linha (frente / costas), o quadro parado é a referência: cada quadro do andar é redimensionado para a
cabeça ter a mesma largura, esticado/encolhido na vertical (no máximo 10%) para a cabeça ficar na mesma altura com
um balanço pequeno (um pouco mais baixa na passada aberta, um pouco mais alta no meio do passo), com o pé no chão e a
cabeça no mesmo eixo do parado. O parado só perde o halo.

  4. o fundo branco preso entre as pernas (fechado, não encosta no transparente): sai a mancha clara que começa
     entre a virilha e o tornozelo e tem pele de perna dos dois lados (camisa, tênis e chinelo brancos ficam).

Uso (precisa do Pillow): python3 scripts/acertar-bonecos.py public/arte/bonecos/*.webp
Nas folhas de poses (grade 4x4, célula 336x402), só a borda de adesivo, o halo e o vão: python3 scripts/acertar-bonecos.py --so-halo public/arte/bonecos/poses/*.webp
Só o vão entre as pernas, numa folha já acertada: --so-vaos (bonecos) ou --so-vaos-poses.
Rode só uma vez em cada folha nova (rodar de novo numa folha já acertada não muda quase nada, mas não precisa).
"""
import sys
from collections import deque
from PIL import Image

CW, CH = 252, 402  # célula na folha (3x as medidas do bonecos.json)
CHAO = 396  # linha do pé na célula
CABECA = 100  # linhas do topo do recorte que contam como cabeça
BALANCO = {1: 3, 2: -4, 3: 3, 4: -4}  # px (na folha) em relação ao topo do parado: passada aberta / meio do passo


def tira_halo(im: Image.Image) -> Image.Image:
    """Apaga, da borda para dentro (até 3 voltas), os pixels claros e sem cor que encostam no transparente."""
    im = im.copy()
    px = im.load()
    w, h = im.size
    for _ in range(3):
        apagar = []
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a < 40:
                    continue
                claro = r + g + b >= 600 and max(r, g, b) - min(r, g, b) < 40
                if not claro:
                    continue
                if any(0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] < 40 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    apagar.append((x, y))
        if not apagar:
            break
        for x, y in apagar:
            px[x, y] = (0, 0, 0, 0)
    # o que sobrou meio transparente e claro na borda também sai
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if 0 < a < 160 and r + g + b >= 560:
                px[x, y] = (0, 0, 0, 0)
    return im


# ---------- a borda de adesivo das poses ----------
def soma(p): return p[0]+p[1]+p[2]
def claro_puro(p): return p[3]>=40 and min(p[:3])>=236 and max(p[:3])-min(p[:3])<10
def preto(p): return p[3]>=40 and max(p[:3])<40
def escuro(p): return p[3]>=40 and soma(p)<450
def tira_adesivo(im: Image.Image, contorno: int = 5, faixa: int = 14) -> Image.Image:
    """Poses: a borda de adesivo (contorno preto puro por fora, faixa branca pura, e só então o contorno do boneco)."""
    im=im.copy(); px=im.load(); W,H=im.size
    fase=bytearray(W*H)  # 0 nao visto, 1 contorno de fora, 2 faixa branca
    q=deque()
    viz=((1,0),(-1,0),(0,1),(0,-1))
    for y in range(H):
        for x in range(W):
            if px[x,y][3]<40:
                for dx,dy in viz:
                    nx,ny=x+dx,y+dy
                    if 0<=nx<W and 0<=ny<H and not fase[ny*W+nx]:
                        p=px[nx,ny]
                        if p[3]<40: continue
                        if claro_puro(p): fase[ny*W+nx]=2; q.append((nx,ny,2,1))
                        elif preto(p) or (soma(p)<600 and max(p[:3])-min(p[:3])<10): fase[ny*W+nx]=1; q.append((nx,ny,1,1))
    while q:
        x,y,f,d=q.popleft()
        for dx,dy in viz:
            nx,ny=x+dx,y+dy
            if not(0<=nx<W and 0<=ny<H) or fase[ny*W+nx]: continue
            p=px[nx,ny]
            if p[3]<40: continue
            if f==1:
                if claro_puro(p): fase[ny*W+nx]=2; q.append((nx,ny,2,1))
                elif d<contorno and preto(p): fase[ny*W+nx]=1; q.append((nx,ny,1,d+1))
            else:
                if claro_puro(p) and d<faixa: fase[ny*W+nx]=2; q.append((nx,ny,2,d+1))
    n=0
    for y in range(H):
        for x in range(W):
            if fase[y*W+x]: px[x,y]=(0,0,0,0); n+=1
    return im

# ---------- o branco preso entre as pernas ----------
def claro_opaco(p): r,g,b,a=p; return a>100 and r+g+b>=630 and max(r,g,b)-min(r,g,b)<30
def pele(p):
    r,g,b,a=p
    return a>150 and r>170 and 100<g<215 and b<170 and r-b>60
def pele_dos_lados(px, comp, x0c, cw):
    """Fração das linhas da mancha que têm pele (perna) logo à esquerda e logo à direita (até 6 px)."""
    linhas={}
    for x,y in comp:
        a,b=linhas.get(y,(x,x)); linhas[y]=(min(a,x),max(b,x))
    ok=0
    for y,(a,b) in linhas.items():
        esq=any(pele(px[x,y]) for x in range(max(x0c,a-14),a))
        dir=any(pele(px[x,y]) for x in range(b+1,min(x0c+cw,b+15)))
        ok+=esq and dir
    return ok/len(linhas)
def tira_vaos_celula(im, x0c, y0c, cw, ch):
    px=im.load(); W,H=im.size
    cel=im.crop((x0c,y0c,x0c+cw,y0c+ch)); bb=cel.split()[3].point(lambda v:255 if v>100 else 0).getbbox()
    if not bb: return 0
    fy0,fy1=y0c+bb[1],y0c+bb[3]; h=fy1-fy0
    visto=set(); n=0
    for y in range(y0c,y0c+ch):
        for x in range(x0c,x0c+cw):
            if (x,y) in visto or not claro_opaco(px[x,y]): continue
            comp=[]; q=deque([(x,y)]); visto.add((x,y))
            while q:
                cx,cy=q.popleft(); comp.append((cx,cy))
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    nx,ny=cx+dx,cy+dy
                    if x0c<=nx<x0c+cw and y0c<=ny<y0c+ch and (nx,ny) not in visto and claro_opaco(px[nx,ny]):
                        visto.add((nx,ny)); q.append((nx,ny))
            top=min(c[1] for c in comp); bot=max(c[1] for c in comp)
            if len(comp)>=12 and fy0+0.62*h <= top <= fy1-0.105*h and pele_dos_lados(px, comp, x0c, cw) >= 0.3:
                for c in comp: px[c]=(0,0,0,0)
                n+=len(comp)
    return n
def tira_vaos(im: Image.Image, cw: int = CW, ch: int = CH) -> Image.Image:
    im=im.copy(); n=0
    for y in range(0,im.height,ch):
        for x in range(0,im.width,cw): n+=tira_vaos_celula(im,x,y,cw,ch)
    return im

def medir(cel: Image.Image):
    """Topo, largura média e centro da cabeça do boneco na célula."""
    a = cel.split()[3].point(lambda v: 255 if v > 128 else 0)
    x0, y0, x1, y1 = a.getbbox()
    px = a.load()
    larguras, centros = [], []
    for y in range(y0, min(y0 + CABECA, y1)):
        xs = [x for x in range(x0, x1) if px[x, y]]
        if xs:
            larguras.append(xs[-1] - xs[0] + 1)
            centros.append((xs[0] + xs[-1]) / 2)
    return y0, sum(larguras) / len(larguras), sum(centros) / len(centros)


def acertar(caminho: str):
    folha = tira_vaos(tira_halo(Image.open(caminho).convert("RGBA")))
    nova = Image.new("RGBA", folha.size, (0, 0, 0, 0))
    for linha in range(2):
        celula = lambda c: folha.crop((c * CW, linha * CH, (c + 1) * CW, (linha + 1) * CH))
        parado = celula(0)
        nova.alpha_composite(parado, (0, linha * CH))
        t0, l0, cx0 = medir(parado)
        for c in range(1, 5):
            cel = celula(c)
            t, l, cx = medir(cel)
            bb = cel.getbbox()
            recorte = cel.crop(bb)
            s = max(0.94, min(1.06, l0 / l)) if abs(l0 / l - 1) > 0.04 else 1.0
            alvo_topo = t0 + BALANCO[c]
            alto = (CHAO - bb[1]) * s  # altura até o pé depois de igualar a cabeça
            v = max(0.9, min(1.1, (CHAO - alvo_topo) / alto))
            larg = round(recorte.width * s)
            alt = round(recorte.height * s * v)
            recorte = recorte.resize((larg, alt), Image.LANCZOS)
            # o pé (CHAO) continua no chão; a cabeça no mesmo eixo do parado
            y = round(CHAO - (CHAO - bb[1]) * s * v)
            x = round(cx0 - (cx - bb[0]) * s)
            quadro = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
            quadro.alpha_composite(recorte, (max(0, x), max(0, y)))
            nova.alpha_composite(quadro, (c * CW, linha * CH))
    nova.save(caminho, "WEBP", quality=92, method=6)
    print("ok", caminho)


if __name__ == "__main__":
    modo = next((m for m in ("--so-halo", "--so-vaos", "--so-vaos-poses") if m in sys.argv), None)
    for c in sys.argv[1:]:
        if c.startswith("--"):
            continue
        im = Image.open(c).convert("RGBA")
        if modo == "--so-halo":
            im = tira_vaos(tira_halo(tira_adesivo(im)), 336, 402)
        elif modo == "--so-vaos":
            im = tira_vaos(im)
        elif modo == "--so-vaos-poses":
            im = tira_vaos(im, 336, 402)
        else:
            acertar(c)
            continue
        im.save(c, "WEBP", quality=92, method=6)
        print("ok", c)
