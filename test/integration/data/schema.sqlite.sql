CREATE TABLE country (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code CHAR(2) NOT NULL,
  created_time INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) DEFAULT NULL,
  last_name VARCHAR(255) DEFAULT NULL,
  uuid BLOB DEFAULT NULL,
  secret VARCHAR(2048) DEFAULT NULL,
  country_id INTEGER DEFAULT NULL,
  settings TEXT DEFAULT NULL,
  CONSTRAINT unique_username UNIQUE (username),
  FOREIGN KEY (country_id) REFERENCES country (id)
);

CREATE TABLE users_email (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  email VARCHAR(255) NOT NULL,
  CONSTRAINT unique_email UNIQUE (email),
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  updated_time TIMESTAMP,
  CONSTRAINT unique_name UNIQUE (name)
);

CREATE TABLE userTeams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id),
  FOREIGN KEY (team_id) REFERENCES teams (id)
);

CREATE VIRTUAL TABLE users_fts USING fts5(username, first_name, last_name, content='users', content_rowid='id');

CREATE TRIGGER users_ai AFTER INSERT ON users BEGIN
  INSERT INTO users_fts(rowid, username, first_name, last_name) VALUES (new.id, new.username, new.first_name, new.last_name);
END;

CREATE TRIGGER users_ad AFTER DELETE ON users BEGIN
  INSERT INTO users_fts(users_fts, rowid, username, first_name, last_name) VALUES('delete', old.id, old.username, old.first_name, old.last_name);
END;

CREATE TRIGGER users_au AFTER UPDATE ON users BEGIN
  INSERT INTO users_fts(users_fts, rowid, username, first_name, last_name) VALUES('delete', old.id, old.username, old.first_name, old.last_name);
  INSERT INTO users_fts(rowid, username, first_name, last_name) VALUES (new.id, new.username, new.first_name, new.last_name);
END;
