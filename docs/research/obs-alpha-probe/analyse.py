#!/usr/bin/env python3
"""Measure OBS alpha compositing from screenshots of obs-alpha-probe.html.

Run this again after an OBS update to check whether ADR-0003 still holds:

    python3 docs/research/obs-alpha-probe/analyse.py backdrop-grey.png 128,128,128

The card draws every sample twice: left over an in-page backdrop (composited
by Chromium), right over transparency (composited by OBS). Any gap between
the two columns is the defect.

macOS only: uses `sips` to decode PNG, because the repo has no image library
and adding one for a diagnostic that runs twice a year is not worth it.
"""
import pathlib
import struct
import subprocess
import sys
import tempfile

COLW = None
ROW_TOP = None

# Порядок ячеек в карте, слева направо и сверху вниз.
LABELS = [
    'контроль 100%', 'альфа 75%', 'альфа 50%', 'альфа 25%',
    'альфа 10%', 'белая 100%', 'белая 50%', 'радиальный град.',
    'линейный град.', 'box-shadow', 'круг', 'скругление',
    'линии 1/2/3px', 'диагональ', 'обводка 2px', 'текст',
]


class Bitmap:
    def __init__(self, png_path):
        with tempfile.NamedTemporaryFile(suffix='.bmp', delete=False) as tmp:
            bmp_path = tmp.name
        subprocess.run(
            ['sips', '-s', 'format', 'bmp', str(png_path), '--out', bmp_path],
            check=True, capture_output=True,
        )
        d = pathlib.Path(bmp_path).read_bytes()
        self.off = struct.unpack_from('<I', d, 10)[0]
        w, h = struct.unpack_from('<ii', d, 18)
        self.w, self.h = w, abs(h)
        self.topdown = h < 0
        self.d, self.stride = d, w * 4

    def mean(self, x0, y0, x1, y1):
        r = g = b = n = 0
        for y in range(y0, y1):
            row = y if self.topdown else self.h - 1 - y
            base = self.off + row * self.stride
            for x in range(x0, x1):
                i = base + x * 4
                b += self.d[i]
                g += self.d[i + 1]
                r += self.d[i + 2]
                n += 1
        return (r / n, g / n, b / n)


def srgb_to_linear(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def linear_to_srgb(c):
    c = max(0.0, min(1.0, c))
    return 255 * (12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055)


def blend_correct(src, alpha, dst):
    """Что должно получиться: смешивание в sRGB, как делает Chromium."""
    return tuple(alpha * s + (1 - alpha) * d for s, d in zip(src, dst))


def blend_obs(src, alpha, dst):
    """Измеренное поведение OBS 31 / Streamlabs.

    Chromium премультиплицирует цвет на альфу В ГАММА-ПРОСТРАНСТВЕ, отдавая
    `src * a`. OBS принимает это за обычный цвет, переводит в линейное и
    смешивает линейно. Так как sRGB->linear выпукла, `linear(s*a)` заметно
    меньше `linear(s)*a`, и вклад источника систематически занижается.

    На чёрной подложке член назначения обнуляется, премультиплицированное
    значение проходит насквозь без искажения — поэтому там ошибки нет.
    """
    return tuple(
        linear_to_srgb(srgb_to_linear(s * alpha) + srgb_to_linear(d) * (1 - alpha))
        for s, d in zip(src, dst)
    )


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    path = pathlib.Path(sys.argv[1])
    if not path.is_absolute():
        path = pathlib.Path(__file__).parent / path

    im = Bitmap(path)
    colw = im.w / 4
    # Строки найдены по профилю яркости на снимке 1591x898; при другом
    # масштабе пересчитываются пропорционально.
    row_top = [int(v * im.h / 898) for v in (41, 190, 339, 488)]
    dy = im.h / 898

    print(f'{path.name}  ({im.w}x{im.h})\n')
    print(f'{"образец":<20}{"Chromium":>22}{"OBS":>22}{"Δmax":>7}')
    worst = []
    for i, label in enumerate(LABELS):
        r, c = divmod(i, 4)
        y0, y1 = row_top[r] + int(26 * dy), row_top[r] + int(145 * dy)
        x = int(c * colw)
        left = im.mean(x + 4, y0, x + int(colw / 2) - 5, y1)
        right = im.mean(x + int(colw / 2) + 4, y0, x + int(colw) - 5, y1)
        delta = max(abs(a - b) for a, b in zip(left, right))
        worst.append((delta, label))

        def f(t):
            return f'({t[0]:5.1f},{t[1]:5.1f},{t[2]:5.1f})'

        print(f'{label:<20}{f(left):>22}{f(right):>22}{delta:7.1f}')

    worst.sort(reverse=True)
    print('\nСильнее всего расходятся:')
    for delta, label in worst[:5]:
        print(f'  {delta:5.1f}  {label}')
    print('\nΔ ниже ~1 — шум съёмки. Δ выше ~8 заметен глазом.')


if __name__ == '__main__':
    main()
