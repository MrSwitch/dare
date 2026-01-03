import assert from 'node:assert';
import Dare from '../../src/index.js';
import DareError from '../../src/utils/error.js';
import {describe, it, beforeEach} from 'node:test';

describe('validate_body', () => {
	let dare;

	beforeEach(() => {
		dare = new Dare();

		// Should not be called...
		dare.execute = () => {
			throw new Error('execute called');
		};
	});

	['post', 'patch'].forEach(method => {
		describe(`${method} should throw an invalid_request on the following`, () => {
			[{}, [], null, 1, 'string'].forEach(body => {
				it(JSON.stringify(body), async () => {
					const test = dare[method]({
						table: 'tbl',
						filter: {
							id: 1,
						},
						body,
					});

					await assert.rejects(test, (error) => {
						assert(error instanceof DareError);
						assert.match(
							error.message,
							/^The body .*? is invalid$/
						);
						assert.strictEqual(error.code, DareError.INVALID_REQUEST);
						return true;
					});
				});
			});
		});
	});
});
