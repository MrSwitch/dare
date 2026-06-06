import assert from 'node:assert';
import Dare from '../../../src/postgres16.js';
import {describe, it, beforeEach} from 'node:test';
import sqlEqual from '../../lib/sql-equal.js';

describe('Postgres - Delete', () => {
	let dare;

	// Mock instance of Dare
	beforeEach(() => {
		dare = new Dare();
	});

	it(`should delete with subquery conditions rather than JOINs`, async () => {
		dare.options.models = {
			tbl: {
				schema: {
					// Create a reference to tblB
					ref_id: ['tblB.id'],
				},
			},
		};

		dare.execute = async ({sql, values}) => {
			sqlEqual(
				sql,
				`DELETE FROM tbl
                WHERE tbl.id = ?
                    AND tbl.ref_id IN (
                        SELECT id FROM (
                            SELECT a.id FROM tblB a WHERE a.id= ?
                        ) AS a_tmp
                    )
                `
			);
			assert.deepStrictEqual(values, [1, 1]);
			return {success: true};
		};

		const test = await dare.del({
			table: 'tbl',
			filter: {
				id: 1,
				tblB: {
					id: 1,
				},
			},
		});

		assert.deepStrictEqual(test, {success: true});
	});
});
