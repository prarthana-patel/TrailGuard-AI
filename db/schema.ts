import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const workspaces = sqliteTable('workspaces', { owner: text('owner').primaryKey(), version: integer('version').notNull(), data: text('data').notNull() });
