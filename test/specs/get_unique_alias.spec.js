import assert from 'node:assert';
import Dare from '../../src/index.js';
import {describe, it} from 'node:test';

describe('get_unique_alias', () => {
	it('should always return a unique alphabet character or a quoted value', async () => {
		const dare = new Dare();

		for (let i = 0; i <= 26 * 26; i++) {
			const alias = dare.get_unique_alias();

			assert.match(alias, /^[a-z]|(?<tick>`)[a-z]{2,}\k<tick>$/);
		}

		// Expect the next one to throw an error
		assert.throws(() => dare.get_unique_alias());
	});
});
