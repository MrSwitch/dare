import SQL, {join} from 'sql-template-tag';
import Dare from './index.js';

/**
 * PostgresDare
 * Extends Dare with Postgres-specific overrides
 *
 * @param {object} options - Initial options defining the instance
 * @returns {import('./index.js').default} instance of PostgresDare
 */
function PostgresDare(options = {}) {
	const instance = new Dare({
		...options,
		engine: options.engine || 'postgres:16',
	});
	Object.setPrototypeOf(instance, PostgresDare.prototype);
	return instance;
}

// Inherit from Dare
PostgresDare.prototype = Object.create(Dare.prototype);
PostgresDare.prototype.constructor = PostgresDare;

/**
 * Default engine for Postgres
 * @type {string}
 */
PostgresDare.prototype.engine = 'postgres:16';

/**
 * Postgres uses ILIKE for case-insensitive LIKE
 * @type {Dare['sql_keyword_like']}
 */
PostgresDare.prototype.sql_keyword_like = 'ILIKE';

/**
 * Postgres JSON EXTRACT prefix
 * @type {Dare['sql_json_extract_prefix']}
 */
PostgresDare.prototype.sql_json_extract_prefix = '';

/**
 * Postgres JSON EXTRACT operator
 * @type {Dare['sql_json_extract_operator']}
 */
PostgresDare.prototype.sql_json_extract_operator = '->>';

/**
 * Sql_json_array - Postgres JSON_ARRAY defaults to ABSENT ON NULL, so add NULL ON NULL
 * @type {Dare['sql_json_array']}
 */
PostgresDare.prototype.sql_json_array = function sql_json_array(expressions) {
	return `JSON_ARRAY(${expressions.join(',')} NULL ON NULL)`;
};

/**
 * Postgres uses `id` as the rowid
 * @type {string}
 */
PostgresDare.prototype.rowid = 'id';

/**
 * Apply limit on DML
 * Postgres does not allow joining onto the table being modified in patch / delete requests
 * To work around this, we need to use subquery joins for all joins in these requests
 * @type {Dare['applySubqueryOnDML']}
 */
PostgresDare.prototype.applySubqueryOnDML = true;

/**
 * Apply limit on DML operations - Postgres doesn't support this
 * @type {Dare['applyLimitOnDML']}
 */
PostgresDare.prototype.applyLimitOnDML = false;

/**
 * SQL insert suffix - for RETURNING clause for Postgres
 * @type {Dare['sql_insert_suffix']}
 */
PostgresDare.prototype.sql_insert_suffix = ` RETURNING id`;

/**
 * IdentifierWrapper - Postgres uses double quotes for identifiers
 * @type {Dare['identifierWrapper']}
 */
PostgresDare.prototype.identifierWrapper = function identifierWrapper(field) {
	return ['"', field, '"'].join('');
};

/**
 * On Duplicate Keys Update - Postgres uses ON CONFLICT with DO UPDATE/DO NOTHING
 * @type {Dare['onDuplicateKeysUpdate']}
 */
PostgresDare.prototype.onDuplicateKeysUpdate = function onDuplicateKeysUpdate({
	keys = [],
	existing = [],
}) {
	if (!keys.length) {
		return `ON CONFLICT DO NOTHING`;
	}

	return `
			ON CONFLICT (${existing.filter(item => !keys.includes(item)).join(',')})
				DO UPDATE
					SET ${keys.map(name => `${this.identifierWrapper(name)}=EXCLUDED.${this.identifierWrapper(name)}`).join(',')}
		`;
};

/**
 * FulltextSearch - Postgres implementation using tsvector/tsquery
 * @type {Dare['fulltextSearch']}
 */
PostgresDare.prototype.fulltextSearch = function fulltextSearch(
	sql_field_array,
	value,
	NOT
) {
	const field =
		sql_field_array.length === 1
			? sql_field_array.at(0)
			: SQL`TO_TSVECTOR(${join(sql_field_array, " || ' ' || ")})`;
	return SQL`${NOT}${field} @@ to_tsquery('english', ${this.fulltextParser(value)})`;
};

/**
 * Pass through value verbatim for JSON formatting, as Postgres handles this natively
 * @type {Dare['jsonFormatValue']}
 */
PostgresDare.prototype.jsonFormatValue = function jsonFormatValue(value) {
	if (Array.isArray(value)) {
		return value.map(item => this.jsonFormatValue(item));
	}
	return String(value);
};

export default PostgresDare;
