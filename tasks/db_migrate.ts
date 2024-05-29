import {
  Kysely,
  type Migration,
  type MigrationProvider,
  Migrator,
} from "kysely";
import { PostgresJSDialect } from "kysely-postgres-js";
import postgres from "postgres";
import * as Path from "$std/path/mod.ts";
import { parseArgs } from "$std/cli/parse_args.ts";

const databaseConfig = {
  postgres: postgres({
    database: "my_database_name",
    host: "localhost",
    max: 10,
    port: 5432,
    user: "postgres",
  }),
};

// Migration files must be found in the `migrationDir`.
// and the migration files must follow name convention:
//    number-<filename>.migration.ts
// where `number` identifies the order in which migrations are to be run.
//
// To create a new migration file use:
//   deno task new_migration <name-of-your-migration-file>

const migrationDir = "./migrations";

const allowUnorderedMigrations = false;

// Documentation to understand why the code in this file looks as it does:
// Kysely docs: https://www.kysely.dev/docs/migrations
// Example provider: https://github.com/kysely-org/kysely/blob/6f913552/src/migration/file-migration-provider.ts#L20

interface Database {}

const db = new Kysely<Database>({
  dialect: new PostgresJSDialect(databaseConfig),
});

export interface FileMigrationProviderProps {
  migrationDir: string;
}

class DenoMigrationProvider implements MigrationProvider {
  readonly #props: FileMigrationProviderProps;

  constructor(props: FileMigrationProviderProps) {
    this.#props = props;
  }

  isMigrationFile = (filename: string): boolean => {
    const regex = /.*migration.ts$/;
    return regex.test(filename);
  };

  async getMigrations(): Promise<Record<string, Migration>> {
    const files: Deno.DirEntry[] = [];
    for await (const f of Deno.readDir(this.#props.migrationDir)) {
      f.isFile && this.isMigrationFile(f.name) && files.push(f);
    }

    const migrations: Record<string, Migration> = {};

    for (const f of files) {
      const filePath = Path.join(Deno.cwd(), this.#props.migrationDir, f.name);
      const migration = await import(filePath);
      const migrationKey = f.name.match(/(\d+-.*).migration.ts/)![1];
      migrations[migrationKey] = migration;
    }

    return migrations;
  }
}

const migrator = new Migrator({
  db,
  provider: new DenoMigrationProvider({ migrationDir }),
  allowUnorderedMigrations,
});

const firstCLIarg = parseArgs(Deno.args)?._[0] as string ?? null;

const migrate = () => {
  if (firstCLIarg == "down") {
    return migrator.migrateDown();
  }
  return migrator.migrateToLatest();
};

const { error, results } = await migrate();
results?.forEach((it) => {
  if (it.status === "Success") {
    console.log(`Migration "${it.migrationName}" was executed successfully`);
  } else if (it.status === "Error") {
    console.error(`Failed to execute migration "${it.migrationName}"`);
  }
});

if (error) {
  console.error("Failed to migrate");
  console.error(error);
  Deno.exit(1);
}

await db.destroy();

Deno.exit(0);
