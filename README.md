# Competitor Intelligence Dashboard

A fictional competitive intelligence workspace built as a portfolio prototype. It demonstrates how customer conversation mentions can move through AI detection, account-manager validation, a three-day review window, and centralized reporting.

Every account, transcript, competitor interaction, financial estimate, and activity item in the demo is fictional. Gong, n8n, and HubSpot are simulated labels only; the application makes no external API calls.

## Run locally

Requirements: Node.js 22.12+ and npm.

1. Install dependencies: npm install
2. Start the development server: npm run dev
3. Open the local URL printed by Vite.

## Production build

Run npm run build. The generated static site is written to dist/. Preview it locally with npm run preview.

## Deploy to GitHub Pages

The GitHub Actions workflow builds and deploys the site whenever changes are pushed to `main`. In repository settings, set the Pages build source to GitHub Actions. The workflow builds with the repository path and adds a fallback for client-side routes.

## Demo behavior

- Seeded portfolio: 248 fictional accounts, 64 competitor mentions, and 8 account managers.
- The five sections share a single LocalStorage-backed demo state.
- The review queue preloads seven pending forms, five approved forms, and three auto-submitted forms.
- Approving a questionnaire saves the AM edits and synchronizes the record. Rejection stores a reason and excludes the mention from verified reporting.
- The demo-only Simulate 3 days passing action expires all pending questionnaires immediately.
- Reset Demo Data is available in the sidebar and refreshes the workspace from the seed dataset.
- The CSV export is fictional and generated in the browser.

## Design reference

The light-mode interface adapts the public Rokt site's clean white space, strong black typography, and restrained magenta accent into an independent enterprise workspace. It uses no proprietary screenshots, recordings, source code, or customer information.
