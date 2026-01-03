import assert from 'node:assert/strict';

import defaultAPI from './helpers/api.js';

describe('post from query', () => {
	let dare;

	beforeEach(() => {
		dare = defaultAPI();
	});

	it('should perform an INSERT...SELECT operation', async () => {
		// Get country_id
		const {country_id} = await dare.get('country', [{country_id: 'id'}], {
			code: 'UK',
		});

		// Setup
		const [team] = await Promise.all([
			dare.post('teams', {name: 'my team'}),
			dare.post(
				'users',
				['qe1', 'qe2'].map(username => ({username, country_id}))
			),
		]);

		// Run Tests
		const request = {
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
					username: 'qe%',
					country: {
						code: 'UK',
					},
				},
				limit: 1000,
			},
			duplicate_keys: 'ignore',
		};

		const {affectedRows} = await dare.post(request);

		assert.strictEqual(affectedRows, 2, 'Should have inserted 2 records');

		// Run again, expecting no changes
		{
			const {affectedRows} = await dare.post(request);

			// Both should have been ignored - because they cause duplicates however both show 2 affected rows
			assert.strictEqual(
				affectedRows,
				2,
				'Affected 2 rows... not sure why ignored duplicates count here?'
			);
		}
	});
});
