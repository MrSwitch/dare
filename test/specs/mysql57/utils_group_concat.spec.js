/* eslint quotes: ["error", "single", { "avoidEscape": true, "allowTemplateLiterals": true }]*/
import assert from 'node:assert';

// Test Generic DB functions
import group_concat from '../../../src/utils/group_concat.js';
import {describe, it, beforeEach} from 'node:test';
import MySQL57Dare from '../../../src/mysql57.js';

const MYSQL_56 = 'mysql:5.6';
const MYSQL_57 = 'mysql:5.7.40';

[MYSQL_57, MYSQL_56].forEach(DB_ENGINE => {
	describe(`utils/group_concat: (mysql ${DB_ENGINE})`, () => {
		let dareInstance;

		beforeEach(() => {
			dareInstance = new MySQL57Dare({engine: DB_ENGINE});
		});

		it('should return a function', async () => {
			assert.strictEqual(typeof group_concat, 'function');
		});

		it('should reduce an array of fields to a GROUP_CONCAT statement', async () => {
			const gc = group_concat({
				fields: [
					{
						expression: 'table.a',
						label: 'collection.a',
					},
					{
						expression: 'table.b',
						label: 'collection.b',
					},
				],
				address: 'collection.',
				sql_alias: 'a',
				dareInstance,
			});

			const expectSQLEqual = {
				[MYSQL_57]: `JSON_ARRAYAGG(IF(a._rowid IS NOT NULL, JSON_ARRAY(table.a,table.b), NULL))`,
				[MYSQL_56]: `CONCAT('[', GROUP_CONCAT(IF(a._rowid IS NOT NULL, CONCAT_WS('', '[', '"', REPLACE(REPLACE(table.a, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"', ',', '"', REPLACE(REPLACE(table.b, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"', ']'), NULL)), ']')`,
			}[DB_ENGINE || 'default'];

			assert.strictEqual(gc.expression, expectSQLEqual);
			assert.deepStrictEqual(gc.label, 'collection[a,b]');
		});

		it('should not wrap fields which are marked as aggregating the row', async () => {
			const gc = group_concat({
				fields: [
					{
						expression: 'table.a',
						label: 'a',
						agg: true,
					},
					{
						expression: 'table.b',
						label: 'b',
					},
				],
				dareInstance,
			});

			const expectSQLEqual = {
				[MYSQL_57]: `JSON_ARRAY(table.a,table.b)`,
				[MYSQL_56]: `CONCAT_WS('', '[', '"', REPLACE(REPLACE(table.a, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"', ',', '"', REPLACE(REPLACE(table.b, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"', ']')`,
			}[DB_ENGINE || 'default'];

			assert.strictEqual(gc.expression, expectSQLEqual);
			assert.strictEqual(gc.label, 'a,b');
		});

		it('should return a single value if one is given and is an aggregate', async () => {
			const gc = group_concat({
				fields: [
					{
						expression: 'table.a',
						label: 'a',
						agg: true,
					},
				],
				dareInstance,
			});

			assert.strictEqual(gc.expression, 'table.a');
			assert.strictEqual(gc.label, 'a');
		});

		it('should return an array of values for many results', async () => {
			const gc = group_concat({
				fields: [
					{
						expression: 'table.a',
						label: 'collection.a',
					},
				],
				address: 'collection.',
				sql_alias: 'a',
				dareInstance,
			});

			const expectSQLEqual = {
				[MYSQL_57]: `JSON_ARRAYAGG(IF(a._rowid IS NOT NULL, JSON_ARRAY(table.a), NULL))`,
				[MYSQL_56]: `CONCAT('[', GROUP_CONCAT(IF(a._rowid IS NOT NULL, CONCAT_WS('', '[', '"', REPLACE(REPLACE(table.a, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"', ']'), NULL)), ']')`,
			}[DB_ENGINE || 'default'];

			assert.strictEqual(gc.expression, expectSQLEqual);

			assert.deepStrictEqual(gc.label, 'collection[a]');
		});

		it('should infer from the label whether results are implicitly aggregated', async () => {
			const gc = group_concat({
				fields: [
					{
						expression: 'table.a',
						label: 'a',
					},
				],
				address: 'collection.',
				dareInstance,
			});

			assert.strictEqual(gc.expression, 'table.a');
			assert.strictEqual(gc.label, 'a');

			const gc_many = group_concat({
				fields: [
					{
						expression: 'table.a',
						label: 'a',
					},
					{
						expression: 'table.b',
						label: 'b',
					},
				],
				address: 'collection.',
				dareInstance,
			});

			const expectSQLEqual = {
				[MYSQL_57]: `JSON_ARRAY(table.a,table.b)`,
				[MYSQL_56]: `CONCAT_WS('', '[', '"', REPLACE(REPLACE(table.a, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"', ',', '"', REPLACE(REPLACE(table.b, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"', ']')`,
			}[DB_ENGINE || 'default'];

			assert.strictEqual(gc_many.expression, expectSQLEqual);
			assert.strictEqual(gc_many.label, 'a,b');
		});
	});
});
