import assert from 'node:assert';
import {empty, raw} from 'sql-template-tag';
import Dare from '../../../src/mssql.js';
import {describe, it, beforeEach} from 'node:test';

describe('mssql - engine overrides', () => {
	/** @type {any} */
	let dare;

	beforeEach(() => {
		dare = new Dare({engine: 'mssql:2022'});
	});

	it('should handle sql_limit_clause with empty and whitespace ORDER BY entries', () => {
		const clause = dare.sql_limit_clause({
			limit: 3,
			start: 0,
			sql_orderby: [null, '   ', {expression: '   '}],
			sql_alias: 'a',
			sql_fields: [],
			sql_groupby: [],
		});

		assert.strictEqual(
			clause.sql,
			'ORDER BY a.id OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY'
		);
		assert.deepStrictEqual(clause.values, []);
	});

	it('should skip fallback ORDER BY when ORDER BY expression already exists', () => {
		const clause = dare.sql_limit_clause({
			limit: 3,
			start: 4,
			sql_orderby: [{expression: 'a.username'}],
			sql_alias: 'a',
			sql_fields: [],
			sql_groupby: [],
		});

		assert.strictEqual(clause.sql, ' OFFSET 4 ROWS FETCH NEXT 3 ROWS ONLY');
		assert.deepStrictEqual(clause.values, []);
	});

	it('should format sql_expression_literal values for mssql', () => {
		assert.strictEqual(dare.sql_expression_literal(null), 'NULL');
		assert.strictEqual(dare.sql_expression_literal(true), '1');
		assert.strictEqual(dare.sql_expression_literal(false), '0');
		assert.strictEqual(dare.sql_expression_literal(42), '42');
	});

	it('should provide sql_json_extract using JSON_VALUE', () => {
		const expression = dare.sql_json_extract({
			sql_field: raw('a.meta'),
			path: '$.flag',
		});

		assert.strictEqual(expression.sql, 'JSON_VALUE(a.meta, ?)');
		assert.deepStrictEqual(expression.values, ['$.flag']);
	});

	it('should return empty onDuplicateKeysUpdate clause', () => {
		assert.strictEqual(dare.onDuplicateKeysUpdate(), '');
	});

	it('should return an always-false condition for empty fulltext input', () => {
		const result = dare.fulltextSearch([raw('a.username')], '   ', empty);

		assert.strictEqual(result.sql, '(1 = 0)');
		assert.deepStrictEqual(result.values, []);
	});

	it('should strip mysql fulltext operators in fulltextSignParser', () => {
		assert.strictEqual(dare.fulltextSignParser('+><~word'), 'word');
	});

	it('should normalize JSON formatted values for arrays and scalars', () => {
		assert.deepStrictEqual(dare.jsonFormatValue([true, 3, null]), [
			'true',
			'3',
			null,
		]);
		assert.strictEqual(dare.jsonFormatValue(null), null);
		assert.strictEqual(dare.jsonFormatValue(undefined), null);
		assert.strictEqual(dare.jsonFormatValue(false), 'false');
	});

	it('should return an empty limit clause when neither limit nor start is provided', () => {
		const clause = dare.sql_limit_clause({
			limit: undefined,
			start: undefined,
			sql_orderby: [],
			sql_alias: 'a',
			sql_fields: [],
			sql_groupby: [],
		});

		assert.strictEqual(clause.sql, '');
		assert.deepStrictEqual(clause.values, []);
	});
});
