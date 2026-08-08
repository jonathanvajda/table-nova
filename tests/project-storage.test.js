import {
  DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID,
  createMemoryRecordAdapter,
  createRunRecordStore
} from '../docs/app/shared/indexeddb-data-management/index.js';
import { COMMON_NAMESPACE_IRIS } from '../docs/app/shared/namespace-registry/index.js';
import {
  convertTableNovaRunToJsonLd,
  readTableNovaRunFromJsonLd
} from '../docs/app/storage/indexedDb.js';

test('Table Nova run payloads are stored as registry-backed JSON-LD and round-trip for the UI', async () => {
  const adapter = createMemoryRecordAdapter();
  const runs = createRunRecordStore(adapter);
  const payload = convertTableNovaRunToJsonLd({
    runId: 'run:table-nova:https%3A%2F%2Fexample.org%2Fgraph%2F1',
    graphIri: 'https://example.org/graph/1',
    filename: 'people.csv',
    createdAtIso: '2026-08-02T12:00:00.000Z',
    quads: [
      {
        s: 'https://example.org/row/1',
        p: 'https://example.org/name',
        oType: 'literal',
        oValue: 'Ada',
        g: 'https://example.org/graph/1'
      }
    ],
    columnSchemas: [],
    sampleValuesByPredicate: {}
  });

  await runs.storeRunRecord({
    runId: 'run:table-nova:https%3A%2F%2Fexample.org%2Fgraph%2F1',
    projectId: DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID,
    runKind: 'tabular-to-rdf',
    label: 'people.csv',
    createdAt: '2026-08-02T12:00:00.000Z',
    payload
  });

  const [rawRecord] = [...adapter.snapshot().values()];
  expect(rawRecord.payload['@context']).toBeTruthy();
  expect(rawRecord.payload[COMMON_NAMESPACE_IRIS.okea.graphIri]['@value']).toBe('https://example.org/graph/1');
  expect(rawRecord.payload[COMMON_NAMESPACE_IRIS.rdf.value].quads).toHaveLength(1);

  const [record] = await runs.listRunRecords({
    projectId: DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID,
    runKind: 'tabular-to-rdf'
  });
  const roundTrip = readTableNovaRunFromJsonLd(record.payload);
  expect(roundTrip.graphIri).toBe('https://example.org/graph/1');
  expect(roundTrip.quads).toHaveLength(1);
});
