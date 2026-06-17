import SQL, {raw, join, empty} from 'sql-template-tag';
import Dare from './index.js';

/**
 * MSSQLDare
 * Extends Dare with Microsoft SQL Server-specific overrides
 *
 * @param {object} options - Initial options defining the instance
 * @returns {import('./index.js').default} instance of MSSQLDare
 */
function MSSQLDare(options = {}) {
	const instance = new Dare({
		...options,
		engine: options.engine || 'mssql:2022',
	});
	Object.setPrototypeOf(instance, MSSQLDare.prototype);
	return instance;
}

// Inherit from Dare
MSSQLDare.prototype = Object.create(Dare.prototype);
MSSQLDare.prototype.constructor = MSSQLDare;

/**
 * Default engine for MS SQL Server
 * @type {string}
 */
MSSQLDare.prototype.engine = 'mssql:2022';

/**
 * MS SQL Server uses `id` as the rowid
 * @type {string}
 */
MSSQLDare.prototype.rowid = 'id';

/**
 * MS SQL Server uses LIKE (case-insensitivity is collation dependent, default installs are case-insensitive)
 * @type {Dare['sql_keyword_like']}
 */
MSSQLDare.prototype.sql_keyword_like = 'LIKE';

/**
 * Defaul SQL wildcard character for fulltext searches
 * @type {Dare['sql_fulltext_wildcard']}
 */
MSSQLDare.prototype.sql_fulltext_wildcard = '%';

/**
 * MSSQL JSON EXTRACT prefix
 * @type {Dare['sql_json_extract_prefix']}
 */
MSSQLDare.prototype.sql_json_extract_prefix = '$';

/**
 * IdentifierWrapper - MS SQL Server wraps identifiers in square brackets
 * @type {Dare['identifierWrapper']}
 */
MSSQLDare.prototype.identifierWrapper = function identifierWrapper(field) {
	return ['[', field, ']'].join('');
};

/**
 * Sql_limit_clause - MS SQL Server uses OFFSET ... FETCH instead of LIMIT ... OFFSET
 * An ORDER BY clause is mandatory when OFFSET is used, so a stable no-op ordering
 * is injected when the statement does not already define one.
 * @type {Dare['sql_limit_clause']}
 */
