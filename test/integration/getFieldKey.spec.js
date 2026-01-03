import Dare from '../../src/index.js';
import Debug from 'debug';
import assert from 'node:assert/strict';

import mysql from 'mysql2/promise';
import db from './helpers/db.js';
import {options} from './helpers/api.js';
const debug = Debug('sql');

// Connect to db

describe(`getFieldKey`, () => {
	let dare;

	beforeEach(() => {
		// Initiate
		dare = new Dare(options);

		// Set a test instance

		dare.execute = query => {
			// DEBUG
			debug(mysql.format(query.sql, query.values));

			return db.query(query);
		};
	});

	it('should be able to define a getFieldKey to deconstruct camelCase', async () => {
		function getFieldKey(field, schema) {
			// Normal
			if (field in schema) {
				return field;
			}
			// Convert camelCase to snake_case
			const snakeCase = field.replaceAll(
				/[A-Z]+/g,
				(m, index) => `${index > 0 ? '_' : ''}${m.toLowerCase()}`
			);
			if (snakeCase in schema) {
				return snakeCase;
			}

			return field;
		}

		// Overwrite get field definitiion
		dare = dare.use({
			getFieldKey,
		});

		const username = 'A Name';
		let firstName = 'A';
		const lastName = 'Name';

		// Post using camelCase
		await dare.post('users', {username, firstName, lastName});

		{
			// Test: changes were made
			const resp = await dare.get(
				'users',
				['firstName'],
				{lastName},
				{orderby: 'firstName'}
			);

			assert.equal(resp.firstName, firstName);
		}

		// Post using camelCase
		firstName = 'B';
		await dare.patch('users', {lastName}, {firstName});

		{
			// Test: changes were made
			const resp = await dare.get(
				'users',
				['firstName'],
				{lastName},
				{orderby: 'firstName'}
			);

			assert.equal(resp.firstName, firstName);
		}
	});
});
