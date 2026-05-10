import MySQLEngine from './mysql-engine.js';
import PostgreSQLEngine from './postgresql-engine.js';
import SQLiteEngine from './sqlite-engine.js';

/**
 * Engine Factory
 * Creates appropriate engine instances based on engine string
 */
export class EngineFactory {
	/**
	 * Create an engine instance based on the engine string
	 * @param {string} engineString - Engine string like 'mysql:8.0', 'postgres:16.3'
	 * @returns {object} Engine instance
	 */
	static createEngine(engineString = 'mysql:8.0') {
		const [engineType, version] = engineString.split(':');

		switch (engineType.toLowerCase()) {
			case 'mysql':
			case 'mariadb':
				return new MySQLEngine(version);

			case 'postgres':
			case 'postgresql':
				return new PostgreSQLEngine(version);

			case 'sqlite':
			case 'sqlite3':
				return new SQLiteEngine(version);

			default:
				throw new Error(`Unsupported database engine: ${engineType}`);
		}
	}

	/**
	 * Get list of supported engines
	 * @returns {Array<string>} List of supported engine types
	 */
	static getSupportedEngines() {
		return [
			'mysql',
			'mariadb',
			'postgres',
			'postgresql',
			'sqlite',
			'sqlite3',
		];
	}

	/**
	 * Check if an engine type is supported
	 * @param {string} engineType - Engine type to check
	 * @returns {boolean} True if the engine type is supported
	 */
	static isEngineSupported(engineType) {
		return this.getSupportedEngines().includes(engineType.toLowerCase());
	}
}

// Export individual engines for direct use if needed
export {MySQLEngine, PostgreSQLEngine, SQLiteEngine};
export {default as BaseEngine} from './base-engine.js';
