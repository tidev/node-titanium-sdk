import { DOMParser } from '@xmldom/xmldom';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import snooplogg from 'snooplogg';
import { expand } from '../util/expand.js';
import { isDir } from '../util/is-dir.js';
import { isFile } from '../util/is-file.js';
import * as xml from '../util/xml.js';

const { debug } = snooplogg('titanium')('i18n');

interface LoadOptions {
	ignoreDirs?: RegExp;
	ignoreFiles?: RegExp;
}

interface LaunchScreensCache {
	[projectDir: string]: string[];
}

interface I18NLangData {
	app?: Record<string, string>;
	strings?: Record<string, string>;
}

interface I18NData {
	[lang: string]: I18NLangData;
}

const launchScreensCache: LaunchScreensCache = {};

/**
 * Loads the i18n data from the project directory.
 *
 * @param projectDir - The project directory.
 * @param opts - The options for the i18n data.
 * @returns The i18n data.
 */
export async function load(
	projectDir: string,
	opts: LoadOptions = {}
): Promise<I18NData> {
	const i18nDir = expand(projectDir, 'i18n');
	const data: I18NData = {};
	const ignoreDirs = opts?.ignoreDirs;
	const ignoreFiles = opts?.ignoreFiles;

	if (!isDir(i18nDir)) {
		debug(`i18n directory not found in ${projectDir}`);
		return data;
	}

	debug(`Compiling localization files in ${i18nDir}`);

	for (const lang of await readdir(i18nDir)) {
		const langDir = path.join(i18nDir, lang);
		if (!isDir(langDir) || (ignoreDirs && !ignoreDirs.test(lang))) {
			continue;
		}

		const strings: I18NLangData = {};
		data[lang] = strings;

		for (const name of await readdir(langDir)) {
			const file = path.join(langDir, name);
			if (
				name.endsWith('.xml') && (!ignoreFiles || !ignoreFiles.test(name)) && isFile(file)
			) {
				debug(`Processing i18n file: ${lang}/${name}`);

				const dest = name === 'app.xml' ? 'app' : 'strings';
				if (!strings[dest]) {
					strings[dest] = {};
				}
				const obj = strings[dest];
				const dom = new DOMParser().parseFromString(
					await readFile(file, 'utf8'),
					'text/xml'
				);

				xml.forEachElement(dom.documentElement, (elem) => {
					if (elem.nodeType === xml.ELEMENT_NODE && elem.tagName === 'string') {
						const name = xml.getAttrString(elem, 'name');
						if (name !== null) {
							obj[name] = xml.getValueString(elem);
						}
					}
				});
			}
		}
	}

	return data;
}

interface FindLaunchScreensOptions {
	bypassCache?: boolean;
	ignoreDirs?: RegExp;
}

const launchScreensRegex =
	/^(Default(-(Landscape|Portrait))?(-[0-9]+h)?(@[2-9]x)?)\.png$/;

/**
 * Finds the launch screens in the i18n directory.
 *
 * @param projectDir - The project directory.
 * @param opts - The options for the launch screens.
 * @returns The launch screens.
 */
export async function findLaunchScreens(
	projectDir: string,
	opts: FindLaunchScreensOptions = {}
): Promise<string[]> {
	if (!opts.bypassCache && launchScreensCache[projectDir]) {
		return launchScreensCache[projectDir];
	}

	const i18nDir = path.join(projectDir, 'i18n');
	const launchScreens: string[] = [];

	if (isDir(i18nDir)) {
		debug('Checking for Splash Screen localization in %s', i18nDir);
		for (const lang of await readdir(i18nDir)) {
			const langDir = path.join(i18nDir, lang);
			if (isDir(langDir) && (!opts.ignoreDirs || !opts.ignoreDirs.test(lang))) {
				for (const name of await readdir(langDir)) {
					if (launchScreensRegex.test(name)) {
						launchScreens.push(path.join(langDir, name));
					}
				}
			}
		}
	}

	launchScreensCache[projectDir] = launchScreens;
	return launchScreens;
}
