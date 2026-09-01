import fs from 'node:fs';
import path from 'node:path';

const [inputPath, outputPath = 'data/monogenic-catalog.json', releaseDate = 'unknown'] = process.argv.slice(2);

if (!inputPath) {
  throw new Error('Usage: node scripts/build-monogenic-catalog.mjs <gencc.csv> [output.json] [release-date]');
}

function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const classificationRank = new Map([
  ['Definitive', 0],
  ['Strong', 1],
  ['Moderate', 2],
  ['Limited', 3],
]);

const raw = Buffer.concat(inputPath.split(',').map((file) => fs.readFileSync(file))).toString('utf8');
const rows = parseCsv(raw);
const headers = rows.shift();
const column = new Map(headers.map((name, index) => [name, index]));
const get = (row, name) => row[column.get(name)] || '';
const relationships = new Map();
const sourceClassifications = {};

for (const row of rows) {
  const gene = get(row, 'gene_symbol').trim();
  const geneId = get(row, 'gene_curie').trim();
  const disease = get(row, 'disease_title').trim();
  const diseaseId = get(row, 'disease_curie').trim();
  const inheritance = get(row, 'moi_title').trim() || 'Unknown';
  const classification = get(row, 'classification_title').trim();
  if (!gene || !disease || !classificationRank.has(classification)) continue;

  sourceClassifications[classification] = (sourceClassifications[classification] || 0) + 1;
  const key = `${diseaseId || disease}|${gene}|${inheritance}`;
  const existing = relationships.get(key);
  const candidate = [diseaseId, disease, geneId, gene, inheritance, classification];
  if (!existing || classificationRank.get(classification) < classificationRank.get(existing[5])) {
    relationships.set(key, candidate);
  }
}

const records = Array.from(relationships.values()).sort((a, b) => {
  const diseaseOrder = a[1].localeCompare(b[1], 'en');
  return diseaseOrder || a[3].localeCompare(b[3], 'en');
});
const diseases = new Set(records.map((record) => record[0] || record[1]));
const genes = new Set(records.map((record) => record[3]));

const output = {
  metadata: {
    source: 'Gene Curation Coalition (GenCC)',
    sourceUrl: 'https://thegencc.org/download',
    releaseDate,
    generatedAt: new Date().toISOString(),
    license: 'CC0 1.0',
    includedClassifications: Array.from(classificationRank.keys()),
    sourceRows: rows.length,
    relationshipCount: records.length,
    diseaseCount: diseases.size,
    geneCount: genes.size,
    classificationCounts: sourceClassifications,
    limitation: 'OMIM assertions are not included in GenCC downloads because of OMIM licensing restrictions. Records require professional review before clinical use.',
  },
  fields: ['diseaseId', 'disease', 'geneId', 'gene', 'inheritance', 'classification'],
  records,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output));
process.stdout.write(`${JSON.stringify(output.metadata, null, 2)}\n`);
