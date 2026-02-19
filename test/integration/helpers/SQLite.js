import {DatabaseSync} from 'node:sqlite';
import {PassThrough} from 'node:stream';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const {TEST_DB_DATA_PATH, TEST_DB_SCHEMA_PATH} = process.env;

const schemaSql = fs.readFileSync(TEST_DB_SCHEMA_PATH, 'utf8');
const insertDataSql = fs.readFileSync(TEST_DB_DATA_PATH, 'utf8');

// SQLite helper class for integration tests
export default class SQLite {
	constructor(credentials) {
		this.credentials = credentials;
		// Create database file in temp directory with a unique name to avoid conflicts
		const timestamp = Date.now();
		const pid = process.pid;
		this.dbPath = join(
			tmpdir(),
			`${credentials.database}_${timestamp}_${pid}.db`
		);

		// Clean up any existing file
		try {
			fs.unlinkSync(this.dbPath);
		} catch {
			// Ignore if file doesn't exist
		}
	}

	async init() {
		// Initialize SQLite database
		this.conn = new DatabaseSync(this.dbPath);

		/*
		 * Execute schema SQL - use exec for the entire schema at once
		 * SQLite's exec can handle multiple statements separated by semicolons
		 */
		try {
			this.conn.exec(schemaSql);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error('Error executing schema SQL:', error);
			throw error;
		}

		// Extract table names
		const tables = this.conn
			.prepare(
				`
			SELECT name FROM sqlite_master 
			WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%_fts'
		`
			)
			.all();

		this.tables = tables.map(({name}) => name);

		return this.conn;
	}

	/**
	 * Convert Uint8Array fields to Buffer for compatibility with existing tests
	 * @param {object} row - Database row object
	 * @returns {object} Row with Uint8Array converted to Buffer
	 */
	convertUint8ArrayToBuffer(row) {
		if (!row || typeof row !== 'object') {
			return row;
		}

		const converted = {};
		for (const [key, value] of Object.entries(row)) {
			if (value instanceof Uint8Array) {
				converted[key] = Buffer.from(value);
			} else {
				converted[key] = value;
			}
		}

		return converted;
	}

	async query(query) {
		// Ensure database connection is initialized
		if (!this.conn) {
			throw new Error(
				'Database connection not initialized. Call init() first.'
			);
		}

		// Handle different types of queries
		const preparedQuery =
			typeof query === 'string' ? query : query.sql || query.text;

		if (!preparedQuery) {
			throw new Error('Unsupported query format');
		}

		// Simple string query
		const trimmed = preparedQuery.trim().toUpperCase();

		const values = typeof query === 'string' ? [] : query.values || [];

		const stmt = this.conn.prepare(preparedQuery);

		if (trimmed.startsWith('SELECT')) {
			const results = stmt.all(...(values || []));
			// Convert Uint8Array to Buffer for compatibility
			return results.map(row => this.convertUint8ArrayToBuffer(row));
		} else if (trimmed.startsWith('INSERT')) {
			const result = stmt.run(...(values || []));
			return {
				insertId:
					Number(result.lastInsertRowid) - Number(result.changes) + 1,
				affectedRows: result.changes,
			};
		} else {
			const result = stmt.run(...(values || []));
			return {
				affectedRows: result.changes,
			};
		}
	}

	/**
	 * Reset Database - Clear and repopulate tables
	 * @returns {Promise<void>}
	 */
	async resetDbState() {
		/*
		 * Clear all tables
		 * Disable foreign key checks
		 */
		this.conn.exec('PRAGMA foreign_keys = OFF;');

		// Clear all tables
		for (const table of this.tables) {
			this.conn.exec(`DELETE FROM ${table}`);
		}

		// Reset autoincrement sequences
		this.conn.exec('DELETE FROM sqlite_sequence');

		// Insert test data
		if (insertDataSql.trim()) {
			try {
				this.conn.exec(insertDataSql);
			} catch (error) {
				// eslint-disable-next-line no-console
				console.error('Error executing data SQL:', error);
				throw error;
			}
		}

		// Re-enable foreign key checks
		this.conn.exec('PRAGMA foreign_keys = ON;');
	}

	async end() {
		// Close database connection
		if (this.conn) {
			this.conn.close();
		}

		// Clean up database file
		try {
			fs.unlinkSync(this.dbPath);
		} catch {
			// Ignore cleanup errors
		}
	}

	stream(query, streamOptions = {objectMode: true, highWaterMark: 5}) {
		// Create a readable stream for query results
		const resultStream = new PassThrough(streamOptions);

		// Execute query and stream results
		setImmediate(() => {
			try {
				let queryStr;
				let values;

				if (typeof query === 'string') {
					queryStr = query;
					values = [];
				} else if (query.sql) {
					queryStr = query.sql;
					values = query.values || [];
				} else if (query.text) {
					queryStr = query.text;
					values = query.values || [];
				} else {
					throw new Error('Unsupported query format');
				}

				const stmt = this.conn.prepare(queryStr);
				const results = stmt.all(...values);

				// Push results to stream
				for (const result of results) {
					resultStream.push(result);
				}

				resultStream.push(null); // End stream
			} catch (error) {
				resultStream.destroy(error);
			}
		});

		return resultStream;
	}
}
