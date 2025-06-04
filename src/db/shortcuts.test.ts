import { describe, expect, test } from 'vitest';
import { Default, raw, sql } from './core';
import {
  constraint,
  count,
  deletes,
  doNothing,
  insert,
  select,
  selectOne,
  selectExactlyOne,
  truncate,
  sum,
  avg,
  min,
  max,
  update,
  upsert
} from './shortcuts';

// Mock table names as simple strings for testing
const usersTable = 'users' as any;

describe('shortcuts.ts query builders', () => {
  describe('insert', () => {
    test('generates simple insert query', () => {
      const query = insert(usersTable, { name: 'John', age: 30 });
      const compiled = query.compile();

      expect(compiled).toMatchInlineSnapshot(`
        {
          "text": "INSERT INTO "users" ("age", "name") VALUES ($1, $2) RETURNING to_jsonb("users".*) AS result",
          "values": [
            30,
            "John",
          ],
        }
      `);
    });

    test('handles array of values', () => {
      const query = insert(usersTable, [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 }
      ]);
      const compiled = query.compile();

      expect(compiled).toMatchInlineSnapshot(`
        {
          "text": "INSERT INTO "users" ("age", "name") VALUES ($1, $2), ($3, $4) RETURNING to_jsonb("users".*) AS result",
          "values": [
            30,
            "John",
            25,
            "Jane",
          ],
        }
      `);
    });

    test('handles empty array', () => {
      const query = insert(usersTable, []);
      const compiled = query.compile();

      expect(compiled).toMatchInlineSnapshot(`
        {
          "text": "/* marked no-op: won't hit DB unless forced -> */ INSERT INTO "users" SELECT null WHERE false",
          "values": [],
        }
      `);
      expect(query.noop).toBe(true);
    });

    test('supports returning specific columns', () => {
      const query = insert(usersTable, { name: 'John' }, {
        returning: ['id', 'name'] as any
      });
      const compiled = query.compile();

      expect(compiled).toMatchInlineSnapshot(`
        {
          "text": "INSERT INTO "users" ("name") VALUES ($1) RETURNING jsonb_build_object($2::text, "id", $3::text, "name") AS result",
          "values": [
            "John",
            "id",
            "name",
          ],
        }
      `);
    });
  });

  describe('update', () => {
    test('generates update query with where clause', () => {
      const query = update(
        usersTable,
        { name: 'Jane' },
        { id: 1 }
      );
      const compiled = query.compile();

      expect(compiled).toMatchInlineSnapshot(`
        {
          "text": "UPDATE "users" SET ("name") = ROW($1) WHERE ("id" = $2) RETURNING to_jsonb("users".*) AS result",
          "values": [
            "Jane",
            1,
          ],
        }
      `);
    });

    test('works with SQL fragment where clause', () => {
      const query = update(
        usersTable,
        { active: true },
        sql`age > ${raw(`18`)}`
      );
      const compiled = query.compile();

      expect(compiled).toMatchInlineSnapshot(`
        {
          "text": "UPDATE "users" SET ("active") = ROW($1) WHERE age > 18 RETURNING to_jsonb("users".*) AS result",
          "values": [
            true,
          ],
        }
      `);
    });
  });

  describe('deletes', () => {
    test('generates delete query', () => {
      const query = deletes(usersTable, { id: 1 });
      const compiled = query.compile();

      expect(compiled).toMatchInlineSnapshot(`
        {
          "text": "DELETE FROM "users" WHERE ("id" = $1) RETURNING to_jsonb("users".*) AS result",
          "values": [
            1,
          ],
        }
      `);
    });

    test('works with complex where conditions', () => {
      const query = deletes(usersTable, sql`age < ${raw(`18`)} OR active = ${raw(`false`)}`);
      const compiled = query.compile();

      expect(compiled).toMatchInlineSnapshot(`
        {
          "text": "DELETE FROM "users" WHERE age < 18 OR active = false RETURNING to_jsonb("users".*) AS result",
          "values": [],
        }
      `);
    });
  });

  describe('select', () => {
    test('generates basic select query', () => {
      const query = select(usersTable, { active: true });
      const compiled = query.compile();

      expect(compiled).toMatchInlineSnapshot(`
        {
          "text": "SELECT coalesce(jsonb_agg(result), '[]') AS result FROM (SELECT to_jsonb("users".*) AS result FROM "users" WHERE ("active" = $1)) AS "sq_users"",
          "values": [
            true,
          ],
        }
      `);
    });

    test('supports ordering', () => {
      const query = select(usersTable, { active: true }, {
        order: { by: sql`created_at`, direction: 'DESC' }
      });
      const compiled = query.compile();

      expect(compiled).toMatchInlineSnapshot(`
        {
          "text": "SELECT coalesce(jsonb_agg(result), '[]') AS result FROM (SELECT to_jsonb("users".*) AS result FROM "users" WHERE ("active" = $1) ORDER BY created_at DESC) AS "sq_users"",
          "values": [
            true,
          ],
        }
      `);
    });

    test('supports limit and offset', () => {
      const query = select(usersTable, { active: true }, {
        limit: 10,
        offset: 20
      });
      const compiled = query.compile();

      expect(compiled).toMatchInlineSnapshot(`
        {
          "text": "SELECT coalesce(jsonb_agg(result), '[]') AS result FROM (SELECT to_jsonb("users".*) AS result FROM "users" WHERE ("active" = $1) LIMIT $2 OFFSET $3) AS "sq_users"",
          "values": [
            true,
            10,
            20,
          ],
        }
      `);
    });

    test('supports distinct', () => {
      const query = select(usersTable, { active: true }, {
        distinct: true
      });
      const compiled = query.compile();

      expect(compiled).toMatchInlineSnapshot(`
        {
          "text": "SELECT coalesce(jsonb_agg(result), '[]') AS result FROM (SELECT DISTINCT to_jsonb("users".*) AS result FROM "users" WHERE ("active" = $1)) AS "sq_users"",
          "values": [
            true,
          ],
        }
      `);
    });
  });

  describe('selectOne', () => {
    test('automatically adds LIMIT 1', () => {
      const query = selectOne(usersTable, { id: 1 });
      const compiled = query.compile();

      expect(compiled).toMatchInlineSnapshot(`
        {
          "text": "SELECT to_jsonb("users".*) AS result FROM "users" WHERE ("id" = $1) LIMIT $2",
          "values": [
            1,
            1,
          ],
        }
      `);
    });
  });

  describe('count', () => {
    test('generates count query', () => {
      const query = count(usersTable, { active: true });
      const compiled = query.compile();

      expect(compiled).toMatchInlineSnapshot(`
        {
          "text": "SELECT count("users".*) AS result FROM "users" WHERE ("active" = $1)",
          "values": [
            true,
          ],
        }
      `);
    });

    test('can count specific columns', () => {
      const query = count(usersTable, { active: true }, {
        columns: ['id'] as any
      });
      const compiled = query.compile();

      expect(compiled).toMatchInlineSnapshot(`
        {
          "text": "SELECT count("id") AS result FROM "users" WHERE ("active" = $1)",
          "values": [
            true,
          ],
        }
      `);
    });
  });

  describe('upsert', () => {
    test('generates upsert query with conflict target', () => {
      const query = upsert(
        usersTable,
        { email: 'john@example.com', name: 'John' },
        'email' as any
      );
      const compiled = query.compile();

      expect(compiled).toMatchInlineSnapshot(`
        {
          "text": "INSERT INTO "users" ("email", "name") VALUES ($1, $2) ON CONFLICT ("email") DO UPDATE SET ("email", "name") = ROW(EXCLUDED."email", EXCLUDED."name") RETURNING to_jsonb("users".*) || jsonb_build_object('$action', CASE xmax WHEN 0 THEN 'INSERT' ELSE 'UPDATE' END) AS result",
          "values": [
            "john@example.com",
            "John",
          ],
        }
      `);
    });

    test('works with constraint', () => {
      const query = upsert(
        usersTable,
        { email: 'john@example.com', name: 'John' },
        constraint('users_email_key' as any)
      );
      const compiled = query.compile();

      expect(compiled).toMatchInlineSnapshot(`
        {
          "text": "INSERT INTO "users" ("email", "name") VALUES ($1, $2) ON CONFLICT ON CONSTRAINT "users_email_key" DO UPDATE SET ("email", "name") = ROW(EXCLUDED."email", EXCLUDED."name") RETURNING to_jsonb("users".*) || jsonb_build_object('$action', CASE xmax WHEN 0 THEN 'INSERT' ELSE 'UPDATE' END) AS result",
          "values": [
            "john@example.com",
            "John",
          ],
        }
      `);
    });

    test('supports doNothing for updates', () => {
      const query = upsert(
        usersTable,
        { email: 'john@example.com', name: 'John' },
        'email' as any,
        { updateColumns: doNothing }
      );
      const compiled = query.compile();

      expect(compiled).toMatchInlineSnapshot(`
        {
          "text": "INSERT INTO "users" ("email", "name") VALUES ($1, $2) ON CONFLICT ("email") DO NOTHING RETURNING to_jsonb("users".*) || jsonb_build_object('$action', CASE xmax WHEN 0 THEN 'INSERT' ELSE 'UPDATE' END) AS result",
          "values": [
            "john@example.com",
            "John",
          ],
        }
      `);
    });

    test('supports custom update values', () => {
      const query = upsert(
        usersTable,
        { email: 'john@example.com', name: 'John', count: 1 },
        'email' as any,
        { updateValues: { count: sql`users.count + 1` } }
      );
      const compiled = query.compile();

      expect(compiled).toMatchInlineSnapshot(`
        {
          "text": "INSERT INTO "users" ("count", "email", "name") VALUES ($1, $2, $3) ON CONFLICT ("email") DO UPDATE SET ("email", "name", "count") = ROW(EXCLUDED."email", EXCLUDED."name", users.count + 1) RETURNING to_jsonb("users".*) || jsonb_build_object('$action', CASE xmax WHEN 0 THEN 'INSERT' ELSE 'UPDATE' END) AS result",
          "values": [
            1,
            "john@example.com",
            "John",
          ],
        }
      `);
    });
  });

  describe('runResultTransform', () => {
    test('insert single value transform', () => {
      const query = insert(usersTable, { name: 'John' });
      const mockResult = {
        rows: [{ result: { id: 1, name: 'John' } }],
        command: 'INSERT',
        rowCount: 1,
        oid: 0,
        fields: []
      } as any;

      const transformed = query.runResultTransform(mockResult);
      expect(transformed).toEqual({ id: 1, name: 'John' });
    });

    test('insert array transform', () => {
      const query = insert(usersTable, [{ name: 'John' }, { name: 'Jane' }]);
      const mockResult = {
        rows: [
          { result: { id: 1, name: 'John' } },
          { result: { id: 2, name: 'Jane' } }
        ],
        command: 'INSERT',
        rowCount: 2,
        oid: 0,
        fields: []
      } as any;

      const transformed = query.runResultTransform(mockResult);
      expect(transformed).toEqual([
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ]);
    });

    test('count transform returns number', () => {
      const query = count(usersTable, {});
      const mockResult = {
        rows: [{ result: '42' }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      } as any;

      const transformed = query.runResultTransform(mockResult);
      expect(transformed).toBe(42);
      expect(typeof transformed).toBe('number');
    });
  });

  describe('edge cases', () => {
    test('handles Default values in insert', () => {
      const query = insert(usersTable, {
        name: 'John',
        created_at: Default
      });
      const compiled = query.compile();

      expect(compiled).toMatchInlineSnapshot(`
        {
          "text": "INSERT INTO "users" ("created_at", "name") VALUES (DEFAULT, $1) RETURNING to_jsonb("users".*) AS result",
          "values": [
            "John",
          ],
        }
      `);
    });

    test('empty update columns in upsert creates DO NOTHING', () => {
      const query = upsert(
        usersTable,
        { email: 'test@example.com' },
        'email' as any,
        { updateColumns: [] }
      );
      const compiled = query.compile();

      expect(compiled).toMatchInlineSnapshot(`
        {
          "text": "INSERT INTO "users" ("email") VALUES ($1) ON CONFLICT ("email") DO NOTHING RETURNING to_jsonb("users".*) || jsonb_build_object('$action', CASE xmax WHEN 0 THEN 'INSERT' ELSE 'UPDATE' END) AS result",
          "values": [
            "test@example.com",
          ],
        }
      `);
    });
  });

  describe('additional shortcuts edge cases', () => {
    test('insert supports extras and mixed Default in array', () => {
      const query = insert(usersTable, [
        { id: 1, name: 'Alice', created_at: Default },
        { id: 2, name: 'Bob', created_at: raw('now()') }
      ]);
      const compiled = query.compile();
      expect(compiled).toMatchInlineSnapshot(`
        {
          "text": "INSERT INTO "users" ("created_at", "id", "name") VALUES (DEFAULT, $1, $2), ($3, $4, $5) RETURNING to_jsonb("users".*) AS result",
          "values": [
            1,
            "Alice",
            DangerousRawString {
              "value": "now()",
            },
            2,
            "Bob",
          ],
        }
      `);
    });
    test('update supports returning specific columns and extras', () => {
      const query = update(usersTable, { active: false }, { id: 3 }, {
        returning: ['id'] as any,
        extras: { name: sql`upper(name)` }
      });
      const compiled = query.compile();
      expect(compiled).toMatchInlineSnapshot(`
        {
          "text": "UPDATE "users" SET ("active") = ROW($1) WHERE ("id" = $2) RETURNING jsonb_build_object($3::text, "id") || jsonb_build_object($4::text, upper(name)) AS result",
          "values": [
            false,
            3,
            "id",
            "name",
          ],
        }
      `);
    });
    test('deletes supports returning specific columns and fragment where', () => {
      const query = deletes(usersTable, sql`id > ${raw('10')}`, {
        returning: ['id', 'active'] as any
      });
      const compiled = query.compile();
      expect(compiled).toMatchInlineSnapshot(`
        {
          "text": "DELETE FROM "users" WHERE id > 10 RETURNING jsonb_build_object($1::text, "id", $2::text, "active") AS result",
          "values": [
            "id",
            "active",
          ],
        }
      `);
    });
    test('upsert empty array produces noop insert', () => {
      const query = upsert(usersTable, [], 'email' as any);
      const compiled = query.compile();
      expect(query.noop).toBe(true);
      expect(compiled).toMatchInlineSnapshot(`
        {
          "text": "/* marked no-op: won't hit DB unless forced -> */ INSERT INTO "users" SELECT null WHERE false",
          "values": [],
        }
      `);
    });
    test('upsert supports reportAction suppress', () => {
      const query = upsert(usersTable, { email: 'x', name: 'X' }, 'email' as any, { reportAction: 'suppress' });
      const compiled = query.compile();
      expect(compiled.text).not.toContain('$action');
    });
    test('upsert supports noNullUpdateColumns for specific columns', () => {
      const query = upsert(usersTable, { a: 1, b: null }, 'a' as any, { noNullUpdateColumns: ['b'] as any });
      const text = query.compile().text;
      expect(text).toContain('CASE WHEN EXCLUDED."b" IS NULL THEN "users"."b" ELSE EXCLUDED."b" END');
    });
    test('upsert deduplicates updateColumns and updateValues', () => {
      const query = upsert(usersTable, { a: 1, b: 2 }, 'a' as any, {
        updateColumns: ['a'] as any,
        updateValues: { b: sql`users.b + 10` }
      });
      const compiled = query.compile();
      expect(compiled.text).toContain('("a", "b")');
      expect(compiled.text).toContain('ROW(EXCLUDED."a", users.b + 10)');
    });
    describe('truncate', () => {
      test('truncates single table without options', () => {
        const query = truncate(usersTable);
        const compiled = query.compile();
        expect(compiled.text).toBe('TRUNCATE "users"');
      });
      test('truncates multiple tables with restart identity and cascade', () => {
        const query = truncate([usersTable, 'orders' as any], 'RESTART IDENTITY', 'CASCADE');
        const compiled = query.compile();
        expect(compiled.text).toBe('TRUNCATE "users", "orders" RESTART IDENTITY CASCADE');
      });
    });
    describe('select advanced', () => {
      test('distinct on specific columns', () => {
        const query = select(usersTable, {}, { distinct: ['id', 'name'] as any });
        const text = query.compile().text;
        expect(text).toContain('SELECT DISTINCT ON ("id", "name")');
      });
      test('order by array with nulls', () => {
        const query = select(usersTable, {}, {
          order: [
            { by: sql`created_at`, direction: 'ASC', nulls: 'LAST' },
            { by: sql`id`, direction: 'DESC' }
          ]
        });
        const text = query.compile().text;
        expect(text).toContain('ORDER BY created_at ASC NULLS LAST, id DESC');
      });
      test('groupBy and having', () => {
        const query = select(usersTable, {}, {
          groupBy: ['active'] as any,
          having: sql`count("active") > ${raw('1')}`
        });
        const text = query.compile().text;
        expect(text).toContain('GROUP BY "active"');
        expect(text).toContain('HAVING count("active") > 1');
      });
      test('limit with ties', () => {
        const query = select(usersTable, {}, { limit: 5, withTies: true });
        const text = query.compile().text;
        expect(text).toContain('FETCH FIRST $1 ROWS WITH TIES');
      });
      test('lock options multiple', () => {
        const query = select(usersTable, {}, {
          lock: [
            { for: 'UPDATE' },
            { for: 'KEY SHARE', wait: 'SKIP LOCKED' }
          ]
        });
        const text = query.compile().text;
        expect(text).toContain('FOR UPDATE');
        expect(text).toContain('FOR KEY SHARE SKIP LOCKED');
      });
    });
    test('selectOne without results returns undefined', () => {
      const q = selectOne(usersTable, { id: 999 });
      const transformed = q.runResultTransform({ rows: [], command: '', rowCount: 0, oid: 0, fields: [] } as any);
      expect(transformed).toBeUndefined();
    });
    test('selectExactlyOne throws when zero rows', () => {
      const q = selectExactlyOne(usersTable, {} as any);
      expect(() => q.runResultTransform({ rows: [], command: '', rowCount: 0, oid: 0, fields: [] } as any)).toThrow();
    });
    test('selectExactlyOne does not throw when more than one row returned', () => {
      const q = selectExactlyOne(usersTable, {} as any);
      expect(() => q.runResultTransform({ rows: [{ result: 1 }, { result: 2 }], command: '', rowCount: 2, oid: 0, fields: [] } as any)).not.toThrow();
    });
    test('selectExactlyOne in lateral throws when zero rows returned', () => {
      const q = select(usersTable, {}, {
        lateral: { nested: selectExactlyOne(usersTable, { id: 999 }) }
      });
      const mockResult = {
        rows: [
          { result: [{ id: 1, name: 'John', nested: null }] }
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      } as any;
      expect(() => q.runResultTransform(mockResult)).toThrow();
    });
    test('selectExactlyOne in lateral returns value without error when present', () => {
      const q = select(usersTable, {}, {
        lateral: { nested: selectExactlyOne(usersTable, { id: 1 }) }
      });
      const mockResult = {
        rows: [
          { result: [{ id: 1, name: 'John', nested: { id: 1 } }] }
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      } as any;

      expect(() => q.runResultTransform(mockResult)).not.toThrow();
      const transformed = q.runResultTransform(mockResult);
      expect(transformed[0].nested).toEqual({ id: 1 });
    });
    test('selectExactlyOne passthrough lateral throws on null', () => {
      const q = select(usersTable, {}, {
        lateral: selectExactlyOne(usersTable, { id: 999 })
      });
      const mockResult = {
        rows: [
          { result: [null] }
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      } as any;

      expect(() => q.runResultTransform(mockResult)).toThrow();
    });
    test('selectExactlyOne passthrough lateral returns values when present', () => {
      const q = select(usersTable, {}, {
        lateral: selectExactlyOne(usersTable, { id: 1 })
      });
      const mockResult = {
        rows: [
          { result: [{ id: 1 }] }
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      } as any;

      expect(() => q.runResultTransform(mockResult)).not.toThrow();
      const transformed = q.runResultTransform(mockResult);
      expect(transformed[0]).toEqual({ id: 1 });
    });
    test('selectExactlyOne in lateral throws when any row has null nested result', () => {
      const q = select(usersTable, {}, {
        lateral: { nested: selectExactlyOne(usersTable, { id: 999 }) }
      });
      const mockResult = {
        rows: [
          {
            result: [
              { id: 1, nested: { id: 10 } },
              { id: 2, nested: null }
            ]
          }
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: []
      } as any;

      expect(() => q.runResultTransform(mockResult)).toThrow();
    });
    describe('numeric aggregates', () => {
      test('sum compiles and transforms to number', () => {
        const q = sum(usersTable, {} as any);
        const c = q.compile();
        expect(c.text).toContain('sum("users".*)');
        const transformed = q.runResultTransform({ rows: [{ result: '10' }], command: '', rowCount: 1, oid: 0, fields: [] } as any);
        expect(typeof transformed).toBe('number');
        expect(transformed).toBe(10);
      });
      test('avg compiles', () => {
        const q = avg(usersTable, {} as any);
        expect(q.compile().text).toContain('avg("users".*)');
      });
      test('min compiles', () => {
        const q = min(usersTable, {} as any);
        expect(q.compile().text).toContain('min("users".*)');
      });
      test('max compiles', () => {
        const q = max(usersTable, {} as any);
        expect(q.compile().text).toContain('max("users".*)');
      });
    });
  });
});