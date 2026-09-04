window.__ModuleLoader__.load({
	id: "dsh-herdr-themes",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/shared/themes.ts
		const hex = (r, g, b) => `#${[
			r,
			g,
			b
		].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
		const PALETTES = {
			catppuccin: {
				accent: hex(137, 180, 250),
				panelBg: hex(24, 24, 37),
				activeRowBg: hex(30, 30, 46),
				selectionBg: hex(49, 50, 68),
				surface0: hex(49, 50, 68),
				surface1: hex(69, 71, 90),
				surfaceDim: hex(30, 30, 46),
				overlay0: hex(108, 112, 134),
				overlay1: hex(127, 132, 156),
				text: hex(205, 214, 244),
				subtext0: hex(166, 173, 200),
				mauve: hex(203, 166, 247),
				green: hex(166, 227, 161),
				yellow: hex(249, 226, 175),
				red: hex(243, 139, 168),
				blue: hex(137, 180, 250),
				teal: hex(148, 226, 213),
				peach: hex(250, 179, 135)
			},
			catppuccinLatte: {
				accent: hex(30, 102, 245),
				panelBg: hex(239, 241, 245),
				activeRowBg: hex(230, 233, 239),
				selectionBg: hex(189, 208, 245),
				surface0: hex(204, 208, 218),
				surface1: hex(188, 192, 204),
				surfaceDim: hex(230, 233, 239),
				overlay0: hex(156, 160, 176),
				overlay1: hex(140, 143, 161),
				text: hex(76, 79, 105),
				subtext0: hex(108, 111, 133),
				mauve: hex(136, 57, 239),
				green: hex(64, 160, 43),
				yellow: hex(223, 142, 29),
				red: hex(210, 15, 57),
				blue: hex(30, 102, 245),
				teal: hex(23, 146, 153),
				peach: hex(254, 100, 11)
			},
			terminal: {
				accent: hex(74, 158, 255),
				panelBg: hex(30, 30, 30),
				activeRowBg: hex(74, 74, 74),
				selectionBg: hex(30, 30, 30),
				surface0: hex(30, 30, 30),
				surface1: hex(74, 74, 74),
				surfaceDim: hex(74, 74, 74),
				overlay0: hex(155, 155, 155),
				overlay1: hex(255, 255, 255),
				text: hex(228, 228, 228),
				subtext0: hex(155, 155, 155),
				mauve: hex(155, 155, 155),
				green: hex(79, 194, 79),
				yellow: hex(224, 193, 79),
				red: hex(227, 85, 85),
				blue: hex(74, 158, 255),
				teal: hex(79, 215, 215),
				peach: hex(255, 158, 100)
			},
			tokyoNight: {
				accent: hex(122, 162, 247),
				panelBg: hex(26, 27, 38),
				activeRowBg: hex(35, 38, 54),
				selectionBg: hex(45, 54, 80),
				surface0: hex(36, 40, 59),
				surface1: hex(65, 72, 104),
				surfaceDim: hex(26, 27, 38),
				overlay0: hex(86, 95, 137),
				overlay1: hex(105, 113, 150),
				text: hex(192, 202, 245),
				subtext0: hex(169, 177, 214),
				mauve: hex(187, 154, 247),
				green: hex(158, 206, 106),
				yellow: hex(224, 175, 104),
				red: hex(247, 118, 142),
				blue: hex(122, 162, 247),
				teal: hex(125, 207, 255),
				peach: hex(255, 158, 100)
			},
			tokyoNightDay: {
				accent: hex(46, 125, 233),
				panelBg: hex(225, 226, 231),
				activeRowBg: hex(210, 211, 218),
				selectionBg: hex(182, 202, 231),
				surface0: hex(196, 200, 218),
				surface1: hex(168, 174, 203),
				surfaceDim: hex(210, 211, 218),
				overlay0: hex(137, 144, 179),
				overlay1: hex(104, 112, 154),
				text: hex(55, 96, 191),
				subtext0: hex(97, 114, 176),
				mauve: hex(120, 71, 189),
				green: hex(88, 117, 57),
				yellow: hex(140, 108, 62),
				red: hex(245, 42, 101),
				blue: hex(46, 125, 233),
				teal: hex(17, 140, 116),
				peach: hex(177, 92, 0)
			},
			dracula: {
				accent: hex(189, 147, 249),
				panelBg: hex(40, 42, 54),
				activeRowBg: hex(55, 60, 82),
				selectionBg: hex(70, 63, 93),
				surface0: hex(68, 71, 90),
				surface1: hex(98, 114, 164),
				surfaceDim: hex(40, 42, 54),
				overlay0: hex(98, 114, 164),
				overlay1: hex(130, 140, 180),
				text: hex(248, 248, 242),
				subtext0: hex(210, 210, 220),
				mauve: hex(255, 121, 198),
				green: hex(80, 250, 123),
				yellow: hex(241, 250, 140),
				red: hex(255, 85, 85),
				blue: hex(139, 233, 253),
				teal: hex(139, 233, 253),
				peach: hex(255, 184, 108)
			},
			nord: {
				accent: hex(136, 192, 208),
				panelBg: hex(46, 52, 64),
				activeRowBg: hex(67, 76, 94),
				selectionBg: hex(64, 81, 93),
				surface0: hex(59, 66, 82),
				surface1: hex(67, 76, 94),
				surfaceDim: hex(46, 52, 64),
				overlay0: hex(76, 86, 106),
				overlay1: hex(100, 110, 130),
				text: hex(236, 239, 244),
				subtext0: hex(216, 222, 233),
				mauve: hex(180, 142, 173),
				green: hex(163, 190, 140),
				yellow: hex(235, 203, 139),
				red: hex(191, 97, 106),
				blue: hex(129, 161, 193),
				teal: hex(143, 188, 187),
				peach: hex(208, 135, 112)
			},
			gruvbox: {
				accent: hex(215, 153, 33),
				panelBg: hex(40, 40, 40),
				activeRowBg: hex(50, 49, 48),
				selectionBg: hex(75, 63, 39),
				surface0: hex(60, 56, 54),
				surface1: hex(80, 73, 69),
				surfaceDim: hex(40, 40, 40),
				overlay0: hex(146, 131, 116),
				overlay1: hex(168, 153, 132),
				text: hex(235, 219, 178),
				subtext0: hex(213, 196, 161),
				mauve: hex(211, 134, 155),
				green: hex(184, 187, 38),
				yellow: hex(250, 189, 47),
				red: hex(251, 73, 52),
				blue: hex(131, 165, 152),
				teal: hex(142, 192, 124),
				peach: hex(254, 128, 25)
			},
			gruvboxLight: {
				accent: hex(7, 102, 120),
				panelBg: hex(251, 241, 199),
				activeRowBg: hex(242, 229, 188),
				selectionBg: hex(235, 219, 178),
				surface0: hex(235, 219, 178),
				surface1: hex(213, 196, 161),
				surfaceDim: hex(242, 229, 188),
				overlay0: hex(146, 131, 116),
				overlay1: hex(124, 111, 100),
				text: hex(60, 56, 54),
				subtext0: hex(80, 73, 69),
				mauve: hex(143, 63, 113),
				green: hex(121, 116, 14),
				yellow: hex(181, 118, 20),
				red: hex(157, 0, 6),
				blue: hex(7, 102, 120),
				teal: hex(66, 123, 88),
				peach: hex(175, 58, 3)
			},
			oneDark: {
				accent: hex(97, 175, 239),
				panelBg: hex(40, 44, 52),
				activeRowBg: hex(49, 54, 64),
				selectionBg: hex(51, 70, 89),
				surface0: hex(44, 49, 58),
				surface1: hex(62, 68, 81),
				surfaceDim: hex(40, 44, 52),
				overlay0: hex(92, 99, 112),
				overlay1: hex(115, 122, 135),
				text: hex(171, 178, 191),
				subtext0: hex(150, 156, 168),
				mauve: hex(198, 120, 221),
				green: hex(152, 195, 121),
				yellow: hex(229, 192, 123),
				red: hex(224, 108, 117),
				blue: hex(97, 175, 239),
				teal: hex(86, 182, 194),
				peach: hex(209, 154, 102)
			},
			oneLight: {
				accent: hex(64, 120, 242),
				panelBg: hex(250, 250, 250),
				activeRowBg: hex(216, 219, 226),
				selectionBg: hex(205, 219, 248),
				surface0: hex(240, 240, 241),
				surface1: hex(229, 229, 230),
				surfaceDim: hex(245, 245, 246),
				overlay0: hex(160, 161, 167),
				overlay1: hex(104, 107, 119),
				text: hex(56, 58, 66),
				subtext0: hex(104, 107, 119),
				mauve: hex(166, 38, 164),
				green: hex(80, 161, 79),
				yellow: hex(193, 132, 1),
				red: hex(228, 86, 73),
				blue: hex(64, 120, 242),
				teal: hex(1, 132, 188),
				peach: hex(152, 104, 1)
			},
			solarized: {
				accent: hex(38, 139, 210),
				panelBg: hex(0, 43, 54),
				activeRowBg: hex(22, 75, 87),
				selectionBg: hex(8, 62, 85),
				surface0: hex(7, 54, 66),
				surface1: hex(88, 110, 117),
				surfaceDim: hex(0, 43, 54),
				overlay0: hex(88, 110, 117),
				overlay1: hex(101, 123, 131),
				text: hex(147, 161, 161),
				subtext0: hex(131, 148, 150),
				mauve: hex(211, 54, 130),
				green: hex(133, 153, 0),
				yellow: hex(181, 137, 0),
				red: hex(220, 50, 47),
				blue: hex(38, 139, 210),
				teal: hex(42, 161, 152),
				peach: hex(203, 75, 22)
			},
			solarizedLight: {
				accent: hex(38, 139, 210),
				panelBg: hex(253, 246, 227),
				activeRowBg: hex(238, 232, 213),
				selectionBg: hex(201, 220, 223),
				surface0: hex(238, 232, 213),
				surface1: hex(147, 161, 161),
				surfaceDim: hex(238, 232, 213),
				overlay0: hex(147, 161, 161),
				overlay1: hex(88, 110, 117),
				text: hex(101, 123, 131),
				subtext0: hex(131, 148, 150),
				mauve: hex(211, 54, 130),
				green: hex(133, 153, 0),
				yellow: hex(181, 137, 0),
				red: hex(220, 50, 47),
				blue: hex(38, 139, 210),
				teal: hex(42, 161, 152),
				peach: hex(203, 75, 22)
			},
			kanagawa: {
				accent: hex(126, 156, 216),
				panelBg: hex(31, 31, 40),
				activeRowBg: hex(54, 54, 70),
				selectionBg: hex(50, 56, 75),
				surface0: hex(42, 42, 55),
				surface1: hex(54, 54, 70),
				surfaceDim: hex(31, 31, 40),
				overlay0: hex(114, 113, 105),
				overlay1: hex(135, 134, 125),
				text: hex(220, 215, 186),
				subtext0: hex(200, 195, 170),
				mauve: hex(149, 127, 184),
				green: hex(118, 148, 106),
				yellow: hex(192, 163, 110),
				red: hex(195, 64, 67),
				blue: hex(126, 156, 216),
				teal: hex(127, 180, 202),
				peach: hex(255, 160, 102)
			},
			kanagawaLotus: {
				accent: hex(77, 105, 155),
				panelBg: hex(242, 236, 188),
				activeRowBg: hex(213, 206, 163),
				selectionBg: hex(220, 213, 172),
				surface0: hex(220, 213, 172),
				surface1: hex(201, 203, 209),
				surfaceDim: hex(213, 206, 163),
				overlay0: hex(160, 156, 172),
				overlay1: hex(138, 137, 128),
				text: hex(84, 84, 100),
				subtext0: hex(67, 67, 108),
				mauve: hex(98, 76, 131),
				green: hex(111, 137, 78),
				yellow: hex(119, 113, 63),
				red: hex(200, 64, 83),
				blue: hex(77, 105, 155),
				teal: hex(78, 140, 162),
				peach: hex(204, 109, 0)
			},
			rosePine: {
				accent: hex(196, 167, 231),
				panelBg: hex(25, 23, 36),
				activeRowBg: hex(38, 35, 58),
				selectionBg: hex(59, 52, 75),
				surface0: hex(31, 29, 46),
				surface1: hex(38, 35, 58),
				surfaceDim: hex(38, 35, 58),
				overlay0: hex(110, 106, 134),
				overlay1: hex(144, 140, 170),
				text: hex(224, 222, 244),
				subtext0: hex(200, 197, 220),
				mauve: hex(196, 167, 231),
				green: hex(49, 116, 143),
				yellow: hex(246, 193, 119),
				red: hex(235, 111, 146),
				blue: hex(49, 116, 143),
				teal: hex(156, 207, 216),
				peach: hex(234, 154, 151)
			},
			rosePineDawn: {
				accent: hex(144, 122, 169),
				panelBg: hex(250, 244, 237),
				activeRowBg: hex(227, 217, 207),
				selectionBg: hex(242, 233, 225),
				surface0: hex(242, 233, 225),
				surface1: hex(255, 250, 243),
				surfaceDim: hex(242, 233, 225),
				overlay0: hex(152, 147, 165),
				overlay1: hex(121, 117, 147),
				text: hex(70, 66, 97),
				subtext0: hex(121, 117, 147),
				mauve: hex(144, 122, 169),
				green: hex(40, 105, 131),
				yellow: hex(234, 157, 52),
				red: hex(180, 99, 122),
				blue: hex(40, 105, 131),
				teal: hex(86, 148, 159),
				peach: hex(215, 130, 126)
			},
			vesper: {
				accent: hex(255, 199, 153),
				panelBg: hex(26, 26, 26),
				activeRowBg: hex(16, 16, 16),
				selectionBg: hex(35, 35, 35),
				surface0: hex(35, 35, 35),
				surface1: hex(40, 40, 40),
				surfaceDim: hex(16, 16, 16),
				overlay0: hex(92, 92, 92),
				overlay1: hex(126, 126, 126),
				text: hex(255, 255, 255),
				subtext0: hex(160, 160, 160),
				mauve: hex(255, 209, 168),
				green: hex(153, 255, 228),
				yellow: hex(255, 199, 153),
				red: hex(255, 128, 128),
				blue: hex(176, 176, 176),
				teal: hex(102, 221, 204),
				peach: hex(255, 199, 153)
			}
		};
		/** `color-mix(in srgb, a N%, b)` — N percent of `a` rest `b`. */
		const mix = (a, b, percent) => `color-mix(in srgb, ${a} ${percent}%, ${b})`;
		/** Same hue at reduced alpha (color-mix toward transparent). */
		const alpha = (color, alphaPercent) => `color-mix(in srgb, ${color} ${alphaPercent}%, transparent)`;
		/** Button hover for the accent: lighter on dark, darker on light. */
		const hover = (color, scheme) => mix(color, scheme === "dark" ? "#ffffff" : "#000000", 85);
		/** Build a full DSH alias-token override map from one herdr palette. */
		function buildTokens(p, scheme) {
			return {
				"--dsw-alias-bg-base": p.panelBg,
				"--dsw-alias-bg-layer-1": p.surface0,
				"--dsw-alias-bg-layer-2": p.surface1,
				"--dsw-alias-bg-layer-3": p.surface1,
				"--dsw-alias-bg-overlay": p.surface1,
				"--dsw-alias-bg-module-platform": p.surface0,
				"--dsw-alias-bg-multi-select": p.surface0,
				"--dsw-alias-bg-skeleton": alpha(p.text, 8),
				"--dsw-alias-border-l1": alpha(p.text, 12),
				"--dsw-alias-border-l2": alpha(p.text, 20),
				"--dsw-alias-border-l2-darkmode-thin": alpha(p.text, 12),
				"--dsw-alias-border-l3": alpha(p.text, 28),
				"--dsw-alias-border-l4": alpha(p.text, 36),
				"--dsw-alias-border-inverted": alpha(p.text, 10),
				"--dsw-alias-border-inverted2": alpha(p.text, 16),
				"--dsw-alias-brand-primary": p.accent,
				"--dsw-alias-brand-primary-new-colorprimary-new-color": p.accent,
				"--dsw-alias-brand-text": p.accent,
				"--dsw-alias-brand-primary-invert": p.text,
				"--dsw-alias-button-primary-fill": p.accent,
				"--dsw-alias-button-primary-hover": hover(p.accent, scheme),
				"--dsw-alias-button-primary-dimmed": alpha(p.accent, 35),
				"--dsw-alias-button-info-fill": p.blue,
				"--dsw-alias-button-info-hover": hover(p.blue, scheme),
				"--dsw-alias-button-elevated-fill": p.surface1,
				"--dsw-alias-button-floating-fill": p.surface1,
				"--dsw-alias-button-floating-hover": p.surface0,
				"--dsw-alias-button-ghost-active-border": alpha(p.text, 30),
				"--dsw-alias-button-ghost-active-fill": p.surface0,
				"--dsw-alias-button-ghost-active-hover": p.surface1,
				"--dsw-alias-button-contrast-fill": p.text,
				"--dsw-alias-interactive-bg-hover": alpha(p.text, 6),
				"--dsw-alias-interactive-bg-hover-solid": p.surface0,
				"--dsw-alias-interactive-bg-active": alpha(p.text, 10),
				"--dsw-alias-interactive-bg-hover-accent": alpha(p.accent, 14),
				"--dsw-alias-interactive-bg-hover-danger": alpha(p.red, 8),
				"--dsw-alias-label-primary": p.text,
				"--dsw-alias-label-primary-bluish": p.text,
				"--dsw-alias-label-primary-dimmed": p.text,
				"--dsw-alias-label-primary-foreground": p.panelBg,
				"--dsw-alias-label-secondary": p.subtext0,
				"--dsw-alias-label-tertiary": p.overlay0,
				"--dsw-alias-label-caption": p.overlay1,
				"--dsw-alias-label-dimmed": p.overlay0,
				"--dsw-alias-markdown-code-block": p.surface0,
				"--dsw-alias-markdown-code-block-banner": p.surface1,
				"--dsw-alias-markdown-code-segment-selected": p.surface1,
				"--dsw-alias-markdown-code-segment-unselected": p.surface0,
				"--dsw-alias-markdown-inline-code": p.surface0,
				"--dsw-alias-markdown-citation": p.surface1,
				"--dsw-alias-markdown-tag": p.surface0,
				"--dsw-alias-markdown-placeholder": p.overlay1,
				"--dsw-alias-scrollbar-bg-l1": alpha(p.text, 25),
				"--dsw-alias-scrollbar-bg-l2": alpha(p.text, 25),
				"--dsw-alias-scrollbar-hover-l1": alpha(p.text, 40),
				"--dsw-alias-scrollbar-hover-l2": alpha(p.text, 40),
				"--dsw-alias-state-error-primary": p.red,
				"--dsw-alias-state-error-secondary": mix(p.red, p.text, 70),
				"--dsw-alias-state-success-primary": p.green,
				"--dsw-alias-state-success-secondary": mix(p.green, p.text, 70),
				"--dsw-alias-state-success-tertiary": alpha(p.green, 25),
				"--dsw-alias-state-warn-primary": p.yellow,
				"--dsw-alias-state-warn-secondary": mix(p.yellow, p.text, 70),
				"--dsw-alias-state-warn-label": p.yellow,
				"--dsw-alias-state-warn-tertiary": alpha(p.yellow, 25),
				"--dsw-alias-state-business-primary": p.blue,
				"--dsw-alias-state-business-tertiary": alpha(p.blue, 25),
				"--dsw-alias-toast-bg": p.surface1,
				"--dsw-alias-tooltip-bg": p.surface1,
				"--dsw-specific-bubble": mix(p.accent, p.panelBg, 16),
				"--dsw-specific-bubble-highlight": mix(p.accent, p.panelBg, 30),
				"--dsw-specific-input-major": p.panelBg,
				"--dsw-specific-login-input": p.surface0,
				"--dsw-specific-menu": p.surface1,
				"--dsw-specific-selector": p.surface0,
				"--dsw-specific-sidebar-fill": mix(p.panelBg, p.surface0, 80),
				"--dsw-specific-sidebar-nav-item-active": p.activeRowBg,
				"--dsw-specific-sidebar-nav-item-active-accent": mix(p.accent, p.panelBg, 40),
				"--dsw-specific-sidebar-nav-item-hover": p.surface0,
				"--dsw-specific-tip": p.surface1
			};
		}
		/** All registrable themes, in herdr’s THEME_NAMES order. */
		const HERDR_THEMES = [
			{
				id: "catppuccin",
				name: "Catppuccin Mocha",
				description: "The default herdr theme: soft pastel dark.",
				scheme: "dark",
				paletteKey: "catppuccin"
			},
			{
				id: "catppuccin-latte",
				name: "Catppuccin Latte",
				description: "The light Catppuccin flavor.",
				scheme: "light",
				paletteKey: "catppuccinLatte"
			},
			{
				id: "terminal",
				name: "Terminal",
				description: "Plain 16-color terminal look (ANSI approximation).",
				scheme: "dark",
				paletteKey: "terminal"
			},
			{
				id: "tokyo-night",
				name: "Tokyo Night",
				description: "Blue-purple night aesthetic.",
				scheme: "dark",
				paletteKey: "tokyoNight"
			},
			{
				id: "tokyo-night-day",
				name: "Tokyo Night Day",
				description: "The light Tokyo Night palette.",
				scheme: "light",
				paletteKey: "tokyoNightDay"
			},
			{
				id: "dracula",
				name: "Dracula",
				description: "The classic high-contrast dark palette.",
				scheme: "dark",
				paletteKey: "dracula"
			},
			{
				id: "nord",
				name: "Nord",
				description: "Arctic, frosty blues.",
				scheme: "dark",
				paletteKey: "nord"
			},
			{
				id: "gruvbox",
				name: "Gruvbox",
				description: "Warm retro dark.",
				scheme: "dark",
				paletteKey: "gruvbox"
			},
			{
				id: "gruvbox-light",
				name: "Gruvbox Light",
				description: "Warm retro light.",
				scheme: "light",
				paletteKey: "gruvboxLight"
			},
			{
				id: "one-dark",
				name: "One Dark",
				description: "Atom’s classic dark theme.",
				scheme: "dark",
				paletteKey: "oneDark"
			},
			{
				id: "one-light",
				name: "One Light",
				description: "Atom’s classic light theme.",
				scheme: "light",
				paletteKey: "oneLight"
			},
			{
				id: "solarized",
				name: "Solarized Dark",
				description: "Ethan Schoonover’s balanced dark.",
				scheme: "dark",
				paletteKey: "solarized"
			},
			{
				id: "solarized-light",
				name: "Solarized Light",
				description: "Ethan Schoonover’s balanced light.",
				scheme: "light",
				paletteKey: "solarizedLight"
			},
			{
				id: "kanagawa",
				name: "Kanagawa",
				description: "Inspired by Katsushika Hokusai’s waves.",
				scheme: "dark",
				paletteKey: "kanagawa"
			},
			{
				id: "kanagawa-lotus",
				name: "Kanagawa Lotus",
				description: "The light Kanagawa variant.",
				scheme: "light",
				paletteKey: "kanagawaLotus"
			},
			{
				id: "rose-pine",
				name: "Rosé Pine",
				description: "Muted, elegant dark.",
				scheme: "dark",
				paletteKey: "rosePine"
			},
			{
				id: "rose-pine-dawn",
				name: "Rosé Pine Dawn",
				description: "The light Rosé Pine variant.",
				scheme: "light",
				paletteKey: "rosePineDawn"
			},
			{
				id: "vesper",
				name: "Vesper",
				description: "Minimal high-contrast monochrome with peach and mint accents.",
				scheme: "dark",
				paletteKey: "vesper"
			}
		].map((spec) => {
			const palette = PALETTES[spec.paletteKey];
			return {
				id: spec.id,
				name: spec.name,
				description: spec.description,
				colorScheme: spec.scheme,
				palette,
				tokens: buildTokens(palette, spec.scheme)
			};
		});
		/** Built-in preference ids the Appearance row owns; picking one clears a saved herdr pick. */
		const BUILTIN_PREFERENCE_IDS = [
			"light",
			"dark",
			"system"
		];
		//#endregion
		//#region src/client/ThemesPanel.tsx
		/**
		* The Themes settings page: every herdr built-in theme plus the system option,
		* each as a card with live color swatches. A card click applies the theme
		* immediately (that is the preview); the card's action row then offers “Use”
		* to persist the selection in the Host settings document and “Cancel” to
		* revert to the saved one.
		*
		* Everything arrives through the props shares (AGENTS.md): the selection
		* scope and the theme snapshot through the injected selector hooks, the
		* write paths through the injected actions. The component never sees ctx.
		*/
		const swatchColors = (palette) => [
			palette.panelBg,
			palette.surface1,
			palette.accent,
			palette.text,
			palette.red,
			palette.green,
			palette.yellow
		];
		const styles = {
			root: {
				display: "flex",
				flexDirection: "column",
				gap: "14px",
				padding: "16px 20px",
				maxWidth: "880px"
			},
			title: {
				margin: 0,
				fontSize: "15px",
				fontWeight: 600,
				color: "var(--dsw-alias-label-primary)"
			},
			hint: {
				margin: 0,
				fontSize: "12.5px",
				color: "var(--dsw-alias-label-tertiary)"
			},
			grid: {
				display: "grid",
				gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
				gap: "10px"
			},
			card: {
				display: "flex",
				flexDirection: "column",
				gap: "8px",
				padding: "12px",
				background: "var(--dsw-alias-bg-layer-1)",
				border: "1px solid var(--dsw-alias-border-l1)",
				borderRadius: "10px",
				cursor: "pointer"
			},
			cardActive: {
				borderColor: "var(--dsw-alias-brand-primary)",
				boxShadow: "0 0 0 1px var(--dsw-alias-brand-primary)"
			},
			cardHeader: {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: "8px"
			},
			name: {
				margin: 0,
				fontSize: "13.5px",
				fontWeight: 600,
				color: "var(--dsw-alias-label-primary)"
			},
			badge: {
				fontSize: "10.5px",
				padding: "2px 7px",
				borderRadius: "999px",
				whiteSpace: "nowrap",
				background: "var(--dsw-alias-bg-layer-2)",
				color: "var(--dsw-alias-label-secondary)"
			},
			badgeActive: {
				background: "var(--dsw-alias-button-primary-fill)",
				color: "var(--dsw-alias-label-primary-foreground)"
			},
			swatches: {
				display: "flex",
				gap: "4px"
			},
			swatch: {
				width: "22px",
				height: "16px",
				borderRadius: "4px",
				border: "1px solid var(--dsw-alias-border-l2)",
				boxSizing: "border-box"
			},
			description: {
				margin: 0,
				fontSize: "12px",
				color: "var(--dsw-alias-label-secondary)",
				minHeight: "30px"
			},
			actions: {
				display: "flex",
				gap: "6px"
			},
			button: {
				flex: 1,
				padding: "5px 10px",
				fontSize: "12px",
				borderRadius: "6px",
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-bg-layer-2)",
				color: "var(--dsw-alias-label-primary)",
				cursor: "pointer"
			},
			primaryButton: {
				flex: 1,
				padding: "5px 10px",
				fontSize: "12px",
				borderRadius: "6px",
				border: "none",
				background: "var(--dsw-alias-button-primary-fill)",
				color: "var(--dsw-alias-label-primary-foreground)",
				cursor: "pointer"
			},
			note: {
				margin: 0,
				fontSize: "12px",
				color: "var(--dsw-alias-state-warn-primary)"
			},
			sectionLabel: {
				margin: "10px 0 2px",
				fontSize: "12px",
				fontWeight: 600,
				color: "var(--dsw-alias-label-secondary)"
			}
		};
		/** One theme card. A click previews; the action row saves or cancels. */
		function ThemeCard(props) {
			const [busy, setBusy] = (0, react.useState)(false);
			const save = async () => {
				setBusy(true);
				try {
					props.onSettled(await props.actions.apply(props.id));
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: props.previewing ? {
					...styles.card,
					...styles.cardActive
				} : styles.card,
				onClick: () => {
					if (!props.previewing) {
						props.actions.preview(props.id);
						props.onPreview();
					}
				},
				role: "button",
				"aria-pressed": props.previewing,
				tabIndex: 0,
				onKeyDown: (event) => {
					if (!props.previewing && (event.key === "Enter" || event.key === " ")) {
						event.preventDefault();
						props.actions.preview(props.id);
						props.onPreview();
					}
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: styles.cardHeader,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: styles.name,
							children: props.name
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: props.badge === "Active" ? {
								...styles.badge,
								...styles.badgeActive
							} : styles.badge,
							children: props.badge
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: styles.swatches,
						children: props.swatches.map((color) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: {
							...styles.swatch,
							background: color
						} }, color))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						style: styles.description,
						children: [props.description, props.scheme === "dark" ? " · dark" : " · light"]
					}),
					props.previewing && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: styles.actions,
						onClick: (event) => {
							event.stopPropagation();
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: styles.primaryButton,
							disabled: busy,
							onClick: () => {
								save();
							},
							children: busy ? "Saving…" : "Use theme"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: styles.button,
							disabled: busy,
							onClick: () => {
								props.actions.cancel();
								props.onSettled({ status: "saved" });
							},
							children: "Cancel"
						})]
					})
				]
			});
		}
		/**
		* Render the Themes settings page.
		* @param props - section owner share plus the injected theme face.
		* @returns the page.
		*/
		function ThemesPanel(props) {
			const selection = props.useSelection((s) => s);
			const theme = props.useTheme((s) => s);
			const stored = typeof selection.value?.themeId === "string" ? selection.value.themeId : "";
			const [previewId, setPreviewId] = (0, react.useState)(null);
			const [note, setNote] = (0, react.useState)(null);
			const settled = (outcome) => {
				if (outcome.status === "saved") {
					setNote(null);
					setPreviewId(null);
					return;
				}
				if (outcome.status === "session-only") {
					setNote("Applied for this session only — remote browsers cannot save a theme choice.");
					setPreviewId(null);
					return;
				}
				if (outcome.status === "not-applied") {
					setNote("The host did not accept the change; your previous selection stays.");
					return;
				}
				setNote(`Could not save: ${outcome.message}`);
			};
			const currentId = theme.preference;
			const systemPreviewing = previewId === "system";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: styles.root,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.title,
						children: "Themes from Herdr"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.hint,
						children: "Click a theme to preview it live. Use it to save. The saved theme re-applies on every reload and stays until you switch here. The Appearance row only affects the base palette when no theme is saved."
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.sectionLabel,
						children: "System"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: systemPreviewing ? {
							...styles.card,
							...styles.cardActive
						} : styles.card,
						role: "button",
						"aria-pressed": systemPreviewing,
						tabIndex: 0,
						onClick: () => {
							if (!systemPreviewing) {
								props.actions.preview("system");
								setPreviewId("system");
							}
						},
						onKeyDown: (event) => {
							if (!systemPreviewing && (event.key === "Enter" || event.key === " ")) {
								event.preventDefault();
								props.actions.preview("system");
								setPreviewId("system");
							}
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: styles.cardHeader,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: styles.name,
									children: "Follow the OS"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: stored === "" && !systemPreviewing ? {
										...styles.badge,
										...styles.badgeActive
									} : styles.badge,
									children: stored === "" && !systemPreviewing ? "Active" : "system"
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: styles.description,
								children: "Default DSH behavior: light or dark follows your operating system, no overrides."
							}),
							systemPreviewing && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: styles.actions,
								onClick: (event) => {
									event.stopPropagation();
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: styles.primaryButton,
									onClick: () => {
										props.actions.apply("system").then(settled);
									},
									children: "Use system"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: styles.button,
									onClick: () => {
										props.actions.cancel();
										setPreviewId(null);
									},
									children: "Cancel"
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.sectionLabel,
						children: "Herdr built-in themes"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: styles.grid,
						children: HERDR_THEMES.map((def) => {
							const isPreviewing = previewId === def.id;
							const badge = isPreviewing ? "Preview" : stored === def.id || currentId === def.id ? "Active" : def.colorScheme;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThemeCard, {
								id: def.id,
								name: def.name,
								description: def.description,
								scheme: def.colorScheme,
								swatches: swatchColors(def.palette),
								badge,
								previewing: isPreviewing,
								actions: props.actions,
								onPreview: () => setPreviewId(def.id),
								onSettled: settled
							}, def.id);
						})
					}),
					note !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.note,
						children: note
					})
				]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** Plugin-owned namespace on the Host settings document. */
		const SETTINGS_NAMESPACE = "herdr-themes";
		/** Required services (cordis fiber inject). */
		const inject = [
			"slots",
			"settingsScope",
			"theme"
		];
		/**
		* Register the themes and the Settings page.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			const scope = ctx.settingsScope.bind({ namespace: SETTINGS_NAMESPACE });
			for (const theme of HERDR_THEMES) ctx.effect(() => ctx.theme.register(theme), `herdr-themes: register ${theme.id}`);
			const storedId = () => {
				const value = scope.getSnapshot().value;
				return typeof value?.themeId === "string" ? value.themeId : "";
			};
			const adopt = () => {
				const id = storedId();
				if (id === "" || id === ctx.theme.getTheme().preference) return;
				try {
					ctx.theme.setTheme(id);
				} catch {
					scope.set("themeId", "").catch(() => {});
				}
			};
			ctx.effect(() => scope.subscribe(adopt), "herdr-themes: adopt stored theme");
			const reassert = () => {
				const id = storedId();
				if (id === "") return;
				try {
					ctx.theme.setTheme(id);
				} catch {
					scope.set("themeId", "").catch(() => {});
				}
			};
			let suppressing = false;
			const setThemeQuietly = (id) => {
				suppressing = true;
				try {
					ctx.theme.setTheme(id);
				} catch {} finally {
					suppressing = false;
				}
			};
			ctx.on("theme/change", (snapshot) => {
				if (suppressing) return;
				if (!BUILTIN_PREFERENCE_IDS.includes(snapshot.preference)) return;
				reassert();
			});
			const preview = (id) => setThemeQuietly(id);
			const cancel = () => {
				const id = storedId();
				setThemeQuietly(id === "" ? "system" : id);
			};
			/** Persist the selection; the Host read-back is the only truth. */
			const apply = async (id) => {
				if (id === "system") {
					if (scope.getSnapshot().mode === "memory") {
						setThemeQuietly("system");
						return { status: "session-only" };
					}
					try {
						await scope.set("themeId", "");
					} catch (error) {
						return {
							status: "error",
							message: error instanceof Error ? error.message : String(error)
						};
					}
					setThemeQuietly("system");
					return scope.getSnapshot().value?.themeId === "" || scope.getSnapshot().value?.themeId === void 0 ? { status: "saved" } : { status: "not-applied" };
				}
				setThemeQuietly(id);
				if (scope.getSnapshot().mode === "memory") return { status: "session-only" };
				try {
					await scope.set("themeId", id);
				} catch (error) {
					return {
						status: "error",
						message: error instanceof Error ? error.message : String(error)
					};
				}
				return scope.getSnapshot().value?.themeId === id ? { status: "saved" } : { status: "not-applied" };
			};
			const themeView = {
				getSnapshot: () => ctx.theme.getTheme(),
				subscribe: (listener) => ctx.on("theme/change", () => {
					listener();
				})
			};
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "herdr-themes",
				order: 5,
				label: "Themes",
				inject: () => ({
					hooks: {
						selection: scope,
						theme: themeView
					},
					actions: {
						preview,
						apply,
						cancel
					}
				})
			}, ThemesPanel));
		}
		//#endregion
		exports.SETTINGS_NAMESPACE = SETTINGS_NAMESPACE;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map