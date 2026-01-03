import assert from 'node:assert';
import Dare from '../../src/index.js';
import {describe, it, beforeEach} from 'node:test';

describe('after Handler', () => {
	let dare;

	beforeEach(() => {
		// Create a new instance
		dare = new Dare();

		/*
		 * Create an execution instance
		 * Setup test schema
		 */
		dare = dare.use({
			models: {
				users: {},
				emails: {
					schema: {
						user_id: ['users.id'],
					},
				},
			},
		});
	});

	it('after handler should be defined in instances of Dare', async () => {
		assert.ok('after' in dare);
	});

	describe('should be called after success on api methods', () => {
		beforeEach(() => {
			dare.after = () => 'called';
			dare.execute = async () => [{}];
		});

		const env = {
			get: () => dare.get('users', ['id']),
			post: () => dare.post('users', {name: 'Andrew'}),
			patch: () => dare.patch('users', {id: 1}, {name: 'Andrew'}),
			del: () => dare.del('users', {id: 1}),
		};

		for (const method in env) {
			it(method, async () => {
				const resp = await env[method]();
				assert.strictEqual(resp, 'called');
			});
		}
	});

	describe('should modify response', () => {
		[
			{
				label: 'return a different value',
				handler() {
					return 'done';
				},
				expected(err, resp) {
					assert.strictEqual(resp, 'done');
				},
			},
			{
				label: 'augment the existing value',
				handler(resp) {
					return resp.map(item => item.id);
				},
				expected(err, resp) {
					assert.deepStrictEqual(resp, [1]);
				},
			},
			{
				label: 'support a Promise',
				handler() {
					return Promise.resolve(100);
				},
				expected(err, resp) {
					assert.strictEqual(resp, 100);
				},
			},
			{
				label: 'return the existing value if this returns an undefined',
				handler() {
					// Do something but dont return...
				},
				expected(err, resp) {
					assert.deepStrictEqual(resp, [{id: 1}]);
				},
			},
			{
				label: 'called with the this.options',
				handler() {
					assert.strictEqual(this.options.method, 'get');
					assert.strictEqual(this.options.table, 'users');
				},
				expected(err, resp) {
					assert.deepStrictEqual(resp, [{id: 1}]);
				},
			},
			{
				label: 'trigger exception if error occurs',
				handler() {
					throw Error('whoops');
				},
				expected(err) {
					assert.strictEqual(err.message, 'whoops');
				},
			},
		].forEach(({label, handler: users, expected}) => {
			it(`and ${label}`, async () => {
				const d = dare.use({
					afterGet: {
						users,
					},
				});

				d.execute = async () => [{id: 1}];

				try {
					const resp = await d.get({
						table: 'users',
						fields: ['id'],
						limit: 1,
					});

					expected(null, resp);
				} catch (e) {
					expected(e);
				}
			});
		});
	});

	describe('should be overrideable by the pre-handler', () => {
		function new_after_handler() {
			return 'overriden';
		}

		function preHandlers(options, dareInstance) {
			// This will override it...
			dareInstance.after = new_after_handler;
		}

		beforeEach(() => {
			dare.options.models = {
				users: {
					get: preHandlers,
					post: preHandlers,
					patch: preHandlers,
					del: preHandlers,
				},
			};

			// Overwrite execute
			dare.execute = async () => [{}];

			// This will be overriden
			dare.after_handler = () => {
				throw Error("this wasn't overridden");
			};
		});

		const env = {
			get: () => dare.get('users', ['id']),
			post: () => dare.post('users', {name: 'Andrew'}),
			patch: () => dare.patch('users', {id: 1}, {name: 'Andrew'}),
			del: () => dare.del('users', {id: 1}),
		};

		for (const method in env) {
			it(method, async () => {
				const resp = await env[method]();
				assert.strictEqual(resp, 'overriden');
				assert.notDeepStrictEqual(dare.after, new_after_handler);
			});
		}
	});
});
