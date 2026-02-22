import { expand } from '../../src/util/expand.js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

let HOME: string | undefined;
let USERPROFILE: string | undefined;
let SystemRoot: string | undefined;

beforeAll(() => {
	HOME = process.env.HOME;
	USERPROFILE = process.env.USERPROFILE;
	SystemRoot = process.env.SystemRoot;
});

afterEach(() => {
	if (HOME !== undefined) {
		process.env.HOME = HOME;
	}
	if (USERPROFILE !== undefined) {
		process.env.USERPROFILE = USERPROFILE;
	}
	if (SystemRoot !== undefined) {
		process.env.SystemRoot = SystemRoot;
	}
	delete process.env.TITANIUMLIB_TEST_PLATFORM;
});

const isWin = process.platform === 'win32';

describe('expand()', () => {
	it('should resolve the home directory using HOME', () => {
		process.env.HOME = isWin ? 'C:\\Users\\username' : '/Users/username';
		delete process.env.USERPROFILE;

		const p = expand('~/foo');
		expect(p).to.equal(isWin ? 'C:\\Users\\username\\foo' : '/Users/username/foo');
	});

	it('should resolve the home directory using USERPROFILE', () => {
		delete process.env.HOME;
		process.env.USERPROFILE = isWin ? 'C:\\Users\\username' : '/Users/username';

		const p = expand('~/foo');
		expect(p).to.equal(isWin ? 'C:\\Users\\username\\foo' : '/Users/username/foo');
	});

	it('should collapse relative segments', () => {
		const p = expand('/path/./to/../foo');
		expect(p).to.match(isWin ? /:\\path\\foo/ : /\/path\/foo/);
	});

	it.skipIf(!isWin)('should resolve environment paths (Windows)', () => {
		process.env.TITANIUMLIB_TEST_PLATFORM = 'win32';
		process.env.SystemRoot = 'C:\\WINDOWS';
		const p = expand('%SystemRoot%\\foo');
		expect(isWin ? p : p.substring(process.cwd().length + 1)).to.equal('C:\\WINDOWS\\foo');
	});
});
