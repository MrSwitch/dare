import assert from 'node:assert';
import Dare from '../../src/index.js';
import {describe, it, beforeEach} from 'node:test';

describe('sql', () => {
	let dare;
	const query = 'SELECT 1';
	const values = [1];

	beforeEach(() => {
		dare = new Dare();

		dare.execute = async ({sql, values}) => {
			assert.strictEqual(sql, query);
			return values[0];
		};
	});

	it('should contain the function dare.sql', async () => {
		assert.strictEqual(typeof dare.sql, 'function');
	});

	it('deprecated: should trigger execute from a string', async () => {
		const res = await dare.sql(query, values);
		assert.deepStrictEqual(res, values[0]);
	});

	it('should trigger execute from an Object<sql, values>', async () => {
		const res = await dare.sql({sql: query, values});
		assert.strictEqual(res, 1);
	});

	it('should trigger execute and reject a promise', async () => {
		const msg = 'test';

		dare.execute = async () => {
			throw new Error(msg);
		};

		const test = dare.sql({sql: query});

		await assert.rejects(test, Error, msg);
	});
});
