import { SQLFragment, sql } from '../db';

export interface NameTransforms {
  ts: {
    fromPgToTs: (s: string) => string;
    fromTsToPg: (s: string) => string;
  };
  pg: {
    fromPgToTs: (s: SQLFragment) => SQLFragment;
    fromTsToPg: (s: SQLFragment) => SQLFragment;
  };
}

const noop = (s: any) => s;

export const
  nullTransforms: NameTransforms = {
    ts: {
      fromPgToTs: noop,
      fromTsToPg: noop,
    },
    pg: {
      fromPgToTs: noop,
      fromTsToPg: noop,
    },
  },
  snakeCamelTransforms: NameTransforms = {
    ts: {
      fromPgToTs: s => s.replace(/_[a-z]/g, m => m.charAt(1).toUpperCase()),
      fromTsToPg: s => s.replace(/[A-Z]/g, m => '_' + m.toLowerCase()),
    },
    pg: {
      fromPgToTs: s => sql`(select string_agg(case when i = 1 then s else upper(left(s, 1)) || right(s, -1) end, NULL) from regexp_split_to_table(${s}, '_(?=[a-z])') with ordinality as rstt(s, i))`,
      fromTsToPg: s => sql`(select string_agg(case when i = 1 then right(s, -1) else lower(left(s, 1)) || right(s, -1) end, '_') from regexp_split_to_table('~' || ${s}, '(?=[A-Z])') with ordinality as rstt(s, i))`
    },
  };
