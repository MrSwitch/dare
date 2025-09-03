import {expect} from 'chai';
import SQL from 'sql-template-tag';
import assert from 'node:assert/strict';
import Dare from '../../src/index.js';
/*
 * Format Request
 * Takes a simple request object and explodes it into a more comprehensive object using the schema
 */

import DareError from '../../src/utils/error.js';

describe('format_request', () => {
	let dare;
	const method = 'get';

	beforeEach(() => {
		// Create a new instance
		dare = new Dare();

		// Create an execution instance
		dare = dare.use({
			models: {},
		});
	});

	it('should be defined in instances of Dare', () => {
		expect(dare).to.have.property('format_request');
	});

	it('should require arguments and return a promise', () => {
		const fn = dare.format_request();

		expect(fn).to.have.property('then');

		return expect(fn)
			.to.be.eventually.rejectedWith(DareError)
			.and.have.property('code', DareError.INVALID_REQUEST);
	});

	it('should return a structure with default values', async () => {
		const table = 'modelName';
		const filter = {id: 1};
		const fields = ['name'];

		const actualtable = 'table';

		dare.options.models[table] = {table: actualtable};

		const resp = await dare.format_request({
			table,
			filter,
			fields,
		});

		assert.deepStrictEqual(resp, {
			fields,
			table,
			alias: table,
			name: table,
			state: undefined,
			sql_table: actualtable,
			field_alias_path: '',
			filter,
			sql_alias: 'a',
			sql_joins: [],
			sql_where_conditions: [SQL`a.id = ${1}`],
			limit: 1,
			single: true,
		});
	});

	describe('fields', () => {
		const options = {
			table: 'tbl',
		};

		beforeEach(() => {
			dare.options = {
				models: {
					asset: {
						schema: {tbl_id: ['tbl.id']},
					},
				},
			};
		});

		describe('should accept fields', () => {
			[
				['field'],
				['_field'],
				['asset.field'],
				[{asset: 'field'}],
				{asset: 'field'},
				[{asset: 'DATE(field)'}],
				[{'My Fields - and &*^@:£@$ things...': 'DATE(field)'}],
				[{asset: 'GROUP_CONCAT(DISTINCT field)'}],
				{asset: ['field']},
				{bespoke: 100},
				{bespoke: null},
			].forEach(fields => {
				it(`valid: ${JSON.stringify(fields)}`, async () =>
					dare.format_request({...options, fields}));
			});
		});

		describe('should throw DareError', () => {
			[
				10,
				'string',
				['*'],
				['COUNT(wrong)'],
				[{asset: 'DATE(id'}],
				[{"quote's": 'id'}],
				[{'tablename with spaces and -:*...': ['id']}],
				[{asset: ['DATE(id)']}],
			].forEach(fields => {
				it(`invalid: ${JSON.stringify(fields)}`, () => {
					const test = dare.format_request({...options, fields});

					return expect(test)
						.to.be.eventually.rejectedWith(DareError)
						.and.have.property('code', DareError.INVALID_REFERENCE);
				});
			});
		});

		describe('should generate joins where the field definition contains table names', () => {
			[
				['asset.field'],
				[
					{
						Field: 'asset.field',
					},
				],
				[
					{
						Field: 'COUNT(DISTINCT asset.field)',
					},
				],
			].forEach(fields => {
				it(`where ${JSON.stringify(fields)}`, async () => {
					const req = await dare.format_request({...options, fields});

					expect(req._joins[0]).to.have.property('alias', 'asset');
				});
			});
		});
	});

	describe('limiting', () => {
		const options = {
			table: 'tbl',
			fields: ['id'],
		};

		describe('limit', () => {
			describe('should accept', () => {
				['90', 90, '99', 1, 10_000_001].forEach(limit => {
					it(`valid: ${limit} (${typeof limit})`, async () =>
						dare.format_request({...options, limit}));
				});
			});

			describe('should throw an exception', () => {
				['nonsense', 0, -1, NaN, {}, null].forEach(limit => {
					it(`invalid: ${limit} (${typeof limit})`, () => {
						const test = dare.format_request({...options, limit});

						return expect(test)
							.to.be.eventually.rejectedWith(DareError)
							.and.have.property('code', DareError.INVALID_LIMIT);
					});
				});
			});

			describe('has a configurable max_limit', () => {
				const limit = 20_000;

				it('set dare.max_limit = 20000', async () => {
					// Create another instance
					const _dare = dare.use();

					expect(dare.MAX_LIMIT).to.eql(null);
					expect(_dare.MAX_LIMIT).to.eql(null);

					// Update instance length
					_dare.MAX_LIMIT = limit;
					expect(dare.MAX_LIMIT).to.eql(null);
					expect(_dare.MAX_LIMIT).to.eql(limit);

					return _dare.format_request({...options, limit});
				});

				it('should throw an DareError if limit is above MAX_LIMIT', () => {
					// Update the length
					dare.MAX_LIMIT = limit - 1;

					const test = dare.format_request({...options, limit});

					return expect(test)
						.to.be.eventually.rejectedWith(DareError)
						.and.have.property('code', DareError.INVALID_LIMIT);
				});
			});
		});

		describe('start', () => {
			describe('should accept', () => {
				['90', 90, '99', 1, null].forEach(start => {
					it(`valid: ${start} (${typeof start})`, async () =>
						dare.format_request({...options, start}));
				});
			});

			describe('should ignore', () => {
				['nonsense', -1, NaN, {}].forEach(start => {
					it(`invalid: ${start} (${typeof start})`, () => {
						const test = dare.format_request({...options, start});

						return expect(test)
							.to.be.eventually.rejectedWith(DareError)
							.and.have.property('code', DareError.INVALID_START);
					});
				});
			});
		});
	});

	describe('groupby', () => {
		describe('should accept', () => {
			[
				'table.field',
				'DATE(table.created_time)',
				'EXTRACT(YEAR_MONTH FROM table.created_time)',
			].forEach(groupby => {
				it(`valid: ${groupby} (${typeof groupby})`, async () => {
					const resp = await dare.format_request({
						table: 'table',
						fields: ['id'],
						groupby,
					});

					expect(resp.groupby).to.eql([groupby]);
				});
			});
		});

		describe('should throw an DareError, when:', () => {
			[-1, 101, {}, 'parenthisis(snap', '; ', 'SUM(SE-LECT 1)'].forEach(
				groupby => {
					it(`invalid: ${groupby} (${typeof groupby})`, () => {
						const test = dare.format_request({
							table: 'table',
							fields: ['id'],
							groupby,
						});

						return expect(test)
							.to.be.eventually.rejectedWith(DareError)
							.and.have.property(
								'code',
								DareError.INVALID_REFERENCE
							);
					});
				}
			);
		});

		describe('should ignore falsy values:', () => {
			[NaN, null, 0, undefined].forEach(groupby => {
				it(`ignores: ${groupby} (${typeof groupby})`, async () =>
					dare.format_request({
						table: 'table',
						fields: ['id'],
						groupby,
					}));
			});
		});
	});

	describe('orderby', () => {
		describe('should accept', () => {
			[
				'field',
				'field ASC',
				'DATE(created_time)',
				'DATE(created_time) DESC',
				'DATE(created_time) DESC, name ASC',
				'DATE(table.created_time) DESC, table.name ASC',
				['name ASC'],
				['table.name ASC'],
				['DATE(created_time) DESC', 'name ASC'],
				['DATE(table.created_time) DESC', 'table.name ASC'],
			].forEach(orderby => {
				it(`valid: ${orderby} (${typeof orderby})`, async () =>
					dare.format_request({
						table: 'table',
						fields: ['id'],
						orderby,
					}));
			});
		});

		describe('should throw an DareError', () => {
			[
				-1,
				101,
				{},
				'table.field WEST',
				['name', 1],
				['name ASC', 'id WEST'],
			].forEach(orderby => {
				it(`invalid: ${orderby} (${typeof orderby})`, () => {
					const test = dare.format_request({
						table: 'table',
						fields: ['id'],
						orderby,
					});

					return expect(test)
						.to.be.eventually.rejectedWith(DareError)
						.and.have.property('code', DareError.INVALID_REFERENCE);
				});
			});
		});

		describe('should ignore falsy values:', () => {
			[NaN, null, 0, undefined].forEach(orderby => {
				it(`ignores: ${orderby} (${typeof orderby})`, async () =>
					dare.format_request({
						table: 'table',
						fields: ['id'],
						orderby,
					}));
			});
		});
	});

	['filter', 'join'].forEach(condition_type => {
		describe(condition_type, () => {
			const table = 'table';

			const noCondOperators = {
				// Disable conditional operator interpretation from the value
				conditional_operators_in_value: '',
			};

			beforeEach(() => {
				dare = dare.use({
					models: {
						[table]: {
							schema: {
								datetime: {
									type: 'datetime',
								},
								date: {
									type: 'date',
								},
							},
						},
					},
				});
			});

			describe('should prep conditions', () => {
				const a = [
					[{prop: 'string'}, 'a.prop = ?', ['string']],
					[
						{'-prop': 'string'},
						'(a.prop != ? OR a.prop IS NULL)',
						['string'],
					],
					[{prop: '%string'}, 'a.prop LIKE ?', ['%string']],
					[
						{prop: '%string'},
						'a.prop = ?',
						['%string'],
						noCondOperators,
					],
					[{prop: '!string'}, 'a.prop NOT LIKE ?', ['string']],
					[
						{prop: '!string'},
						'a.prop = ?',
						['!string'],
						noCondOperators,
					],
					[{prop: '!patt%rn'}, 'a.prop NOT LIKE ?', ['patt%rn']],
					[{'%prop': 'string%'}, 'a.prop LIKE ?', ['string%']],
					[{'-prop': 'patt%rn'}, 'a.prop NOT LIKE ?', ['patt%rn']],
					[
						{'-prop': 'patt%rn'},
						'(a.prop != ? OR a.prop IS NULL)',
						['patt%rn'],
						noCondOperators,
					],
					[{prop: [1, 2, 3]}, 'a.prop IN (?,?,?)', [1, 2, 3]],
					[
						{'-prop': [1, 2, 3]},
						'(a.prop NOT IN (?,?,?) OR a.prop IS NULL)',
						[1, 2, 3],
					],
					[{prop: [1]}, 'a.prop IN (?)', [1]],
					[
						{'-prop': [1]},
						'(a.prop NOT IN (?) OR a.prop IS NULL)',
						[1],
					],
					[
						{prop: [1, null, 2]},
						'(a.prop IN (?,?) OR a.prop IS NULL)',
						[1, 2],
					],
					[
						{'-prop': [1, null, 2]},
						'(a.prop NOT IN (?,?) AND a.prop IS NOT NULL)',
						[1, 2],
					],
					[
						{prop: [1, 2, null, 'test%', 'test2%']},
						'(a.prop IN (?,?) OR a.prop IS NULL OR a.prop LIKE ? OR a.prop LIKE ?)',
						[1, 2, 'test%', 'test2%'],
					],
					[
						{prop: [1, 2, null, 'test%', 'test2%']},
						'(a.prop IN (?,?,?,?) OR a.prop IS NULL)',
						[1, 2, 'test%', 'test2%'],
						noCondOperators,
					],
					[
						// Use a likey prop indicator to expand on the query
						{'%prop': [1, 2, null, 'test%', 'test2%']},
						'(a.prop IN (?,?) OR a.prop IS NULL OR a.prop LIKE ? OR a.prop LIKE ?)',
						[1, 2, 'test%', 'test2%'],
						noCondOperators,
					],
					[
						{'-prop': [1, 2, null, 'test%', 'test2%']},
						'(a.prop NOT IN (?,?) AND a.prop IS NOT NULL AND a.prop NOT LIKE ? AND a.prop NOT LIKE ?)',
						[1, 2, 'test%', 'test2%'],
					],
					[{prop: [null]}, 'a.prop IS NULL', []],
					[{'-prop': [null]}, 'a.prop IS NOT NULL', []],
					[{prop: []}, 'a.prop AND ?', [false]],
					[{'-prop': []}, 'a.prop AND ?', [true]],
					[{prop: null}, 'a.prop IS NULL', []],
					[{'-prop': null}, 'a.prop IS NOT NULL', []],
					[
						{'-datetime': '1981-12-05..'},
						'(NOT a.datetime > ? OR a.datetime IS NULL)',
						['1981-12-05T00:00:00'],
					],
					[
						// Should always expand datetime fields
						{datetime: '1981-12-05..1981-12-06'},
						'a.datetime BETWEEN ? AND ?',
						['1981-12-05T00:00:00', '1981-12-06T23:59:59'],
						noCondOperators,
					],
					[{prop: '1981-12-05..'}, 'a.prop > ?', ['1981-12-05']],
					[
						{prop: '1970-01-01..1981-12-05'},
						'a.prop BETWEEN ? AND ?',
						['1970-01-01', '1981-12-05'],
					],
					[
						{prop: '1981-12-05..'},
						'a.prop = ?',
						['1981-12-05..'],
						noCondOperators,
					],
					[
						{'~prop': ['a', 'b']},
						'a.prop BETWEEN ? AND ?',
						['a', 'b'],
					],
					[{'~prop': ['a', null]}, 'a.prop > ?', ['a']],
					[
						// Should ignore $ (suffixing) keys
						{prop$asdasd: null},
						'a.prop IS NULL',
						[],
					],
				];

				a.forEach(async test => {
					const [filter, sql, values, options] = test;

					// Clone filter
					const filter_cloned = JSON.parse(JSON.stringify(filter));

					it(`should transform condition ${JSON.stringify(
						filter
					)} -> ${JSON.stringify(sql)}`, async () => {
						if (options) {
							dare = dare.use(options);
						}

						const resp = await dare.format_request({
							table,
							fields: ['id'],
							[condition_type]: filter,
						});

						const query = resp.sql_where_conditions[0];

						expect(query.sql).to.equal(sql);
						expect(query.values).to.deep.equal(values);

						// Should not mutate the filters...
						expect(filter).to.deep.eql(filter_cloned);
					});
				});
			});

			describe('should throw DareError', () => {
				[
					true,
					10,
					'string',
					{
						'id OR 1': '1',
					},
					{
						'DATE(field)': '1',
					},
					{
						asset: {
							'id OR 1': '1',
						},
					},
				].forEach(filter => {
					it(`invalid: ${JSON.stringify(filter)}`, () => {
						const test = dare.format_request({
							table: 'activityEvents',
							fields: ['id'],
							[condition_type]: filter,
						});

						return expect(test)
							.to.be.eventually.rejectedWith(DareError)
							.and.have.property(
								'code',
								DareError.INVALID_REFERENCE
							);
					});
				});
			});

			describe('field type=datetime', () => {
				const o = {
					'1981-12-05': [
						'a.datetime BETWEEN ? AND ?',
						['1981-12-05T00:00:00', '1981-12-05T23:59:59'],
					],
					'1981-1-5': [
						'a.datetime BETWEEN ? AND ?',
						['1981-01-05T00:00:00', '1981-01-05T23:59:59'],
					],
					'1981-12-05..1981-12-06': [
						'a.datetime BETWEEN ? AND ?',
						['1981-12-05T00:00:00', '1981-12-06T23:59:59'],
					],
					'1981-12-05..': ['a.datetime > ?', ['1981-12-05T00:00:00']],
					'..1981-12-05': ['a.datetime < ?', ['1981-12-05T00:00:00']],
					'1981-12': [
						'a.datetime BETWEEN ? AND ?',
						['1981-12-01T00:00:00', '1981-12-31T23:59:59'],
					],
					'1981-1': [
						'a.datetime BETWEEN ? AND ?',
						['1981-01-01T00:00:00', '1981-01-31T23:59:59'],
					],
					2016: [
						'a.datetime BETWEEN ? AND ?',
						['2016-01-01T00:00:00', '2016-12-31T23:59:59'],
					],
				};

				for (const datetime in o) {
					const [sql, values] = o[datetime];

					it(`should augment filter values ${datetime}`, async () => {
						const resp = await dare.format_request({
							table,
							fields: ['id'],
							[condition_type]: {
								datetime,
							},
						});

						const query = resp.sql_where_conditions[0];

						expect(query.sql).to.equal(sql);
						expect(query.values).to.deep.equal(values);
					});
				}
			});

			describe('field type=date', () => {
				const o = [
					[new Date('1981-12-05'), 'a.date = ?', ['1981-12-05']],
				];

				o.forEach(([date, sql, values]) => {
					it(`should augment filter values ${date}`, async () => {
						const resp = await dare.format_request({
							table,
							fields: ['id'],
							[condition_type]: {
								date,
							},
						});

						const query = resp.sql_where_conditions[0];

						expect(query.sql).to.equal(sql);
						expect(query.values).to.deep.equal(values);
					});
				});
			});
		});
	});

	describe('scheme', () => {
		it('should throw an DareError when there are two tables with an undefined relationship', () => {
			// Redefine the structure
			dare.options = {
				models: {
					asset: {
						schema: {name: {}},
					},
					comments: {
						schema: {name: {}},
					},
				},
			};

			// The table country has no relationship with assets
			const test = dare.format_request({
				table: 'asset',
				fields: [
					'name',
					{
						comments: ['name'],
					},
				],
			});

			return expect(test)
				.to.be.eventually.rejectedWith(
					DareError,
					"Could not understand field 'comments'"
				)
				.and.have.property('code', DareError.INVALID_REFERENCE);
		});

		it('should understand options.schema which defines table structure which reference other tables.', async () => {
			// Redefine the structure
			dare.options = {
				models: {
					asset: {
						schema: {name: {}},
					},
					comments: {
						schema: {
							name: {},
							asset_id: {
								references: 'asset.id',
							},
						},
					},
				},
			};

			// The table country has no relationship with assets
			return dare.format_request({
				table: 'asset',
				fields: [
					'name',
					{
						comments: ['name'],
					},
				],
			});
		});

		it('should understand multiple References, and pick the appropriate one.', async () => {
			// Redefine the structure
			dare.options = {
				models: {
					asset: {
						schema: {name: {}},
					},
					assetType: {
						// References can be as simple as a string to another [table].[field]
						schema: {asset_id: ['asset.id']},
					},
					comments: {
						schema: {
							name: {},
							asset_id: {
								// There can also be multiple references to connect more than one table on this key...
								references: ['asset.id', 'assetType.asset_id'],
							},
						},
					},
				},
			};

			// The table country has no relationship with assets
			return dare.format_request({
				table: 'comments',
				fields: [
					'name',
					{
						asset: ['name'],
					},
					{
						assetType: ['name'],
					},
				],
			});
		});

		it('should allow simple descriptions of deep links', async () => {
			// Here the schema is a series of tables a street, belongs to 1 town and in return 1 country
			dare.options = {
				models: {
					street: {
						// References can be as simple as a string to another [table].[field]
						schema: {town_id: ['town.id']},
					},
					town: {
						schema: {country_id: ['country.id']},
					},
					country: {},
				},
			};

			/*
			 * If we just wanted the street name and country
			 * The app should understand the relationship between street and country
			 * and join up the town automatically in the SQL
			 */
			return dare.format_request({
				table: 'street',
				fields: [
					'name',
					{
						country: ['name'],
					},
				],
			});
		});
	});

	describe('method table handlers', () => {
		it('should pass through exceptions raised in the method handlers', async () => {
			const msg = 'snap';
			dare.options.method = method;
			dare.options.models = {
				users: {
					get() {
						throw Error(msg);
					},
				},
			};

			const test = dare.format_request({
				method,
				table: 'users',
				fields: ['name'],
			});

			return expect(test).to.be.eventually.rejectedWith(Error, msg);
		});

		it('should pass through the table scoped request', async () => {
			dare.options.method = method;
			dare.options.models = {
				users: {
					get(options) {
						// Add something to the filter...
						options.filter = {
							is_deleted: false,
						};
					},
				},
			};

			const options = await dare.format_request({
				method,
				table: 'users',
				fields: ['name'],
			});

			expect(options.filter).to.eql({is_deleted: false});
		});

		it('should append parent and state through the table scoped request', async () => {
			const removed = {removed: false};

			/**
			 * An arbitary state object
			 */
			const state = {
				member_id: 1,
				auth: {
					role: 'admin',
				},
			};

			// Set the method
			dare.options.method = method;
			dare.options.state = state;
			dare.options.models = {
				users: {
					schema: {},
					get(options) {
						// Add a filter to users to only show user who haven't been removed
						options.filter = removed;
					},
				},
				comments: {
					schema: {
						// Join definition to users model
						user_id: ['users.id'],
					},
					get(options) {
						/*
						 * We show comments if the user hasn't been deleted
						 * But if the parent table is users this sould be superfluous
						 * So let's check the parent table name...
						 */
						if (
							!options.parent ||
							options.parent.table !== 'users'
						) {
							// Enforce join on the User,
							options.filter = {
								users: removed,
							};
						}
					},
				},
			};

			/*
			 * Test 1
			 * Enforcing user table join
			 */
			const comments = await dare.format_request({
				method,
				table: 'comments',
				fields: ['name'],
			});

			expect(comments.filter).to.eql({users: removed});
			assert.strictEqual(comments.state, state);

			// Check the joins include the state too
			assert.strictEqual(comments._joins.at(0).state, state);

			/*
			 * Test 2
			 * Adding comments
			 */
			const users = await dare.format_request({
				method,
				table: 'users',
				fields: [
					{
						comments: ['name'],
					},
				],
			});

			const commentsJoin = users._joins[0];

			expect(commentsJoin).to.not.have.property('filter');
		});

		it('should allow nested children to assign filters', async () => {
			const removed = {removed: false};

			dare.options.method = method;
			dare.options.models = {
				users: {
					schema: {},
					get(options) {
						// Add a filter to users to only show user who haven't been removed
						options.filter = removed;
					},
				},
				comments: {
					schema: {
						// Join definition to users model
						user_id: ['users.id'],
					},
				},
			};

			/**
			 * Run a setup whereby we call `users` tree from within the `comments` tree, but with no `users` filter
			 */
			const comments = await dare.format_request({
				method,
				table: 'comments',
				fields: ['name', {users: ['name']}],
			});

			/**
			 * Test that `has_filter` and `filter` have been assigned to the `users` tree
			 */
			assert.strictEqual(comments._joins.at(0).has_filter, true);
			assert.deepStrictEqual(comments._joins.at(0).filter, removed);
		});

		it('should await the response from a promise', () => {
			const msg = 'snap';
			dare.options.method = method;
			dare.options.models = {
				users: {
					get() {
						return new Promise((resolve, reject) => {
							setTimeout(() => reject(new Error(msg)));
						});
					},
				},
			};

			const test = dare.format_request({
				method,
				table: 'users',
				fields: ['name'],
			});

			return expect(test).to.be.eventually.rejectedWith(Error, msg);
		});

		it('should provide the instance of dare in the request', () => {
			let dareInstance;
			let that;

			dare.options.method = method;
			dare.options.models = {
				users: {
					get(options, _dareInstance) {
						dareInstance = _dareInstance;
						that = this;
					},
				},
			};

			dare.format_request({
				method,
				table: 'users',
				fields: ['name'],
			});

			expect(dareInstance).to.equal(dare);
			expect(that).to.equal(dare);
		});
	});
});
