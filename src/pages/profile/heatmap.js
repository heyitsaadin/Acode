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

/** Groups days into Sunday-first weeks of 7 (null = padding). */
export function buildWeeks(days) {
	const weeks = [];
	const offset = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();
	let week = new Array(offset).fill(null);

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
