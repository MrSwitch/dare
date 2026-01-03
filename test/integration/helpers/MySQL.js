import {PassThrough} from 'node:stream';
import {execSync} from 'node:child_process';
import mysql from 'mysql2/promise';
import fs from 'node:fs';

const {
	TEST_DB_DATA_PATH,
	TEST_DB_SCHEMA_PATH,
	DB_ENGINE = 'mysql:5.6',
} = process.env;

const schemaSql = fs.readFileSync(TEST_DB_SCHEMA_PATH);
const insertDataSql = fs.readFileSync(TEST_DB_DATA_PATH);

const DB_ENGINE_NAME = DB_ENGINE.split(':')[0];

// Initiates the mysql connection
export default class MySQL {
	constructor(credentials) {
		this.credentials = credentials;
	}

	async init() {
		// We have to connect to the docker instance to run in the mysql dump via a query
		execSync(
			`docker exec -i --env ${DB_ENGINE_NAME.toUpperCase()}_PWD=${this.credentials.password} dare_db ${DB_ENGINE_NAME} -u${this.credentials.user} -p${this.credentials.password}`,
			{
				input: `CREATE DATABASE ${this.credentials.database}; USE ${this.credentials.database}; ${schemaSql}`,
			}
		);

		// Initiate the connection
		this.conn = await mysql.createConnection({
			...this.credentials,
			multipleStatements: true,
		});

		let TABLE_NAME = 'table_name';
		// @ts-ignore
		if (DB_ENGINE.match(/\d+/)?.[0] >= 8) {
			TABLE_NAME = TABLE_NAME.toUpperCase();
		}

		// Extract the tables
		const [tables] = await this.conn.query(`
			SELECT ${TABLE_NAME}
			FROM information_schema.tables
			WHERE table_schema = "${this.credentials.database}"
		`);

		// @ts-ignore
		this.tables = tables.map(({[TABLE_NAME]: table}) => table);

		return this.conn;
	}
	async query(query) {
		const [rows] = await this.conn.query(query);

		return rows;
	}

	/**
	 * Reset Database - Truncate Tables
	 * @returns {Promise<void>}
	 */
	async resetDbState() {
		const truncateTablesSql = `${this.tables
			.map(table => `TRUNCATE TABLE ${table}`)
			.join(';\n')};`;
		const resetDataSql = `
	SET FOREIGN_KEY_CHECKS=0;
	${truncateTablesSql}
	${insertDataSql}
	SET FOREIGN_KEY_CHECKS=1;
	`;
		await this.conn.query(resetDataSql);
	}

	async end() {
		// Close this connection
		return this.conn.end();
	}

	stream(query, streamOptions = {objectMode: true, highWaterMark: 5}) {
		const resultStream = new PassThrough(streamOptions);

		// Stream query results from the DB

		// @ts-ignore
		this.conn.connection.query(query).stream().pipe(resultStream);

		return resultStream;
	}
}
