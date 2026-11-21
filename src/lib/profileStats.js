/**
 * Lightweight, on-device coding stats used by the profile page.
 * Nothing here leaves the device: everything lives in localStorage.
 */

const KEY = "acodeProfileStats";
const FLUSH_MS = 30_000;
const MAX_DELTA_MS = 10 * 60_000;
const KEEP_DAYS = 120;
const ACTIVE_DAY_MS = 60_000;
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

let state = null;
let inited = false;
let foregroundSince = 0;

function dayKey(date = new Date()) {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function emptyState() {
	return {
		launches: 0,
		totalMs: 0,
		saves: 0,
		firstSeen: Date.now(),
		days: {},
	};
}

function load() {
	try {
		const parsed = JSON.parse(localStorage.getItem(KEY));
		if (parsed && typeof parsed === "object") {
			const merged = { ...emptyState(), ...parsed };
			if (!merged.days || typeof merged.days !== "object") merged.days = {};
			return merged;
		}
	} catch {}
	return emptyState();
}

function ensure() {
	if (!state) state = load();
	return state;
}

function today() {
	const s = ensure();
	const key = dayKey();
	if (!s.days[key]) s.days[key] = { ms: 0, saves: 0 };
	return s.days[key];
}

function persist() {
	const s = ensure();
	const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
	for (const key of Object.keys(s.days)) {
		const time = new Date(`${key}T00:00:00`).getTime();
		if (Number.isFinite(time) && time < cutoff) delete s.days[key];
	}
	try {
		localStorage.setItem(KEY, JSON.stringify(s));
	} catch {}
}

function flush() {
	if (!foregroundSince) return;
	const now = Date.now();
	const delta = Math.min(Math.max(now - foregroundSince, 0), MAX_DELTA_MS);
	foregroundSince = now;
	if (!delta) return;
	const s = ensure();
	s.totalMs += delta;
	today().ms += delta;
	persist();
}

function resume() {
	if (!foregroundSince) foregroundSince = Date.now();
}

function pause() {
	flush();
	foregroundSince = 0;
}

function onSave() {
	const s = ensure();
	s.saves += 1;
	today().saves += 1;
	persist();
}

function hookSaves() {
	let tries = 0;
	const timer = setInterval(() => {
		tries += 1;
		const manager = window.editorManager;
		if (manager && typeof manager.on === "function") {
			clearInterval(timer);
			manager.on("save-file", onSave);
		} else if (tries > 60) {
			clearInterval(timer);
		}
	}, 1000);
}

function isActive(day) {
	return !!day && (day.ms >= ACTIVE_DAY_MS || day.saves > 0);
}

const profileStats = {
	/** Start tracking. Safe to call more than once. */
	init() {
		if (inited) return;
		inited = true;

		const s = ensure();
		s.launches += 1;
		persist();

		if (!document.hidden) resume();
		document.addEventListener("visibilitychange", () => {
			if (document.hidden) pause();
			else resume();
		});
		document.addEventListener("pause", pause);
		document.addEventListener("resume", resume);
		setInterval(flush, FLUSH_MS);
		hookSaves();
	},

	/** Snapshot of the numbers shown on the profile page. */
	getStats() {
		const s = ensure();
		flush();

		const now = new Date();
		const week = [];
		for (let i = 6; i >= 0; i--) {
			const date = new Date(
				now.getFullYear(),
				now.getMonth(),
				now.getDate() - i,
			);
			const key = dayKey(date);
			const day = s.days[key] || { ms: 0, saves: 0 };
			week.push({
				key,
				label: DAY_LABELS[date.getDay()],
				ms: day.ms,
				saves: day.saves,
				isToday: i === 0,
			});
		}

		// Streak: consecutive active days ending today (or yesterday).
		let streak = 0;
		for (let i = 0; i < KEEP_DAYS; i++) {
			const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
			const active = isActive(s.days[dayKey(date)]);
			if (active) streak += 1;
			else if (i > 0) break;
		}

		return {
			totalMs: s.totalMs,
			saves: s.saves,
			launches: s.launches,
			firstSeen: s.firstSeen,
			streak,
			week,
			weekMs: week.reduce((sum, d) => sum + d.ms, 0),
			weekSaves: week.reduce((sum, d) => sum + d.saves, 0),
		};
	},

	/** Wipe all tracked stats. */
	reset() {
		state = emptyState();
		state.launches = 1;
		persist();
	},
};

export default profileStats;
