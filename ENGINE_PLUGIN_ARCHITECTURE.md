# Database Engine Plugin Architecture

## Overview

This document outlines a plugin-based architecture to replace the scattered engine-specific logic throughout the Dare codebase. Instead of checking `engine.startsWith()` and version comparisons in multiple places, each database engine has its own plugin that encapsulates all engine-specific behavior.

## Current Problems

1. **Scattered Logic**: Engine-specific code is spread across multiple files
2. **Hard to Maintain**: Adding new engines or versions requires changes in many places
3. **Version Complexity**: Complex version checking with `semverCompare`
4. **Inconsistent Patterns**: Different ways of handling engine detection

## Proposed Solution

### Plugin Architecture

Each database engine gets its own plugin class that extends `BaseEngine` and implements engine-specific methods:

- **BaseEngine**: Abstract base class defining the interface
- **MySQLEngine**: MySQL-specific implementations (5.6, 5.7, 8.0+)
- **PostgreSQLEngine**: PostgreSQL-specific implementations
- **SQLiteEngine**: SQLite-specific implementations
- **EngineFactory**: Creates appropriate engine instances

### Key Features

1. **Centralized Logic**: All engine-specific code in one place per engine
2. **Version Handling**: Each plugin handles its own version-specific logic
3. **Extensible**: Easy to add new engines by creating new plugin classes
4. **Type Safe**: Clear interfaces and method signatures
5. **Testable**: Each plugin can be tested independently

## Plugin Methods

Each engine plugin provides methods for:

### SQL Generation

- `generateJsonArray()` - JSON array creation
- `generateJsonArrayAgg()` - JSON aggregation
- `generateGroupConcat()` - GROUP_CONCAT operations
- `generateFulltextSearch()` - Full-text search expressions
- `generateJsonPath()` - JSON path operations

### Feature Detection

- `supportsJsonArray()` - JSON array support
- `supportsJsonArrayAgg()` - JSON aggregation support
- `supportsLimitInSubquery()` - Subquery LIMIT support
- `shouldApplyCTELimitFiltering()` - CTE filtering decisions

### Configuration

- `getRowIdField()` - Row ID field name (`_rowid` vs `id`)
- `getLikeOperator()` - LIKE vs ILIKE
- `getJsonArraySettings()` - NULL handling for JSON arrays
- `quoteJsonValues()` - JSON value quoting rules

### Workarounds

- `needsDeleteAliasWorkaround()` - DELETE alias issues
- `needsAggregateQueryWorkaround()` - MySQL 8.0 aggregate bugs
- `generateNullHandling()` - NULL comparison handling

## Migration Strategy

### Phase 1: Create Plugin Infrastructure

1. Create base engine class and specific engine plugins ✓
2. Create engine factory for instantiation ✓
3. Add plugin integration to main Dare class
4. Update constructor and `use()` method

### Phase 2: Migrate Core Functions

1. Update `group_concat.js` to use engine plugins
2. Update `reducer_conditions.js` fulltext and JSON logic
3. Update condition generation in query builders
4. Replace direct engine string checks

### Phase 3: Replace Remaining Logic

1. Update `get.js` aggregate query workarounds
2. Update `format_request.js` DELETE alias handling
3. Replace all remaining `engine.startsWith()` calls
4. Remove `semverCompare` imports where no longer needed

### Phase 4: Testing & Cleanup

1. Update tests to use plugin system
2. Add plugin-specific test suites
3. Remove old engine checking code
4. Update documentation

## Implementation Examples

### Before (Current):

```javascript
// Scattered throughout codebase
const IS_POSTGRES = engine.startsWith('postgres');
const version = engine.split(':').at(1) || '';

if (version && semverCompare(version, '5.7') < 0) {
	// MySQL 5.6 logic
} else if (IS_POSTGRES) {
	// PostgreSQL logic
}
```

### After (Plugin):

```javascript
// Centralized in plugins
const result = dareInstance.enginePlugin.generateJsonArray(expressions);
const likeOp = dareInstance.enginePlugin.getLikeOperator();
const supportsFeature = dareInstance.enginePlugin.supportsJsonArrayAgg();
```

## Benefits

1. **Maintainability**: Engine logic centralized in plugins
2. **Extensibility**: New engines added by creating new plugins
3. **Testability**: Each plugin tested independently
4. **Clarity**: Clear separation of engine-specific concerns
5. **Performance**: No repeated string parsing and version comparisons
6. **Type Safety**: Well-defined interfaces and method contracts

## Files to Update

### Core Files

- `src/index.js` - Add plugin system integration
- `src/get.js` - Replace aggregate query checks
- `src/format_request.js` - Replace DELETE alias checks

### Utility Files

- `src/utils/group_concat.js` - Use plugin for JSON/GROUP_CONCAT logic
- `src/format/reducer_conditions.js` - Use plugin for fulltext, JSON, LIKE operations

### Test Files

- Update all test files that check engine strings
- Add plugin-specific test suites

## Backward Compatibility

The plugin system can be introduced gradually:

1. Keep existing engine string checks during migration
2. Add plugin methods alongside old logic
3. Replace old logic incrementally
4. Remove old code once migration complete

This ensures the system continues working during the transition period.
