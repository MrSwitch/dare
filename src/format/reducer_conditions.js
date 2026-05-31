import SQL, {raw, join, empty} from 'sql-template-tag';
import checkKey from '../utils/validate_field.js';
import checkTableAlias from '../utils/validate_alias.js';
import formatDateTime from '../utils/format_datetime.js';
import getFieldAttributes from '../utils/field_attributes.js';
import unwrap_field from '../utils/unwrap_field.js';

/**
 * @import {Sql} from 'sql-template-tag'
 * @import Dare, {Engine} from '../index.js'
 *
 * Reduce conditions, call extract
 * @param {object} filter - Filter conditions
 * @param {object} options - Options object
 * @param {Function} options.extract - Extract (key, value) related to nested model
 * @param {string} options.sql_alias - Table SQL Alias, e.g. 'a', 'b', etc..
 * @param {object} options.table_schema - Table schema
 * @param {string|null} options.conditional_operators_in_value - Allowable conditional operators in value
 * @param {Dare} options.dareInstance - Dare Instance
 * @returns {Array<Sql>} Conditions object converted to an array of SQL conditions
 */
export default function reduceConditions(
	filter,
	{
		extract,
		sql_alias,
		table_schema,
		conditional_operators_in_value,
		dareInstance,
	}
) {
	const filterArr = [];

	// Explore the filter for any table joins
	for (let key in filter) {
		let value = filter[key];

		// Explode -key.path:value
		const {rootKey, rootKeyRaw, operators, subKey} = stripKey(key);

		// Update rootKey, this is stripped of negation prefix and sub paths
		key = rootKey;

		if (subKey) {
			value = {[subKey]: value};
		}

		// Format key and validate path
		const key_definition = table_schema[key];

		if (
			value &&
			typeof value === 'object' &&
			!(value instanceof Date) &&
			!Array.isArray(value) &&
			key_definition?.type !== 'json' &&
			!Buffer.isBuffer(value)
		) {
			// Check this is a path
			checkTableAlias(key);

			// Add it to the join table
			extract(rootKeyRaw, value);
		} else {
			filterArr.push(
				prepCondition({
					field: key,
					value,
					sql_alias,
					table_schema,
					operators,
					conditional_operators_in_value,
					dareInstance,
				})
			);
		}
	}

	return filterArr;
}

/**
 * Strip the key, removing any comparison operator prefix, and any shorthand nested properties
 * @param {string} key - Full length key, e.g. table, field, or `-root.path`, '%root.path', etc...
 * @returns {object} Containing the parts of the key
 */
function stripKey(key) {
	const [rootKeyRaw, ...subKeys] = key.split('.');

	const subKey = subKeys.join('.');

	let rootKey = rootKeyRaw;

	// Does this have a comparison operator prefix?
	const operators = rootKeyRaw.match(/^[%*~-]+/)?.[0];
	if (operators) {
		// Strip the special operators from the prop
		rootKey = rootKeyRaw.substring(operators.length);
	}

	return {rootKey, rootKeyRaw, subKey, operators};
}

/**
 * Prep condition
 * @param {object} params - Params
 * @param {string} params.field - Field name
 * @param {string} params.value - Field value
 * @param {string} params.sql_alias - SQL Alias
 * @param {object} params.table_schema - Table schema
 * @param {string|null} params.operators - Allowable operators
 * @param {string|null} params.conditional_operators_in_value - Allowable conditional operators in value
 * @param {Dare} params.dareInstance - Dare Instance
 * @returns {Sql} SQL condition
 */
