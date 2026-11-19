import assert from 'node:assert';
/*
 * Field Reducer
 * Extract the fields from the current dataset
 */

import unwrap_field from '../../src/utils/unwrap_field.ts';
import DareError from '../../src/utils/error.ts';
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
	 * Double quotes are identifiers in Postgres, SQLite and MySQL (ANSI_QUOTES)
	 * and could be used to read columns the request has no access to.
	 * They are rewritten to single quotes, which are always string literals.
	 */
	[
		['IF(field, "yes", "no")', 'IF(', ", 'yes', 'no')"],
		['CONCAT("password", field)', "CONCAT('password', ", ')'],
		['COALESCE(field, "password")', 'COALESCE(', ", 'password')"],
		['IF(field = "string", 1, 2)', 'IF(', " = 'string', 1, 2)"],
		["IF(field, 'yes', 'no')", 'IF(', ", 'yes', 'no')"],
	].forEach(([test, prefix, suffix]) => {
		it(`rewrites double quotes: ${JSON.stringify(test)}`, () => {
			const unwrapped = unwrap_field(test);

			assert.strictEqual(unwrapped.field, 'field');
			assert.strictEqual(unwrapped.prefix, prefix);
			assert.strictEqual(unwrapped.suffix, suffix);
			assert.ok(!`${unwrapped.prefix}${unwrapped.suffix}`.includes('"'));
		});
	});

	[
		['CONCAT("a", "b")', "CONCAT('a', 'b')"],
		['"password"', "'password'"],
	].forEach(([test, value]) => {
		it(`rewrites double quotes in values: ${JSON.stringify(test)}`, () => {
			assert.deepStrictEqual(unwrap_field(test), {value});
		});
	});

	/*
	 * Field paths
	 * `$` separates an alias, `*` is a wildcard
	 */
	[
		['a.b', 'a.b'],
		['a$1.b$2', 'a$1.b$2'],
		['a.*', 'a.*'],
		['COUNT(*)', '*'],
		["CONCAT('--', field)", 'field'],
		["CONCAT('/*', field)", 'field'],
	].forEach(([test, field]) => {
		it(`accepts ${JSON.stringify(test)}`, () => {
			assert.strictEqual(unwrap_field(test).field, field);
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

		// Denial of service: expression exceeds the 200-character limit
		`CONCAT('$',${Array(200).fill(' ').join('')} field)`,

		// SQL injection / unsupported SQL
		'FORMAT(SELECT 1 FROM abc)',

		// Valid syntax, but unsupported
		'IF(field<123, "yes", "no")',
		'CONCAT(field, secret)',
		'IF(field < field2, "yes", "no")',

		// SQL syntax breakout and stacked statements
		'field; DROP TABLE users',
		'field) AS field; SELECT 1',
		'IF(field = 1; DROP TABLE users, "yes", "no")',
		'IF(field = 1, 1, 1); --',
		'IF(field, "yes", "no"); EXEC xp_cmdshell("dir")',

		// SQL comments
		'field -- comment',
		'field /* comment */',
		'IF(field = 1, "yes", "no") # comment',
		'IF(field = 1, "yes", "no") -- OR 1=1',

		// UNION / subquery / set operations
		'IF(field, "yes", "no") UNION SELECT password FROM users',
		'UNION(field, secret)',
		'EXTRACT(YEAR_MONTH FROM field UNION SELECT password)',
		'IF(field IN (SELECT password FROM users), "yes", "no")',
		'IF(EXISTS(SELECT 1 FROM users), field, "no")',

		// Boolean / tautology and alternate-operator payloads
		'IF(field = 1 OR 1=1, "yes", "no")',
		'IF(field = 1 AND 1=2, "yes", "no")',
		'IF(field = $1, "yes", "no")',
		'IF(1=1,field,secret)',
		'field\nOR 1=1',

		// Blind / time-based and database-specific function vectors
		'IF(field = 1, SLEEP(5), 0)',
		'IF(field = 1, pg_sleep(10), 0)',
		'IF(field = 1, WAITFOR DELAY "0:0:5", 0)',
		'IF(field = 1, BENCHMARK(10000000,MD5("x")), 0)',
		'IF(field = 1, LOAD_FILE("/etc/passwd"), 0)',

		// Comment, quote, escape, and encoding bypass attempts
		'IF(field = "\\" OR 1=1 --", "yes", "no")',
		'IF(field = "string%27 OR 1=1--", "yes", "no")',
		'IF(field = "%22 OR 1=1 --", "yes", "no")',
		'field%00UNION SELECT',
		'field\u0000 UNION SELECT password FROM users',
		'field\r\nSELECT * FROM users',

		// Dangerous database commands / function-style payloads
		'COUNT(DISTINCT field) DROP TABLE users',
		'CAST(field AS SIGNED) JOIN users',
		'GROUP_CONCAT(field); DELETE FROM users',
		'DATE(field) WHERE 1=1',
		'DATE_FORMAT(field, "x");ATTACH DATABASE "evil.db" AS evil',

		// Large / abuse payloads
		`IF(field = "${'A'.repeat(201)}", "yes", "no")`,

		// Comment markers hidden in the unquoted portion of a function
		'IF(field, 1 --)',
		'IF(field, 1 -- )',
		'IF(field, 1 -- OR 1)',

		// Placeholders inside quoted strings shift the bound values
		'CONCAT("?", field)',
		"CONCAT('?', field)",
		'IF(field, "?", "no")',

		// Control characters, including inside quoted strings
		'CONCAT("a\u0000b", field)',
		'CONCAT("a\u0001b", field)',
		'field\u0000',

		// `$` is only an alias separator, so cannot start a dollar quoted string
		'$$',
		'$1',
		'a.$$',
		'a$$b',
		'DATE($$)',
		'$tag$',
	].forEach(test => {
		it(`errors: ${JSON.stringify(test)}`, () => {
			// Expect the field expression unwrapping to throw a Dare Error
			assert.throws(unwrap_field.bind(null, test), DareError);
		});
	});
});
