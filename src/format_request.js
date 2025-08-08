import SQL, {empty, join, raw} from 'sql-template-tag';
import DareError from './utils/error.js';
import fieldReducer from './format/field_reducer.js';
import groupbyReducer from './format/groupby_reducer.js';
import orderbyReducer from './format/orderby_reducer.js';
import reduceConditions from './format/reducer_conditions.js';
import limitClause from './format/limit_clause.js';
import joinHandler from './format/join_handler.js';
import getFieldAttributes from './utils/field_attributes.js';
import extend from './utils/extend.js';
import buildQuery, { generateSQLSelect } from './get.js';

/**
 * @import {Sql} from 'sql-template-tag'
 * @import Dare, {QueryOptions} from './index.js'
 */

/**
 * Format Request initiation
 *
 * @param {object} options - Options object
 * @returns {object} Formatted options
 */
export default function (options) {
	return format_request(options, this);
}

/**
 * @typedef {object} SimpleNode
 * @property {string} alias - Alias
 * @property {string} field_alias_path - Field alias path
 * @property {string} table - Table name
 */

/**
 * Format Request
 *
 * @param {QueryOptions} options - Current iteration
 * @param {Dare} dareInstance - Instance of Dare
 * @returns {Promise<QueryOptions>} formatted object with all the joins
 */
