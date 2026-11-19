# Dashboard migration checks

Run the portable migration checks from `e2e/`:

```sh
npx playwright test --config=migration/candidate-playwright.config.ts
```

The suite starts isolated mock servers for both dashboard themes. It checks package and service actions, theme changes, and the debug page.

Run the regular Playwright suite with `npm test` from `e2e/`.
