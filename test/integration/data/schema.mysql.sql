/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uuid` BINARY(16) DEFAULT NULL,
  `username` varchar(255) NOT NULL,
  `first_name` varchar(255) DEFAULT NULL,
  `last_name` varchar(255) DEFAULT NULL,
  `secret` varchar(2048) DEFAULT NULL,
  `settings` varchar(2048) DEFAULT NULL,
  `country_id` int(11) DEFAULT NULL,

  /*!50712
    ft_index TEXT GENERATED ALWAYS AS (CONCAT_WS(username, first_name, last_name)) STORED,
    FULLTEXT KEY `users-ft-index` (`ft_index`),
  */

  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_username` (`username`),
  FULLTEXT KEY `fulltext_users_fields` (`username`, `first_name`, `last_name`),
  -- country
	KEY `fk_users_country_id` (`country_id`),
  CONSTRAINT `fk_users_country_id` FOREIGN KEY (`country_id`) REFERENCES `country` (`id`)

) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8;

CREATE TABLE users_email (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_email` (`email`),
  -- users
  KEY `fk_userEmails_user_id` (`user_id`),
  CONSTRAINT `fk_userEmails_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8;

CREATE TABLE `teams` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` TEXT NULL,
  `updated_time` TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uind` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8;

CREATE TABLE `userTeams` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `team_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),

	-- users
	KEY `fk_userTeams_user_id` (`user_id`),
  CONSTRAINT `fk_userTeams_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),

  -- teams
	KEY `fk_userTeams_team_id` (`team_id`),
  CONSTRAINT `fk_userTeams_team_id` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`)

) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8;

CREATE TABLE `country` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` CHAR(2) NOT NULL,
  `created_time` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8;


/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
