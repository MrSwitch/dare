#!/usr/bin/env bash

# What does this script do?
# 1. changes directory to test/integration
# 2. exports all the db connection settings for use in nodejs/mocha
# 3. brings up docker-compose (mysql) and waits until ready
# 4. creates a new db into which the /data/data.sql is imported
# 5. mocha integration tests run (they will build and populate the test DBs from those files beforeEach test)
# 6. if KEEP_DOCKER=1 is set, docker-compose isn't pulled down after

set -e
# set -x

node --version

CURR_SCRIPT_RELATIVE="${BASH_SOURCE[0]}"
CURR_DIR_RELATIVE="$(dirname "${CURR_SCRIPT_RELATIVE}")"
INTEGRATION_TEST_DIR="$(cd "${CURR_DIR_RELATIVE}" >/dev/null 2>&1 && pwd)/"
echo "INTEGRATION_TEST_DIR=${INTEGRATION_TEST_DIR}"
# Changing to this dir means docker-compose will use the correct docker-compose.yml file.
# As an alternative we could pass the file with -f flag, but then we have to remember to add it to every
# docker-compose command (including those invoked from within nodejs/mocha beforeEach).
# Could always move the docker-compose file to the root (dashboardV2/)
cd "$INTEGRATION_TEST_DIR" || exit 1

DB_ROOT_USER="root"
DB_ROOT_PASSWORD="test_pass"
DB_ENGINE=${DB_ENGINE:-mysql:8.0.23}

DB_ENGINE_NAME=$(echo $DB_ENGINE | cut -d: -f1)


export TEST_DB_SCHEMA_PATH="${INTEGRATION_TEST_DIR}data/schema.${DB_ENGINE_NAME}.sql"
export TEST_DB_DATA_PATH="${INTEGRATION_TEST_DIR}data/data.sql"
export TEST_STATE_CLEANUP_MODE=${TEST_STATE_CLEANUP_MODE:-remove}
export DB_USER="user"
export DB_PASSWORD="password"
export DB_HOST="127.0.0.1"
export DB_PORT=3308

export TZ="UTC"

docker rm -vf "dare_db"

echo "Starting $DB_ENGINE"

if [ "$DB_ENGINE_NAME" = "postgres" ]
then

	docker run \
		--name="dare_db" \
		--tmpfs=/var/lib/postgresql/data \
		-d \
		-p ${DB_PORT}:5432 \
		--env POSTGRES_USER="postgres" \
		--env POSTGRES_PASSWORD="${DB_PASSWORD}" \
		--env POSTGRES_DB="dare" \
		--health-cmd="/usr/bin/psql --username=postgres --dbname=postgres --command=\"SELECT 1;\"" \
		--health-interval="4s" \
		--health-timeout="3s" \
		--health-retries=20 \
		$DB_ENGINE || {
		echo 'docker run failed'
		exit 1
	}

elif [ "$DB_ENGINE_NAME" = "mariadb" ]
then

	export TEST_DB_SCHEMA_PATH="${INTEGRATION_TEST_DIR}data/schema.mysql.sql"

	docker run \
		--name="dare_db" \
		--tmpfs=/var/lib/mariadb \
		-d \
		-p ${DB_PORT}:3306 \
		--env MARIADB_ROOT_PASSWORD="${DB_ROOT_PASSWORD}" \
		--env MARIADB_DATABASE="dare" \
		--env MARIADB_USER="${DB_USER}" \
		--env MARIADB_PASSWORD="${DB_PASSWORD}" \
		--env MARIADB_PORT=3306 \
		--health-cmd="/usr/bin/mariadb --user=root -p${DB_ROOT_PASSWORD} --execute=\"SHOW DATABASES;\"" \
		--health-interval="4s" \
		--health-timeout="3s" \
		--health-retries=20 \
		$DB_ENGINE --group-concat-max-len=1000000 --sql-mode="" || {
		echo 'docker run failed'
		exit 1
	}
