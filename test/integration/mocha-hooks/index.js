import {before, beforeEach, after} from 'node:test';
import db from '../helpers/db.js';

// Setup global test hooks
before(async () => {
	/*
	 * BeforeAll happens per-process/thread, so each subsequent test can reset the db without it interfering with other tests in that thread
	 * Initiate the global database connection
	 */
	await db.init();
});

beforeEach(async () => {
	await db.resetDbState();
});

after(async () => {
	await db.end();
});
