import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

const id = () => integer("id").primaryKey({ autoIncrement: true });
const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

export const assetClasses = ["stock", "future", "forex", "option"] as const;
export const sides = ["long", "short"] as const;

/** App-wide preferences as key/value pairs (see src/lib/settings/queries.ts). */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const accounts = sqliteTable("accounts", {
  id: id(),
  name: text("name").notNull(),
  broker: text("broker"),
  currency: text("currency").notNull().default("USD"),
  createdAt: createdAt(),
});

/** One broker upload. Deleting it cascades to its executions. */
export const imports = sqliteTable("imports", {
  id: id(),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  broker: text("broker").notNull(),
  fileName: text("file_name").notNull(),
  executionCount: integer("execution_count").notNull().default(0),
  createdAt: createdAt(),
});

/** A round trip from flat to flat, built from executions. */
export const trades = sqliteTable(
  "trades",
  {
    id: id(),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    assetClass: text("asset_class", { enum: assetClasses }).notNull(),
    side: text("side", { enum: sides }).notNull(),
    /** Contract multiplier (futures/options); 1 for stocks and forex. */
    multiplier: real("multiplier").notNull().default(1),
    quantity: real("quantity").notNull(),
    entryPrice: real("entry_price").notNull(),
    exitPrice: real("exit_price"),
    openedAt: integer("opened_at", { mode: "timestamp_ms" }).notNull(),
    closedAt: integer("closed_at", { mode: "timestamp_ms" }),
    grossPnl: real("gross_pnl").notNull().default(0),
    fees: real("fees").notNull().default(0),
    netPnl: real("net_pnl").notNull().default(0),
    /** Max favourable / adverse excursion, in price units. */
    mfe: real("mfe"),
    mae: real("mae"),
    stopPrice: real("stop_price"),
    targetPrice: real("target_price"),
    /** true = followed my rules. */
    followedRules: integer("followed_rules", { mode: "boolean" }),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    index("trades_closed_at_idx").on(t.closedAt),
    index("trades_account_idx").on(t.accountId),
    index("trades_symbol_idx").on(t.symbol),
  ],
);

export const executions = sqliteTable(
  "executions",
  {
    id: id(),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    importId: integer("import_id").references(() => imports.id, {
      onDelete: "cascade",
    }),
    tradeId: integer("trade_id").references(() => trades.id, {
      onDelete: "set null",
    }),
    symbol: text("symbol").notNull(),
    assetClass: text("asset_class", { enum: assetClasses }).notNull(),
    action: text("action", { enum: ["buy", "sell"] }).notNull(),
    quantity: real("quantity").notNull(),
    price: real("price").notNull(),
    fees: real("fees").notNull().default(0),
    multiplier: real("multiplier").notNull().default(1),
    executedAt: integer("executed_at", { mode: "timestamp_ms" }).notNull(),
    /** Stable hash of the raw fill, used to skip duplicates on re-import. */
    fingerprint: text("fingerprint").notNull(),
  },
  (t) => [
    uniqueIndex("executions_fingerprint_idx").on(t.accountId, t.fingerprint),
    index("executions_trade_idx").on(t.tradeId),
  ],
);

export const tagGroups = sqliteTable("tag_groups", {
  id: id(),
  name: text("name").notNull().unique(),
  color: text("color"),
});

export const tags = sqliteTable("tags", {
  id: id(),
  groupId: integer("group_id").references(() => tagGroups.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull().unique(),
});

export const tradeTags = sqliteTable(
  "trade_tags",
  {
    tradeId: integer("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.tradeId, t.tagId] })],
);

/** Per-day journal entry, rating and notes. `day` is YYYY-MM-DD. */
export const journalEntries = sqliteTable("journal_entries", {
  id: id(),
  day: text("day").notNull().unique(),
  content: text("content").notNull().default(""),
  followedRules: integer("followed_rules", { mode: "boolean" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/** A setup or rules document. Linking a tag shows that setup's live stats. */
export const playbooks = sqliteTable("playbooks", {
  id: id(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  tagId: integer("tag_id").references(() => tags.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const screenshots = sqliteTable("screenshots", {
  id: id(),
  tradeId: integer("trade_id").references(() => trades.id, {
    onDelete: "cascade",
  }),
  day: text("day"),
  filePath: text("file_path").notNull(),
  /** Serialized annotation layer (arrows, boxes, text). */
  annotations: text("annotations", { mode: "json" }),
  caption: text("caption"),
  createdAt: createdAt(),
});
