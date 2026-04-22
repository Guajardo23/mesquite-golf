import { PLAYERS, COURSES, SCHEDULE, STABLEFORD_TABLE } from './config.js';
import { calculateScorecard, calculateOverallStandings, getPlayerStrokes, stablefordPoints } from './scoring.js';
import { initFirebase, saveHoleScore, saveFullScorecard, subscribeToScores } from './firebase-init.js';

// ── State ────────────────────────────────────────────────────────────────────
let allScores = {};   // { "JJ_1": {1: 5, 2: 4, ...}, ... }
let currentView = 'leaderboard';
let selectedPlayer = localStorage.getItem('golfPlayer') || '';
let selectedDay = 1;
let currentHole = 1;

// ── Init ─────────────────────────────────────────────────────────────────────
export function initApp() {
    const firebaseOk = initFirebase();

    if (!firebaseOk) {
        document.getElementById('status-bar').textContent = 'Demo Mode (Firebase not configured)';
        document.getElementById('status-bar').classList.add('demo');
    }

    // Subscribe to real-time score updates
    subscribeToScores((scores) => {
        allScores = scores;
        refreshCurrentView();
    });

    // Set up navigation
    document.querySelectorAll('[data-view]').forEach(btn => {
        btn.addEventListener('click', () => {
            navigateTo(btn.dataset.view);
        });
    });

    // Load saved player
    if (selectedPlayer) {
        navigateTo('leaderboard');
    } else {
        navigateTo('leaderboard');
    }
}

