import urllib.request
import os
import io
from PIL import Image

urls = [
    (5, 'https://rancangloka.com/media/images/631baf7a25e9986b9f0d01073633cb434ae162b3df1241ddac56b977026276e9.webp', '631baf7a25e9986b9f0d01073633cb434ae162b3df1241ddac56b977026276e9.webp'),
    (6, 'https://rancangloka.com/media/rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman-8422.webp', 'rekayasa-ventilasi-silang-alami-untuk-rumah-tropis-yang-lebih-nyaman-8422.webp'),
    (7, 'https://rancangloka.com/media/images/b5cd50198632fecc2810b756554ce8ffe6df3129f5d828447064beee41845af4.webp', 'b5cd50198632fecc2810b756554ce8ffe6df3129f5d828447064beee41845af4.webp'),
    (8, 'https://rancangloka.com/media/images/8ecd77ff40bb4d933e27e44980bcec9ebb040e0cb971de72e5387ff6b463247d.webp', '8ecd77ff40bb4d933e27e44980bcec9ebb040e0cb971de72e5387ff6b463247d.webp'),
    (9, 'https://rancangloka.com/media/images/4ee0363758a41bd45aae735349028ab19ca6256964c20ec1d98af4e65c578bf4.webp', '4ee0363758a41bd45aae735349028ab19ca6256964c20ec1d98af4e65c578bf4.webp')
]

os.makedirs('artifacts/thumbnails', exist_ok=True)
total_orig_bytes = 0
total_thumb_bytes = 0

print('=== GENERATING 160x160 CANONICAL THUMBNAIL DERIVATIVES ===')
results = []
for art_id, url, filename in urls:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    with urllib.request.urlopen(req) as resp:
        data = resp.read()
    orig_len = len(data)
    total_orig_bytes += orig_len
    
    with Image.open(io.BytesIO(data)) as img:
        w, h = img.size
        # Center crop to 1:1 square
        min_side = min(w, h)
        left = (w - min_side) / 2
        top = (h - min_side) / 2
        crop_box = (left, top, left + min_side, top + min_side)
        cropped = img.crop(crop_box)
        thumb = cropped.resize((160, 160), Image.Resampling.LANCZOS)
        
        out_path = os.path.join('artifacts/thumbnails', filename)
        thumb.save(out_path, format='WEBP', quality=85, method=6)
        thumb_bytes = os.path.getsize(out_path)
        total_thumb_bytes += thumb_bytes
        
        reduction = (1 - (thumb_bytes / orig_len)) * 100
        results.append({
            'art_id': art_id,
            'filename': filename,
            'orig_bytes': orig_len,
            'thumb_bytes': thumb_bytes,
            'reduction': reduction
        })
        print(f"Article {art_id}: {orig_len/1024:.1f} KB -> {thumb_bytes/1024:.2f} KB ({thumb_bytes} B) [{reduction:.1f}% reduction] - {filename}")

print(f"\nTotal 5 original images: {total_orig_bytes/1024:.1f} KB")
print(f"Total 5 thumbnails:      {total_thumb_bytes/1024:.2f} KB (Overall {(1 - total_thumb_bytes/total_orig_bytes)*100:.1f}% reduction)")

# Article 8 3-card module calculation (cards for 9, 7, 5)
art8_cards = [r for r in results if r['art_id'] in [9, 7, 5]]
art8_orig_sum = sum(c['orig_bytes'] for c in art8_cards)
art8_thumb_sum = sum(c['thumb_bytes'] for c in art8_cards)

print("\n--- ARTICLE 8 3-CARD SUPPORT MODULE PAYLOAD ---")
print(f"BEFORE (3 full cover images): {art8_orig_sum/1024:.1f} KB ({art8_orig_sum} bytes)")
print(f"AFTER  (3 compact 160x160):   {art8_thumb_sum/1024:.2f} KB ({art8_thumb_sum} bytes)")
print(f"NET REDUCTION:                {(1 - art8_thumb_sum/art8_orig_sum)*100:.1f}% SAVINGS")
