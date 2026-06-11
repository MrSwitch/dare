import SQL, {join} from 'sql-template-tag';
import Dare from './index.js';

/**
 * SQLiteDare
 * Extends Dare with SQLite-specific overrides
 *
 * @param {object} options - Initial options defining the instance
 * @returns {import('./index.js').default} instance of SQLiteDare
 */
function SQLiteDare(options = {}) {
	const instance = new Dare({
		...options,
		engine: options.engine || 'sqlite:3',
	});
	Object.setPrototypeOf(instance, SQLiteDare.prototype);
	return instance;
}

// Inherit from Dare
SQLiteDare.prototype = Object.create(Dare.prototype);
SQLiteDare.prototype.constructor = SQLiteDare;

/**
 * Default engine for SQLite
 * @type {string}
 */
SQLiteDare.prototype.engine = 'sqlite:3';

/**
 * SQLite uses `id` as the rowid (alias for rowid)
 * @type {string}
 */
SQLiteDare.prototype.rowid = 'id';

/**
 * SQLite uses LIKE (case-insensitive for ASCII by default)
 * @type {string}
 */
SQLiteDare.prototype.sql_keyword_like = 'LIKE';

/**
 * SQLite JSON EXTRACT prefix
 * @type {string}
 */
SQLiteDare.prototype.sql_json_extract_prefix = '$';

/**
 * SQLite JSON EXTRACT operator
 * @type {string}
 */
SQLiteDare.prototype.sql_json_extract_operator = '->';

/**
 * Sql_json_array - SQLite JSON_ARRAY
 * @type {Dare['sql_json_array']}
 */
SQLiteDare.prototype.sql_json_array = function sql_json_array(expressions) {
	return `JSON_ARRAY(${expressions.join(',')})`;
};

/**
 * SQL Array Agg - SQLite uses JSON_GROUP_ARRAY
 * @type {Dare['sql_json_arrayagg']}
 */
SQLiteDare.prototype.sql_json_arrayagg = function sql_json_arrayagg({
	sql_alias,
	expression,
}) {
	const condition = `CASE WHEN (${sql_alias}.${this.rowid} IS NOT NULL) THEN (${expression}) ELSE NULL END`;
	return `JSON_GROUP_ARRAY(${condition})`;
};

/**
 * SQLite does not support CTE LIMIT filtering
 * @type {Dare['applyCTELimitFiltering']}
 */
SQLiteDare.prototype.applyCTELimitFiltering = function () {
	return false;
};

/**
 * Apply limit on DML - SQLite supports LIMIT on DELETE but not in all contexts
 * @type {boolean}
 */
SQLiteDare.prototype.applyLimitOnDML = false;

/**
 * SQLite does not allow joining onto the table being modified in patch / delete requests
 * To work around this, we need to use subquery joins
 * @type {boolean}
 */
SQLiteDare.prototype.applySubqueryOnDML = true;

/**
 * Apply aliases to UPDATE statements - SQLite doesn't support this
 * @type {boolean}
 */
SQLiteDare.prototype.applyAliasesOnUpdate = false;

/**
 * SQLite does not support UPDATE tbl alias SET ...
 * @type {boolean}
 */
SQLiteDare.prototype.applyTableAliasOnUpdate = false;

/**
 * SQL insert suffix - SQLite uses RETURNING clause
 * @type {string}
 */
SQLiteDare.prototype.sql_insert_suffix = ` RETURNING id`;

/**
 * IdentifierWrapper - SQLite uses double quotes for identifiers
 * @type {Dare['identifierWrapper']}
 */
SQLiteDare.prototype.identifierWrapper = function identifierWrapper(field) {
	return ['"', field, '"'].join('');
};

/**
 * SQLite does not support DEFAULT keyword in VALUES, use NULL instead
 */
SQLiteDare.prototype.sql_default_value = null;

/**
 * On Duplicate Keys Update - SQLite uses ON CONFLICT with DO UPDATE/DO NOTHING
 * @type {Dare['onDuplicateKeysUpdate']}
 */
SQLiteDare.prototype.onDuplicateKeysUpdate = function onDuplicateKeysUpdate({
	keys = [],
	existing = [],
	duplicate_keys,
}) {
	if (!keys.length) {
		return `ON CONFLICT DO NOTHING`;
	}

	let conflictKeys;

	if (Array.isArray(duplicate_keys) && duplicate_keys.length) {
		conflictKeys = duplicate_keys;
	} else {
		conflictKeys = existing.filter(item => !keys.includes(item));

		if (!conflictKeys.length) {
			conflictKeys.push(this.rowid);
		}
	}

	return `
			ON CONFLICT (${conflictKeys.map(key => this.identifierWrapper(key)).join(',')})
				DO UPDATE
					SET ${keys.map(name => `${this.identifierWrapper(name)}=EXCLUDED.${this.identifierWrapper(name)}`).join(',')}
		`;
};

/**
 * FulltextSearch - SQLite implementation using FTS5 (if available) or LIKE fallback
 * SQLite FTS5 requires a virtual table, so we fall back to LIKE-based search
 * @type {Dare['fulltextSearch']}
 */
SQLiteDare.prototype.fulltextSearch = function fulltextSearch(
	sql_field_array,
	value,
	NOT
) {
	// Use LIKE-based fallback for fulltext search in SQLite
	const terms = value.trim().split(/\s+/).filter(Boolean);
	const conditions = terms.map(term => {
		const likeConditions = sql_field_array.map(
			field => SQL`${field} LIKE ${`%${term}%`}`
		);
		return SQL`(${join(likeConditions, ' OR ')})`;
	});
	return SQL`${NOT}(${join(conditions, ' AND ')})`;
};

/**
 * Pass through value verbatim for JSON formatting
 * @type {Dare['jsonFormatValue']}
 */
SQLiteDare.prototype.jsonFormatValue = function jsonFormatValue(value) {
	if (Array.isArray(value)) {
		return value.map(item => this.jsonFormatValue(item));
	}
	return value;
};

export default SQLiteDare;
