import assert from 'node:assert';
import {empty, raw} from 'sql-template-tag';
import Dare from '../../../src/mssql.js';
import {describe, it, beforeEach} from 'node:test';

describe('mssql - fulltext', () => {
	/** @type {any} */
	let dare;

	beforeEach(() => {
		dare = new Dare({engine: 'mssql:2022'});
	});

	it('should fall back to a LIKE search across the provided fields', () => {
		const result = dare.fulltextSearch(
			[raw('a.username'), raw('a.first_name')],
			'john',
			empty
		);

		assert.strictEqual(
			result.sql,
			'((a.username LIKE ? OR a.first_name LIKE ?))'
		);
		assert.deepStrictEqual(result.values, ['%john%', '%john%']);
	});

	it('should strip MySQL boolean operators from the search term', () => {
		const result = dare.fulltextSearch(
			[raw('a.username')],
			'+john*',
			empty
		);

		assert.strictEqual(result.sql, '((a.username LIKE ?))');
		assert.deepStrictEqual(result.values, ['%john%']);
	});

	it('should negate the search when a NOT operator is supplied', () => {
		const result = dare.fulltextSearch(
			[raw('a.username')],
			'john',
			raw('NOT ')
		);

		assert.strictEqual(result.sql, 'NOT ((a.username LIKE ?))');
		assert.deepStrictEqual(result.values, ['%john%']);
	});
});
