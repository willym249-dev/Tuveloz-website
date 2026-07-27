CREATE TABLE `launch_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`audience` text NOT NULL,
	`feature_wanted` text NOT NULL,
	`problem_to_solve` text NOT NULL,
	`trust_builder` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `launch_feedback_created_at_idx` ON `launch_feedback` (`created_at`);--> statement-breakpoint
CREATE INDEX `launch_feedback_audience_idx` ON `launch_feedback` (`audience`);