/* ============================================================
   Vermont Baseball League — app.js
   Requires: data.js (LEAGUE_DATA, OWNER_DATA), Chart.js
   ============================================================ */

(function () {
  'use strict';

  // ── Helpers ──────────────────────────────────────────────────────────────

  const $ = id => document.getElementById(id);

  /** Format number with commas, rounding to nearest integer */
  function fmtN(n) {
    if (n == null || n === '') return '—';
    return Math.round(+n).toLocaleString();
  }

  /** Format float, preserving one decimal (used for FP/G, avg rank) */
  function fmtF(n, dec = 2) {
    if (n == null || n === '') return '—';
    return (+n).toFixed(dec);
  }

  /** Rank medal HTML */
  function medal(rank) {
    if (rank === 1) return '<span title="Champion">🥇</span>';
    if (rank === 2) return '<span title="Runner-Up">🥈</span>';
    if (rank === 3) return '<span title="Third Place">🥉</span>';
    return `<span class="fw-bold">${rank}</span>`;
  }

  /** Make every <th> in a table a clickable sort trigger */
  function makeSortable(table) {
    const headers = [...table.querySelectorAll('thead th')];
    let sortCol = -1, sortAsc = true;

    headers.forEach((th, colIdx) => {
      th.classList.add('sortable');
      th.addEventListener('click', () => {
        sortAsc = (sortCol === colIdx) ? !sortAsc : true;
        sortCol = colIdx;

        headers.forEach((h, i) => {
          h.classList.remove('sort-asc', 'sort-desc');
          if (i === colIdx) h.classList.add(sortAsc ? 'sort-asc' : 'sort-desc');
        });

        const tbody = table.querySelector('tbody');
        [...tbody.querySelectorAll('tr')].sort((a, b) => {
          const aCell = a.cells[colIdx];
          const bCell = b.cells[colIdx];
          const aRaw = aCell?.dataset.val ?? aCell?.textContent.trim() ?? '';
          const bRaw = bCell?.dataset.val ?? bCell?.textContent.trim() ?? '';
          const aNum = parseFloat(String(aRaw).replace(/,/g, ''));
          const bNum = parseFloat(String(bRaw).replace(/,/g, ''));
          const cmp  = (!isNaN(aNum) && !isNaN(bNum))
            ? aNum - bNum
            : String(aRaw).localeCompare(String(bRaw));
          return sortAsc ? cmp : -cmp;
        }).forEach(r => tbody.appendChild(r));
      });
    });
  }

  /** Row CSS class for top-3 ranks */
  function rkClass(rank) {
    if (rank === 1) return 'rk-1';
    if (rank === 2) return 'rk-2';
    if (rank === 3) return 'rk-3';
    return '';
  }

  /** Find the display name of the owner who had a given team in a given year */
  function ownerFor(team, year) {
    for (const [name, byYear] of Object.entries(OWNER_DATA)) {
      if (byYear[year] === team) return name;
    }
    return null;
  }

  // ── Sorted years list ────────────────────────────────────────────────────
  const YEARS = Object.keys(LEAGUE_DATA).map(Number).sort((a, b) => a - b);

  // ── App State ────────────────────────────────────────────────────────────
  let currentYear  = YEARS[YEARS.length - 1];
  let ownerChart   = null;
  let histCharts   = {};
  let ownerSummaries = [];

  // ── Navigation ───────────────────────────────────────────────────────────

  function initNav() {
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        $(`page-${page}`).classList.add('active');
        if (page === 'history') renderHistory();
        if (page === 'owners')  renderOwners();
      });
    });
  }

  // ── Year Selector ────────────────────────────────────────────────────────

  function initYearSelector() {
    const sel = $('year-select');
    YEARS.forEach(y => {
      const o = document.createElement('option');
      o.value = y;
      o.textContent = y;
      sel.appendChild(o);
    });
    sel.value = currentYear;

    sel.addEventListener('change', () => {
      currentYear = +sel.value;
      renderSeason(currentYear);
      syncYearButtons();
    });
    $('btn-prev').addEventListener('click', () => stepYear(-1));
    $('btn-next').addEventListener('click', () => stepYear(+1));
    syncYearButtons();
  }

  function stepYear(dir) {
    const idx = YEARS.indexOf(currentYear) + dir;
    if (idx < 0 || idx >= YEARS.length) return;
    currentYear = YEARS[idx];
    $('year-select').value = currentYear;
    renderSeason(currentYear);
    syncYearButtons();
  }

  function syncYearButtons() {
    const idx = YEARS.indexOf(currentYear);
    $('btn-prev').disabled = idx === 0;
    $('btn-next').disabled = idx === YEARS.length - 1;
  }

  function addYearToSelector(year) {
    const sel = $('year-select');
    if ([...sel.options].some(o => +o.value === year)) return;
    const o = document.createElement('option');
    o.value = year;
    o.textContent = year;
    // Insert in sorted order
    const after = [...sel.options].find(o2 => +o2.value > year);
    after ? sel.insertBefore(o, after) : sel.appendChild(o);
  }

  // ── Season Page ──────────────────────────────────────────────────────────

  function renderSeason(year) {
    const s = LEAGUE_DATA[year];
    if (!s) return;

    // Hero banner
    const champ = s.standings[0] || {};
    const ru    = s.standings[1] || {};
    $('season-hero').innerHTML = `
      <div class="season-hero">
        <div class="season-hero-left">
          <div class="hero-year">${year}</div>
          <div class="hero-league">${s.league} League</div>
        </div>
        <div class="season-hero-right">
          <div class="hero-label">🏆 Champion</div>
          <div class="hero-team">${champ.Team || '—'}</div>
          <div class="hero-pts">${champ.FPts ? fmtN(champ.FPts) + ' pts' : ''}</div>
        </div>
      </div>`;

    renderStandingsTable(s);
    renderHittingPts(s);
    renderPitchingPts(s);
  }

  // ─ Overall standings ─────────────────────────────────────────────────────

  function renderStandingsTable(s) {
    const rows = s.standings;
    if (!rows.length) { $('standings-table').innerHTML = '<div class="empty-state">No data</div>'; return; }
    const maxPts = Math.max(...rows.map(r => r.FPts || 0));

    const thead = `<thead><tr>
      <th>Rk</th><th>Team</th><th>Total Points</th>
      <th class="r">FP/G</th><th class="r">GP</th>
      <th class="r">Hitting</th><th class="r">Pitching</th>
      <th class="r">WW</th><th class="r">GB</th>
    </tr></thead>`;

    const tbody = rows.map((r, i) => {
      const rank  = r.Rk || (i + 1);
      const owner = ownerFor(r.Team, s.year);
      const pct   = maxPts > 0 ? ((r.FPts || 0) / maxPts * 100).toFixed(1) : 0;
      const gb    = r.PBL > 0 ? `+${fmtN(r.PBL)}` : '—';

      return `<tr class="${rkClass(rank)}">
        <td>${medal(rank)}</td>
        <td>
          <div class="fw-bold">${r.Team}</div>
          ${owner ? `<div class="text-muted" style="font-size:.75rem">${owner}</div>` : ''}
        </td>
        <td>
          <div class="pts-bar-cell">
            <div class="pts-bar-bg"><div class="pts-bar-fill" style="width:${pct}%"></div></div>
            <div class="pts-num">${fmtN(r.FPts)}</div>
          </div>
        </td>
        <td class="r">${r['FP/G'] || '—'}</td>
        <td class="r">${fmtN(r.GP)}</td>
        <td class="r">${fmtN(r.Hit)}</td>
        <td class="r">${fmtN(r.Pit)}</td>
        <td class="r">${fmtN(r.WW)}</td>
        <td class="r">${gb}</td>
      </tr>`;
    }).join('');

    $('standings-table').innerHTML = `<table>${thead}<tbody>${tbody}</tbody></table>`;
  }

  // ─ Hitting / Pitching breakdown tables ───────────────────────────────────

  const HIT_COLS = [
    { k:'H',   lbl:'H',   good:true  },
    { k:'R',   lbl:'R',   good:true  },
    { k:'2B',  lbl:'2B',  good:true  },
    { k:'3B',  lbl:'3B',  good:true  },
    { k:'HR',  lbl:'HR',  good:true  },
    { k:'RBI', lbl:'RBI', good:true  },
    { k:'BB',  lbl:'BB',  good:true  },
    { k:'SO',  lbl:'SO',  good:false },
    { k:'SB',  lbl:'SB',  good:true  },
    { k:'CS',  lbl:'CS',  good:false },
    { k:'HBP', lbl:'HBP', good:true  },
    { k:'GIDP',lbl:'GIDP',good:false },
    { k:'E',   lbl:'E',   good:false },
  ];

  const PIT_COLS = [
    { k:'W',   lbl:'W',   good:true  },
    { k:'L',   lbl:'L',   good:false },
    { k:'SV',  lbl:'SV',  good:true  },
    { k:'BS',  lbl:'BS',  good:false },
    { k:'K',   lbl:'K',   good:true  },
    { k:'IP',  lbl:'IP',  good:true  },
    { k:'ER',  lbl:'ER',  good:false },
    { k:'BB',  lbl:'BB',  good:false },
    { k:'CG',  lbl:'CG',  good:true  },
    { k:'SHO', lbl:'SHO', good:true  },
    { k:'HB',  lbl:'HB',  good:false },
    { k:'WP',  lbl:'WP',  good:false },
  ];

  function buildBreakdownTable(rows, cols) {
    if (!rows || !rows.length) return '<div class="empty-state">No data</div>';

    const visibleCols = cols.filter(c => rows.some(r => r[c.k] != null));

    const thead = `<thead><tr>
      <th>Rk</th><th>Team</th><th class="r">Pts</th>
      ${visibleCols.map(c => `<th class="r">${c.lbl}</th>`).join('')}
    </tr></thead>`;

    const tbody = rows.map((r, i) => {
      const rank = r.Rk || (i + 1);
      const cells = visibleCols.map(c => {
        const v = r[c.k];
        if (v == null) return '<td class="r">—</td>';
        const cls = c.good ? (v >= 0 ? '' : 'neg') : (v <= 0 ? '' : 'pos');
        return `<td class="r ${cls}">${fmtN(v)}</td>`;
      }).join('');
      return `<tr class="${rkClass(rank)}">
        <td data-val="${rank}">${medal(rank)}</td>
        <td class="fw-bold">${r.Team}</td>
        <td class="r fw-bold">${fmtN(r.FPts)}</td>
        ${cells}
      </tr>`;
    }).join('');

    return `<table>${thead}<tbody>${tbody}</tbody></table>`;
  }

  function renderHittingPts(s) {
    $('hitting-pts-table').innerHTML = buildBreakdownTable(s.hittingPts, HIT_COLS);
    const t = $('hitting-pts-table').querySelector('table');
    if (t) makeSortable(t);
  }
  function renderPitchingPts(s) {
    $('pitching-pts-table').innerHTML = buildBreakdownTable(s.pitchingPts, PIT_COLS);
    const t = $('pitching-pts-table').querySelector('table');
    if (t) makeSortable(t);
  }

  // ── Inline Tab Switcher ──────────────────────────────────────────────────

  function initTabs() {
    document.querySelectorAll('.inline-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = btn.dataset.tab;
        const card  = btn.closest('.card');
        card.querySelectorAll('.inline-tab').forEach(b => b.classList.toggle('active', b === btn));
        card.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === panel));
      });
    });
  }

  // ── History Page ─────────────────────────────────────────────────────────

  function renderHistory() {
    const seasons = Object.values(LEAGUE_DATA).sort((a, b) => a.year - b.year);

    // Per-season summaries
    const summaries = seasons.map(s => {
      const pts  = s.standings.map(r => r.FPts).filter(Boolean);
      const hit  = s.standings.map(r => r.Hit).filter(Boolean);
      const pit  = s.standings.map(r => r.Pit).filter(Boolean);
      const avg  = pts.length  ? pts.reduce((a, b) => a + b) / pts.length  : 0;
      const aHit = hit.length  ? hit.reduce((a, b) => a + b) / hit.length  : null;
      const aPit = pit.length  ? pit.reduce((a, b) => a + b) / pit.length  : null;
      return {
        year:    s.year,
        league:  s.league,
        champ:   s.standings[0]?.Team,
        champPts:s.standings[0]?.FPts,
        ru:      s.standings[1]?.Team,
        ruPts:   s.standings[1]?.FPts,
        last:    s.standings[s.standings.length - 1]?.Team,
        lastPts: s.standings[s.standings.length - 1]?.FPts,
        avg, aHit, aPit,
      };
    });

    // Championship counts
    const champsByOwner = {};
    summaries.forEach(sm => {
      const owner = ownerFor(sm.champ, sm.year);
      if (owner) champsByOwner[owner] = (champsByOwner[owner] || 0) + 1;
    });
    const topOwner = Object.entries(champsByOwner).sort((a, b) => b[1] - a[1])[0];

    // All-time highest score
    const allScores = seasons.flatMap(s => s.standings.map(r => ({ pts: r.FPts, team: r.Team, year: s.year })));
    const bestEver  = allScores.filter(x => x.pts).sort((a, b) => b.pts - a.pts)[0];

    const globalAvg = summaries.map(s => s.avg).reduce((a, b) => a + b, 0) / summaries.length;

    // Lowest ever finish (most GBs)
    const worstGB = seasons.flatMap(s =>
      s.standings.map(r => ({ pbl: r.PBL, team: r.Team, year: s.year }))
    ).filter(x => x.pbl).sort((a, b) => b.pbl - a.pbl)[0];

    // ── Stat Cards
    $('history-cards').innerHTML = `
      <div class="card">
        <div class="card-title">Most Championships</div>
        <div class="card-value">${topOwner ? topOwner[1] : '—'}</div>
        <div class="card-sub">${topOwner ? topOwner[0] : '—'}</div>
      </div>
      <div class="card">
        <div class="card-title">Highest Single-Season Score</div>
        <div class="card-value">${bestEver ? fmtN(bestEver.pts) : '—'}</div>
        <div class="card-sub">${bestEver ? `${bestEver.team} (${bestEver.year})` : '—'}</div>
      </div>
      <div class="card">
        <div class="card-title">All-Time League Avg</div>
        <div class="card-value">${fmtN(globalAvg)}</div>
        <div class="card-sub">Per team per season</div>
      </div>
      <div class="card">
        <div class="card-title">Seasons on Record</div>
        <div class="card-value">${seasons.length}</div>
        <div class="card-sub">${YEARS[0]} – ${YEARS[YEARS.length - 1]}</div>
      </div>
      <div class="card">
        <div class="card-title">Biggest Cellar Finish</div>
        <div class="card-value">${worstGB ? '+' + fmtN(worstGB.pbl) : '—'}</div>
        <div class="card-sub">${worstGB ? `${worstGB.team} (${worstGB.year})` : '—'} GB</div>
      </div>
    `;

    // ── Champions Table
    const champRows = [...summaries].reverse().map(sm => {
      const owner = ownerFor(sm.champ, sm.year);
      return `<tr>
        <td>${sm.year}</td>
        <td>${sm.league}</td>
        <td class="fw-bold">🏆 ${sm.champ || '—'}</td>
        <td>${owner || '—'}</td>
        <td class="r">${fmtN(sm.champPts)}</td>
        <td>${sm.ru || '—'}</td>
        <td class="r">${fmtN(sm.ruPts)}</td>
        <td>${sm.last || '—'}</td>
        <td class="r">${fmtN(sm.lastPts)}</td>
      </tr>`;
    }).join('');

    $('champions-table').innerHTML = `<table>
      <thead><tr>
        <th>Year</th><th>League</th><th>Champion</th><th>Owner</th>
        <th class="r">Pts</th><th>Runner-Up</th><th class="r">Pts</th><th>Last Place</th><th class="r">Pts</th>
      </tr></thead>
      <tbody>${champRows}</tbody>
    </table>`;
    makeSortable($('champions-table').querySelector('table'));

    // ── Charts
    renderHistoryCharts(summaries);
  }

  function renderHistoryCharts(summaries) {
    // Destroy old charts
    Object.values(histCharts).forEach(c => c.destroy && c.destroy());
    histCharts = {};

    const labels = summaries.map(s => s.year);
    const avgPts = summaries.map(s => Math.round(s.avg));
    const champPts = summaries.map(s => s.champPts || null);
    const avgHit = summaries.map(s => s.aHit != null ? Math.round(s.aHit) : null);
    const avgPit = summaries.map(s => s.aPit != null ? Math.round(s.aPit) : null);

    const baseOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
    };

    // Chart 1: League avg & champion pts per year
    histCharts.avgPts = new Chart($('chart-avg-pts').getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'League Average',
            data: avgPts,
            borderColor: '#2c7be5',
            backgroundColor: 'rgba(44,123,229,.10)',
            fill: true,
            tension: .3,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: 'Champion Score',
            data: champPts,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245,158,11,0)',
            borderDash: [5, 3],
            tension: .3,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        ...baseOpts,
        scales: {
          y: {
            beginAtZero: false,
            ticks: { callback: v => v.toLocaleString() },
          },
        },
      },
    });

    // Chart 2: Avg hitting vs pitching grouped bar
    histCharts.hitPit = new Chart($('chart-hit-pit').getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Avg Hitting',  data: avgHit, backgroundColor: '#2c7be5' },
          { label: 'Avg Pitching', data: avgPit, backgroundColor: '#0e9f6e' },
        ],
      },
      options: {
        ...baseOpts,
        scales: {
          y: { ticks: { callback: v => v.toLocaleString() } },
        },
      },
    });
  }

  // ── Owners Page ──────────────────────────────────────────────────────────

  function buildOwnerSummaries() {
    return Object.entries(OWNER_DATA)
      .map(([name, byYear]) => {
        const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
        const records = years.map(y => {
          const season = LEAGUE_DATA[y];
          if (!season) return null;
          const team = byYear[y];
          const row  = season.standings.find(r => r.Team === team);
          return row ? { year: y, team, rank: row.Rk, pts: row.FPts, hit: row.Hit, pit: row.Pit } : null;
        }).filter(Boolean);

        const ranks = records.map(r => r.rank).filter(Boolean);
        const wins  = records.filter(r => r.rank === 1).length;
        const avgRk = ranks.length ? ranks.reduce((a, b) => a + b) / ranks.length : null;
        const bestRk= ranks.length ? Math.min(...ranks) : null;
        const totalPts = records.reduce((sum, r) => sum + (r.pts || 0), 0);

        const hitRecs = records.filter(r => r.hit != null);
        const pitRecs = records.filter(r => r.pit != null);
        const avgHit = hitRecs.length ? hitRecs.reduce((s, r) => s + r.hit, 0) / hitRecs.length : null;
        const avgPit = pitRecs.length ? pitRecs.reduce((s, r) => s + r.pit, 0) / pitRecs.length : null;

        // Averages excluding the shortened 2020 season
        const no2020      = records.filter(r => r.year !== 2020);
        const ranks2020   = no2020.map(r => r.rank).filter(Boolean);
        const avgRkNo2020 = ranks2020.length ? ranks2020.reduce((a, b) => a + b) / ranks2020.length : null;
        const ptsNo2020   = no2020.filter(r => r.pts != null);
        const avgPtsNo2020= ptsNo2020.length ? ptsNo2020.reduce((s, r) => s + r.pts, 0) / ptsNo2020.length : null;
        const hitNo2020   = no2020.filter(r => r.hit != null);
        const avgHitNo2020= hitNo2020.length ? hitNo2020.reduce((s, r) => s + r.hit, 0) / hitNo2020.length : null;
        const pitNo2020   = no2020.filter(r => r.pit != null);
        const avgPitNo2020= pitNo2020.length ? pitNo2020.reduce((s, r) => s + r.pit, 0) / pitNo2020.length : null;

        return { name, years, records, wins, avgRk, bestRk, totalPts, avgHit, avgPit,
                 avgRkNo2020, avgPtsNo2020, avgHitNo2020, avgPitNo2020 };
      })
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (a.avgRk !== b.avgRk) return (a.avgRk || 99) - (b.avgRk || 99);
        return a.name.localeCompare(b.name);
      });
  }

  function renderOwnerSummaryTable(summaries) {
    const thead = `<thead><tr>
      <th>Owner</th>
      <th class="r">Seasons</th>
      <th class="r">Titles</th>
      <th class="r">Avg Rank</th>
      <th class="r">Avg Pts</th>
      <th class="r">Avg Hitting</th>
      <th class="r">Avg Pitching</th>
    </tr></thead>`;

    const tbody = summaries.map(o => `<tr>
      <td class="fw-bold">${o.name}</td>
      <td class="r">${o.records.length}</td>
      <td class="r">${o.wins > 0 ? `<span style="color:var(--gold);font-weight:700">${o.wins} 🏆</span>` : '—'}</td>
      <td class="r">${o.avgRkNo2020 ? o.avgRkNo2020.toFixed(1) : '—'}</td>
      <td class="r">${o.avgPtsNo2020 ? fmtN(o.avgPtsNo2020) : '—'}</td>
      <td class="r">${o.avgHitNo2020 ? fmtN(o.avgHitNo2020) : '—'}</td>
      <td class="r">${o.avgPitNo2020 ? fmtN(o.avgPitNo2020) : '—'}</td>
    </tr>`).join('');

    $('owner-summary-table').innerHTML = `<table>${thead}<tbody>${tbody}</tbody></table>`;
    makeSortable($('owner-summary-table').querySelector('table'));
  }

  function renderOwners() {
    ownerSummaries = buildOwnerSummaries();

    const latestYear = YEARS[YEARS.length - 1];
    let showCurrentOnly = false;

    function applyToggle() {
      const visible = showCurrentOnly
        ? ownerSummaries.filter(o => o.records.some(r => r.year === latestYear))
        : ownerSummaries;
      renderOwnerSummaryTable(visible);
    }

    $('btn-all-owners').onclick = () => {
      showCurrentOnly = false;
      $('btn-all-owners').classList.add('active');
      $('btn-current-owners').classList.remove('active');
      applyToggle();
    };
    $('btn-current-owners').onclick = () => {
      showCurrentOnly = true;
      $('btn-current-owners').classList.add('active');
      $('btn-all-owners').classList.remove('active');
      applyToggle();
    };

    $('owner-list').innerHTML = ownerSummaries.map(o => `
      <div class="owner-card" data-owner="${encodeURIComponent(o.name)}"
           onclick="app.selectOwner('${encodeURIComponent(o.name)}')">
        <div>
          <div class="owner-card-name">${o.name}</div>
          <div class="owner-card-meta">
            ${o.records.length} season${o.records.length !== 1 ? 's' : ''} &nbsp;·&nbsp;
            Avg rank: ${o.avgRk ? o.avgRk.toFixed(1) : '—'}
          </div>
        </div>
        ${o.wins > 0 ? `<div class="wins-badge">${o.wins} 🏆</div>` : ''}
      </div>
    `).join('');

    applyToggle();

    if (ownerSummaries.length > 0) {
      selectOwner(encodeURIComponent(ownerSummaries[0].name));
    }
  }

  function selectOwner(encodedName) {
    const name = decodeURIComponent(encodedName);
    const o = ownerSummaries.find(x => x.name === name);
    if (!o) return;

    // Highlight card
    document.querySelectorAll('.owner-card').forEach(c =>
      c.classList.toggle('active', c.dataset.owner === encodedName)
    );

    renderOwnerDetail(o);
  }

  function renderOwnerDetail(o) {
    const detail = $('owner-detail');

    const statsCards = `
      <div class="owner-detail-cards">
        <div class="card">
          <div class="card-title">Championships</div>
          <div class="card-value">${o.wins}</div>
        </div>
        <div class="card">
          <div class="card-title">Seasons</div>
          <div class="card-value">${o.records.length}</div>
        </div>
        <div class="card">
          <div class="card-title">Avg Finish</div>
          <div class="card-value">${o.avgRk ? o.avgRk.toFixed(1) : '—'}</div>
        </div>
        <div class="card">
          <div class="card-title">Best Finish</div>
          <div class="card-value">${o.bestRk || '—'}</div>
        </div>
        <div class="card">
          <div class="card-title">Avg Hitting Pts</div>
          <div class="card-value">${o.avgHit ? fmtN(o.avgHit) : '—'}</div>
        </div>
        <div class="card">
          <div class="card-title">Avg Pitching Pts</div>
          <div class="card-value">${o.avgPit ? fmtN(o.avgPit) : '—'}</div>
        </div>
      </div>`;

    const tableRows = [...o.records].reverse().map(r => `
      <tr class="${rkClass(r.rank)}">
        <td>${r.year}</td>
        <td>${r.team}</td>
        <td data-val="${r.rank}">${medal(r.rank)}</td>
        <td class="r fw-bold">${fmtN(r.pts)}</td>
        <td class="r">${fmtN(r.hit)}</td>
        <td class="r">${fmtN(r.pit)}</td>
      </tr>`
    ).join('');

    detail.innerHTML = `
      <div style="margin-bottom:16px">
        <div class="section-title" style="font-size:1.2rem;margin-bottom:14px">${o.name}</div>
        ${statsCards}
      </div>
      <div class="card">
        <div class="section-title" style="margin-bottom:12px">Performance by Season</div>
        <div class="chart-wrap-sm" style="margin-bottom:18px">
          <canvas id="owner-chart"></canvas>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Year</th><th>Team</th><th>Rank</th>
              <th class="r">Total Pts</th><th class="r">Hitting</th><th class="r">Pitching</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>`;

    makeSortable(detail.querySelector('table'));

    // Build owner chart
    if (ownerChart) { ownerChart.destroy(); ownerChart = null; }

    const leagueAvgs = o.records.map(r => {
      const s = LEAGUE_DATA[r.year];
      if (!s) return null;
      const pts = s.standings.map(x => x.FPts).filter(Boolean);
      return pts.length ? Math.round(pts.reduce((a, b) => a + b) / pts.length) : null;
    });

    ownerChart = new Chart($('owner-chart').getContext('2d'), {
      type: 'line',
      data: {
        labels: o.records.map(r => r.year),
        datasets: [
          {
            label: o.name,
            data: o.records.map(r => r.pts),
            borderColor: '#2c7be5',
            backgroundColor: 'rgba(44,123,229,.10)',
            fill: true,
            tension: .3,
            pointRadius: 5,
            pointHoverRadius: 7,
          },
          {
            label: 'League Average',
            data: leagueAvgs,
            borderColor: '#94a3b8',
            backgroundColor: 'rgba(0,0,0,0)',
            borderDash: [5, 3],
            tension: .3,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
        scales: {
          y: { ticks: { callback: v => v.toLocaleString() } },
        },
      },
    });
  }

  // ── Upload / Add Season ──────────────────────────────────────────────────

  function initUpload() {
    const box   = $('upload-box');
    const input = $('file-input');

    $('upload-btn').addEventListener('click', () => input.click());

    input.addEventListener('change', e => {
      if (e.target.files[0]) handleFile(e.target.files[0]);
    });

    box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('drag-over'); });
    box.addEventListener('dragleave', () => box.classList.remove('drag-over'));
    box.addEventListener('drop', e => {
      e.preventDefault();
      box.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
  }

  function handleFile(file) {
    const year = parseInt($('upload-year').value, 10);
    if (!year || year < 2000 || year > 2100) {
      showUploadResult('error', 'Please enter a valid year.');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = parseCSVText(e.target.result, year);
        LEAGUE_DATA[year] = data;
        if (!YEARS.includes(year)) {
          YEARS.push(year);
          YEARS.sort((a, b) => a - b);
          addYearToSelector(year);
        }
        currentYear = year;
        $('year-select').value = year;
        syncYearButtons();
        renderSeason(year);
        showUploadResult('success',
          `✓ Loaded ${year} season data (${data.standings.length} teams). ` +
          `Switch to the Season tab to view it.`
        );
      } catch (err) {
        showUploadResult('error', `Failed to parse CSV: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  function showUploadResult(type, msg) {
    $('upload-result').innerHTML =
      `<div class="alert-${type === 'error' ? 'error' : 'success'}">${msg}</div>`;
  }

  // ── Client-side CSV parser (mirrors process_data.py logic) ───────────────

  function parseCSVLine(line) {
    const result = [];
    let inQ = false, cur = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; }
      else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
      else { cur += c; }
    }
    result.push(cur);
    return result;
  }

  const NUM_COLS = new Set([
    'Rk','FPts','FP/G','GP','Hit','Pit','WW','PBL',
    'H','R','2B','3B','HR','RBI','BB','SO','SB','CS',
    'HBP','SH','SF','GIDP','CYC','E','AOF',
    'IP','W','L','SV','BS','CG','ER','K','BK','WP',
    'HB','SHO','NH','PG',
  ]);

  function parseCSVText(text, year) {
    const allRows = text.split(/\r?\n/).map(parseCSVLine);
    const sections = {};
    let curSec = null, curHdr = null, curRows = [];

    for (const row of allRows) {
      if (!row || row.every(c => !c.trim())) {
        if (curSec && curHdr && curRows.length)
          sections[curSec] = { header: curHdr, rows: curRows };
        curSec = null; curHdr = null; curRows = [];
        continue;
      }
      if (!curSec) { curSec = row[0].trim(); continue; }
      if (!curHdr) { curHdr = row.map(c => c.trim()); continue; }
      curRows.push(row);
    }
    if (curSec && curHdr && curRows.length) sections[curSec] = { header: curHdr, rows: curRows };

    function toList(name) {
      const s = sections[name];
      if (!s) return [];
      return s.rows.map(row =>
        Object.fromEntries(s.header.map((col, i) => {
          const raw = (row[i] || '').trim();
          return [col, NUM_COLS.has(col) ? (parseFloat(raw.replace(/,/g, '')) || null) : raw];
        }))
      );
    }

    return {
      year,
      league: year <= 2012 ? 'Montana State' : 'Vermont Baseball',
      standings:    toList('Standings'),
      hittingPts:   toList('Standings - Points - Hitting'),
      pitchingPts:  toList('Standings - Points - Pitching'),
      hittingStats: toList('Standings - Statistics - Hitting'),
      pitchingStats:toList('Standings - Statistics - Pitching'),
    };
  }

  // ── Public interface (for onclick handlers in HTML) ───────────────────────

  window.app = { selectOwner };

  // ── Boot ─────────────────────────────────────────────────────────────────

  function init() {
    initNav();
    initYearSelector();
    initTabs();
    initUpload();
    renderSeason(currentYear);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
