import assert from 'node:assert';
import validate_label from '../../src/utils/validate_label.ts';
import {describe, it} from 'node:test';

describe('validate field label', () => {
	['field', 'Field', 'AB_', 'a.b[c,d]', 'Email Field', 'a$1'].forEach(key => {
		it(`should accept ${key} as a valid field label`, () => {
			validate_label(key);
		});
	});

	[
		'"',
		"'",
		'`',
		'?',

		// The backslash escapes the closing quote in MySQL
		'x\\',
		'\\',

		// Control characters
		'x\u0000',
		'x\u0001',
		'x\n',
	].forEach(key => {
		it(`should not accept ${JSON.stringify(key)} as a valid field label`, () => {
			assert.throws(() => validate_label(key), Error);
		});
	});
});
