-- Default price lists: 10% to 40% markup on the current purchase price.
WITH folder AS (
	INSERT INTO "price_list_folders" ("name") VALUES ('Standard markups') RETURNING "id"
)
INSERT INTO "price_lists" ("name", "folder_id", "base", "adjust_type", "adjust_pct", "sort")
SELECT pct || '% markup', folder."id", 'purchase', 'markup', pct, ord - 1
FROM folder, unnest(ARRAY[10, 15, 20, 25, 30, 35, 40]) WITH ORDINALITY AS t(pct, ord);
