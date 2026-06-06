import MySQL57Dare from '../../../src/mysql57.js';

// Test Generic DB functions
import expectSQLEqual from '../../lib/sql-equal.js';
import {describe, it, beforeEach} from 'node:test';

// Dare instance
let dare;

// Create a schema
const options = {
	models: {
		// Define Datasets
		assets: {},
		collections: {},

		// Define a table to associate datasets
		assetCollections: {
			schema: {
				asset_id: ['assets.id'],
				collection_id: ['collections.id'],
			},
		},

		// Collection children
		collectionChildren: {
			schema: {
				collection_id: ['collections.id'],
			},
		},
	},
};

describe('get - subquery', () => {
	beforeEach(() => {
		dare = new MySQL57Dare({...options, engine: 'mysql:5.7.0'});
	});

	it('MySQL 5.* does not support CTE', async () => {
		const dareInst = dare.use();

		dareInst.sql = ({sql}) => {
			const expected = `
                SELECT a.id,
                (
                    SELECT b.email
                    FROM userEmails b
                    WHERE
                        b.user_id = a.id
                    LIMIT 1
                ) AS "email"
                FROM users a
                GROUP BY a._rowid
                LIMIT 1`;

			expectSQLEqual(sql, expected);

			return Promise.resolve([{}]);
		};

		dareInst.options = {
			models: {
				userEmails: {
					schema: {user_id: ['users.id']},
				},
			},
		};

		return dareInst.get({
			table: 'users',
			fields: [
				'id',
				{
					email: 'userEmails.email',
				},
			],
		});
	});
});
