ALTER TABLE `playbooks` ADD `tag_id` integer REFERENCES tags(id);--> statement-breakpoint
ALTER TABLE `playbooks` ADD `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL;