import {DareError} from '../../src/index.js';
import assert from 'node:assert/strict';

import defaultAPI, {options, castToStringIfNeeded} from './helpers/api.js';
import db from './helpers/db.js';

// Connect to db

describe(`Dare init tests: options ${Object.keys(options)}`, () => {
	let dare;

	beforeEach(() => {
		// Initiate
		dare = defaultAPI();
	});

	it('Can insert and retrieve results ', async () => {
		const username = 'A Name';
		await dare.post('users', {username});

		const resp = await dare.get('users', ['username']);

		assert.equal(resp.username, username);
	});

	it('can use pagination to get more results', async () => {
		const username = 'A Name';
		const body = Array(10)
			.fill(0)
			.map((_, index) => ({username: `${username}-${index}`}));
		await dare.post('users', body);

		const limit = 3;
		for (let page = 0; page < 5; page++) {
			const start = page * limit;
			// eslint-disable-next-line no-await-in-loop
			const pageResponse = await dare.get(
				'users',
				['username'],
				{},
				{limit, start}
			);
			assert.deepStrictEqual(
				pageResponse,
				body.slice(start, start + limit)
			);
		}
	});

	it('Can update results', async () => {
		const username = 'A Name';
		const newName = 'New name';
		const {insertId} = await dare.post('users', {username});
		await dare.patch('users', {id: insertId}, {username: newName});

		const resp = await dare.get('users', ['username']);

		assert.equal(resp.username, newName);
	});

	it('can delete results', async () => {
		const username = 'A Name';
		const {insertId} = await dare.post('users', {username});

		await dare.del('users', {id: insertId});

		await assert.rejects(
			dare.get('users', ['username'], {id: insertId}),
			error => error instanceof DareError && error.code === DareError.NOT_FOUND
		);
	});

	it('Can update results with INSERT...ON DUPLICATE KEYS UPDATE', async () => {
		const username = 'A Name';
		const newName = 'New name';
		const {insertId} = await dare.post('users', {username});
		await dare.post(
			'users',
			{id: insertId, username: newName},
			{
				duplicate_keys_update: ['username'],
			}
		);

		const resp = await dare.get('users', ['username']);

		assert.equal(resp.username, newName);
	});

	it('should be able to return nested values', async () => {
		const teamName = 'A Team';

		// Create users, team and add the two
		const [user, team] = await Promise.all([
			// Create user
			dare.post('users', {username: 'user123'}),

			// Create team
			dare.post('teams', {name: teamName}),
		]);

		// Add to the pivot table
		await dare.post('userTeams', {
			user_id: user.insertId,
			team_id: team.insertId,
		});

		{
			// Same Structure
			const resp = await dare.get({
				table: 'users',
				fields: [
					{
						userTeams: {
							teams: ['id', 'description', 'name'],
						},
					},
				],
			});

			assert.deepStrictEqual(resp.userTeams[0].teams, {
				id: castToStringIfNeeded(team.insertId),
				name: teamName,
				description: castToStringIfNeeded(null),
			});
		}

		{
			// Same Structure, team join is nulled
			const resp = await dare.get({
				table: 'users',
				fields: [
					{
						userTeams: {
							teams: ['id', 'name', 'description'],
						},
					},
				],
				join: {
					userTeams: {
						teams: {
							name: 'not-available',
						},
					},
				},
			});

			// UserTeams should be an empty array
			assert.deepStrictEqual(resp, {
				userTeams: [],
			});
		}

		{
			// Remap Structure
			const resp = await dare.get({
				table: 'users',
				fields: [
					{
						id: 'userTeams.teams.id',
						name: 'userTeams.teams.name',
						description: 'userTeams.teams.description',
					},
				],
			});

			assert.deepStrictEqual(resp, {
				id: castToStringIfNeeded(team.insertId),
				name: teamName,
				description: castToStringIfNeeded(null),
			});
		}

		{
			// Remap Structure
			const resp = await dare.get({
				table: 'users',
				fields: [
					{
						id: 'userTeams.teams.id',
						name: 'userTeams.teams.name',
						description: 'userTeams.teams.description',
					},
				],
				join: {
					// When there are no results we get an empty value
					userTeams: {id: -1},
				},
			});

			assert.deepStrictEqual(resp, {});
		}
	});

	it('Can search via fulltext', async () => {
		const username = 'name@example.com';
		await dare.post('users', [
			{
				username,
				first_name: "First Old'n'Name",
				last_name: 'Last-Name',
			},
		]);

		// Search across multiple fields
		{
			const resp = await dare.get('users', ['username'], {
				'*username,first_name,last_name': '+Fir* +Las*',
			});
			assert.equal(resp.username, username);
		}

		// And use an alias of the fulltext field
		{
			dare.options.models.users.schema.textsearch =
				'username,first_name,last_name';

			const resp = await dare.get('users', ['username'], {
				'*textsearch': 'Fir* Las*',
			});
			assert.equal(resp.username, username);
		}

		// And format the search to be compatible with MySQL Fulltext syntax

		// Emails
		{
			const resp = await dare.get('users', ['username'], {
				'*textsearch': username,
			});
			assert.equal(resp.username, username);
		}

		// Hyphens
		{
			const resp = await dare.get('users', ['username'], {
				'*textsearch': '+last-name',
			});
			assert.equal(resp.username, username);
		}

		// Apostrophe's
		{
			const resp = await dare.get('users', ['username'], {
				'*textsearch': "+Old'n'Name",
			});
			assert.equal(resp.username, username);
		}

		// Full Text on Generated Fields
		if (!process.env.DB_ENGINE?.startsWith('mysql:5.6')) {
			dare.options.models.users.schema.ft_index = {
				readable: true,
				writeable: false,
			};

			if (process.env.DB_ENGINE?.startsWith('mariadb')) {
				await db.query(`
					ALTER TABLE users ADD COLUMN ft_index TEXT GENERATED ALWAYS AS (CONCAT_WS(username, first_name, last_name)) STORED;
					ALTER TABLE users ADD FULLTEXT KEY users_ft_index (ft_index);
				`);
			}

			{
				const resp = await dare.get('users', ['username'], {
					'*ft_index': '+Old*n*',
				});
				assert.equal(resp.username, username);
			}
		}
	});

	it('NULL-safe negate equality operator', async () => {
		const username = 'name@example.com';
		await dare.post('users', [
			{
				username,
				first_name: "First Old'n'Name",
				last_name: null,
			},
		]);

		// Should be able to return null values in a negated search
		{
			const resp = await dare.get('users', ['username'], {
				'-last_name': 'Last-Name',
			});

			assert.deepStrictEqual(resp, {username});
		}

		// Should be able to return null values in a negated search
		{
			const resp = await dare.get('users', ['username'], {
				'-last_name': ['Last-Name'],
			});

			assert.deepStrictEqual(resp, {username});
		}

		// Should be able to exclude null values in a negated search
		{
			const resp = await dare.get(
				'users',
				['username'],
				{
					'-last_name': ['Last-Name', null],
				},
				{
					notfound: {},
				}
			);

			assert.deepStrictEqual(resp, {});
		}
	});

	it('Return a truthy value for existance if no fields are provided', async () => {
		const username = 'A Name';
		await dare.post('users', {username});

		// Get request with no parameters
		const resp = await dare.get('users');

		assert.ok(resp);
	});
});
