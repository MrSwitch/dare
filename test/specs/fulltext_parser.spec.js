import assert from 'node:assert/strict';
import Dare from '../../src/index.js';
import {describe, it} from 'node:test';

describe('fulltextParser', () => {
	// No formatting should be applied to these inputs
	[
		{
			input: 'foo bar',
			expected: 'foo bar',
		},
		{
			input: '-foo +bar* ~"bar@  abar"',
			expected: '-foo +bar* ~"bar@  abar"',
		},
		{
			input: '-foo +"bar foo bar"',
			expected: '-foo +"bar foo bar"',
		},
		{
			input: '-foo +(<"bar foo @ bar" >"bar bar foo")',
			expected: '-foo +(<"bar foo @ bar" >"bar bar foo")',
		},
	].forEach(({input, expected}) => {
		it(`should format ${input} to ${expected}`, () => {
			// @ts-ignore
			const dare = new Dare();
			const output = dare.fulltextParser(input);
			assert.strictEqual(
				output,
				expected,
				'input and output should be the same'
			);
		});
	});

	// These inputs should be fixed up
	[
		[
			/*
			 * Emails should be quoted
			 * quoted strings not have an `*` appended
			 * spurious + - characters should be removed
			 */
			'+email@example.com*    +"som eth"* +   - *    ',
			'+"email@example.com" +"som eth"',
		],
		[
			/*
			 * Hyphens and apostrophes should be quoted
			 * Items within parentheses should be maintained
			 */
			"+(>hit'n'miss <miss-n-hit) +",
			'+(>"hit\'n\'miss" <"miss-n-hit")',
		],
	].forEach(([input, expected]) => {
		it(`should parse ${input} -> ${expected}`, () => {
			const dare = new Dare();
			const output = dare.fulltextParser(input);
			assert.strictEqual(
				output,
				expected,
				'input and output should be the same'
			);

			// The output should not be changed on a second pass
			const output2 = dare.fulltextParser(output);
			assert.strictEqual(
				output,
				output2,
				'output and output2 should be the same'
			);
		});
	});

	// These inputs should throw errors
	['', null, undefined, 123, {}, [], true, false].forEach(input => {
		it(`should throw an error on "${input}" (${typeof input})`, () => {
			const dare = new Dare();
			assert.throws(
				() => {
					// @ts-ignore
					dare.fulltextParser(input);
				},
				{
					message: 'Fulltext input must be a string',
					name: 'Error',
				}
			);
		});
	});
});
