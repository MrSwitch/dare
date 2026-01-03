import assert from 'node:assert/strict';
import extend from '../../src/utils/extend.js';
import {describe, it} from 'node:test';

/*
 * Extend
 *
 */

describe('utils/extend', () => {
	it('should recursively extend an object', async () => {
		const obj = {
			a: {
				b: {
					c1: 1,
				},
			},
		};
		const patch = {
			a: {
				b: {
					c2: 2,
				},
			},
		};

		extend(obj, patch);

		assert.deepStrictEqual(
			obj,
			{
				a: {
					b: {
						c1: 1,
						c2: 2,
					},
				},
			},
			'Should combine the two object properties'
		);
	});

	it('should not extend prototype', async () => {
		// Should not extend the the default prototype object...
		extend({}, JSON.parse('{"__proto__": {"devMode": true}}'));

		assert.ok(!{}.devMode, 'Prototype should not be extended');
	});

	it('should extend properties with values including; scalars, arrays, functions to be replaced', async () => {
		const obj = {
			propString: 'string',
			propNumber: 0,
			propBoolean: false,
			propArray: [1, 2, 3],
			propFunction() {
				// Test
			},
		};

		const expected = {
			propString: 'string',
			propNumber: 1,
			propBoolean: true,
			propArray: [4, 5, 6],
			propFunction() {
				// Test 2
			},
		};

		extend(obj, expected);

		// Expect the extended object to include all the properties of the expected object
		assert.deepStrictEqual(obj, expected);
	});
});
