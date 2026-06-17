/* eslint quotes: ["error", "single", { "avoidEscape": true, "allowTemplateLiterals": true }]*/
import assert from 'node:assert';

// Test Generic DB functions
import group_concat from '../../../src/utils/group_concat.js';
import MSSQLDare from '../../../src/mssql.js';
import {describe, it, beforeEach} from 'node:test';

describe(`utils/group_concat: (mssql)`, () => {
	let dareInstance;

	beforeEach(() => {
		dareInstance = new MSSQLDare({engine: 'mssql:2022'});
	});

	it('should reduce an array of fields to a STRING_AGG JSON array statement', async () => {
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

		assert.strictEqual(
			gc.expression,
			`CONCAT('[', STRING_AGG(CASE WHEN (a.id IS NOT NULL) THEN (JSON_ARRAY(table.a,table.b NULL ON NULL)) ELSE NULL END, ','), ']')`
		);
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

		assert.strictEqual(
			gc.expression,
			`JSON_ARRAY(table.a,table.b NULL ON NULL)`
		);
		assert.strictEqual(gc.label, 'a,b');
	});
});
