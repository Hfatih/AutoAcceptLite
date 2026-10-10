"""Render the black-and-white AutoAccept Lite star icon and installer artwork."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1] / 'assets'
root.mkdir(exist_ok=True)
size = 512
logo = Image.new('RGBA', (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(logo)

# Black rounded tile with a muted outline, matching the supplied reference.
draw.rounded_rectangle((8, 8, 504, 504), radius=112, fill='#000000', outline='#72556f', width=6)


def sparkle(cx: int, cy: int, outer: int, inner: int) -> list[tuple[int, int]]:
    return [
        (cx, cy - outer), (cx + inner, cy - inner), (cx + outer, cy),
        (cx + inner, cy + inner), (cx, cy + outer), (cx - inner, cy + inner),
        (cx - outer, cy), (cx - inner, cy - inner),
    ]


# Four-point white sparkle, plus the smaller glint in the reference image.
draw.polygon(sparkle(246, 260, 158, 31), fill='#ffffff')
draw.polygon(sparkle(374, 145, 33, 8), fill='#ffffff')

logo.save(root / 'logo.png')
logo.save(root / 'AutoAcceptLite.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
logo.resize((128,128), Image.Resampling.LANCZOS).save(root / 'logo-small.png')

wizard = Image.new('RGB', (492,942), '#ffffff')
draw = ImageDraw.Draw(wizard)
thumbnail = logo.resize((280,280), Image.Resampling.LANCZOS)
wizard.paste(thumbnail, (106,130), thumbnail)
bold = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 49)
regular = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 25)
draw.text((53,467), 'AutoAccept', font=bold, fill='#101e2d')
draw.text((53,527), 'Lite', font=bold, fill='#72556f')
draw.line((53,636,439,636), fill='#101e2d', width=2)
draw.text((53,676), 'Antigravity için\notomatik onay.', font=regular, fill='#354b5a', spacing=12)
draw.text((53,851), 'WINDOWS  ·  1.1.0', font=regular, fill='#354b5a')
wizard.save(root / 'wizard.png')

# Editable vector source for the application icon.
(root / 'logo.svg').write_text('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect x="8" y="8" width="496" height="496" rx="112" fill="#000000" stroke="#72556f" stroke-width="6"/>
<path d="M246 102 277 229 404 260 277 291 246 418 215 291 88 260 215 229Z" fill="#ffffff"/>
<path d="M374 112 382 137 407 145 382 153 374 178 366 153 341 145 366 137Z" fill="#ffffff"/>
</svg>\n''', encoding='utf-8')
print('Black tile, white star icons and installer artwork generated.')
