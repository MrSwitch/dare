import BaseEngine from './base-engine.js';

/**
 * SQLite Engine Plugin
 * Handles SQLite-specific database operations and SQL generation
 */
export default class SQLiteEngine extends BaseEngine {
	constructor(version = '3') {
		super(version);
		this.engine = `sqlite:${this.version}`;
	}

	/**
	 * SQLite uses 'rowid' as the implicit row ID
	 * @returns {string} The row ID field name
	 */
	getRowIdField() {
		return 'rowid';
	}

	/**
	 * SQLite has limited JSON support - may need custom implementations
	 * @returns {boolean} True if JSON_ARRAY is supported
	 */
	supportsJsonArray() {
		// SQLite 3.38+ has JSON functions, but implementation may vary
		return false; // Conservative default - can be overridden based on version
	}

	/**
	 * SQLite doesn't have JSON_ARRAYAGG
	 * @returns {boolean} Always false for SQLite
	 */
	supportsJsonArrayAgg() {
		return false;
	}

	/**
	 * SQLite uses legacy array concatenation
	 * @param {Array<string>} expressions - Field expressions
	 * @returns {string} Legacy array concatenation expression
	 */
	generateJsonArray(expressions) {
		// Use GROUP_CONCAT as fallback for SQLite
		return this.generateLegacyArrayConcat(expressions);
	}

	/**
	 * Generate GROUP_CONCAT for SQLite aggregation
	 * @param {string} expression - The expression to concatenate
	 * @param {string} sqlAlias - SQL table alias
	 * @param {string} rowid - Row ID field
	 * @returns {string} SQLite GROUP_CONCAT expression
	 */
	generateGroupConcat(expression, sqlAlias, rowid) {
		// SQLite GROUP_CONCAT syntax
		return `'[' || GROUP_CONCAT(CASE WHEN ${sqlAlias}.${rowid} IS NOT NULL THEN ${expression} ELSE NULL END) || ']'`;
	}

	/**
	 * SQLite uses CASE WHEN instead of IF
	 * @param {string} sqlAlias - SQL table alias
	 * @param {string} rowid - Row ID field
	 * @param {string} expression - The expression
	 * @returns {string} SQLite CASE WHEN expression
	 */
	generateAggregationCondition(sqlAlias, rowid, expression) {
		return `CASE WHEN ${sqlAlias}.${rowid} IS NOT NULL THEN ${expression} ELSE NULL END`;
	}

	/**
	 * SQLite supports subqueries with LIMIT
	 * @returns {boolean} Always true for SQLite
	 */
	supportsLimitInSubquery() {
		return true;
	}

	/**
	 * SQLite doesn't need DELETE alias workarounds
	 * @returns {boolean} Always false for SQLite
	 */
	needsDeleteAliasWorkaround() {
		return false;
	}

	/**
	 * SQLite doesn't have the MySQL 8 aggregate bug
	 * @returns {boolean} Always false for SQLite
	 */
	needsAggregateQueryWorkaround() {
		return false;
	}

	/**
	 * Generate fulltext search for SQLite (using FTS if available)
	 * @param {Array<string>} fields - Array of field SQL expressions
	 * @param {string} searchValue - Search value (pre-parsed)
	 * @param {Function} fulltextParser - Parser function for search value (not used since value is pre-parsed)
	 * @param {boolean} negate - Whether to negate the condition
	 * @returns {string} SQLite fulltext search expression
	 */
	generateFulltextSearch(
		fields,
		searchValue,
		fulltextParser,
		negate = false
	) {
		const NOT = negate ? 'NOT ' : '';
		/*
		 * SQLite FTS or simple LIKE-based search
		 * This would need to be enhanced based on whether FTS tables are available
		 * For now, using LIKE-based search as fallback
		 */
		const conditions = fields.map(field => `${field} LIKE '%' || ? || '%'`);
		return `${NOT}(${conditions.join(' OR ')})`;
	}

	/**
	 * SQLite JSON path operations (if JSON1 extension is available)
	 * @param {string} field - Field name
	 * @param {string} path - JSON path
	 * @returns {string} SQLite JSON path expression
	 */
	generateJsonPath(field, path) {
		// SQLite uses json_extract function
		return `json_extract(${field}, '${path}')`;
	}

	/**
	 * SQLite CTE support varies by version
	 * @param {object} options - Query options
	 * @returns {boolean} True if CTE LIMIT filtering should be applied
	 */
	shouldApplyCTELimitFiltering(options) {
		// SQLite has had CTE support since 3.8.3 (2014)
		return super.shouldApplyCTELimitFiltering(options);
	}

	/**
	 * SQLite uses backticks for identifier delimiters
	 * @param {string} field - Field name to wrap
	 * @returns {string} Wrapped field identifier
	 */
	identifierWrapper(field) {
		return `\`${field}\``;
	}
}