function prepCondition({
	field,
	value,
	sql_alias,
	table_schema,
	operators = '',
	conditional_operators_in_value,
	dareInstance,
}) {

	// Does it have a negative comparison operator?
	const negate = operators.includes('-');

	// Does it have a FullText comparison operator
	const isFullText = operators.includes('*');

	// Set a handly NOT value
	const NOT = negate ? raw('NOT ') : empty;

	const sql_fields = getSqlFields({
		field,
		sql_alias,
		table_schema,
		dareInstance,
	});

	if (isFullText) {
		// Join the fields
		const sql_field_array = sql_fields.map(({sql}) => sql);

		return dareInstance.fulltextSearch(sql_field_array, value, NOT);
	} else if (sql_fields.length > 1) {
		/*
		 * Is the field an array of field names?
		 * Then we're going to perform an A=value OR B=value OR C=value... type query
		 */

		const fields = sql_fields.map(({field}) => field);

		return SQL`${NOT}(${join(
			fields.map(field =>
				prepCondition({
					field,
					value,
					sql_alias,
					table_schema,
					operators: operators.replace('-', ''),
					conditional_operators_in_value,
					dareInstance,
				})
			),
			' OR '
		)})`;
	}

	// Everything else is a single field...

	const {type, sql: sql_field} = sql_fields.at(0);

	// Update field
	field = sql_fields.at(0).field;

	// Format date time values
	if (type === 'datetime') {
		value = formatDateTime(value);

		// NOTE: Could we just return SQL from formatDateTime instead of ensuring an implicit range?
		if (!operators.includes('~')) {
			operators += '~'; // Add range operator
		}
	}
	// @ts-ignore
	else if (type === 'date' && value instanceof Date) {
		value = value.toISOString().split('T').at(0);
	}

	// JSON
	if (
		type === 'json' &&
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value)
	) {
		// Loop through the object and create the sql_field
		const sql_fields = json_contains({sql_field, value, dareInstance});

		// Return a single or a wrapped group
		return SQL`${NOT}(${join(
			sql_fields.map(({sql, value, operators}) =>
				sqlCondition({
					sql_field: sql,
					value,
					conditional_operators_in_value,
					operators,
					type,
					dareInstance,
				})
			),
			' AND '
		)})`;
	}

	return sqlCondition({
		sql_field,
		value,
		conditional_operators_in_value,
		operators,
		// Treat json as text
		type: type === 'json' ? 'text' : type,
		dareInstance,
	});
}

/**
 * SQL Condition
 * @param {object} params - Params
 * @param {Sql} params.sql_field - SQL Field
 * @param {string} params.value - Value
 * @param {string|null} params.conditional_operators_in_value - Allowable conditional operators in value
 * @param {string|null} params.operators - Operators
 * @param {string|null} params.type - Type
 * @param {Dare} params.dareInstance - Dare Instance
 * @returns {Sql} SQL condition
 */
function sqlCondition({
	sql_field,
	value,
	conditional_operators_in_value,
	operators,
	type,
	dareInstance,
}) {
	// Does it have a negative comparison operator?
	const negate = operators.includes('-');

	// Set a handly NOT value
	const NOT = negate ? raw('NOT ') : empty;

	// Does it have a Likey comparison operator
	const isLikey = operators.includes('%');

	// Does it have a Range comparison operator
	const isRange = operators.includes('~');

	// Allow conditional likey operator in value
	const allow_conditional_likey_operator_in_value =
		conditional_operators_in_value?.includes('%');

	// Allow conditional negation operator in value
	const allow_conditional_negate_operator_in_value =
		conditional_operators_in_value?.includes('!');

	// Allow conditional negation operator in value
	const allow_conditional_range_operator_in_value =
		conditional_operators_in_value?.includes('~');

	const LIKE = raw(dareInstance.sql_keyword_like);

	/*
	 * Range
	 * A range is denoted by two dots, e.g 1..10
	 */
	const a =
		typeof value === 'string'
			? value.split('..')
			: isRange && Array.isArray(value) && value;

	if (
		(allow_conditional_range_operator_in_value || isRange) &&
		Array.isArray(a) &&
		a.length === 2
	) {
		let sql;

		if (a[0] && a[1]) {
			sql = SQL`${sql_field} BETWEEN ${a[0]} AND ${a[1]}`;
		} else if (a[0]) {
			sql = SQL`${sql_field} > ${a[0]}`;
		} else {
			sql = SQL`${sql_field} < ${a[1]}`;
		}

		if (negate) {
			sql = SQL`(NOT ${sql} OR ${sql_field} IS NULL)`;
		}

		return sql;
	}

	// Not match
	else if (
		typeof value === 'string' &&
		allow_conditional_negate_operator_in_value &&
		value[0] === '!'
	) {
		return SQL`${sql_field} NOT ${LIKE} ${value.slice(1)}`;
	}

	// String partial match
	else if (
		typeof value === 'string' &&
		(isLikey ||
			(allow_conditional_likey_operator_in_value && value.match('%')))
	) {
		const strValue =
			type === 'json'
				? dareInstance.jsonFormatValue(value, 'LIKE')
				: value;

		return SQL`${sql_field} ${NOT}${LIKE} ${strValue}`;
	}

	// Null
	else if (value === null) {
		return SQL`${sql_field} IS ${NOT}NULL`;
	} else if (Array.isArray(value) && value.length === 0) {
		/*
		 * Request filter includes empty array of possible values
		 * @todo break execution and return empty resultset.
		 * This workaround adds SQL `...AND false` to the conditions which makes the response empty
		 */
		// If the filter array is empty, then if negated ignore it (... AND true), else exclude everything (... AND false)
		return SQL`${sql_field} AND ${Boolean(negate)}`;
	}

	// Add to the array of items
	else if (Array.isArray(value)) {
		// Sub
		const sub_values = [];
		const conds = [];

		/*
		 * Filter the results of the array...
		 * Remove things which can't be used within `IN`, i.e. where `NULL` comparison via `LIKE` etc...
		 */
		const filteredValue = value.filter(item => {
			// Remove the items which can't in group statement...
			if (
				item !== null &&
				!(
					typeof item === 'string' &&
					(allow_conditional_likey_operator_in_value || isLikey) &&
					item.match('%')
				)
			) {
				return true;
			}

			// Put into a separate list...
			sub_values.push(item);

			return false;
		});

		// Use the `IN(...)` for items which can be grouped...
		if (filteredValue.length) {
			const items =
				type === 'json'
					? dareInstance.jsonFormatValue(filteredValue, 'IN')
					: filteredValue;

			let condition = SQL`${sql_field} ${NOT}IN (${join(items)})`;

			if (negate && !value.includes(null)) {
				// If negated, and the value is not null, then add the null check
				condition = SQL`(${condition} OR ${sql_field} IS NULL)`;
			}

			conds.push(condition);
		}

		// Other Values which can't be grouped ...
		conds.push(
			...sub_values.map(item =>
				sqlCondition({
					sql_field,
					value: item,
					operators,
					conditional_operators_in_value,
					type,
					dareInstance,
				})
			)
		);

		// Return a single or a wrapped group
		return conds.length === 1
			? conds.at(0)
			: SQL`(${join(conds, negate ? ' AND ' : ' OR ')})`;
	} else {
		const strValue =
			type === 'json' ? dareInstance.jsonFormatValue(value, '=') : value;

		let condition = SQL`${sql_field} ${raw(negate ? '!' : '')}= ${strValue}`;

		if (negate) {
			/*
			 * NULL-safe equality operator
			 * @see {@link https://vettabase.com/null-comparisons-in-mariadb-postgresql-and-sqlite/}
			 * If negated, then add the null check
			 */
			condition = SQL`(${condition} OR ${sql_field} IS NULL)`;
		}
		return condition;
	}
}

