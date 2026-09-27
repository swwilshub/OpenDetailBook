# The Pattern Book

A book of UK construction details, each an interactive explainer with live 2D heat-flow calculations (ψ-values, fRsi, Uf), for UK construction details.

Live site: https://swwilshub.github.io/OpenDetailBook/

## Add a detail
One command copies the page into `demos/`, takes a 640×397 thumbnail in headless Chromium, and adds the entry (and a new chapter, if needed) to `index.html`:

```
npm run add -- path/to/detail.html --chapter "Walls" --title "..." --blurb "..." --tags "Walls,ψ-value"
```

Options: `--slug name` sets the file name (default: the source file name in kebab-case), `--chapter-blurb "..."` sets the subtitle of a new chapter, `--force` overwrites an existing file.

Then `npm run check` and commit and push. Pushing to `main` runs the checks in GitHub Actions and, if they pass, publishes the site.

Other commands:
- `npm run thumbs` regenerates every thumbnail (`npm run thumbs -- window-jamb` for one).
- `npm run check` confirms every detail has its page and thumbnail, and loads the index and each page headless, failing on any page error.

First time: `npm ci && npx playwright install chromium`.

## Caveat
Teaching models, not compliance calculations. Geometry and materials are representative; check BR 497, ISO 10077-2 and the Approved Documents before relying on any figure.