async function format_request(options, dareInstance) {
	if (!options) {
		throw new DareError(
			DareError.INVALID_REQUEST,
			`Invalid options '${options}'`
		);
	}

	// Use the alias to find the real table name
	if (!options.alias) {
		const alias = options.table;
		options.alias = alias;
	}

	/*
	 * Reject when the table is not provided
	 */
	if (!options.table) {
		throw new DareError(
			DareError.INVALID_REQUEST,
			'`table` option is undefined'
		);
	}

	/*
	 * Get option settings
	 */
	const {conditional_operators_in_value, method, models, state} =
		dareInstance.options;

	/**
	 * Assign the state to the options if it is not already defined
	 */
	options.state ??= state;

	/*
	 * Options name defines the model name
	 */
	options.name = dareInstance.table_alias_handler(options.table);

	/*
	 * Retrieve the model based upon the model name (alias)
	 */
	const model = models?.[options.name] || {};

	/*
	 * Set the SQL Table, If the model redefines the table name otherwise use the model Name
	 */
	options.sql_table = model.table || options.name;

	/**
	 * Hack
	 * To resolve mysql bug with aliasing in DELETE operations with a LIMIT https://bugs.mysql.com/bug.php?id=89410
	 * Preset the sql_table based upon the actual table name conditions with the same alias will work.
	 * TODO [MySQL-5.6/5.7] remove when only supporting MySQL-8
	 * TODO [mysql#89410]: Remove the conditional assignment when we're not presetting sql_alias in DELETE operation
	 */
	if (options.method === 'del' && !options.parent) {
		options.sql_alias = options.sql_table;
	} else {
		/** EOF Hack */
		options.sql_alias = dareInstance.get_unique_alias();
	}

	const {sql_alias} = options;

	/*
	 * Call bespoke table handler
	 * This may modify the incoming options object, ammend after handler, etc...
	 */
	{
		/*
		 * Mutation operations only exist on the root level table
		 * Nested tables should use the get() handler as they only filter
		 */
		const derivedMethod = options.parent ? 'get' : method;

		// If the model does not define the method
		const handler =
			derivedMethod in model
				? model[derivedMethod]
				: // Or use the default model
					models?.default?.[derivedMethod];

		if (handler) {
			// Trigger the handler which alters the options...
			await handler.call(dareInstance, options, dareInstance);
		}
	}

	// Get the schema
	const {schema: table_schema = {}} = model;

	/*
	 * Apply defaultValues to join
	 */
	{
		Object.keys(table_schema).forEach(key => {
			const {defaultValue} = getFieldAttributes(
				key,
				table_schema,
				dareInstance
			);

			/*
			 * Check the defaultValue for the method has been assigned
			 * -> That there is no definition for the value in the filter and join options
			 * -> That we're trying to get their original field names
			 */
			if (defaultValue !== undefined) {
				// Does the fields exist?
				const filterHasKey = Object.keys({
					...options.filter,
					...options.join,
				})
					.map(
						filterKey =>
							dareInstance.getFieldKey(filterKey, table_schema) ||
							filterKey
					)
					.includes(key);

				// If there is no match
				if (!filterHasKey) {
					// Extend the join object with the default value
					extend(options, {join: {[key]: defaultValue}});
				}
			}
		});
	}

	// Set the prefix if not already
	options.field_alias_path = options.field_alias_path || '';

	const {field_alias_path} = options;

	// Current Path
	const current_path = field_alias_path || `${options.alias}.`;

	// Create a shared object to provide nested objects
	const joined = {};

	/**
	 * Extract nested Handler
	 * @param {string} propName - Type of item
	 * @param {boolean} isArray - Is array, otherwise expect object
	 * @param {string} key - Key to extract
	 * @param {*} value - Value to extract
	 * @returns {void} - Nothing
	 */
	function extractJoined(propName, isArray, key, value) {
		if (!joined[key]) {
			joined[key] = {};
		}

		// Set default...
		joined[key][propName] = joined[key][propName] || (isArray ? [] : {});

		// Handle differently
		if (isArray) {
			joined[key][propName].push(...value);
		} else {
			joined[key][propName] = {...joined[key][propName], ...value};
		}
	}

	/** @type {Array<Sql>} */
	const sql_filters = [];

	// Format filters
	if (options.filter) {
		// Filter must be an object with key=>values
		if (typeof options.filter !== 'object') {
			throw new DareError(
				DareError.INVALID_REFERENCE,
				`The filter property value '${options.filter}' is invalid. Expected a JS object`
			);
		}

		// Extract nested filters handler
		const extract = extractJoined.bind(null, 'filter', false);

		// Return array of immediate props
		const arr = reduceConditions(options.filter, {
			extract,
			sql_alias,
			table_schema,
			conditional_operators_in_value,
			dareInstance,
		});

		// Add to filters
		sql_filters.push(...arr);
	}

	// Format fields
	if (options.fields) {
		// Fields must be an array, or a dictionary (aka object)
		if (typeof options.fields !== 'object') {
			throw new DareError(
				DareError.INVALID_REFERENCE,
				`The field definition '${options.fields}' is invalid.`
			);
		}

		// Extract nested fields handler
		const extract = extractJoined.bind(null, 'fields', true);

		// Set reducer options
		const reducer = fieldReducer({
			field_alias_path,
			extract,
			table_schema,
			dareInstance,
		});

		// Return array of immediate props
		options.fields = toArray(options.fields).reduce(reducer, []);
	}

	/** @type {Array<Sql>} */
	const sql_join_condition = [];

	// Format conditional joins
	if (options.join) {
		// Filter must be an object with key=>values
		if (typeof options.join !== 'object') {
			throw new DareError(
				DareError.INVALID_REFERENCE,
				`The join property value '${options.join}' is invalid, expected an JS object.`
			);
		}

		// Is a required join?
		if ('_required' in options.join) {
			// Has _required join?
			options.required_join = options.join._required;

			// Filter out _required
			delete options.join._required;
		}

		// Extract nested joins handler
		const extract = extractJoined.bind(null, 'join', false);

		// Return array of immediate props
		const arrJoins = reduceConditions(options.join, {
			extract,
			sql_alias,
			table_schema,
			conditional_operators_in_value,
			dareInstance,
		});

		/*
		 * Convert root joins to filters...
		 */
		if (arrJoins.length && !options.parent) {
			sql_filters.push(...arrJoins);
		} else {
			sql_join_condition.push(...arrJoins);
		}
	}

	/**
	 * Can we stop here?
	 */
	if (
		options.parent &&
		!options.required_join &&
		!options.has_fields &&
		!options.has_filter
	) {
		// Prevent this join from being included.
		return;
	}

	/*
	 * Groupby
	 * If the content is grouped
	 */
	if (options.groupby) {
		// Extract nested groupby handler
		const extract = extractJoined.bind(null, 'groupby', true);

		// Set reducer options
		const reducer = groupbyReducer({current_path, extract});

		// Return array of immediate props
		options.groupby = toArray(options.groupby).reduce(reducer, []);
	}

	/*
	 * Orderby
	 * If the content is ordered
	 */
	if (options.orderby) {
		// Extract nested orderby handler
		const extract = extractJoined.bind(null, 'orderby', true);

		// Set reducer options
		const reducer = orderbyReducer({
			current_path,
			extract,
			table_schema,
			dareInstance,
		});

		// Return array of immediate props
		options.orderby = toArray(options.orderby).reduce(reducer, []);
	}

	// Set default limit
	{
		const limits = limitClause(options, dareInstance.MAX_LIMIT);
		Object.assign(options, limits);
	}

	// Joins
	{
		/** @type {Array<QueryOptions>} */
		const joins = options.joins || [];

		// Add additional joins which have been derived from nested fields and filters...
		for (const alias in joined) {
			// Furnish the join table a little more...
			const join_object = Object.assign(joined[alias], {
				alias,
				field_alias_path: `${options.field_alias_path}${alias}.`,
				table: dareInstance.table_alias_handler(alias),
			});

			/*
			 * Join referrencing
			 * Create the join_conditions which link two tables together
			 */
			const new_join_object = joinHandler(
				join_object,
				options,
				dareInstance
			);

			// Reject if the join handler returned a falsy value
			if (!new_join_object) {
				throw new DareError(
					DareError.INVALID_REFERENCE,
					`Could not understand field '${alias}'`
				);
			}

			// Mark the join object to negate
			new_join_object.negate = alias.startsWith('-');

			// Help the GET parser

			// Does this contain a nested filter, orderby or groupby?
			join_object.has_filter = new_join_object.has_filter = Boolean(
				join_object.filter || join_object.orderby || join_object.groupby
			);

			// Does this contain nested fields
			join_object.has_fields = new_join_object.has_fields =
				!!(Array.isArray(join_object.fields)
					? join_object.fields.length
					: join_object.fields);

			// Update the request with this table join
			joins.push(new_join_object);
		}

		// Loop through the joins array
		if (joins.length) {
			// Loop through the joins and pass through the formatter
			const a = joins.map(async join_object => {
				// Set the parent
				join_object.parent = options;

				// Format join...
				const formatedObject = await format_request(
					join_object,
					dareInstance
				);

				// If this is present
				if (formatedObject) {
					// The handler may have assigned filters when their previously wasn't any
					formatedObject.has_filter ||= Boolean(
						formatedObject.filter
					);
				}

				return formatedObject;
			});

			// Add Joins
			const arr = await Promise.all(a);

			options._joins = arr.filter(Boolean);
		}
	}

	/*
	 * Construct the SQL WHERE Condition
	 */

	{
		// Place holder

		// Get nested filters
		if (options._joins) {
			sql_filters.push(
				...options._joins.flatMap(
					({sql_where_conditions}) => sql_where_conditions
				)
			);
		}

		// Assign
		/** @type {Array<Sql>} */
		options.sql_where_conditions = sql_filters.filter(Boolean);
	}

	// Initial SQL JOINS reference
	options.sql_joins = [];

	/**
	 * Construct the join conditions
	 * If this item has a parent, it'll require a join statement with conditions
	 */
	if (options.parent) {
		// Join_conditions, defines how a node is linked to its parent
		for (const x in options.join_conditions) {
			const val = options.join_conditions[x];
			sql_join_condition.push(
				raw(
					`${options.sql_alias}.${x} = ${options.parent.sql_alias}.${val}`
				)
			);
		}

		options.sql_join_condition = join(sql_join_condition, ' AND ');

		// Create the SQL JOIN conditions syntax
		options.sql_joins.push(
			SQL`JOIN ${raw(options.sql_table)} ${raw(options.sql_alias)} ON (${
				options.sql_join_condition
			})`
		);
	}

	// Add nested joins
	if (Array.isArray(options._joins)) {
		// Update sql_joins
		options.sql_joins.push(
			...options._joins
				.flatMap(({sql_joins}) => sql_joins)
				.filter(Boolean)
		);
	}

	/**
	 * Negate
	 * NOT EXIST (SELECT 1 FROM alias WHERE join_conditions)
	 */
	if (options.negate || options.parent?.forceSubquery) {
		// Mark as another subquery
		let sql_where_conditions = [];

		const sql_negate = options.negate ? raw('NOT') : empty;

		if (method === 'get') {
			// Get queries can be much simpler, we're allowed to use the same table in an exist statement like...
			options.is_subquery = true;

			// Create sub_query
			const sub_query = buildQuery(options, dareInstance);
			// Create the SQL 
			const sql_sub_query = generateSQLSelect(sub_query);

			sql_where_conditions = [SQL`${sql_negate} EXISTS (${sql_sub_query})`];
		} else {
			/*
			 * Whilst patch and delete will throw an ER_UPDATE_TABLE_USED error
			 * The query must not reference the table, so we need to be quite sneaky
			 */

			const parentReferences = Object.values(options.join_conditions).map(
				val => `${options.parent.sql_alias}.${val}`
			);

			// Create sub_query
			options.fields = Object.keys(options.join_conditions);
			options.limit = null; // MySQL 5.6 doesn't yet support 'LIMIT & IN/ALL/ANY/SOME subquery'
			options.many = null; // Do not attempt to CONCAT the fields
			options.field_alias_path = ''; // Do not prefix the fields labels
			options.parent = null; // Do not add superfluous joins

			const sub_query = buildQuery(options, dareInstance);
			const sql_sub_query = generateSQLSelect(sub_query);

			sql_where_conditions = [
				SQL`${raw(parentReferences[0])}
				${sql_negate} IN (
					SELECT ${join(options.fields.map(field => raw(String(field))))} FROM (
						${sql_sub_query}
					) AS ${raw(options.sql_alias)}_tmp
				)
			`,
			];
		}

		// Update the filters
		return {
			sql_where_conditions,
		};
	}

	return options;
}

function toArray(a) {
	if (typeof a === 'string') {
		a = a.split(',').map(s => s.trim());
	} else if (!Array.isArray(a)) {
		a = [a];
	}
	return a;
}
