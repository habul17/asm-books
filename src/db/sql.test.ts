import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { customerGroups, customers, products } from "./schema";
import { col } from "./sql";

const dialect = new PgDialect();
const render = (q: Parameters<PgDialect["sqlToQuery"]>[0]) => dialect.sqlToQuery(q).sql;

describe("col", () => {
  it("always includes the table name", () => {
    expect(render(col(products.id))).toBe('"products"."id"');
    expect(render(col(customers.groupId))).toBe('"customers"."group_id"');
  });

  it("keeps a correlated sub-query pointing at the outer table", () => {
    const count = sql`(SELECT count(*) FROM ${customers} WHERE ${col(customers.groupId)} = ${col(customerGroups.id)})`;
    expect(render(count)).toContain('"customers"."group_id" = "customer_groups"."id"');
  });
});
