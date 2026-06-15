import assert from 'node:assert/strict';

import {DareError} from '../../src/index.js';
import defaultAPI from './helpers/api.js';

describe('dare.patch', () => {
	let dare;

	beforeEach(() => {
		dare = defaultAPI();
	});

	it('should update a single record by id', async () => {
		const username = 'patchUser';
		const newName = 'patchedUser';

		const {insertId} = await dare.post('users', {username});

		const resp = await dare.patch(
			'users',
			{id: insertId},
			{username: newName}
		);

		assert.strictEqual(resp.affectedRows, 1);

		const result = await dare.get('users', ['username'], {id: insertId});
		assert.strictEqual(result.username, newName);
	});

	it('should update multiple records with a limit', async () => {
		const body = ['patchA', 'patchB', 'patchC'].map(username => ({
			username,
		}));
		await dare.post('users', body);

		const resp = await dare.patch({
			table: 'users',
			filter: {username: 'patch%'},
			body: {first_name: 'updated'},
			limit: 100,
		});

		assert.strictEqual(resp.affectedRows, 3);
	});

	it('should throw NOT_FOUND when no records match', async () => {
		await assert.rejects(
			dare.patch('users', {id: -999}, {username: 'nope'}),
			error =>
				error instanceof DareError && error.code === DareError.NOT_FOUND
		);
	});

	it('should return notfound value when no records match and notfound option is set', async () => {
		const notfound = null;

		const resp = await dare.patch(
			'users',
			{id: -999},
			{username: 'nope'},
			{notfound}
		);

		assert.strictEqual(resp, notfound);
	});

	it('should support object-style request', async () => {
		const username = 'objStylePatch';
		const {insertId} = await dare.post('users', {username});

		const resp = await dare.patch({
			table: 'users',
			filter: {id: insertId},
			body: {username: 'objPatched'},
		});

		assert.strictEqual(resp.affectedRows, 1);

		const result = await dare.get('users', ['username'], {id: insertId});
		assert.strictEqual(result.username, 'objPatched');
	});

	it('should patch with a cross-table filter', async () => {
		const code = 'PX';
		const {insertId: country_id} = await dare.post('country', {code});

		const {insertId} = await dare.post('users', {
			username: 'crossPatch',
			country_id,
		});

		const resp = await dare.patch({
			table: 'users',
			filter: {
				id: insertId,
				country: {code},
			},
			body: {username: 'crossPatched'},
		});

		assert.strictEqual(resp.affectedRows, 1);

		const result = await dare.get('users', ['username'], {id: insertId});
		assert.strictEqual(result.username, 'crossPatched');
	});

	it('should set a field to null', async () => {
		const {insertId} = await dare.post('users', {
			username: 'nullTest',
			first_name: 'hasValue',
		});

		await dare.patch('users', {id: insertId}, {first_name: null});

		const result = await dare.get('users', ['first_name'], {id: insertId});
		assert.strictEqual(result.first_name, null);
	});

	it('should trigger model patch handler', async () => {
		const {insertId} = await dare.post('users', {username: 'handlerTest'});

		dare = dare.use({
			models: {
				users: {
					patch(options) {
						options.body.first_name = 'injected';
					},
				},
			},
		});

		await dare.patch('users', {id: insertId}, {username: 'handlerPatched'});

		const result = await dare.get('users', ['username', 'first_name'], {
			id: insertId,
		});
		assert.strictEqual(result.username, 'handlerPatched');
		assert.strictEqual(result.first_name, 'injected');
	});
});
