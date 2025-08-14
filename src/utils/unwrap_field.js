/* eslint-disable security/detect-unsafe-regex */
/* eslint-disable prefer-named-capture-group */
import DareError from './error.js';

export default function unwrap_field(expression, allowValue = true) {
	if (typeof expression === 'string') {
		let m;
		let str = expression;
		let suffix = '';
		let prefix = '';

		if (str.length > 200) {
			throw new DareError(
				DareError.INVALID_REFERENCE,
				`The field definition '${expression}' is too long.`
			);
		}

		// Match a function, "STRING_DENOTES_FUNCTION(.*)"
		while ((m = str.match(/^(!?[_a-z]+\()(.*)(\))$/i))) {
			// Change the string to match the inner string...
			str = m[2];

			// Capture the suffix,prefix
			prefix += m[1];
			suffix = m[3] + suffix;

			let int_m;

			// Remove suffix tweaks
			if ((int_m = str.match(/(.*)(\s+ORDER BY 1)\s*$/))) {
				suffix = int_m[2] + suffix;
				str = int_m[1];
			}

			// Split out comma variables from front
			while (
				(int_m = str.match(
					/^(?<prefix>((?<quote>["'])[^"';\\]*\k<quote>),\s*)(?<body>.+)$/i
				))
			) {
				str = int_m?.groups?.body;
				prefix += int_m?.groups?.prefix;
			}

			// Split out comma variables
			while (
				(int_m = str.match(
					/^(.*)((,|\sAS)\s*(?<suffix>(?<quote>["'])?[\s\w%./-]*\k<quote>))$/
				))
			) {
				/*
				 * If unquoted parameter
				 * Ensure no lowercase strings (i.e. column names)
				 */
				if (
					!int_m.groups.quote &&
					int_m.groups.suffix?.match(/[a-z]/)
				) {
					// Is this a valid field
					throw new DareError(
						DareError.INVALID_REFERENCE,
						`The field definition '${expression}' is invalid.`
					);
				}

				str = int_m[1].trim();
				suffix = int_m[2] + suffix;
			}

			/*
			 * Deal with math and operators against a value
			 */
			const int_x = str.match(
				/(.*)(\s((\*|\/|>|<|=|<=|>=|<>|!=)\s([\d.]+|((?<quote>["'])[\s\w%.-]*\k<quote>))|is null|is not null))$/i
			);

			if (int_x) {
				str = int_x[1];
				suffix = int_x[2] + suffix;
			}
		}

		// Does the string start with a negation (!) ?
		if (str && str.startsWith('!')) {
			prefix += '!';
			str = str.slice(1);
		}

		// Remove any additional prefix in a function.. i.e. "YEAR_MONTH FROM " from "EXTRACT(YEAR_MONTH FROM field)"
		if (prefix && str && (m = str.match(/^[\sA-Z_]+\s/))) {
			prefix += m[0];
			str = str.slice(m[0].length);
		}

		// Finally check that the str is a match
		if (str.match(/^[\w$*.]*$/)) {
			const field = str;
			const a = str.split('.');
			const field_name = a.pop();
			const field_path = a.join('.');

			const resp = {
				field,
				field_name,
				field_path,
				prefix,
				suffix,
			};

			// This passes the test
			return resp;
		}

		// Return value...
		if (allowValue) {
			if (str.length === 0 || /^(["'])[\s\w]+\1$/.test(str)) {
				return {
					value: expression,
				};
			}
		}
	}

	// Else if this is not a reference to a db field, pass as a value
	else if (
		(allowValue && typeof expression === 'number') ||
		expression === null ||
		typeof expression === 'boolean'
	) {
		return {
			value: expression,
		};
	}

	// Is this a valid field
	throw new DareError(
		DareError.INVALID_REFERENCE,
		`The field definition '${expression}' is invalid.`
	);
}
