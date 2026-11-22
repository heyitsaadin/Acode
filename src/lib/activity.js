/**
 * Local coding activity for the profile page.
 *
 * Everything is stored on this device only (localStorage), one small record
 * per day: time spent coding, lines written, files created and time per
 * language. Nothing is sent anywhere.
 */
import { getMode, getModeForPath } from "cm/modelist";

const STORAGE_KEY = "acode-activity-v1";
const KEEP_DAYS = 400;
const TICK_MS = 10 * 1000;
// No touch/key input for this long means the person stepped away.
const IDLE_MS = 2 * 60 * 1000;
const SAVE_DELAY = 3000;
const DAY_MS = 24 * 60 * 60 * 1000;
// Score (about "minutes of coding") needed for each shade 1 to 4.
const LEVELS = [1, 10, 30, 60];

let days = {};
let started = false;
let lastInput = 0;
let lastTick = 0;
let saveTimer = null;

const pad = (n) => String(n).padStart(2, "0");

export function dayKey(date = new Date()) {
	const month = pad(date.getMonth() + 1);
	return `${date.getFullYear()}-${month}-${pad(date.getDate())}`;
}

function normalizeDay(day) {
	return {
		ms: Number(day?.ms) || 0,
		lines: Number(day?.lines) || 0,
		files: Number(day?.files) || 0,
		langs: day?.langs && typeof day.langs === "object" ? day.langs : {},
	};
}

function load() {
	days = {};
	try {
		const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
		const cutoff = dayKey(new Date(Date.now() - KEEP_DAYS * DAY_MS));
		for (const [key, value] of Object.entries(parsed?.days || {})) {
			if (key >= cutoff) days[key] = normalizeDay(value);
		}
	} catch {
		days = {};
	}
}

function save() {
	clearTimeout(saveTimer);
	saveTimer = null;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ days }));
	} catch {}
}

function scheduleSave() {
	if (!saveTimer) saveTimer = setTimeout(save, SAVE_DELAY);
}

function today() {
	const key = dayKey();
	if (!days[key]) days[key] = normalizeDay();
	return days[key];
}

function languageOf(file) {
	const mode =
		(file.currentMode && getMode(file.currentMode)) ||
		getModeForPath(file.filename || "");
	if (!mode || mode.name === "text") return "";
	return mode.caption || mode.name;
}

function activeLanguage() {
	const file = window.editorManager?.activeFile;
	if (!file || file.type !== "editor") return "";
	return languageOf(file);
}

function tick() {
	const now = Date.now();
	const elapsed = Math.min(now - lastTick, TICK_MS * 2);
	lastTick = now;

	if (document.visibilityState !== "visible") return;
	if (now - lastInput > IDLE_MS) return;

	const day = today();
	day.ms += elapsed;
	const language = activeLanguage();
	if (language) day.langs[language] = (day.langs[language] || 0) + elapsed;
	scheduleSave();
}

/** Start tracking. Safe to call more than once. */
function init() {
	if (started || typeof document === "undefined") return;
	started = true;
	load();
	lastTick = Date.now();

	const markInput = () => {
		lastInput = Date.now();
	};
	for (const type of ["touchstart", "pointerdown", "keydown"]) {
		document.addEventListener(type, markInput, {
			capture: true,
			passive: true,
		});
	}

	setInterval(tick, TICK_MS);
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") save();
	});
	document.addEventListener("pause", save);
}

/**
 * Count lines the person typed. Called from the editor's update listener.
 * Pastes, drops, undo/redo and formatters are ignored.
 * @param {import("@codemirror/view").ViewUpdate} update
 */
function recordEdit(update) {
	if (!started) return;
	lastInput = Date.now();

	let lines = 0;
	for (const tr of update.transactions) {
		if (!tr.docChanged || !tr.isUserEvent("input")) continue;
		if (tr.isUserEvent("input.paste") || tr.isUserEvent("input.drop")) continue;
		tr.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
			lines += Math.max(0, inserted.lines - 1);
		});
	}

	if (!lines) return;
	today().lines += lines;
	scheduleSave();
}

/** Count a file the person created (file tree or file browser). */
function recordFileCreated() {
	if (!started) return;
	lastInput = Date.now();
	today().files += 1;
	scheduleSave();
}

/** Wipe everything that was tracked. */
function reset() {
	days = {};
	save();
}

/** Roughly "minutes of coding" for one day, used to pick the shade. */
function scoreOf(day) {
	return day.ms / 60000 + day.lines / 4 + day.files * 2;
}

function levelOf(score) {
	let level = 0;
	for (const [index, min] of LEVELS.entries()) {
		if (score >= min) level = index + 1;
	}
	return level;
}

/**
 * Everything the profile page needs.
 * @returns {{
 *  year: Array<{date:string, ms:number, lines:number, files:number, level:number}>,
 *  totals: {ms:number, lines:number, files:number, activeDays:number},
 *  current: number,
 *  longest: number,
 *  languages: Array<{name:string, ms:number, share:number}>,
 *  today: {ms:number, lines:number, files:number},
 * }}
 */
function getSummary() {
	if (!started) load();

	const year = [];
	const now = new Date();
	for (let i = 364; i >= 0; i--) {
		const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
		const key = dayKey(date);
		const day = days[key] || normalizeDay();
		year.push({
			date: key,
			ms: day.ms,
			lines: day.lines,
			files: day.files,
			level: levelOf(scoreOf(day)),
		});
	}

	const totals = { ms: 0, lines: 0, files: 0, activeDays: 0 };
	const languageMs = {};
	let longest = 0;
	let run = 0;
	for (const day of year) {
		totals.ms += day.ms;
		totals.lines += day.lines;
		totals.files += day.files;
		if (day.level > 0) {
			totals.activeDays++;
			run++;
			longest = Math.max(longest, run);
		} else {
			run = 0;
		}
		for (const [name, ms] of Object.entries(days[day.date]?.langs || {})) {
			languageMs[name] = (languageMs[name] || 0) + ms;
		}
	}

	// An unfinished day shouldn't break the streak.
	let current = 0;
	let i = year.length - 1;
	if (year[i].level === 0) i--;
	for (; i >= 0 && year[i].level > 0; i--) current++;

	const languageTotal = Object.values(languageMs).reduce((a, b) => a + b, 0);
	const languages = Object.entries(languageMs)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([name, ms]) => ({ name, ms, share: ms / languageTotal }));

	const latest = year[year.length - 1];
	return {
		year,
		totals,
		current,
		longest,
		languages,
		today: { ms: latest.ms, lines: latest.lines, files: latest.files },
	};
}

export default {
	init,
	recordEdit,
	recordFileCreated,
	reset,
	getSummary,
};
