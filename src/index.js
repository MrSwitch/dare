import SQL, {raw, join, empty, bulk} from 'sql-template-tag';

import buildQuery, {generateSQLSelect} from './get.js';

import DareError from './utils/error.js';

import validateBody from './utils/validate_body.js';

import getFieldAttributes from './utils/field_attributes.js';

import extend from './utils/extend.js';

import clone from 'tricks/object/clone.js';

import format_request from './format_request.js';

import response_handler, {responseRowHandler} from './response_handler.js';

/* eslint-disable jsdoc/valid-types */
/**
 * @import {Sql} from 'sql-template-tag'
 *
 * @typedef {`${'mysql' | 'postgres' | 'mariadb'}:${number}.${number}${string?}`} Engine
 *
 * @typedef {Pick<InternalProps, 'alias' | 'parent' | 'name' | 'skip'>} ModalHandlerExtraProps
 *
 * @callback GetModelHandler
 * @param {GetRequestOptions & ModalHandlerExtraProps} [options] - Request Options
 * @param {Dare} [dareInstance] - Dare Instance
 * @returns {void}
 *
 * @callback PostModelHandler
 * @param {PostRequestOptions & ModalHandlerExtraProps} [options] - Request Options
 * @param {Dare} [dareInstance] - Dare Instance
 * @returns {void}
 *
 * @callback PatchModelHandler
 * @param {PatchRequestOptions & ModalHandlerExtraProps} [options] - Request Options
 * @param {Dare} [dareInstance] - Dare Instance
 * @returns {void}
 *
 * @callback DeleteModelHandler
 * @param {DeleteRequestOptions & ModalHandlerExtraProps} [options] - Request Options
 * @param {Dare} [dareInstance] - Dare Instance
 * @returns {void}
 *
 * @typedef {string} Alias
 * @typedef {`${string}.${string}`} Reference
 * @typedef {string | number | boolean | null} DefaultValue
 * @typedef {Function} Handler
 * @typedef {boolean} Authorised
 *
 * @typedef {object} FieldAttributeProps
 * @property {'json' | 'number' | 'boolean' | 'string' | 'datetime' | 'date'} [type] - The type of the field
 * @property {Alias} [alias] - Alias for the field
 * @property {Reference[]} [references] - References to other models fields
 * @property {string} [type] - Type of field
 * @property {DefaultValue | DefaultValue[]} [defaultValue] - Default value for the field
 * @property {boolean} [readable=true] - Whether this field is readable
 * @property {boolean} [writeable=true] - Whether this field is writeable
 * @property {boolean} [required=false] - Whether this field is required
 * @property {Handler} [handler] - Handler to generate the field value
 * @property {(arg: {sql_field: string, field: string, value: any}) => * | SQL} [setFunction] - String defining a SQL function to wrap the value in when setting it
 * @property {FieldAttributes} [get] - The get definition of this field
 * @property {FieldAttributes} [post] - The post definition of this field
 * @property {FieldAttributes} [patch] - The patch definition of this field
 * @property {FieldAttributes} [del] - The del definition of this field
 *
 * @typedef {Record<string, any> & FieldAttributeProps} FieldAttributes
 * @typedef {FieldAttributes | Handler | Reference[] | Alias | (Authorised & false) | null} FieldAttributesWithShorthand
 * @typedef {Record<string, FieldAttributesWithShorthand>} Schema
 *
 * @typedef {object} Model
 * @property {Schema} [schema] - Model Schema
 * @property {string} [table] - Alias for the table
 * @property {Object<string, string>} [shortcut_map] - Shortcut map
 * @property {GetModelHandler} [get] - Get handler
 * @property {PostModelHandler} [post] - Post handler
 * @property {PatchModelHandler} [patch] - Patch handler
 * @property {DeleteModelHandler} [del] - Delete handler
 *
 * @typedef {Array<string | number | boolean | Record<string, string | number | boolean | RequestFields>>} RequestFields
 *
 * @typedef {function(Record<string, any>, string, any):void} ValidateInputFunction
 *
 * @typedef {object} RequestOptions
 * @property {string} [table] - Name of the table to query
 * @property {RequestFields} [fields] - Fields array to return
 * @property {Record<string, any>} [filter] - Filter Object to query
 * @property {Record<string, any>} [join] - Place filters on the joining tables
 * @property {Record<string, any>} [body] - Body containing new data
 * @property {RequestOptions} [query] - Query attached to a post request to create INSERT...SELECT operations
 * @property {number} [limit] - Number of items to return
 * @property {number} [start] - Number of items to skip
 * @property {string | string[]} [orderby] - Array of fields to order by
 * @property {string | string[]} [groupby] - Field to group by
 * @property {string} [duplicate_keys] - 'ignore' to prevent throwing Duplicate key errors
 * @property {string[]} [duplicate_keys_update] - An array of fields to update on presence of duplicate key constraints
 * @property {*} [notfound] - If not undefined will be returned in case of a single entry not found
 * @property {Record<string, Model>} [models] - Models with schema defintitions
 * @property {ValidateInputFunction} [validateInput] - Validate input
 * @property {boolean} [infer_intermediate_models] - Infer intermediate models
 * @property {function(Record<string, any>):any} [rowHandler] - Override default Function to handle each row
 * @property {Function} [getFieldKey] - Override default Function to interpret the field key
 * @property {string} [conditional_operators_in_value] - Allowable conditional operators in value
 * @property {any} [state] - Arbitary data to carry through to the model/response handlers
 * @property {Engine} [engine] - DB Engine to use
 * @property {boolean} [ignore] - Aka INSERT IGNORE INTO...
 *
 * @typedef {object} InternalProps
 * @property {'post' | 'get' | 'patch' | 'del'} [method] - Method to use
 * @property {string} [name] - Model Name derived
 * @property {boolean} [single] - Return a single item
 * @property {boolean} [skip] - Skip the request
 * @property {string} [alias] - Alias for the table
 * @property {boolean} [countRows] - Count all rows
 * @property {string} [sql_table] - SQL Table
 * @property {string} [sql_alias] - SQL Alias
 * @property {Array} [sql_joins] - SQL Join
 * @property {QueryOptions} [parent] - Defines the parent request
 * @property {boolean} [forceSubquery] - Force the table joins to use a subquery.
 * @property {Array} [sql_where_conditions] - SQL Where conditions
 * -- properties of the format_request function
 * @property {boolean} [has_filter] - Has filter, used to determine whether a node and it's descendents can be defined as a subquery
 * @property {boolean} [has_fields] - Has fields, used to determine whether the subqueries are required
 * @property {string} [field_alias_path] - An alternative path to these fields when intermediate models are used
 * @property {string} [required_join] - Join is required
 * @property {boolean} [negate] - Whether this node is connected via a negation operator
 * @property {boolean} [is_subquery] - Identify a node as a subquery, used to place fields into a subquery, or a filter into a subquery (i.e. when negated)
 * @property {boolean} [many] - 1:n join
 * @property {Record<string, any>} [join_conditions] - Join conditions between nodes
 * @property {Sql} [sql_join_condition] - Table to join
 * @property {Array<QueryOptions>} [joins] - Usually this is derived when processing the node, however when there is an intermediate node, we can pre-define the joins
 * @property {Array<QueryOptions>} [_joins] - Descendent nodes, post-processed
 *
 * @typedef {RequestOptions & InternalProps} QueryOptions
 */
