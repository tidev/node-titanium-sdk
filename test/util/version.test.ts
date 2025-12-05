import { describe, expect, it } from 'vitest';
import * as version from '../../src/util/version.js';

describe('version', () => {
	describe('compare()', () => {
		it('should compare two versions', () => {
			expect(version.compare('1.0.0', '2.0.0')).toBe(-1);
			expect(version.compare('2.0.0', '1.0.0')).toBe(1);
			expect(version.compare('1.0.0', '1.0.0')).toBe(0);

			expect(version.compare('1.1.0', '1.2.0')).toBe(-1);
			expect(version.compare('1.2.0', '1.1.0')).toBe(1);
			expect(version.compare('1.1.0', '1.1.0')).toBe(0);

			expect(version.compare('1.1.1', '1.1.2')).toBe(-1);
			expect(version.compare('1.1.2', '1.1.1')).toBe(1);
			expect(version.compare('1.1.1', '1.1.1')).toBe(0);
		});

		it('should compare two versions with tags', () => {
			expect(version.compare('1.0.0-beta', '1.0.0')).toBe(1);
			expect(version.compare('1.0.0', '1.0.0-beta')).toBe(-1);
			expect(version.compare('1.0.0-beta', '1.0.0-beta')).toBe(0);

			expect(version.compare('1.0.0-beta', '1.0.0-alpha')).toBe(1);
			expect(version.compare('1.0.0-alpha', '1.0.0-beta')).toBe(-1);
			expect(version.compare('1.0.0-beta', '1.0.0-beta')).toBe(0);
			expect(version.compare('1.0.0-beta', '1.0.0-beta.1')).toBe(-1);
			expect(version.compare('1.0.0-beta.1', '1.0.0-beta')).toBe(1);
		});

		it('should compare two versions with different number of segments', () => {
			expect(version.compare('1.0.0', '1.0')).toBe(0);
			expect(version.compare('1.0', '1.0.0')).toBe(0);
		});

		it('should compare two versions with different number of segments and tags', () => {
			expect(version.compare('1.0.0-beta', '1.0')).toBe(1);
			expect(version.compare('1.0', '1.0.0-beta')).toBe(-1);
			expect(version.compare('1.0.0-beta', '1.0.0-beta')).toBe(0);
		});

		it('should compare two versions with different number of segments and tags', () => {
			expect(version.compare('1.0.0-beta', '1.0')).toBe(1);
			expect(version.compare('1.0', '1.0.0-beta')).toBe(-1);
			expect(version.compare('1.0.0-beta', '1.0.0-beta')).toBe(0);
		});

		it('should compare two numbers', () => {
			expect(version.compare(1, 2)).toBe(-1);
			expect(version.compare(2, 1)).toBe(1);
			expect(version.compare(1, 1)).toBe(0);

			expect(version.compare(1.2, 1.3)).toBe(-1);
			expect(version.compare(1.3, 1.2)).toBe(1);
			expect(version.compare(1.2, 1.2)).toBe(0);
		});

		it('should throw an error if the version is invalid', () => {
			expect(() => version.compare('foo', 'bar'))
				.toThrow('Invalid version format');
		});
	});

	describe('format()', () => {
		it('format integer versions', () => {
			expect(version.format(1)).toBe('1');
			expect(version.format(1, 1)).toBe('1');
			expect(version.format(1, 2)).toBe('1.0');
			expect(version.format(1, 3)).toBe('1.0.0');
			expect(version.format(1, 4)).toBe('1.0.0.0');
			expect(version.format(1, 0, 1)).toBe('1');
			expect(version.format(1, 0, 2)).toBe('1');
			expect(version.format(1, 0, 3)).toBe('1');
			expect(version.format(1, 3, 3)).toBe('1.0.0');
		});

		it('format float versions', () => {
			expect(version.format(1.2)).toBe('1.2');
			expect(version.format(1.2, 1)).toBe('1.2');
			expect(version.format(1.2, 2)).toBe('1.2');
			expect(version.format(1.2, 3)).toBe('1.2.0');
			expect(version.format(1.2, 0, 1)).toBe('1');
			expect(version.format(1.2, 0, 2)).toBe('1.2');
			expect(version.format(1.2, 0, 3)).toBe('1.2');
			expect(version.format(1.2, 3, 3)).toBe('1.2.0');
		});

		it('format single segment versions', () => {
			expect(version.format('1')).toBe('1');
			expect(version.format('1', 1)).toBe('1');
			expect(version.format('1', 2)).toBe('1.0');
			expect(version.format('1', 3)).toBe('1.0.0');
			expect(version.format('1', 4)).toBe('1.0.0.0');
			expect(version.format('1', 0, 1)).toBe('1');
			expect(version.format('1', 0, 2)).toBe('1');
			expect(version.format('1', 0, 3)).toBe('1');
			expect(version.format('1', 3, 3)).toBe('1.0.0');
			expect(version.format('1-beta', 0, 1, true)).toBe('1');
			expect(version.format('1-beta', 0, 2, true)).toBe('1');
			expect(version.format('1-beta', 0, 3, true)).toBe('1');
			expect(version.format('1-beta', 3, 3, true)).toBe('1.0.0');
		});

		it('format 2 segment versions', () => {
			expect(version.format('1.2')).toBe('1.2');
			expect(version.format('1.2', 1)).toBe('1.2');
			expect(version.format('1.2', 2)).toBe('1.2');
			expect(version.format('1.2', 3)).toBe('1.2.0');
			expect(version.format('1.2', 4)).toBe('1.2.0.0');
			expect(version.format('1.2', 0, 1)).toBe('1');
			expect(version.format('1.2', 0, 2)).toBe('1.2');
			expect(version.format('1.2', 0, 3)).toBe('1.2');
			expect(version.format('1.2', 3, 3)).toBe('1.2.0');
			expect(version.format('1.2-beta', 0, 1, true)).toBe('1');
			expect(version.format('1.2-beta', 0, 2, true)).toBe('1.2');
			expect(version.format('1.2-beta', 0, 3, true)).toBe('1.2');
			expect(version.format('1.2-beta', 3, 3, true)).toBe('1.2.0');
		});

		it('format 3 segment versions', () => {
			expect(version.format('1.2.3')).toBe('1.2.3');
			expect(version.format('1.2.3', 1)).toBe('1.2.3');
			expect(version.format('1.2.3', 2)).toBe('1.2.3');
			expect(version.format('1.2.3', 3)).toBe('1.2.3');
			expect(version.format('1.2.3', 4)).toBe('1.2.3.0');
			expect(version.format('1.2.3', 0, 1)).toBe('1');
			expect(version.format('1.2.3', 0, 2)).toBe('1.2');
			expect(version.format('1.2.3', 0, 3)).toBe('1.2.3');
			expect(version.format('1.2.3', 3, 3)).toBe('1.2.3');
			expect(version.format('1.2.3-beta', 0, 1, true)).toBe('1');
			expect(version.format('1.2.3-beta', 0, 2, true)).toBe('1.2');
			expect(version.format('1.2.3-beta', 0, 3, true)).toBe('1.2.3');
			expect(version.format('1.2.3-beta', 3, 3, true)).toBe('1.2.3');
			expect(version.format('1.2.3-beta.foo', 3, 3, true)).toBe('1.2.3');
		});

		it('format 4 segment versions', () => {
			expect(version.format('1.2.3.4')).toBe('1.2.3.4');
			expect(version.format('1.2.3.4', 1)).toBe('1.2.3.4');
			expect(version.format('1.2.3.4', 2)).toBe('1.2.3.4');
			expect(version.format('1.2.3.4', 3)).toBe('1.2.3.4');
			expect(version.format('1.2.3.4', 4)).toBe('1.2.3.4');
			expect(version.format('1.2.3.4', 0, 1)).toBe('1');
			expect(version.format('1.2.3.4', 0, 2)).toBe('1.2');
			expect(version.format('1.2.3.4', 0, 3)).toBe('1.2.3');
			expect(version.format('1.2.3.4', 3, 3)).toBe('1.2.3');
		});

		it('should throw an error if the version is invalid', () => {
			expect(() => version.format(undefined as any))
				.toThrow('Invalid version "undefined"');
			expect(() => version.format(null as any))
				.toThrow('Invalid version "null"');
		});
	});

	describe('isValid()', () => {
		it('positive tests', () => {
			expect(version.isValid('1')).toBe(true);
			expect(version.isValid('1.0')).toBe(true);
			expect(version.isValid('1.0.0')).toBe(true);
			expect(version.isValid('1.0.0.0')).toBe(true);
		});

		it('negative tests', () => {
			expect(version.isValid('a')).toBe(false);
			expect(version.isValid(undefined as any)).toBe(false);
			expect(version.isValid(null as any)).toBe(false);
		});
	});

	describe('eq()', () => {
		it('positive tests', () => {
			expect(version.eq(1, 1)).toBe(true);
			expect(version.eq('1', 1)).toBe(true);
			expect(version.eq(1, '1')).toBe(true);
			expect(version.eq('1', '1')).toBe(true);
			expect(version.eq('1.0', '1')).toBe(true);
			expect(version.eq('1.0.0', '1')).toBe(true);
			expect(version.eq('1', '1.0')).toBe(true);
			expect(version.eq('1.0', '1.0')).toBe(true);
			expect(version.eq('1.0.0', '1.0')).toBe(true);
			expect(version.eq('1', '1.0.0')).toBe(true);
			expect(version.eq('1.0', '1.0.0')).toBe(true);
			expect(version.eq('1.0.0', '1.0.0')).toBe(true);
			expect(version.eq('1.0.0', '1.0.0.2')).toBe(true);
			expect(version.eq('1.0.0.1', '1.0.0.2')).toBe(true);
		});

		it('negative tests', () => {
			expect(version.eq('1.0.0', '1.2')).toBe(false);
			expect(version.eq('1.2.3', '1.2')).toBe(false);
			expect(version.eq('1', '1.2')).toBe(false);
			expect(version.eq('1', 2)).toBe(false);
			expect(version.eq('1', 1.2)).toBe(false);
			expect(version.eq('1', '2')).toBe(false);
			expect(version.eq('1.3', '1')).toBe(false);
		});
	});

	describe('lt()', () => {
		it('positive tests', () => {
			expect(version.lt(1, 2)).toBe(true);
			expect(version.lt(1.2, 1.3)).toBe(true);
			expect(version.lt(1.2, 2)).toBe(true);
			expect(version.lt('1.2', 2)).toBe(true);
			expect(version.lt('1.2', '1.3')).toBe(true);
			expect(version.lt('1.2', '2')).toBe(true);
			expect(version.lt('1.2', '1.2.1')).toBe(true);
		});

		it('negative tests', () => {
			expect(version.lt(1, 1)).toBe(false);
			expect(version.lt(1.2, 1.2)).toBe(false);
			expect(version.lt('1.2', 1.2)).toBe(false);
			expect(version.lt(1.2, '1.2')).toBe(false);
			expect(version.lt('1.2', '1.2')).toBe(false);
			expect(version.lt('1.2.3', '1.2')).toBe(false);
			expect(version.lt('1.2', '1.2.0')).toBe(false);
			expect(version.lt('1.2.1', '1.2')).toBe(false);
			expect(version.lt('1.0.0.1', '1.0.0')).toBe(false);
		});
	});

	describe('lte()', () => {
		it('positive tests', () => {
			expect(version.lte(1, 2)).toBe(true);
			expect(version.lte(1.2, 1.2)).toBe(true);
			expect(version.lte(1.2, 1.3)).toBe(true);
			expect(version.lte(1.2, 2)).toBe(true);
			expect(version.lte('1.2', 1.2)).toBe(true);
			expect(version.lte('1.2', 2)).toBe(true);
			expect(version.lte('1.2', '1.2')).toBe(true);
			expect(version.lte('1.2', '1.3')).toBe(true);
			expect(version.lte('1.2', '2')).toBe(true);
			expect(version.lte('1.2', '1.2.0')).toBe(true);
			expect(version.lte('1.2', '1.2.1')).toBe(true);
			expect(version.lte('1.2.0', '1.2.0')).toBe(true);
			expect(version.lte('1.2.0', '1.2.1')).toBe(true);
			expect(version.lte('1.0.0.1', '1.0.0')).toBe(true);
		});

		it('negative tests', () => {
			expect(version.lte(1.1, 1)).toBe(false);
			expect(version.lte('1.0.1', 1)).toBe(false);
			expect(version.lte(1.3, 1.2)).toBe(false);
			expect(version.lte('1.3', 1.2)).toBe(false);
			expect(version.lte(1.3, '1.2')).toBe(false);
			expect(version.lte('1.3', '1.2')).toBe(false);
			expect(version.lte('1.2.3', '1.2')).toBe(false);
			expect(version.lte('1.2.3', '1.2.0')).toBe(false);
		});
	});

	describe('gt()', () => {
		it('positive tests', () => {
			expect(version.gt(2, 1)).toBe(true);
			expect(version.gt(1.3, 1.2)).toBe(true);
			expect(version.gt(2, 1.2)).toBe(true);
			expect(version.gt(2, '1.2')).toBe(true);
			expect(version.gt('1.3', '1.2')).toBe(true);
			expect(version.gt('2', '1.2')).toBe(true);
			expect(version.gt('1.2.1', '1.2')).toBe(true);
		});

		it('negative tests', () => {
			expect(version.gt(1, 1)).toBe(false);
			expect(version.gt(1.2, 1.2)).toBe(false);
			expect(version.gt('1.2', 1.2)).toBe(false);
			expect(version.gt(1.2, '1.2')).toBe(false);
			expect(version.gt('1.2', '1.2')).toBe(false);
			expect(version.gt('1.2', '1.2.3')).toBe(false);
			expect(version.gt('1.2.0', '1.2')).toBe(false);
			expect(version.gt('1.2', '1.2.1')).toBe(false);
			expect(version.gt('1.0.0', '1.0.0.1')).toBe(false);
		});
	});

	describe('gte()', () => {
		it('positive tests', () => {
			expect(version.gte(2, 1)).toBe(true);
			expect(version.gte(1.2, 1.2)).toBe(true);
			expect(version.gte(1.3, 1.2)).toBe(true);
			expect(version.gte(2, 1.2)).toBe(true);
			expect(version.gte(1.2, '1.2')).toBe(true);
			expect(version.gte(2, '1.2')).toBe(true);
			expect(version.gte('1.2', '1.2')).toBe(true);
			expect(version.gte('1.3', '1.2')).toBe(true);
			expect(version.gte('2', '1.2')).toBe(true);
			expect(version.gte('1.2.0', '1.2')).toBe(true);
			expect(version.gte('1.2.1', '1.2')).toBe(true);
			expect(version.gte('1.2.0', '1.2.0')).toBe(true);
			expect(version.gte('1.2.1', '1.2.0')).toBe(true);
			expect(version.gte('1.0.0', '1.0.0.1')).toBe(true);
		});

		it('negative tests', () => {
			expect(version.gte(1, 1.1)).toBe(false);
			expect(version.gte(1, '1.0.1')).toBe(false);
			expect(version.gte(1.2, 1.3)).toBe(false);
			expect(version.gte(1.2, '1.3')).toBe(false);
			expect(version.gte('1.2', 1.3)).toBe(false);
			expect(version.gte('1.2', '1.3')).toBe(false);
			expect(version.gte('1.2', '1.2.3')).toBe(false);
			expect(version.gte('1.2.0', '1.2.3')).toBe(false);
		});
	});

	describe('parseMin()', () => {
		it('finds minimum version', () => {
			expect(version.parseMin('1')).toBe('1');
			expect(version.parseMin('1.2')).toBe('1.2');
			expect(version.parseMin('>=1.0')).toBe('1.0');
			expect(version.parseMin('<1.0')).toBe('1.0');
			expect(version.parseMin('>=2.3.3 <=4.2')).toBe('2.3.3');
			expect(version.parseMin('>=2.3.3 <=4.2 || >=1.0')).toBe('1.0');
			expect(version.parseMin('>=2.3.3 <=4.2 || 2.0')).toBe('2.0');
		});
	});

	describe('parseMax()', () => {
		it('finds maximum version', () => {
			expect(version.parseMax('1')).toBe('1');
			expect(version.parseMax('1.2')).toBe('1.2');
			expect(version.parseMax('>=1.0')).toBe('1.0');
			expect(version.parseMax('<1.0')).toBe('1.0');
			expect(version.parseMax('<18')).toBe('<18');
			expect(version.parseMax('>=2.3.3 <=4.2')).toBe('4.2');
			expect(version.parseMax('>=2.3.3 <=4.2.x')).toBe('4.2');
			expect(version.parseMax('>=2.3.3 <=4.2.x', true)).toBe('4.2.x');
			expect(version.parseMax('>=2.3.3 <=4.2 || >=1.0')).toBe('4.2');
			expect(version.parseMax('>=2.3.3 <=4.2 || 5.0')).toBe('5.0');
		});
	});

	describe('satisfies()', () => {
		it('in range', () => {
			expect(version.satisfies('1.0.0', '1.0.0')).toBe(true);
			expect(version.satisfies('1.0.0', '*')).toBe(true);
			expect(version.satisfies('1.0.0', '>=2.0.0 || *')).toBe(true);
			expect(version.satisfies('1.0.0', '>=1.0.0')).toBe(true);
			expect(version.satisfies('3.0.0', '>=2.3.3 <=4.2')).toBe(true);
			expect(version.satisfies('4', '>=2.3.3 <=4.2 || 5.0 || >=6.0')).toBe(true);
			expect(version.satisfies('5', '>=2.3.3 <=4.2 || 5.0 || >=6.0')).toBe(true);
			expect(version.satisfies('6', '>=2.3.3 <=4.2 || 5.0 || >=6.0')).toBe(true);
			expect(version.satisfies('7', '>=2.3.3 <=4.2 || 5.0 || >=6.0')).toBe(true);
			expect(version.satisfies('18.0.1', '<=18.x')).toBe(true);
			expect(version.satisfies('18.0.1', '>=18.x')).toBe(true);
			expect(version.satisfies('18.0.1', '>=19.x')).toBe(false);
		});

		it('not in range', () => {
			expect(version.satisfies('2.0.0', '1.0.0')).toBe(false);
			expect(version.satisfies('2.0.0', '>=2.3.3 <=4.2')).toBe(false);
			expect(version.satisfies('2.3', '>=2.3.3 <=4.2')).toBe(false);
			expect(version.satisfies('4.3', '>=2.3.3 <=4.2 || 5.0 || >=6.0')).toBe(false);
			expect(version.satisfies('5.1', '>=2.3.3 <=4.2 || 5.0 || >=6.0')).toBe(false);
		});

		it('maybe', () => {
			expect(version.satisfies('2.0', '1.0', true)).toBe('maybe');
			expect(version.satisfies('2.0', '>=1.0', true)).toBe(true);
			expect(version.satisfies('2.0', '<1.0', true)).toBe('maybe');
			expect(version.satisfies('2.0', '>=2.3.3 <=4.2', true)).toBe(false);
			expect(version.satisfies('5.0', '>=2.3.3 <=4.2', true)).toBe('maybe');
			expect(version.satisfies('18', '>=10 <=18', true)).toBe(true);
		});
	});

	describe('sort()', () => {
		it('should sort versions', () => {
			expect(version.sort(['1.0.2', '1.0.1', '1.0.0']))
				.toEqual(['1.0.0', '1.0.1', '1.0.2']);
			expect(version.sort(['1.0.2-beta', '1.0.1-beta', '1.0.0-beta']))
				.toEqual(['1.0.0-beta', '1.0.1-beta', '1.0.2-beta']);
			expect(version.sort(['1.0.2-beta', '1.0.1-beta', '1.0.0-beta']))
				.toEqual(['1.0.0-beta', '1.0.1-beta', '1.0.2-beta']);
		});
	});
});
