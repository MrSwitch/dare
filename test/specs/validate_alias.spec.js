import assert from 'node:assert';
import validate_alias from '../../src/utils/validate_alias.js';
import {describe, it} from 'node:test';

describe('validate table alias', () => {
	['users', 'users$1', 'users_table', 'usersTable'].forEach(key => {
		it(`should accept ${key} as a valid table references`, () => {
			validate_alias(key);
		});
	});

	['use rs', 'users(1'].forEach(key => {
		it(`should not accept ${key} as a valid table references`, () => {
			assert.throws(() => validate_alias(key), Error);
		});
	});
});
