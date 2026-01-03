import Dare from '../../src/index.js';
import Debug from 'debug';
import assert from 'node:assert/strict';
import {describe, it, beforeEach} from 'node:test';
import mysql from 'mysql2/promise';
import db from './helpers/db.js';
import {options} from './helpers/api.js';
import SQL from 'sql-template-tag';
const debug = Debug('sql');

// Connect to db

describe(`Disparities`, () => {
	let dare;

	beforeEach(() => {
		// Initiate
		dare = new Dare(options);

		// Set a test instance

		dare.execute = query => {
			// DEBUG
			debug(mysql.format(query.sql, query.values));

			return db.query(query);
		};
	});

	it('MySQL 8 fails to correctly count the items in this scenario', async () => {
		/*
		 * See Bug report: https://bugs.mysql.com/bug.php?id=109585
		 */
		await dare.sql(SQL`

			CREATE TABLE members (
				id int NOT NULL,
				name VARCHAR(30) NOT NULL,
				PRIMARY KEY (id)
			);

			CREATE TABLE content (
				id int NOT NULL,
				name VARCHAR(30) NOT NULL,
				PRIMARY KEY (id)
			);
			
			CREATE TABLE domains (
				id smallint NOT NULL,
				name VARCHAR(100) NULL,
				PRIMARY KEY (id)
			);

			CREATE TABLE userContent (
				id int NOT NULL,
				content_id int NOT NULL,
				user_id int NOT NULL,
				domain_id smallint NOT NULL,
				status VARCHAR(20) NOT NULL DEFAULT 'notstarted',
				PRIMARY KEY (id),
				CONSTRAINT content_user_domain_id UNIQUE (content_id,user_id,domain_id),
				CONSTRAINT fk_userContent_domain_id FOREIGN KEY (domain_id) REFERENCES domains (id),
				CONSTRAINT userContent_content FOREIGN KEY (content_id) REFERENCES content (id) ON DELETE CASCADE,
				CONSTRAINT userContent_user FOREIGN KEY (user_id) REFERENCES members (id) ON DELETE CASCADE
			  );
			  
			  -- ---------------------------------
			  -- INSERT
			  -- ---------------------------------
			  
			  INSERT INTO domains (id, name) VALUES (1, 'Test');
			  
			  INSERT INTO content (id, name) VALUES (1, 'A'), (2, 'B'), (3, 'C');
			  
			  INSERT INTO members (id,name)
			  VALUES
				  (11, 'devuser11@example.com'),
				  (12, 'devuser12@example.com');
			  
			  INSERT INTO userContent (id, domain_id,content_id,user_id,status)
			  VALUES
				  (1, 1, 3, 11, 'completed'),
				  (2, 1, 3, 12, 'completed'),
				  (3, 1, 2, 12, 'completed');

		`);

		const status = 'completed';
		const domain_id = 1;

		dare.options.models.userContent = {
			schema: {
				content_id: ['content.id'],
			},
		};

		// Construct a query which counts these
		const resp = await dare.get({
			table: 'content',
			fields: ['id', {count: 'COUNT(DISTINCT userContent.user_id)'}],
			join: {
				userContent: {
					status,
					domain_id,
				},
			},
			limit: 3,
		});

		assert.deepStrictEqual(resp, [
			{id: 1, count: 0},
			{id: 2, count: 1},
			{id: 3, count: 2},
		]);
	});
});
