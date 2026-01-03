/**
 * @import {Schema} from '../../src/index.js'
 */

import assert from 'node:assert';
import Dare from '../../src/index.js';
import {describe, it, beforeEach} from 'node:test';

describe('validateInput', () => {
	let dare;

	/**
	 * @type {Schema}
	 */
	let memberSchema;

	beforeEach(() => {
		memberSchema = {
			name: {
				required: true,
			},
			age: {
				type: 'number',
			},
		};

		dare = new Dare({
			models: {
				// Member model
				member: {
					schema: memberSchema,
				},
			},
		});

		// Should not be called...
		dare.execute = () => {
			throw new Error('execute called');
		};
	});

	it('should trigger the validateInput handler', async () => {
		// Extend with a validateInput handler
		const dareInst = dare.use({
			/**
			 * This is an example validateInput function
			 * @param {object} fieldAttributes - the Field Schema
			 * @param {string} field - the field name
			 * @param {*} value - A value of any data type
			 * @returns {void} Returns nothing or throws an error in an exception
			 */
			validateInput(fieldAttributes, field, value) {
				if (fieldAttributes?.required && value === undefined) {
					throw new Error(`${field} is a required field`);
				}
			},
		});

		// Trigger the Dare Call
		const test = dareInst.post({
			table: 'member',
			body: {age: 'one'},
		});

		await assert.rejects(test, Error);
	});

	['post', 'patch'].forEach(method => {
		describe(method, () => {
			it('should proceed if validateInput is not defined', async () => {
				// Should not be called...
				dare.execute = () => ({});

				// Trigger the Dare Call
				return dare[method]({
					table: 'member',
					filter: {
						id: 1,
					},
					body: {age: 'one'},
				});
			});

			it('should trigger the validateInput handler and pass through exceptions', async () => {
				// Extend with a validateInput handler
				const dareInst = dare.use({
					validateInput(fieldAttributes, field, value) {
						// Desconstruct the field schema options
						const {type} = fieldAttributes;

						if (type === 'number' && typeof value !== 'number') {
							throw new Error(`${field} should be a number`);
						}
					},
				});

				// Trigger the Dare Call
				const test = dareInst[method]({
					table: 'member',
					filter: {
						id: 1,
					},
					body: {age: 'one'},
				});

				await assert.rejects(test, Error);
			});

			it('should pass through undefined for fieldAttributes when the field is not defined in the schema', async () => {
				// Extend with a validateInput handler
				const dareInst = dare.use({
					validateInput(fieldAttributes, field) {
						if (!fieldAttributes) {
							throw new Error(`${field} is unknown`);
						}
					},
				});

				// Trigger the Dare Call
				const test = dareInst[method]({
					table: 'member',
					filter: {
						id: 1,
					},
					body: {hello: "i shouldn't be here"},
				});

				await assert.rejects(test, Error);
			});

			it('should parse falsy fieldDefinitions', async () => {
				/*
				 * Set a new field to false, i.e....
				 * This is immutable and unreadable
				 */
				memberSchema.password = false;

				// Extend with a validateInput handler
				const dareInst = dare.use({
					validateInput(fieldAttributes, field) {
						if (fieldAttributes.writeable === false) {
							throw new Error(`${field} is immutable`);
						}
					},
				});

				// Trigger the Dare Call
				const test = dareInst[method]({
					table: 'member',
					filter: {
						id: 1,
					},
					body: {password: '!@£RTYU'},
				});

				await assert.rejects(test, Error);
			});

			it('should use the default field definition when no other field matches the current model', async () => {
				/*
				 * Default fields are special... they provide the default field definitions
				 * This will let anything through
				 */
				memberSchema.default = false;

				// Extend with a validateInput handler
				const dareInst = dare.use({
					validateInput(fieldAttributes, field, value) {
						if (!fieldAttributes) {
							// Do nothing
							// eslint-disable-next-line no-console
							console.log(
								`the field definition ${field} is incomplete`
							);
						} else if (
							fieldAttributes.writeable === false &&
							value !== undefined
						) {
							throw new Error(`${field} is immutable`);
						}
					},
				});

				// Trigger the Dare Call
				const test = dareInst[method]({
					table: 'member',
					filter: {
						id: 1,
					},
					body: {hello: "i shouldn't be here"},
				});

				await assert.rejects(test, Error);
			});
		});
	});
});
