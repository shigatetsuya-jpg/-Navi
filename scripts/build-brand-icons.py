"""Rebuild the existing ワ brand mark as browser/search icons.
Development only: requires Pillow and Noto Sans CJK Bold, not server dependencies.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root = Path(__file__).resolve().parents[1]
size = 384
image = Image.new('RGBA', (size, size))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=80, fill='#f04e3e')
font = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', 284)
left, top, right, bottom = draw.textbbox((0, 0), 'ワ', font=font)
draw.text(((size - (right - left)) / 2 - left, (size - (bottom - top)) / 2 - top), 'ワ', font=font, fill='white')
image.resize((96, 96), Image.Resampling.LANCZOS).save(root / 'public/favicon-96.png')
image.resize((180, 180), Image.Resampling.LANCZOS).save(root / 'public/apple-touch-icon.png')
image.save(root / 'public/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (256, 256)])
