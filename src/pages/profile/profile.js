import "./profile.scss";
import fsOperation from "fileSystem";
import Page from "components/page";
import Sidebar from "components/sidebar";
import toast from "components/toast";
import confirm from "dialogs/confirm";
import actionStack from "lib/actionStack";
import tracker from "lib/activity";
import config from "lib/config";
import { LOADED_PLUGINS } from "lib/loadPlugins";
import openFile from "lib/openFile";
import openFolder from "lib/openFolder";
import recents from "lib/recents";
import helpers from "utils/helpers";
import Uri from "utils/Uri";
import Url from "utils/Url";
import { buildWeeks, monthLabels } from "./heatmap";

/* Feather-style stroke icons, so the page never depends on the icon font. */
const ICONS = {
	package:
		'<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
	file: '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>',
	folder:
		'<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
	sliders:
		'<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
	contrast:
		'<circle cx="12" cy="12" r="9"/><path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor"/>',
	info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
	external:
		'<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
	logout:
		'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
	login:
		'<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>',
	trash:
		'<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
	user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
	chevron: '<polyline points="9 18 15 12 9 6"/>',
	verified:
		'<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
};

/**
 * Translated string with an English fallback, so a key that has not been
 * added to a language file yet still shows readable text.
 * `{name}` placeholders are filled from `vars`.
 * @param {string} key
 * @param {string} fallback
 * @param {Record<string, string|number>} [vars]
 */
function t(key, fallback, vars = {}) {
	let text = strings[key] || fallback;
	for (const [name, value] of Object.entries(vars)) {
		text = text.replaceAll(`{${name}}`, String(value));
	}
	return text;
}

/* Familiar colors for common languages; anything else gets a stable hue. */
const LANG_COLORS = {
	javascript: "#f1e05a",
	jsx: "#f1e05a",
	typescript: "#3178c6",
	tsx: "#3178c6",
	html: "#e34c26",
	css: "#7b5bb6",
	scss: "#c6538c",
	json: "#8f9aa5",
	markdown: "#519aba",
	python: "#3572a5",
	java: "#b07219",
	kotlin: "#a97bff",
	php: "#4f5d95",
	go: "#00add8",
	rust: "#dea584",
	ruby: "#cc342d",
	yaml: "#cb171e",
	xml: "#0060ac",
	sql: "#e38c00",
	dart: "#00b4ab",
	swift: "#f05138",
	lua: "#4a5bd1",
};

function langColor(name) {
	const key = String(name).toLowerCase();
	if (LANG_COLORS[key]) return LANG_COLORS[key];
	let hue = 0;
	for (const ch of key) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
	return `hsl(${hue} 55% 55%)`;
}

function icon(name, size = 20) {
	const el = document.createElement("span");
	el.className = "pf-icon";
	el.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
	return el;
}

function formatMonthYear(value) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString(undefined, {
		month: "short",
		year: "numeric",
	});
}

function formatDuration(ms) {
	const minutes = Math.round(ms / 60000);
	if (minutes < 1) return ms > 0 ? "<1m" : "0m";
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	if (hours >= 100 || !rest) return `${hours}h`;
	return `${hours}h ${rest}m`;
}

/**
 * Deterministic sample activity shaped like a real year (quieter weekends,
 * a few busy streaks). Only used as a faded preview, never as real data.
 */
function samplePattern(year) {
	return year.map((day, i) => {
		const weekday = new Date(`${day.date}T00:00:00Z`).getUTCDay();
		const wave = (Math.sin(i / 9) + Math.sin(i / 23 + 1) + 2) / 4;
		const noise = ((i * 7919) % 13) / 13;
		const score =
			wave + noise * 0.5 - (weekday === 0 || weekday === 6 ? 0.35 : 0);
		let level = 4;
		if (score < 0.45) level = 0;
		else if (score < 0.7) level = 1;
		else if (score < 0.9) level = 2;
		else if (score < 1.05) level = 3;
		return { date: day.date, ms: 0, level };
	});
}

function tipText(day) {
	const when = new Date(`${day.date}T00:00:00Z`).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	});
	if (!day.level) {
		return t("no activity on", "No activity on {date}", { date: when });
	}
	return `${when} · ${formatDuration(day.ms)}`;
}

