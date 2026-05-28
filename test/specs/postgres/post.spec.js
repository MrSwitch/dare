import assert from 'node:assert';
import Dare from '../../../src/postgres.js';

// Test Generic DB functions
import sqlEqual from '../../lib/sql-equal.js';

import {describe, it, beforeEach} from 'node:test';

const DB_ENGINE = 'postgres:16.3';

describe('postgres - post', () => {
	/** @type {any} */
	let dare;

	beforeEach(() => {
		dare = new Dare({engine: DB_ENGINE});

		// Should not be called...
		dare.execute = () => {
			throw new Error('execute called');
		};
	});

	it(`${DB_ENGINE} should use ON CONFLICT ... UPDATE ...`, async () => {
		dare.execute = async ({sql, values}) => {
			sqlEqual(
				sql,
				'INSERT INTO test ("id", "name") VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET "name"=EXCLUDED."name" RETURNING id'
			);
			assert.deepStrictEqual(values, [1, 'name']);
			return {success: true};
		};

		return dare.post({
			table: 'test',
			body: {id: 1, name: 'name'},
			duplicate_keys_update: ['name'],
		});
	});
	it(`${DB_ENGINE} should use ON CONFLICT DO NOTHING`, async () => {
		dare.execute = async ({sql, values}) => {
			sqlEqual(
				sql,
				'INSERT INTO test ("id", "name") VALUES (?, ?) ON CONFLICT DO NOTHING RETURNING id'
			);
			assert.deepStrictEqual(values, [1, 'name']);
			return {success: true};
		};

		return dare.post({
			table: 'test',
			body: {id: 1, name: 'name'},
			duplicate_keys: 'ignore',
		});
	});
});
