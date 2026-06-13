import assert from 'node:assert';
import Dare from '../../../src/sqlite.js';

import reduceConditions from '../../../src/format/reducer_conditions.js';
import {describe, it, beforeEach} from 'node:test';

const engine = 'sqlite:3';

describe('SQLite - Filter Reducer', () => {
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
			jsonSettings: {
				type: 'json',
			},
			// Join with an arbitrary table
			a_id: 'a.id',
		};
	});

	it('should use FTS5 MATCH for fulltext search', async () => {
		const dareInst = dareInstance.use({engine});

		table_schema = {
			textsearch: 'first_name,last_name',
		};

		const filter = {
			'*textsearch': 'hello',
		};

		const [query] = reduceConditions(filter, {
			extract,
			sql_alias: 'a',
			sql_table: 'users',
			table_schema,
			conditional_operators_in_value,
			dareInstance: dareInst,
		});

		// SQLite fulltext uses FTS5 MATCH
		assert.ok(query.sql.includes('MATCH'));
		assert.ok(query.sql.includes('users_fts'));
	});

	it('should handle JSON fields with -> operator', async () => {
		const dareInst = dareInstance.use({engine});

		const filter = {
			'jsonSettings.key': 'value',
		};

		const [query] = reduceConditions(filter, {
			extract,
			sql_alias: 'a',
            sql_table: 'users',
			table_schema,
			conditional_operators_in_value,
			dareInstance: dareInst,
		});

		assert.ok(query.sql.includes('->'));
	});
});
