import assert from 'node:assert';
import Dare from '../../src/index.js';

// Test Generic DB functions
import sqlEqual from '../lib/sql-equal.js';
import {describe, it, beforeEach} from 'node:test';

const id = 1;
describe('getCount', () => {
	let dare;
	const count = 123;

	beforeEach(() => {
		dare = new Dare();
		dare.execute = () => {
			throw new Error('Should not execute');
		};
	});

	it('should contain the function dare.getCount', async () => {
		assert.strictEqual(typeof dare.getCount, 'function');
	});

	it('should generate a SELECT statement and execute dare.execute', async () => {
		dare.execute = async ({sql, values}) => {
			sqlEqual(
				sql,
				'SELECT COUNT(DISTINCT a._rowid) AS "count" FROM test a WHERE a.id = ? LIMIT 1'
			);
			assert.deepStrictEqual(values, [id]);
			return [{count}];
		};

		const resp = await dare.getCount('test', {id});

		assert.strictEqual(resp, count);
	});

	it('should remove the groupby to the fields section', async () => {
		dare.execute = async ({sql, values}) => {
			const expected = `
				SELECT COUNT(DISTINCT DATE(a.created_time)) AS "count"
				FROM test a
				LIMIT 1
			`;

			sqlEqual(sql, expected);
			assert.deepStrictEqual(values, []);

			return [{count}];
		};

		const resp = await dare.getCount({
			table: 'test',
			fields: ['_group'],
			groupby: 'DATE(created_time)',
		});

		assert.strictEqual(resp, count);
	});

	it('should apply multiple groupby', async () => {
		dare.execute = async ({sql, values}) => {
			const expected = `
				SELECT COUNT(DISTINCT DATE(a.created_time), a.name) AS "count"
				FROM test a
				LIMIT 1
			`;

			sqlEqual(sql, expected);
			assert.deepStrictEqual(values, []);

			return [{count}];
		};

		const resp = await dare.getCount({
			table: 'test',
			fields: ['id', 'name'],
			groupby: ['DATE(created_time)', 'name'],
			start: 10,
			limit: 10,
		});

		assert.strictEqual(resp, count);
	});

	it('should not mutate the request object', async () => {
		const original = {
			table: 'test',
			fields: ['id', 'name'],
			groupby: ['DATE(created_time)', 'name'],
			orderby: ['name'],
		};

		dare.execute = async () => [{count}];

		const request = {...original};

		await dare.getCount(request);

		// Check shallow clone
		assert.deepStrictEqual(request, original);

		// Check deep clone
		assert.deepStrictEqual(request.fields,  ['id', 'name']);
		assert.deepStrictEqual(request.orderby,  ['name']);
	});
});
