# Dashboard

## Start Dev Server

From Windows PowerShell at the repo root, run:

```powershell
.\start-dev.ps1
```

The script opens the dev server in a new visible Windows PowerShell window. Open the `Demo URL:` printed by the script.

Keep the visible dev-server terminal open while developing. Vite will auto-refresh the browser when code changes.

## Check the dashboard

From `dashboard/`, run `npm test` for the component regression tests and
`npm run build` for the production build. The tests use Node's built-in test
runner and Vite's existing JSX support; no browser or new test dependency is needed.
