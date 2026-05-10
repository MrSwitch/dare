/**
 * Base Engine Plugin
 * Abstract base class that defines the interface all database engine plugins must implement
 */
export default class BaseEngine {
	constructor(version = '') {
		this.version = version;
		this.engine = `mysql:${version}`;
	}

	/**
	 * Get the row ID field name for grouping operations
	 * @returns {string} The row ID field name
	 */
	getRowIdField() {
		return '_rowid';
	}

	/**
	 * Check if JSON arrays should include NULL ON NULL clause
	 * @returns {string} JSON array settings string
	 */
	getJsonArraySettings() {
		return '';
	}

	/**
	 * Get the LIKE operator (case-sensitive or case-insensitive)
	 * @returns {string} The LIKE operator
	 */
	getLikeOperator() {
		return 'LIKE';
	}

	/**
	 * Check if the engine supports JSON_ARRAY function
	 * @returns {boolean} True if JSON_ARRAY is supported
	 */
	supportsJsonArray() {
		return true;
	}

	/**
	 * Check if the engine supports JSON_ARRAYAGG function
	 * @returns {boolean} True if JSON_ARRAYAGG is supported
	 */
	supportsJsonArrayAgg() {
		return true;
	}

	/**
	 * Generate array concatenation expression for older engines
	 * @param {Array<string>} expressions - Field expressions
	 * @returns {string} Legacy array concatenation expression
	 */
	generateLegacyArrayConcat(expressions) {
		const escapedExpressions = expressions.map(
			expr =>
				`'"', REPLACE(REPLACE(${expr}, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"'`
		);
		return `CONCAT_WS('', '[', ${escapedExpressions.join(", ',', ")}, ']')`;
	}

	/**
	 * Generate JSON array expression
	 * @param {Array<string>} expressions - Field expressions
	 * @returns {string} JSON array expression
	 */
	generateJsonArray(expressions) {
		return `JSON_ARRAY(${expressions.join(',')}${this.getJsonArraySettings()})`;
	}

	/**
	 * Generate GROUP_CONCAT expression for aggregation
	 * @param {string} expression - The expression to concatenate
	 * @param {string} sqlAlias - SQL table alias
	 * @param {string} rowid - Row ID field
	 * @returns {string} GROUP_CONCAT expression
	 */
	generateGroupConcat(expression, sqlAlias, rowid) {
		return `CONCAT('[', GROUP_CONCAT(IF(${sqlAlias}.${rowid} IS NOT NULL, ${expression}, NULL)), ']')`;
	}

	/**
	 * Generate JSON_ARRAYAGG expression
	 * @param {string} condition - The condition expression
	 * @returns {string} JSON_ARRAYAGG expression
	 */
	generateJsonArrayAgg(condition) {
		return `JSON_ARRAYAGG(${condition})`;
	}

	/**
	 * Generate condition for JSON aggregation
	 * @param {string} sqlAlias - SQL table alias
	 * @param {string} rowid - Row ID field
	 * @param {string} expression - The expression
	 * @returns {string} Aggregation condition expression
	 */
	generateAggregationCondition(sqlAlias, rowid, expression) {
		return `CASE WHEN (${sqlAlias}.${rowid} IS NOT NULL) THEN (${expression}) ELSE NULL END`;
	}

	/**
	 * Check if the engine supports subqueries with LIMIT
	 * @returns {boolean} True if LIMIT in subqueries is supported
	 */
	supportsLimitInSubquery() {
		return true;
	}

	/**
	 * Check if DELETE operations need alias workarounds
	 * @returns {boolean} True if DELETE alias workaround is needed
	 */
	needsDeleteAliasWorkaround() {
		return false;
	}

	/**
	 * Check if aggregate queries with LIMIT need workaround
	 * @returns {boolean} True if aggregate query workaround is needed
	 */
	needsAggregateQueryWorkaround() {
		return false;
	}

	/**
	 * Quote JSON string values based on engine requirements
	 * @param {Array} values - Array of values
	 * @returns {Array} Array of quoted values
	 */
	quoteJsonValues(values) {
		return values;
	}

	/**
	 * Generate fulltext search expression
	 * @param {Array<string>} fields - Array of field SQL expressions
	 * @param {string} searchValue - Search value
	 * @param {Function} fulltextParser - Parser function for search value
	 * @param {boolean} negate - Whether to negate the condition
	 * @returns {string} Fulltext search expression
	 */
	generateFulltextSearch(
		fields,
		searchValue,
		fulltextParser,
		negate = false
	) {
		const NOT = negate ? 'NOT ' : '';
		return `${NOT}MATCH(${fields.join(', ')}) AGAINST(${fulltextParser(searchValue)} IN BOOLEAN MODE)`;
	}

	/**
	 * Check if CTE LIMIT filtering should be applied
	 * @param {object} options - Query options
	 * @returns {boolean} True if CTE LIMIT filtering should be applied
	 */
	shouldApplyCTELimitFiltering(options) {
		return options.limit <= 10_000;
	}

	/**
	 * Handle JSON path operations
	 * @param {string} field - Field name
	 * @param {string} path - JSON path
	 * @returns {string} JSON path expression
	 */
	generateJsonPath(field, path) {
		return `${field}->'${path}'`;
	}

	/**
	 * Wrap field identifiers with appropriate delimiters
	 * @param {string} field - Field name to wrap
	 * @returns {string} Wrapped field identifier
	 */
	identifierWrapper(field) {
		return `\`${field}\``;
	}
}
