import { getTestPostgresDatabaseFactory } from "ava-postgres";

export const getTestDatabase = getTestPostgresDatabaseFactory({
  postgresVersion: "14",
});
