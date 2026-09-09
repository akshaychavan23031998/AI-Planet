import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { Claim } from '../../modules/claims/claim.model.js';
import { Employee } from '../../modules/employees/employee.model.js';
import { Expense } from '../../modules/expenses/expense.model.js';
import { Evidence } from '../../modules/evidence/evidence.model.js';
import { TravelRequest } from '../../modules/travelRequests/travelRequest.model.js';
import {
  canonicalDocuments,
  employees,
} from '../../domain/claims/claimWorkflow.fixtures.js';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function valuesAt(value: unknown, path: string[]): unknown[] {
  if (!path.length) return Array.isArray(value) ? value : [value];
  if (Array.isArray(value))
    return value.flatMap((item) => valuesAt(item, path));
  return record(value) ? valuesAt(value[path[0]!], path.slice(1)) : [undefined];
}
function matches(document: unknown, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$or')
      return (
        Array.isArray(expected) &&
        expected.some((item) => record(item) && matches(document, item))
      );
    if (key === '$and')
      return (
        Array.isArray(expected) &&
        expected.every((item) => record(item) && matches(document, item))
      );
    const actual = valuesAt(document, key.split('.'));
    if (record(expected) && '$in' in expected)
      return (
        Array.isArray(expected.$in) &&
        expected.$in.some((item) =>
          actual.some((value) => String(value) === String(item)),
        )
      );
    if (record(expected) && '$exists' in expected)
      return actual.some((item) => item !== undefined) === expected.$exists;
    return actual.some((item) => String(item) === String(expected));
  });
}
function query<T>(read: () => T | Promise<T>) {
  let order: Record<string, number> = {};
  return {
    lean() {
      return this;
    },
    select() {
      return this;
    },
    sort(value: Record<string, number>) {
      order = value;
      return this;
    },
    async exec(): Promise<T> {
      const result = await read();
      if (Array.isArray(result)) {
        const rows: unknown[] = [...result];
        rows.sort((a, b) => {
          for (const [key, direction] of Object.entries(order)) {
            const av = valuesAt(a, key.split('.'))[0];
            const bv = valuesAt(b, key.split('.'))[0];
            const comparison = String(av ?? '').localeCompare(String(bv ?? ''));
            if (comparison) return comparison * direction;
          }
          return 0;
        });
        return rows as T;
      }
      return result;
    },
  };
}

// Small test-only query model: production services, validation, policy and workflow still execute.
export function apiDatabase(data = canonicalDocuments()) {
  let stored = new Claim(data.claim).toObject();
  const demoEmployees = employees.map((item) => ({
    ...item,
    sourceDataset: 'assignment-pack-v1',
  }));
  let failNextWrite = false;
  let writeGate: Promise<void> | undefined;
  let releaseGate: (() => void) | undefined;
  let waiting = 0;
  let writeCount = 0;
  mock.method(Employee, 'findOne', (filter: Record<string, unknown>) =>
    query(() => demoEmployees.find((item) => matches(item, filter)) ?? null),
  );
  mock.method(Employee, 'findById', (id: { toString(): string }) =>
    query(
      () =>
        demoEmployees.find((item) => String(item._id) === String(id)) ?? null,
    ),
  );
  mock.method(Employee, 'find', (filter: Record<string, unknown>) =>
    query(() => demoEmployees.filter((item) => matches(item, filter))),
  );
  mock.method(Claim, 'findById', (id: { toString(): string }) =>
    query(() =>
      String(stored._id) === String(id) ? new Claim(stored).toObject() : null,
    ),
  );
  mock.method(Claim, 'find', (filter: Record<string, unknown>) =>
    query(() =>
      matches(stored, filter) ? [new Claim(stored).toObject()] : [],
    ),
  );
  mock.method(TravelRequest, 'findById', (id: { toString(): string }) =>
    query(() => (String(data.travel._id) === String(id) ? data.travel : null)),
  );
  mock.method(TravelRequest, 'find', (filter: Record<string, unknown>) =>
    query(() => (matches(data.travel, filter) ? [data.travel] : [])),
  );
  mock.method(Expense, 'find', (filter: Record<string, unknown>) =>
    query(() => data.expenses.filter((item) => matches(item, filter))),
  );
  mock.method(Evidence, 'find', (filter: Record<string, unknown>) =>
    query(() => data.evidence.filter((item) => matches(item, filter))),
  );
  mock.method(Evidence, 'findById', (id: { toString(): string }) =>
    query(
      () =>
        data.evidence.find((item) => String(item._id) === String(id)) ?? null,
    ),
  );
  mock.method(
    Claim,
    'findOneAndUpdate',
    (
      filter: Record<string, unknown>,
      update: Record<string, unknown>,
      options: { new: boolean; runValidators: boolean },
    ) =>
      query(async () => {
        assert.equal(options.new, true);
        assert.equal(options.runValidators, true);
        if (writeGate) {
          waiting++;
          if (waiting === 2) releaseGate!();
          await writeGate;
        }
        writeCount++;
        if (failNextWrite) {
          failNextWrite = false;
          return null;
        }
        if (!matches(stored, filter)) return null;
        const next: Record<string, unknown> = {
          ...stored,
          ...(record(update.$set) ? update.$set : {}),
        };
        if (record(update.$inc))
          for (const [key, amount] of Object.entries(update.$inc))
            next[key] = Number(next[key] ?? 0) + Number(amount);
        if (record(update.$push))
          for (const [key, item] of Object.entries(update.$push))
            next[key] = [...(Array.isArray(next[key]) ? next[key] : []), item];
        if (record(update.$unset))
          for (const key of Object.keys(update.$unset)) delete next[key];
        stored = new Claim(next).toObject();
        return new Claim(stored).toObject();
      }),
  );
  return {
    get claim() {
      return stored;
    },
    data,
    get writeCount() {
      return writeCount;
    },
    conflictNextWrite() {
      failNextWrite = true;
    },
    raceNextWrites() {
      writeGate = new Promise((resolve) => {
        releaseGate = resolve;
      });
    },
  };
}
