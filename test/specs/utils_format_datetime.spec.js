import assert from 'node:assert';
// Format Input Dates

import format_datetime from '../../src/utils/format_datetime.js';
import {describe, it} from 'node:test';

describe('utils/format_datetime', () => {
	// Should create date ranges from years/months/days...
	[
		['2016-03-01T00:00:00', '2016-03-01T00:00:00'],
		['2016-03-01T01:00', '2016-03-01T01:00:00..2016-03-01T01:00:59'],
		['2016-03-01T01', '2016-03-01T01:00:00..2016-03-01T01:59:59'],
		['2016-03-01', '2016-03-01T00:00:00..2016-03-01T23:59:59'],
		['2016-03-01..', '2016-03-01T00:00:00..'],
		['2016-04', '2016-04-01T00:00:00..2016-04-30T23:59:59'],
		['2016', '2016-01-01T00:00:00..2016-12-31T23:59:59'],

		// Should construct ranges from shorthand, and backfill single digit dates.

		['2018-01-01..02', '2018-01-01T00:00:00..2018-01-02T23:59:59'],
		['2018-1-1..2', '2018-01-01T00:00:00..2018-01-02T23:59:59'],
	].forEach(test => {
		const [input, expected] = test;

		it(`where ${input}`, () => {
			// Call the field with the
			const formatted = format_datetime(input);

			// Expect the formatted list of fields to be identical to the inputted value
			assert.strictEqual(formatted, expected);
		});
	});

	[0, null, {}].forEach(input => {
		it(`ignore ${input}`, () => {
			// Call the field with the
			const formatted = format_datetime(input);

			// Expect the formatted list of fields to be identical to the inputted value
			assert.strictEqual(formatted, input);
		});
	});
});
