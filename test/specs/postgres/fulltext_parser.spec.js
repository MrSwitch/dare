import assert from 'node:assert/strict';
import Dare from '../../../src/postgres.js';
import {describe, it} from 'node:test';

/**
 * @import {Engine} from '../../../src/index.js'
 *
 * @type {Engine}
 */
const ENGINE_POSTGRES = 'postgres:16.3';


describe('fulltextParser', () => {
    // No formatting should be applied to these inputs
    [
        {
            input: 'foo bar',
            expected: 'foo & bar',
        },
        {
            input: '-foo +bar* ~"bar@  abar"',
            expected: '-foo & bar:* & "bar@  abar"',
        },
        {
            input: '-foo +"bar foo bar"',
            expected: '-foo & "bar foo bar"',
        },
        {
            input: '-foo +(<"bar foo @ bar" >"bar bar foo")',
            expected: '-foo & ("bar foo @ bar" & "bar bar foo")',
        },
    ].forEach(({input, expected}) => {
        it(`should format ${input} to ${expected}`, () => {
            /**
             * @type {any}
             */
            const dare = new Dare();
            const output = dare.fulltextParser(input);
            assert.strictEqual(
                expected,
                output,
                'input and output should be the same'
            );
        });
    });

});
