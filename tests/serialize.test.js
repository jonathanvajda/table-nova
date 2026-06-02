const XSD = 'http://www.w3.org/2001/XMLSchema#';

beforeAll(() => {
  globalThis.N3 = {
    DataFactory: {
      namedNode: (value) => ({ termType: 'NamedNode', value }),
      literal: (value, datatype) => ({
        termType: 'Literal',
        value,
        language: '',
        datatype: datatype || { termType: 'NamedNode', value: `${XSD}string` }
      }),
      defaultGraph: () => ({ termType: 'DefaultGraph', value: '' }),
      quad: (subject, predicate, object, graph) => ({
        termType: 'Quad',
        subject,
        predicate,
        object,
        graph: graph || { termType: 'DefaultGraph', value: '' }
      })
    },
    Store: class Store {
      constructor() {
        this.quads = [];
      }

      addQuad(...args) {
        const q = args.length === 1
          ? args[0]
          : globalThis.N3.DataFactory.quad(args[0], args[1], args[2], args[3]);
        this.quads.push(q);
      }

      getQuads() {
        return this.quads;
      }
    },
    Writer: class Writer {
      constructor(options) {
        this.options = options || {};
        this.quads = [];
      }

      addQuads(quads) {
        this.quads.push(...quads);
      }

      end(callback) {
        callback(null, fakeWrite(this.quads, this.options));
      }
    }
  };

  globalThis.jsonld = {
    fromRDF: async () => []
  };
});

test('datasetToSerializations keeps Turtle terse while preserving non-string datatype markers', async () => {
  const { datasetToSerializations } = await import('../docs/app/rdf/serialize.js');
  const { DataFactory, Store } = globalThis.N3;
  const s = DataFactory.namedNode('https://example.org/TableNova/instance/row1');
  const p1 = DataFactory.namedNode('https://example.org/TableNova/hasName');
  const p2 = DataFactory.namedNode('https://example.org/TableNova/hasCount');
  const store = new Store();
  store.addQuad(s, p1, DataFactory.literal('Router', DataFactory.namedNode(`${XSD}string`)));
  store.addQuad(s, p2, DataFactory.literal('2', DataFactory.namedNode(`${XSD}integer`)));

  const ser = await datasetToSerializations({
    dataset: store,
    graphIri: 'https://example.org/TableNova/run/test',
    prefixes: {
      tablenova: 'https://example.org/TableNova/',
      tablenovaid: 'https://example.org/TableNova/instance/',
      xsd: XSD
    }
  });

  expect(ser.turtle).toContain('tablenovaid:row1 tablenova:hasName "Router";');
  expect(ser.turtle).toContain('  tablenova:hasCount "2"^^xsd:integer .');
  expect(ser.turtle).not.toContain('"Router"^^xsd:string');
});

function fakeWrite(quads, options) {
  const prefixes = options.prefixes || {};
  const prefixText = Object.entries(prefixes)
    .map(([name, iri]) => `@prefix ${name}: <${iri}> .`)
    .join('\n');

  const bySubject = {};
  for (const q of quads) {
    const subj = formatTerm(q.subject, prefixes);
    bySubject[subj] = bySubject[subj] || [];
    bySubject[subj].push(`${formatTerm(q.predicate, prefixes)} ${formatTerm(q.object, prefixes)}`);
  }

  const body = Object.entries(bySubject).map(([subject, predicates]) => {
    if (predicates.length === 1) return `${subject} ${predicates[0]} .`;
    return `${subject} ${predicates[0]};\n  ${predicates.slice(1).join(';\n  ')} .`;
  }).join('\n\n');

  return `${prefixText}\n\n${body}\n`;
}

function formatTerm(term, prefixes) {
  if (term.termType === 'NamedNode') return compact(term.value, prefixes);
  if (term.termType === 'Literal') {
    const datatype = term.datatype?.value;
    if (!datatype || datatype === `${XSD}string`) return `"${term.value}"`;
    return `"${term.value}"^^${compact(datatype, prefixes)}`;
  }
  return '';
}

function compact(iri, prefixes) {
  const entries = Object.entries(prefixes || {}).sort((a, b) => String(b[1]).length - String(a[1]).length);
  for (const [name, base] of entries) {
    if (iri.startsWith(base)) return `${name}:${iri.slice(base.length)}`;
  }
  return `<${iri}>`;
}
