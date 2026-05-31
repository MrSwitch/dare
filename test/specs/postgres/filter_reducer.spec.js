import assert from 'node:assert';
import Dare from '../../../src/postgres.js';

/*
 * Filter Reducer
 * Extract the filter conditions from the given conditions
 */

import reduceConditions from '../../../src/format/reducer_conditions.js';
import {describe, it, beforeEach} from 'node:test';

const engine = 'postgres:16.3';

describe('Filter Reducer', () => {
	let dareInstance;
	const conditional_operators_in_value = null;
	let table_schema = null;
	// eslint-disable-next-line func-style
	const extract = () => {
		// Do nothing
	};

	// Mock instance of Dare
	beforeEach(() => {
		dareInstance = new Dare();
		table_schema = {
			textsearch: 'givenname,lastname,email',
			jsonSettings: {
				type: 'json',
			},
			// Join with an arbitrary table
			a_id: 'a.id',
		};
	});

	it('should search fulltext - with an index', async () => {
		const dareInst = dareInstance.use({engine});

		const filter = {
			'*vector_index': 'string',
		};

		const sql = `a.vector_index @@ to_tsquery('english', ?)`;
		const values = ['string'];

		const [query] = reduceConditions(filter, {
			extract,
			sql_alias: 'a',
			table_schema,
			conditional_operators_in_value,
			dareInstance: dareInst,
		});

		assert.strictEqual(query.sql, sql);
		assert.deepStrictEqual(query.values, values);
	});

	it('should search fulltext - and build an index', async () => {
		const dareInst = dareInstance.use({engine});

		const filter = {
			'*givenname,lastname,email': 'string',
		};

		const sql = `TO_TSVECTOR(a.givenname || ' ' || a.lastname || ' ' || a.email) @@ to_tsquery('english', ?)`;
		const values = ['string'];

		const [query] = reduceConditions(filter, {
			extract,
			sql_alias: 'a',
			table_schema,
			conditional_operators_in_value,
			dareInstance: dareInst,
		});

		assert.strictEqual(query.sql, sql);
		assert.deepStrictEqual(query.values, values);
	});

	it(`quote json number and boolean values`, () => {
		const dareInst = dareInstance.use({engine});

		const filter = {
			jsonSettings: {
				key: 1,
				'%str': 'string%',
				digit: [2, 3],
			},
		};

		const [query] = reduceConditions(filter, {
			extract,
			sql_alias: 'a',
			table_schema,
			conditional_operators_in_value,
			dareInstance: dareInst,
		});

		const sql = `(a.jsonSettings->>? = ? AND a.jsonSettings->>? ILIKE ? AND a.jsonSettings->>? IN (?,?))`;
		const values = ['key', '1', 'str', 'string%', 'digit', '2', '3'];

		assert.strictEqual(query.sql, sql);
		assert.deepStrictEqual(query.values, values);
	});
});
