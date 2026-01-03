import assert from 'node:assert';
import Dare from '../../src/index.js';
import DareError from '../../src/utils/error.js';
// Create a schema
import options from '../data/options.js';

// Test Generic DB functions
import sqlEqual from '../lib/sql-equal.js';
import {describe, it, beforeEach} from 'node:test';

describe('post from query', () => {
	let dare;

	beforeEach(() => {
		dare = new Dare(options);

		// Should not be called...
		dare.execute = () => {
			throw new Error('execute called');
		};
	});

	it('should generate an INSERT...SELECT statement and execute dare.execute', async () => {
		dare.execute = async ({sql, values}) => {
			sqlEqual(
				sql,
				`
				INSERT INTO comments (\`user_id\`, \`name\`, \`message\`, \`email\`)
				SELECT a.id AS "user_id", a.name, "Hello" AS "message", (SELECT b.email FROM users_email b WHERE b.user_id = a.id LIMIT 1) AS "email"
				FROM users a
				WHERE a.name = ?
				GROUP BY a._rowid
				LIMIT 1000
				ON DUPLICATE KEY UPDATE comments._rowid=comments._rowid
			`
			);
			assert.deepStrictEqual(values, ['Liz']);
			return {id: 1};
		};

		const resp = await dare.post({
			table: 'comments',
			query: {
				table: 'users',
				fields: [
					{
						user_id: 'id',
					},
					'name',
					{
						/*
						 * Deep nested
						 * Note however the INSERT...SELECT will move this to the end
						 * - it will appear after `message`
						 */
						email: 'users_email.email',

						// String value, notice the double quotes...
						message: '"Hello"',
					},
				],
				filter: {
					name: 'Liz',
				},
				limit: 1000,
			},
			duplicate_keys: 'ignore',
		});

		assert.strictEqual(resp.id, 1);
	});

	it('should throw an error if query fields include a nested structures', async () => {
		const test = dare.post({
			table: 'comments',
			query: {
				table: 'users',
				fields: [
					{
						users_emails: ['this', 'makes', 'no', 'sense'],
					},
					'name',
				],
			},
			duplicate_keys: 'ignore',
		});

		await assert.rejects(test, (error) => {
			assert(error instanceof DareError);
			assert.strictEqual(error.code, DareError.INVALID_REQUEST);
			return true;
		});
	});

	it('should throw an error if query includes a generated function', async () => {
		const test = dare.post({
			table: 'comments',
			query: {
				table: 'users',
				fields: ['generatedUrl', 'name'],
			},
			duplicate_keys: 'ignore',
		});

		await assert.rejects(test, (error) => {
			assert(error instanceof DareError);
			assert.strictEqual(error.code, DareError.INVALID_REQUEST);
			return true;
		});
	});
});
