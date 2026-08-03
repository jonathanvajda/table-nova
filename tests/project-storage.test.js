import {
  DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID,
  createMemoryRecordAdapter,
  createRunRecordStore
} from '../docs/app/shared/indexeddb-data-management/index.js';

test('Table Nova run payloads fit the shared project run store contract', async () => {
  const runs = createRunRecordStore(createMemoryRecordAdapter());
  await runs.storeRunRecord({
    runId: 'run:table-nova:https%3A%2F%2Fexample.org%2Fgraph%2F1',
    projectId: DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID,
    runKind: 'tabular-to-rdf',
    label: 'people.csv',
    createdAt: '2026-08-02T12:00:00.000Z',
    payload: {
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
    }
  });

  const [record] = await runs.listRunRecords({
    projectId: DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID,
    runKind: 'tabular-to-rdf'
  });
  expect(record.payload.graphIri).toBe('https://example.org/graph/1');
  expect(record.payload.quads).toHaveLength(1);
});
