import assert from 'node:assert';
import Dare from '../../src/index.js';
import DareError from '../../src/utils/error.js';
import {describe, it, beforeEach} from 'node:test';

// Create a schema

describe('field alias', () => {
	let dare;
	const limit = 5;

	beforeEach(() => {
		dare = new Dare({
			models: {
				users: {
					schema: {
						// Alias 'email' with 'emailAddress'
						emailAddress: 'email',

						// Alias SQL `!ISNULL(email)` to `hasEmail` property
						hasEmail: '!ISNULL(email)',
					},
				},
				comments: {
					schema: {
						user_id: ['users.id'],
					},
				},
			},
		});
	});

	describe('get - SELECT', () => {
		it('should map field aliases defined in the schema into SELECT requests Fields and Filters', async () => {
			let _sql = '';

			// Stub the execute function
			dare.sql = ({sql}) => {
				_sql = sql;
				return [];
			};

			await dare.get({
				table: 'users',
				fields: [
					// Straight Alias

					// Return the field using an alias name
					'emailAddress',

					// Return it by another alias
					{
						field: 'emailAddress',
					},

					// Support a Function
					{
						emailaddress: 'LOWER(emailAddress)',
					},

					// Alias with SQL

					// Should return using alias name,
					'hasEmail',

					// Return by another alias
					{
						alternateHasEmail: 'hasEmail',
					},

					// Support a Function
					{
						yesNoEmail: 'IF(hasEmail, "YES", "NO")',
					},

					// Should not map a reference, even though it has a similar string structure
					'country_id',
				],
				filter: {
					// Filter the results using the aliased name as the key
					emailAddress: 'andrew%',

					// Filter the results using the aliased function
					hasEmail: true,

					// Should not map a reference, even though it has a similar string structure
					country_id: 1,
				},
				join: {
					// Should equally apply the alias mapping to joins
					'-emailAddress': null,

					// Filter the results using the aliased function
					'-hasEmail': true,

					// Should not map a reference, even though it has a similar string structure
					'-country_id': null,
				},
				limit,
			});

			// Field alias
			assert.ok(_sql.includes('email AS "emailAddress"'));
			assert.ok(_sql.includes('email AS "field"'));
			assert.ok(_sql.includes('LOWER(a.email) AS "emailaddress"'));

			// Field SQL Alias
			assert.ok(_sql.includes('!ISNULL(a.email) AS "hasEmail"'));
			assert.ok(_sql.includes('!ISNULL(a.email) AS "alternateHasEmail"'));
			assert(_sql.includes(
				'IF(!ISNULL(a.email), "YES", "NO") AS "yesNoEmail"'
			));

			// Standard
			assert.ok(_sql.includes(',a.country_id'));

			// Filter
			assert.ok(_sql.includes('email LIKE ?'));
			assert.ok(_sql.includes('!ISNULL(a.email) = ?'));
			assert.ok(_sql.includes('country_id = ?'));

			// Join
			assert.ok(_sql.includes('email IS NOT NULL'));
			assert.ok(_sql.includes('!ISNULL(a.email) != ?'));
			assert.ok(_sql.includes('country_id IS NOT NULL'));
		});

		it('cross table alias referencing', async () => {
			let _sql = '';

			// Stub the execute function
			dare.sql = ({sql}) => {
				_sql = sql;
				return [];
			};

			await dare.get({
				table: 'comments',
				fields: [
					// Label the field by it's name
					{
						'Email Field': 'users.email',
					},
					// Label the field by an alias name
					{
						'Email Alias': 'users.emailAddress',
					},
					// Label a field definition using alias name
					{
						email_field: 'LOWER(users.email)',
					},
					// Label a field definition using alias name
					{
						email_alias: 'LOWER(users.emailAddress)',
					},
					// Label a field SQL definition using alias name
					{
						'Has Email alias': 'IF(users.hasEmail, "Yes", "No")',
					},
				],
				filter: {
					// Filter the results using the aliased name as the key
					users: {
						emailAddress: 'andrew%',

						// Has Email
						hasEmail: true,

						// Should not map a reference, even though it has a similar string structure
						country_id: 1,
					},
				},
				join: {
					users: {
						// Should equally apply the alias mapping to joins
						'-emailAddress': null,

						// Should not map a reference, even though it has a similar string structure
						'-country_id': null,
					},
				},
				limit,
			});

			assert.ok(_sql.includes('email AS "Email Field"'));
			assert.ok(_sql.includes('email AS "Email Alias"'));
			assert.ok(_sql.includes('LOWER(b.email) AS "email_field"'));
			assert.ok(_sql.includes('LOWER(b.email) AS "email_alias"'));

			assert(_sql.includes(
				'IF(!ISNULL(b.email), "Yes", "No") AS "Has Email alias"'
			));

			assert.ok(_sql.includes('email LIKE ?'));
			assert.ok(_sql.includes('!ISNULL(b.email) = ?'));
			assert.ok(_sql.includes('country_id = ?'));
			assert.ok(_sql.includes('email IS NOT NULL'));
			assert.ok(_sql.includes('country_id IS NOT NULL'));
		});
	});

	describe('patch - UPDATE', () => {
		it('should map field aliases defined in the schema into UPDATE filters', async () => {
			let _sql = '';

			// Stub the execute function
			dare.sql = ({sql}) => {
				_sql = sql;
				return [];
			};

			await dare.patch({
				table: 'users',
				body: {
					// Should map this to `email`
					emailAddress: 'andrew@example.com',

					// Should not change this, aka map this to `country_id``
					country_id: 1,
				},
				filter: {
					// Filter the results using the aliased name as the key
					emailAddress: 'andrew%',

					// Has Email, SQL Alias
					hasEmail: true,
				},
			});

			assert.ok(_sql.includes('`email` = ?'));
			assert.ok(_sql.includes('`country_id` = ?'));
			assert.ok(_sql.includes('email LIKE ?'));
			assert.ok(_sql.includes('!ISNULL(a.email) = ?'));
		});

		it('should throw an error trying to patch a SQL Alias', async () => {
			const patch = dare.patch({
				table: 'users',
				body: {
					// Should map this to `email`
					hasEmail: true,
				},
				filter: {
					id: 123,
				},
			});

			await assert.rejects(patch, (error) => {
				assert(error instanceof DareError);
				assert.strictEqual(error.code, DareError.INVALID_REQUEST);
				return true;
			});
		});
	});

	describe('del - DELETE', () => {
		it('should map field aliases defined in the schema into DELETE filters', async () => {
			let _sql = '';

			// Stub the execute function
			dare.sql = ({sql}) => {
				_sql = sql;
				return [];
			};

			await dare.del({
				table: 'users',
				filter: {
					// Filter the results using the aliased name as the key
					emailAddress: 'andrew%',

					// Has Email, SQL Alias
					hasEmail: true,

					// Should not map a reference, even though it has a similar string structure
					country_id: 1,
				},
			});

			assert.ok(_sql.includes('users.email LIKE ?'));
			assert.ok(_sql.includes('!ISNULL(users.email) = ?'));
			assert.ok(_sql.includes('users.country_id = ?'));
		});
	});

	describe('post - INSERT', () => {
		it('should map field aliases defined in the schema into INSERT body', async () => {
			let _sql = '';

			// Stub the execute function
			dare.sql = ({sql}) => {
				_sql = sql;
				return [];
			};

			await dare.post({
				table: 'users',
				body: [
					{
						// Should map this to `email`
						emailAddress: 'andrew@example.com',

						// Should leave this unchanged and map to country_id
						country_id: 1,
					},
				],
				duplicate_keys_update: ['emailAddress', 'country_id'],
			});

			assert.ok(_sql.includes('(`email`,`country_id`)'));

			// ON DUPLICATE KEY UPDATE
			assert.ok(_sql.includes('`email`=VALUES(`email`)'));
			assert.ok(_sql.includes('`country_id`=VALUES(`country_id`)'));
		});

		it('should throw an error trying to post to a SQL Alias field', async () => {
			const post = dare.post({
				table: 'users',
				body: {
					// Should map this to `email`
					hasEmail: true,
				},
			});

			await assert.rejects(post, (error) => {
				assert(error instanceof DareError);
				assert.strictEqual(error.code, DareError.INVALID_REQUEST);
				return true;
			});
		});
	});
});
