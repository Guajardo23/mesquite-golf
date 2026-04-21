// ── Players ──────────────────────────────────────────────────────────────────
export const PLAYERS = [
    { name: "JJ",      index: 7,  team: 1 },
    { name: "Nick",    index: 9,  team: 1 },
    { name: "Brandon", index: 10, team: 2 },
    { name: "Beto",    index: 11, team: 1 },
    { name: "Brian",   index: 16, team: 1 },
    { name: "Paul",    index: 17, team: 2 },
    { name: "Geoff",   index: 20, team: 2 },
    { name: "Ron",     index: 22, team: 2 },
];

// ── Courses ──────────────────────────────────────────────────────────────────
export const COURSES = {
    "Sunriver": {
        tees: "Blue",
        rating: 69.2,
        slope: 124,
        par: [4, 4, 3, 4, 4, 4, 5, 3, 4,  4, 3, 5, 4, 3, 5, 3, 5, 4],
        hcp: [7, 1, 15, 9, 13, 11, 3, 17, 5,  4, 8, 16, 2, 12, 18, 10, 14, 6],
        ctpHole: 11,
    },
    "Coral Canyon": {
        tees: "Blue/White",
        rating: 70.6,
        slope: 135,
        par: [4, 3, 4, 3, 5, 4, 5, 3, 5,  4, 5, 3, 4, 4, 3, 5, 4, 4],
        hcp: [9, 15, 5, 7, 13, 1, 17, 11, 3,  6, 10, 12, 8, 2, 16, 18, 14, 4],
        ctpHole: 15,
    },
    "Wolf Creek": {
        tees: "Masters",
        rating: 68.8,
        slope: 137,
        par: [5, 4, 3, 4, 5, 4, 4, 3, 4,  4, 3, 5, 4, 4, 3, 4, 5, 4],
        hcp: [9, 1, 7, 15, 3, 11, 13, 5, 17,  2, 16, 8, 14, 4, 18, 10, 6, 12],
        ctpHole: 15,
    },
};

// ── Schedule ─────────────────────────────────────────────────────────────────
export const SCHEDULE = [
    {
        day: 1,
        course: "Sunriver",
        foursomes: [
            { team1: ["JJ", "Brian"],  team2: ["Geoff", "Ron"] },
            { team1: ["Nick", "Beto"], team2: ["Paul", "Brandon"] },
        ],
    },
    {
        day: 2,
        course: "Coral Canyon",
        foursomes: [
            { team1: ["JJ", "Nick"],    team2: ["Ron", "Brandon"] },
            { team1: ["Brian", "Beto"], team2: ["Geoff", "Paul"] },
        ],
    },
    {
        day: 3,
        course: "Wolf Creek",
        foursomes: [
            { team1: ["JJ", "Beto"],    team2: ["Geoff", "Brandon"] },
            { team1: ["Brian", "Nick"],  team2: ["Ron", "Paul"] },
        ],
    },
];

// ── Stableford Points Table ──────────────────────────────────────────────────
// Key = net score relative to par (negative = under par)
export const STABLEFORD_TABLE = {
    label: [
        { diff:  2, name: "Double Bogey+", points: 0 },
        { diff:  1, name: "Bogey",         points: 1 },
        { diff:  0, name: "Par",           points: 2 },
        { diff: -1, name: "Birdie",        points: 4 },
        { diff: -2, name: "Eagle",         points: 6 },
        { diff: -3, name: "Albatross",     points: 8 },
    ],
};
