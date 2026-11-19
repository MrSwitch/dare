import DareError from './error.ts';

export default function validate_label(label) {
	// Labels are emitted inside double quotes, so exclude quotes, the backslash escape character and control characters
	const reg = /^(?:(?!\p{Cc})[^"'?`\\])+$/u;

	// Capture errors in the key
	if (!label.match(reg)) {
		throw new DareError(
			DareError.INVALID_REFERENCE,
			`The label '${label}' must match ${reg}`
		);
	}
}
