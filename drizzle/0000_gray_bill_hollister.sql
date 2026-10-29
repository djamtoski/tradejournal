CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`broker` text,
	`currency` text DEFAULT 'USD' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `executions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`import_id` integer,
	`trade_id` integer,
	`symbol` text NOT NULL,
	`asset_class` text NOT NULL,
	`action` text NOT NULL,
	`quantity` real NOT NULL,
	`price` real NOT NULL,
	`fees` real DEFAULT 0 NOT NULL,
	`executed_at` integer NOT NULL,
	`fingerprint` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`import_id`) REFERENCES `imports`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trade_id`) REFERENCES `trades`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `executions_fingerprint_idx` ON `executions` (`account_id`,`fingerprint`);--> statement-breakpoint
CREATE INDEX `executions_trade_idx` ON `executions` (`trade_id`);--> statement-breakpoint
CREATE TABLE `imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`broker` text NOT NULL,
	`file_name` text NOT NULL,
	`execution_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`followed_rules` integer,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `journal_entries_day_unique` ON `journal_entries` (`day`);--> statement-breakpoint
CREATE TABLE `playbooks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `screenshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trade_id` integer,
	`day` text,
	`file_path` text NOT NULL,
	`annotations` text,
	`caption` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`trade_id`) REFERENCES `trades`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tag_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_groups_name_unique` ON `tag_groups` (`name`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer,
	`name` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `tag_groups`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `trade_tags` (
	`trade_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`trade_id`, `tag_id`),
	FOREIGN KEY (`trade_id`) REFERENCES `trades`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`symbol` text NOT NULL,
	`asset_class` text NOT NULL,
	`side` text NOT NULL,
	`multiplier` real DEFAULT 1 NOT NULL,
	`quantity` real NOT NULL,
	`entry_price` real NOT NULL,
	`exit_price` real,
	`opened_at` integer NOT NULL,
	`closed_at` integer,
	`gross_pnl` real DEFAULT 0 NOT NULL,
	`fees` real DEFAULT 0 NOT NULL,
	`net_pnl` real DEFAULT 0 NOT NULL,
	`mfe` real,
	`mae` real,
	`stop_price` real,
	`target_price` real,
	`followed_rules` integer,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trades_closed_at_idx` ON `trades` (`closed_at`);--> statement-breakpoint
CREATE INDEX `trades_account_idx` ON `trades` (`account_id`);--> statement-breakpoint
CREATE INDEX `trades_symbol_idx` ON `trades` (`symbol`);