import fs from 'node:fs';
import path from 'node:path';
import appc from 'node-appc';
import { DOMParser } from '@xmldom/xmldom';

const xml = appc.xml;
const launchScreensCache = {};

export function load(projectDir, logger, opts) {
	if (process.argv.indexOf('--i18n-dir') !== -1) {
		// Enable developers to specify i18n directory location with build flag
		const customI18n = process.argv[process.argv.indexOf('--i18n-dir') + 1];
		if (customI18n && fs.existsSync(path.join(expand(projectDir), customI18n))) {
			projectDir = path.join(projectDir, customI18n);
		}
	}
	const i18nDir = path.join(projectDir, 'i18n');
	const data = {};
	const ignoreDirs = opts && opts.ignoreDirs;
	const ignoreFiles = opts && opts.ignoreFiles;

	// TODO: Process languages in parallel!
	if (fs.existsSync(i18nDir)) {
		logger?.debug('Compiling localization files');
		for (const lang of fs.readdirSync(i18nDir)) {
			const langDir = path.join(i18nDir, lang);
			const isDir = fs.existsSync(langDir) && fs.statSync(langDir).isDirectory();

			if (isDir && (!ignoreDirs || !ignoreDirs.test(lang))) {
				const s = data[lang] = {};

				for (const name of fs.readdirSync(langDir)) {
					const file = path.join(langDir, name);
					if (/.+\.xml$/.test(name) && (!ignoreFiles || !ignoreFiles.test(name)) && fs.existsSync(file) && fs.statSync(file).isFile()) {
						logger?.debug(`Processing i18n file: ${lang}/${name}`);

						const dest = name === 'app.xml' ? 'app' : 'strings';
						const obj = s[dest] = s[dest] || {};
						const dom = new DOMParser().parseFromString(fs.readFileSync(file, 'utf8'), 'text/xml');

						xml.forEachElement(dom.documentElement, (elem) => {
							if (elem.nodeType === 1 && elem.tagName === 'string') {
								const name = xml.getAttr(elem, 'name');
								if (name) {
									obj[name] = elem?.firstChild?.data || '';
								}
							}
						});
					}
				}
			}
		}
	}

	return data;
}

export function findLaunchScreens(projectDir, logger, opts) {
	if (launchScreensCache[projectDir]) {
		return launchScreensCache[projectDir];
	}

	const i18nDir = path.join(projectDir, 'i18n');
	const data = [];

	if (!opts) {
		opts = {};
	}

	if (fs.existsSync(i18nDir)) {
		logger?.debug('Checking for Splash Screen localization');
		for (const lang of fs.readdirSync(i18nDir)) {
			const langDir = path.join(i18nDir, lang);
			const isDir = fs.existsSync(langDir) && fs.statSync(langDir).isDirectory();
			if (isDir && (!opts.ignoreDirs || !opts.ignoreDirs.test(lang))) {
				for (const name of fs.readdirSync(langDir)) {
					if (/^(Default(-(Landscape|Portrait))?(-[0-9]+h)?(@[2-9]x)?)\.png$/.test(name)) {
						data.push(path.join(langDir, name));
					}
				}
			}
		}
	}

	return launchScreensCache[projectDir] = data;
}
