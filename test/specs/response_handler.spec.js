import assert from 'node:assert';
import Dare from '../../src/index.js';
import {getTargetPath} from '../../src/format/field_reducer.js';
import {describe, it, beforeEach} from 'node:test';

describe('response_handler', () => {
	let dare;

	beforeEach(() => {
		// Create a new instance
		dare = new Dare();

		// Create an execution instance
		dare = dare.use();
	});

	it('response handler should be defined in instances of Dare', async () => {
		assert.ok('response_handler' in dare);
	});

	it('should expand dot delimited field into a nested object', async () => {
		const data = dare.response_handler([
			{
				field: 'value',
				'assoc.id': 1,
				'assoc.name': 'value',
			},
		]);

		assert.ok(Array.isArray(data));
		assert.deepStrictEqual(data[0], {
			field: 'value',
			assoc: {
				id: 1,
				name: 'value',
			},
		});
	});

	it('should given a field with an array of fields in the title split the values', async () => {
		const data = dare.response_handler([
			{
				field: 'value',
				'assoc.id,assoc.name': '["1","a"]',
				'a,b': Buffer.from('["1","2"]'),
				'ignore,null': null,
			},
		]);

		assert.ok(Array.isArray(data));
		assert.deepStrictEqual(data[0], {
			field: 'value',
			assoc: {
				id: '1',
				name: 'a',
			},
			a: '1',
			b: '2',
		});
	});

	it('should given a nested dataset', async () => {
		const data = dare.response_handler([
			{
				field: 'value',
				'collection[id,name,assoc.id,assoc.name]':
					'[["1","a","a1","aa"],["2","b","b1","ba"]]',
			},
		]);

		assert.ok(Array.isArray(data));
		assert.deepStrictEqual(data[0], {
			field: 'value',
			collection: [
				{
					id: '1',
					name: 'a',
					assoc: {
						id: 'a1',
						name: 'aa',
					},
				},
				{
					id: '2',
					name: 'b',
					assoc: {
						id: 'b1',
						name: 'ba',
					},
				},
			],
		});
	});

	it('should transform a deep linked nested', async () => {
		const data = dare.response_handler([
			{
				field: 'value',
				'asset.id': 1,
				'asset.collection[id,name,assoc.id,assoc.name]':
					'[["1","a","a1","aa"],["2","b","b1","ba"]]',
				'asset$planb.collection[id,name]': '[["1","a"],["2","b"]]',
				'asset.name': 'name',
			},
		]);

		assert.ok(Array.isArray(data));
		assert.deepStrictEqual(data[0], {
			field: 'value',
			asset: {
				id: 1,
				name: 'name',
				collection: [
					{
						id: '1',
						name: 'a',
						assoc: {
							id: 'a1',
							name: 'aa',
						},
					},
					{
						id: '2',
						name: 'b',
						assoc: {
							id: 'b1',
							name: 'ba',
						},
					},
				],
			},
			asset$planb: {
				collection: [
					{
						id: '1',
						name: 'a',
					},
					{
						id: '2',
						name: 'b',
					},
				],
			},
		});
	});

	it('should transform a deep linked nested array with generated fields', async () => {
		function handler(row) {
			return row.id + 2;
		}
		const field = 'something';

		const extraFields = ['id'];

		// Create a list of generated fields
		dare.generated_fields = [
			{
				label: 'generated',
				field,
				field_alias_path: '',
				handler,
				extraFields,
			},
			{
				label: 'generated2',
				field,
				field_alias_path: 'asset.',
				handler,
				extraFields,
			},
			{
				label: 'generated3',
				field,
				field_alias_path: 'asset.collection.',
				handler,
				extraFields: [],
			},
			{
				label: 'generated4',
				field,
				field_alias_path: 'asset.collection.assoc.',
				handler,
				extraFields,
			},
			{
				label: 'willnotappear',
				field,
				field_alias_path: 'doesnotmatch.',
				handler,
				extraFields,
			},
		].map(obj => {
			obj.targetAddress = getTargetPath(obj.field_alias_path, obj.field);
			return obj;
		});

		const data = dare.response_handler([
			{
				field: 'value',
				id: 1,
				'asset.id': 10,
				'asset.collection[id,name,assoc.id,assoc.name]':
					'[["1","a","1a","aa"],["2","b","1b","ba"]]',
				'asset.name': 'name',
			},
		]);

		assert.ok(Array.isArray(data));
		assert.deepStrictEqual(data[0], {
			generated: 3,
			field: 'value',
			asset: {
				generated2: 12,
				name: 'name',
				collection: [
					{
						id: '1',
						generated3: '12',
						name: 'a',
						assoc: {
							generated4: '1a2',
							name: 'aa',
						},
					},
					{
						id: '2',
						generated3: '22',
						name: 'b',
						assoc: {
							generated4: '1b2',
							name: 'ba',
						},
					},
				],
			},
		});
	});

	it('should transform a nested arrays to single root level', async () => {
		const empty = 'empty';
		function handler(row) {
			return row.id ? row.id + 2 : empty;
		}

		const extraFields = ['id', 'name'];

		// Create a list of generated fields
		dare.generated_fields = [
			{
				label: 'LabelA',
				field: 'a.id',
				field_alias_path: '',
				handler,
				extraFields,
			},
			{
				label: 'LabelB',
				field: 'b.id',
				field_alias_path: '',
				handler,
				extraFields,
			},
			{
				label: 'LabelC',
				field: 'c.id',
				field_alias_path: '',
				handler,
				extraFields,
			},
			{
				label: 'LabelD',
				field: 'd.id',
				field_alias_path: '',
				handler,
				extraFields,
			},
			{
				label: 'LabelE',
				field: 'e.id',
				field_alias_path: '',
				handler,
				extraFields,
			},
		].map(obj => {
			obj.targetAddress = getTargetPath(obj.field_alias_path, obj.field);
			return obj;
		});

		const data = dare.response_handler([
			{
				'a[id,name]': '[["1","a"]]',
				'b[id,name]': '[["1","a"],["2","b"]]',
				'c[id,name]': '[]',
				'd[id,name]': '[[]]',
				'e[id,name]': null,
			},
		]);

		assert.ok(Array.isArray(data));
		assert.deepStrictEqual(data[0], {
			// @todo remove this b prop.
			b: [
				{
					id: '2',
					name: 'b',
				},
			],
			LabelA: '12',
			LabelB: '12',
			LabelC: empty,
			LabelD: empty,
			LabelE: empty,
		});
	});

	it('should return empty value if it cannot be interpretted', async () => {
		/*
		 * Return a response field which is invalid
		 * this could be because of GROUP_CONCAT_MAX_LENGTH or bad characters which have not been escaped by dare
		 */
		const data = dare.response_handler([
			{
				field: 'value',
				'collection[id,name,assoc.id,assoc.name]':
					'[["1","a","a1","aa"],["2","b","b1","ba"... broken json...',
			},
		]);

		assert.ok(Array.isArray(data));
		assert.deepStrictEqual(data[0], {
			field: 'value',
			collection: [],
		});
	});

	it('should remove prop if value is empty', async () => {
		/*
		 * Return a response field which is invalid
		 * this could be because of GROUP_CONCAT_MAX_LENGTH or bad characters which have not been escaped by dare
		 */
		const data = dare.response_handler([
			{
				field: 'value',
				'collection[id,name,assoc.id,assoc.name]': '',
			},
		]);

		assert.ok(Array.isArray(data));
		assert.deepStrictEqual(data[0], {
			field: 'value',
		});
	});

	it('should exclude a series of NULL fields, a side-effect of inline GROUP_CONCAT', async () => {
		// Return a response field which is invalid
		const data = dare.response_handler([
			{
				field: 'value',
				'collection[id,name,assoc.id,assoc.name]':
					'[[null, null, null, null], [null, null, null, null]]',
			},
		]);

		assert.ok(Array.isArray(data));
		assert.deepStrictEqual(data[0], {
			collection: [],
			field: 'value',
		});
	});

	it('should return the field as is if the label is not consistant', async () => {
		const item = {
			field: 'value',
			'collection[id,name,assoc.id,assoc.name': '[["1","a","a1","aa"]]',
		};

		const data = dare.response_handler([item]);

		assert.ok(Array.isArray(data));
		assert.deepStrictEqual(data[0], item);
	});

	describe('mysql 5.6', () => {
		let dareInst;

		beforeEach(() => {
			// Create a new instance
			dareInst = dare.use({engine: 'mysql:5.6'});
		});

		it('should exclude a series of empty strings, a side-effect of inline GROUP_CONCAT', async () => {
			// Return a response field which is invalid
			const data = dareInst.response_handler([
				{
					field: 'value',
					'collection[id,name,assoc.id,assoc.name]':
						'[["","","",""], ["","","",""]]',
				},
			]);

			assert.ok(Array.isArray(data));
			assert.deepStrictEqual(data[0], {
				collection: [],
				field: 'value',
			});
		});
	});
});

