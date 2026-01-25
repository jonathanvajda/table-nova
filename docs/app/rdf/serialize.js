/**
 * @file Serialize RDFJS datasets into Turtle/TriG/N-Triples/N-Quads/JSON-LD.
 */

/**
 * Resolve required globals once at module load.
 * Throws early with a clear message if script order / globals are wrong.
 */
const N3 = /** @type {any} */ (globalThis).N3;
if (!N3) {
  throw new Error(
    'Global N3 not found. Ensure ./app/imports/n3.min.js is loaded BEFORE your module scripts (e.g., main.js). Expected globalThis.N3.'
  );
}

const JSONLD = /** @type {any} */ (globalThis).jsonld;
if (!JSONLD) {
  throw new Error(
    'Global jsonld not found. Ensure ./app/imports/jsonld.min.js is loaded BEFORE your module scripts (e.g., main.js). Expected globalThis.jsonld.'
  );
}

if (typeof JSONLD.fromRDF !== 'function') {
  throw new Error(
    'Global jsonld.fromRDF is not a function. Your jsonld.min.js build may not expose fromRDF(). Use a jsonld build that attaches globalThis.jsonld with fromRDF().'
  );
}

/**
 * Serializes a dataset into multiple syntaxes.
 * @param {{
 *   dataset: any,
 *   graphIri: string,
 *   prefixes: Record<string, string>
 * }} params
 * @returns {Promise<{
 *   turtle: string,
 *   trig: string,
 *   ntriples: string,
 *   nquads: string,
 *   jsonldTriples: string,
 *   jsonldGraph: string
 * }>}
 */
export async function datasetToSerializations({ dataset, graphIri, prefixes }) {
  const { DataFactory, Store } = N3;

  // Split into "triples view" (default graph) vs "graph view" (named graph).
  const quads = dataset.getQuads(null, null, null, null);

  const triplesStore = new Store();
  for (const q of quads) {
    triplesStore.addQuad(DataFactory.quad(q.subject, q.predicate, q.object));
  }

  const turtle = await writeWithN3(triplesStore, { format: 'Turtle', prefixes });
  const ntriples = await writeWithN3(triplesStore, { format: 'N-Triples' });

  const trig = await writeWithN3(dataset, { format: 'application/trig', prefixes });
  const nquads = await writeWithN3(dataset, { format: 'N-Quads' });

  const jsonldTriples = await rdfToJsonLd(ntriples, false);
  const jsonldGraph = await rdfToJsonLd(nquads, true, graphIri);

  return { turtle, trig, ntriples, nquads, jsonldTriples, jsonldGraph };
}

/**
 * Writes a dataset/store via N3.Writer.
 * @param {any} store
 * @param {{format: string, prefixes?: Record<string, string>}} options
 * @returns {Promise<string>}
 */
export function writeWithN3(store, options) {
  return new Promise((resolve, reject) => {
    try {
      const writer = new N3.Writer({ format: options.format, prefixes: options.prefixes });
      writer.addQuads(store.getQuads(null, null, null, null));
      writer.end((err, result) => (err ? reject(err) : resolve(String(result || ''))));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Converts N-Triples or N-Quads string to JSON-LD using jsonld.js.
 * @param {string} nquadsOrNtriples
 * @param {boolean} isDataset
 * @param {string} [graphIri]
 * @returns {Promise<string>}
 */
export async function rdfToJsonLd(nquadsOrNtriples, isDataset, graphIri) {
  // jsonld.fromRDF expects N-Quads. For N-Triples, it still works (subset).
  const doc = await JSONLD.fromRDF(String(nquadsOrNtriples || ''), { format: 'application/n-quads' });

  if (!isDataset) {
    return JSON.stringify(doc, null, 2);
  }

  // For dataset view, wrap in a named graph container with @graph.
  const named = {
    '@context': {},
    '@id': graphIri || 'urn:TableNova:graph',
    '@graph': doc
  };
  return JSON.stringify(named, null, 2);
}
