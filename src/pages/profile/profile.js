import "./profile.scss";
import fsOperation from "fileSystem";
import Page from "components/page";
import Sidebar from "components/sidebar";
import confirm from "dialogs/confirm";
import actionStack from "lib/actionStack";
import config from "lib/config";
import { LOADED_PLUGINS } from "lib/loadPlugins";
import openFile from "lib/openFile";
import openFolder from "lib/openFolder";
import profileStats from "lib/profileStats";
import recents from "lib/recents";
import helpers from "utils/helpers";
import Uri from "utils/Uri";
import Url from "utils/Url";

/* Feather-style stroke icons, so the page never depends on the icon font. */
const ICONS = {
	clock:
		'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
	zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
	save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
	activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
	layers:
		'<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
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
	chevron: '<polyline points="9 18 15 12 9 6"/>',
	link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
	verified:
		'<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
	calendar:
		'<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
	trash:
		'<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
};

function icon(name, size = 20) {
	const el = document.createElement("span");
	el.className = "pf-icon";
	el.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
	return el;
}

function formatDuration(ms) {
	const mins = Math.floor(ms / 60000);
	if (mins < 1) return ms >= 1000 ? "<1m" : "0m";
	const h = Math.floor(mins / 60);
	const m = mins % 60;
	if (h >= 100) return `${h}h`;
	return h ? `${h}h ${m}m` : `${m}m`;
}

function formatMonthYear(value) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString(undefined, {
		month: "short",
		year: "numeric",
	});
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

function section(title, trailing) {
	const $body = <div className="pf-card"></div>;
	const $head = (
		<div className="pf-section-head">
			<h3 className="pf-section-title">{title}</h3>
		</div>
	);
	if (trailing) $head.append(trailing);
	const $el = (
		<section className="pf-section">
			{$head}
			{$body}
		</section>
	);
	return { $el, $body };
}

function row({ iconName, title, subtitle, onclick, danger = false, end }) {
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
			<div className="pf-row-icon">{icon(iconName)}</div>
			{$text}
		</div>
	);
	$row.append(end || icon("chevron", 18));
	return $row;
}

function statCard(className, label, iconName) {
	return (
		<div className="pf-stat">
			<div className="pf-stat-icon">{icon(iconName, 18)}</div>
			<div className={`pf-stat-value ${className}`}>–</div>
			<div className="pf-stat-label">{label}</div>
		</div>
	);
}

/**
 * Open the profile page.
 * @param {object} options
 * @param {object} options.user
 * @param {() => Promise<string>} [options.getAvatarSrc]
 * @param {() => Promise<boolean>} [options.onLogout]
 */
