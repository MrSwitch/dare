import assert from 'node:assert';
import Dare from '../../src/index.js';

// Test Generic DB functions
import sqlEqual from '../lib/sql-equal.js';

// Create a schema
import options from '../data/options.js';
import {describe, it, beforeEach} from 'node:test';

describe('get - datatypes', () => {
	let dare;

	beforeEach(() => {
		dare = new Dare(options);
		dare.execute = () => {
			throw new Error('Should not execute');
		};
	});

	it('should return `created_time` using DATE_FORMAT', async () => {
		const created_time = '2019-09-03T12:00:00Z';

		dare.execute = async ({sql, values}) => {
			const expected = `
				SELECT DATE_FORMAT(a.created_time,'%Y-%m-%dT%TZ') AS "created_time"
				FROM users a
				LIMIT 1
			`;

			sqlEqual(sql, expected);
			assert.deepStrictEqual(values, []);

			return [{created_time}];
		};

		const resp = await dare.get({
			table: 'users',
			fields: ['created_time'],
		});

		assert.strictEqual(resp.created_time, created_time);
	});

	describe('type=json', () => {
		it('should JSON parse an string as object if type=json', async () => {
			const settings = {param: 1};
			const metaString = JSON.stringify(settings);

			dare.execute = async ({sql, values}) => {
				const expected = `
					SELECT a.settings
					FROM users a
					LIMIT 1
				`;

				sqlEqual(sql, expected);
				assert.deepStrictEqual(values, []);

				return [{settings: metaString}];
			};

			const resp = await dare.get({
				table: 'users',
				fields: ['settings'],
			});

			assert('settings' in resp);
			assert.deepStrictEqual(resp.settings, settings);
		});

		it('should JSON parse a nested field with object if type=json', async () => {
			const settings = {param: 1};
			const metaString = JSON.stringify(settings);

			dare.execute = async ({sql, values}) => {
				const expected = `
					SELECT b.settings AS "users.settings"
					FROM users_email a
					LEFT JOIN users b ON (b.id = a.user_id)
					LIMIT 1
				`;

				sqlEqual(sql, expected);
				assert.deepStrictEqual(values, []);

				return [{users: {settings: metaString}}];
			};

			const resp = await dare.get({
				table: 'users_email',
				fields: [
					{
						users: ['settings'],
					},
				],
			});

			assert('users' in resp);
			assert('settings' in resp.users);
			assert.deepStrictEqual(resp.users.settings, settings);
		});

		it('should return an empty object if response value is falsy', async () => {
			dare.execute = async ({sql, values}) => {
				const expected = `
					SELECT a.settings
					FROM users a
					LIMIT 1
				`;

				sqlEqual(sql, expected);
				assert.deepStrictEqual(values, []);

				return [{meta: null}];
			};

			const resp = await dare.get({
				table: 'users',
				fields: ['settings'],
			});

			assert('settings' in resp);
			assert.deepStrictEqual(resp.settings, {});
		});
	});

	describe('type=function', () => {
		it('should construct a generated function, which can be labelled', async () => {
			const id = 123;

			dare.execute = async ({sql, values}) => {
				const expected = `
					SELECT b.id AS "users.id"
					FROM users_email a
					LEFT JOIN users b ON (b.id = a.user_id)
					LIMIT 1
				`;

				sqlEqual(sql, expected);
				assert.deepStrictEqual(values, []);

				return [{users: {id}}];
			};

			const resp = await dare.get({
				table: 'users_email',
				fields: [
					{
						users: [
							{
								URL: 'url',
							},
						],
					},
				],
			});

			assert('users' in resp);
			assert.strictEqual(resp.users.URL, `/user/${id}`);
		});
	});
});
