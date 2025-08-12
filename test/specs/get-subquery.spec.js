import {expect} from 'chai';
import Dare from '../../src/index.js';

// Test Generic DB functions
import expectSQLEqual from '../lib/sql-equal.js';

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
		dare = new Dare(options);
	});

	it('should write one to many requests with a subquery', async () => {
		dare.sql = ({sql}) => {
			const expected = `
				WITH cte AS (SELECT a.id FROM assets a LIMIT 1)
				SELECT a.name AS "asset_name",
				(
					SELECT COUNT(c.id)
					FROM assetCollections b
					LEFT JOIN collections c ON (c.id = b.collection_id)
					WHERE b.asset_id = a.id
				) AS "collection_count"
				FROM assets a
				JOIN cte ON (cte.id = a._rowid)
				GROUP BY a._rowid
				LIMIT 1

			`;

			expectSQLEqual(sql, expected);

			return Promise.resolve([
				{
					asset_name: 'name',
					collection_count: 42,
				},
			]);
		};

		const resp = await dare.get({
			table: 'assets',
			fields: {
				asset_name: 'name',
				collection_count: 'COUNT(collections.id)',
			},
		});

		expect(resp).to.have.property('asset_name', 'name');
		expect(resp).to.have.property('collection_count', 42);
	});

	it('should export the response in the format given', async () => {
		dare.sql = ({sql}) => {
			const expected = `
				WITH cte AS (SELECT a.id FROM assets a LIMIT 1)
				SELECT a.name AS "asset_name",
				(
					SELECT COUNT(c.id)
					FROM assetCollections b
					LEFT JOIN collections c ON (c.id = b.collection_id)
					WHERE b.asset_id = a.id
				) AS "collections.count"
				FROM assets a
				JOIN cte ON (cte.id = a._rowid)
				GROUP BY a._rowid
				LIMIT 1

			`;

			expectSQLEqual(sql, expected);

			return Promise.resolve([
				{
					asset_name: 'name',
					'collections.count': 42,
				},
			]);
		};

		const resp = await dare.get({
			table: 'assets',
			fields: {
				asset_name: 'name',
				collections: [
					{
						count: 'COUNT(id)',
					},
				],
			},
		});

		expect(resp.collections).to.have.property('count', 42);
	});

	it('should concatinate many expressions into an array using JSON_ARRAYAGG', async () => {
		dare.sql = ({sql}) => {
			const expected = `
				WITH cte AS (SELECT a.id FROM assets a LIMIT 1)
				SELECT a.name AS "name",
				(
					SELECT JSON_ARRAYAGG(CASE WHEN(c._rowid IS NOT NULL) THEN (JSON_ARRAY(c.id, c.name)) ELSE NULL END)
					FROM assetCollections b
					LEFT JOIN collections c ON (c.id = b.collection_id)
					WHERE b.asset_id = a.id
					LIMIT 1
				) AS "collections[id,name]"
				FROM assets a
				JOIN cte ON (cte.id = a._rowid)
				GROUP BY a._rowid
				LIMIT 1

			`;
			expectSQLEqual(sql, expected);

			return Promise.resolve([
				{
					asset_name: 'name',
					'collections[id,name]': '[["1","a"],["2","b"]]',
				},
			]);
		};

		const resp = await dare.get({
			table: 'assets',
			fields: {
				name: 'name',
				collections: ['id', 'name'],
			},
		});

		expect(resp.collections).to.be.an('array');
		expect(resp.collections[0]).to.have.property('id', '1');
		expect(resp.collections[0]).to.have.property('name', 'a');
	});

	it('should concatinate many expressions into an array using JSON_ARRAYAGG', async () => {
		dare.sql = ({sql}) => {
			const expected = `
				WITH cte AS (SELECT a.id FROM assets a LIMIT 1)
				SELECT a.name AS "name",
				(
					SELECT JSON_ARRAYAGG(CASE WHEN (b._rowid IS NOT NULL) THEN (JSON_ARRAY(b.id, b.color)) ELSE NULL END)
					FROM assetCollections b
					WHERE b.color = ? AND b.asset_id = a.id
					LIMIT 1
				) AS "assetCollections[id,color]"
				FROM assets a
				JOIN cte ON (cte.id = a._rowid)
				GROUP BY a._rowid
				LIMIT 1

			`;
			expectSQLEqual(sql, expected);

			return Promise.resolve([
				{
					asset_name: 'name',
					'assetCollections[id,color]': '[["1","red"],["2","blue"]]',
				},
			]);
		};

		const resp = await dare.get({
			table: 'assets',
			fields: {
				name: 'name',
				assetCollections: ['id', 'color'],
			},
			join: {
				assetCollections: {
					color: 'red',
				},
			},
		});

		expect(resp.assetCollections).to.be.an('array');
		expect(resp.assetCollections[0]).to.have.property('id', '1');
		expect(resp.assetCollections[0]).to.have.property('color', 'red');
	});

	it('should *not* subquery a nested object without fields', async () => {
		dare.sql = ({sql}) => {
			const expected = `

				SELECT a.name AS "name"
				FROM assets a
				LIMIT 1

			`;
			expectSQLEqual(sql, expected);

			return Promise.resolve([
				{
					asset_name: 'name',
				},
			]);
		};

		const resp = await dare.get({
			table: 'assets',
			fields: {
				name: 'name',
			},
			join: {
				collections: {
					name: 'a',
				},
			},
		});

		expect(resp).to.have.property('asset_name', 'name');
	});

	it('should *not* use a subquery when the many table is used in the filter', async () => {
		dare.sql = ({sql}) => {
			const expected = `
				SELECT a.name AS "name",
					JSON_ARRAYAGG(CASE WHEN(c._rowid IS NOT NULL) THEN (JSON_ARRAY(c.id, c.name)) ELSE NULL END) AS "collections[id,name]"
				FROM assets a
				LEFT JOIN assetCollections b ON(b.asset_id = a.id)
				LEFT JOIN collections c ON (c.id = b.collection_id)
				WHERE c.name = ?
				GROUP BY a._rowid
				LIMIT 1
			`;

			expectSQLEqual(sql, expected);

			return Promise.resolve([{}]);
		};

		return dare.get({
			table: 'assets',
			fields: {
				name: 'name',
				collections: ['id', 'name'],
			},
			filter: {
				collections: {
					name: 'myCollection',
				},
			},
		});
	});

	it('should *not* subquery a table off a join with a possible set of values', async () => {
		dare.sql = ({sql}) => {
			const expected = `
			SELECT a.name AS "name", JSON_ARRAYAGG(CASE WHEN (b._rowid IS NOT NULL) THEN (JSON_ARRAY(COUNT(d.id))) ELSE NULL END) AS "assetCollections[collections.descendents]"
			FROM assets a
				LEFT JOIN assetCollections b ON(b.asset_id = a.id)
				LEFT JOIN collections c ON(c.id = b.collection_id)
				LEFT JOIN collectionChildren d ON(d.collection_id = c.id)
				WHERE b.is_deleted = ?
				GROUP BY a._rowid
				LIMIT 1
			`;

			expectSQLEqual(sql, expected);

			return Promise.resolve([{}]);
		};

		return dare.get({
			table: 'assets',
			fields: {
				name: 'name',
				assetCollections: {
					collections: {
						descendents: 'COUNT(collectionChildren.id)',
					},
				},
			},
			filter: {
				assetCollections: {
					is_deleted: false,
				},
			},
		});
	});

	it('should aggregate single field requests in a subquery, aka without group_concat', async () => {
		dare.sql = ({sql}) => {
			const expected = `
				SELECT a.id,a.name,a.created_time,
				(
					SELECT JSON_ARRAY(b.id, b.email)
					FROM userEmails b
					WHERE
						b.user_id = a.id
					LIMIT 1
				) AS "email_id,email"
				FROM users a
				GROUP BY a.id
				ORDER BY a.name
				LIMIT 1`;

			expectSQLEqual(sql, expected);

			return Promise.resolve([{}]);
		};

		dare.options = {
			models: {
				userEmails: {
					schema: {user_id: ['users.id']},
				},
			},
		};

		return dare.get({
			table: 'users',
			fields: [
				'id',
				'name',
				{
					email_id: 'userEmails.id',
					email: 'userEmails.email',
				},
				'created_time',
			],
			filter: {},
			join: {},
			groupby: 'id',
			orderby: 'name',
		});
	});

	describe('with groupby', () => {
		it('should allow multiple groupby on nested tables', async () => {
			dare.sql = async ({sql}) => {
				expect(sql).to.contain('GROUP BY c.id,a.id');

				return [
					{
						AssetID: 1,
						CollectionID: 2,
						Collection: 'b',
					},
				];
			};

			return dare.get({
				table: 'assets',
				fields: {
					AssetID: 'id',
					CollectionID: 'assetCollections.collections.id',
					Collection: 'assetCollections.collections.name',
				},
				groupby: ['id', 'assetCollections.collections.id'],
			});
		});
	});

	describe(`Disparities`, () => {
		it('MySQL 8 fails to correctly count the items in this scenario', async () => {
			/*
			 * See Bug report: https://bugs.mysql.com/bug.php?id=109585
			 */
			const dareInst = dare.use({engine: 'mysql:8.0.36'});

			dareInst.options.models.userContent = {
				schema: {
					content_id: ['content.id'],
				},
			};

			dareInst.sql = async ({sql}) => {
				expect(sql).to.not.contain('LIMIT 1');
			};

			// Construct a query which counts these
			await dareInst.get({
				table: 'content',
				fields: ['id', {count: 'COUNT(DISTINCT userContent.user_id)'}],
				limit: 3,
			});
		});
	});
});