/* eslint-enable jsdoc/valid-types */

/*
 * Export Dare Error object
 */
export {DareError};

/**
 * Dare
 * Sets up a new instance of Dare
 *
 * @param {QueryOptions} options - Initial options defining the instance
 * @returns {Dare} instance of dare
 */
function Dare({engine, ...options} = {}) {
	// Overwrite default properties
	this.options = extend(clone(this.options), options);

	if (engine) {
		this.engine = engine;
		this.rowid = engine.startsWith('postgres') ? 'id' : '_rowid';
	}

	return this;
}

export default Dare;

// Export the DareError object
Dare.DareError = DareError;

// Set default function
/**
 * Set default execution handler
 * @param {object} requestQuery - Request object
 * @returns {Promise<object>} Response
 */
// eslint-disable-next-line no-unused-vars
Dare.prototype.execute = async requestQuery => {
	throw new DareError(
		DareError.INVALID_SETUP,
		'Define dare.execute to continue'
	);
};

/**
 * Engine, database engine
 * @type {Engine}
 */
Dare.prototype.engine = 'mysql:8.0.40';

// Rowid, name of primary key field used in grouping operation: MySQL uses _rowid
/** @type {string} */
Dare.prototype.rowid = '_rowid';

// Set the Max Limit for SELECT statements
/** @type {number} */
Dare.prototype.MAX_LIMIT = null;

// Capture the generated field functions to run after the request
Dare.prototype.generated_fields = [];

// Default options
/** @type {Partial<QueryOptions>} */
Dare.prototype.options = {
	// Infer intermediate tables when two models are not directly linked
	infer_intermediate_models: true,

	// Allow conditional operators in value
	conditional_operators_in_value: '%!~',
};

// Set default table_alias handler
Dare.prototype.table_alias_handler = function (name) {
	return name.replace(/^-/, '').split('$')[0];
};

Dare.prototype.unique_alias_index = 0;

