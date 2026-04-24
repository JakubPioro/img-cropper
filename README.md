# img-cropper

Lokalna aplikacja Vue 3 do wsadowego skalowania i kadrowania zdjec.

## Co robi aplikacja

- Przyjmuje zdjecia JPG/PNG/WebP z roznych urzadzen.
- Skaluje obrazy do jednego rozmiaru (domyslnie 800x600, edytowalne).
- Przy niezgodnych proporcjach stosuje auto-crop centralny.
- Umozliwia reczna korekte kadru na Canvas.
- Pozwala pobrac pojedyncze pliki lub caly zestaw jako ZIP.
- Dziala lokalnie w przegladarce, bez uploadu na serwer.

## Tech stack

- Vue 3 + Composition API + TypeScript
- Pinia (store)
- Vue Router
- Tailwind CSS
- JSZip + FileSaver

## Uruchomienie

```bash
npm install
npm run dev
```

## Skrypty

- `npm run dev` - dev server
- `npm run build` - build produkcyjny
- `npm run type-check` - kontrola typow
- `npm run test` - testy jednostkowe

## Struktura

- `src/stores/imageStore.ts` - centralny stan i akcje batch processing
- `src/utils/imagePipeline.ts` - pipeline Canvas (decode/crop/resize/export)
- `src/components` - interfejs krok po kroku po polsku