/**
 * JSON Contains
 * @param {object} params - Params
 * @param {Sql} params.sql_field - SQL Field
 * @param {any} params.value - Value
 * @param {string} [params.path] - Path
 * @param {string} [params.operators] - Operators
 * @param {Dare} [params.dareInstance] - Engine
 * @returns {Array<{sql: Sql, value: any, operators: string}>} SQL conditions
 */
function json_contains({
	sql_field,
	value,
	path = null,
	operators = '',
	dareInstance,
}) {
	if (!path) {
		path = dareInstance.sql_json_extract_prefix; // MySQL JSON_EXTRACT prefix, e.g. '$'
	}

	const conds = [];

	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		const separator = dareInstance.sql_json_extract_operator;

		return [
			{
				sql: SQL`${sql_field}${raw(separator)}${path}`,
				value,
				operators,
			},
		];
	}

	for (const key in value) {
		const {operators: newOperators, rootKey} = stripKey(key);
		conds.push(
			...json_contains({
				sql_field,
				value: value[key],
				path: [path, rootKey].filter(Boolean).join('.'),
				operators: operators + newOperators,
				dareInstance,
			})
		);
	}

	return conds;
}

/**
 * Get SQL fields
 * @param {object} params - Params
 * @param {string} params.field - Fields
 * @param {string} params.sql_alias - SQL Alias
 * @param {object} params.table_schema - Table schema
 * @param {Dare} params.dareInstance - Dare Instance
 * @returns {Array<{field: string, type: string, sql: Sql}>} SQL fields
 */
function getSqlFields({field, sql_alias, table_schema, dareInstance}) {
	// Split the fields
	const fields = field.split(',');

	// Extract the field attributes, and in particular the alias, does it need further transformation?
	return fields.flatMap(field => {
		// Format key and validate path
		field = checkKey(field);

		const {alias, type} = getFieldAttributes(
			field,
			table_schema,
			dareInstance
		);

		if (alias) {
			// The key definition says the key is an alias
			field = alias;

			// Field contains a comma and no brackets, so it has an array of values, but is not a function
			if (field.includes(',') && !field.includes('(')) {
				// The alias has multiple fields
				return getSqlFields({
					field,
					sql_alias,
					table_schema,
					dareInstance,
				});
			}
		}

		// Define the field definition
		let sql = raw(`${sql_alias}.${field}`);

		/*
		 * Should the field contain a SQL Function itself
		 * -> Let's extract it...
		 */
		if (/[^\w$.]/.test(field)) {
			const {prefix, suffix, field: rawField} = unwrap_field(field);

			// Ammend the sql_field
			sql = raw(`${prefix}${sql_alias}.${rawField}${suffix}`);
		}

		// Derive the SQL field name
		return {
			field,
			type,
			sql,
		};
	});
}