Dare.prototype.identifierWrapper = function identifierWrapper(field) {
	const identifier_delimiter = this.engine.startsWith('postgres') ? '"' : '`';
	return [identifier_delimiter, field, identifier_delimiter].join('');
};

Dare.prototype.get_unique_alias = function () {
	const i = this.unique_alias_index;
	const num_characters_in_alphabet = 26;
	const str = String.fromCharCode(97 + (i % num_characters_in_alphabet));
	this.unique_alias_index += 1;
	if (i < num_characters_in_alphabet) {
		return str;
	}

	if (i > num_characters_in_alphabet * num_characters_in_alphabet) {
		throw new DareError(
			DareError.INVALID_REQUEST,
			'Unique Alias Index has exceeded maximum'
		);
	}

	const prefix = String.fromCharCode(
		96 + Math.floor(i / num_characters_in_alphabet)
	);

	return this.identifierWrapper(`${prefix}${str}`);
};

// eslint-disable-next-line jsdoc/valid-types
/** @type {(options: QueryOptions) => Promise<QueryOptions>} */
Dare.prototype.format_request = format_request;

Dare.prototype.response_handler = response_handler;

/**
 * GetFieldKey
 * @param {string} field - Field
 * @param {Schema} schema - Model Schema
 * @returns {string | void} Field Key
 */
// eslint-disable-next-line no-unused-vars
Dare.prototype.getFieldKey = function getFieldKey(field, schema) {
	// Do nothing, default is to set it to same as field
};

/**
 * Fulltext Parser
 * This will format a string to make it compliant with MySQL Fulltext search
 * Such as wrapping special characters in quotes where they appear in the middle of words
 * Removing any trailing '*' characters which succeed a quoted string
 * e.g. `+test@example.com*` becomes `+"test@example.com"`
 * @param {string} input - Input string
 * @returns {string} Formatted string
 */
