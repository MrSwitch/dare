/* eslint quotes: ["error", "single", { "avoidEscape": true, "allowTemplateLiterals": true }]*/
import assert from 'node:assert';

// Test Generic DB functions
import group_concat from '../../../src/utils/group_concat.js';
import PostgresDare from '../../../src/postgres16.js';
import {describe, it, beforeEach} from 'node:test';

describe(`utils/group_concat: (postgres)`, () => {
	let dareInstance;

	beforeEach(() => {
		dareInstance = new PostgresDare({engine: 'postgres:16.3'});
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

		assert.strictEqual(
			gc.expression,
			`JSON_ARRAYAGG(CASE WHEN (a.id IS NOT NULL) THEN (JSON_ARRAY(table.a,table.b NULL ON NULL)) ELSE NULL END)`
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

		assert.strictEqual(
			gc.expression,
			`JSON_ARRAYAGG(CASE WHEN (a.id IS NOT NULL) THEN (JSON_ARRAY(table.a NULL ON NULL)) ELSE NULL END)`
		);
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

		assert.strictEqual(
			gc_many.expression,
			`JSON_ARRAY(table.a,table.b NULL ON NULL)`
		);
		assert.strictEqual(gc_many.label, 'a,b');
	});
});
