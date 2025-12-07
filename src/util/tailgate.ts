type TailgateResolver<T> = {
	resolve: (value: T | PromiseLike<T>) => void;
	reject: (reason?: unknown) => void;
};

const tailgates: Record<string, TailgateResolver<any>[]> = {};

/**
 * Ensures that only a function is executed by a single task at a time. If a
 * task is already running, then additional requests are queued. When the task
 * completes, the result is immediately shared with the queued up callers.
 *
 * @param name - The tailgate name.
 * @param callback - A function to call to get results.
 * @returns Resolves whatever value `callback` returns/resolves.
 */
export function tailgate<T>(name: string, callback: () => T): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		if (Object.hasOwn(tailgates, name)) {
			tailgates[name].push({ resolve, reject });
			return;
		}

		tailgates[name] = [{ resolve, reject }];

		const dispatchResolvers = (type: 'resolve' | 'reject', value: unknown) => {
			const pending = tailgates[name];
			delete tailgates[name];
			for (const resolver of pending) {
				resolver[type](value);
			}
		};

		let result: unknown;
		try {
			result = callback();
		} catch (err: unknown) {
			dispatchResolvers('reject', err);
			return;
		}

		if (result instanceof Promise) {
			result
				.then(result => dispatchResolvers('resolve', result))
				.catch(err => dispatchResolvers('reject', err));
		} else {
			dispatchResolvers('resolve', result);
		}
	});
}
