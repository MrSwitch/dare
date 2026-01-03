import assert from 'node:assert';
import validate_label from '../../src/utils/validate_label.js';
import {describe, it} from 'node:test';

describe('validate field label', () => {
	['field', 'Field', 'AB_'].forEach(key => {
		it(`should accept ${key} as a valid field label`, () => {
			validate_label(key);
		});
	});

	['"', "'", '`', '?'].forEach(key => {
		it(`should not accept ${key} as a valid field label`, () => {
			assert.throws(() => validate_label(key), Error);
		});
	});
});
