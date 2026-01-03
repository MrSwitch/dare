import assert from 'node:assert';
/*
 * Field Reducer
 * Extract the fields from the current dataset
 */

import field_reducer from '../../src/format/field_reducer.js';
import {describe, it, beforeEach} from 'node:test';

describe('Field Reducer', () => {
	let dareInstance;

	// Mock instance of Dare
	beforeEach(() => {
		dareInstance = {
			generated_fields: [],
			options: {
				method: 'get',
			},
		};
	});

	describe('should split the current fields belonging to the current and joined tables', () => {
		/*
		 * These are all related to the current item
		 * And should return an array item with the item as given
		 */
		[
			// Test 1
			[['field', 'b_table.b_field'], ['field'], ['b_table.b_field']],

			// Test 2
			[
				[
					{
						Field: 'COUNT(DISTINCT field)',
					},
				],
			],

			// Test 3
			[['field']],

			// Test 4
			[
				[
					{
						Field: 'field',
						'Another Field': 'b_table.b_field',
					},
				],
				[
					{
						Field: 'field',
					},
				],
				[
					{
						'Another Field': 'b_table.b_field',
					},
				],
			],

			// Test 5
			[
				[
					{
						Field: 'COUNT(DISTINCT field)',
						'Another Field': 'COUNT(DISTINCT b_table.b_field)',
					},
				],
				[
					{
						Field: 'COUNT(DISTINCT field)',
					},
				],
				[
					{
						'Another Field': 'COUNT(DISTINCT b_table.b_field)',
					},
				],
			],

			// Test 6
			[
				[
					{
						Field: 'COUNT(DISTINCT asset.field)',
					},
				],
				[
					{
						Field: 'COUNT(DISTINCT asset.field)',
					},
				],
			],
			// Test 7
			[
				[
					{
						Field: 'asset.field',
						b_table: {},
					},
				],
				[
					{
						Field: 'asset.field',
					},
				],
			],
			// Test 8
			[
				[
					{
						Field: 'asset.field',
						b_table: [],
					},
				],
				[
					{
						Field: 'asset.field',
					},
				],
			],

			// Test 8
			[
				[
					{
						Field: 'asset.field',
						b_table: [],
					},
				],
				[
					{
						Field: 'asset.field',
					},
				],
			],
			/*
			 * Alias to another
			 * Taps into an alias on the current model which maps to another table field
			 */
			[
				['crossTableAlias'],
				[],
				[
					{
						crossTableAlias: 'b_table.realField',
					},
				],
			],
			[
				[
					{
						Field: 'COUNT(crossTableAlias)',
					},
				],
				[],
				[
					{
						Field: 'COUNT(b_table.realField)',
					},
				],
			],

			// Should ignore trailing $suffix
			[['field$suffix'], ['field']],
		].forEach(test => {
			const input = test[0]; // Test request fields array to process
			const expected = test[1] || test[0]; // Test expected || or return the test request untouched
			const expect_join_fields = test[2]; // Expect Joined fields

			// Details about the current table...
			const field_alias_path = 'something.asset.';
			const table_schema = {
				crossTableAlias: {
					alias: 'b_table.realField',
				},
			};
			const joined = {};

			function extract(key, value) {
				if (!(key in joined)) {
					joined[key] = {fields: value};
				} else {
					joined[key].fields.push(...value);
				}
			}

			it(`where ${JSON.stringify(input)}`, () => {
				// Curry the field_reducer
				const fr = field_reducer({
					field_alias_path,
					extract,
					table_schema,
					dareInstance,
				});

				// Call the field with the field reducer

				// @ts-ignore
				const f = input.reduce(fr, []);

				// Expect the formatted list of fields to be identical to the inputted value
				assert.deepStrictEqual(f, expected);

				if (expect_join_fields) {
					assert.deepStrictEqual(joined.b_table.fields, expect_join_fields);
				} else {
					assert.ok(!('b_table' in joined));
				}
			});
		});
	});

	it('should return generated fields', async () => {
		const table_schema = {
			generated_field() {
				assert.strictEqual(this, dareInstance);
				return 'another_field';
			},
		};

		const field_alias_path = 'alias';

		// Curry the field_reducer
		const fr = field_reducer({
			field_alias_path,
			table_schema,
			dareInstance,
			extract: () => {
				// Continue
			},
		});

		// Call the field with the
		const f = ['generated_field'].reduce(fr, []);

		// Expect the formatted list of fields to be identical to the inputted value
		assert.strictEqual(f[0].generated_field, 'another_field');
	});

	it('should format datetime fields', async () => {
		const table_schema = {
			created: {
				type: 'datetime',
			},
		};

		const field_alias_path = 'created';

		// Curry the field_reducer
		const fr = field_reducer({
			field_alias_path,
			table_schema,
			dareInstance,
			extract: () => {
				// Continue
			},
		});

		// Call the field with the
		const f = ['created'].reduce(fr, []);

		// Expect the formatted list of fields to be identical to the inputted value
		assert('created' in f[0]);
		assert.strictEqual(f[0].created, "DATE_FORMAT(created,'%Y-%m-%dT%TZ')");
	});

	it('should format type=json fields', async () => {
		const table_schema = {
			meta: {
				type: 'json',
			},
		};

		const field_alias_path = 'created';

		// Curry the field_reducer
		const fr = field_reducer({
			field_alias_path,
			table_schema,
			dareInstance,
			extract: () => {
				// Continue
			},
		});

		// Call the field with the
		const f = ['meta'].reduce(fr, []);

		// Expect the formatted list of fields to be identical to the inputted value
		assert.strictEqual(f[0], 'meta');

		const [postProcessing] = dareInstance.generated_fields;

		assert.strictEqual(typeof postProcessing, "object");

		assert.strictEqual(postProcessing.label, 'meta');
		assert('field_alias_path' in postProcessing);
		assert.strictEqual(postProcessing.field_alias_path, field_alias_path);
		assert.ok('handler' in postProcessing);
	});

	it('should format aliased fields', async () => {
		const table_schema = {
			fieldAlias: 'field',
		};

		const field_alias_path = 'joinTable.';

		// Curry the field_reducer
		const fr = field_reducer({
			field_alias_path,
			table_schema,
			dareInstance,
			extract: () => {
				// Continue
			},
		});

		// Call the field with the
		const f = [
			{
				'Label Alias': 'joinTable.fieldAlias',
			},
		].reduce(fr, []);

		// Expect the formatted list of fields to be identical to the inputted value
		assert.strictEqual(f[0]['Label Alias'], 'joinTable.field');
	});
});
