import test from 'node:test';
import assert from 'node:assert';

import { parse } from './index.js';

const { describe, it } = test;

describe('Parser tests', () => {
  it('Should parse "select" statement with asterix', () => {
    const result = parse('select * from User;');

    assert.deepEqual(result, [
      {
        fields: ['*'],
        table: 'User',
        whereCondition: [],
      }
    ]);  
  });
});