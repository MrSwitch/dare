import Dare from './index.js';
import semverCompare from 'semver-compare';

/**
 * MySQL57Dare
 * Extends Dare with MySQL 5.7-specific overrides (including 5.6 compatibility)
 *
 * @param {object} options - Initial options defining the instance
 * @returns {import('./index.js').default} instance of MySQL57Dare
 */
function MySQL57Dare(options = {}) {
	const instance = new Dare({
		...options,
		engine: options.engine,
	});
	Object.setPrototypeOf(instance, MySQL57Dare.prototype);
	return instance;
}

// Inherit from Dare
MySQL57Dare.prototype = Object.create(Dare.prototype);
MySQL57Dare.prototype.constructor = MySQL57Dare;

/**
 * Default engine for MySQL 5.7
 * @type {string}
 */
MySQL57Dare.prototype.engine = 'mysql:5.7';

/**
 * Sql_json_array - MySQL < 5.7 uses CONCAT_WS workaround
 * @param {Array<string>} expressions - Array of field expressions
 * @returns {string} SQL expression
 */
MySQL57Dare.prototype.sql_json_array = function sql_json_array(expressions) {
	if (semverCompare(this.engine.split(':').at(1), '5.7') < 0) {
		const wrapped = expressions.map(
			expr =>
				`'"', REPLACE(REPLACE(${expr}, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"'`
		);
		return `CONCAT_WS('', '[', ${wrapped.join(", ',', ")}, ']')`;
	}
	return `JSON_ARRAY(${expressions.join(',')})`;
};

/**
 * SQL Array Agg - MySQL 5.7 uses IF instead of CASE WHEN
 * @param {object} params - Params
 * @param {string} params.sql_alias - SQL Alias
 * @param {string} params.rowid - Row ID field
 * @param {string} params.expression - Inner expression
 * @returns {string} SQL expression
 */
MySQL57Dare.prototype.sql_json_arrayagg = function sql_json_arrayagg({
	sql_alias,
	rowid,
	expression,
}) {
	if (semverCompare(this.engine.split(':').at(1), '5.7.21') <= 0) {
		return `CONCAT('[', GROUP_CONCAT(IF(${sql_alias}.${rowid} IS NOT NULL, ${expression}, NULL)), ']')`;
	}

	let condition = `CASE WHEN (${sql_alias}.${rowid} IS NOT NULL) THEN (${expression}) ELSE NULL END`;

	if (this.engine.startsWith('mysql:5.7')) {
		// Overwrite condition for MySQL 5.7
		condition = `IF(${sql_alias}.${rowid} IS NOT NULL, ${expression}, NULL)`;
	}

	return `JSON_ARRAYAGG(${condition})`;
};

/**
 * MySQL 5.7 does not support CTE LIMIT filtering, so override to disable
 * @returns {boolean} Whether to use CTE LIMIT Filtering
 */
MySQL57Dare.prototype.applyCTELimitFiltering = function () {
	return false;
};

/**
 * JSON quote values
 * @param {any} value - Value to quote
 * @returns {any} Quoted value
 */
MySQL57Dare.prototype.jsonFormatValue = function jsonFormatValue(value) {
	if (Array.isArray(value)) {
		// In MySQL 5.7, we need to quote array values for IN
		return value.map(jsonFormatValue);
	}
	if (typeof value === 'string') {
		return `"${value}"`;
	}
	return value;
};

export default MySQL57Dare;
