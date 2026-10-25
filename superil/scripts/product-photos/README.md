# Product photos

`public/products/*.webp` holds real front-of-pack photos for 105 catalog products. Their metadata, used by the
site and the 3D store, is in `src/data/product-photos.ts`.

## Source and licence

- All photos come from [Open Food Facts](https://world.openfoodfacts.org), a collaborative open database where
  volunteers photograph products. The photos are licensed
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
- `public/products/CREDITS.txt` lists every file with its Open Food Facts product page and uploader. Product pages
  on the site link to the original record too.
- SUPERIL's adapted versions are shared under the same licence: cropped, resized, and with the background removed
  for round packs.
- No photo was taken from retailer or manufacturer websites.
- Downloads used Open Food Facts' public data exports on AWS Open Data: the product dump
  (`openfoodfacts-ds`) and the image bucket (`openfoodfacts-images`).

## How the photos were chosen

1. Israeli products were read from the Open Food Facts JSONL export. A product counts as Israeli if its barcode
   starts with 729 or its countries include Israel.
2. Candidates for each catalog product were found by Hebrew/English name and brand.
3. Every candidate's photo was reviewed by eye. Only photos that clearly show the product's front were kept.
4. Some exact variants have no photo. In those cases the demo catalog entry was changed to the real product that
   was photographed: its name, brand and size follow the photo (e.g. Doritos Nacho → Doritos Grill).
5. `picks.json` records the choice for each product: the Open Food Facts code, the image id, and processing hints
   (`cutout`, `rot`, `box` crop, `small`).

Products without a photo keep the generated illustration, which is marked "איור" (illustration):

- Loose produce has no barcode. It is drawn as 3D fruit and vegetable models instead.
- Household, cleaning and personal-care goods are not covered by Open Food Facts.

## Re-running

```bash
pip install pillow numpy opencv-python-headless
# images.jsonl: one line per Israeli product, {"code": ..., "images": ...}, extracted from
# https://openfoodfacts-ds.s3.eu-west-3.amazonaws.com/openfoodfacts-products.jsonl.gz
OFF_IMAGES_JSONL=images.jsonl python3 scripts/product-photos/process.py scripts/product-photos/picks.json out/
```

Output:

- `out/<id>.webp` for each product;
- `manifest.json`: aspect ratio, silhouette profile for the 3D bottle and jar models, and the edge colour;
- `review.png`: a contact sheet to check the results by eye.

Copy the WebP files to `public/products/` and update `src/data/product-photos.ts` from the manifest.
