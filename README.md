# Vermont Baseball League — History & Stats

A static web app displaying historical standings, stats, and owner records for the Vermont Baseball League fantasy baseball league (formerly Montana State, 2011–2012).

Live site: **https://raberg1.github.io/Vermont-Baseball-History**

---

## What's in this repo

```
index.html          Main app (single-page, no build step required)
css/styles.css      Stylesheet
js/app.js           All app logic
js/data.js          Generated data file — do not edit directly
process_data.py     Script that generates data.js from the CSV files
data/               Fantrax standings CSVs + owners spreadsheet
```

---

## Pages

- **Season** — Final standings, hitting breakdown, and pitching breakdown for any year
- **History** — League champions, all-time records, and year-over-year charts
- **Owners** — Career stats for every owner: wins, average finish, points per season
- **Add Season** — Upload a new Fantrax CSV to preview it in the browser immediately

---

## Adding a new season (permanent)

1. Download the final standings CSV from Fantrax (League → Reports → Standings → Export CSV)
2. Place it in the `data/` folder
3. Add a line to `YEAR_FILES` in `process_data.py`:
   ```python
   2026: "2026-Fantrax-Standings-Vermont Baseball.csv",
   ```
4. Run the script from the repo root:
   ```bash
   python3 process_data.py
   ```
5. Commit and push — the site updates automatically via GitHub Pages:
   ```bash
   git add .
   git commit -m "Add 2026 season"
   git push
   ```

---

## Data sources

- **Standings CSVs** — exported from [Fantrax](https://www.fantrax.com) at end of each season
- **Owners file** — `data/League Owners By Year - Sheet1.csv` maps owner names to their team names by year

The Python script (`process_data.py`) parses all CSVs and writes `js/data.js`, which the app loads at startup. The site is fully static — no server or database required.

---

## Local development

Open `index.html` directly in a browser. To regenerate data after changing a CSV:

```bash
python3 process_data.py
```

No npm, no build tools, no dependencies beyond Python 3 (standard library only) and Chart.js (loaded from CDN).

---

*Built with [Claude Code](https://claude.ai/claude-code) by Anthropic.*
