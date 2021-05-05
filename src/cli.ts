#!/usr/bin/env node

import { writeFile } from 'fs/promises';
import yargs from 'yargs';
import { exportOpenApiDoc } from './openapi-exporter';
import * as path from 'path';

// const cwd = process.cwd();

yargs(process.argv.slice(2))
    .command(
        ['openapi', '*'],
        'Export api doc',
        (yargs) => {
            return yargs;
        },
        async (argv) => {
            if (!argv.input) {
                return console.warn('input file missing');
            }
            // console.log(argv.input, argv.out);
            const apiDoc = exportOpenApiDoc(argv.input as string);
            await writeFile(path.normalize(argv.out as string || 'openapi.json'), JSON.stringify(apiDoc))
        }
    )
    .option('input', {
        alias: 'i',
        type: 'string',
        description: 'The index file for API routes'
    })
    .option('out', {
        alias: 'o',
        type: 'string',
        description: 'File where the API doc is to be written',
        default: 'openapi.json'
    })
    .argv;