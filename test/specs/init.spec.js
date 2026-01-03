/**
 * @import {QueryOptions} from '../../src/index.js'
 */

import assert from 'node:assert';
import {describe, it, beforeEach} from 'node:test';
import Dare, {DareError} from '../../src/index.js';
import clone from 'tricks/object/clone.js';

describe('Dare', () => {
	it('should be a constructor', () => {
		const dare = new Dare();
		assert.strictEqual(dare.constructor, Dare);
	});

	it('should define default options', () => {
		const models = {
			mytable: {},
		};
		const dare = new Dare({
			models,
		});
		assert.strictEqual(dare.options.models, models);
	});

	it('should export the DareError object', () => {
		assert.strictEqual(Dare.DareError, DareError);
	});

	it('should throw errors if dare.execute is not defined', async () => {
		const dare = new Dare();

		const test = dare.sql('SELECT 1=1');

		await assert.rejects(
			test,
			DareError,
			'Define dare.execute to continue'
		);
	});

	it('execute should be able to call addRow', async () => {
		const dare = new Dare();

		dare.execute = async function () {
			this.addRow({name: 'Jupiter'});
		};

		const resp = await dare.get({
			table: 'test',
			fields: ['name'],
		});

		assert.strictEqual(resp.name, 'Jupiter');
	});

	describe('dare.use to extend the instance', () => {
		let dare;

		/**
		 * @type {QueryOptions}
		 */
		let options;

		beforeEach(() => {
			options = {
				models: {
					users: {
						schema: {
							name: {
								type: 'string',
							},
						},
					},
				},
			};

			// Create a normal instance
			dare = new Dare(options);
		});

		it('should define dare.use to create an instance from another', () => {
			// Create another instance with some alternative options
			const dareChild = dare.use({
				limit: 100,
			});

			// Check the child assigned new values
			assert.strictEqual(dareChild.options.limit, 100);

			// Check the child retains parent properties
			assert.ok('models' in dareChild.options);
			assert.strictEqual(dareChild.execute, dare.execute);

			// Check the parent was not affected by the child configuration
			assert.ok(!('limit' in dare.options));
		});

		it('should inherit but not leak when extending schema', () => {
			const options2 = {
				models: {
					users: {
						schema: {
							name: {
								writable: false,
							},
						},
					},
					different: {
						schema: {fields: true},
					},
				},
			};

			const options_cloned = clone(options);

			const options2_cloned = clone(options2);

			const dare2 = dare.use(options2);

			// Should not share same objects as instance it extended
			assert.notStrictEqual(dare.options.models.users, dare2.options.models.users);

			// Should not mutate instance it extended
			 
			assert.strictEqual(dare.options.models.different, undefined);

			assert.notStrictEqual(dare.options.models.users.schema.name.writable, dare2.options.models.users.schema.name.writable);

			// Should merge settings for field definitiions... e.g.
			assert.deepStrictEqual(dare2.options.models.users.schema, {
				name: {
					type: 'string',
					writable: false,
				},
			});

			// Should not mutate the inheritted options
			assert.deepStrictEqual(options, options_cloned);

			// Should not mutate the new options input
			assert.deepStrictEqual(options2, options2_cloned);
		});
	});
});
