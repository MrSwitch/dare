import BaseEngine from './base-engine.js';
import semverCompare from 'semver-compare';

/**
 * MySQL Engine Plugin
 * Handles MySQL-specific database operations and SQL generation
 */
export default class MySQLEngine extends BaseEngine {
	constructor(version = '8.0') {
		super(version);
		this.engine = `mysql:${this.version}`;
	}

	/**
	 * MySQL uses _rowid for grouping operations
	 * @returns {string} The row ID field name
	 */
	getRowIdField() {
		return '_rowid';
	}

	/**
	 * Check if JSON_ARRAY is supported (MySQL 5.7+)
	 * @returns {boolean} True if JSON_ARRAY is supported
	 */
	supportsJsonArray() {
		return this.version && semverCompare(this.version, '5.7') >= 0;
	}

	/**
	 * Check if JSON_ARRAYAGG is supported (MySQL 5.7.22+)
	 * @returns {boolean} True if JSON_ARRAYAGG is supported
	 */
	supportsJsonArrayAgg() {
		return this.version && semverCompare(this.version, '5.7.21') > 0;
	}

	/**
	 * Generate array expression based on MySQL version
	 * @param {Array<string>} expressions - Field expressions
	 * @returns {string} JSON array or legacy concatenation expression
	 */
	generateJsonArray(expressions) {
		if (!this.supportsJsonArray()) {
			return this.generateLegacyArrayConcat(expressions);
		}
		return super.generateJsonArray(expressions);
	}

	/**
	 * Generate GROUP_CONCAT expression for older MySQL versions
	 * @param {string} expression - The expression to concatenate
	 * @param {string} sqlAlias - SQL table alias
	 * @param {string} rowid - Row ID field
	 * @returns {string} GROUP_CONCAT or JSON_ARRAYAGG expression
	 */
	generateGroupConcat(expression, sqlAlias, rowid) {
		if (!this.supportsJsonArrayAgg()) {
			return `CONCAT('[', GROUP_CONCAT(IF(${sqlAlias}.${rowid} IS NOT NULL, ${expression}, NULL)), ']')`;
		}
		return this.generateJsonArrayAgg(
			this.generateAggregationCondition(sqlAlias, rowid, expression)
		);
	}

	/**
	 * Generate condition for JSON aggregation (MySQL 5.7 uses IF instead of CASE)
	 * @param {string} sqlAlias - SQL table alias
	 * @param {string} rowid - Row ID field
	 * @param {string} expression - The expression
	 * @returns {string} Aggregation condition using IF or CASE
	 */
	generateAggregationCondition(sqlAlias, rowid, expression) {
		if (this.version && this.version.startsWith('5.7')) {
			return `IF(${sqlAlias}.${rowid} IS NOT NULL, ${expression}, NULL)`;
		}
		return super.generateAggregationCondition(sqlAlias, rowid, expression);
	}

	/**
	 * MySQL 5.6 doesn't support LIMIT in subqueries
	 * @returns {boolean} True if LIMIT in subqueries is supported
	 */
	supportsLimitInSubquery() {
		return !(this.version && semverCompare(this.version, '5.7') < 0);
	}

	/**
	 * MySQL 5.6/5.7 need DELETE alias workaround
	 * @returns {boolean} True if DELETE alias workaround is needed
	 */
	needsDeleteAliasWorkaround() {
		return this.version && semverCompare(this.version, '8.0') < 0;
	}

	/**
	 * MySQL 8.0 has aggregate query bugs that need workarounds
	 * @returns {boolean} True if aggregate query workaround is needed
	 */
	needsAggregateQueryWorkaround() {
		return this.version && this.version.startsWith('8');
	}

	/**
	 * MySQL 5.7 needs JSON values quoted in IN clauses
	 * @param {Array} values - Array of values
	 * @returns {Array} Array of quoted values if needed
	 */
	quoteJsonValues(values) {
		if (this.version && this.version.startsWith('5.7')) {
			return values.map(value =>
				typeof value === 'string' ? `"${value}"` : value
			);
		}
		return values;
	}

	/**
	 * CTE LIMIT filtering not supported in MySQL 5.x
	 * @param {object} options - Query options
	 * @returns {boolean} True if CTE LIMIT filtering should be applied
	 */
	shouldApplyCTELimitFiltering(options) {
		if (this.version && this.version.startsWith('5')) {
			return false;
		}
		return super.shouldApplyCTELimitFiltering(options);
	}
	/**
	 * MySQL uses backticks for identifier delimiters
	 * @param {string} field - Field name to wrap
	 * @returns {string} Wrapped field identifier
	 */
	identifierWrapper(field) {
		return `\`${field}\``;
	}
}
