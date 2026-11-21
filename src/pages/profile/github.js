/**
 * GitHub contribution data for the profile page.
 * Data comes from the public github-contributions-api (no token needed)
 * and is cached on the device so the graph still shows offline.
 */

const API = "https://github-contributions-api.jogruber.de/v4";
const USER_KEY = "acode-profile-github";
const CACHE_KEY = "acode-profile-github-cache:";
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours
const NAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

function read(key) {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function write(key, value) {
	try {
		if (value === null || value === "") localStorage.removeItem(key);
		else localStorage.setItem(key, value);
	} catch {}
}

/** Accepts "name", "@name" or a github.com URL. Returns "" if invalid. */
export function cleanUsername(value) {
	const name = String(value || "")
		.trim()
		.replace(/^https?:\/\/(www\.)?github\.com\//i, "")
		.replace(/^@/, "")
		.split(/[/?#]/)[0];
	return NAME_RE.test(name) ? name : "";
}

/** Username the person typed on this device (overrides the account's one). */
export function getSavedUsername() {
	return cleanUsername(read(USER_KEY));
}

export function saveUsername(name) {
	write(USER_KEY, name || null);
}

function normalize(json) {
	const days = (json?.contributions || [])
		.filter((d) => d?.date)
		.map((d) => ({
			date: d.date,
			count: Number(d.count) || 0,
			level: Math.min(4, Math.max(0, Number(d.level) || 0)),
		}))
		.sort((a, b) => (a.date < b.date ? -1 : 1));

	if (!days.length) throw new Error("empty");

	let total = 0;
	let longest = 0;
	let run = 0;
	for (const day of days) {
		total += day.count;
		if (day.count > 0) {
			run++;
			longest = Math.max(longest, run);
		} else {
			run = 0;
		}
	}

	// Today may not have a contribution yet, don't let that break the streak.
	let current = 0;
	let i = days.length - 1;
	if (days[i].count === 0) i--;
	for (; i >= 0 && days[i].count > 0; i--) current++;

	return { days, total, current, longest };
}

function readCache(key) {
	try {
		const raw = read(key);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

/**
 * @param {string} username
 * @param {{force?: boolean}} [options]
 * @returns {Promise<{days: Array, total: number, current: number, longest: number, stale?: boolean}>}
 */
export async function fetchContributions(username, { force = false } = {}) {
	const key = CACHE_KEY + username.toLowerCase();
	const cached = readCache(key);

	if (cached && !force && Date.now() - cached.at < CACHE_TTL) {
		return cached.data;
	}

	try {
		const res = await fetch(`${API}/${encodeURIComponent(username)}?y=last`);
		if (!res.ok) throw new Error(res.status === 404 ? "not-found" : "http");
		const data = normalize(await res.json());
		write(key, JSON.stringify({ at: Date.now(), data }));
		return data;
	} catch (error) {
		if (cached && error.message !== "not-found") {
			return { ...cached.data, stale: true };
		}
		throw error;
	}
}

/** Groups days into Sunday-first weeks of 7 (null = padding). */
export function buildWeeks(days) {
	const weeks = [];
	let week = new Array(
		new Date(`${days[0].date}T00:00:00Z`).getUTCDay(),
	).fill(null);

	for (const day of days) {
		week.push(day);
		if (week.length === 7) {
			weeks.push(week);
			week = [];
		}
	}
	if (week.length) {
		while (week.length < 7) week.push(null);
		weeks.push(week);
	}
	return weeks;
}

/** Month name for the column where a new month starts, else undefined. */
export function monthLabels(weeks) {
	const starts = [];
	let prev = -1;
	weeks.forEach((week, i) => {
		const day = week.find((d) => d?.date.endsWith("-01")) || week.find(Boolean);
		if (!day) return;
		const month = Number(day.date.slice(5, 7)) - 1;
		if (month !== prev) {
			starts.push({ i, month });
			prev = month;
		}
	});

	// A tiny first month would collide with the next label, so drop it.
	if (starts.length > 1 && starts[1].i - starts[0].i < 3) starts.shift();

	const labels = {};
	for (const { i, month } of starts) labels[i] = MONTHS[month];
	return labels;
}
