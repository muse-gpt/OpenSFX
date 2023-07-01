#!/usr/bin/env node
import { buildSfxCli } from './cli.js';

const exitCode = await buildSfxCli().parse(process.argv.slice(2));
process.exit(exitCode);
