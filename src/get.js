import DareError from './utils/error.js';
import group_concat from './utils/group_concat.js';
import field_format from './utils/field_format.js';
import orderbyUnwrap from './utils/orderby_unwrap.js';
import SQL, {Sql, raw, join, empty} from 'sql-template-tag';

function optionalJoin(arr, joiner, prefix) {
	if (!arr.length) {
		return empty;
	} else {
		return join(arr, joiner, prefix);
	}
}

export default function buildQuery(opts, dareInstance) {
	opts.root = true;

	// SubQuery
	const {is_subquery} = opts;

	// Traverse the Request Object
	const {
		fields,
		has_many_join,
		has_sub_queries,
		sql_joins,
		sql_filter,
		groupby,
		orderby,
	} = traverse(opts, is_subquery, dareInstance);

	// Get the root tableID
	const {sql_table, sql_alias} = opts;

	{
		// Count is a special field, find and replace ...
		fields
			.filter(item => item.expression === `${sql_alias}._count`)
			.forEach(item => {
				item.expression = 'COUNT(*)';
				item.label = '_count';
				item.agg = true;
			});

		// Find the special _group column...
		fields
			.filter(item => item.expression === `${sql_alias}._group`)
			.forEach(item => {
				// Pick the first_groupby statement
				item.expression = groupby[0].expression;
				item.label = '_group';
			});
	}

	/*
	 * Build up the SQL conditions
	 * e.g. filter= {category: asset, action: open, created_time: 2016-04-12T13:29:23Z..]
	 */
	if (opts.sql_where_conditions?.length) {
		sql_filter.push(...opts.sql_where_conditions);
	}

	/*
	 * Groupby
	 * If the content is grouped
	 * Ensure that the parent has opts.groupby when we're joining tables
	 */
	if (!is_subquery && !groupby.length && has_many_join) {
		// Are all the fields aggregates?
		const all_aggs = fields.every(item => item.agg);

		if (!all_aggs) {
			// Determine whether there are non?
			groupby.push({
				expression: `${opts.sql_alias}.${dareInstance.rowid}`,
			});
		}
	}

	// Format Fields
	let sql_fields;
	let alias;

	if (opts.negate && fields.length === 0) {
		sql_fields = [raw('1')];
	} else if (is_subquery) {
		// Generate a Group Concat statement of the result
		const address =
			opts.field_alias_path || opts._joins[0].field_alias_path;
		/*
		 * Sql_alias._rowid IS NOT NULL
		 * Get a non intermediate table for use as the sql_alias._rowid value.
		 */
		const gc_sql_alias = opts.field_alias_path
			? sql_alias
			: opts._joins[0].sql_alias;
		const gc = group_concat({
			fields,
			address,
			sql_alias: gc_sql_alias,
			rowid: dareInstance.rowid,
			engine: dareInstance.engine,
		});
		sql_fields = [raw(gc.expression)];
		alias = gc.label;
	} else {
		sql_fields = fields.map(field => {
			if (field instanceof Sql) {
				return field;
			}

			return raw(
				`${field.expression}${
					field.label ? ` AS "${field.label}"` : ''
				}`
			);
		});
	}

	// Clean up sql_orderby
	const sql_orderby = aliasOrderAndGroupFields(orderby, fields, dareInstance);

	// Clean up sql_orderby
	const sql_groupby = aliasOrderAndGroupFields(groupby, fields, dareInstance);

	// Convert to count the resultset
	if (opts.countRows) {
		// Change the rows to show the count of the rows returned
		sql_fields = [
			SQL`COUNT(DISTINCT ${
				sql_groupby.length
					? join(sql_groupby)
					: raw(`${opts.sql_alias}.${dareInstance.rowid}`)
			}) AS "count"`,
		];

		// Remove groupby and orderby...
		sql_groupby.length = 0;
		sql_orderby.length = 0;
	}

	// Fields should be a non-empty array
	if (!sql_fields.length) {
		/*
		 * This query does not contain any fields
		 * And so we should not include it
		 */
		throw new DareError(DareError.INVALID_REQUEST, 'Missing fields');
	}

	/*
	 * Workaround for MySQL 8.0 bug https://bugs.mysql.com/bug.php?id=109585
	 * -> When, all fields are aggregates
	 * -> And, this is a subquery
	 * -> Then, remove the limit
	 */
	if (dareInstance.engine?.startsWith('mysql:8') && alias) {
		if (fields.every(item => item.agg)) {
			opts.limit = null;
		}
	}

	// Put it all together
	return {
		sql_fields,
		sql_table,
		sql_alias,
		sql_joins,
		sql_filter,
		sql_groupby,
		sql_orderby,
		limit: opts.limit,
		start: opts.start,
		alias,
		has_sub_queries,
	};
}

