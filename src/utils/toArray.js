/**
 * ToArray - if a function is not already an Array, make it so
 * @param {*} a - The input value to convert to an array
 * @returns {Array} - The converted array
 * @example
 *  toArray('a,b,c') // ['a', 'b', 'c']
 *  toArray(['a', 'b', 'c']) // ['a', 'b', 'c']
 *  toArray(1) // [1]
 */
export default function toArray(a) {
	if (typeof a === 'string') {
		a = a.split(',').map(s => s.trim());
	} else if (!Array.isArray(a)) {
		a = [a];
	}
	return a;
}
