import { parseArgs } from "$std/cli/parse_args.ts";

// This is a Deno task, that means that CWD (Deno.cwd) is the root dir of the project,
// remember this when looking at the relative paths below.

// Make sure there is this `migrations` dir in root of project
const migrationDir = "./migrations";

const isMigrationFile = (filename: string): boolean => {
  const regex = /.*migration.ts$/;
  return regex.test(filename);
};

const files = [];
for await (const f of Deno.readDir(migrationDir)) {
  f.isFile && isMigrationFile(f.name) && files.push(f);
}

const filename = (idx: number, filename: string) => {
  const YYYYmmDD = new Date().toISOString().split("T")[0];
  const paddedIdx = String(idx).padStart(3, "0");
  return `${paddedIdx}-${YYYYmmDD}-${filename}.migration.ts`;
};

const firstCLIarg = parseArgs(Deno.args)?._[0] as string ?? null;

if (!firstCLIarg) {
  console.error("You must pass-in the name of the migration file as an arg");
  Deno.exit(1);
}

// make sure this is file is present in the project
const templateText = await Deno.readTextFile(
  "./tasks/new_migration/migration_template.ts",
);

const migrationFilename = filename(files.length, firstCLIarg);

console.log(`Creating migration:\n\nmigrations/${migrationFilename}\n`);

await Deno.writeTextFile(`./migrations/${migrationFilename}`, templateText);

console.log("Done!");
