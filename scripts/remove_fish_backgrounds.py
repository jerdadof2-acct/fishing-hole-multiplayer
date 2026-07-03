"""Remove opaque backgrounds from new fish PNGs (requires: pip install rembg)."""
from io import BytesIO
import sys
from pathlib import Path

from PIL import Image
from rembg import remove

NEW_FISH = [
    'Spanish Mackerel',
    'King Mackerel',
    'Barracuda',
    'Goliath Grouper',
    'Amberjack',
    'Hogfish',
    'Red Snapper',
    'Reef Shark',
    'Piranha',
    'Peacock Bass',
    'Payara',
    'Arapaima',
]

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / 'assets' / 'images'


def process(path: Path) -> None:
    data = path.read_bytes()
    out = remove(data)
    image = Image.open(BytesIO(out)).convert('RGBA')
    image.save(path, optimize=True)
    print(f'  ok  {path.name}  {image.size[0]}x{image.size[1]}  RGBA')


def main() -> None:
    names = sys.argv[1:] if len(sys.argv) > 1 else NEW_FISH
    for name in names:
        path = IMAGES / f'{name}.png'
        if not path.exists():
            print(f'  skip  missing {path.name}')
            continue
        process(path)


if __name__ == '__main__':
    main()
