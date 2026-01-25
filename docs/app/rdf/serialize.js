/**
 * @file Serialize RDFJS datasets into Turtle/TriG/N-Triples/N-Quads/JSON-LD.
 */

let _n3Mod = null;
let _jsonldMod = null;

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
  const N3 = await getN3();
  const { Writer, DataFactory, Store } = N3;

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

  // JSON-LD via jsonld.fromRDF(N-Quads)
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
  return new Promise(async (resolve, reject) => {
    try {
      const N3 = await getN3();
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
  const jsonld = await getJsonld();
  // jsonld.fromRDF expects N-Quads. For N-Triples, it still works (subset).
  const doc = await jsonld.fromRDF(String(nquadsOrNtriples || ''), { format: 'application/n-quads' });

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

/**
 * Loads N3 via esm.sh (pinned), cached.
 * @returns {Promise<any>}
 */
async function getN3() {
  if (_n3Mod) return _n3Mod;
  _n3Mod = await import('https://esm.sh/n3@2.0.1');
  return _n3Mod;
}

/**
 * Loads jsonld via esm.sh (pinned), cached.
 * @returns {Promise<any>}
 */
async function getJsonld() {
  if (_jsonldMod) return _jsonldMod;
  _jsonldMod = await import('https://esm.sh/jsonld@9.0.0');
  return _jsonldMod;
}