function navigateTo(view) {
    currentView = view;

    // Update nav active state
    document.querySelectorAll('[data-view]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    refreshCurrentView();
}

function refreshCurrentView() {
    const content = document.getElementById('main-content');
    switch (currentView) {
        case 'leaderboard': renderLeaderboard(content); break;
        case 'enter':       renderScoreEntry(content); break;
        case 'scorecard':   renderScorecardViewer(content); break;
        case 'rules':       renderRules(content); break;
    }
}

// ── Score Symbol Helper ──────────────────────────────────────────────────────
/**
 * Wrap a score number in traditional golf symbology:
 * Eagle or better: double circle, Birdie: single circle,
 * Par: plain, Bogey: single square, Double bogey: double square,
 * Triple bogey+: double square + poop emoji
 */
function scoreSymbol(gross, netDiff) {
    if (gross == null) return '—';
    if (netDiff <= -2) return `<span class="sym-eagle">${gross}</span>`;
    if (netDiff === -1) return `<span class="sym-birdie">${gross}</span>`;
    if (netDiff === 0)  return `<span class="sym-par">${gross}</span>`;
    if (netDiff === 1)  return `<span class="sym-bogey">${gross}</span>`;
    if (netDiff === 2)  return `<span class="sym-double-bogey">${gross}</span>`;
    return `<span class="sym-double-bogey">${gross}</span> 💩`;
}

// ── Leaderboard View ─────────────────────────────────────────────────────────
function renderLeaderboard(container) {
    const standings = calculateOverallStandings(SCHEDULE, allScores);

    const team1Names = PLAYERS.filter(p => p.team === 1).map(p => p.name).join(', ');
    const team2Names = PLAYERS.filter(p => p.team === 2).map(p => p.name).join(', ');

    let html = `
        <div class="team-battle">
            <div class="team-card team1 ${standings.team1Total > standings.team2Total ? 'winning' : ''}">
                <div class="team-label">Slobs</div>
                <div class="team-score">${standings.team1Total}</div>
                <div class="team-names">${team1Names}</div>
            </div>
            <div class="vs">VS</div>
            <div class="team-card team2 ${standings.team2Total > standings.team1Total ? 'winning' : ''}">
                <div class="team-label">Snobs</div>
                <div class="team-score">${standings.team2Total}</div>
                <div class="team-names">${team2Names}</div>
            </div>
        </div>
    `;

    // Day-by-day results
    html += '<h2>Daily Scores</h2>';
    for (const dayResult of standings.dayResults) {
        // Gather individual player points for this day
        const team1Players = [];
        const team2Players = [];
        for (const ind of standings.individualStandings) {
            const dayData = ind.perDay.find(d => d.day === dayResult.day);
            const pts = dayData ? dayData.total : 0;
            if (ind.team === 1) team1Players.push({ name: ind.name, pts });
            else team2Players.push({ name: ind.name, pts });
        }
        // Sort each team by points descending
        team1Players.sort((a, b) => b.pts - a.pts);
        team2Players.sort((a, b) => b.pts - a.pts);

        html += `<div class="day-section">
            <h3>Day ${dayResult.day}: ${dayResult.course}</h3>
            <div class="day-teams-grid">
                <div class="day-team-col">
                    <div class="day-team-header team1-header">Slobs</div>
                    ${team1Players.map(p => `<div class="day-player-row"><span>${p.name}</span><strong>${p.pts}</strong></div>`).join('')}
                    <div class="day-team-total"><span>Total</span><strong>${dayResult.dayTotal.team1}</strong></div>
                </div>
                <div class="day-team-col">
                    <div class="day-team-header team2-header">Snobs</div>
                    ${team2Players.map(p => `<div class="day-player-row"><span>${p.name}</span><strong>${p.pts}</strong></div>`).join('')}
                    <div class="day-team-total"><span>Total</span><strong>${dayResult.dayTotal.team2}</strong></div>
                </div>
            </div>
        </div>`;
    }

    container.innerHTML = html;
}

// ── Score Entry View ─────────────────────────────────────────────────────────
function renderScoreEntry(container) {
    const dayInfo = SCHEDULE[selectedDay - 1];
    const courseName = dayInfo.course;
    const course = COURSES[courseName];

    let html = `
        <div class="entry-header">
            <div class="picker-row">
                <label>Player</label>
                <select id="player-select">
                    <option value="">Choose player...</option>
                    ${PLAYERS.map(p => `<option value="${p.name}" ${p.name === selectedPlayer ? 'selected' : ''}>${p.name} (${p.index})</option>`).join('')}
                </select>
            </div>
            <div class="picker-row">
                <label>Day</label>
                <div class="day-buttons">
                    ${SCHEDULE.map(s => `<button class="day-btn ${s.day === selectedDay ? 'active' : ''}" data-day="${s.day}">Day ${s.day}<br><small>${s.course}</small></button>`).join('')}
                </div>
            </div>
        </div>
    `;

    if (!selectedPlayer) {
        html += '<div class="entry-prompt">Select a player to enter scores</div>';
        container.innerHTML = html;
        attachEntryListeners(container);
        return;
    }

    // Mode toggle
    html += `
        <div class="mode-toggle">
            <button id="mode-hole" class="mode-btn active">Hole by Hole</button>
            <button id="mode-full" class="mode-btn">Full Scorecard</button>
        </div>
    `;

    // Hole-by-hole entry
    const docKey = `${selectedPlayer}_${selectedDay}`;
    const existingHoles = allScores[docKey] || {};
    const playerStrokes = getPlayerStrokes(selectedPlayer, courseName);

    html += renderHoleByHole(course, playerStrokes, existingHoles);
    html += renderFullCard(course, playerStrokes, existingHoles);

    container.innerHTML = html;
    attachEntryListeners(container);
}

function renderHoleByHole(course, playerStrokes, existingHoles) {
    // Find first unscored hole
    let firstUnscored = 1;
    for (let h = 1; h <= 18; h++) {
        if (existingHoles[h] == null) { firstUnscored = h; break; }
        if (h === 18) firstUnscored = 18;
    }
    if (currentHole < 1 || currentHole > 18) currentHole = firstUnscored;

    const par = course.par[currentHole - 1];
    const hcpRank = course.hcp[currentHole - 1];
    const strokes = playerStrokes[currentHole] || 0;
    const pending = window._pendingScore && window._pendingScore[currentHole];
    const currentScore = pending != null ? pending : (existingHoles[currentHole] != null ? existingHoles[currentHole] : par);
    const isCtp = course.ctpHole === currentHole;

    // Stableford preview
    const pts = stablefordPoints(currentScore, par, strokes);
    const netScore = currentScore - strokes;
    const diff = netScore - par;
    let label = 'Net Par';
    if (diff >= 2) label = 'Net Dbl Bogey+';
    else if (diff === 1) label = 'Net Bogey';
    else if (diff === 0) label = 'Net Par';
    else if (diff === -1) label = 'Net Birdie';
    else if (diff === -2) label = 'Net Eagle';
    else if (diff <= -3) label = 'Net Albatross!';
    const previewClass = diff < 0 ? 'under' : diff > 0 ? 'over' : 'even';

    // Hole progress dots
    let dots = '<div class="hole-dots">';
    for (let h = 1; h <= 18; h++) {
        const scored = existingHoles[h] != null;
        const active = h === currentHole;
        dots += `<span class="dot ${scored ? 'scored' : ''} ${active ? 'active' : ''}" data-hole="${h}">${h}</span>`;
    }
    dots += '</div>';

    // Number strip: show eagle through triple bogey+ range
    const minVal = Math.max(1, par - 2);
    const maxVal = par + 4;
    let strip = '<div class="number-strip">';
    for (let n = minVal; n <= maxVal; n++) {
        const isCurrent = n === currentScore;
        strip += `<span class="strip-num ${isCurrent ? 'current' : ''}" data-score="${n}">${n}</span>`;
    }
    strip += '</div>';

    // Relative to par label
    const relPar = currentScore - par;
    let relLabel = 'E';
    if (relPar > 0) relLabel = `+${relPar}`;
    else if (relPar < 0) relLabel = `${relPar}`;

    return `
        <div id="hole-by-hole" class="entry-mode active">
            ${dots}
            <div class="hole-info">
                <div class="hole-number">Hole ${currentHole} ${isCtp ? '<span class="ctp-badge">CTP</span>' : ''}</div>
                <div class="hole-details">
                    <span class="par-badge">Par ${par}</span>
                    <span class="hcp-badge">HCP ${hcpRank}</span>
                    ${strokes > 0 ? `<span class="stroke-badge">${'●'.repeat(strokes)} Stroke${strokes > 1 ? 's' : ''}</span>` : ''}
                </div>
            </div>
            <div class="stepper-area">
                ${strip}
                <div class="stepper">
                    <button class="stepper-btn minus" data-delta="-1" ${currentScore <= 1 ? 'disabled' : ''}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="6" y1="12" x2="18" y2="12"/></svg>
                    </button>
                    <div class="stepper-value">
                        <div class="stepper-score">${scoreSymbol(currentScore, diff)}</div>
                        <div class="stepper-rel ${previewClass}">${relLabel}</div>
                    </div>
                    <button class="stepper-btn plus" data-delta="1">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="6" x2="12" y2="18"/><line x1="6" y1="12" x2="18" y2="12"/></svg>
                    </button>
                </div>
                <div class="score-preview ${previewClass}">${label} · ${pts} pts</div>
            </div>
            <div class="hole-nav">
                <button id="prev-hole" class="nav-btn" ${currentHole === 1 ? 'disabled' : ''}>◀ Prev</button>
                <button id="save-hole" class="nav-btn save-hole-btn">${existingHoles[currentHole] != null ? 'Update' : 'Save'}</button>
                <button id="next-hole" class="nav-btn" ${currentHole === 18 ? 'disabled' : ''}>Next ▶</button>
            </div>
        </div>
    `;
}

function renderFullCard(course, playerStrokes, existingHoles) {
    let html = '<div id="full-card" class="entry-mode">';
    html += '<table class="full-card-table"><thead><tr><th>Hole</th><th>Par</th><th>●</th><th>Score</th><th>Pts</th></tr></thead><tbody>';

    let front9Pts = 0, back9Pts = 0;

    for (let h = 1; h <= 18; h++) {
        if (h === 10) {
            html += `<tr class="subtotal-row"><td colspan="4">Front 9</td><td><strong>${front9Pts}</strong></td></tr>`;
        }

        const par = course.par[h - 1];
        const strokes = playerStrokes[h] || 0;
        const existing = existingHoles[h];
        let pts = '';
        if (existing != null) {
            const p = stablefordPoints(existing, par, strokes);
            pts = p;
            if (h <= 9) front9Pts += p;
            else back9Pts += p;
        }

        html += `<tr>
            <td>${h}</td>
            <td>${par}</td>
            <td>${strokes > 0 ? '●'.repeat(strokes) : ''}</td>
            <td><input type="number" class="full-score-input" data-hole="${h}" value="${existing != null ? existing : ''}" min="1" max="15" inputmode="numeric"></td>
            <td class="pts-cell">${pts}</td>
        </tr>`;
    }

    html += `<tr class="subtotal-row"><td colspan="4">Back 9</td><td><strong>${back9Pts}</strong></td></tr>`;
    html += `<tr class="total-row"><td colspan="4">Total</td><td><strong>${front9Pts + back9Pts}</strong></td></tr>`;
    html += '</tbody></table>';
    html += '<button id="save-full-card" class="save-btn">Save Scorecard</button>';
    html += '</div>';
    return html;
}

function attachEntryListeners(container) {
    // Player select
    const playerSelect = container.querySelector('#player-select');
    if (playerSelect) {
        playerSelect.addEventListener('change', (e) => {
            selectedPlayer = e.target.value;
            localStorage.setItem('golfPlayer', selectedPlayer);
            currentHole = 1;
            refreshCurrentView();
        });
    }

    // Day buttons
    container.querySelectorAll('.day-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedDay = parseInt(btn.dataset.day);
            currentHole = 1;
            refreshCurrentView();
        });
    });

    // Mode toggle
    const modeHole = container.querySelector('#mode-hole');
    const modeFull = container.querySelector('#mode-full');
    if (modeHole && modeFull) {
        modeHole.addEventListener('click', () => {
            container.querySelector('#hole-by-hole').classList.add('active');
            container.querySelector('#full-card').classList.remove('active');
            modeHole.classList.add('active');
            modeFull.classList.remove('active');
        });
        modeFull.addEventListener('click', () => {
            container.querySelector('#full-card').classList.add('active');
            container.querySelector('#hole-by-hole').classList.remove('active');
            modeFull.classList.add('active');
            modeHole.classList.remove('active');
        });
    }

    // Stepper buttons (+/-)
    container.querySelectorAll('.stepper-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const delta = parseInt(btn.dataset.delta);
            const dayInfo = SCHEDULE[selectedDay - 1];
            const course = COURSES[dayInfo.course];
            const par = course.par[currentHole - 1];
            const docKey = `${selectedPlayer}_${selectedDay}`;
            const existingHoles = allScores[docKey] || {};
            const pending = window._pendingScore && window._pendingScore[currentHole];
            const current = pending != null ? pending : (existingHoles[currentHole] != null ? existingHoles[currentHole] : par);
            const newScore = Math.max(1, current + delta);
            // Temporarily store in demo scores for instant UI feedback
            if (!window._pendingScore) window._pendingScore = {};
            window._pendingScore[currentHole] = newScore;
            // Re-render with pending score
            refreshCurrentView();
        });
    });

    // Strip number tap (jump to that score)
    container.querySelectorAll('.strip-num').forEach(el => {
        el.addEventListener('click', () => {
            const score = parseInt(el.dataset.score);
            if (!window._pendingScore) window._pendingScore = {};
            window._pendingScore[currentHole] = score;
            refreshCurrentView();
        });
    });

    // Save hole button
    const saveHoleBtn = container.querySelector('#save-hole');
    if (saveHoleBtn) {
        saveHoleBtn.addEventListener('click', async () => {
            const dayInfo = SCHEDULE[selectedDay - 1];
            const course = COURSES[dayInfo.course];
            const par = course.par[currentHole - 1];
            const pending = window._pendingScore && window._pendingScore[currentHole];
            const docKey = `${selectedPlayer}_${selectedDay}`;
            const existingHoles = allScores[docKey] || {};
            const score = pending != null ? pending : (existingHoles[currentHole] != null ? existingHoles[currentHole] : par);

            await saveHoleScore(selectedPlayer, selectedDay, currentHole, score);
            if (window._pendingScore) delete window._pendingScore[currentHole];

            // Auto-advance
            if (currentHole < 18) {
                currentHole++;
            }
            refreshCurrentView();
        });
    }

    // Hole dots (jump to specific hole)
    container.querySelectorAll('.dot').forEach(dot => {
        dot.addEventListener('click', () => {
            currentHole = parseInt(dot.dataset.hole);
            refreshCurrentView();
        });
    });

    // Prev/Next hole
    const prevBtn = container.querySelector('#prev-hole');
    const nextBtn = container.querySelector('#next-hole');
    if (prevBtn) prevBtn.addEventListener('click', () => { currentHole = Math.max(1, currentHole - 1); refreshCurrentView(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { currentHole = Math.min(18, currentHole + 1); refreshCurrentView(); });

    // Full card save
    const saveBtn = container.querySelector('#save-full-card');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const holes = {};
            container.querySelectorAll('.full-score-input').forEach(input => {
                const h = parseInt(input.dataset.hole);
                const val = input.value.trim();
                if (val !== '') holes[h] = parseInt(val);
            });
            await saveFullScorecard(selectedPlayer, selectedDay, holes);
            saveBtn.textContent = 'Saved!';
            saveBtn.classList.add('saved');
            setTimeout(() => { saveBtn.textContent = 'Save Scorecard'; saveBtn.classList.remove('saved'); }, 1500);
        });
    }

    // Full card inline point calculation
    container.querySelectorAll('.full-score-input').forEach(input => {
        input.addEventListener('input', () => {
            const h = parseInt(input.dataset.hole);
            const val = input.value.trim();
            const dayInfo = SCHEDULE[selectedDay - 1];
            const course = COURSES[dayInfo.course];
            const playerStrokesMap = getPlayerStrokes(selectedPlayer, dayInfo.course);
            const par = course.par[h - 1];
            const strokes = playerStrokesMap[h] || 0;
            const ptsCell = input.closest('tr').querySelector('.pts-cell');

            if (val !== '' && !isNaN(parseInt(val))) {
                ptsCell.textContent = stablefordPoints(parseInt(val), par, strokes);
            } else {
                ptsCell.textContent = '';
            }

            // Recalc totals
            recalcFullCardTotals(container, course, playerStrokesMap);
        });
    });
}

