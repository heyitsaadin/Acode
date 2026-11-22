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

function tipText(day) {
	const when = new Date(`${day.date}T00:00:00Z`).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	});
	if (!day.ms && !day.lines && !day.files) return `No activity on ${when}`;
	return [
		when,
		formatDuration(day.ms),
		plural(day.lines, "line"),
		plural(day.files, "file"),
	].join(" · ");
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
	if (value) $row.append(value);
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
		const $v = <span className="pf-verified" title="Verified"></span>;
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
		$meta.append(<span>{`Member since ${since}`}</span>);
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
	const $label = <span>Sign in</span>;
	const $btn = <button type="button" className="pf-btn small"></button>;
	$btn.append(icon("login", 16), $label);
	$btn.onclick = async () => {
		if ($btn.disabled) return;
		$btn.disabled = true;
		$label.textContent = "Waiting for sign in…";
		try {
			await onSignIn();
		} finally {
			$btn.disabled = false;
			$label.textContent = "Sign in";
		}
	};

	return (
		<div className="pf-hero">
			<div className="pf-avatar guest">{icon("user", 30)}</div>
			<div className="pf-hero-text">
				<h2 className="pf-name">Not signed in</h2>
				<div className="pf-email">Sign in with your Acode account.</div>
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

	const $page = Page("Profile");
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
	const activity = section("Activity");
	const languages = section("Top languages");

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
			strings.logout || "Logout",
			"Are you sure you want to log out of your Acode account?",
		);
		if (!ok) return;
		const success = onLogout ? await onLogout() : true;
		if (success === false) return;
		user = null;
		refreshAccount();
	}

	async function resetActivity() {
		const ok = await confirm(
			"Reset activity",
			"This clears the time, lines, files and streaks tracked on this device.",
		);
		if (!ok) return;
		tracker.reset();
		renderActivity();
		renderLanguages();
		toast("Activity reset");
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
				title: "Reset activity",
				chevron: false,
				onclick: resetActivity,
			}),
		);
		if (user) {
			$card.append(
				row({
					iconName: "logout",
					title: strings.logout || "Logout",
					danger: true,
					chevron: false,
					onclick: signOut,
				}),
			);
		}
		$footSlot.append($card);
	}

	function refreshAccount() {
		renderHero();
		renderFoot();
	}

	/* ---------- activity ---------- */
	activity.$trail.textContent = "Last 12 months";

	function renderActivity() {
		const data = tracker.getSummary();
		const weeks = buildWeeks(data.year);
		const labels = monthLabels(weeks);
		const $grid = <div className="pf-gh-grid"></div>;

		weeks.forEach((week, i) => {
			const $week = <div className="pf-gh-week"></div>;
			$week.append(<div className="pf-gh-month">{labels[i] || ""}</div>);
			for (const day of week) {
				const $cell = (
					<div
						className={day ? `pf-gh-cell lv${day.level}` : "pf-gh-cell none"}
					></div>
				);
				if (day) $cell.dataset.tip = tipText(day);
				$week.append($cell);
			}
			$grid.append($week);
		});

		$grid.onclick = (e) => {
			const tip = e.target?.dataset?.tip;
			if (tip) toast(tip);
		};

		const $scroll = <div className="pf-gh-scroll">{$grid}</div>;

		const $legend = <div className="pf-gh-legend"></div>;
		$legend.append(<span>Less</span>);
		for (let n = 0; n <= 4; n++) {
			$legend.append(<span className={`pf-gh-cell lv${n}`}></span>);
		}
		$legend.append(<span>More</span>);

		const { today, totals } = data;
		const todayText = today.ms
			? `Today ${formatDuration(today.ms)} · ${plural(today.lines, "line")}`
			: "Nothing yet today";

		activity.$body.textContent = "";
		activity.$body.append(
			<div className="pf-metrics">
				{metric(formatDuration(totals.ms), "Coding time")}
				{metric(totals.lines.toLocaleString(), "Lines")}
				{metric(totals.files.toLocaleString(), "Files")}
				{metric(`${data.current}d`, "Streak")}
			</div>,
			$scroll,
			<div className="pf-gh-foot">
				<span>{todayText}</span>
				{$legend}
			</div>,
		);

		// Newest weeks are on the right, so start scrolled to the end.
		setTimeout(() => {
			$scroll.scrollLeft = $scroll.scrollWidth;
		}, 50);

		return data;
	}

	function renderLanguages(list = tracker.getSummary().languages) {
		languages.$body.textContent = "";
		if (!list.length) {
			languages.$body.append(
				<div className="pf-empty">Languages show up here as you code.</div>,
			);
			return;
		}
		for (const lang of list) {
			const percent = Math.round(lang.share * 100);
			languages.$body.append(
				<div className="pf-lang">
					<div className="pf-lang-head">
						<span>{lang.name}</span>
						<span className="pf-lang-percent">{`${percent}%`}</span>
					</div>
					<div className="pf-lang-bar">
						<span style={{ width: `${Math.max(percent, 2)}%` }}></span>
					</div>
				</div>,
			);
		}
	}

	/* ---------- recents ---------- */
	const recent = section("Recent");
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

	const menu = section("More");
	const menuRows = [
		{
			iconName: "package",
			title: "Downloaded plugins",
			value: $pluginCount,
			onclick: goto(async () =>
				(
					await import(/* webpackChunkName: "plugins" */ "pages/plugins")
				).default(),
			),
		},
		{
			iconName: "sliders",
			title: "Settings",
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
			title: "App theme",
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
			title: "Open folder",
			onclick: goto(() => acode.exec("open-folder")),
		},
		{
			iconName: "external",
			title: "Acode account",
			value: String(config.BASE_URL || "").replace(/^https?:\/\//, ""),
			onclick: openUrl(config.BASE_URL),
		},
		{
			iconName: "info",
			title: "About",
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
	$main.append($heroSlot, activity.$el, languages.$el);
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