MSSQLDare.prototype.sql_limit_clause = function sql_limit_clause({
	limit,
	start,
	sql_orderby,
	sql_alias,
	sql_fields,
	sql_groupby,
}) {
	if (!limit && !start) {
		return empty;
	}

	// OFFSET ... FETCH requires an ORDER BY, inject a deterministic no-op when absent
	const hasOrderBy =
		Array.isArray(sql_orderby) &&
		sql_orderby.some(item => {
			if (!item) {
				return false;
			}
			if (typeof item === 'string') {
				return item.trim().length > 0;
			}
			if ('expression' in item && typeof item.expression === 'string') {
				return item.expression.trim().length > 0;
			}
			return true;
		});

	const hasAggregateField =
		Array.isArray(sql_fields) &&
		sql_fields.some(field => {
			const expression =
				typeof field === 'string'
					? field
					: typeof field?.expression === 'string'
						? field.expression
						: typeof field?.sql === 'string'
							? field.sql
							: '';

			return /\b(?:count|sum|avg|max|min|string_agg|json_arrayagg|group_concat)\s*\(/i.test(
				expression
			);
		});

	const hasGroupBy = Array.isArray(sql_groupby) && sql_groupby.length > 0;

	const fallbackOrderBy = sql_alias
		? hasAggregateField && !hasGroupBy
			? SQL`ORDER BY (SELECT NULL)`
			: SQL`ORDER BY ${raw(sql_alias)}.${raw(this.rowid)}`
		: SQL`ORDER BY (SELECT NULL)`;

	const orderby = hasOrderBy ? empty : fallbackOrderBy;

	const offset = SQL`OFFSET ${raw(String(start || 0))} ROWS`;

	const fetch = limit
		? SQL`FETCH NEXT ${raw(String(limit))} ROWS ONLY`
		: empty;

	return SQL`${orderby} ${offset} ${fetch}`;
};

/**
 * Sql_expression_literal - MSSQL prefers 1/0 for boolean scalar literals in SELECT clauses
 * @type {Dare['sql_expression_literal']}
 */
MSSQLDare.prototype.sql_expression_literal = function sql_expression_literal(
	value
) {
	if (value === null) {
		return 'NULL';
	}
	if (typeof value === 'boolean') {
		return value ? '1' : '0';
	}
	return String(value);
};

/**
 * Apply limit on DML - MS SQL Server does not support LIMIT on UPDATE/DELETE
 * @type {Dare['applyLimitOnDML']}
 */
MSSQLDare.prototype.applyLimitOnDML = false;

/**
 * MS SQL Server does not allow joining onto the table being modified in patch / delete requests
 * To work around this, we use subquery joins
 * @type {Dare['applySubqueryOnDML']}
 */
MSSQLDare.prototype.applySubqueryOnDML = true;

/**
 * Apply aliases to UPDATE statements - MS SQL Server uses a different UPDATE ... FROM syntax
 * @type {Dare['applyAliasesOnUpdate']}
 */
MSSQLDare.prototype.applyAliasesOnUpdate = false;

/**
 * SQL insert output - MS SQL Server returns the inserted id via the OUTPUT clause
 * @type {Dare['sql_insert_output']}
 */
MSSQLDare.prototype.sql_insert_output = `OUTPUT INSERTED.id`;

/**
 * Sql_json_array - MSSQL JSON_ARRAY defaults to ABSENT ON NULL, so add NULL ON NULL
 * @type {Dare['sql_json_array']}
 */
MSSQLDare.prototype.sql_json_array = function sql_json_array(expressions) {
	return `JSON_ARRAY(${expressions.join(',')} NULL ON NULL)`;
};

/**
 * Sql_json_extract - MSSQL uses JSON_VALUE for scalar extraction
 * @type {Dare['sql_json_extract']}
 */
MSSQLDare.prototype.sql_json_extract = function sql_json_extract({
	sql_field,
	path,
}) {
	return SQL`JSON_VALUE(${sql_field}, ${path})`;
};

/**
 * Sql_json_arrayagg - MS SQL Server (2022) lacks JSON_ARRAYAGG, build the array using STRING_AGG
 * @type {Dare['sql_json_arrayagg']}
 */
MSSQLDare.prototype.sql_json_arrayagg = function sql_json_arrayagg({
	sql_alias,
	expression,
}) {
	const condition = `CASE WHEN (${sql_alias}.${this.rowid} IS NOT NULL) THEN (${expression}) ELSE NULL END`;
	return `CONCAT('[', STRING_AGG(${condition}, ','), ']')`;
};

/**
 * On Duplicate Keys Update - MS SQL Server has no inline upsert clause (MERGE is a separate statement)
 * @type {Dare['onDuplicateKeysUpdate']}
 */
MSSQLDare.prototype.onDuplicateKeysUpdate = function onDuplicateKeysUpdate() {
	// Upsert behavior is handled in MSSQLDare.prototype.post
	return '';
};

/**
 * MS SQL Server does not support MySQL/Postgres inline upsert syntax in INSERT statements
 * @type {Dare['supportsInlineUpsert']}
 */
MSSQLDare.prototype.supportsInlineUpsert = false;

/**
 * FulltextSearch - MS SQL Server implementation
 * MS SQL Server full-text search requires a configured full-text catalog and index.
 * To remain portable, this falls back to a LIKE based search across the provided fields.
 * @type {Dare['fulltextSearch']}
 */
MSSQLDare.prototype.fulltextSearch = function fulltextSearch(
	sql_field_array,
	value,
	NOT
) {
	// Parse MySQL-style fulltext input into MSSQL LIKE-compatible terms
	const terms = String(value)
		.split(/\s+/)
		.map(term => term.trim())
		.filter(Boolean)
		.map(term => term.replace(/^[&+<>~-]+/, ''))
		.map(term => term.replace(/^"(?<quoted>.*)"$/, '$<quoted>'))
		.map(term => term.replace(/[()]/g, ''))
		.map(term => term.replace(/\*$/g, '%'))
		.map(term => term.replace(/\*/g, '%'))
		.filter(Boolean);

	if (!terms.length) {
		return SQL`${NOT}(1 = 0)`;
	}

	const perTerm = terms.map(term => {
		let like = term;
		if (!like.startsWith('%')) {
			like = `%${like}`;
		}
		if (!like.endsWith('%')) {
			like = `${like}%`;
		}
		return SQL`(${join(
			sql_field_array.map(field => SQL`${field} LIKE ${like}`),
			' OR '
		)})`;
	});

	// Terms are ANDed together, each term can match any target field
	return SQL`${NOT}(${join(perTerm, ' AND ')})`;
};

/**
 * FulltextSignParser - MS SQL Server LIKE fallback does not use the MySQL boolean operators
 * @type {Dare['fulltextSignParser']}
 */
MSSQLDare.prototype.fulltextSignParser = function fulltextSignParser(sign) {
	return sign.replace(/[+<>~]/g, '');
};

/**
 * Pass through value verbatim for JSON formatting, as MS SQL Server handles this natively
 * @type {Dare['jsonFormatValue']}
 */
MSSQLDare.prototype.jsonFormatValue = function jsonFormatValue(value) {
	if (Array.isArray(value)) {
		return value.map(item => this.jsonFormatValue(item));
	}

	if (value === null || value === undefined) {
		return null;
	}

	// JSON_VALUE in MSSQL returns text, so compare against text forms
	return String(value);
};

export default MSSQLDare;
