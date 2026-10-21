CREATE TABLE `workspaces` (
	`owner` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`data` text NOT NULL
);
