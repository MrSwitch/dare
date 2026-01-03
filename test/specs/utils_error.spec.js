import assert from 'node:assert';
import {describe, it} from 'node:test';
/*
 * Field Reducer
 * Extract the fields from the current dataset
 */

import DareError from '../../src/utils/error.js';

describe('utils/error', () => {
	it('should return instance of DareError with code and message property', () => {
		// Call the field with the
		const error = new DareError(DareError.INVALID_REFERENCE);

		// Expect the formatted list of fields to be identical to the inputted value
		assert.strictEqual(error.code, 'INVALID_REFERENCE');
		assert.strictEqual(error.status, 400);
		assert.strictEqual(error.message, 'Invalid request');
	});
});
