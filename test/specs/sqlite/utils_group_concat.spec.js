/* eslint quotes: ["error", "single", { "avoidEscape": true, "allowTemplateLiterals": true }]*/
import assert from 'node:assert';

// Test Generic DB functions
import group_concat from '../../../src/utils/group_concat.js';
import SQLiteDare from '../../../src/sqlite.js';
import {describe, it, beforeEach} from 'node:test';

describe(`utils/group_concat: (sqlite)`, () => {
	let dareInstance;

	beforeEach(() => {
		dareInstance = new SQLiteDare({engine: 'sqlite:3'});
	});

	it('should reduce an array of fields to a JSON_GROUP_ARRAY statement', async () => {
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
			`JSON_GROUP_ARRAY(CASE WHEN (a.id IS NOT NULL) THEN (JSON_ARRAY(table.a,table.b)) ELSE NULL END)`
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

		assert.strictEqual(gc.expression, `JSON_ARRAY(table.a,table.b)`);
		assert.strictEqual(gc.label, 'a,b');
	});
});
