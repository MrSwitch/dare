import assert from 'node:assert';
import Dare from '../../src/index.js';

// Test Generic DB functions
import sqlEqual from '../lib/sql-equal.js';

import DareError from '../../src/utils/error.js';
import SQL, {raw} from 'sql-template-tag';
import {describe, it, beforeEach} from 'node:test';

const id = 1;
const name = 'name';

describe('patch', () => {
	let dare;

	beforeEach(() => {
		dare = new Dare();

		// Should not be called...
		dare.execute = () => {
			throw new Error('execute called');
		};
	});

	it('should contain the function dare.patch', async () => {
		assert.strictEqual(typeof dare.patch, 'function');
	});

	it('should generate an UPDATE statement and execute dare.execute', async () => {
		dare.execute = async ({sql, values}) => {
			// Limit: 1
			sqlEqual(
				sql,
				'UPDATE test a SET a.`name` = ? WHERE a.id = ? LIMIT ?'
			);
			assert.deepStrictEqual(values, [name, id, 1]);

			return {success: true};
		};

		const resp = await dare.patch('test', {id}, {name});
		assert.strictEqual(resp.success, true);
	});

	it('should throw an exception if affectedRows: 0', async () => {
		dare.sql = async () => ({affectedRows: 0});

		const test = dare.patch('groups', {id: 20_000}, {name});

		await assert.rejects(test, DareError);
	});

	it('should throw an exception if affectedRows: 0', async () => {
		const notfound = false;

		dare.sql = async () => ({affectedRows: 0});

		const test = await dare.patch(
			'groups',
			{id: 20_000},
			{name},
			{notfound}
		);

		assert.strictEqual(test, notfound);
	});

	describe('validate formatting of input values', () => {
		['field', null].forEach(input => {
			it(`should convert ${input}`, async () => {
				const id = 1;

				dare.execute = async ({sql, values}) => {
					// Limit: 1
					sqlEqual(
						sql,
						'UPDATE test a SET a.`input` = ? WHERE a.id = ? LIMIT ?'
					);
					assert.deepStrictEqual(values, [input, id, 1]);
					return {success: true};
				};

				return dare.patch({
					table: 'test',
					filter: {id},
					body: {input},
				});
			});
		});

		[
			{
				key: 'value',
			},
			[1, 2, 3],
		].forEach(input => {
			it(`should throw an exception, given ${JSON.stringify(
				input
			)}`, async () => {
				const call = dare.patch({
					table: 'test',
					filter: {id},
					body: {name: input},
				});

				await assert.rejects(call, DareError);
			});
		});

		describe('type=json', () => {
			beforeEach(() => {
				dare.options.models = {
					test: {
						schema: {
							meta: {
								type: 'json',
							},
						},
					},
				};
			});

			// Invalid inputs...
			['string', true, false, 0, NaN, a => a].forEach(given => {
				it(`should throw an exception, given ${given}`, async () => {
					const call = dare.patch({
						table: 'test',
						filter: {id},
						body: {meta: given},
					});

					await assert.rejects(call, DareError);
				});
			});

			// Valid inputs
			[{}, [], null].forEach(input => {
				it(`should accept typeof object, given ${JSON.stringify(
					input
				)}`, async () => {
					const id = 1;
					const meta = input ? JSON.stringify(input) : null;

					dare.execute = async ({sql, values}) => {
						// Limit: 1
						sqlEqual(
							sql,
							'UPDATE test a SET a.`meta` = ? WHERE a.id = ? LIMIT ?'
						);
						assert.deepStrictEqual(values, [meta, id, 1]);
						return {success: true};
					};

					return dare.patch({
						table: 'test',
						filter: {id},
						body: {meta: input},
					});
				});
			});
		});

		it('should apply schema.field.setFunction', async () => {
			dare.options.models = {
				test: {
					schema: {
						meta: {
							type: 'json',
							setFunction({sql_field, value}) {
								return SQL`JSON_MERGE_PATCH(${raw(sql_field)}, ${value})`;
							},
						},
					},
				},
			};

			const meta = {key: 'value'};

			dare.execute = async ({sql, values}) => {
				// Limit: 1
				sqlEqual(
					sql,
					'UPDATE test a SET a.`meta` = JSON_MERGE_PATCH(a.`meta`, ?) WHERE a.id = ? LIMIT ?'
				);
				assert.deepStrictEqual(values, [JSON.stringify(meta), id, 1]);
				return {success: true};
			};

			return dare.patch({
				table: 'test',
				filter: {id},
				body: {meta},
			});
		});
	});

	it('should apply the request.limit', async () => {
		const limit = 11;

		dare.execute = async ({sql, values}) => {
			// Limit: 1
			sqlEqual(
				sql,
				'UPDATE test a SET a.`name` = ? WHERE a.id = ? LIMIT ?'
			);
			assert.deepStrictEqual(values, [name, id, limit]);

			return {success: true};
		};

		return dare.patch({
			table: 'test',
			filter: {id},
			body: {name},
			limit,
		});
	});

	it('should apply the request.duplicate_keys', async () => {
		dare.execute = async ({sql, values}) => {
			// Limit: 1
			sqlEqual(
				sql,
				'UPDATE IGNORE test a SET a.`name` = ? WHERE a.id = ? LIMIT ?'
			);
			assert.deepStrictEqual(values, [name, id, 1]);
			return {success: true};
		};

		return dare.patch({
			table: 'test',
			filter: {id},
			body: {name},
			duplicate_keys: 'ignore',
		});
	});

	it('should use table aliases', async () => {
		dare.execute = async ({sql, values}) => {
			// Limit: 1
			sqlEqual(
				sql,
				'UPDATE tablename a SET a.`name` = ? WHERE a.id = ? LIMIT ?'
			);
			assert.deepStrictEqual(values, [name, id, 1]);
			return {success: true};
		};

		dare.options.models = {
			test: {
				table: 'tablename',
			},
		};

		return dare.patch({
			table: 'test',
			filter: {id},
			body: {name},
		});
	});

	it('should trigger pre handler, options.patch.[table]', async () => {
		const newName = 'andrew';

		dare.execute = async ({sql, values}) => {
			sqlEqual(
				sql,
				'UPDATE tbl a SET a.`name` = ? WHERE a.id = ? LIMIT ?'
			);
			assert.deepStrictEqual(values, [newName, id, 1]);

			return {success: true};
		};

		dare.options.models = {
			tbl: {
				patch(req) {
					// Augment the request
					req.body.name = newName;
				},
			},
		};

		return dare.patch({
			table: 'tbl',
			filter: {id},
			body: {name},
		});
	});

	it('should trigger pre handler, options.patch.default, and wait for Promise to resolve', async () => {
		const newName = 'andrew';

		dare.execute = async ({sql, values}) => {
			sqlEqual(
				sql,
				'UPDATE tbl a SET a.`name` = ? WHERE a.id = ? LIMIT ?'
			);
			assert.deepStrictEqual(values, [newName, id, 1]);
			return {success: true};
		};

		dare.options.models = {
			default: {
				async patch(req) {
					req.body.name = newName;
				},
			},
		};

		return dare.patch({
			table: 'tbl',
			filter: {id},
			body: {name},
		});
	});

	it('should trigger pre handler, and handle errors being thrown', async () => {
		const msg = 'snap';

		dare.options.models = {
			default: {
				patch() {
					// Augment the request
					throw new Error(msg);
				},
			},
		};

		const test = dare.patch({
			table: 'tbl',
			filter: {id},
			body: {name},
		});

		await assert.rejects(test, Error, msg);
	});

	it('should not exectute if the opts.skip request is marked', async () => {
		const skip = 'true';

		dare.options.models = {
			default: {
				patch(opts) {
					opts.skip = skip;
				},
			},
		};

		const resp = await dare.patch({
			table: 'tbl',
			filter: {id},
			body: {name},
		});

		assert.strictEqual(resp, skip);
	});

	it('should allow complex filters', async () => {
		dare.execute = async ({sql, values}) => {
			sqlEqual(
				sql,
				'UPDATE tbl a SET a.`name` = ? WHERE a.id = ? AND (NOT a.number < ? OR a.number IS NULL) LIMIT ?'
			);
			assert.deepStrictEqual(values, ['andrew', 1, '100', 1]);
			return {success: true};
		};

		await dare.patch({
			table: 'tbl',
			filter: {id: 1, '-number': '..100'},
			body: {name: 'andrew'},
		});
	});

	it('should allow nested filters', async () => {
		dare.sql = async () => ({affectedRows: 1});

		dare.options.models = {
			tbl: {
				schema: {
					// Create a reference to tblB
					ref_id: ['tblB.id'],
				},
			},
		};

		const test = await dare.patch({
			table: 'tbl',
			filter: {
				id: 1,
				tblB: {
					id: 1,
				},
			},
			body: {name: 'andrew'},
		});

		assert.strictEqual(test.affectedRows, 1);
	});

	describe('DB Engine specific tests', () => {
		it(`should use the correct syntax for postgres`, async () => {
			const dareInst = dare.use({engine: 'postgres:16.3'});

			dareInst.execute = async ({sql, values}) => {
				sqlEqual(sql, 'UPDATE tbl a SET "name" = ? WHERE a.id = ?');
				assert.deepStrictEqual(values, [name, id]);
				return {success: true};
			};

			return dareInst.patch({
				table: 'tbl',
				filter: {id},
				body: {name},
			});
		});
	});
});
