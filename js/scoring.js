import { PLAYERS, COURSES } from './config.js';

/**
 * Course handicap = Index × (Slope / 113), rounded.
 */
export function courseHandicap(index, slope) {
    return Math.round(index * slope / 113);
}

/**
 * Return an object { playerName: netStrokes } playing off the lowest handicapper.
 */
export function playingOffStrokes(players, slope) {
    const chs = {};
    for (const p of players) {
        chs[p.name] = courseHandicap(p.index, slope);
    }
    const low = Math.min(...Object.values(chs));
    const result = {};
    for (const [name, ch] of Object.entries(chs)) {
        result[name] = ch - low;
    }
    return result;
}

/**
 * Given net strokes and the 18-hole HCP ranking array (index 0 = hole 1's rank),
 * return an object { holeNumber: strokeCount } for holes that get strokes.
 */
export function strokeHoles(netStrokes, hcpRanking) {
    // Map rank → hole number (1-indexed)
    const rankToHole = {};
    for (let i = 0; i < hcpRanking.length; i++) {
        rankToHole[hcpRanking[i]] = i + 1;
    }

    const result = {};
    for (let rank = 1; rank <= 18; rank++) {
        const hole = rankToHole[rank];
        if (netStrokes >= 18) {
            if (rank <= (netStrokes - 18)) {
                result[hole] = 2;
            } else {
                result[hole] = 1;
            }
        } else {
            if (rank <= netStrokes) {
                result[hole] = 1;
            }
        }
    }
    return result;
}

/**
 * Get strokes received for a specific player on a specific course.
 * Returns { holeNumber: strokeCount }.
 */
export function getPlayerStrokes(playerName, courseName) {
    const course = COURSES[courseName];
    const net = playingOffStrokes(PLAYERS, course.slope);
    return strokeHoles(net[playerName], course.hcp);
}

/**
 * Calculate Stableford points for a single hole.
 * @param {number} grossScore - The player's raw score on the hole.
 * @param {number} par - The hole's par.
 * @param {number} strokes - Number of handicap strokes received on this hole (0, 1, or 2).
 * @returns {number} Stableford points (0, 1, 2, 4, 6, or 8).
 */
export function stablefordPoints(grossScore, par, strokes) {
    const netScore = grossScore - strokes;
    const diff = netScore - par;
    if (diff >= 2)  return 0; // double bogey or worse
    if (diff === 1) return 1; // bogey
    if (diff === 0) return 2; // par
    if (diff === -1) return 4; // birdie
    if (diff === -2) return 6; // eagle
    return 8; // albatross or better
}

/**
 * Calculate a player's full scorecard for a round.
 * @param {string} playerName
 * @param {string} courseName
 * @param {Object} holes - { 1: grossScore, 2: grossScore, ... } (null/undefined = not played)
 * @returns {Object} { holes: [{hole, par, hcpRank, strokes, gross, net, points}, ...],
 *                      front9: totalPoints, back9: totalPoints, total: totalPoints,
 *                      holesPlayed: count }
 */
export function calculateScorecard(playerName, courseName, holes) {
    const course = COURSES[courseName];
    const playerStrokes = getPlayerStrokes(playerName, courseName);

    const holeResults = [];
    let front9 = 0, back9 = 0, holesPlayed = 0;

    for (let h = 1; h <= 18; h++) {
        const par = course.par[h - 1];
        const hcpRank = course.hcp[h - 1];
        const strokes = playerStrokes[h] || 0;
        const gross = holes[h] != null ? holes[h] : null;

        let net = null, points = null;
        if (gross != null) {
            net = gross - strokes;
            points = stablefordPoints(gross, par, strokes);
            holesPlayed++;
            if (h <= 9) front9 += points;
            else back9 += points;
        }

        holeResults.push({ hole: h, par, hcpRank, strokes, gross, net, points });
    }

    return {
        holes: holeResults,
        front9,
        back9,
        total: front9 + back9,
        holesPlayed,
    };
}

/**
 * Calculate match results for a single day.
 * @param {number} day - Day number (1, 2, or 3)
 * @param {Object} allScores - { "JJ_1": {1: 5, 2: 4, ...}, "Nick_1": {...}, ... }
 * @returns {Object} { foursomes: [{ team1Players, team2Players, team1Points, team2Points, margin }], dayTotal: {team1, team2} }
 */
export function calculateDayResults(daySchedule, allScores) {
    const courseName = daySchedule.course;
    const foursomeResults = [];
    let dayTeam1 = 0, dayTeam2 = 0;

    for (const foursome of daySchedule.foursomes) {
        // Best-ball Stableford: take the better score from each pair on every hole
        const t1Cards = foursome.team1.map(name => {
            const key = `${name}_${daySchedule.day}`;
            const holes = allScores[key] || {};
            return calculateScorecard(name, courseName, holes);
        });

        const t2Cards = foursome.team2.map(name => {
            const key = `${name}_${daySchedule.day}`;
            const holes = allScores[key] || {};
            return calculateScorecard(name, courseName, holes);
        });

        let t1Points = 0, t2Points = 0;
        for (let h = 0; h < 18; h++) {
            const t1HolePts = t1Cards.map(c => c.holes[h].points ?? 0);
            const t2HolePts = t2Cards.map(c => c.holes[h].points ?? 0);
            t1Points += Math.max(...t1HolePts);
            t2Points += Math.max(...t2HolePts);
        }

        foursomeResults.push({
            team1Players: foursome.team1,
            team2Players: foursome.team2,
            team1Points: t1Points,
            team2Points: t2Points,
            margin: t1Points - t2Points,
        });

        dayTeam1 += t1Points;
        dayTeam2 += t2Points;
    }

    return {
        foursomes: foursomeResults,
        dayTotal: { team1: dayTeam1, team2: dayTeam2 },
    };
}

/**
 * Calculate overall team standings across all days.
 * @param {Object} allScores - all score documents keyed by "player_day"
 * @returns {Object} { team1Total, team2Total, dayResults: [...], individualStandings: [...] }
 */
export function calculateOverallStandings(schedule, allScores) {
    let team1Total = 0, team2Total = 0;
    const dayResults = [];

    for (const daySchedule of schedule) {
        const result = calculateDayResults(daySchedule, allScores);
        dayResults.push({ day: daySchedule.day, course: daySchedule.course, ...result });
        team1Total += result.dayTotal.team1;
        team2Total += result.dayTotal.team2;
    }

    // Individual standings
    const individualStandings = [];
    for (const player of PLAYERS) {
        let totalPoints = 0, totalHolesPlayed = 0;
        const perDay = [];

        for (const daySchedule of schedule) {
            const key = `${player.name}_${daySchedule.day}`;
            const holes = allScores[key] || {};
            const card = calculateScorecard(player.name, daySchedule.course, holes);
            totalPoints += card.total;
            totalHolesPlayed += card.holesPlayed;
            perDay.push({ day: daySchedule.day, course: daySchedule.course, ...card });
        }

        individualStandings.push({
            name: player.name,
            team: player.team,
            index: player.index,
            totalPoints,
            totalHolesPlayed,
            perDay,
        });
    }

    individualStandings.sort((a, b) => b.totalPoints - a.totalPoints);

    return { team1Total, team2Total, dayResults, individualStandings };
}
