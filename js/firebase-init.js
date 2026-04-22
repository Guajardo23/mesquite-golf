import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDoc,
    onSnapshot,
    enableIndexedDbPersistence,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// ── Firebase Config ──────────────────────────────────────────────────────────
// TODO: Replace with your Firebase project config from Firebase Console.
// Go to: https://console.firebase.google.com → Your Project → Project Settings → Web App
const firebaseConfig = {
    apiKey: "AIzaSyDR7oJmUfhJQN4azBmh4VXuZiYijbzCeQg",
    authDomain: "mesquitegolf-4a367.firebaseapp.com",
    projectId: "mesquitegolf-4a367",
    storageBucket: "mesquitegolf-4a367.firebasestorage.app",
    messagingSenderId: "1094068101279",
    appId: "1:1094068101279:web:0d02d9496f642457e742aa",
};

let app, db;
let isFirebaseReady = false;
let pendingWrites = []; // Queue for offline writes before Firebase is configured

/**
 * Initialize Firebase. Returns false if config hasn't been set up yet.
 */
export function initFirebase() {
    if (firebaseConfig.apiKey === "YOUR_API_KEY") {
        console.warn("Firebase not configured yet. Running in offline/demo mode.");
        return false;
    }

    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);

        // Enable offline persistence so scores queue if cell service drops
        enableIndexedDbPersistence(db).catch((err) => {
            if (err.code === "failed-precondition") {
                console.warn("Persistence failed: multiple tabs open.");
            } else if (err.code === "unimplemented") {
                console.warn("Persistence not available in this browser.");
            }
        });

        isFirebaseReady = true;
        return true;
    } catch (e) {
        console.error("Firebase init failed:", e);
        return false;
    }
}

/**
 * Save a player's score for a specific hole on a specific day.
 * Creates/updates the document "PlayerName_Day" in the "rounds" collection.
 */
export async function saveHoleScore(playerName, day, holeNumber, grossScore) {
    const docId = `${playerName}_${day}`;

    if (!isFirebaseReady) {
        // Demo mode: store in memory
        if (!window._demoScores) window._demoScores = {};
        if (!window._demoScores[docId]) window._demoScores[docId] = {};
        window._demoScores[docId][holeNumber] = grossScore;
        // Fire listeners
        if (window._demoListeners) {
            for (const fn of window._demoListeners) fn(getAllDemoScores());
        }
        return;
    }

    const ref = doc(db, "rounds", docId);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? snap.data() : { player: playerName, day, holes: {} };

    existing.holes[holeNumber] = grossScore;
    existing.updated = serverTimestamp();
    existing.player = playerName;
    existing.day = day;

    await setDoc(ref, existing);
}

/**
 * Save a full scorecard at once (18 holes).
 */
export async function saveFullScorecard(playerName, day, holes) {
    const docId = `${playerName}_${day}`;

    if (!isFirebaseReady) {
        if (!window._demoScores) window._demoScores = {};
        window._demoScores[docId] = { ...holes };
        if (window._demoListeners) {
            for (const fn of window._demoListeners) fn(getAllDemoScores());
        }
        return;
    }

    const ref = doc(db, "rounds", docId);
    await setDoc(ref, {
        player: playerName,
        day,
        holes,
        updated: serverTimestamp(),
    });
}

/**
 * Subscribe to all score updates in real-time.
 * Callback receives an object: { "JJ_1": {1: 5, 2: 4, ...}, ... }
 */
export function subscribeToScores(callback) {
    if (!isFirebaseReady) {
        // Demo mode: use in-memory store
        if (!window._demoListeners) window._demoListeners = [];
        window._demoListeners.push(callback);
        // Fire immediately with current data
        callback(getAllDemoScores());
        return () => {
            window._demoListeners = window._demoListeners.filter(fn => fn !== callback);
        };
    }

    const colRef = collection(db, "rounds");
    return onSnapshot(colRef, (snapshot) => {
        const allScores = {};
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const rawHoles = data.holes || {};
            // Firestore returns object keys as strings; normalize to integers
            const holes = {};
            for (const [key, val] of Object.entries(rawHoles)) {
                holes[parseInt(key)] = val;
            }
            allScores[docSnap.id] = holes;
        });
        callback(allScores);
    });
}

/**
 * Helper: get all demo scores in the expected format.
 */
function getAllDemoScores() {
    return window._demoScores || {};
}
