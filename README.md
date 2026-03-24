# Vermont Baseball League — History & Stats

A static web app displaying historical standings, stats, and owner records for the Vermont Baseball League fantasy baseball league (formerly Montana State, 2011–2012, and pre-Fantrax Classic Era, 2001–2010).

Live site: **https://raberg1.github.io/Vermont-Baseball-History**

---

## What's in this repo

```
index.html          Main app (single-page, no build step required)
css/styles.css      Stylesheet
js/app.js           All app logic
js/data.js          Generated data file — do not edit directly
process_data.py     Script that generates data.js from the CSV files
data/               Fantrax standings CSVs, historical Excel file, and owners spreadsheet
```

---

## Pages

- **Season** — Final standings with league average, hitting breakdown, and pitching breakdown for any year. All tables are sortable by clicking column headers.
- **History** — League champions table (with avg FP/team, avg hitting, avg pitching per year), all-time records, and year-over-year charts.
- **Owners** — All-time owner summary table (sortable, with current-owners toggle), plus individual career stats, charts, and year-by-year breakdowns for each owner.
- **Add Season** — Upload a new Fantrax CSV to preview it in the browser immediately.

---

## Data coverage

| Era | Years | Source |
|-----|-------|--------|
| Classic Era | 2001–2010 | `data/fantasybaseballstats_1999-2021.xlsx` |
| Montana State (Fantrax) | 2011–2012 | Fantrax standings CSVs |
| Vermont Baseball (Fantrax) | 2013–2025 | Fantrax standings CSVs |

Pre-2011 hitting/pitching splits are estimated from FP/G × game counts (derived from 2009 actuals); all other years use exact totals from Fantrax.

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

- **Fantrax standings CSVs** — exported from [Fantrax](https://www.fantrax.com) at end of each season (2011–present)
- **Historical Excel file** — `data/fantasybaseballstats_1999-2021.xlsx` covers pre-Fantrax seasons (2001–2010)
- **Owners file** — `data/League Owners By Year - Sheet1.csv` maps Fantrax usernames/profiles to owner display names

The Python script (`process_data.py`) parses all sources and writes `js/data.js`, which the app loads at startup. The site is fully static — no server or database required.

**Dependencies:** `openpyxl` is required to parse the historical Excel file:
```bash
pip3 install openpyxl
```

---

## Local development

Open `index.html` directly in a browser. To regenerate data after changing a CSV:

```bash
python3 process_data.py
```

No npm, no build tools. Chart.js is loaded from CDN.

---

*Built with [Claude Code](https://claude.ai/claude-code) by Anthropic.*
