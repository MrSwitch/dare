# Database and REST (dare)

[![Coverage Status](https://coveralls.io/repos/github/5app/dare/badge.svg)](https://coveralls.io/github/5app/dare)
[![CircleCI](https://circleci.com/gh/5app/dare.svg?style=shield)](https://circleci.com/gh/5app/dare)
[![NPM Version](https://img.shields.io/npm/v/dare.svg)](https://www.npmjs.com/package/dare)
[![Known Vulnerabilities](https://snyk.io/test/github/5app/dare/badge.svg)](https://snyk.io/test/github/5app/dare)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![codebeat badge](https://codebeat.co/badges/718b30e2-76fa-4c61-b770-751b22c5ea5e)](https://codebeat.co/projects/github-com-5app-dare-main)

Dare is a brave API for generating SQL out of structured Javascript objects.

## Example usage...

This is a simple setup to make a SELECT query

```js
// Require the module
import Dare from 'dare';
import dbconn from './dbConn.js'; // <- your script for executing queries

// Initiate it
const dare = new Dare({
	engine: 'mysql:8.0' // set the engine
});

// Define the handler dare.execute for handing database requests
dare.execute = async (request) => {

	// Execute query using prepared statements
	// use request.sql, whilst in postgres use request.text
	return dbconn.query(request.sql, request.values);
};

// Make a request
const resp = await dare.get('users', ['name'], {id: 1});
// SELECT id, name FROM users WHERE id = 1 LIMIT 1;

console.log(`Hi ${resp.name}');
```

## Install

```bash
npm i dare --save
```

# Connect

The setup needs to define a execution handler `dare.execute(SqlRequest) : Promise<Array | Object<{insertId, affectedRows}>`

The integration tests illustrates how a [setup of a dare instance](`./test/integration/helpers/api.js`) connects to different clients...

- **MySQL** (5.6, 5.7, 8.0,...) and **MariaDB** (11) See [connection with `mysql2`](./test/integration/helpers/MySQL.js)
- **Postgres** (16+) See [connection with `pg`](./test/integration/helpers/Postgres.js)

# Methods

## dare.get(table[, fields][, filter][, options])

The `dare.get` method is used to build and execute a `SELECT ...` SQL statement.

| property | Type              | Description                 |
| -------- | ----------------- | --------------------------- |
| table    | string            | Name of the table to access |
| fields   | Array strings     | Fields Array                |
| filter   | Hash (key=>Value) | Query Object                |
| options  | Hash (key=>Value) | Additional Options          |

e.g.

```js
await dare.get('table', ['name'], {id: 1});
// SELECT name FROM table WHERE id = 1 LIMIT 1;
```

## dare.get(options Object)

Alternatively an options Object can be used instead.

e.g.

```js
await dare.get({
	table: 'users',
	fields: ['name'],
	filter: {
		id: 1,
	},
});
```

### Fields Array `fields`

The `fields` property is the second argument in the shorthand request `dare.get(table,fields[], ...)`. It is an Array of the fields from the matching table to return.

In its simplest form `fields` it is an Array of Strings, e.g. `['id', 'name', 'created_date']`. This creates a very simple query.

```js
await dare.get('users', ['id', 'name', 'created_date'], ...);
// SELECT id, name, created_date FROM ....
```

The array items can also be Objects.

#### Aliased fields and Formatting (objects)

**Aliasing fields**

It's sometimes appropriate to return a field by another name, this is called _aliasing_.

To achieve that, instead of having a string item in the fields array, an object is provided instead. The object has one property where the key of that property defines the new name, and the value the db field.

e.g. here we rename email to emailAddress

```js
await dare.get('users', [
	'name', // also including a regular string field alongside for comparison
	{
		// label : db field
		emailAddress: 'email',
	},
]);
// sql: SELECT email AS emailAddress FROM users ...
```

**Applying SQL Formatting**

The object structure used for **aliasing** can also be used to label a response including a SQL Function.

E.g. Below we're using the `DATE` function to format the `created_date`, and we're aliasing it so it will be returned with prop key `date`.

```js
await dare.get('users', [
	{
		date: 'DATE(created_date)',
	},
]);
// sql: SELECT name, DATE(created_date) AS date ...
```

**Supported SQL Functions**:

SQL Functions have to adhere to a pattern.

_note_: It is currently limited to defining just one table field, we hope this will change

`FUNCTION_NAME([FIELD_PREFIX]? field_name [MATH_OPERATOR MATH_VALUE]?[, ADDITIONAL_PARAMETERS]*)`

- _FUNCTION_NAME_: uppercase, no spaces
- _FIELD_PREFIX_: optional, uppercase
- _field_name_: db field reference
- _MATH_OPERATOR_ _MATH_VALUE_: optional
- _ADDITIONAL_PARAMETERS_: optional, prefixed with `,`, (uppercase, digit or quoted string)

_e.g._

| Field Defition                          | Description                                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `FORMAT(field, 2, 'de_DE')`             | Rounding to 2 decimal places and convert to a string with German formatting.                                                         |
| `CONCAT(ROUND(field * 100), '%')`       | Multiplying a number by 100. Rounding to 2 decimal places and appending a '%' to the end to convert a decimal value to a percentage. |
| `DATE_FORMAT(field, "%Y-%m-%dT%T.%fZ")` | Format date field                                                                                                                    |
| `!ISNULL(field)`                        | Function prefixed with negation operator `!`                                                                                         |

#### Nesting Fields

Nesting can return data structures from across tables.

_note_: a **Model** Field Attribute `reference`, which defines the join between the two tables, is required to make nested joins.

Request nested data with an object; where the key is the name of the table to be joined, and the value is the Array of fields to return from the joined table.

```js
// fields attribute...
[
	'name',
	{
		country: ['name'],
	},
];

// sql: SELECT name, county.name
```

The SQL this creates renames the fields and then recreates the structured format that was requested. So with the above request: a typical response would have the following structure...

```js
	// Example response
	{
		name: 'Andrew',
		country: {
			name: 'UK'
		}
	}
```

- At the moment this only supports _n:1_ mapping.
- The relationship between the tables must be defined in a model field reference.

### Filter `filter`

The Filter Object is a Fields=>Value object literal, defining the SQL condition to attach to a statement.

e.g.

```js

	{
		id: 1,
		is_hidden: 0
	}


	// ... WHERE id = 1 AND is_hidden = 0 ...
```

The filter object can contain nested objects (Similar to the Fields Object). Nested objects define conditions on Relational tables.

_note_: a **Model** Field Attribute `reference`, which defines the join between the two tables, is required to make nested joins.

```js
{
	country: {
		name: 'UK';
	}
}
```

OR shorthand, nested subkeys are represented with a '.'

```
	{
		'country.name': 'UK'
	}
```

Creates the following SQL JOIN Condition

```sql
	... WHERE country.name = 'UK' ...
```

#### Filter Syntax

The type of value affects the choice of SQL Condition syntax to use. For example an array will create an `IN (...)` condition.

Prefixing the prop with:

- `%`: creates a `LIKE` comparison (or `ILIKE` in _postgres_)
- `-`: hyhen negates the value
- `~`: creates a range

| Key        | Value                    | Type          | = SQL Condition                                                                                                                             |
| ---------- | ------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| id         | 1                        | number        | `id = 1`                                                                                                                                    |
| name       | 'Andrew'                 | string        | `name = 'Andrew'`                                                                                                                           |
| %name      | 'And%'                   | Pattern       | `name LIKE 'And%'`                                                                                                                          |
| -%name     | 'And%'                   | Pattern       | `name NOT LIKE 'And%'`                                                                                                                      |
| name$1     | any                      | any           | e.g. `name LIKE '%And%` $suffixing gives `name` alternative unique object key values, useful when writing `name LIKE %X% AND name LIKE %Y%` |
| tag        | [1, 'a']                 | Array values  | `tag IN (1, 'a')`                                                                                                                           |
| -tag       | [1, 'a']                 | Array values  | `tag NOT IN (1, 'a')`                                                                                                                       |
| -status    | ['deleted', null]        | Array values  | `(status NOT IN ('deleted') AND status IS NOT NULL)` Mixed type including `null`                                                            |
| ~date      | '2016-03-04T16:08:32Z..' | Greater than  | `date > '2016-03-04T16:08:32Z'`                                                                                                             |
| ~date      | '2016-03-04..2016-03-05' | Between       | `date BETWEEN '2016-03-04' AND '2016-03-05'`                                                                                                |
| -~date     | '2016-03-04..'           | !Greater than | `(NOT date > '2016-03-04T00:00:00' OR date IS NULL)`                                                                                        |
| flag       | null                     | null          | `flag IS NULL`                                                                                                                              |
| -flag      | null                     | null          | `flag IS NOT NULL`                                                                                                                          |
| \*text     | '+And\*'                 | Pattern       | `MATCH(text) AGAINST('+And*' IN BOOLEAN MODE)`                                                                                              |
| name,email | 'hello'                  | any           | `(name = 'hello' OR email = 'hello')`                                                                                                       |

#### Negate entire joins (i.e. NOT EXISTS)

_note_: a **Model** Field Attribute `reference`, which defines the join between the two tables, is required to make nested joins.

If there is a nested section on a filter which should act to exclude items from the resultset. Then it can be appropriate to use `-` in front of the table name.

Example: Retrieve all users who are _not_ in the 'admin' team....

```js
await dare.get({
	table: 'users',
	fields: ['name'],
	filter: {
		-team: {name: 'admin'}
	}
});

// SELECT u.name FROM users u WHERE NOT EXISTS (SELECT 1 FROM team t WHERE name = 'admin' AND t.user_id = u.id)...
```

note: this is very different from having the negation on the field definition, i.e. `-name:'admin'`, which is described in Filter Syntax.

### Group by `groupby`

`groupby` accepts the same format as a single `field` expression. It can be a single value or an array of multiple expressions. I.e.

```js
groupby: ['type', 'YEAR_MONTH(created_date)'];
```

Generates

```sql
	GROUP BY type, YEAR_MONTH(created_date)
```

### Order By `orderby`

`orderby` accepts the same format as a single `field` expression. It can be a single value or an array of multiple expressions. I.e.

```js
orderby: ['type', 'YEAR_MONTH(created_date)'];
```

Generates

```sql
	ORDER BY type, YEAR_MONTH(created_date)
```

### Join

_note_: a **Model** Field Attribute `reference`, which defines the join between the two tables, is required to make nested joins.

The Join Object is a Fields=>Value object literal. It accepts the same syntax to the Filter Object, and defines those conditions on the SQL JOIN Condition.

e.g.

```js
join: {
	county: {
		is_hidden: 0;
	}
}

// ... LEFT JOIN county b ON (b.id = a.country_id AND b.is_hidden = 0)
```

The JOIN object is useful when restricting results in the join table without affecting the results returned in the primary table.

To facilitate scenarios where the optional JOIN tables records are dependent on another relationship we can define this also in the JOIN Object, by passing though a special prop `_required: true` (key=>value)

The following statement includes all rows as before, but the nested country data is filtered separatly.

```js

	join: {
		county: {
			continent: {
				_required: true,
				name: 'Europe'
			}
		}
	}

	// ...
	// LEFT JOIN county b ON (b.id = a.country_id)
	// LEFT JOIN continent c ON (c.id = b.continent_id)
	// WHERE (c.id = b.continent_id OR b.continent_id IS NULL)
	// ...
```

### Pagination `limit` and `start`

The `limit` and `start` properties are simply applied to the SQL query and can be used to paginate the resultset.

```js
await dare.get({
	table: 'table',
	fields: ['name'],
	limit: 10, // Return only 10 rows
	start: 20, // Start in the 20th
});
// SELECT name FROM table LIMIT 10 OFFSET 20;
```

### No `limit` set and `notfound`

Dare returns a single item when no `limit` is set. When the item is not found Dare rejects the request with `DareError.NOT_FOUND`. To override this default behaviour simply set the `notfound` to the value to respond with in the event of a notfound event being triggered. This can be a simple value or if a function is provided, then that function will be called e.g.

```js
const resp = await dare.get({
	table: 'table',
	fields: ['name'],
	filter: {name: 'Nameless'}
	notfound: null
});

// SELECT name FROM table WHERE name = 'Nameless' LIMIT 1;
// -- found 0 rows
console.log(resp); // null

```

## dare.getCount(table[, filter][, options])

The `dare.getCount` method like the `dare.get` method builds and executes a `SELECT ...` SQL statement. It differs from the `get` in that it does not operate on the `fields` option. It merely calculates and returns the number of results which match the request options. It is intended to be used when constructing pagination, or other summaries.

| property | Type              | Description                 |
| -------- | ----------------- | --------------------------- |
| table    | string            | Name of the table to access |
| filter   | Hash (key=>Value) | Query Object                |
| options  | Hash (key=>Value) | Additional Options          |

e.g.

```js
const count = await dare.getCount('profile', {first_name: 'Andrew'});
// SELECT COUNT(DISTINCT id) FROM profile WHERE name = 'Andrew' LIMIT 1;
```

## dare.getCount(options Object)

Using an options Object allows for `date.getCount(options)` to be paired with a request to `dare.get(options)`.

e.g.

```js
const requestOptions = {
	table: 'profile',
	filter: {
		first_name: 'Andrew'
	},
	limit: 10
};

// Get the first 10 items, and the number of possible rows
const [items, foundRows] = await Promise.all([

	// Make a request for members matching the condition
	dare.get(requestOptions)

	// Get the number of possible results
	dare.getCount(requestOptions)
]);
```

## dare.post(table, body[, options])

The `dare.post` method is used to build and execute an `INSERT ...` SQL statement.

| property | Type              | Description                          |
| -------- | ----------------- | ------------------------------------ |
| table    | string            | Name of the table to insert into     |
| body     | Object            | Post Object or Array of Post Objects |
| options  | Hash (key=>Value) | Additional Options                   |

e.g.

```js
await dare.post('user', {name: 'Andrew', profession: 'Mad scientist'});
// INSERT INTO table (name, profession) VALUES('Andrew', 'Mad scientist')
```

## dare.post(options Object)

Alternatively a options Object can be used instead.

e.g.

```js
await dare.post({
	table: 'user',
	body: {
		name: 'Andrew',
		profession: 'Mad scientist',
	},
});
```

## dare.post(options Object) with multiple values

The body can be an Array of objects.

e.g.

```js
await dare.post({
	table: 'user',
	body: [
		{
			name: 'Andrew',
			profession: 'Mad scientist',
		},
		{
			name: 'Peppa',
		},
	],
});
```

This generates `INSERT INTO user (name, profession) VALUES ('Andrew', 'Mad Scientist'), ('Peppa', DEFAULT)`. Note where the key's differ between items in the Array the `DEFAULT` value is inserted instead.

### Post `options` (additional)

| Prop                  | Type                       | Description                                              |
| --------------------- | -------------------------- | -------------------------------------------------------- |
| duplicate_keys        | 'ignore'                   | Appends `ON DUPLICATE KEYS UPDATE _rowid=_rowid`         |
| duplicate_keys_update | Array(field1, field2, ...) | Appends `ON DUPLICATE KEYS UPDATE field1=VALUES(field1)` |
| query                 | Get Options                | See the dare.get options                                 |

#### query

The query is used to create an `INSERT...SELECT` statement in place of a `body` property. The object is the same as the Get options, see above.

e.g.

```js
/*
 * Run query to record all users with a session_date in the year 2021
 * INSERT INTO logs (id, name) SELECT id, name FROM user WHERE session_date BETWEEN '2021-01-01' AND '2021-12-31'
 */
await dare.post({
	table: 'log',
	query: {
		table: 'user',
		fields: ['id', 'name'],
		filter: {
			session_date: '2021-01-01..2021-12-31'
		}
	}]
});
```

## dare.patch(table, filter, body[, options])

Updates records within the `table` with the `body` object when they match `filter`.

| property | Type              | Description                      |
| -------- | ----------------- | -------------------------------- |
| table    | string            | Name of the table to insert into |
| filter   | Object            | Filter object of the results     |
| body     | Object            | Post Object to apply             |
| options  | Hash (key=>Value) | Additional Options               |

### Patch `options` (additional)

| Prop           | Type     | Description                                                                                                                           |
| -------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| duplicate_keys | 'ignore' | Adds keyword `IGNORE`, e.g. `UPDATE IGNORE table ...`                                                                                 |
| limit          | number   | Default: `1`. Limit the number of results which can be affected by patch                                                              |
| notfound       | \*       | Value to return when there are no affected rows. If it's a function the function will be called. Default throws `DareError.NOT_FOUND` |

## dare.del(table, filter[, options])

Deletes records within the `table` when they match `filter`.

| property | Type              | Description                      |
| -------- | ----------------- | -------------------------------- |
| table    | string            | Name of the table to insert into |
| filter   | Object            | Filter object of the results     |
| options  | Hash (key=>Value) | Additional Options               |

### Del `options` (additional)

| Prop     | Type   | Description                                                                                                                           |
| -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| notfound | \*     | Value to return when there are no affected rows. If it's a function the function will be called. Default throws `DareError.NOT_FOUND` |
| limit    | number | Default: `1`. Limit the number of results which can be affected by delete                                                             |

# `options` Object

The `options` Object is used to define properties on the current and descendent contexts. In other words, every method in Dare, creates a new instances inheritting its parent options as well as defining it's own. See `dare.use(options)` for more.

The `options` themselves are a set of properties used to interpret and manipulate the request.

```js
// Create an options Object
const options = {
	// Some options...
};

// Apply options at the point where Dare is invoked...
const dare = new Dare(options);

// OR Apply options when creating an instance off another instance...
const dare2 = dare.use(options);

// OR Apply options at the point of calling a method...
await dare.get({
	table: 'sometable',
	fields: ['id', 'name'],
	...options,
});
```

| option name     | type                                      | description                                                                                                                                    |
| --------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine`        | `string`                                  | Database engine, e.g. `mysql:5.7:40`, `postgres:16.3`                                                                                          |
| `models`        | `Object<ModelName, Model>`                | An object where the keys are the model names to which models can be referred.                                                                  |
| `validateInput` | `Function(fieldAttributes, field, value)` | Validate input on _patch_ and _post_ operations                                                                                                |
| `getFieldKey`   | `Function(field, schema)`                 | Override the default function for retrieving schema fields, this is useful if you want to support altenative case (camelCase and/or snakeCase) |
| `state`         | `any`                                     | Arbitary data which can be used within the Method handlers to set additional filters or formatting                                             |

# Model

Models define many things, the underling db table, the schema and any handler functions which are invoked on any operation (post, patch, del, get, getCount).

Models are applied to the `options.models` object e.g...

```js
const dare = new Dare({
	models: {
		mymodel : {
			/** model properties */
		}.
	}
});
```

Available properties which can be defined on a model are...

```js
const myModel = {
	table, // this is the db table name, if omitted Dare will assume the models label instead
	schema, // A schema object defining fields, as well as their relationship to other models.
	get, // Function to modify the request when accessing data
	post, // Function to modify the request when posting data
	patch, // Function to modify the request when patching data
	del, // Function to modify the request when deleting data
};
```

## Model Table `table`

The underlying Database SQL Table to use when querying this model, if omitted Dare will assume the models label instead

```js
const myModel = {
	table: 't_mytable', // an example table name: some dba's do like to prefix table names, however it's not a convention which makes for a nice api.
	// ...
};
```

## Model Schema `schema`

The `schema` property defines an object, containing field attribute references in key=>value pair, i.e. `fieldName (key) => field attributes (value)`.

```js
const mySchema = {
	id, // id field attributes
	name, // name field attributes
	//etc...
};
```

### Field Attributes

Can define how a field corresponds to a DB table field, whether it's readable/writable, is it a generated field, as well as relationships between models.

Defining a field attribute, can be verbose using an object with special keys, or can be shorthanded with specific datatypes

| Property                      | Attr Example                                                      | Shorthand DataType | ShortHand Example           | Description                                                        |
| ----------------------------- | ----------------------------------------------------------------- | ------------------ | --------------------------- | ------------------------------------------------------------------ |
| `references`                  | e.g. `{references: ['country.id']}`                               | `Array`            | `county_id: ['country.id']` | Relationship with other models                                     |
| `alias`                       | e.g. `{alias: 'email'}`                                           | `String`           | `emailAddress: 'email'`     | Alias a field with a DB Table field                                |
| `handler`                     | e.g. `{handler: Function}`                                        | `Function`         | `url: urlFunction`          | Generated Field                                                    |
| `type`                        | e.g. `{type: 'json'}`                                             | na                 | na                          | Type of data in field, this has various uses.                      |
| `defaultValue`                | e.g. `{defaultValue: 'active'}`                                   | na                 | na                          | Default Value to insert during post, and filter with get/patch/del |
| `readable`                    | e.g. `{readable: false}`                                          | na                 | na                          | Disables/Enables request access to a field                         |
| `writeable`                   | e.g. `{writeable: false}`                                         | na                 | na                          | Disables/Enables write access to a field                           |
| na                            | e.g. `{writeable: false: readable: false}`                        | `Boolean`          | `{password: false}`         | Disables/Enables both write and read access to a field             |
| `get`, `post`, `patch`, `del` | e.g. `{get: {defaultValue: 'active'}, patch: {writeable: false}}` | na                 |                             | Extends the existing fieldDefinition based upon the method used    |

Fields dont need to be explicitly defined in the `options.models.*tbl*.schema` where they map one to one with a DB table fields the request will just go through verbatim.

#### Field attribute: `reference`

In the example below the fields `users.country_id` defines a reference with `country.id` which is used to construct SQL JOIN Conditions.

```js
const dare = new Dare({
	models: {
		users: {
			schema: {
				// users fields...
				country_id: ['country.id'],
			},
		},
		country: {
			schema: {
				// country fields...
				id: {},
			},
		},
	},
});
```

#### Field attribute: `type`

Defining the `type` introduces additional features.

**`datatime`**

Setting value to 'datetime', a conditional filter short hand for `created_time: 2017` would be expanded to `created_time BETWEEN '2017-01-01T00:00:00' AND '2017-12-31T23:59:59`

```js
const dare = new Dare({
	models: {
		users: {
			schema: {
				created_time: {
					type: 'datetime',
				},
			},
		},
	},
});
```

**`date`**

With `type=date`; Instance of the `Date` objects are converted to `YYYY-MM-DD` format for insertion

```js
const dare = new Dare({
	models: {
		members: {
			schema: {
				start_date: {
					type: 'date',
				},
			},
		},
	},
});

// Example POSt => SQL
dare.post('members', {start_date: new Date()}); // 'INSERT INTO members (`start_date`) VALUES ('2025-01-02');`
```

**`json`**

Serializes Objects and Deserializes JSON strings in `get`, `post` and `patch` operations. Setting this value also enables the ability to filter results by querying within the JSON values

i.e.

Schema: field definition...

```js
const dare = new Dare({
	models: {
		users: {
			schema: {
				meta: {
					// Define a field meta with data type of json
					type: 'json',
				},
			},
		},
	},
});
```

Example set and get

```js
// Arbitary object...
const meta = {
	prop1: 1,
	prop2: 2,
};

// For a field named `meta`
const {insertId: id} = await dare.post('users', {meta});
// The value is run through JSON.stringify before insertion
// INSERT INOT users (meta) VALUES('{"prop1": 1, "prop2": 2}')

// The filter will find records where the JSON meta field has a `prop1 = 1` (For MySQL 5.7+)
// If stored as TEXT type field the field is deserialised
const {meta} = await dare.get('users', ['meta'], {meta: {prop1: 1}});
// i.e. meta === {prop1: 1, prop2: 2);
```

Many of the same search operators as used in filtering regular fields will work in comparing against properties within JSON objects.
i.e. (=), `-` (!=), `%` (LIKE), '~' (BETWEEN) etc... will work if your database engine support it.

#### Field attribute: `handler`

When the value is a function, the function will be invoked when interpretting the request as part of a field value. The response of this function can either be a static value or it can be an additional function which is optionally run on all items in the response, to return a generated field.

E.g.

This will manipulate the request and response to create the property `avatar_url` on the fly.

```js
const dare = new Dare({
	models: {
		users: {
			schema: {
				avatar_url(fields) {
					fields.push('id'); // require additional field from users table.

					return item => `/images/avatars/${item.id}`;
				},
			},
		},
	},
});
```

#### Field attribute: `alias`

To alias a field, so that you can use a name different to the db column name, assign it a string name of the field in the current table. e.g. `emailAddress: 'email'`

```js
const dare = new Dare({
	models: {
		users: {
			schema: {
				emailAddress: 'email',
			},
		},
	},
});
```

For example this will enable the use of `emailAddress` in our api (see below), but the SQL generated will refer to it with it's true field name "`email`".

```js
await dare.get('users', ['emailAddress'], {emailAddress: 'andrew@%'});
// SELECT email AS emailAddress FROM users WHERE email LIKE 'andrew@%'

await dare.post('users', {emailAddress: 'andrew@example.com'});
// INSERT INTO users (email) VALUES ('andrew@example.com')
```

##### Nested and SQL `alias`'s

The aliasing can also be used for common functions and define fields on another table to abstract away some of the complexity in your relational schema and provide a cleaner api interface.

e.g.

```js
const dare = new Dare({
	models: {
		users: {
			schema: {
				emailAddress: {
					// Explicitly define the alias
					// Reference the email define on another table, we can also wrap in SQL functions.
					alias: 'LOWER(usersEmails.email)',
				},
			},
		},
		// Any cross table join needs fields to map
		usersEmails: {
			schema: {
				user_id: ['users.id'],
			},
		},
	},
});
```

note: Defining an alias which includes SQL or points to another table will let it be used in a query filter and join conditions.
However an error will throw if attempting to set a value to such an alias.

#### Field attribute: `defaultValue`

Defining the `defaultValue` introduces default conditions or values when querying or inserting records respectively.

`defaultValue` can be any value supported by the context it is used. And it might be useful to use fieldDefinition extensions based

e.g we can define what `defaultValue` is used in various scenarios:

```js
// GET (defaultValue = active), adds condition
filter[prop] = defaultValue;

// POST (defaultValue = active)
body[prop] = defaultValue;

// Del (defaultValue = active)
filter[prop] = defaultValue;
```

**`defaultValue`**

In the example we're going to set the defaultValue for the `users.status` field to `"active"`.

```js
const dare = new Dare({
	models: {
		users: {
			schema: {
				status: {
					defaultValue: 'active',
				},
			},
		},
	},
});

// And now requests will by default include that value
await dare.post('users', {name: 'Andrew'}); // INSERT INTO users (name, status) VALUES ("Andrew", "active")
await dare.get('users', ['id'], {limit: 100}); // SELECT id FROM users WHERE status = 'active' LIMIT 100
// ... adds same condition for Del and Patch methods
```

#### Field attribute: `readable`/`writeable`

A flag to control access to a field

```js
const dare = new Dare({
	models: {
		users: {
			schema: {
				// Explicit object
				id: {
					readable: true,
					writeable: false, // non-writeable
				},

				// Shorthand for non-readable + non-writeable
				password: false,
			},
		},
	},
});
```

With the above `writeable`/`readable` field definitions an error is thrown whenever attempting to access the field e.g.

```js
await dare.get('users', ['password'], {id: 123});
// throws {code: INVALID_REFERENCE}
```

Or when trying to modify a field through `post` or `patch` methods, e.g.

```js
await dare.patch('users', {id: 321}, {id: 1337});
// throws {code: INVALID_REFERENCE}
```

#### Field attribute `[method]: Object`

A key with name like (`post`, `patch`, `get` and `del`) with a value containing Field Definitions. Can override requests with methods of the same key name.

For example:

```js
const dare = new Dare({
	models: {
		users: {
			schema: {
				/**
				 * Should you want a field to be writeable only on `post`, but not writeable on any other operation you could write...
				 */
				name: {
					writeable: false,
					post: {
						writeable: true,
					},
				},

				/**
				 * defaultValue: apply only on `get` requests
				 */
				status: {
					get: {
						defaultValue: 'active',
					},
				},
			},
		},
	},
});
```

### `default` Field definition

When a request is made for a field which doesn't exist in the model schema, Dare will fallback to a `default` field key - if that has been defined, otherwise it will continue with no explicit properties.

The `default` field can be used to prevent access to fields which should not be accessed, or to prevent unnessary SQL requests for fields which dont exist in the DB Table.

```js
const dareInst = dare.use({
	models: {
		// Example member model
		member: {
			schema: {
				// Assign a default field key
				default: {
					readable: false,
				},
				name: {
					type: 'string',
				},
			},
		},
	},
});

await dareInst.get('member', ['name', 'password']);
// Throw `Field 'password' is not readable`
```

## `model.shortcut_map`

`shortcut_map`, can be used to define shortcut's to nested tables

```js
const dare = dare.use({
	infer_intermediate_joins: false, // A 'shortcut' can be used to replace infer_intermediate_joins

	models: {
		users: {
			shortcut_map: {
				myTeams: 'userTeams.team',
			},
		},
	},
});
```

The definition above will help simplify references to the `teams` model.

```js
const resp = await dare.get({
	table: 'users',
	fields: [
		{
			// Direct link to userTeams, automatically uses pivot table userTeams
			myTeams: ['id', 'name'],
		},
	],
	join: {
		myTeams: {
			'%name': '%team%',
		},
	},
});
// SELECT CONCAT('[', GROUP_CONCAT(IF(c._rowid IS NOT NULL, JSON_ARRAY(c.id,c.name), NULL)), ']') AS 'myTeams[id,name]'
// FROM users a
// LEFT JOIN userTeams b ON (b.user_id = a.id)
// LEFT JOIN teams c ON (c.id = b.team_id)
// WHERE c.name LIKE '%team%'
// GROUP BY a._rowid
// LIMIT 1
```

## `model.get`

Here's an example of setting a model to be invoked whenever we access `users` model. In the below example we're restricting what records the user has access to.

```js
function get(options) {
	// In this example we're filtering access to the `users` model by the properties of the `state` data.
	options.filter.id = options.state.userId;
}

// For completeness we'll assume the new Dare instance approach for adding the options...
const dare = new Dare({
	models: {
		users: {
			get,
		},
	},
});

// Here we're using `table:users`, so the model's `get` Function would be invoked
await dare.get({
	table: 'users',
	fields: ['name'],
	limit: 100,
	state: {
		userId: 123,
	},
});

// SELECT name FROM users WHERE id = 123 LIMIT 100;
```

# Data validation

Dare has limited validation built in (see above). Set your own `validationInput` to check input values being applied in `patch` and `post` operation.

## validateInput(fieldAttributes, field, value)

The `validateInput` validation is called after any method model handlers. It contains the following parameters...

| property        | Type   | Description      |
| --------------- | ------ | ---------------- |
| fieldAttributes | Object | Field Attributes |
| field           | string | Field Name       |
| value           | \*     | Input value      |

e.g.

```js
dare.use({
	models: {
		// Member Model
		member: {
			schema: {
				username: {
					required: true,
					type: 'string',
					maxlength: 5,
					test(value) {
						if (!/\W/.test(value)) {
							throw new Error(
								`😞: username should only contain alphabetical characters`
							);
						}
					},
				},
				age: {
					// Another field
				},
			},
		},
	},

	validateInput(fieldAttributes, field, value) {
		if (!fieldAttribute) {
			throw new Error(`😞: ${field} field is unknown`);
		}
		if (fieldAttributes.required && value === undefined) {
			throw new Error(`😞: ${field} is missing`);
		}
		if (fieldAttributes.type && typeof value !== 'string') {
			throw new Error(`😞: ${field} should be a string`);
		}
		if (
			fieldAttributes.maxlength &&
			value.length > fieldAttributes.maxlength
		) {
			throw new Error(
				`😞: ${field} should be less than ${fieldAttributes.maxlength} characters`
			);
		}
		fieldAttributes.test?.(value);
	},
});

// Then see what errors you'd get...

dare.post('member', {username: 'Fine', hello: "What's this?"});
// 😞: hello field is unknown

dare.post('member', {age: 5});
// 😞: username is missing

dare.post('member', {username: 123});
// 😞: username should be a string

dare.post('member', {username: 'Thisistoolong'});
// 😞: username should be less than 5 characters

dare.post('member', {username: 'No strange characters !@£$%^YU'});
// 😞: username should only contain alphabetical characters
```

### default attributes of model schema

The `default` field definition can be defined per model. This is useful to say when to be strict with unknown fields.

e.g.

```js
dare.use({
	models: {
		// Member Model
		member: {
			schema: {
				default: {
					// Be strict with the member model
					writeable: false,
				},
				// ... other field definitions below
			},
		},
	},

	validateInput(fieldAttributes, field, value) {
		if (!fieldAttribute) {
			// Do nothing, We have no field definitions for this model
			console.log(
				`Someone should write field definitions for ${field} 👉`
			);
		}
		if (fieldAttributes.writeable === false) {
			throw new Error(`😞: ${field} field is un-writeable`);
		}
		// ... other validation rules below
	},
});

// So on the member table the default field would be replaced with an unknown field and would be caught
dare.post('member', {hello: "What's this?"});
// 😞: hello is un-writeable

// Whilst the same unknown field would be allowed through where the default field is not declared
dare.post('emails', {hello: "What's this?"});
// Someone should write field definitions for hello 👉`
```

# `options.getFieldKey`

The `options.getFieldKey` is used to obtain the correct schema field definition and SQL field name. This can be useful when allowing queries to be written in camelCase, but where the fields and the schema use snake_case.

e.g.

```js
// Create a new dare instance
dare = dare.use({
	getFieldKey(field, schema) {
		// Normal
		if (field in schema) {
			return field;
		}
		// Convert camelCase to snake_case
		const snakeCase = field.replaceAll(
			/[A-Z]+/g,
			(m, index) => `${index > 0 ? '_' : ''}${m.toLowerCase()}`
		);
		if (snakeCase in schema) {
			return snakeCase;
		}

		return field;
	},
});

// CamelCase parameters here...
await dare.patch('users', {lastName}, {firstName});

// Get's mapped to snake_case parameters here
//  UPDATE users a
// 	SET
// 		a.`first_name` = 'B'
// 	WHERE
// 		a.last_name = 'Name'
// 	LIMIT 1
```

# `options.rowHandler`

The `options.rowHandler` can be used to additionally preformat the response array, whilst it's already iterating on the response, or to redirect the records to another service (When this is used with [Streaming](#Streaming) it can drastically reduce the memory used by Dare).

E.g. here the records are redirected back to the client

```js
// create a new dare instance to avoid polluting the others.
const resp = await dare.get({
	table: 'users',
	fields: ['name' /*... and more*/],
	limit: 1_000_000, // a big number
	// Define a rowHandler for the request...
	rowHandler(row) {
		// rudimentary write out as CSV.
		res.write(Object.keys(item).join(',') + '\n');

		// do not return anything, save dare building up resultset internally
	},
});

console.log(resp === undefined); // empty response... as it was all redirected
```

# Streaming

Typically databases will buffer the resultset into memory and send over one large payload. Whereas streaming sends over the results to the SQL Client as they are available. This has the benefit of being much more performant and memory efficient on large datasets.

Dare, has some functions to take advantage of Streaming

- `this.addRow(record)`: process an individual record
- `options.rowHandler`: See above

When combined we can efficiently redirect the results immediatly without building up an internal memory.

```js
// Define an execute handler and call `this.addRow(record)`
dare.execute = async function (query) {
	// Define the current Dare Instance
	const dareInstance = this;

	// Return a promise out of a stream...
	return new Promise((accept, reject) => {
		// Create resultStream
		const resultStream = new PassThrough({objectMode: true});

		// Pipe results into resultStream...
		dbconn.connection.query(query).stream().pipe(resultStream);

		// Catch errors...
		resultStream.on('error', reject);

		// Event handlers...
		resultStream.on('data', row => {
			// Process the row record with Dare, i.e. for formatting etc...
			dareInstance.addRow(row);
		});

		// on:end; resolve with empty Promise
		resultStream.on('end', () => accept());
	});
};

// Construct the Dare Request
// define a `rowHandler` to pass through the newly formatted records as and when they come in.
await dare.get({
	table: 'users',
	fields: ['name' /*... and more*/],
	limit: 1_000_000, // a big number
	// Define a rowHandler for the request...
	rowHandler(row) {
		// rudimentary write out as CSV.
		res.write(Object.keys(item).join(',') + '\n');

		// do not return anything - saves dare from building up internal resultset
	},
}); // returns: undefined
```

# Exists

Determining whether a record exists can be achieved by simply making a query using the `notfound` to return a falsy value, and an arbitary fields reference, or for a shorthand, omit the `fields` entirely - see this shorthand approach below - which as an example will instead return a truthy value `{recordExists: true}` for a hit, or a `null` for a miss.

> [!NOTE]
> Dont rely on the object properties of a hit, only that it has returned a truthy value.

```js
const exists = await dare.get({
	table,
	filter,
	notfound: null,
});

// Hit: {recordExists: true}
// Miss: null (whatever provided by notfound)
```

# Additional Options

## Fulltext Search

Dare support MySQL's FullText search syntax. The `*` symbol preceeding the key in a condition denote _compare using a fulltext search syntax_.

A prerequirement for FullText Search is that the corresponding FullText Index has been created for the fields being accessed.

i.e.

```js
await dare.get({
	table: 'users',
	fields: ['name'],
	filter: {
		'*name': 'Andrew',
	},
});
// SELECT name FROM users WHERE MATCH(name) AGAINST ('Andrew' IN BOOLEAN MODE)
```

The approach also supports multiple field definitions in the key, i.e.

```js
  filter: {
	'*name,email': 'Andrew',
  }
// SELECT name FROM users WHERE MATCH(name, email) AGAINST ('Andrew' IN BOOLEAN MODE)
```

> [!NOTE]
> It might be handy to create a new field in the Model Schema which aliases all the Indexed fields, i.e...
>
> ```js
> schema: {
> 	textsearch: 'name,email';
> }
> ```
>
> Now the filter would just call the alias name, and there's only one place to change it.
>
> ```js
>  filter: {
> 	'*textsearch': 'Andrew',
>  }
> // SELECT name FROM users WHERE MATCH(name, email) AGAINST ('Andrew' IN BOOLEAN MODE)
> ```
## Performance with LIMIT'ed nested queries

Nested subqueries generated via Dare do not take advantage of restricted datasets through SQL `LIMIT` - atleast this was the case with MySQL's InnoDB tables. 

To address this in MySQL 8, and other databases which support Common Table Expressions (CTE), Dare will by default apply filtering and limiting via a CTE with an INNER JOIN to the rowid to the base table.

By default, the rules defined in `applyCTELimitFiltering` enables this features for all databases (with the exception of MySQL 5.*), and for requests for less than 10k records.

The rules around when to apply the CTE can be adjusted, e.g.

```js
const dare = new Dare(options);
dare.applyCTELimitFiltering = (options) => {
	return options.limit < 10_000;
}
```

To enable/disable CTE, have the function return truthy/falsy value.



## Multiple joins/filters on the same table

In order to both: show all relationship on the join table AND filter the main results by the joined table. One can either create separate table aliases (as described above) using one for the field name, and one for the filter. Or alternatively append an arbitary label, a `$` sign followed by an string. E.g.

E.g. Include all the tags associated with users AND only show users whom include the tag "Andrew"

```js
await dare.get({
	table: 'users',
	fields: ['name', {tags: ['name']}],
	filter: {
		tags$a: {
			name: 'Andrew',
		},
	},
});
```

This will get all users who contain atleast the tags 'Andrew', as well as returning all the other tags.

## After Handlers

An `dareInstance.after` handler is executed after the initial request has completed but before Dare has resolved the call. This makes it useful for logging as well as manipulating the response. If the handler returns `undefined` or `Promise<undefined>` then the original response is returned unaltered. And anything other than `undefined` will become the new response.

E.g. here is an example using the `after` handlers in the `users.patch` model to record a transaction.

```js
options.models.users = {
	async patch(options, dareInstance) {
		/**
		 * Check that the data to be modified
		 * By using the options to construct a SELECT request first
		 */

		// Clonse the options
		const opts = {
			...options,
			fields: ['id', 'name'],
		};

		// Execute a dare.get with the cloned options
		const {id: ref_id, name: previous_name} = await dare.get(opts);

		// Set the after handler
		dareInstance.after = () => {
			dare.post('changelog', {
				message: 'User updated',
				type: 'users',
				ref_id,
				previous_name,
			});

			// Returns undefined so no change
		};
	},
};
```

### Handling dates and date ranges

The library supports a number of user friendly ways of passing in dates and date ranges by constructing the formal timestamp implied in the data passed to Dare.

E.g. here is a list of supported syntaxes and the resulting timestamp.

```
2018-01-01..2018-01-02,
2018-01-01..02,
2018-1-1..2

=== 2018-01-01T00:00:00..2018-01-02T23:59:59

etc...
```

### Changing the default MAX_LIMIT

By default the maximum value for a `limit` option is set by `dare.MAX_LIMIT`, you can override this in an instance of Dare.

```js
import Dare from 'dare';

// Initiate it
const dare = new Dare();

await dare.MAX_LIMIT = 1000000;
```

### Disabling intermediate model joins `infer_intermediate_models`

By default `infer_intermediate_models = true`. This allows two models which share a common relationship with another model to be joined in a query directly. However sometimes this can be unpredictable if there are potentially more than one shared references between the models. In which case you would need to use explicit full paths, you then might like to disable `infer_intermediate_models` so that you catch anything which doesn't tow the line.

```js
// Disable intermediate models

// On new instance
const dare = new Dare({infer_intermediate_models: false});

// On extended instance
const dareInst = dare.use({infer_intermediate_models: false);

// On individual queries...
await dare.get({
	// ... other options
	infer_intermediate_models: false
});
```

### Infering conditional operators based on value `conditional_operators_in_value`

By default `conditional_operators_in_value = '!%'`. Which is a selection of special characters within the value to be compared.

- `%`: A string containing `%` within the value to be compared will indicate a wild character and the SQL `LIKE` conditional operator will be used.
- `!`: A string starting with `!` will negate the value using a SQL `LIKE` comparison operator.
- `..`: A string containing `..` will use a range `BETWEEN`, `<` or `>` comparison operator where a string value contains `..` or the value is an array with two values (dependending if the first or second value is empty it will use `<` or `>` respecfively). This denotes a range and is enabled using the `~` operator (because `.` within prop name has another meaning)

```js
// Enabling support for one or more of the above special characters...

// On new instance
const dare = new Dare({conditional_operators_in_value: '%!~'});

// On extended instance
const dareInst = dare.use({conditional_operators_in_value: '%!~');

// On individual queries...
await dare.get({
	table: 'mytable',
	fields: ['id'],
	filter: {name: '%compare%', created: '2022-01-01..'}
	conditional_operators_in_value: '%!~'
});

// ... SELECT id FROM mytable WHERE name LIKE '%compare%' AND created > '2022-01-01'

// The same query with the option disabled
await dare.get({
	table: 'mytable',
	fields: ['id'],
	filter: {name: '%compare%', created: '2022-01-01..'}
	conditional_operators_in_value: ''
});

// Fallbacks to the '=' conditional operator
// ... SELECT id FROM mytable WHERE name = '%compare%' AND created = '2022-01-01..'

```

### Overriding table schema per operation

You can override the schema per operation using the `models` option:

E.g.

```js
// On an instance, or create new instance with newDareInstance = dare.use(options)
const dare = new Dare({
	models: {
		my_table: {
			schema: {
				a_write_protected_field: {
					type: 'datetime',
					writeable: false,
				}
			}
		},
	}
});

// On an individual request
await dare.patch({
	table: 'my_table',
	body: {
		a_write_protected_field: 'new value,
	},
	models: {
		my_table: {
			schema: {
				write_protected_field: {
					writeable: true,
				},
			}
		},
	},
});
```

### DB Engine compatibility

This version of Dare is designed to work with:

- MySQL (5.6, 5.7 and 8)
- Postgres (16.3)
- MariaDB (11)

Set the property `engine` on the Dare instance
e.g.

```js
const dare = new Dare{{
	engine: 'postgres:16.3',
	...
}};

// Or, have multiple instances...
let dareWithPostgres = dare.use({
	engine: 'postgres:16.3'
});
```

# Caveats

## Only one column name may appear in a Field Expression

Dare can't have more than one model field/column names in the same field expression.

e.g. Fields array....

```js
[{
	// Both fist_name and last_name in the same field expression 💥
	`displayName`: 'CONCAT(first_name, last_name)' // ❌
}]
```

To work around this we'd simply use post-formatting. Either write one yourself or make a Generated Field (handler) in the Dare schema and request that by name in the field expression.
