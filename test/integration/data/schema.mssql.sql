CREATE TABLE country (
  id INT IDENTITY(1,1) NOT NULL,
  code CHAR(2) NOT NULL,
  CONSTRAINT pk_country PRIMARY KEY (id)
);

CREATE TABLE users (
  id INT IDENTITY(1,1) NOT NULL,
  username NVARCHAR(255) NOT NULL,
  first_name NVARCHAR(255) DEFAULT NULL,
  last_name NVARCHAR(255) DEFAULT NULL,
  ft_index AS CONCAT(
    COALESCE(username, ''),
    ' ',
    COALESCE(first_name, ''),
    ' ',
    COALESCE(last_name, '')
  ),
  uuid VARBINARY(16) DEFAULT NULL,
  secret NVARCHAR(2048) DEFAULT NULL,
  country_id INT DEFAULT NULL,
  settings NVARCHAR(MAX) DEFAULT NULL,
  CONSTRAINT pk_users PRIMARY KEY (id),
  CONSTRAINT unique_username UNIQUE (username)

  -- -- Foreign Keys
  -- CONSTRAINT fk_users_country_id FOREIGN KEY (country_id) REFERENCES country (id) ON DELETE CASCADE
);

CREATE TABLE users_email (
  id INT IDENTITY(1,1) NOT NULL,
  user_id INT NOT NULL,
  email NVARCHAR(255) NOT NULL,
  CONSTRAINT pk_users_email PRIMARY KEY (id),
  CONSTRAINT unique_email UNIQUE (email)

  -- -- users
  -- CONSTRAINT fk_userEmails_user_id FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE teams (
  id INT IDENTITY(1,1) NOT NULL,
  name NVARCHAR(255) NOT NULL,
  description NVARCHAR(MAX) NULL DEFAULT NULL,
  updated_time DATETIME2 NULL,
  CONSTRAINT pk_teams PRIMARY KEY (id),
  CONSTRAINT unique_name UNIQUE (name)
);

CREATE TABLE userTeams (
  id INT IDENTITY(1,1) NOT NULL,
  user_id INT NOT NULL,
  team_id INT NOT NULL,
  CONSTRAINT pk_userTeams PRIMARY KEY (id)

  -- -- Foreign Keys
  -- CONSTRAINT fk_userTeams_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  -- CONSTRAINT fk_userTeams_team_id FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE
);
