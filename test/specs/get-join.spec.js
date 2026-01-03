import assert from 'node:assert';
import Dare from '../../src/index.js';

// Test Generic DB functions
import expectSQLEqual from '../lib/sql-equal.js';

// Create a schema
import options from '../data/options.js';
import {describe, it, beforeEach} from 'node:test';

// Walk
function walk(obj, handler, key = null) {
	if (typeof obj !== 'object') {
		handler(obj, key);
	} else {
		for (const x in obj) {
			walk(obj[x], handler, x);
		}
	}
}

describe('get - request object', () => {
	let dare;
	const limit = 5;

	beforeEach(() => {
		dare = new Dare(options);
	});

	it('should contain the function dare.get', async () => {
		assert.strictEqual(typeof dare.get, 'function');
	});

	it('should generate a SELECT statement and execute dare.sql', async () => {
		dare.sql = ({sql}) => {
			const expected = `

				SELECT DATE_FORMAT(a.created_time, '%Y-%m-%dT%TZ') AS "created_time", COUNT(*) AS "_count", c.id AS "asset.id", c.name AS "asset.name", DATE(c.updated_time) AS "asset.last_updated"
				FROM activityEvents a
					LEFT JOIN activitySession b ON (b.id = a.session_id)
					LEFT JOIN apps c ON (c.id = a.ref_id)
				WHERE a.category = ?
					AND a.action = ?
					AND a.created_time > ?
					AND b.domain = ?
				GROUP BY a.ref_id
				ORDER BY \`_count\` DESC
				LIMIT 5

			`;

			expectSQLEqual(sql, expected);

			return Promise.resolve([]);
		};

		return dare.get({
			table: 'activityEvents',
			filter: {
				category: 'asset',
				action: 'open',
				created_time: '2016-03-04T16:08:32Z..',
				activitySession: {
					domain: '5app.com',
				},
			},
			fields: [
				'created_time',
				'_count',
				{
					asset: [
						'id',
						'name',
						{
							last_updated: 'DATE(updated_time)',
						},
					],
				},
			],
			groupby: 'ref_id',
			orderby: '_count DESC',
			limit,
		});
	});

	describe('fields', () => {
		it('should respond with the same structure as the request.fields', async () => {
			dare.sql = () =>
				Promise.resolve([
					{
						name: 'Name',
						'asset.name': 2001,
					},
				]);

			const resp = await dare.get({
				table: 'activityEvents',
				filter: {
					asset: {
						id: 10,
					},
				},
				fields: [
					'name',
					'ref_id',
					{
						asset: ['name'],
					},
				],
				limit,
			});

			assert.ok(Array.isArray(resp));
			assert.strictEqual(resp.length, 1);
			const item = resp[0];
			assert.ok('name' in item);
			assert.strictEqual(item.asset.name, 2001);
		});

		it('should respond with the same structure as the request.fields', async () => {
			dare.sql = () =>
				Promise.resolve([
					{
						name: 'Name',
						'users_email.name': 2001,
					},
				]);

			const resp = await dare.get({
				table: 'users',
				fields: [
					'name',
					{
						users_email: ['email'],
					},
				],
				filter: {
					users_email: {
						users: {
							name: 1,
						},
					},
				},
				limit,
			});

			assert.ok(Array.isArray(resp));
		});

		it('should allow multiple definitions of the same thing', async () => {
			dare.sql = async ({sql}) => {
				const key = 'email1,users_email.email,users_email.emailnest';

				assert.ok(sql.includes(key));

				return [
					{
						[key]: '["a@b.com","a@b.com","a@b.com"]',
					},
				];
			};

			/*
			 * We should get back both structures
			 */
			const res = await dare.get({
				table: 'users',
				fields: [
					{
						email1: 'users_email.email',
					},
					{
						users_email: ['email'],
					},
					{
						users_email: {
							emailnest: 'email',
						},
					},
				],
			});

			assert.ok('email1' in res);
			assert.ok('email' in res.users_email);
			assert.ok('emailnest' in res.users_email);
		});
	});

	describe('filter', () => {
		describe('should accept', () => {
			[
				{
					field: 'value',
				},
				{
					asset: {
						type: 'mobile',
					},
				},
			].forEach(value => {
				it(`valid: ${JSON.stringify(value)}`, async () => {
					dare.sql = ({sql, values}) => {
						walk(value, (value, key) => {
							assert.ok(sql.includes(key));
							assert.ok(values.includes(value));
						});

						return Promise.resolve([]);
					};

					return dare.get({
						table: 'activityEvents',
						fields: ['id'],
						filter: value,
						limit,
					});
				});
			});

			it('valid: shorthand nested filter keys', async () => {
				dare.sql = ({sql, values}) => {
					assert.ok(sql.includes('.type = ?'));
					assert.ok(sql.includes('.name != ?'));
					assert.ok(values.includes('mobile'));
					assert.ok(values.includes('me'));

					return Promise.resolve([]);
				};

				return dare.get({
					table: 'activityEvents',
					fields: ['id'],
					filter: {
						'asset.-name': 'me',
						'asset.type': 'mobile',
					},
					limit,
				});
			});

			it('should negate nested conditions', async () => {
				dare.sql = ({sql, values}) => {
					expectSQLEqual(
						sql,
						`
						SELECT a.id FROM activityEvents a
						WHERE
							a.a = ?
							AND a.b = ?
							AND NOT EXISTS (
								SELECT 1 FROM apps b
								WHERE  b.id = a.ref_id AND b.name = ?
								LIMIT 1
							)
						LIMIT 5`
					);

					assert.deepStrictEqual(values, [1, 3, 2]);

					return Promise.resolve([]);
				};

				return dare.get({
					table: 'activityEvents',
					fields: ['id'],
					filter: {
						a: 1,
						'-asset.name': 2,
						b: 3,
					},
					limit,
				});
			});
		});
	});

	describe('join conditions', () => {
		describe('should accept', () => {
			const type = 'mobile';

			[
				{
					fields: ['id', {asset: ['name']}],
					join: {
						asset: {
							type,
						},
					},
					expected: `
						SELECT a.id, b.name AS "asset.name"
						FROM activityEvents a
						LEFT JOIN apps b ON (b.type = ? AND b.id = a.ref_id)
						LIMIT 5
					`,
				},
				{
					fields: ['id', {asset$1: ['name']}],
					join: {
						asset$1: {
							type,
						},
					},
					expected: `
						SELECT a.id, b.name AS "asset$1.name"
						FROM activityEvents a
						LEFT JOIN apps b ON (b.type = ? AND b.id = a.ref_id)
						LIMIT 5
					`,
				},
				{
					fields: ['id', {Count: 'COUNT(DISTINCT asset$1.id)'}],
					join: {
						asset$1: {
							type,
						},
					},
					expected: `
						SELECT a.id, COUNT(DISTINCT b.id) AS "Count"
						FROM activityEvents a
						LEFT JOIN apps b ON (b.type = ? AND b.id = a.ref_id)
						LIMIT 5
					`,
				},
				{
					fields: ['id'],
					join: {
						type,
					},
					expected: `
						SELECT a.id
						FROM activityEvents a
						WHERE a.type = ?
						LIMIT 5
					`,
				},
			].forEach(test => {
				const {join, fields, expected} = test;

				it(`valid: ${JSON.stringify(test.join)}`, async () => {
					dare.sql = ({sql, values}) => {
						assert.deepStrictEqual(values, [type]);

						expectSQLEqual(sql, expected);

						return Promise.resolve([{}]);
					};

					return dare.get({
						table: 'activityEvents',
						fields,
						join,
						limit,
					});
				});
			});
		});

		it('should ignore redundant joins', async () => {
			dare.sql = ({sql}) => {
				const expected = `
					SELECT a.id
					FROM activityEvents a
					LIMIT 5
				`;

				expectSQLEqual(sql, expected);

				return Promise.resolve([{}]);
			};

			return dare.get({
				table: 'activityEvents',
				fields: ['id'],
				/*
				 * This defines the join condition,
				 * But the table asset is redundant
				 * it's neither returning fields, part of the filter, or a required join.
				 */
				join: {
					asset: {
						type: 'a',
					},
				},
				limit,
			});
		});

		it('should enforce required table joins', async () => {
			dare.sql = ({sql}) => {
				const expected = `
					SELECT a.id, b.name AS "asset.name"
					FROM activityEvents a
					JOIN apps b ON (b.type = ? AND b.id = a.ref_id)
					LIMIT 5
				`;

				expectSQLEqual(sql, expected);

				return Promise.resolve([{}]);
			};

			return dare.get({
				table: 'activityEvents',
				fields: ['id', {asset: ['name']}],
				join: {
					asset: {
						_required: true,
						type: 'a',
					},
				},
				limit,
			});
		});

		it('should enforce required table joins between deep nested tables', async () => {
			dare.sql = ({sql}) => {
				const expected = `
					SELECT a.id, b.name AS "asset.name"
					FROM activityEvents a
					LEFT JOIN apps b ON (b.type = ? AND b.id = a.ref_id)
					LEFT JOIN assetDomains c ON (c.asset_id = b.id)
					WHERE (c.asset_id = b.id OR b.id IS NULL)
					GROUP BY a._rowid
					LIMIT 5
				`;

				expectSQLEqual(sql, expected);

				return Promise.resolve([{}]);
			};

			return dare.get({
				table: 'activityEvents',
				fields: ['id', {asset: ['name']}],
				join: {
					asset: {
						type: 'a',
						assetDomains: {
							_required: true,
						},
					},
				},
				limit,
			});
		});
	});

	describe('GROUP BY inclusion', () => {
		it('should automatically assign a GROUP BY on a 1:n join', async () => {
			dare.sql = ({sql}) => {
				const expected = `
					SELECT a.id
					FROM apps a
					LEFT JOIN activityEvents b ON(b.ref_id = a.id)
					WHERE b.type = ?
					GROUP BY a._rowid
					LIMIT 5
				`;

				expectSQLEqual(sql, expected);

				return Promise.resolve([{}]);
			};

			return dare.get({
				table: 'asset',
				fields: ['id'],
				filter: {
					activityEvents: {
						type: 'a',
					},
				},
				limit,
			});
		});

		it('should not automatically assign a GROUP on an 1:n join where there are Aggregate ', async () => {
			dare.sql = ({sql}) => {
				const expected = `
					SELECT COUNT(*) AS "_count"
					FROM apps a
					LEFT JOIN activityEvents b ON(b.ref_id = a.id)
					WHERE b.type = ?
					LIMIT 5
				`;

				expectSQLEqual(sql, expected);

				return Promise.resolve([{}]);
			};

			return dare.get({
				table: 'asset',
				fields: ['_count'],
				filter: {
					activityEvents: {
						type: 'a',
					},
				},
				limit,
			});
		});
	});

	describe('generated fields', () => {
		beforeEach(() => {
			// Create handler for 'asset.thumbnail'
			dare.options = {
				models: {
					assets: {
						schema: {
							picture_id: ['picture.id'],
							thumbnail(fields) {
								// Update the current fields array to include any dependencies missing
								fields.push('id');

								// Return either a SQL string or a function to run on the response object
								return obj => `/asset/${obj.id}/thumbnail`;
							},
							url(fields) {
								// Update the current fields array to include any dependencies missing
								fields.push('id');

								// Return either a SQL string or a function to run on the response object
								return obj => `/asset/${obj.id}/url`;
							},
						},
					},
					picture: {
						schema: {
							url(fields) {
								// Update the current fields array to include any dependencies missing
								fields.push('id');

								// Return either a SQL string or a function to run on the response object
								return obj =>
									`${this.options.meta.root}/picture/${obj.id}/image`;
							},
						},
					},
				},
			};
		});

		it('should allow generated fields to be rendered in the response', async () => {
			// Stub the execute function
			dare.sql = () =>
				// Ensure that there is no thumbnail field requested.
				Promise.resolve([
					{
						id: 1,
						name: 'Andrew',
						'picture.id': 100,
					},
				]);

			const resp = await dare.get({
				table: 'assets',
				fields: [
					'name',
					'thumbnail',
					'url',
					{
						picture: ['url'],
					},
				],
				meta: {
					root: 'http://example.com',
				},
			});

			assert.deepStrictEqual(resp, {
				name: 'Andrew',
				thumbnail: '/asset/1/thumbnail',
				url: '/asset/1/url',
				picture: {
					url: 'http://example.com/picture/100/image',
				},
			});
		});

		it('should allow generated fields to be restructured in the reponse', async () => {
			// Stub the execute function
			dare.sql = () =>
				// Ensure that there is no thumbnail field requested.
				Promise.resolve([
					{
						id: 1,
						name: 'Andrew',
						'picture.id': 100,
					},
				]);

			const resp = await dare.get({
				table: 'assets',
				fields: [
					'name',
					'thumbnail',
					{
						pictureUrl: 'picture.url',
					},
				],
				meta: {
					root: 'http://example.com',
				},
			});

			assert.deepStrictEqual(resp, {
				name: 'Andrew',
				thumbnail: '/asset/1/thumbnail',
				pictureUrl: 'http://example.com/picture/100/image',
			});
		});
	});
});
