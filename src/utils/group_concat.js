/*
 * Generate JSON_ARRAYAGG statement given an array of fields definitions
 * Label the JSON_ARRAYAGG(..) AS 'address[fields,...]'
 * Wrap all the fields in a JSON Array statement
 */
export default function group_concat({
	fields,
	address = '',
	sql_alias = null,
	rowid = null,
	dareInstance = null,
}) {
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
	expression = dareInstance.sql_json_array(
		fields.map(field => field.expression)
	);

	if (agg) {
		return {
			expression,
			label,
		};
	}

	// Multiple
	expression = dareInstance.sql_json_arrayagg({sql_alias, rowid, expression});

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
