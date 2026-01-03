import assert from 'node:assert';
import Dare from '../../src/index.js';

// Test Generic DB functions
import sqlEqual from '../lib/sql-equal.js';

import DareError from '../../src/utils/error.js';
import {describe, it, beforeEach} from 'node:test';

describe('post', () => {
	let dare;

	beforeEach(() => {
		dare = new Dare();

		// Should not be called...
		dare.execute = () => {
			throw new Error('execute called');
		};
	});

	it('should contain the function dare.post', async () => {
		assert.strictEqual(typeof dare.post, 'function');
	});

	it('should generate an INSERT statement and execute dare.execute', async () => {
		dare.execute = async ({sql, values}) => {
			sqlEqual(sql, 'INSERT INTO test (`id`) VALUES (?)');
			assert.deepStrictEqual(values, [1]);
			return {id: 1};
		};

		const resp = await dare.post('test', {id: 1});
		assert.strictEqual(resp.id, 1);
	});

	it('should accept an Array of records to insert', async () => {
		dare.execute = async ({sql, values}) => {
			sqlEqual(
				sql,
				`
				INSERT INTO test (\`id\`, \`name\`, \`field\`)
				VALUES (?, ?, DEFAULT), (?, ?, ?)
			`
			);
			assert.deepStrictEqual(values, [1, '1', 2, '2', 'extra']);
			return [];
		};

		return dare.post('test', [
			{id: 1, name: '1'},
			{name: '2', id: 2, field: 'extra'},
		]);
	});

	it('should accept option.duplicate_keys=ignore', async () => {
		let called;

		dare.execute = async ({sql, values}) => {
			called = 1;
			sqlEqual(
				sql,
				'INSERT INTO test (`id`) VALUES (?) ON DUPLICATE KEY UPDATE test._rowid=test._rowid'
			);
			assert.deepStrictEqual(values, [1]);
			return {};
		};

		await dare.post('test', {id: 1}, {duplicate_keys: 'ignore'});

		assert.strictEqual(called, 1);
	});

	it('should accept option.ignore=true', async () => {
		let called;

		dare.execute = async ({sql, values}) => {
			called = 1;
			sqlEqual(sql, 'INSERT IGNORE INTO test (`id`) VALUES (?)');
			assert.deepStrictEqual(values, [1]);
			return {};
		};

		await dare.post('test', {id: 1}, {ignore: true});

		assert.strictEqual(called, 1);
	});

	it('should accept option.update=[field1, field2, ...fieldn]', async () => {
		let called;

		dare.execute = async ({sql, values}) => {
			called = 1;
			sqlEqual(
				sql,
				'INSERT INTO test (`id`, `name`, `age`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `age`=VALUES(`age`)'
			);
			assert.deepStrictEqual(values, [1, 'name', 38]);
			return {};
		};

		await dare.post(
			'test',
			{id: 1, name: 'name', age: 38},
			{duplicate_keys_update: ['name', 'age']}
		);

		assert.strictEqual(called, 1);
	});

	it('should understand a request object', async () => {
		dare.execute = async ({sql, values}) => {
			// Limit: 1
			sqlEqual(sql, 'INSERT INTO test (`name`) VALUES (?)');
			assert.deepStrictEqual(values, ['name']);

			return {success: true};
		};

		return dare.post({
			table: 'test',
			body: {name: 'name'},
		});
	});

	it('should trigger pre handler, options.post.[table]', async () => {
		dare.execute = async ({sql, values}) => {
			sqlEqual(sql, 'INSERT INTO tbl (`name`) VALUES (?)');
			assert.deepStrictEqual(values, ['andrew']);
			return {success: true};
		};

		dare.options.models = {
			tbl: {
				post(req) {
					// Augment the request
					req.body.name = 'andrew';
				},
			},
		};

		return dare.post({
			table: 'tbl',
			body: {name: 'name'},
		});
	});

	it('should trigger pre handler, options.post.default, and wait for Promise to resolve', async () => {
		dare.execute = async ({sql, values}) => {
			sqlEqual(sql, 'INSERT INTO tbl (`name`) VALUES (?)');
			assert.deepStrictEqual(values, ['andrew']);
			return {success: true};
		};

		dare.options.models = {
			default: {
				async post(req) {
					// Augment the request
					req.body.name = 'andrew';
				},
			},
		};

		return dare.post({
			table: 'tbl',
			body: {name: 'name'},
		});
	});

	it('should trigger pre handler, and handle errors being thrown', async () => {
		const msg = 'snap';

		dare.options.models = {
			default: {
				post() {
					// Augment the request
					throw new Error(msg);
				},
			},
		};

		const test = dare.post({
			table: 'tbl',
			body: {name: 'name'},
		});

		await assert.rejects(test, Error, msg);
	});

	it('should not exectute if the opts.skip request is marked', async () => {
		const skip = 'true';

		dare.options.models = {
			default: {
				post(opts) {
					opts.skip = skip;
				},
			},
		};

		const resp = await dare.post({
			table: 'tbl',
			body: {name: 'name'},
		});

		assert.strictEqual(resp, skip);
	});

	describe('validate formatting of input values', () => {
		[
			{
				input: 'field',
			},
			{
				input: null,
			},
		].forEach(({input}) => {
			it(`should pass ${input}`, async () => {
				dare.execute = async ({sql, values}) => {
					// Limit: 1
					sqlEqual(sql, 'INSERT INTO test (`name`) VALUES (?)');
					assert.deepStrictEqual(values, [input]);
					return {success: true};
				};

				return dare.post({
					table: 'test',
					body: {name: input},
				});
			});
		});

		[
			{
				key: 'value',
			},
			[1, 2, 3],
		].forEach(given => {
			it(`type=json: should accept object, given ${JSON.stringify(
				given
			)}`, async () => {
				dare.options = {
					models: {
						test: {
							schema: {
								meta: {
									type: 'json',
								},
							},
						},
					},
				};

				const output = JSON.stringify(given);

				dare.execute = async ({sql, values}) => {
					// Limit: 1
					sqlEqual(sql, 'INSERT INTO test (`meta`) VALUES (?)');
					assert.deepStrictEqual(values, [output]);
					return {success: true};
				};

				return dare.post({
					table: 'test',
					body: {meta: given},
				});
			});

			it(`type!=json: should throw an exception, given ${JSON.stringify(
				given
			)}`, async () => {
				const call = dare.patch({
					table: 'test',
					filter: {id: 1},
					body: {name: given},
				});

				await assert.rejects(call, (error) => {
					assert.ok(error instanceof DareError);
					assert.match(error.message, /Field 'name' does not accept objects as values/);
					assert.strictEqual(error.code, DareError.INVALID_VALUE);
					return true;
				});
			});
		});

		[new Date('2023-01-01')].forEach(testValue => {
			it(`type=date: should accept date, given ${testValue}`, async () => {
				dare.options = {
					models: {
						test: {
							schema: {
								startDate: {
									type: 'date',
								},
							},
						},
					},
				};

				dare.execute = async ({sql, values}) => {
					// Limit: 1
					sqlEqual(sql, 'INSERT INTO test (`startDate`) VALUES (?)');
					assert.deepStrictEqual(values, ['2023-01-01']);
					return {success: true};
				};

				return dare.post({
					table: 'test',
					body: {startDate: testValue},
				});
			});
		});
	});

	describe('DB Engine specific tests', () => {
		const DB_ENGINE = 'postgres:16.3';
		let dareInst;

		beforeEach(() => {
			dareInst = dare.use({engine: DB_ENGINE});
		});

		it(`${DB_ENGINE} should use ON CONFLICT ... UPDATE ...`, async () => {
			dareInst.execute = async ({sql, values}) => {
				sqlEqual(
					sql,
					'INSERT INTO test ("id", "name") VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET "name"=EXCLUDED."name" RETURNING id'
				);
				assert.deepStrictEqual(values, [1, 'name']);
				return {success: true};
			};

			return dareInst.post({
				table: 'test',
				body: {id: 1, name: 'name'},
				duplicate_keys_update: ['name'],
			});
		});
		it(`${DB_ENGINE} should use ON CONFLICT DO NOTHING`, async () => {
			dareInst.execute = async ({sql, values}) => {
				sqlEqual(
					sql,
					'INSERT INTO test ("id", "name") VALUES (?, ?) ON CONFLICT DO NOTHING RETURNING id'
				);
				assert.deepStrictEqual(values, [1, 'name']);
				return {success: true};
			};

			return dareInst.post({
				table: 'test',
				body: {id: 1, name: 'name'},
				duplicate_keys: 'ignore',
			});
		});
	});
});
