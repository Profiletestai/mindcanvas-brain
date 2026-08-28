// apps/web/test/helpers/supabaseStub.ts
// Minimal stand-in for a Supabase query builder.
//
// Records every chained call so a test can assert on the *predicates* a query
// carries — which is the thing that actually enforces tenant isolation. A test
// that only checks the returned rows would pass even if the org filter were
// dropped, because the stub returns whatever it was told to.

export type RecordedCall = { method: string; args: unknown[] };

export type StubQuery = {
  __calls: RecordedCall[];
  [key: string]: any;
};

export type StubResult = {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
};

/** Chainable, thenable builder resolving to `result`. */
export function makeQuery(result: StubResult = {}): StubQuery {
  const calls: RecordedCall[] = [];

  const resolved = {
    data: result.data ?? null,
    error: result.error ?? null,
    count: result.count ?? null,
  };

  const builder: any = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "__calls") return calls;

        // Awaiting anywhere in the chain resolves to the preset result, so
        // .maybeSingle() / .single() / .range() all work without special cases.
        if (prop === "then") {
          return (onFulfilled: (v: unknown) => unknown, onRejected?: any) =>
            Promise.resolve(resolved).then(onFulfilled, onRejected);
        }

        return (...args: unknown[]) => {
          calls.push({ method: prop, args });
          return builder;
        };
      },
    },
  );

  return builder as StubQuery;
}

export type TableResults = Record<string, StubResult | StubResult[]>;

export type StubClient = {
  from(table: string): StubQuery;
  schema(name: string): StubClient;
  rpc(fn: string, args: unknown): Promise<StubResult>;
  /** Every query issued, keyed by table, in call order. */
  queries: Record<string, StubQuery[]>;
  rpcCalls: Array<{ fn: string; args: unknown }>;
};

/**
 * `results` maps a table name to the result its query resolves to. Pass an
 * array to give successive queries against the same table different results.
 */
export function makeClient(
  results: TableResults = {},
  rpcResults: Record<string, StubResult> = {},
): StubClient {
  const queries: Record<string, StubQuery[]> = {};
  const rpcCalls: Array<{ fn: string; args: unknown }> = [];

  const client: StubClient = {
    from(table: string) {
      const existing = queries[table] ?? [];
      const configured = results[table];

      const result = Array.isArray(configured)
        ? (configured[existing.length] ?? configured.at(-1) ?? {})
        : (configured ?? {});

      const query = makeQuery(result);

      queries[table] = [...existing, query];

      return query;
    },
    schema() {
      return client;
    },
    async rpc(fn: string, args: unknown) {
      rpcCalls.push({ fn, args });
      return rpcResults[fn] ?? { data: null, error: null };
    },
    queries,
    rpcCalls,
  };

  return client;
}

/** Flattens the recorded calls of a query into `method:arg0=arg1` strings. */
export function callSignatures(query: StubQuery): string[] {
  return query.__calls.map(
    (call) =>
      `${call.method}(${call.args.map((arg) => JSON.stringify(arg)).join(",")})`,
  );
}

/** True when the query filtered a column to a value, in any position. */
export function hasFilter(
  query: StubQuery,
  method: string,
  column: string,
  value?: unknown,
): boolean {
  return query.__calls.some(
    (call) =>
      call.method === method &&
      call.args[0] === column &&
      (value === undefined || call.args[1] === value),
  );
}
