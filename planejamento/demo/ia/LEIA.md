# Bonecos gerados com IA

- **Modelo:** `gpt_image_2_5` (Higgsfield), qualidade alta, 16:9, com a arte `public/arte/nanicos/<n>-corpo.webp` (em fundo branco) como referência.
- **Recorte:** `python recortar.py <pasta com ia-<n>.png> <hall-vazio em 1,5x>`

## Prompt usado

> Pixel art character sprite sheet in the style of classic isometric hotel/social games (clean pixel art, crisp 1px dark outlines, chibi proportions with a big head, soft 2-3 tone shading, no anti-aliasing blur). Turn the character from the reference image into this pixel avatar, keeping his look faithful: same hairstyle and hair color, same facial hair, same skin tone, same expression, same clothes, colors, prints, tattoos, accessories and shoes as the reference. Show 4 standing poses side by side on a plain light gray background, evenly spaced, same size and same ground line: 1) facing front-right (3/4 view), 2) facing front-left (3/4 view), 3) facing back-right (3/4 view from behind, showing the back of the head), 4) facing back-left (3/4 view from behind). Full body, no text, no labels, no shadows on the floor.

## Andar (versão 2, aprovada para teste)

- Um sentido por imagem (21:9), com o boneco parado gerado antes como referência.
- Os quadros são alinhados pelo centro da cabeça e pelo chão, para o boneco não tremer.
- Resultado em `andar/andar-gamer-<frente|costas>-<0..3>.png` e `gamer-andando.gif`.

> Game sprite sheet: a 4-frame WALK CYCLE of the exact same pixel art character from the reference image (the first figure, facing front-right in 3/4 view). Keep identical pixel style, proportions, colors, hair, clothes, tattoos and shoes. One single row of 4 frames on a plain light gray background, evenly spaced, every frame exactly the same height and the head at exactly the same position, feet on the same ground line. The character walks toward the bottom-right with a CLEAR, WIDE STRIDE like a classic retro game walk: frame 1 = contact pose, front leg stepping far forward and back leg far behind, opposite arm swinging forward; frame 2 = passing pose, legs together, body 1 pixel higher; frame 3 = contact pose mirrored, other leg far forward, other arm forward; frame 4 = passing pose again. Strong, readable leg and arm movement. Full body, no text, no labels, no floor shadow.

(Para as costas: o mesmo texto, trocando por "seen FROM BEHIND in 3/4 view facing back-right ... walks away toward the top-right".)
