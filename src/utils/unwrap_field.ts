/* eslint-disable prefer-named-capture-group */
import DareError from './error.ts';

/**
 * Unwrapped field definition
 */
export interface UnwrappedField {
	field?: string;
	field_name?: string;
	field_path?: string;
	prefix?: string;
	suffix?: string;
	value?: any;
	direction?: string;
}

/**
 * Control characters, other than tab, newline and carriage return
 */
const CONTROL_CHARS = /(?![\t\n\r])\p{Cc}/u;

/**
 * Is this a path segment, e.g. `a` or `a$1`
 * The `$` is only permitted once, as an alias separator between word characters
 * @param segment - String to test
 * @returns True if the segment is valid
 */
function isSegment(segment: string): boolean {
	const parts = segment.split('$');
	return parts.length <= 2 && parts.every(part => /^\w+$/.test(part));
}

/**
 * Is this a field path, e.g. `a.b`, `a$1.b$2` or `a.*`
 * @param str - String to test
 * @returns True if the string is an (optionally empty) field path
 */
function isFieldPath(str: string): boolean {
	if (str === '') {
		return true;
	}

	const segments = str.split('.');
	const last = segments.pop();

	return segments.every(isSegment) && (last === '*' || isSegment(last));
}

/**
 * Assert there are no SQL comment markers outside of quoted strings
 * @param prefix - Accumulated prefix
 * @param suffix - Accumulated suffix
 * @param expression - Original expression, for the error message
 */
function assertNoComments(prefix: string, suffix: string, expression: string) {
	// Remove the (already validated) quoted strings
	const unquoted = `${prefix}${suffix}`.replaceAll(/(["'])[^"']*\1/g, '');

	if (/--|\/\*|\*\//.test(unquoted)) {
		throw new DareError(
			DareError.INVALID_REFERENCE,
			`The field definition '${expression}' is invalid.`
		);
	}
}

/**
 * Double quotes are identifiers in Postgres, SQLite and MySQL (ANSI_QUOTES)
 * so they could be used to reference arbitrary columns.
 * Quoted strings are validated to never contain a quote, so this is a safe swap
 * to single quotes, which are always string literals.
 * @param str - SQL fragment whose quoted strings have been validated
 * @returns The fragment using single quotes
 */
function toSingleQuotes(str: string): string {
	return str.replaceAll('"', "'");
}

export default function unwrap_field(
	expression: any,
	allowValue = true
): UnwrappedField {
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

		if (CONTROL_CHARS.test(str)) {
			throw new DareError(
				DareError.INVALID_REFERENCE,
				`The field definition '${expression}' is invalid.`
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
					/^(?<prefix>((?<quote>["'])[^"';?\\]*\k<quote>),\s*)(?<body>.+)$/i
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
		if (isFieldPath(str)) {
			assertNoComments(prefix, suffix, expression);

			const field = str;
			const a = str.split('.');
			const field_name = a.pop();
			const field_path = a.join('.');

			const resp = {
				field,
				field_name,
				field_path,
				prefix: toSingleQuotes(prefix),
				suffix: toSingleQuotes(suffix),
			};

			// This passes the test
			return resp;
		}

		// Return value...
		if (allowValue) {
			if (str.length === 0 || /^(["'])[\s\w]+\1$/.test(str)) {
				assertNoComments(prefix, suffix, expression);

				return {
					value: toSingleQuotes(expression),
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