function recalcFullCardTotals(container, course, playerStrokesMap) {
    let front9 = 0, back9 = 0;
    container.querySelectorAll('.full-score-input').forEach(input => {
        const h = parseInt(input.dataset.hole);
        const val = input.value.trim();
        if (val !== '' && !isNaN(parseInt(val))) {
            const par = course.par[h - 1];
            const strokes = playerStrokesMap[h] || 0;
            const pts = stablefordPoints(parseInt(val), par, strokes);
            if (h <= 9) front9 += pts; else back9 += pts;
        }
    });
    const rows = container.querySelectorAll('.subtotal-row, .total-row');
    if (rows[0]) rows[0].querySelector('strong').textContent = front9;
    if (rows[1]) rows[1].querySelector('strong').textContent = back9;
    if (rows[2]) rows[2].querySelector('strong').textContent = front9 + back9;
}

// ── Scorecard Viewer ─────────────────────────────────────────────────────────
function renderScorecardViewer(container) {
    let html = `
        <div class="viewer-header">
            <div class="picker-row">
                <label>Player</label>
                <select id="view-player">
                    ${PLAYERS.map(p => `<option value="${p.name}" ${p.name === selectedPlayer ? 'selected' : ''}>${p.name}</option>`).join('')}
                </select>
            </div>
            <div class="picker-row">
                <label>Day</label>
                <div class="day-buttons">
                    ${SCHEDULE.map(s => `<button class="day-btn ${s.day === selectedDay ? 'active' : ''}" data-day="${s.day}">Day ${s.day}<br><small>${s.course}</small></button>`).join('')}
                </div>
            </div>
        </div>
    `;

    const viewPlayer = selectedPlayer || PLAYERS[0].name;
    const dayInfo = SCHEDULE[selectedDay - 1];
    const courseName = dayInfo.course;
    const course = COURSES[courseName];
    const docKey = `${viewPlayer}_${selectedDay}`;
    const holes = allScores[docKey] || {};
    const card = calculateScorecard(viewPlayer, courseName, holes);

    html += `<h3>${viewPlayer} — ${courseName} (Day ${selectedDay})</h3>`;
    html += '<table class="scorecard-table"><thead><tr><th>Hole</th><th>Par</th><th>HCP</th><th>●</th><th>Gross</th><th>Net</th><th>Pts</th></tr></thead><tbody>';

    for (let i = 0; i < card.holes.length; i++) {
        const h = card.holes[i];
        if (i === 9) {
            html += `<tr class="subtotal-row"><td colspan="6">Front 9</td><td><strong>${card.front9}</strong></td></tr>`;
        }

        let rowClass = '';
        if (h.points != null) {
            if (h.net - h.par <= -2) rowClass = 'eagle-row';
            else if (h.net - h.par === -1) rowClass = 'birdie-row';
            else if (h.net - h.par >= 2) rowClass = 'double-row';
            else if (h.net - h.par === 1) rowClass = 'bogey-row';
        }
        const isCtp = course.ctpHole === h.hole;

        html += `<tr class="${rowClass}">
            <td>${h.hole}${isCtp ? ' <span class="ctp-badge-sm">CTP</span>' : ''}</td>
            <td>${h.par}</td>
            <td class="dim">${h.hcpRank}</td>
            <td class="strokes">${h.strokes > 0 ? '●'.repeat(h.strokes) : ''}</td>
            <td>${h.gross != null ? scoreSymbol(h.gross, h.net - h.par) : '—'}</td>
            <td>${h.net != null ? h.net : '—'}</td>
            <td><strong>${h.points != null ? h.points : '—'}</strong></td>
        </tr>`;
    }

    html += `<tr class="subtotal-row"><td colspan="6">Back 9</td><td><strong>${card.back9}</strong></td></tr>`;
    html += `<tr class="total-row"><td colspan="6">Total (${card.holesPlayed} holes)</td><td><strong>${card.total}</strong></td></tr>`;
    html += '</tbody></table>';

    container.innerHTML = html;

    // Attach listeners
    const viewPlayerSelect = container.querySelector('#view-player');
    if (viewPlayerSelect) {
        viewPlayerSelect.addEventListener('change', (e) => {
            selectedPlayer = e.target.value;
            refreshCurrentView();
        });
    }
    container.querySelectorAll('.day-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedDay = parseInt(btn.dataset.day);
            refreshCurrentView();
        });
    });
}

