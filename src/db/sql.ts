import { getTableName, sql, type Column } from "drizzle-orm";

/**
 * A column written as "table"."column".
 *
 * Drizzle leaves the table name out when a query reads only one table, so
 * inside a hand-written sub-query a bare `${products.id}` can silently refer
 * to a column of the sub-query's own table instead. Use this for every
 * column in a correlated sub-query.
 */
export const col = (column: Column) =>
  sql`${sql.identifier(getTableName(column.table))}.${sql.identifier(column.name)}`;
