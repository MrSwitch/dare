import assert from 'node:assert';
/*
 * Field Reducer
 * Extract the fields from the current dataset
 */

import orderby_reducer from '../../src/format/orderby_reducer.js';
import {describe, it} from 'node:test';

describe('Orderby Reducer', () => {
	describe('should split the current fields belonging to the current and joined tables', () => {
		/*
		 * These are all related to the current item
		 * And should return an array item with the item as given
		 */
		[
			// Test 1
			[['field', 'b_table.b_field'], ['field'], ['b_field']],

			// Test 2
			[['field', 'DATE(DISTINCT field)']],

			// Test 3
			[
				['DATE(b_table.b_field)', 'b_table.b_field2'],
				[],
				['DATE(b_field)', 'b_field2'],
			],
			[['DATE(b_table.b_field) desc'], [], ['DATE(b_field) DESC']],

			// Alias Test
			[['aliasField', 'b_table.aliasField'], ['field'], ['aliasField']],
		].forEach(test => {
			const input = test[0]; // Test request fields array to process
			const expected = test[1] || test[0]; // Test expected || or return the test request untouched
			const expect_join_fields = test[2]; // Expect Joined fields

			it(`where ${JSON.stringify(input)}`, () => {
				// Set joined...
				const joined = {};

				const table_schema = {aliasField: 'field'};
				const current_path = '';
				function extract(key, value) {
					joined[key] = joined[key] || {orderby: []};
					joined[key].orderby.push(...value);
				}

				// Curry the field_reducer
				const reducer = orderby_reducer({
					current_path,
					extract,
					table_schema,
					dareInstance: {},
				});

				// Call the field with the
				const f = input.reduce(reducer, []);

				// Expect the formatted list of fields to be identical to the inputted value
				assert.deepStrictEqual(f, expected);

				if (expect_join_fields) {
					assert.deepStrictEqual(joined.b_table.orderby, expect_join_fields);
				} else {
					assert.ok(!('b_table' in joined));
				}
			});
		});
	});
});