/** Same path breakdown the "recent" picker uses. */
function pathDetails(url) {
	url = Url.parse(url).url;
	const isSafUri = /^content:/.test(url);
	const displayPath = isSafUri
		? Uri.getDisplayPath(url)
		: helpers.getVirtualPath(url);
	const documentPath = isSafUri ? Uri.getDisplayPath(url, []) : displayPath;
	const name = Url.basename(displayPath) || Url.basename(documentPath) || url;
	const location =
		Url.dirname(isSafUri ? documentPath : displayPath)?.replace(/\/$/, "") ||
		"/";
	return { name, location };
}

const openUrl = (url) => () => system.openInBrowser(url);

function section(title) {
	const $trail = <span className="pf-section-trail"></span>;
	const $body = <div className="pf-card"></div>;
	const $el = (
		<section className="pf-section">
			<div className="pf-section-head">
				<h3 className="pf-section-title">{title}</h3>
				{$trail}
			</div>
			{$body}
		</section>
	);
	return { $el, $body, $trail };
}

function row({
	iconName,
	title,
	subtitle,
	value,
	onclick,
	danger = false,
	chevron = true,
}) {
	const $text = (
		<div className="pf-row-text">
			<div className="pf-row-title">{title}</div>
		</div>
	);
	if (subtitle) {
		$text.append(<div className="pf-row-sub">{subtitle}</div>);
	}
	const $row = (
		<div className={`pf-row${danger ? " danger" : ""}`} onclick={onclick}>
			{icon(iconName, 20)}
			{$text}
		</div>
	);
	if (value) {
		// Plain strings get the same muted style as element values.
		$row.append(
			typeof value === "string" ? (
				<span className="pf-row-value">{value}</span>
			) : (
				value
			),
		);
	}
	if (chevron) $row.append(icon("chevron", 18));
	return $row;
}

const metric = (value, label) => (
	<div className="pf-metric">
		<div className="pf-metric-value">{String(value)}</div>
		<div className="pf-metric-label">{label}</div>
	</div>
);

/** Avatar circle: initial first, swaps to the picture once it has loaded. */
function buildAvatar(user, getAvatarSrc) {
	const initial = (user.name || user.email || "?")
		.trim()
		.charAt(0)
		.toUpperCase();
	const $img = <img className="pf-avatar-img" alt="" />;
	const $avatar = (
		<div className="pf-avatar">
			<span className="pf-avatar-initial">{initial}</span>
			{$img}
		</div>
	);
	$img.onload = () => $avatar.classList.add("loaded");
	if (typeof getAvatarSrc === "function") {
		Promise.resolve(getAvatarSrc(user))
			.then((src) => {
				if (src) $img.src = src;
			})
			.catch(() => {});
	}
	return $avatar;
}

