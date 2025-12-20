import Dare from '../../../src/index.js';
import Debug from 'debug';
import mysql from 'mysql2/promise';
import db from './db.js';
import options from '../../data/options.js';

const debug = Debug('sql');

export {options};

export default function dareInstance() {
	// Initiate
	const dare = new Dare(options);

	// Set a test instance

	dare.execute = async query => {
		// DEBUG
		debug(mysql.format(query.sql, query.values));

		const resp = await db.query(query);

		if (!Array.isArray(resp)) {
			debug(`Affected rows: ${resp.affectedRows}`);
		}

		return resp;
	};

	return dare;
}

export function castToStringIfNeeded(a) {
	// MySQL 5.6, uses CONCAT_WS, rather than type safe JSON_ARRAY
	if (process.env.DB_ENGINE?.startsWith('mysql:5.6')) {
		return a === null ? '' : String(a);
	}

	return a;
}

/**
 * Export a changeable instance of Dare
 * Using ESM export to allow this to be swapped out via beforeEach in each test
 */
export let dare;

beforeEach(() => {
	dare = dareInstance();
});
