import db from '../helpers/db.js';

const mochaHooks = {
	beforeAll: [
		async function () {
			// BeforeAll happens per-process/thread, so each subsequent test can reset the db without it interfering with other tests in that thread
			this.timeout(5000);

			// Initiate the global database connection
			await db.init();
		},
	],
	beforeEach: [
		async function () {
			this.timeout(5000);

			await db.resetDbState();
		},
	],
	afterAll: [
		async function () {
			await db.end();
		},
	],
};

export {mochaHooks};
