import assert from 'node:assert';
import Dare from '../../../src/mssql.js';

// Test Generic DB functions
import sqlEqual from '../../lib/sql-equal.js';

import {describe, it, beforeEach} from 'node:test';

const DB_ENGINE = 'mssql:2022';

describe('mssql - post', () => {
	/** @type {any} */
	let dare;

	beforeEach(() => {
		dare = new Dare({engine: DB_ENGINE});

		// Should not be called...
		dare.execute = () => {
			throw new Error('execute called');
		};
	});

	it(`${DB_ENGINE} should wrap identifiers in brackets and use OUTPUT INSERTED.id`, async () => {
		dare.execute = async ({sql, values}) => {
			sqlEqual(
				sql,
				'INSERT INTO test ([id],[name]) OUTPUT INSERTED.id VALUES (?, ?)'
			);
			assert.deepStrictEqual(values, [1, 'name']);
			return {insertId: 1};
		};

		return dare.post({
			table: 'test',
			body: {id: 1, name: 'name'},
		});
	});

	it(`${DB_ENGINE} should support duplicate_keys_update through MSSQL-specific compatibility handling`, async () => {
		dare.get = async () => ({id: 1});
		dare.patch = async () => ({affectedRows: 1});

		const resp = await dare.post({
			table: 'test',
			body: {id: 1, name: 'new-name'},
			duplicate_keys: ['id'],
			duplicate_keys_update: ['name'],
		});

		assert.deepStrictEqual(resp, {insertId: 1, affectedRows: 1});
	});
});