// ── Rules Quick Reference ────────────────────────────────────────────────────
function renderRules(container) {
    let html = '<h2>Modified Stableford Scoring (Net)</h2>';
    html += '<p>All scores are net (after applying handicap strokes).</p>';
    html += '<table class="rules-table"><thead><tr><th>Net Score</th><th>Points</th></tr></thead><tbody>';
    for (const row of STABLEFORD_TABLE.label) {
        html += `<tr><td>${row.name}</td><td><strong>${row.points}</strong></td></tr>`;
    }
    html += '</tbody></table>';

    html += '<h2>Match Scoring</h2>';
    html += '<ul>';
    html += '<li>Each day: two foursomes, each with a Slobs pair vs Snobs pair</li>';
    html += '<li>Both players play their own ball with full handicap strokes</li>';
    html += '<li><strong>Best-ball Stableford:</strong> on each hole, the pair takes the higher Stableford score of the two partners</li>';
    html += '<li>Each pair\'s 18-hole best-ball total contributes to the team\'s daily score</li>';
    html += '<li>After 3 days, team with the most total Stableford points wins</li>';
    html += '</ul>';

    html += '<h2>Closest to the Pin</h2>';
    for (const day of SCHEDULE) {
        const course = COURSES[day.course];
        const hole = course.ctpHole;
        const par = course.par[hole - 1];
        html += `<p>Day ${day.day} (${day.course}): Hole #${hole} (Par ${par})</p>`;
    }

    // Stroke allocation tables
    html += '<h2>Stroke Allocation</h2>';
    for (const day of SCHEDULE) {
        const courseName = day.course;
        const course = COURSES[courseName];
        html += `<h3>Day ${day.day}: ${courseName}</h3>`;
        html += '<div class="stroke-table-wrap"><table class="stroke-table"><thead><tr><th>Hole</th>';
        for (let h = 1; h <= 18; h++) {
            html += `<th>${h}</th>`;
        }
        html += '</tr></thead><tbody>';

        // Par row
        html += '<tr class="par-row"><td>Par</td>';
        for (let h = 0; h < 18; h++) html += `<td>${course.par[h]}</td>`;
        html += '</tr>';

        // HCP row
        html += '<tr class="hcp-row"><td>HCP</td>';
        for (let h = 0; h < 18; h++) html += `<td>${course.hcp[h]}</td>`;
        html += '</tr>';

        // Player rows
        for (const player of PLAYERS.sort((a, b) => a.index - b.index)) {
            const strokes = getPlayerStrokes(player.name, courseName);
            html += `<tr><td>${player.name}</td>`;
            for (let h = 1; h <= 18; h++) {
                const s = strokes[h] || 0;
                html += `<td class="stroke-cell">${s > 0 ? '●'.repeat(s) : ''}</td>`;
            }
            html += '</tr>';
        }

        html += '</tbody></table></div>';
    }

    container.innerHTML = html;
}
