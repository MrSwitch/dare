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

	it(`${DB_ENGINE} should disable inline upsert syntax`, async () => {
		assert.strictEqual(dare.supportsInlineUpsert, false);
	});

	it(`${DB_ENGINE} should support duplicate_keys=ignore through MSSQL-specific compatibility handling`, async () => {
		let getCalled = 0;

		dare.get = async () => {
			getCalled += 1;
			return {id: 1};
		};

		dare.patch = async () => {
			throw new Error(
				'patch should not be called for duplicate_keys=ignore'
			);
		};

		const resp = await dare.post({
			table: 'test',
			body: {id: 1, name: 'same-name'},
			duplicate_keys: 'ignore',
		});

		assert.strictEqual(getCalled, 1);
		assert.deepStrictEqual(resp, {insertId: 1, affectedRows: 0});
	});

	it(`${DB_ENGINE} should insert when duplicate lookup misses`, async () => {
		let getCalled = 0;

		dare.get = async () => {
			getCalled += 1;
			return undefined;
		};

		dare.execute = async ({sql, values}) => {
			sqlEqual(
				sql,
				'INSERT INTO test ([id],[name]) OUTPUT INSERTED.id VALUES (?, ?)'
			);
			assert.deepStrictEqual(values, [2, 'new-name']);
			return {insertId: 2, affectedRows: 1};
		};

		const resp = await dare.post({
			table: 'test',
			body: {id: 2, name: 'new-name'},
			duplicate_keys: ['id'],
			duplicate_keys_update: ['name'],
		});

		assert.strictEqual(getCalled, 1);
		assert.deepStrictEqual(resp, {insertId: 2, affectedRows: 1});
	});

	it(`${DB_ENGINE} should treat duplicate_keys=[] as no duplicate filter and insert`, async () => {
		let getCalled = 0;

		dare.get = async () => {
			getCalled += 1;
			return {id: 3};
		};

		dare.execute = async ({sql, values}) => {
			sqlEqual(
				sql,
				'INSERT INTO test ([id],[name]) OUTPUT INSERTED.id VALUES (?, ?)'
			);
			assert.deepStrictEqual(values, [3, 'inserted']);
			return {insertId: 3, affectedRows: 1};
		};

		const resp = await dare.post({
			table: 'test',
			body: {id: 3, name: 'inserted'},
			duplicate_keys: [],
			duplicate_keys_update: ['name'],
		});

		assert.strictEqual(getCalled, 0);
		assert.deepStrictEqual(resp, {insertId: 3, affectedRows: 1});
	});

	it(`${DB_ENGINE} should resolve duplicate key values through schema aliases`, async () => {
		dare.options.models = {
			test: {
				schema: {
					externalId: 'id',
				},
			},
		};

		dare.get = async (_table, _fields, filter) => {
			assert.deepStrictEqual(filter, {id: 11});
			return {id: 11};
		};

		dare.patch = async (_table, filter, body) => {
			assert.deepStrictEqual(filter, {id: 11});
			assert.deepStrictEqual(body, {name: 'updated'});
			return {affectedRows: 1};
		};

		const resp = await dare.post({
			table: 'test',
			body: {externalId: 11, name: 'updated'},
			duplicate_keys: ['id'],
			duplicate_keys_update: ['name'],
		});

		assert.deepStrictEqual(resp, {insertId: 11, affectedRows: 1});
	});

	it(`${DB_ENGINE} should resolve duplicate key values from unaliased row properties`, async () => {
		dare.options.models = {
			test: {
				schema: {
					externalId: 'id',
				},
			},
		};

		dare.get = async (_table, _fields, filter) => {
			assert.deepStrictEqual(filter, {externalId: 15});
			return {id: 15};
		};

		dare.patch = async () => ({affectedRows: 1});

		const resp = await dare.post({
			table: 'test',
			body: {id: 15, name: 'updated-via-unaliased-input'},
			duplicate_keys: ['externalId'],
			duplicate_keys_update: ['name'],
		});

		assert.deepStrictEqual(resp, {insertId: 15, affectedRows: 1});
	});

	it(`${DB_ENGINE} should insert when duplicate key field value is missing from body`, async () => {
		let getCalled = 0;

		dare.get = async () => {
			getCalled += 1;
			return {id: 12};
		};

		dare.execute = async ({sql, values}) => {
			sqlEqual(
				sql,
				'INSERT INTO test ([id],[name]) OUTPUT INSERTED.id VALUES (?, ?)'
			);
			assert.deepStrictEqual(values, [12, 'from-missing-key-case']);
			return {insertId: 12, affectedRows: 1};
		};

		const resp = await dare.post({
			table: 'test',
			body: {id: 12, name: 'from-missing-key-case'},
			duplicate_keys: ['email'],
			duplicate_keys_update: ['name'],
		});

		assert.strictEqual(getCalled, 0);
		assert.deepStrictEqual(resp, {insertId: 12, affectedRows: 1});
	});
});
