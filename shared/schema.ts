import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const readers = pgTable("readers", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  assignmentVersion: integer("assignment_version").default(0).notNull(),
});

export const readersRelations = relations(readers, ({ many }) => ({
  meters: many(meters),
  readings: many(readings),
}));

export const meters = pgTable("meters", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  accountNumber: text("account_number").notNull(),
  sequence: text("sequence").notNull(),
  meterNumber: text("meter_number").notNull(),
  category: text("category").notNull(),
  subscriberName: text("subscriber_name").notNull(),
  address: text("address").default(""),
  record: text("record").notNull(),
  block: text("block").notNull(),
  property: text("property").notNull(),
  previousReading: integer("previous_reading").notNull(),
  previousReadingDate: timestamp("previous_reading_date").notNull(),
  currentAmount: numeric("current_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  debts: numeric("debts", { precision: 12, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  readerId: varchar("reader_id").references(() => readers.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const metersRelations = relations(meters, ({ one, many }) => ({
  reader: one(readers, {
    fields: [meters.readerId],
    references: [readers.id],
  }),
  readings: many(readings),
}));

export const readings = pgTable("readings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  meterId: varchar("meter_id").notNull().references(() => meters.id),
  readerId: varchar("reader_id").notNull().references(() => readers.id),
  newReading: integer("new_reading"),
  photoPath: text("photo_path"),
  notes: text("notes"),
  skipReason: text("skip_reason"),
  isCompleted: boolean("is_completed").default(true).notNull(),
  readingDate: timestamp("reading_date").defaultNow().notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const readingsRelations = relations(readings, ({ one }) => ({
  meter: one(meters, {
    fields: [readings.meterId],
    references: [meters.id],
  }),
  reader: one(readers, {
    fields: [readings.readerId],
    references: [readers.id],
  }),
}));

export const insertReaderSchema = createInsertSchema(readers).pick({
  username: true,
  password: true,
  displayName: true,
});

export const insertMeterSchema = createInsertSchema(meters).pick({
  accountNumber: true,
  sequence: true,
  meterNumber: true,
  category: true,
  subscriberName: true,
  address: true,
  record: true,
  block: true,
  property: true,
  previousReading: true,
  previousReadingDate: true,
  currentAmount: true,
  debts: true,
  totalAmount: true,
  readerId: true,
});

export const insertReadingSchema = createInsertSchema(readings).pick({
  meterId: true,
  readerId: true,
  newReading: true,
  photoPath: true,
  notes: true,
  skipReason: true,
  readingDate: true,
  latitude: true,
  longitude: true,
});

export type InsertReader = z.infer<typeof insertReaderSchema>;
export type Reader = typeof readers.$inferSelect;
export type InsertMeter = z.infer<typeof insertMeterSchema>;
export type Meter = typeof meters.$inferSelect;
export type InsertReading = z.infer<typeof insertReadingSchema>;
export type Reading = typeof readings.$inferSelect;

export type MeterWithReading = Meter & {
  latestReading?: Reading | null;
};