/**
 * Generate a SQL SELECT statement
 * @param {object} opts - Options for generating the SQL statement
 * @param {Sql} [opts.sql_cte] - Common Table Expression (CTE) to use
 * @param {Array} opts.sql_fields - Fields to select
 * @param {string} opts.sql_table - The table to select from
 * @param {string} opts.sql_alias - Alias for the table
 * @param {Array} opts.sql_joins - Joins to include in the query
 * @param {Array} opts.sql_filter - Filters to apply to the query
 * @param {Array} opts.sql_groupby - Group by fields
 * @param {Array} opts.sql_orderby - Order by fields
 * @param {number} [opts.limit] - Limit the number of results
 * @param {number} [opts.start] - Offset for the results
 * @returns {Sql} - The SQL statement
 */
export function generateSQLSelect({
	sql_cte,
	sql_fields,
	sql_table,
	sql_alias,
	sql_joins,
	sql_filter,
	sql_groupby,
	sql_orderby,
	limit,
	start,
}) {
	return SQL`
		${sql_cte ? SQL`WITH ${sql_cte}` : empty}
		SELECT ${join(sql_fields)}
		FROM ${raw(sql_table)} ${raw(sql_alias)}
		${optionalJoin(sql_joins, '\n', '')}
		${optionalJoin(sql_filter, ' AND ', 'WHERE ')}
		${optionalJoin(sql_groupby, ',', 'GROUP BY ')}
		${optionalJoin(sql_orderby, ',', 'ORDER BY ')}
		${limit ? SQL`LIMIT ${raw(String(limit))}` : empty}
		${start ? SQL`OFFSET ${raw(String(start))}` : empty}
	`;
}

