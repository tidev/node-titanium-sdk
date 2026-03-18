/**
 * Merges two objects deeply.
 * @param target - The target object.
 * @param source - The source object.
 * @returns The merged object.
 */
export function mergeDeep(target: any, source: any) {
	for (const key in source) {
		if (Array.isArray(source[key])) {
			target[key] = source[key];
		} else if (source[key] instanceof Object) {
			if (!target[key]) {
				target[key] = {};
			}
			mergeDeep(target[key], source[key]);
		} else {
			target[key] = source[key];
		}
	}
	return target;
}
