import assert from 'node:assert/strict';

import defaultAPI from './helpers/api.js';

describe('Multi table modifications', () => {
	let dare;

	beforeEach(() => {
		dare = defaultAPI();
	});

	it('should be able to patch and delete records based on a cross table join', async () => {
		const teamName = 'my team';
		const country_code = 'UK';

		const {insertId: country_id} = await dare.post('country', {
			code: country_code,
		});

		/*
		 * Setup
		 * Users and teams
		 */
		const [team, users] = await Promise.all([
			dare.post('teams', {name: teamName}),
			dare.post(
				'users',
				['qe1', 'qe2'].map(username => ({username, country_id}))
			),
		]);

		const {insertId} = await dare.post({
			table: 'userTeams',
			body: sequence(users).map(user_id => ({
				team_id: team.insertId,
				user_id,
			})),
		});

		{
			/*
			 * Test: Rename a user by their membership to a team
			 */
			const {affectedRows} = await dare.patch({
				table: 'users',
				body: {
					username: '123',
				},
				filter: {
					userTeams: {
						teams: {
							name: teamName,
						},
						id: insertId,
					},
					country: {
						code: country_code,
					},
					// Just checking the SQL syntax produced from a negate operator
					'-userTeams': {
						teams: {
							name: 'unknown team name',
						},
					},
				},
			});

			assert.strictEqual(
				affectedRows,
				1,
				'Should have affected 1 record'
			);
		}

		{
			/*
			 * Test: Delete based on a condition from another table
			 * In this case delete userTeams entries based upon the team name which isn't the user 123
			 */
			const {affectedRows} = await dare.del({
				table: 'userTeams',
				filter: {
					teams: {
						name: teamName,
					},
					'-users': {
						username: '123',
					},
				},
			});

			assert.strictEqual(
				affectedRows,
				1,
				'Should have affected 1 records'
			);

			// Validate that the one remiaining is our edited user
			const count = await dare.getCount('userTeams', {
				users: {username: '123'},
			});

			assert.strictEqual(count, 1, 'Should still have our user1');
		}

		{
			/*
			 * Test: Insert back into the table entries which do not exist in userTeams
			 */
			const {affectedRows} = await dare.post({
				table: 'userTeams',
				query: {
					table: 'users',
					fields: [
						{
							user_id: 'id',
							team_id: team.insertId,
						},
					],
					filter: {
						// Effectively insert if it's not already there... an alternative to ON DUPLICATE KEY UPDATE _rowid=_rowid
						'-userTeams': {
							teams: {
								id: team.insertId,
							},
						},
					},
				},
			});

			assert.strictEqual(
				affectedRows,
				1,
				'Should have affected 1 records'
			);
		}
	});

	it('patch operations should use the get handler for nested model conditions', async () => {
		const code = 'UK';

		/*
		 * Setup
		 * Create a user in each country
		 */
		const countries = await dare.get('country', ['id'], {}, {limit: 100});

		const users = await dare.post(
			'users',
			['test1', 'test2'].map((username, index) => ({
				username,
				country_id: countries[index].id,
			}))
		);

		const user_ids = sequence(users);

		{
			// Pre-test, ensure model change is
			const resp = await dare.patch({
				table: 'users',
				body: {
					first_name: 'Old name',
				},
				filter: {
					id: user_ids,
				},
				limit: 100,
			});

			assert.strictEqual(
				resp.affectedRows,
				2,
				'Should affect both users'
			);
		}

		// Extend dare model with the handlers
		dare = dare.use({
			models: {
				users: {
					patch(options) {
						// Ensure this joins to country
						options.join = {
							country: {
								// Required will ensure it's added
								_required: true,
							},
						};
					},
				},
				country: {
					get(options) {
						options.filter = {code};
					},
					patch() {
						throw Error('teams can not be mutated');
					},
				},
			},
		});

		// Try updating all the users...
		const resp = await dare.patch({
			table: 'users',
			body: {
				first_name: 'New name',
			},
			filter: {
				id: user_ids,
			},
			limit: 100,
		});

		assert.strictEqual(resp.affectedRows, 1, 'Should only affect 1 row');
	});
});

/**
 * Sequence
 * Creates an Array with a sequence of values
 * @param {object} obj - Obj
 * @param {number} obj.affectedRows - Length
 * @param {number} obj.insertId - Start value
 * @returns {Array<number>} An Array of numbers
 */
export function sequence({affectedRows: len, insertId: start}) {
	const a = [];
	for (let i = 0; i < len; i++) {
		a.push(i + start);
	}
	return a;
}
