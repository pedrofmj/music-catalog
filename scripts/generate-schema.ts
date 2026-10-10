import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { catalogSchema } from '../packages/core/src/catalog.ts';

const path = new URL('../docs/feature/0.0.0.0-base/catalog.schema.json', import.meta.url);
const schema = {
  ...z.toJSONSchema(catalogSchema),
  $id: 'urn:music-catalog:schema:v1',
  title: 'Music Catalog v1',
};
const output = JSON.stringify(schema, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if ((await readFile(path, 'utf8')) !== output)
    throw new Error('Catalog schema is out of date. Run npm run generate:schema.');
} else {
  await writeFile(path, output);
}
