import semverCompare from 'semver-compare';

/*
 * Generate GROUP_CONCAT statement given an array of fields definitions
 * Label the GROUP CONCAT(..) AS 'address[fields,...]'
 * Wrap all the fields in a GROUP_CONCAT statement
 */
export default function group_concat({
	fields,
	address = '',
	sql_alias = null,
	rowid = null,
	engine = '',
	enginePlugin = null,
}) {
	// Use engine plugin if available, otherwise fall back to legacy engine string logic
	const usePlugin = enginePlugin !== null;

	// Is this an aggregate list?
	const agg = fields.reduce(
		(prev, curr) => prev || curr.agg || curr.label.indexOf(address) !== 0,
		false
	);
	let label = fields.map(field => field.label).join(',');
	let expression;

	// Return solitary value
	if (agg && fields.length === 1) {
		expression = fields[0].expression;
		return {
			expression,
			label,
		};
	}

	// Convert to JSON Array
	const fieldExpressions = fields.map(field => field.expression);

	if (usePlugin) {
		// Use engine plugin
		if (enginePlugin.supportsJsonArray()) {
			expression = enginePlugin.generateJsonArray(fieldExpressions);
		} else {
			expression =
				enginePlugin.generateLegacyArrayConcat(fieldExpressions);
		}
	} else {
		// Legacy engine string logic
		const version = engine.split(':').at(1) || '';

		if (version && semverCompare(version, '5.7') < 0) {
			expression = fieldExpressions.map(
				expr =>
					`'"', REPLACE(REPLACE(${expr}, '\\\\', '\\\\\\\\'), '"', '\\\\"'), '"'`
			);
			expression = `CONCAT_WS('', '[', ${expression.join(", ',', ")}, ']')`;
		} else {
			// JSON_ARRAY in postgres default to ABSENT ON NULL, so we need to add NULL ON NULL
			const json_array_settings = engine.startsWith('postgres')
				? ' NULL ON NULL'
				: '';

			expression = `JSON_ARRAY(${fieldExpressions.join(',')}${json_array_settings})`;
		}
	}

	if (agg) {
		return {
			expression,
			label,
		};
	}

	// Multiple - use engine-specific aggregation
	if (usePlugin) {
		// Use engine plugin
		if (enginePlugin.supportsJsonArrayAgg()) {
			const condition = enginePlugin.generateAggregationCondition(
				sql_alias,
				rowid,
				expression
			);
			expression = enginePlugin.generateJsonArrayAgg(condition);
		} else {
			expression = enginePlugin.generateGroupConcat(
				expression,
				sql_alias,
				rowid
			);
		}
	} else {
		// Legacy engine string logic
		const version = engine.split(':').at(1) || '';

		if (version && semverCompare(version, '5.7.21') <= 0) {
			expression = `CONCAT('[', GROUP_CONCAT(IF(${sql_alias}.${rowid} IS NOT NULL, ${expression}, NULL)), ']')`;
		} else {
			let condition = `CASE WHEN (${sql_alias}.${rowid} IS NOT NULL) THEN (${expression}) ELSE NULL END`;

			if (engine.startsWith('mysql:5.7')) {
				// Overwrite condition for MySQL 5.7
				condition = `IF(${sql_alias}.${rowid} IS NOT NULL, ${expression}, NULL)`;
			}

			expression = `JSON_ARRAYAGG(${condition})`;
		}
	}

	label = fields
		.map(field => {
			const {label} = field;
			// Trim the parent address from the start of the label
			return label.slice(address.length);
		})
		.join(',');

	label = `${address.slice(0, address.lastIndexOf('.'))}[${label}]`;

	return {
		expression,
		label,
	};
}
