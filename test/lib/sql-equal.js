import assert from 'node:assert/strict';
/*
 * SQL Match
 * Convert a SQL string into a regular expression to compare with a generated SQL string
 */

export default (a, b) => {
	// Reformat both sql statements and compare
	assert.deepStrictEqual(reformat(a), reformat(b));
};

function reformat(sql) {
	return sql.replace(/\s+/g, '');
}
