import BaseEngine from './base-engine.js';

/**
 * PostgreSQL Engine Plugin
 * Handles PostgreSQL-specific database operations and SQL generation
 */
export default class PostgreSQLEngine extends BaseEngine {
	constructor(version = '16.3') {
		super(version);
		this.engine = `postgres:${this.version}`;
	}

	/**
	 * PostgreSQL uses 'id' as the default row ID field
	 * @returns {string} The row ID field name
	 */
	getRowIdField() {
		return 'id';
	}

	/**
	 * PostgreSQL JSON_ARRAY defaults to ABSENT ON NULL, so we need NULL ON NULL
	 * @returns {string} JSON array settings string
	 */
	getJsonArraySettings() {
		return ' NULL ON NULL';
	}

	/**
	 * PostgreSQL uses ILIKE for case-insensitive matching
	 * @returns {string} The LIKE operator
	 */
	getLikeOperator() {
		return 'ILIKE';
	}

	/**
	 * Generate fulltext search using PostgreSQL's text search vectors
	 * @param {Array<string>} fields - Array of field SQL expressions
	 * @param {string} searchValue - Search value
	 * @param {Function} fulltextParser - Parser function for search value
	 * @param {boolean} negate - Whether to negate the condition
	 * @returns {string} PostgreSQL fulltext search expression
	 */
	generateFulltextSearch(
		fields,
		searchValue,
		fulltextParser,
		negate = false
	) {
		const NOT = negate ? 'NOT ' : '';

		let field;
		if (fields.length === 1) {
			field = fields[0];
		} else {
			// Concatenate multiple fields with spaces
			const concatenated = fields.join(" || ' ' || ");
			field = `TO_TSVECTOR(${concatenated})`;
		}

		return `${NOT}${field} @@ to_tsquery('english', ${fulltextParser(searchValue)})`;
	}

	/**
	 * Handle JSON path operations (PostgreSQL uses ->> for text extraction)
	 * @param {string} field - Field name
	 * @param {string} path - JSON path
	 * @returns {string} PostgreSQL JSON path expression
	 */
	generateJsonPath(field, path) {
		return `${field}->>${path}`;
	}

	/**
	 * PostgreSQL handles NULL comparisons differently for JSON
	 * @param {string} field - Field expression
	 * @param {boolean} negate - Whether this is a negated condition
	 * @param {Array} values - Array of values being compared
	 * @returns {string|null} Additional condition or null if not needed
	 */
	generateNullHandling(field, negate, values) {
		// PostgreSQL needs special NULL handling for negated JSON comparisons
		if (negate && !values.includes(null)) {
			return `OR ${field} IS NULL`;
		}
		return null;
	}

	/**
	 * Get the JSON path separator for PostgreSQL
	 * @returns {string} The JSON path separator
	 */
	getJsonPathSeparator() {
		return '->>';
	}

	/**
	 * PostgreSQL doesn't need special JSON value quoting
	 * @param {string} value - Value to potentially quote
	 * @returns {string} The unmodified value
	 */
	quoteJsonStringValue(value) {
		return value; // PostgreSQL handles JSON quoting internally
	}

	/**
	 * PostgreSQL uses double quotes for identifier delimiters
	 * @param {string} field - Field name to wrap
	 * @returns {string} Wrapped field identifier
	 */
	identifierWrapper(field) {
		return `"${field}"`;
	}
}