Dare.prototype.fulltextParser = function fulltextParser(input) {
	const IS_POSTGRES = this.engine.startsWith('postgres');

	function safequote(text) {
		let suffix = '';

		if (text.endsWith('*')) {
			suffix = '*';
			text = text.slice(0, -1);
		}

		if (text.match(/['@-]/)) {
			return `"${text}"`;
		}

		if (IS_POSTGRES && suffix === '*') {
			return `${text}:*`;
		}

		return text + suffix;
	}

	if (typeof input !== 'string' || input === '') {
		throw new DareError(
			DareError.INVALID_REQUEST,
			'Fulltext input must be a string'
		);
	}

	// Replace any special characters with quotes
	const resp = input.matchAll(
		/\s*(?<sign>[&+<>~-]?)(?:\((?<subexpression>[^()]*)\)|(?<quoted>".*?")|(?<unquoted>[^\s()]+))(?<suffix>\*)?/g
	);

	const output = [...resp]
		.filter(({groups: {subexpression, quoted, unquoted}}) =>
			quoted
				? quoted.length > 2
				: subexpression || unquoted.replace(/^[*+-]+/, '')
		)
		.map(
			(
				{groups: {sign, subexpression, quoted, unquoted, suffix = ''}},
				index
			) => {
				if (IS_POSTGRES) {
					sign = sign
						// .replace('+', '&')
						.replace(/[+<>~]*/, '');

					if (!sign.includes('&') && index > 0) {
						sign = `& ${sign}`;
					}
				}

				if (subexpression) {
					return `${sign}(${this.fulltextParser(subexpression)})`;
				} else if (quoted) {
					return `${sign}${quoted}`;
				} else {
					return `${sign}${safequote(unquoted + suffix)}`;
				}
			}
		);

	return output.join(' ');
};

/* eslint-disable jsdoc/valid-types */
/* eslint-disable jsdoc/check-tag-names */
/**
 * Dare.after
 * Defines where the instance goes looking to apply post execution handlers and potentially mutate the response
 * @param {any} resp - Response object
 * @returns {any} response data formatted or not
 */
/* eslint-enable jsdoc/valid-types */
/* eslint-enable jsdoc/check-tag-names */
Dare.prototype.after = function (resp) {
	// Define the after handler
	const handler = `after${this.options.method.replace(/^[a-z]/, m =>
		m.toUpperCase()
	)}`;
	const table = this.options.name;

	// Trigger after handlers following a request
	if (handler in this.options && table in this.options[handler]) {
		// Trigger handler
		return this.options[handler][table].call(this, resp) || resp;
	}

	return resp;
};

/**
 * Use
 * Creates a new instance of Dare and merges new options with the base options
 * @param {QueryOptions} options - set of instance options
 * @returns {Dare} Instance of Dare
 */
Dare.prototype.use = function ({engine, ...options} = {}) {
	const inst = Object.create(this);

	/**
	 * Create a new options, merging inheritted and new
	 * @type {QueryOptions} inst.options
	 */
	inst.options = extend(clone(this.options), options);

	// Define the Row handler to format the results
	if (options.rowHandler) {
		inst.response_row_handler = options.rowHandler;
	}
	if (options.getFieldKey) {
		inst.getFieldKey = options.getFieldKey;
	}
	if (engine) {
		inst.engine = engine;
		inst.rowid = engine.startsWith('postgres') ? 'id' : '_rowid';
	}

	// Set the generate_fields array
	inst.generated_fields = [];

	// Set SQL level states
	inst.unique_alias_index = 0;
	return inst;
};

/**
 * Define a resultset
 * @type {Array<object>} resultset
 */
Dare.prototype.resultset = undefined;

/**
 * Add a row to the resultset
 * @param {object} row - Row record to add to the rows resultset
 * @returns {void}
 */
Dare.prototype.addRow = function (row) {
	// Format the SQL Row
	const item = responseRowHandler.call(this, row);

	// If this is not undefined...
	if (item !== undefined) {
		this.resultset ??= [];
		this.resultset.push(item);
	}
};

/**
 * Dare.sql
 * Prepares and processes SQL statements
 *
 * @param {string | Sql | {sql: string, values: Array}} sql - SQL string containing the query
 * @param {Array} [values] - List of prepared statement values
 * @returns {Promise} Returns response object or array of values
 */
Dare.prototype.sql = async function sql(sql, values) {
	let req;

	if (typeof sql === 'object') {
		req = sql;
	} else {
		req = {sql, values};
	}

	const resp = await this.execute(req);
	return resp || this.resultset;
};

/**
 * Dare.get
 * Triggers a DB SELECT request to rerieve records from the database.
 *
 * @typedef {Omit<RequestOptions, 'body' | 'query' | 'duplicate_keys' | 'duplicate_keys_update'>} GetRequestOptions
 *
 * @param {string | GetRequestOptions} table - Name of the table to query
 * @param {Array} [fields] - Fields array to return
 * @param {object} [filter] - Filter Object to query
 * @param {Omit<GetRequestOptions, 'table' | 'fields' | 'filter'>} [options] - An Options object containing all other request options
 * @returns {Promise<any>} Results
 */
Dare.prototype.get = async function get(table, fields, filter, options = {}) {
	/**
	 * @type {QueryOptions} opts
	 */
	const opts =
		typeof table === 'object'
			? // Clone
				{...table}
			: // Clone and extend
				{...options, table, filter, fields};

	const existanceCheck = opts.fields === undefined;

	// Ensure fields is provided
	if (existanceCheck) {
		opts.fields = [{recordExists: true}];
	} else if (typeof opts.fields !== 'object' || opts.fields === null) {
		// Fields must be defined
		throw new DareError(DareError.INVALID_REQUEST);
	}

	// Define method
	opts.method = 'get';

	// Set default notfound handler
	setDefaultNotFoundHandler(opts);

	const dareInstance = this.use(opts);

	const req = await dareInstance.format_request(dareInstance.options);

	// Build the query
	const query = buildQuery(req, dareInstance);

	// Where the query has_sub_queries=true property, we should generate a CTE query
	if (
		!this.engine.startsWith('mysql:5') &&
		query.has_sub_queries &&
		query.limit &&
		!opts.groupby
	) {
		// Create a new formatted query, with just the fields
		opts.fields = ['id'];
		const cteInstance = this.use(opts);
		const cteRequest = await cteInstance.format_request(
			cteInstance.options
		);
		const cteQuery = buildQuery(cteRequest, cteInstance);
		const sql_query = generateSQLSelect(cteQuery);
		query.sql_joins.unshift(
			SQL`JOIN cte ON (cte.id = ${raw(query.sql_alias)}.${raw(dareInstance.rowid)})`
		);
		query.sql_cte = SQL`cte AS (${sql_query})`;
	}

	// If the query is empty, return an empty array
	const sql_query = generateSQLSelect(query);

	// Execute the query
	const sql_response = await dareInstance.sql(sql_query);

	if (sql_response === undefined) {
		return;
	}

	// Format the response
	let resp = await dareInstance.response_handler(sql_response);

	// If limit was not defined we should return the first result only.
	if (dareInstance.options.single) {
		if (resp.length) {
			resp = resp[0];
		} else if (typeof dareInstance.options.notfound === 'function') {
			dareInstance.options.notfound();
		} else {
			resp = dareInstance.options.notfound;
		}
	}

	return dareInstance.after(resp);
};

/**
 * Dare.getCount
 * Returns the total number of results which match the conditions
 *
 * @param {string | GetRequestOptions} table - Name of the table to query
 * @param {object} [filter] - Filter Object to query
 * @param {Omit<GetRequestOptions, 'table' | 'filter'>} [options] - An Options object containing all other request options
 * @returns {Promise<number>} Number of matched items
 */
Dare.prototype.getCount = async function getCount(table, filter, options = {}) {
	/**
	 * @type {QueryOptions} opts
	 */
	const opts =
		typeof table === 'object'
			? // Clone
				{...table}
			: // Clone and extend
				{...options, table, filter};

	// Define method
	opts.method = 'get';

	// Flag Count all rows
	opts.countRows = true;

	// Remove the fields...
	opts.fields = [];

	// Remove any orderby
	opts.orderby = undefined;

	// Remove the limit and start
	opts.limit = undefined;
	opts.start = undefined;

	const dareInstance = this.use(opts);

	const req = await dareInstance.format_request(dareInstance.options);

	const query = buildQuery(req, dareInstance);
	const sql_query = generateSQLSelect(query);

	// Execute the query
	const [resp] = await dareInstance.sql(sql_query);

	/*
	 * Return the count
	 * postgres: returns a string, which needs to be cast to a number
	 */
	return Number(resp.count);
};

/**
 * Dare.patch
 * Updates records matching the conditions
 *
 * @typedef {Omit<RequestOptions, 'fields' | 'groupby' | 'query'>} PatchRequestOptions
 *
 * @param {string | PatchRequestOptions} table - Name of the table to query
 * @param {object} [filter] - Filter Object to query
 * @param {object} [body] - Body containing new data
 * @param {Omit<PatchRequestOptions, 'table' | 'body' | 'filter'>} [options] - An Options object containing all other request options
 * @returns {Promise<any>} Affected Rows statement
 */
Dare.prototype.patch = async function patch(table, filter, body, options = {}) {
	const IS_POSTGRES = this.engine.startsWith('postgres');

	/**
	 * @type {QueryOptions} opts
	 */
	const opts =
		typeof table === 'object'
			? // Clone
				{...table}
			: // Clone and extend
				{...options, table, filter, body};

	// Define method
	opts.method = 'patch';

	// Set default notfound handler
	setDefaultNotFoundHandler(opts);

	const dareInstance = this.use(opts);

	if (IS_POSTGRES) {
		/*
		 * Postgres doesn't support table JOINs to the table being updated
		 * We can only have one table in the FROM clause, which is a problem if multiple table join to the table being updated.
		 * To work around this, turn all of the join tables into subquery joins
		 */
		opts.forceSubquery = true;
	}

	const req = await dareInstance.format_request(opts);

	// Skip this operation?
	if (req.skip) {
		return dareInstance.after(req.skip);
	}

	// Validate Body
	validateBody(req.body);

	// Options
	const {models, validateInput} = dareInstance.options;

	// Get the model structure
	const {schema: tableSchema} = models?.[req.name] || {};

	// Prepare post
	const sql_set = prepareSQLSet({
		body: req.body,
		sql_alias: IS_POSTGRES ? null : req.sql_alias,
		tableSchema,
		validateInput,
		dareInstance,
	});

	// If ignore duplicate keys is stated as ignore
	let exec = '';
	if (
		req.duplicate_keys &&
		req.duplicate_keys.toString().toLowerCase() === 'ignore'
	) {
		exec = 'IGNORE ';
	}

	// Construct a db update
	const sql = SQL`
		UPDATE ${raw(exec)}${raw(req.sql_table)} ${raw(req.sql_alias)}
		${req.sql_joins.length ? join(req.sql_joins, '\n') : empty}
		SET ${sql_set}
		WHERE
			${join(req.sql_where_conditions, ' AND ')}
		${!IS_POSTGRES && !req.sql_joins.length ? SQL`LIMIT ${req.limit}` : empty}
	`;

	let resp = await this.sql(sql);

	resp = mustAffectRows(resp, opts.notfound);

	return dareInstance.after(resp);
};

/**
 * Dare.post
 * Insert new data into database
 *
 * @typedef {Omit<RequestOptions, 'filter' | 'start' | 'limit' | 'groupby' | 'orderby'>} PostRequestOptions
 *
 * @param {string | RequestOptions} table - Name of the table to query
 * @param {object | Array<object>} [body] - Body containing new data
 * @param {Omit<RequestOptions, 'table' | 'body'>} [options] - An Options object containing all other request options
 * @returns {Promise<any>} Affected Rows statement
 */
Dare.prototype.post = async function post(table, body, options = {}) {
	/**
	 * @type {QueryOptions} opts
	 */
	const opts =
		typeof table === 'object'
			? // Clone
				{...table}
			: // Clone and extend
				{...options, table, body};

	// Is postgres
	const IS_POSTGRES = this.engine.startsWith('postgres');

	// Post
	opts.method = 'post';

	const dareInstance = this.use(opts);

	// Table
	const req = await dareInstance.format_request(opts);

	// Skip this operation?
	if (req.skip) {
		return dareInstance.after(req.skip);
	}

	// Capture fields...
	const fields = [];

	/**
	 * INSERT... SELECT placeholder
	 * @type {Sql}
	 */
	let sql_query = empty;

	if (req.query) {
		/*
		 * Validate all fields are simple ones
		 * Test: are there nested fields
		 */
		const invalidQueryFields = req.query.fields
			.flatMap(field =>
				typeof field === 'string' ? field : Object.values(field)
			)
			.some(value => value !== null && typeof value === 'object');

		// Throw an error if the fields are missing, perhaps indented
		if (invalidQueryFields) {
			throw new DareError(
				DareError.INVALID_REQUEST,
				'Nested fields forbidden in post-query'
			);
		}

		const getInstance = this.use(req.query);

		getInstance.options.method = 'get';

		const getRequest = await getInstance.format_request(
			getInstance.options
		);

		// Throw an error if there are any generated fields
		if (getInstance.generated_fields.length) {
			throw new DareError(
				DareError.INVALID_REQUEST,
				'Generated fields forbidden in post-query'
			);
		}

		// Assign the query
		const query = buildQuery(getRequest, getInstance);
		sql_query = generateSQLSelect(query);

		fields.push(...walkRequestGetField(getRequest));
	} else {
		// Validate Body
		validateBody(req.body);
	}

	// Set table
	let post = req.body || [];

	// Clone object before formatting
	if (!Array.isArray(post)) {
		post = [post];
	}

	// If ignore duplicate keys is stated as ignore
	const sql_exec = req.ignore ? raw('IGNORE') : empty;

	// Instance options
	const {models, validateInput} = dareInstance.options;

	// Get the schema
	const {schema: modelSchema = {}} = models?.[req.name] || {};

	const data = post
		.map(item => {
			const _data = [];
			const currFields = [];

			/*
			 * Iterate through the properties
			 * Format, validate and insert
			 */
			for (const prop in item) {
				// Format key and values...
				const {field, value} = formatInputValue({
					tableSchema: modelSchema,
					field: prop,
					value: item[prop],
					validateInput,
					dareInstance,
				});

				// Store the original field names
				currFields.push(field);

				// Get the index in the field list
				let i = fields.indexOf(field);

				if (i === -1) {
					i = fields.length;

					fields.push(field);
				}

				// Insert the value at that position
				_data[i] = value;
			}

			/*
			 * Let's catch the omitted properties
			 * --> Loop through the modelSchema
			 */
			Object.keys(modelSchema).forEach(field => {
				// For each property which was not covered by the input
				if (field !== 'default' && !currFields.includes(field)) {
					// Get a formatted object of field attributes
					const fieldAttributes = getFieldAttributes(
						field,
						modelSchema,
						dareInstance
					);

					/*
					 * CurrFields stores the alias
					 * So let's check the alias is not already defined
					 */
					if (currFields.includes(fieldAttributes.alias)) {
						return;
					}

					// Validate with an undefined value
					validateInput?.(fieldAttributes, field);

					// Default values?
					if (fieldAttributes.defaultValue) {
						// Get the index in the field list
						let i = fields.indexOf(field);

						if (i === -1) {
							i = fields.length;

							fields.push(field);
						}

						// Insert the defaultValue at that position
						_data[i] = fieldAttributes.defaultValue;
					}
				}
			});

			return _data;
		})
		.map(_data => {
			// Create prepared values
			const a = fields.map((_, index) => {
				// If any of the values are missing, set them as DEFAULT
				if (_data[index] === undefined) {
					return raw('DEFAULT');
				}

				// Return the prepared statement placeholder
				return _data[index];
			});

			return a;
		});

	// Options
	let sql_on_duplicate_keys_update = empty;
	if (req.duplicate_keys_update) {
		sql_on_duplicate_keys_update = raw(
			dareInstance.onDuplicateKeysUpdate(
				req.duplicate_keys_update.map(field =>
					unAliasFields(modelSchema, field, dareInstance)
				),
				fields
			)
		);
	} else if (req.duplicate_keys?.toString()?.toLowerCase() === 'ignore') {
		sql_on_duplicate_keys_update = raw(
			dareInstance.onDuplicateKeysUpdate([], [], req.sql_table)
		);
	}

	const sql_postgres_returning = IS_POSTGRES
		? SQL` RETURNING ${raw(dareInstance.rowid)}`
		: empty;

	// Construct a db update
	const sql = SQL`INSERT ${sql_exec} INTO ${raw(req.sql_table)}
			(${raw(fields.map(dareInstance.identifierWrapper.bind(dareInstance)).join(','))})
			${data.length ? SQL`VALUES ${bulk(data)}` : empty}
			${sql_query}
			${sql_on_duplicate_keys_update}
			${sql_postgres_returning}`;

	const resp = await dareInstance.sql(sql);

	return dareInstance.after(resp);
};

/**
 * Dare.del
 * Delete a record matching condition
 *
 * @typedef {Omit<RequestOptions, 'body' | 'query'>} DeleteRequestOptions
 *
 * @param {string | DeleteRequestOptions} table - Name of the table to query
 * @param {object} [filter] - Filter Object to query
 * @param {Omit<DeleteRequestOptions, 'table' | 'filter'>} [options] - An Options object containing all other request options
 * @returns {Promise<any>} Affected Rows statement
 */
Dare.prototype.del = async function del(table, filter, options = {}) {
	const IS_POSTGRES = this.engine.startsWith('postgres');

	/**
	 * @type {QueryOptions} opts
	 */
	const opts =
		typeof table === 'object'
			? // Clone
				{...table}
			: // Clone and extend
				{...options, table, filter};

	// Delete
	opts.method = 'del';

	// Set default notfound handler
	setDefaultNotFoundHandler(opts);

	const dareInstance = this.use(opts);

	if (IS_POSTGRES) {
		/*
		 * Postgres doesn't support table JONS's in DELETE operation
		 * So we need to tell the formatter that we want the conditions to be within a subquery
		 */
		opts.forceSubquery = true;
	}

	const req = await dareInstance.format_request(opts);

	// Skip this operation?
	if (req.skip) {
		return dareInstance.after(req.skip);
	}

	// Construct a db update
	const sql = SQL`DELETE ${
		req.sql_joins.length ? raw(req.sql_table) : empty
	} FROM ${raw(req.sql_table)}
					${req.sql_joins.length ? join(req.sql_joins, '\n') : empty}
					WHERE
					${join(req.sql_where_conditions, ' AND ')}
					${!IS_POSTGRES && !req.sql_joins.length ? SQL`LIMIT ${req.limit}` : empty}`;

	let resp = await this.sql(sql);

	resp = mustAffectRows(resp, opts.notfound);

	return dareInstance.after(resp);
};

/**
 * Prepared SQL Set
 * Prepare a SET assignments used in Patch
 * @param {object} obj - Object
 * @param {object} obj.body - body to format
 * @param {string | null} obj.sql_alias - SQL Alias for update table
 * @param {object} [obj.tableSchema={}] - Schema for the current table
 * @param {Function} [obj.validateInput] - Validate input function
 * @param {Dare} obj.dareInstance - Dare Instance
 * @returns {object} {assignment, values}
 */
function prepareSQLSet({
	body,
	sql_alias,
	tableSchema = {},
	validateInput,
	dareInstance,
}) {
	const assignments = [];

	for (const label in body) {
		/*
		 * Get the real field in the db,
		 * And formatted value...
		 */
		const {sql_field, value} = formatInputValue({
			sql_alias,
			tableSchema,
			field: label,
			value: body[label],
			validateInput,
			dareInstance,
		});

		// Replace value with a question using any mapped fieldName
		assignments.push(SQL`${raw(sql_field)} = ${value}`);
	}

	return join(assignments, ', ');
}

function mustAffectRows(result, notfound) {
	if (result.affectedRows === 0) {
		if (typeof notfound === 'function') {
			return notfound();
		}
		return notfound;
	}
	return result;
}

Dare.prototype.onDuplicateKeysUpdate = function onDuplicateKeysUpdate(
	keys = [],
	existing = [],
	sql_table = ''
) {
	const IS_POSTGRES = this.engine.startsWith('postgres');

	if (IS_POSTGRES) {
		if (!keys.length) {
			return `ON CONFLICT DO NOTHING`;
		}

		return `
			ON CONFLICT (${existing.filter(item => !keys.includes(item)).join(',')})
				DO UPDATE
					SET ${keys.map(name => `${this.identifierWrapper(name)}=EXCLUDED.${this.identifierWrapper(name)}`).join(',')}
		`;
	}

	let s = keys
		.map(
			name =>
				`${this.identifierWrapper(name)}=VALUES(${this.identifierWrapper(name)})`
		)
		.join(',');

	if (!keys.length) {
		s = `${sql_table}._rowid`;
		s = `${s}=${s}`;
	}

	return `ON DUPLICATE KEY UPDATE ${s}`;
};

/**
 * Format Input Value
 * For a given field definition, return the db key (alias) and format the input it required
 * @param {object} obj - Object
 * @param {Schema} [obj.tableSchema={}] - An object containing the table schema
 * @param {string} [obj.sql_alias=null] - SQL Alias for the table
 * @param {string} obj.field - field identifier
 * @param {*} obj.value - Given value
 * @param {Function} [obj.validateInput] - Custom validation function
 * @param {Dare} obj.dareInstance - Dare Instance
 * @throws Will throw an error if the field is not writable
 * @returns {{field: string, sql_field: string, value: *}} A singular value which can be inserted
 */
function formatInputValue({
	tableSchema = {},
	sql_alias = null,
	field,
	value,
	validateInput,
	dareInstance,
}) {
	/*
	 * Get the field attributes
	 * If the field is not found, use `default` field otherwise return an empty object
	 */
	let fieldAttributes = getFieldAttributes(
		field,
		tableSchema,
		dareInstance,
		true
	);

	if (Object.keys(fieldAttributes).length === 0) {
		// Set this to null for validateInput
		fieldAttributes = null;
	}

	const {alias, writeable, type, setFunction} = fieldAttributes || {};

	// Execute custom field validation
	validateInput?.(fieldAttributes, field, value);

	// Rudimentary validation of content
	if (writeable === false) {
		throw new DareError(
			DareError.INVALID_REFERENCE,
			`Field '${field}' is not writeable`
		);
	}

	// Stringify object
	if (type === 'json') {
		// Value must be an object
		if (typeof value !== 'object') {
			throw new DareError(
				DareError.INVALID_VALUE,
				`Field '${field}' must be an object: ${JSON.stringify(
					value
				)} provided`
			);
		}

		// Stringify
		if (value !== null) {
			value = JSON.stringify(value);
		}
	}

	/**
	 * Type=date
	 * Sadly, Date objects via prepared statements are converted to full length datetimeoffset i.e. `YYYY-MM-DDT23:59:59.000Z`
	 * - MySQL (that we know of) throws errors when expecting just `YYYY-MM-DD`
	 */
	if (type === 'date' && value instanceof Date) {
		// ISO date, extract the date part
		value = value.toISOString().split('T').at(0);
	}

	// Check this is not an object
	if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
		throw new DareError(
			DareError.INVALID_VALUE,
			`Field '${field}' does not accept objects as values: '${JSON.stringify(
				value
			)}'`
		);
	}

	if (alias) {
		if (/[^\w$.]/.test(alias)) {
			throw new DareError(
				DareError.INVALID_REQUEST,
				`Field '${field}' is an alias for a derived value '${field}', cannot mutate`
			);
		}

		field = alias;
	}

	// Format the field
	const sql_field =
		(sql_alias ? `${sql_alias}.` : '') +
		dareInstance.identifierWrapper(field);

	/**
	 * Format the set value
	 */
	if (setFunction) {
		// If the insertWrapper is defined, use it to format the value
		value = setFunction({value, field, sql_field});
	}

	return {field, sql_field, value};
}

/**
 * Return un-aliased field names
 *
 * @param {Schema} tableSchema - An object containing the table schema
 * @param {string} field - field identifier
 * @param {Dare} dareInstance - Dare Instance
 * @returns {string} Unaliased field name
 */
function unAliasFields(tableSchema, field, dareInstance) {
	const {alias} = getFieldAttributes(field, tableSchema, dareInstance);
	return alias || field;
}

/**
 * SetDefaultNotFoundHandler
 * As the name suggests
 * @param {QueryOptions} opts - query options
 * @returns {QueryOptions} query options
 */
function setDefaultNotFoundHandler(opts) {
	if (!('notfound' in opts)) {
		// Default handler is called when there are no results on a request for a single item
		opts.notfound = () => {
			throw new DareError(DareError.NOT_FOUND);
		};
	}

	return opts;
}

/**
 * Because Dare does not maintain field orders within the select, or the Get function maintaining the list of fields
 * We've resorted to acquiring the new list order where the SELECT fields... is used within an INSERT statement
 * @param {object} request - Object returned from format_request function
 * @returns {Array} an array of field names
 */
function walkRequestGetField(request) {
	const fields = [];

	// Get the field names of the current request...
	if (Array.isArray(request.fields)) {
		fields.push(
			...request.fields.flatMap(field =>
				typeof field === 'string' ? field : Object.keys(field)
			)
		);
	}

	// Iterate through the nested table joins and retrieve their fields
	if (Array.isArray(request._joins)) {
		fields.push(...request._joins.flatMap(walkRequestGetField));
	}

	return fields;
}
