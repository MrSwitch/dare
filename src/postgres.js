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
 * Postgres uses `id` as the rowid
 * @type {string}
 */
PostgresDare.prototype.rowid = 'id';

/**
 * IdentifierWrapper - Postgres uses double quotes for identifiers
 * @param {string} field - Field name
 * @returns {string} Wrapped field
 */
PostgresDare.prototype.identifierWrapper = function identifierWrapper(field) {
	return ['"', field, '"'].join('');
};

/**
 * OnDuplicateKeysUpdate - Postgres implementation using ON CONFLICT
 * @this {import('./index.js').default}
 * @param {Array} keys - Keys to update on conflict
 * @param {Array} existing - Existing field list
 * @returns {string} SQL clause
 */
PostgresDare.prototype.onDuplicateKeysUpdate = function onDuplicateKeysUpdate(
	keys = [],
	existing = []
) {
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
 * @this {import('./index.js').default}
 * @param {import('sql-template-tag').Sql[]} sql_field_array - Array of SQL fields to apply the fulltext search to
 * @param {string} value - Fulltext search string
 * @param {import('sql-template-tag').Sql} [NOT] - Whether to negate the fulltext search
 * @returns {import('sql-template-tag').Sql} SQL condition for the fulltext search
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

export default PostgresDare;