export default function ProfileInclude({ user, getAvatarSrc, onLogout } = {}) {
	if (!user) return;

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
	const openUrl = (url) => () => system.openInBrowser(url);

	/* ---------- hero ---------- */
	const initial = (user.name || user.email || "?")
		.trim()
		.charAt(0)
		.toUpperCase();
	const $avatarImg = <img className="pf-avatar-img" alt="" />;
	const $avatar = (
		<div className="pf-avatar">
			<span className="pf-avatar-initial">{initial}</span>
			{$avatarImg}
		</div>
	);
	$avatarImg.onload = () => $avatar.classList.add("loaded");
	if (typeof getAvatarSrc === "function") {
		Promise.resolve(getAvatarSrc())
			.then((src) => {
				if (src) $avatarImg.src = src;
			})
			.catch(() => {});
	}

	const $nameRow = (
		<div className="pf-name-row">
			<h2 className="pf-name">{user.name}</h2>
		</div>
	);
	if (user.verified) {
		const $v = <span className="pf-verified" title="Verified"></span>;
		$v.append(icon("verified", 18));
		$nameRow.append($v);
	}
	if (user.acode_pro) {
		$nameRow.append(<span className="pf-badge pro">PRO</span>);
	}
	if (user.isAdmin) {
		$nameRow.append(<span className="pf-badge">ADMIN</span>);
	}

	const $chips = <div className="pf-chips"></div>;
	const since = formatMonthYear(user.created_at);
	if (since) {
		const $c = <div className="pf-chip"></div>;
		$c.append(icon("calendar", 14), `Member since ${since}`);
		$chips.append($c);
	}
	if (user.github) {
		const $c = (
			<div
				className="pf-chip tap"
				onclick={openUrl(`https://github.com/${user.github}`)}
			></div>
		);
		$c.append(icon("link", 14), `@${user.github}`);
		$chips.append($c);
	}
	if (user.website) {
		const site = String(user.website);
		const $c = (
			<div
				className="pf-chip tap"
				onclick={openUrl(/^https?:\/\//.test(site) ? site : `https://${site}`)}
			></div>
		);
		$c.append(icon("external", 14), site.replace(/^https?:\/\//, ""));
		$chips.append($c);
	}

	const $hero = (
		<div className="pf-hero">
			{$avatar}
			{$nameRow}
			<div className="pf-email">{user.email || ""}</div>
			{$chips}
		</div>
	);

	/* ---------- stats ---------- */
	const $grid = (
		<div className="pf-grid">
			{statCard("stat-time", "Coding time", "clock")}
			{statCard("stat-streak", "Day streak", "zap")}
			{statCard("stat-saves", "Files saved", "save")}
			{statCard("stat-launches", "App launches", "activity")}
			{statCard("stat-tabs", "Open files", "layers")}
			{statCard("stat-plugins", "Plugins", "package")}
		</div>
	);

	const $chart = <div className="pf-chart"></div>;
	const $chartNote = <div className="pf-note"></div>;
	const activity = section("Last 7 days");
	activity.$body.append($chart, $chartNote);

	/* ---------- recents ---------- */
	const recent = section("Jump back in");
	const recentFiles = recents.files.filter(Boolean).slice(0, 5);
	const recentFolders = recents.folders.filter((f) => f?.url).slice(0, 3);

	for (const file of recentFiles) {
		const { name, location } = pathDetails(file);
		recent.$body.append(
			row({
				iconName: "file",
				title: name,
				subtitle: location,
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
				onclick: goto(() => openFolder(folder.url, folder.opts)),
			}),
		);
	}
	if (!recentFiles.length && !recentFolders.length) {
		recent.$body.append(
			<div className="pf-empty">
				Files and folders you open will show up here.
			</div>,
		);
	}

	/* ---------- quick actions ---------- */
	const actions = section("Quick actions");
	const actionRows = [
		{
			iconName: "package",
			title: "Plugins",
			subtitle: "Browse and manage extensions",
			onclick: goto(async () =>
				(await import(/* webpackChunkName: "plugins" */ "pages/plugins")).default(),
			),
		},
		{
			iconName: "sliders",
			title: "Settings",
			subtitle: "Editor, app and file preferences",
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
			subtitle: "Switch the look of Acode",
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
			subtitle: "Add a project to the sidebar",
			onclick: goto(() => acode.exec("open-folder")),
		},
		{
			iconName: "external",
			title: "Acode account",
			subtitle: String(config.BASE_URL || "").replace(/^https?:\/\//, ""),
			onclick: openUrl(config.BASE_URL),
		},
		{
			iconName: "info",
			title: "About",
			subtitle: `Version ${window.BuildInfo?.version || ""}`.trim(),
			onclick: goto(async () =>
				(await import(/* webpackChunkName: "about" */ "pages/about")).default(),
			),
		},
	];
	for (const item of actionRows) actions.$body.append(row(item));

	/* ---------- danger zone ---------- */
	const $logout = (
		<div className="pf-card pf-danger-card">
			{row({
				iconName: "logout",
				title: strings.logout || "Logout",
				danger: true,
				end: <span></span>,
				onclick: async () => {
					const ok = await confirm(
						strings.logout || "Logout",
						"Are you sure you want to log out of your Acode account?",
					);
					if (!ok) return;
					const success = onLogout ? await onLogout() : true;
					if (success !== false) $page.hide();
				},
			})}
			{row({
				iconName: "trash",
				title: "Reset coding stats",
				subtitle: "Clears the numbers above on this device",
				danger: true,
				end: <span></span>,
				onclick: async () => {
					const ok = await confirm(
						"Reset stats",
						"This clears your coding time, streak and save counts on this device.",
					);
					if (!ok) return;
					profileStats.reset();
					fillStats();
				},
			})}
		</div>
	);

	const $main = (
		<main id="profile-page" className="main scroll">
			{$hero}
			{$grid}
			{activity.$el}
			{recent.$el}
			{actions.$el}
			{$logout}
		</main>
	);

	/* ---------- data ---------- */
	const setText = (selector, text) => {
		const $el = $main.querySelector(selector);
		if ($el) $el.textContent = text;
	};

	function fillStats() {
		const s = profileStats.getStats();
		setText(".stat-time", formatDuration(s.totalMs));
		setText(".stat-streak", `${s.streak}d`);
		setText(".stat-saves", String(s.saves));
		setText(".stat-launches", String(s.launches));
		setText(".stat-tabs", String(window.editorManager?.files?.length ?? 0));

		const max = Math.max(...s.week.map((d) => d.ms), 1);
		$chart.textContent = "";
		for (const day of s.week) {
			const pct = day.ms > 0 ? Math.max((day.ms / max) * 100, 8) : 0;
			const $bar = <div className="pf-bar"></div>;
			$bar.style.height = `${pct}%`;
			const $col = (
				<div
					className={`pf-bar-col${day.isToday ? " today" : ""}${day.ms ? " has-data" : ""}`}
					title={`${formatDuration(day.ms)} · ${day.saves} saves`}
				>
					<div className="pf-bar-track">{$bar}</div>
					<div className="pf-bar-label">{day.label}</div>
				</div>
			);
			$chart.append($col);
		}
		$chartNote.textContent = `${formatDuration(s.weekMs)} coding · ${s.weekSaves} saves this week. Tracked on this device only.`;
	}

	async function fillPlugins() {
		let total = LOADED_PLUGINS.size;
		try {
			const list = await fsOperation(PLUGIN_DIR).lsDir();
			total = list.length;
		} catch {}
		setText(".stat-plugins", String(total));
	}

	fillStats();
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
