import assert from 'node:assert';
/*
 * Field Reducer
 * Extract the fields from the current dataset
 */

import unwrap_field from '../../src/utils/unwrap_field.js';
import DareError from '../../src/utils/error.js';
import {describe, it} from 'node:test';

describe('utils/unwrap_field', () => {
	/*
	 * Supported Field Expressions
	 * Should unwrap SQL Formating to underlying column name
	 */
	[
		'field',
		'DATE(field)',
		'!field',
		'!DATE(field)',
		'DATE_FORMAT(field, "%Y-%m-%dT%T.%fZ")',
		'DATE_SUB(field, INTERVAL 10 DAY)',
		'COUNT(DISTINCT field)',
		'GROUP_CONCAT(DISTINCT field)',
		'GROUP_CONCAT(DISTINCT field ORDER BY 1)',
		'MAX(DAY(field))',
		'EXTRACT(YEAR_MONTH FROM field)',
		'IF(field, "yes", "no")',
		'IF(field = 1, "yes", "no")',
		'IF(field > 1, "yes", "no")',
		'IF(field < 1, "yes", "no")',
		'IF(field >= 1, "yes", "no")',
		'IF(field <= 1, "yes", "no")',
		'IF(field != 1, "yes", "no")',
		'IF(field <> 1, "yes", "no")',
		'IF(field = "string", "yes", "no")',
		'IF(field != \'string\', "yes", "no")',
		'IF(field IS NULL, "yes", "no")',
		'IF(field IS NOT NULL, "yes", "no")',
		'COALESCE(field, "")',
		'CAST(field AS SIGNED)',
		'CONVERT(field , SIGNED)',
		'NULLIF(field, "is null")',
		'ROUND(field, 2)',
		'ROUND(AVG(field) * 100, 2)',
		'RIGHT(field, 4)',
		"FORMAT(field,'en_GB')",
		"CONCAT(ROUND(field * 100, 2), '%')",
		"CONCAT('$', field)",
		"FORMAT(ROUND(field * 5, 2), 'en_GB')",
		"FORMAT(ROUND(field * 5.5, 2), 'en_GB')",
		"FORMAT(ROUND(field / 5, 2), 'en_GB')",
		'DATE(CONVERT_TZ(field, "UTC", "Europe/London"))',
		`CONCAT('$',${Array(150).fill(' ').join('')}field)`,
	].forEach(test => {
		it(`where ${JSON.stringify(test)}`, () => {
			// Call the field with the
			const unwrapped = unwrap_field(test);

			// Expect the formatted list of fields to be identical to the inputted value
			assert.strictEqual(unwrapped.field, 'field');
		});
	});

	/*
	 * Unsupported field expressions
	 * Shall throw an error when unwrapping SQL these field expressions.
	 * Either the syntax errors or unsupported SQL in Dare.
	 */
	[
		// Bad Syntax
		'field(',
		'IF(field < "string"str, "yes", "no")',
		'IF(field = \'string", "yes", "no")',
		'IF(field, SELECT 1 FROM table)',
		'IF(field, ""), SELECT 1 FROM table)',
		'DATE_FORMAT(field, ',
		'IF(field <<< 123, "yes", "no")',

		// Escaping quotes
		'IF(field = "string\\", "yes", "no")',

		/*
		 * DOS Attack
		 * Over 100 characters
		 */
		`CONCAT('$',${Array(200).fill(' ').join('')} field)`,

		// SQL Injection
		'FORMAT(SELECT 1 FROM abc)',

		/*
		 * VALID SYNTAX, BUT UNSUPPORTED
		 */

		// Bad spacing
		'IF(field<123, "yes", "no")',

		// More than 1 field requested
		'CONCAT(field, secret)',
		'IF(field < field2, "yes", "no")',
	].forEach(test => {
		it(`errors: ${JSON.stringify(test)}`, () => {
			// Expect the field expression unwrapping to throw a Dare Error
			assert.throws(unwrap_field.bind(null, test), DareError);
		});
	});
});
