// Import promise from 'eslint-plugin-promise';
import security from 'eslint-plugin-security';
import fiveapp from 'eslint-config-5app';
import prettier from 'eslint-config-prettier/flat';
import n from 'eslint-plugin-n';
import globals from 'globals';

export default [
	n.configs['flat/recommended'],
	...fiveapp,
	prettier,

	/*
	 * ...,
	 */
	{
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {
				...globals.node,
			},
		},
		plugins: {
			security,
		},
		rules: {
			// "no-negated-condition": 2,
			'no-unused-expressions': 2,
			'prefer-named-capture-group': 2,
			// "prefer-destructuring": 2,
			'arrow-body-style': [2, 'as-needed'],
			'capitalized-comments': 2,
			'no-empty-function': 2,
			'no-param-reassign': 0,
			'max-params': [2, {max: 4}],
			'multiline-comment-style': [2, 'starred-block'],
			'linebreak-style': 0,
			'n/no-unsupported-features/es-syntax': [2, {ignores: ['modules']}],
			'n/no-missing-import': [
				'error',
				{
					allowModules: ['sql-template-tag'],
				},
			],
			'prefer-promise-reject-errors': 2,
			// "promise/prefer-await-to-then": 2,
			'security/detect-unsafe-regex': 2,
			'jsdoc/require-jsdoc': 0,
		},
	},

	{
		files: ['test/**/*.js'],
		languageOptions: {
			globals: {
				...globals.mocha,
				Dare: 'readonly',
			},
		},
		rules: {
			'quote-props': 0,
		},
	},
];
