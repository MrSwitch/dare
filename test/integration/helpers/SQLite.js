import {DatabaseSync} from 'node:sqlite';
import {Readable} from 'node:stream';
import fs from 'node:fs';

const {TEST_DB_SCHEMA_PATH, TEST_DB_DATA_PATH} = process.env;

const schemaSql = TEST_DB_SCHEMA_PATH
	? fs.readFileSync(TEST_DB_SCHEMA_PATH, 'utf8')
	: '';
const insertDataSql = TEST_DB_DATA_PATH
	? fs.readFileSync(TEST_DB_DATA_PATH, 'utf8')
	: '';

/*
 * SQLite returns Object.create(null) rows; convert to plain objects
 * Also convert Uint8Array to Buffer for compatibility
 */
function toPlainObject(row) {
	const obj = {};
	for (const [key, value] of Object.entries(row)) {
		obj[key] = value instanceof Uint8Array ? Buffer.from(value) : value;
	}
	return obj;
}

export default class SQLite {
	constructor(credentials) {
		this.credentials = credentials;
	}

	async init() {
		// Open an in-memory SQLite database
		this.db = new DatabaseSync(':memory:');

		// Enable WAL mode for performance
		this.db.exec('PRAGMA journal_mode=WAL');
		this.db.exec('PRAGMA foreign_keys=ON');

		// Create schema
		if (schemaSql) {
			this.db.exec(schemaSql);
		}

		// Extract the table names (exclude virtual/shadow tables like FTS5 which are managed by triggers)
		const tables = this.db
			.prepare(
				"SELECT name FROM pragma_table_list WHERE schema='main' AND type='table' AND name NOT LIKE 'sqlite_%'"
			)
			.all();
		this.tables = tables.map(({name}) => name);

		// Insert data
		if (insertDataSql) {
			this.db.exec(insertDataSql);
		}

		return this.db;
	}

	async query(request) {
		const sql = request.sql || request.text || request;
		const values = (request.values || []).map(v => {
			// SQLite cannot bind undefined; convert to null
			if (v === undefined) return null;
			// SQLite cannot bind booleans; convert to 0/1
			if (typeof v === 'boolean') return v ? 1 : 0;
			// SQLite needs Uint8Array for binary data, not Buffer
			if (Buffer.isBuffer(v)) return new Uint8Array(v);
			// SQLite cannot bind objects/arrays; serialize as JSON string
			if (v !== null && typeof v === 'object') return JSON.stringify(v);
			return v;
		});

		// Determine statement type
		const trimmed = sql.trim().toUpperCase();

		if (trimmed.startsWith('INSERT')) {
			const stmt = this.db.prepare(sql);
			if (trimmed.includes('RETURNING')) {
				const rows = stmt.all(...values).map(toPlainObject);
				return {
					insertId: rows?.[0]?.id,
					affectedRows: rows.length,
				};
			}
			const result = stmt.run(...values);
			return {
				insertId: Number(result.lastInsertRowid),
				affectedRows: result.changes,
			};
		} else if (
			trimmed.startsWith('UPDATE') ||
			trimmed.startsWith('DELETE')
		) {
			const stmt = this.db.prepare(sql);
			const result = stmt.run(...values);
			return {
				affectedRows: result.changes,
			};
		} else if (trimmed.startsWith('SELECT')) {
			const stmt = this.db.prepare(sql);
			return stmt.all(...values).map(toPlainObject);
		} else {
			// For other statements (CREATE, etc.)
			this.db.exec(sql);
			return {affectedRows: 0};
		}
	}

	async resetDbState() {
		// Disable foreign keys during reset
		this.db.exec('PRAGMA foreign_keys=OFF');

		// Truncate all tables
		for (const table of this.tables) {
			this.db.exec(`DELETE FROM "${table}"`);
		}

		// Reset auto-increment sequences
		this.db.exec(`DELETE FROM sqlite_sequence`);

		// Re-insert base data
		if (insertDataSql) {
			this.db.exec(insertDataSql);
		}

		// Re-enable foreign keys
		this.db.exec('PRAGMA foreign_keys=ON');
	}

	stream(request, streamOptions = {objectMode: true, highWaterMark: 5}) {
		const sql = request.sql || request.text || request;
		const values = (request.values || []).map(v => {
			if (v === undefined) return null;
			if (typeof v === 'boolean') return v ? 1 : 0;
			if (Buffer.isBuffer(v)) return new Uint8Array(v);
			if (v !== null && typeof v === 'object') return JSON.stringify(v);
			return v;
		});

		const stmt = this.db.prepare(sql);
		const iterator = stmt.iterate(...values);

		return new Readable({
			...streamOptions,
			read() {
				try {
					const {value, done} = iterator.next();
					if (done) {
						this.push(null);
					} else {
						this.push(toPlainObject(value));
					}
				} catch (err) {
					this.destroy(err);
				}
			},
		});
	}

	end() {
		if (this.db) {
			this.db.close();
		}
	}
}
