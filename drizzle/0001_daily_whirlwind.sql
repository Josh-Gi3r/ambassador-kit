CREATE TABLE `ambassador_applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fullName` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`region` varchar(128) NOT NULL,
	`socialHandle` varchar(255),
	`track` enum('content','community','enterprise') NOT NULL,
	`motivation` text NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`adminNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ambassador_applications_id` PRIMARY KEY(`id`)
);
