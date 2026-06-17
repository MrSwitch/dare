import {PassThrough} from 'node:stream';
import mssql from 'mssql';
import fs from 'node:fs';

const {TEST_DB_DATA_PATH, TEST_DB_SCHEMA_PATH} = process.env;

const schemaSql = TEST_DB_SCHEMA_PATH
	? fs.readFileSync(TEST_DB_SCHEMA_PATH, 'utf8')
	: '';
const insertDataSql = TEST_DB_DATA_PATH
	? fs.readFileSync(TEST_DB_DATA_PATH, 'utf8')
	: '';

/**
 * Convert sql-template-tag `?` placeholders into MS SQL Server named parameters (@p0, @p1, ...)
 * @param {string} sql - SQL with `?` placeholders
 * @returns {string} SQL with named parameters
 */
function convertPlaceholders(sql) {
	let i = 0;
	return sql.replace(/\?/g, () => `@p${i++}`);
}

/**
 * Normalise a value for binding to the MS SQL Server driver
 * @param {any} value - Value to normalise
 * @returns {any} Normalised value
 */
function normalize(value) {
	if (value === undefined) {
		return null;
	}
	if (
		value !== null &&
		typeof value === 'object' &&
		!Buffer.isBuffer(value) &&
		!(value instanceof Date)
	) {
		return JSON.stringify(value);
	}
	return value;
}

export default class MSSQL {
	constructor(credentials) {
		this.credentials = credentials;
	}

	get baseConfig() {
		const {host, port, user, password} = this.credentials;
		return {
			server: host,
			port: +port,
			user,
			password,
			options: {
				trustServerCertificate: true,
				encrypt: false,
			},
		};
	}

	async init() {
		const {database} = this.credentials;

		// SQL Server can take a few seconds to start accepting connections, retry the initial connection
		let master;
		for (let attempt = 0; attempt < 30; attempt++) {
			try {
				// eslint-disable-next-line no-await-in-loop
				master = await new mssql.ConnectionPool({
					...this.baseConfig,
					database: 'master',
				}).connect();
				break;
			} catch (err) {
				if (attempt === 29) {
					throw err;
				}
				// eslint-disable-next-line no-await-in-loop
				await new Promise(resolve => setTimeout(resolve, 2000));
			}
		}

		// Create the per-process test database
		await master
			.request()
			.batch(
				`IF DB_ID('${database}') IS NULL CREATE DATABASE [${database}];`
			);
		await master.close();

		// Connect to the test database
		this.conn = await new mssql.ConnectionPool({
			...this.baseConfig,
			database,
		}).connect();

		// Create the schema
		if (schemaSql) {
			await this.conn.request().batch(schemaSql);
		}

		// Extract the table names
		const tables = await this.conn.request().query(`
			SELECT table_name AS [table]
			FROM information_schema.tables
			WHERE table_type = 'BASE TABLE'
		`);

		this.tables = tables.recordset.map(({table}) => table);

		return this.conn;
	}

	async query(request) {
		const text = convertPlaceholders(
			request.sql || request.text || request
		);
		const values = request.values || [];

		const req = this.conn.request();
		values.forEach((value, index) =>
			req.input(`p${index}`, normalize(value))
		);

		const result = await req.query(text);

		const command = text.trim().split(/\s+/)[0].toUpperCase();

		// Return SELECT rows
		if (command === 'SELECT' || command === 'WITH') {
			return result.recordset || [];
		}

		// Else, return a node-mysql'ish response
		return {
			insertId: result.recordset?.[0]?.id,
			affectedRows: result.rowsAffected?.[0] ?? 0,
		};
	}

	async resetDbState() {
		// Clear the data and reseed the identity columns
		for (const table of this.tables) {
			// eslint-disable-next-line no-await-in-loop
			await this.conn.request().batch(
				`
					DECLARE @count INT;
					SELECT @count = COUNT(1) FROM [${table}];
					DELETE FROM [${table}];
					IF @count > 0
						DBCC CHECKIDENT('${table}', RESEED, 0);
					`
			);
		}

		// Re-insert base data
		if (insertDataSql) {
			await this.conn.request().batch(insertDataSql);
		}
	}

	stream(request, streamOptions = {objectMode: true, highWaterMark: 5}) {
		const text = convertPlaceholders(
			request.sql || request.text || request
		);
		const values = request.values || [];

		const resultStream = new PassThrough(streamOptions);

		const req = this.conn.request();
		req.stream = true;
		values.forEach((value, index) =>
			req.input(`p${index}`, normalize(value))
		);

		req.on('row', row => resultStream.write(row));
		req.on('error', err => resultStream.destroy(err));
		req.on('done', () => resultStream.end());

		req.query(text);

		return resultStream;
	}

	end() {
		return this.conn?.close();
	}
}
