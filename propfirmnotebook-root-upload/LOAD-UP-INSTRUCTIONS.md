# PropFirmNotebook Load-Up Instructions

This folder is a ready-to-upload website.

The GitHub repo should be `prop-firm-tools`.

The public site name is PropFirmNotebook.

## What is included

- Home page
- Tools page
- Trailing Drawdown Calculator
- Position Size Calculator
- Daily Loss Limit Calculator
- Prop Firm Challenge Planner
- Evaluation Progress Tracker
- Sitemap
- Robots file

## Easiest GitHub upload

1. Go to GitHub.
2. Open the `prop-firm-tools` repo.
3. Click **Add file**.
4. Click **Upload files**.
5. Upload everything inside this folder.
6. Commit the upload to the main branch.

Upload the contents of this folder, not the folder itself.

## Easiest Cloudflare Pages setup

1. Go to Cloudflare.
2. Open **Workers & Pages**.
3. Choose **Pages**.
4. Choose **Connect to Git**.
5. Pick the `prop-firm-tools` GitHub repo.
6. Use these settings:
   - Project name: `propfirmnotebook` or `prop-firm-tools`
   - Production branch: `main`
   - Framework preset: None
   - Build command: leave blank
   - Build output folder: `/`
7. Click deploy.

After this, Cloudflare will update the website each time the GitHub repo is updated.

## Adding the domain

1. In Cloudflare Pages, open the project.
2. Go to **Custom domains**.
3. Add `investingonlineforbeginners.com`.
4. Follow Cloudflare's prompts to connect the domain.

## What to do next

1. Connect the GitHub repo to Cloudflare Pages.
2. Add the custom domain.
3. Review the five calculators on the live site.
4. Add official prop firm rule sources for the first database pages.
5. Build the next tools: Risk of Ruin, Reward:Risk, Profit Split, Lot Size, and Trading Journal.

## Why GitHub matters

The GitHub repo is not only storage. It is a trust location.

Keep these files visible:

- `README.md`
- `docs/AI-OVERVIEW-QUESTION-MAP.md`
- `docs/CALCULATOR-FORMULAS.md`
- `data/search-questions.json`
- `assets/js/calculators.js`

These show that the site has real tools, clear formulas, and useful educational structure.
