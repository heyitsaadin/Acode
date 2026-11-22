import { buildWeeks, monthLabels } from "./heatmap";

const WIDTH = 1200;
const PAD = 72;
const GAP = 5;
const FONT = "sans-serif";

/** Resolves any CSS color (var(), color-mix()...) to a value canvas can paint. */
function resolveColor($ref, value) {
	const $probe = document.createElement("i");
	$probe.style.position = "absolute";
	$probe.style.visibility = "hidden";
	$probe.style.background = value;
	$ref.append($probe);
	const color = getComputedStyle($probe).backgroundColor;
	$probe.remove();
	return color;
}

function roundRect(ctx, x, y, w, h, r) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

/**
 * Draws the activity card (stats + heatmap) to a PNG using the current theme.
 * @param {HTMLElement} $ref element inside the profile page, used to read the
 * theme colors
 * @param {object} options
 * @param {string} options.name title shown at the top
 * @param {object} options.data summary from the activity tracker
 * @param {(ms:number) => string} options.formatDuration
 * @param {(key:string, fallback:string) => string} options.label
 * @returns {Promise<Blob>}
 */
export default function renderShareCard($ref, options) {
	const { name, data, formatDuration, label } = options;
	const paint = (value) => resolveColor($ref, value);
	const colors = {
		bg: paint("var(--primary-color, #1e1e1e)"),
		text: paint("var(--primary-text-color, #ffffff)"),
		muted: paint("var(--pf-muted)"),
		accent: paint("var(--pf-accent)"),
		levels: [0, 1, 2, 3, 4].map((n) => paint(`var(--pf-lv${n})`)),
	};

	const weeks = buildWeeks(data.year);
	const months = monthLabels(weeks);
	const cols = weeks.length;
	const cell = Math.floor((WIDTH - PAD * 2 - GAP * (cols - 1)) / cols);
	const gridH = cell * 7 + GAP * 6;

	const metricsTop = PAD + 130;
	const monthBase = metricsTop + 170;
	const gridTop = monthBase + 18;
	const legendBase = gridTop + gridH + 72;
	const height = legendBase + PAD;

	const canvas = document.createElement("canvas");
	canvas.width = WIDTH;
	canvas.height = height;
	const ctx = canvas.getContext("2d");

	ctx.fillStyle = colors.bg;
	ctx.fillRect(0, 0, WIDTH, height);
	ctx.textAlign = "left";
	ctx.textBaseline = "alphabetic";

	// Title
	ctx.fillStyle = colors.text;
	ctx.font = `700 54px ${FONT}`;
	ctx.fillText(name, PAD, PAD + 50, WIDTH - PAD * 2);
	ctx.fillStyle = colors.muted;
	ctx.font = `400 28px ${FONT}`;
	ctx.fillText(label("last 12 months", "Last 12 months"), PAD, PAD + 96);

	// Stats
	const { totals } = data;
	const metrics = [
		[formatDuration(totals.ms), label("coding time", "Coding time")],
		[`${data.current}d`, label("streak", "Streak")],
		[`${data.longest}d`, label("best streak", "Best streak")],
		[String(totals.activeDays), label("active days", "Active days")],
	];
	const colW = (WIDTH - PAD * 2) / metrics.length;
	metrics.forEach(([value, caption], i) => {
		const left = PAD + colW * i;
		ctx.fillStyle = colors.text;
		ctx.font = `700 56px ${FONT}`;
		ctx.fillText(value, left, metricsTop + 60, colW - 16);
		ctx.fillStyle = colors.muted;
		ctx.font = `400 26px ${FONT}`;
		ctx.fillText(caption, left, metricsTop + 104, colW - 16);
	});

	// Heatmap
	ctx.font = `400 22px ${FONT}`;
	weeks.forEach((week, i) => {
		const left = PAD + i * (cell + GAP);
		if (months[i]) {
			ctx.fillStyle = colors.muted;
			ctx.fillText(months[i], left, monthBase);
		}
		week.forEach((day, row) => {
			if (!day) return;
			ctx.fillStyle = colors.levels[day.level] || colors.levels[0];
			roundRect(ctx, left, gridTop + row * (cell + GAP), cell, cell, 3);
			ctx.fill();
		});
	});

	// Legend and brand
	ctx.font = `400 24px ${FONT}`;
	const less = label("less", "Less");
	const more = label("more", "More");
	const swatch = 22;
	const swatchGap = 6;
	const lessW = ctx.measureText(less).width;
	const moreW = ctx.measureText(more).width;
	const swatchesW = swatch * 5 + swatchGap * 4;
	let lx = WIDTH - PAD - (lessW + moreW + swatchesW + 32);
	ctx.fillStyle = colors.muted;
	ctx.fillText(less, lx, legendBase);
	lx += lessW + 16;
	for (const level of colors.levels) {
		ctx.fillStyle = level;
		roundRect(ctx, lx, legendBase - swatch + 3, swatch, swatch, 4);
		ctx.fill();
		lx += swatch + swatchGap;
	}
	ctx.fillStyle = colors.muted;
	ctx.fillText(more, lx + 10, legendBase);

	ctx.fillStyle = colors.accent;
	ctx.font = `700 30px ${FONT}`;
	ctx.fillText("Acode", PAD, legendBase);

	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) resolve(blob);
			else reject(new Error("Unable to render the activity card"));
		}, "image/png");
	});
}
