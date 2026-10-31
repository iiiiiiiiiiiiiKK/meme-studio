# Contributing to Meme Studio

Thanks for wanting to help. Meme Studio is a local-first web app, so most contributions are about making the
in-browser experience better.

## Getting set up

```bash
git clone https://github.com/iiiiiiiiiiiiiKK/meme-studio.git
cd meme-studio
npm install
npm run dev
```

You need Node.js 18+ and a browser with WebGL for the AI features.

## Before you open a pull request

```bash
npm run typecheck   # tsc --noEmit, strict mode
npm test            # vitest unit suite
npm run build       # production build
npm run e2e         # playwright (chromium + webkit)
```

All four must be green. The E2E suite builds the app first, so it always tests the current source.

## Code style

- TypeScript `strict` mode; no `any` unless there is a comment explaining why.
- Tailwind classes with the CSS variables from `src/index.css` (`--panel`, `--line`, `--text-dim`, `--accent`, …)
  instead of hard-coded colours, so light and dark themes both work.
- Components live in `src/components/`; pages in `src/pages/`; pure logic in `src/lib/`.
- Keep the pure modules free of DOM side effects so they stay unit-testable.

## Ground rules

1. **Never fake a result.** If a model cannot run, surface the failure — do not pretend it worked.
2. **Never upload user images.** Local processing is the product.
3. **Never add an API key requirement.** If a feature needs the network, it must be optional.
4. **Do not commit** credentials, `.env` files, or model weights whose licence you cannot verify.
5. **Keep the tests real.** Prefer testing behaviour through the UI (Playwright) over testing implementation details.

## Adding a model

1. Check the licence of the weights — commercial use must be permitted.
2. Place the files in `public/models/` and document size + licence in the README table.
3. Load them through `src/lib/ai.ts` so the caching and error handling stay in one place.

## Reporting bugs

Please include the browser and version, the OS, what you expected, what happened, and (if the AI features are
involved) the backend shown in `Settings → Local AI engine`.