/** Header for a logged in user. */
function buildUserHero(user, getAvatarSrc) {
	const $nameRow = (
		<div className="pf-name-row">
			<h2 className="pf-name">{user.name}</h2>
		</div>
	);
	if (user.verified) {
		const $v = <span className="pf-verified"></span>;
		$v.append(icon("verified", 16));
		$nameRow.append($v);
	}
	if (user.acode_pro) {
		$nameRow.append(<span className="pf-badge pro">PRO</span>);
	}
	if (user.isAdmin) {
		$nameRow.append(<span className="pf-badge">ADMIN</span>);
	}

	const $meta = <div className="pf-meta"></div>;
	const since = formatMonthYear(user.created_at);
	if (since) {
		$meta.append(
			<span>{t("member since", "Member since {date}", { date: since })}</span>,
		);
	}
	if (user.website) {
		const site = String(user.website);
		const url = /^https?:\/\//.test(site) ? site : `https://${site}`;
		if (since) $meta.append(<span className="pf-dot">·</span>);
		$meta.append(
			<span className="pf-link" onclick={openUrl(url)}>
				{site.replace(/^https?:\/\//, "")}
			</span>,
		);
	}

	return (
		<div className="pf-hero">
			{buildAvatar(user, getAvatarSrc)}
			<div className="pf-hero-text">
				{$nameRow}
				<div className="pf-email">{user.email || ""}</div>
				{$meta}
			</div>
		</div>
	);
}

/** Header shown when nobody is logged in, with a sign in button. */
function buildGuestHero(onSignIn) {
	const signInText = t("login", "Login");
	const $label = <span>{signInText}</span>;
	const $btn = <button type="button" className="pf-btn small"></button>;
	$btn.append(icon("login", 16), $label);
	$btn.onclick = async () => {
		if ($btn.disabled) return;
		$btn.disabled = true;
		$label.textContent = t("loading...", "Loading...");
		try {
			await onSignIn();
		} finally {
			$btn.disabled = false;
			$label.textContent = signInText;
		}
	};

	return (
		<div className="pf-hero">
			<div className="pf-avatar guest">{icon("user", 30)}</div>
			<div className="pf-hero-text">
				<h2 className="pf-name">
					{t("profile not signed in", "Not signed in")}
				</h2>
				<div className="pf-email">
					{t("profile sign in prompt", "Sign in with your Acode account.")}
				</div>
				{$btn}
			</div>
		</div>
	);
}

/**
 * Open the profile page. Works logged in or out.
 * @param {object} options
 * @param {object|null} [options.user] - logged in user, if any
 * @param {(user:object) => Promise<string>} [options.getAvatarSrc]
 * @param {() => Promise<object|null>} [options.onLogin] - resolves the new user
 * @param {() => Promise<boolean>} [options.onLogout]
 */
export default function ProfileInclude({
	user: initialUser = null,
	getAvatarSrc,
	onLogin,
	onLogout,
} = {}) {
	let user = initialUser;

	const $page = Page(t("my profile", "My profile"));
	$page.classList.add("profile-page");

	const close = () => {
		$page.hide();
		Sidebar.hide();
	};
	const goto = (fn) => () => {
		close();
		setTimeout(() => {
			try {
				fn();
			} catch (error) {
				helpers.error(error);
			}
		}, 200);
	};

	const $heroSlot = <div className="pf-slot"></div>;
	const $footSlot = <div className="pf-slot"></div>;
	const activity = section(t("activity", "Activity"));
	const languages = section(t("top languages", "Top languages"));

	/* ---------- account ---------- */
	async function signIn() {
		if (!onLogin) return;
		const next = await onLogin();
		if (next) {
			user = next;
			refreshAccount();
		}
	}

	async function signOut() {
		const ok = await confirm(
			t("logout", "Logout"),
			t(
				"logout confirm",
				"Are you sure you want to log out of your Acode account?",
			),
		);
		if (!ok) return;
		const success = onLogout ? await onLogout() : true;
		if (success === false) return;
		user = null;
		refreshAccount();
	}

	async function resetActivity() {
		const ok = await confirm(
			t("reset activity", "Reset activity"),
			t(
				"reset activity warning",
				"This clears the time, lines, files and streaks tracked on this device.",
			),
		);
		if (!ok) return;
		tracker.reset();
		renderActivity();
		renderLanguages();
		toast(t("activity reset", "Activity reset"));
	}

	function renderHero() {
		$heroSlot.textContent = "";
		$heroSlot.append(
			user ? buildUserHero(user, getAvatarSrc) : buildGuestHero(signIn),
		);
	}

	function renderFoot() {
		$footSlot.textContent = "";
		const $card = <div className="pf-card"></div>;
		$card.append(
			row({
				iconName: "trash",
				title: t("reset activity", "Reset activity"),
				chevron: false,
				onclick: resetActivity,
			}),
		);
		if (user) {
			$card.append(
				row({
					iconName: "logout",
					title: t("logout", "Logout"),
					danger: true,
					chevron: false,
					onclick: signOut,
				}),
			);
		}
		$footSlot.append($card);
	}

	function refreshAccount() {
		// After the first render, sign in/out also swaps the sample heatmap.
		if (activity.$body.firstChild) renderActivity();
		renderHero();
		renderFoot();
	}

	/* ---------- activity ---------- */
	activity.$trail.textContent = t("last 12 months", "Last 12 months");

	function renderActivity() {
		const data = tracker.getSummary();
		// Signed out with nothing tracked yet: show a faded sample instead of
		// a blank grid.
		const isPlaceholder = !user && !data.totals.activeDays;
		const weeks = buildWeeks(
			isPlaceholder ? samplePattern(data.year) : data.year,
		);
		const labels = monthLabels(weeks);
		const todayKey = data.year[data.year.length - 1].date;
		const $grid = <div className="pf-gh-grid"></div>;

		weeks.forEach((week, i) => {
			const $week = <div className="pf-gh-week"></div>;
			$week.append(<div className="pf-gh-month">{labels[i] || ""}</div>);
			for (const day of week) {
				let cellClass = "pf-gh-cell none";
				if (day) {
					cellClass = `pf-gh-cell lv${day.level}`;
					if (day.date === todayKey && !isPlaceholder) cellClass += " today";
				}
				const $cell = <div className={cellClass}></div>;
				if (day && !isPlaceholder) $cell.dataset.tip = tipText(day);
				$week.append($cell);
			}
			$grid.append($week);
		});

		// Tapping a day highlights it and shows its details.
		let $selected = null;
		$grid.onclick = (e) => {
			const $cell = e.target;
			const tip = $cell?.dataset?.tip;
			if (!tip) return;
			$selected?.classList.remove("selected");
			$selected = $cell;
			$cell.classList.add("selected");
			toast(tip);
		};

		const $scroll = <div className="pf-gh-scroll">{$grid}</div>;

		// Weekday labels (Mon/Wed/Fri) stay put while the grid scrolls.
		const $days = <div className="pf-gh-days"></div>;
		$days.append(<div className="pf-gh-spacer"></div>);
		for (let row = 0; row < 7; row++) {
			// 2024-01-07 was a Sunday, matching the Sunday-first grid.
			const name =
				row % 2 === 1
					? new Date(2024, 0, 7 + row).toLocaleDateString(undefined, {
							weekday: "short",
						})
					: "";
			$days.append(<div className="pf-gh-daylabel">{name}</div>);
		}
		const $heat = (
			<div
				className={isPlaceholder ? "pf-gh-wrap placeholder" : "pf-gh-wrap"}
			>
				{$days}
				{$scroll}
			</div>
		);

		const $legend = <div className="pf-gh-legend"></div>;
		$legend.append(<span>{t("less", "Less")}</span>);
		for (let n = 0; n <= 4; n++) {
			$legend.append(<span className={`pf-gh-cell lv${n}`}></span>);
		}
		$legend.append(<span>{t("more", "More")}</span>);

		const { today, totals } = data;
		const todayText = today.ms
			? t("today time", "Today {time}", { time: formatDuration(today.ms) })
			: t("nothing yet today", "Nothing yet today");

		activity.$body.textContent = "";
		activity.$body.append(
			<div className="pf-metrics">
				{metric(formatDuration(totals.ms), t("coding time", "Coding time"))}
				{metric(`${data.current}d`, t("streak", "Streak"))}
				{metric(`${data.longest}d`, t("best streak", "Best streak"))}
				{metric(String(totals.activeDays), t("active days", "Active days"))}
			</div>,
			$heat,
			<div className="pf-gh-foot">
				<span>
					{isPlaceholder
						? t(
								"activity placeholder hint",
								"Sign in and start coding to fill this in",
							)
						: todayText}
				</span>
				{$legend}
			</div>,
		);

		// Newest weeks are on the right, so start scrolled to the end.
		setTimeout(() => {
			$scroll.scrollLeft = $scroll.scrollWidth;
		}, 50);

		renderWeek(data);
		return data;
	}

	/* ---------- this week (last 7 days) ---------- */
	const thisWeek = section(t("this week", "This week"));

	function renderWeek(data) {
		const days = data.year.slice(-7);
		const max = Math.max(...days.map((day) => day.ms), 1);
		const total = days.reduce((sum, day) => sum + day.ms, 0);
		thisWeek.$trail.textContent = total ? formatDuration(total) : "";

		const $chart = <div className="pf-week"></div>;
		days.forEach((day, i) => {
			const isToday = i === days.length - 1;
			const percent = day.ms
				? Math.max(8, Math.round((day.ms / max) * 100))
				: 0;
			const barClass = ["pf-week-bar", !day.ms && "empty", isToday && "today"]
				.filter(Boolean)
				.join(" ");
			const name = new Date(`${day.date}T00:00:00Z`).toLocaleDateString(
				undefined,
				{ weekday: "short", timeZone: "UTC" },
			);
			$chart.append(
				<div className="pf-week-col" onclick={() => toast(tipText(day))}>
					<div className="pf-week-area">
						<span className={barClass} style={{ height: `${percent}%` }}></span>
					</div>
					<span className={`pf-week-day${isToday ? " today" : ""}`}>
						{name}
					</span>
				</div>,
			);
		});
		thisWeek.$body.textContent = "";
		thisWeek.$body.append($chart);
	}

	function renderLanguages(list = tracker.getSummary().languages) {
		languages.$body.textContent = "";
		if (!list.length) {
			languages.$body.append(
				<div className="pf-empty">
					{t("languages empty", "Languages show up here as you code.")}
				</div>,
			);
			return;
		}
		const $strip = <div className="pf-lang-strip"></div>;
		for (const lang of list) {
			$strip.append(
				<span
					className="pf-lang-seg"
					style={{
						flexGrow: String(Math.max(lang.share, 0.02)),
						background: langColor(lang.name),
					}}
				></span>,
			);
		}
		languages.$body.append($strip);

		for (const lang of list) {
			const percent = lang.share * 100;
			const label = percent < 1 ? "<1%" : `${Math.round(percent)}%`;
			languages.$body.append(
				<div className="pf-lang">
					<span
						className="pf-lang-dot"
						style={{ background: langColor(lang.name) }}
					></span>
					<span className="pf-lang-name">{lang.name}</span>
					<span className="pf-lang-percent">{label}</span>
				</div>,
			);
		}
	}

	/* ---------- recents ---------- */
	const recent = section(t("recently used", "Recently used"));
	const recentFiles = recents.files.filter(Boolean).slice(0, 4);
	const recentFolders = recents.folders.filter((f) => f?.url).slice(0, 2);

	for (const file of recentFiles) {
		const { name, location } = pathDetails(file);
		recent.$body.append(
			row({
				iconName: "file",
				title: name,
				subtitle: location,
				chevron: false,
				onclick: goto(() =>
					Promise.resolve(openFile(file, { render: true })).catch((err) =>
						helpers.error(err),
					),
				),
			}),
		);
	}
	for (const folder of recentFolders) {
		const { name, location } = pathDetails(folder.url);
		recent.$body.append(
			row({
				iconName: "folder",
				title: name,
				subtitle: location,
				chevron: false,
				onclick: goto(() => openFolder(folder.url, folder.opts)),
			}),
		);
	}

	/* ---------- menu ---------- */
	// Count of plugins downloaded to this device; tapping opens the
	// Plugins page, which starts on its "Installed" tab.
	const $pluginCount = <span className="pf-row-value">–</span>;

	const menu = section(t("more", "More"));
	const menuRows = [
		{
			iconName: "package",
			title: t("plugins", "Plugins"),
			value: $pluginCount,
			onclick: goto(async () =>
				(
					await import(/* webpackChunkName: "plugins" */ "pages/plugins")
				).default(),
			),
		},
		{
			iconName: "sliders",
			title: t("settings", "Settings"),
			onclick: goto(async () =>
				(
					await import(
						/* webpackChunkName: "mainSettings" */ "settings/mainSettings"
					)
				).default(),
			),
		},
		{
			iconName: "contrast",
			title: t("app theme", "App theme"),
			onclick: goto(async () =>
				(
					await import(
						/* webpackChunkName: "changeTheme" */ "palettes/changeTheme"
					)
				).default("app"),
			),
		},
		{
			iconName: "folder",
			title: t("open folder", "Open folder"),
			onclick: goto(() => acode.exec("open-folder")),
		},
		{
			iconName: "external",
			title: t("acode account", "Acode account"),
			value: String(config.BASE_URL || "").replace(/^https?:\/\//, ""),
			onclick: openUrl(config.BASE_URL),
		},
		{
			iconName: "info",
			title: t("about", "About"),
			value: window.BuildInfo?.version || "",
			onclick: goto(async () =>
				(await import(/* webpackChunkName: "about" */ "pages/about")).default(),
			),
		},
	];
	for (const item of menuRows) menu.$body.append(row(item));

	async function fillPlugins() {
		let total = LOADED_PLUGINS.size;
		try {
			const list = await fsOperation(PLUGIN_DIR).lsDir();
			total = list.length;
		} catch {}
		$pluginCount.textContent = String(total);
	}

	/* ---------- assemble ---------- */
	const $main = <main id="profile-page" className="main scroll"></main>;
	$main.append($heroSlot, activity.$el, thisWeek.$el, languages.$el);
	if (recentFiles.length || recentFolders.length) $main.append(recent.$el);
	$main.append(menu.$el, $footSlot);

	refreshAccount();
	renderLanguages(renderActivity().languages);
	fillPlugins();

	$page.body = $main;

	actionStack.push({
		id: "profile",
		action: $page.hide,
	});

	$page.onhide = function () {
		actionStack.remove("profile");
	};

	app.append($page);
}