else

	docker run \
		--name="dare_db" \
		--tmpfs=/var/lib/mysql \
		-d \
		-p ${DB_PORT}:3306 \
		--env MYSQL_ROOT_PASSWORD="${DB_ROOT_PASSWORD}" \
		--env MYSQL_DATABASE="dare" \
		--env MYSQL_USER="${DB_USER}" \
		--env MYSQL_PASSWORD="${DB_PASSWORD}" \
		--env MYSQL_PORT=3306 \
		--health-cmd="/usr/bin/mysql --user=root -p${DB_ROOT_PASSWORD} --execute=\"SHOW DATABASES;\"" \
		--health-interval="4s" \
		--health-timeout="3s" \
		--health-retries=20 \
		$DB_ENGINE --group-concat-max-len=1000000 --sql-mode="" || {
		echo 'docker run failed'
		exit 1
	}
fi


# Check that the DB is up...

for dep in db; do
	echo "waiting for ${dep}..."
	i=0
	until [ "$(docker inspect --format='{{.State.Health.Status}}' "dare_${dep}")" == "healthy" ]; do
		# LOL:
		# using `((i++))` exits the program as it returns 1
		# this only happens on Circle CI
		# this *doesn't* occur when running bash on mac (GNU bash, version 3.2.57(1)-release)
		# NOR when re-running a circle job with SSH (which is crazy!)
		# maybe it's this? https://stackoverflow.com/questions/6877012/incrementing-a-variable-triggers-exit-in-bash-4-but-not-in-bash-3
		# why is circle running two versions of bash!?!?
		i=$((i + 1))
	echo "pending $i";
		sleep 2
		if [[ "$i" -gt '20' ]]; then
			echo "${dep} failed to start. Final status: $(docker inspect --format='{{.State.Health.Status}}' "dare_${dep}")"
			docker rm -v -f "dare_${dep}"
			exit 1
		fi
	done
	echo "${dep} up"
done


if ( [ "$DB_ENGINE_NAME" = "mysql" ] ); then
	dbclient="docker exec -e MYSQL_PWD=${DB_ROOT_PASSWORD} dare_db mysql -u${DB_ROOT_USER}"
	$dbclient -e "GRANT ALL PRIVILEGES ON *.* TO '${DB_USER}'@'%' WITH GRANT OPTION;"
	DB_VERSION=`$dbclient -e "SELECT VERSION()"`;
elif ( [ "$DB_ENGINE_NAME" = "mariadb" ] ); then
	dbclient="docker exec dare_db mariadb -u${DB_ROOT_USER} -p${DB_ROOT_PASSWORD}"
	$dbclient -e "GRANT ALL PRIVILEGES ON *.* TO '${DB_USER}'@'%' WITH GRANT OPTION;"
	DB_VERSION=`$dbclient -e "SELECT VERSION()"`;
fi

echo "Connected to $DB_ENGINE_NAME:$DB_VERSION";

echo 'building template db...'
export TEST_DB_PREFIX="test_"

echo 'template db built'

echo 'running tests...'
set +e
(
  # `-x` so we echo the command itself for reference
  set -x
  # $@ proxies all the args to this script to mocha (e.g. for filtering tests etc)
  mocha './**/*.spec.js' "$@"
)
EXIT_CODE=$?
set -e
echo 'tests complete'

if [[ -n "$KEEP_DOCKER" ]]; then
  echo "leaving docker running (detached)"
  if [ "$TEST_STATE_CLEANUP_MODE" == "remove" ]; then
    DBS="$($dbclient -e 'SHOW DATABASES')"
    for db in $DBS; do
      if [[ "$db" =~ ^${TEST_DB_PREFIX} ]]; then
        echo "removing test DB: $db"
        $dbclient -e "DROP DATABASE $db"
      fi

    done
  fi
else
  echo "shutting down docker..."
  docker rm -v -f "dare_db"

fi
echo "finished (tests exit code: $EXIT_CODE)"

exit $EXIT_CODE