describe('response_row_handler', () => {
	let dare;

	beforeEach(() => {
		// Create a new instance
		dare = new Dare();

		// Create an execution instance
		dare = dare.use();
	});

	it('response handler should be defined in instances of Dare', async () => {
		assert.ok(!('response_row_handler' in dare));
	});

	it('should allow additional formatting with response_row_handler', async () => {
		// Define a new response_row_handler
		dare.response_row_handler = item => {
			// Adds "prefix" to item.fiele
			item.field = `prefix${item.field}`;

			// Must return item
			return item;
		};

		const data = dare.response_handler([
			{
				field: 'value',
				'assoc.id': 1,
				'assoc.name': 'value',
			},
		]);

		assert.ok(Array.isArray(data))
		assert.strictEqual(data.length, 1, 'Expected data to have length 1');

		assert.deepStrictEqual(data[0], {
			field: 'prefixvalue',
			assoc: {
				id: 1,
				name: 'value',
			},
		});
	});

	it('should return empty array if response_row_handler returns undefined', async () => {
		// Define a new response_row_handler to return nothing
		dare.response_row_handler = () => {
			// Does nothing...
		};

		const data = dare.response_handler([
			{
				field: 'value',
				'assoc.id,assoc.name': '["1","a"]',
				'a,b': Buffer.from('["1","2"]'),
			},
		]);

		 
		assert.ok(Array.isArray(data));
		assert.strictEqual(data.length, 0, 'Expected data to have length 0');
	});
});
