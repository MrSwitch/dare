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

	it('should use ORDER BY (SELECT NULL) for aggregate-only fields without GROUP BY', () => {
		const clause = dare.sql_limit_clause({
			limit: 2,
			start: 0,
			sql_orderby: [],
			sql_alias: 'a',
			sql_fields: ['COUNT(*)'],
			sql_groupby: [],
		});

		assert.strictEqual(
			clause.sql,
			'ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 2 ROWS ONLY'
		);
		assert.deepStrictEqual(clause.values, []);
	});

	it('should use ORDER BY (SELECT NULL) when sql_alias is missing', () => {
		const clause = dare.sql_limit_clause({
			limit: 2,
			start: 1,
			sql_orderby: [],
			sql_alias: '',
			sql_fields: [],
			sql_groupby: [],
		});

		assert.strictEqual(
			clause.sql,
			'ORDER BY (SELECT NULL) OFFSET 1 ROWS FETCH NEXT 2 ROWS ONLY'
		);
		assert.deepStrictEqual(clause.values, []);
	});

	it('should detect aggregate fields from expression and sql properties', () => {
		const fromExpression = dare.sql_limit_clause({
			limit: 1,
			start: 0,
			sql_orderby: [null],
			sql_alias: 'a',
			sql_fields: [{expression: 'SUM(a.score)'}],
			sql_groupby: [],
		});

		assert.strictEqual(
			fromExpression.sql,
			'ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY'
		);

		const fromSql = dare.sql_limit_clause({
			limit: 1,
			start: 0,
			sql_orderby: [undefined],
			sql_alias: 'a',
			sql_fields: [{sql: 'MAX(a.score)'}],
			sql_groupby: [],
		});

		assert.strictEqual(
			fromSql.sql,
			'ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY'
		);
	});

	it('should fall back to rowid ordering when non-aggregate field metadata is empty', () => {
		const clause = dare.sql_limit_clause({
			limit: undefined,
			start: 5,
			sql_orderby: [0],
			sql_alias: 'a',
			sql_fields: [{}],
			sql_groupby: [],
		});

		assert.strictEqual(clause.sql, 'ORDER BY a.id OFFSET 5 ROWS ');
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
