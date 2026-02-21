const words = new Set([
	'abstract',
	'assert',
	'boolean',
	'break',
	'byte',
	'case',
	'catch',
	'char',
	'class',
	'const',
	'continue',
	'default',
	'do',
	'double',
	'else',
	'enum',
	'extends',
	'false',
	'final',
	'finally',
	'float',
	'for',
	'goto',
	'if',
	'implements',
	'import',
	'instanceof',
	'int',
	'interface',
	'long',
	'native',
	'new',
	'null',
	'package',
	'private',
	'protected',
	'public',
	'return',
	'short',
	'static',
	'strictfp',
	'super',
	'switch',
	'synchronized',
	'this',
	'throw',
	'throws',
	'transient',
	'true',
	'try',
	'void',
	'volatile',
	'while',
]);

export function validAppId(id: string): boolean {
	if (!id || typeof id !== 'string') {
		return false;
	}

	id = id.trim();

	if (id.startsWith('.') || id.endsWith('.')) {
		// must not start or end with a dash
		return false;
	}

	if (id.includes('..')) {
		// must not contain consecutive periods
		return false;
	}

	if (!id.includes('.')) {
		// must contain at least one period
		return false;
	}

	const segments = id.split('.');

	for (const segment of segments) {
		if (!/^[a-zA-Z0-9]/.test(segment)) {
			// must start with a letter or number
			return false;
		}

		if (!/^[a-zA-Z0-9]*$/.test(segment)) {
			// must contain only letters and numbers
			return false;
		}

		if (segment.length > 255) {
			// must not be longer than 255 characters
			return false;
		}

		if (words.has(segment)) {
			// must not contain a reserved word
			return false;
		}
	}

	return true;
}
