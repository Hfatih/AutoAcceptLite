"""Render the geometric AutoAccept Lite icon and installer artwork."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1] / 'assets'
root.mkdir(exist_ok=True)
logo = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
draw = ImageDraw.Draw(logo)
draw.rounded_rectangle((8, 8, 504, 504), radius=112, fill='#ffffff')
draw.rounded_rectangle((29, 29, 483, 483), radius=94, outline='#101e2d', width=5)
draw.arc((100, 100, 412, 412), 125, 400, fill='#43d7bf', width=24)
draw.line([(159, 257), (229, 324), (357, 180)], fill='#101e2d', width=35, joint='curve')
for x, y in [(159, 257), (357, 180)]:
    draw.ellipse((x-17, y-17, x+17, y+17), fill='#101e2d')
# Small four-point stars keep the original check/ring silhouette while adding
# the requested night-sky detail in the dark parts of the mark.
for x, y, r in [(340, 200, 7), (263, 282, 6), (322, 218, 5), (198, 296, 4)]:
    draw.polygon([(x, y-r), (x+2, y-2), (x+r, y), (x+2, y+2),
                  (x, y+r), (x-2, y+2), (x-r, y), (x-2, y-2)], fill='#ffffff')
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
draw.text((53,527), 'Lite', font=bold, fill='#43d7bf')
draw.line((53,636,439,636), fill='#101e2d', width=2)
draw.text((53,676), 'Antigravity için\notomatik onay.', font=regular, fill='#354b5a', spacing=12)
draw.text((53,851), 'WINDOWS  ·  1.1.0', font=regular, fill='#354b5a')
wizard.save(root / 'wizard.png')

# Editable vector source for the application icon.
(root / 'logo.svg').write_text('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect x="8" y="8" width="496" height="496" rx="112" fill="#101e2d"/>
<rect x="29" y="29" width="454" height="454" rx="94" fill="none" stroke="#234559" stroke-width="5"/>
<path d="M 167 384 A 156 156 0 1 1 375 356" fill="none" stroke="#43d7bf" stroke-width="24"/>
<path d="m159 257 70 67 128-144" fill="none" stroke="#f2fffb" stroke-width="35" stroke-linecap="round" stroke-linejoin="round"/>
</svg>\n''', encoding='utf-8')
print('Logo, multi-size ICO and wizard artwork generated.')
