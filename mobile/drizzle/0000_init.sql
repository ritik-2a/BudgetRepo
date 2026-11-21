CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`opening_balance` integer DEFAULT 0 NOT NULL,
	`credit_limit` integer,
	`statement_day` integer,
	`due_day` integer,
	`icon` text,
	`color` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text,
	`month` text NOT NULL,
	`limit_amount` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `budget_month_idx` ON `budgets` (`month`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`icon` text NOT NULL,
	`color` text NOT NULL,
	`parent_id` text,
	`quick_amount` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `funds` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sip_amount` integer,
	`sip_day` integer,
	`current_value` integer,
	`current_value_date` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`target_amount` integer NOT NULL,
	`target_date` text,
	`saved_amount` integer DEFAULT 0 NOT NULL,
	`linked_account_id` text,
	`linked_fund_id` text,
	`icon` text,
	`color` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recurring_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`template` text NOT NULL,
	`frequency` text NOT NULL,
	`day` integer NOT NULL,
	`next_run` text NOT NULL,
	`mode` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`time` text NOT NULL,
	`title` text,
	`account_id` text,
	`fund_id` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`account_id` text NOT NULL,
	`to_account_id` text,
	`category_id` text,
	`fund_id` text,
	`date` text NOT NULL,
	`note` text,
	`recurring_rule_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tx_date_idx` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `tx_account_date_idx` ON `transactions` (`account_id`,`date`);--> statement-breakpoint
CREATE INDEX `tx_category_date_idx` ON `transactions` (`category_id`,`date`);--> statement-breakpoint
CREATE INDEX `tx_type_date_idx` ON `transactions` (`type`,`date`);