import assert from 'node:assert';
/*
 * Field Reducer
 * Extract the fields from the current dataset
 */

import orderby_unwrap from '../../src/utils/orderby_unwrap.js';
import {describe, it} from 'node:test';

describe('utils/orderby_unwrap', () => {
	// Should unwrap SQL Formating to underlying column name
	[
		['field', {field: 'field', direction: ''}],
		['DATE(field)', {field: 'DATE(field)', direction: ''}],
		['field ASC', {field: 'field', direction: ' ASC'}],
		[
			'COUNT(DISTINCT field) DESC',
			{field: 'COUNT(DISTINCT field)', direction: ' DESC'},
		],
		[
			'COUNT(DISTINCT events.field) desc',
			{field: 'COUNT(DISTINCT events.field)', direction: ' DESC'},
		],
		[
			'EXTRACT(YEAR_MONTH FROM field) ASC',
			{field: 'EXTRACT(YEAR_MONTH FROM field)', direction: ' ASC'},
		],
	].forEach(([input, output]) => {
		it(`where ${JSON.stringify(input)}`, () => {
			// Call the field with the
			const unwrapped = orderby_unwrap(input);

			// Expect the formatted list of fields to be identical to the inputted value
			assert.deepStrictEqual(unwrapped, output);
		});
	});
});
