#!/usr/bin/env node
/** CLI:`node scripts/base-sync/run.mjs <inspect|upgrade|contribute> …`,用法見 base-sync.mjs。 */
import { runBaseSync } from "./base-sync.mjs";

const result = await runBaseSync(process.argv.slice(2));
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.exitCode;
