import { expand } from './expand.js';
import { lchownSync, lstatSync } from 'node:fs';
import { lchown, lstat } from 'node:fs/promises';
import { dirname, parse } from 'node:path';

interface OwnerQuery {
	origin: string;
	root: string;
	supported: boolean;
	target: string;
}

export interface OwnerSync {
	apply(): void;
	gid: number;
	origin: string;
	supported: boolean;
	target: string;
	uid: number;
}

export interface Owner {
	apply(): Promise<void>;
	gid: number;
	origin: string;
	supported: boolean;
	target: string;
	uid: number;
}

function initOwnerQuery(path: string): OwnerQuery {
	const target = expand(path);
	const { root } = parse(target);
	const origin = target;
	const supported = process.platform !== 'win32' && typeof process.getuid === 'function';
	return {
		origin,
		root,
		supported,
		target,
	};
}

/**
 * Determines the owner of the nearest owner for the given path.
 *
 * @param path - The path to get nearest owner for
 * @returns A promise that resolves an object containing the uid, gid, and
 * target path
 */
export async function getOwner(path: string): Promise<Owner> {
	let { origin, root, supported, target } = initOwnerQuery(path);

	if (!supported) {
		return {
			async apply() {},
			gid: 0,
			origin: dirname(origin),
			supported,
			target,
			uid: 0,
		};
	}

	// eslint-disable-next-line no-constant-condition
	for (; true; origin = dirname(origin)) {
		try {
			const st = await lstat(origin);
			if (st.isDirectory()) {
				const { uid, gid } = st;
				return {
					async apply() {
						let target2 = target;
						let stat = await lstat(target2);
						while (target2 !== origin && stat.uid !== uid) {
							try {
								await lchown(target2, uid, gid);
								target2 = dirname(target2);
								stat = await lstat(target2);
							} catch {
								break;
							}
						}
					},
					gid,
					origin,
					supported,
					target,
					uid,
				};
			}
		} catch {}
		if (origin === root) {
			throw new Error(`Cannot determine owner of ${path}`);
		}
	}
}

/**
 * Determines the owner of the nearest owner for the given path.
 *
 * @param path - The path to get nearest owner for
 * @returns An object containing the uid, gid, and target path
 */
export function getOwnerSync(path: string): OwnerSync {
	let { origin, root, supported, target } = initOwnerQuery(path);

	if (!supported) {
		return {
			apply() {},
			gid: 0,
			origin: dirname(origin),
			supported,
			target,
			uid: 0,
		};
	}

	// eslint-disable-next-line no-constant-condition
	for (; true; origin = dirname(origin)) {
		try {
			const st = lstatSync(origin);
			if (st.isDirectory()) {
				const { uid, gid } = st;
				return {
					apply() {
						let target2 = target;
						let stat = lstatSync(target2);
						while (target2 !== origin && stat.uid !== uid) {
							try {
								lchownSync(target2, uid, gid);
								target2 = dirname(target2);
								stat = lstatSync(target2);
							} catch {
								break;
							}
						}
					},
					gid,
					origin,
					supported,
					target,
					uid,
				};
			}
		} catch {}
		if (origin === root) {
			throw new Error(`Cannot determine owner of ${path}`);
		}
	}
}
