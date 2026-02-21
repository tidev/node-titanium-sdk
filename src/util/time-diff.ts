/**
 * Render the time difference between two dates in a human readable format
 * broken down into days, hours, minutes, seconds, and milliseconds.
 * Returns a string with one or more units, e.g. `1d 3h 5m 8s 13ms`
 */
export function timeDiff(start: Date, end: Date): string {
	let delta = Math.abs(end.getTime() - start.getTime());

	const ms = delta % 1000;
	delta = Math.floor(delta / 1000);
	const seconds = delta % 60;
	delta = Math.floor(delta / 60);
	const minutes = delta % 60;
	delta = Math.floor(delta / 60);
	const hours = delta % 24;
	delta = Math.floor(delta / 24);
	const days = delta;

	const parts: string[] = [];
	if (days > 0) parts.push(`${days}d`);
	if (hours > 0) parts.push(`${hours}h`);
	if (minutes > 0) parts.push(`${minutes}m`);
	if (seconds > 0) parts.push(`${seconds}s`);
	if (ms > 0) parts.push(`${ms}ms`);

	if (parts.length === 0) parts.push('0ms');

	return parts.join(' ');
}
