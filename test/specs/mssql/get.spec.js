import Dare from '../../../src/mssql.js';

// Test Generic DB functions
import sqlEqual from '../../lib/sql-equal.js';
import {describe, it, beforeEach} from 'node:test';

const DB_ENGINE = 'mssql:2022';

describe('mssql - get', () => {
	/** @type {any} */
	let dare;

	beforeEach(() => {
		dare = new Dare({engine: DB_ENGINE});
	});

	it(`${DB_ENGINE} should use OFFSET ... FETCH and inject a no-op ORDER BY when limit is set without ordering`, async () => {
		dare.execute = async ({sql}) => {
			sqlEqual(
				sql,
				`SELECT a.id, a.username
				FROM users a
				ORDER BY a.id
				OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY`
			);
			return [];
		};

		return dare.get({
			table: 'users',
			fields: ['id', 'username'],
			limit: 5,
		});
	});

	it(`${DB_ENGINE} should use the existing ORDER BY with OFFSET ... FETCH`, async () => {
		dare.execute = async ({sql}) => {
			sqlEqual(
				sql,
				`SELECT a.id
				FROM users a
				WHERE a.id = ?
				ORDER BY a.username
				OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY`
			);
			return [{id: 2}];
		};

		return dare.get({
			table: 'users',
			fields: ['id'],
			filter: {id: 2},
			limit: 10,
			start: 20,
			orderby: 'username',
		});
	});
});
