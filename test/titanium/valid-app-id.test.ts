import { validAppId } from '../../src/titanium/valid-app-id.js';
import { describe, expect, it } from 'vitest';

describe('validAppId', () => {
	it('should return false for an invalid app id', () => {
		expect(validAppId(null as unknown as string)).toBe(false);
		expect(validAppId(undefined as unknown as string)).toBe(false);
		expect(validAppId(123 as unknown as string)).toBe(false);
		expect(validAppId({} as unknown as string)).toBe(false);
		expect(validAppId([] as unknown as string)).toBe(false);
		expect(validAppId(true as unknown as string)).toBe(false);
	});

	it('should return false for an app id that starts with a period', () => {
		expect(validAppId('.com.example.app')).toBe(false);
	});

	it('should return false for an app id that ends with a period', () => {
		expect(validAppId('com.example.app.')).toBe(false);
	});

	it('should return false for an app id that contains consecutive periods', () => {
		expect(validAppId('com.example..app')).toBe(false);
	});

	it('should return false if the app id doesn\'t contain a period', () => {
		expect(validAppId('example')).toBe(false);
	});

	it('should return false if the app id contains non-alphanumeric characters', () => {
		expect(validAppId('com.example.underscore_app')).toBe(false);
		expect(validAppId('com.example.app\twith whitespace')).toBe(false);
	});

	it('should return false if the app id segment starts with a dash', () => {
		expect(validAppId('com.example.app.-with-dash')).toBe(false);
	});

	it('should return false if segment is longer than 255 characters', () => {
		expect(validAppId('com.example.app.'.repeat(255))).toBe(false);
	});

	it('should return false for an app id that contains a reserved word', () => {
		expect(validAppId('com.example.app.break')).toBe(false);
	});

	it('should return true for a valid app id', () => {
		expect(validAppId('com.example.app')).toBe(true);
	});
});