function traverse(item, is_subquery, dareInstance) {
	// Filters populate the filter and values (prepared statements)
	const sql_filter = [];

	// Fields
	const fields = [];

	/*
	 * List
	 * Store each item in a list
	 */
	const list = [];

	// Joins
	const sql_joins = [];

	// SQL GroupBy
	const groupby = [];

	// SQL GroupBy
	const orderby = [];

	const {parent} = item;

	const resp = {
		sql_filter,
		sql_joins,
		groupby,
		orderby,
		fields,
		list,
		has_many_join: false,
		has_sub_queries: false,
	};

	// Things to change if this isn't the root.
	if (parent) {
		// Adopt the parents settings
		const {many} = item;

		// Does this have a many join
		resp.has_many_join = many;

		/*
		 * We're unable to filter the subquery on a set of values
		 * So, Do any of the ancestors containing one-many relationships?
		 */
		let ancestors_many = false;

		{
			let x = item;
			while (x.parent) {
				if (x.parent.many) {
					ancestors_many = true;
					break;
				}
				x = x.parent;
			}
		}

		/*
		 * Should this be a sub query?
		 * The join is not required for filtering,
		 * And has a one to many relationship with its parent.
		 */
		if (
			!is_subquery &&
			!ancestors_many &&
			!item.required_join &&
			!item.has_filter &&
			many &&
			!item.groupby
		) {
			// Mark as subquery
			item.is_subquery = true;

			// Make the sub-query
			const sub_query = buildQuery(item, dareInstance);
			const sql_sub_query = SQL`(${generateSQLSelect(sub_query)}) AS "${raw(sub_query.alias)}"`;

			// Add the formatted field
			fields.push(sql_sub_query);

			// Mark as having sub queries
			resp.has_sub_queries = true;

			// The rest has been handled in the sub-query
			return resp;
		}
	}

	const {sql_alias} = item;

	if (parent) {
		// Update the values with the alias of the parent
		const sql_join_condition = item.sql_join_condition;

		const {required_join} = item;

		// Required Join
		item.required_join =
			required_join && (parent.required_join || parent.root);

		if (!item.is_subquery) {
			/*
			 * Required JOIN is used to lock table records together
			 * This ensures that authorisation in can be handled by another
			 */

			// If the parent is not required or the root
			if (required_join && !(parent.required_join || parent.root)) {
				// Enforce a join by adding filters based on the table relationships
				for (const x in item.join_conditions) {
					const val = item.join_conditions[x];
					sql_filter.push(
						raw(
							`(${sql_alias}.${x} = ${parent.sql_alias}.${val} OR ${parent.sql_alias}.${val} IS NULL)`
						)
					);
				}
			}

			// Append to the sql_join
			sql_joins.push(
				SQL`${item.required_join ? empty : raw('LEFT ')}JOIN ${raw(
					item.sql_table
				)} ${raw(sql_alias)} ON (${sql_join_condition})`
			);
		} else {
			// Merge the join condition on the filter
			sql_filter.push(sql_join_condition);
		}
	}

	/*
	 * Fields
	 * e.g. fields = [action, category, count, ...]
	 */
	if (item.fields) {
		// Yes, believe it or not but some queries do have them...
		item.fields.map(prepField).forEach(([expression, label]) => {
			fields.push(
				field_format(
					expression,
					label,
					sql_alias,
					item.field_alias_path
				)
			);
		});
	}

	// Traverse the next ones...
	if (item._joins) {
		item._joins.forEach(child => {
			// Traverse the decendent arrays
			const child_resp = traverse(child, is_subquery, dareInstance);

			// Merge the results into this
			for (const x in resp) {
				const a = resp[x];
				const b = child_resp[x];
				if (Array.isArray(a)) {
					a.push(...b);
				} else if (b) {
					resp[x] = b;
				}
			}
		});
	}

	// Groupby
	if (item.groupby) {
		// Either an empty groupby
		groupby.push(
			...item.groupby.map(field =>
				field_format(field, null, sql_alias, item.field_alias_path)
			)
		);
	}

	// Orderby
	if (item.orderby) {
		// Either an empty groupby
		const a = item.orderby.map(entry => {
			// Split the entry into field and direction
			const {field, direction} = orderbyUnwrap(entry);

			/*
			 * Create a Field object
			 * Extend object with direction
			 * Return the object
			 */
			return Object.assign(
				field_format(field, null, sql_alias, item.field_alias_path),
				{direction}
			);
		});

		orderby.push(...a);
	}

	/*
	 * When the item is not within a subquery
	 * And its contains a relationship of many to one
	 * Groups all the fields into GROUP_CONCAT
	 */
	if (item.many && !is_subquery && fields.length) {
		// Generate a Group Concat statement of the result
		const address =
			item.field_alias_path || item._joins[0].field_alias_path;
		/*
		 * Sql_alias._rowid IS NOT NULL
		 * Get a non intermediate table for use as the sql_alias._rowid value.
		 */
		const gc_sql_alias = item.field_alias_path
			? sql_alias
			: item._joins[0].sql_alias;
		const gc = group_concat({
			fields,
			address,
			sql_alias: gc_sql_alias,
			rowid: dareInstance.rowid,
			engine: dareInstance.engine,
		});

		// Reset the fields array
		fields.length = 0;
		fields.push(gc);
	}

	// Add this resource to the internal list
	list.push(item);

	return resp;
}

function prepField(field) {
	if (typeof field === 'string') {
		return [field];
	}

	let expression;
	let label;

	// Get the first entry of the object and return
	for (const _label in field) {
		expression = field[_label];
		label = _label;
		continue;
	}

	return [expression, label];
}

function aliasOrderAndGroupFields(arr, fields, dareInstance) {
	if (!arr?.length) {
		return [];
	}

	return arr.map(({expression, label, direction, original}) => {
		/*
		 * _count, etc...
		 * Is the value a shortcut to a labelled field?
		 * fields.find(_field => {
		 *   if (_field.label && _field.label === expression) {
		 *     return entry;
		 *   }
		 * });
		 */

		for (const field of fields) {
			// Does the expression belong to something in the fields?
			if (
				field.label &&
				(field.label === label || field.label === original)
			) {
				expression = dareInstance.identifierWrapper(field.label);
				break;
			}
		}

		return join(
			[expression, direction].filter(v => !!v).map(item => raw(item)),
			' '
		);
	});
}
