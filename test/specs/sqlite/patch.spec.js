import assert from 'node:assert';
import Dare from '../../../src/sqlite.js';

// Test Generic DB functions
import sqlEqual from '../../lib/sql-equal.js';

import {describe, it, beforeEach} from 'node:test';

const id = 1;
const name = 'name';

describe('SQLite - patch', () => {
	/** @type {any} */
	let dare;

	beforeEach(() => {
		dare = new Dare();

		// Should not be called...
		dare.execute = () => {
			throw new Error('execute called');
		};
	});

	it(`should use the correct syntax for sqlite`, async () => {
		const dareInst = dare.use({engine: 'sqlite:3'});

		dareInst.execute = async ({sql, values}) => {
			sqlEqual(sql, 'UPDATE tbl SET "name" = ? WHERE tbl.id = ?');
			assert.deepStrictEqual(values, [name, id]);
			return {success: true};
		};

		return dareInst.patch({
			table: 'tbl',
			filter: {id},
			body: {name},
		});
	});
});
