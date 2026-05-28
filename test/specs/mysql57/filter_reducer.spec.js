import assert from 'node:assert';
import MySQL57Dare from '../../../src/mysql57.js';

/*
 * Filter Reducer
 * Extract the filter conditions from the given conditions
 */

import reduceConditions from '../../../src/format/reducer_conditions.js';
import {describe, it, beforeEach} from 'node:test';
import options from '../../data/options.js';

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
		dareInstance = new MySQL57Dare({options, engine: 'mysql:5.7.0'});
		table_schema = {
			textsearch: 'givenname,lastname,email',
			jsonSettings: {
				type: 'json',
			},
			// Join with an arbitrary table
			a_id: 'a.id',
		};
	});
	['mysql:5.7'].forEach(engine => {
		const quote = engine === 'mysql:5.7';

		it(`${engine} should ${quote ? '' : 'NOT '}quote json list (IN) sting values`, () => {
			const dareInst = dareInstance.use({engine});

			const filter = {
				jsonSettings: {
					key: ['a', 'b', 1],
				},
			};

			const expectedValues = quote ? ['"a"', '"b"', 1] : ['a', 'b', 1];

			const sql = `(a.jsonSettings->? IN (?,?,?))`;
			const values = ['$.key', ...expectedValues];

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
	});
});
