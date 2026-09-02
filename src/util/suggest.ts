export function suggest(subject: string, choices: string[]) {
	const bestMatch = choices.reduce(
		(best, choice) => {
			const score = levenshtein(subject, choice);
			return score < best.score ? { choice, score } : best;
		},
		{ choice: choices[0], score: Infinity }
	);
	return bestMatch.choice;
}

function levenshtein(a: string, b: string) {
	if (a.length < b.length) {
		[a, b] = [b, a]; // ensure 'b' is the shorter string to save memory
	}

	const res = Array.from({ length: b.length + 1 }, (_, i) => i);

	for (let i = 1; i <= a.length; i++) {
		let prevDiagonal = res[0]; // stores the (i-1, j-1) value
		res[0] = i;

		for (let j = 1; j <= b.length; j++) {
			const temp = res[j];
			res[j] = Math.min(
				res[j] + 1, // deletion
				res[j - 1] + 1, // insertion
				prevDiagonal + (a[i - 1] === b[j - 1] ? 0 : 1) // substitution
			);
			prevDiagonal = temp;
		}
	}

	return res[b.length];
}
