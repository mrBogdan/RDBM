import fs from 'node:fs';
import { promisify } from 'node:util';
import assert from 'node:assert';

import { OPERATORS, TOKENS } from './constants.js';

const Types = {
  Int: 4,
  Date: 4,
  Char: (size) => size || 1,
  Null: null,
};

const TYPE_NAMES = {
  Int: 'Int',
  Date: 'Date',
  Char: 'Char',
  Null: 'Null',
};

const KEYWORDS = {
  FROM: 'from',
  WHERE: 'where',
};

const DEFAULT_CLUSTER_SIZE = 32768;

const FileSystem = {
  read: promisify(fs.read),
  open: promisify(fs.open),
  write: promisify(fs.write),
  close: promisify(fs.close),
}

// Int Char(5) Char(5) -> 11
const calculateOffset = (schemaTypes) => {
  return 0;
}

const calculateRawSize = (schema) => {
  const schemaTypes = Object.values(schema.fields);

  let offset = 0;

  for (const type of schemaTypes) {
    offset += getTypeSize(type);
  }

  return offset;
}

const getTypeSize = (rawType) => {
  const type = getType(rawType);

  const typeSizeHandler = Types[type];

  switch (type) {
    case TYPE_NAMES.Char: {
      return typeSizeHandler(getCharSize(rawType));
    }
  }

  return typeSizeHandler;
} 

const getCharSize = (charType) => {
  const result = [];

  let isBracketOpen = false;
  let keepGoing = true;

  for (let i = 0; i < charType.length; ++ i) {
    const char = charType[i];

    if (!keepGoing) {
      break;
    }

    switch (char) {
      case TOKENS.OPEN_BRACKET: {
        isBracketOpen = true;
        continue;
      }
      case TOKENS.CLOSE_BRACKET: {
        isBracketOpen = false;
        keepGoing = false;
        continue;
      }
    }

    if (isBracketOpen) {
      result.push(char);
    }
  }

  return parseInt(result.join(TOKENS.EMPTY));
}

const loadSchema = (tableName) => {
  const schemas = [{
    name: 'User',
    fields: {
      id: 'Int',
      age: 'Int',
    },
    size: 8,
    rowAmount: 1,
  }];

  return schemas.find(({ name }) => name === tableName);
};
const validateFields = (fields, schema) => true;
const loadDataChunk = async (fd, { position = 0, offset = 0, size = 1 }) => {
  const buffer = Buffer.alloc(size);
  return await FileSystem.read(fd, buffer, offset, size, position);
};

const createRaw = (schema) => {
  return Object.keys(schema.fields).reduce((acc, curr) => {
    acc[curr] = null;
    return acc;
  }, {});
};

const getType = (field) => {
  const type = [];
  for (let i = 0; i < field.length; ++ i) {
    const char = field[i];
    
    switch (char) {
      case TOKENS.OPEN_BRACKET: {
        return type.join(TOKENS.EMPTY);
      }
    }

    type.push(char);
  }

  return type.join(TOKENS.EMPTY);
}

const findData = async ({ database, table, incomingFields, schema, whereCondition }) => {
  const offset = calculateOffset(Object.values(schema.fields));

  const loadOptions = {
    offset,
    size: DEFAULT_CLUSTER_SIZE,
  };
  const fd = await FileSystem.open(`./databases/${database}/${table}`, 'a+');
  const { buffer: chunk, bytesRead } = await loadDataChunk(fd, loadOptions);
  const raws = workingWithBuffer(chunk, bytesRead, { schema, incomingFields });

  await FileSystem.close(fd);

  return raws;
};

const toJSTypes = (type, buffer) => {
  switch(type) {
    case TYPE_NAMES.Int: {
      return buffer.readInt32LE(0);
    }
    default: {
      return buffer.toString('utf-8');
    } 
  }
}

const mapMemory = ({ schema, incomingFields, chunk, pageCount }) => {
  const raw = createRaw(schema);
  let offset = pageCount * calculateRawSize(schema);

  for (let field of incomingFields) {
    const fieldType = getType(schema.fields[field]);
    const fieldSize = getTypeSize(fieldType);
    
    let currentFieldValue = Buffer.alloc(fieldSize);

    currentFieldValue = Buffer.copyBytesFrom(chunk, offset, fieldSize);

    raw[field] = toJSTypes(fieldType, currentFieldValue);

    offset += fieldSize;
  }

  return raw;
}

const workingWithBuffer = (chunk, bytesRead, { schema, incomingFields }) => {
  const rawSize = calculateRawSize(schema);
  const pageCount = bytesRead / rawSize;
  const raws = [];

  for (let i = 0; i < pageCount; ++ i) {
    raws.push(mapMemory({ schema, incomingFields, chunk, pageCount: i }));
  }

  return raws;
}

const NOOP = () => {};

const select = ({ fields, table, database, whereCondition }) => {
  const schema = loadSchema(table);
  const isValid = validateFields(fields, schema);

  if (fields === TOKENS.ASTERISK) {
    fields = Object.keys(schema.fields);
  }

  if (!isValid) {
    return Types.Null;
  }

  return findData({ table, database, incomingFields: fields, schema, whereCondition });
};

const commands = {
   select,
  'insert': NOOP,
  'delete': NOOP,
  'create': NOOP,
  'alter': NOOP,
  'drop': NOOP,
}

const parseStatement = (statement) => {
  let words = [];
  let word = [];

  for (let i = 0; i < statement.length; ++ i) {
    const char = statement[i];

    switch(char) {
      case TOKENS.COMMA: {
        continue;
      }
      case TOKENS.DELIMITER:
      case TOKENS.SP: {
        words.push(word.join(TOKENS.EMPTY));
        word = [];
        continue;
      }
    }

    word.push(char);
  }

  return words;
}

const CHAR_CODE_ZERO = '0'.charCodeAt(0);
const CHAR_CODE_NINE = '9'.charCodeAt(0);
const isNumber = (char) => char.charCodeAt(0) >= CHAR_CODE_ZERO && char.charCodeAt(0) <= CHAR_CODE_NINE;

const validateOperator = (rawOperator) => {
  const operator = rawOperator.toUpperCase();
  return Object.values(OPERATORS).includes(operator);
}

const parseWhereCondition = (rawWhereCondition) => {
  const temp = rawWhereCondition.join(TOKENS.EMPTY);

  let operatorStarted = false;
  let stringValue = false;
  let valueStarted = false;
  let fieldStarted = true;
  
  let value = [];
  let field = [];
  let operator = [];

  for (let i = 0; i < temp.length; ++ i) {
    const char = temp[i];

    switch(char) {
      case TOKENS.SP: {
        if (!fieldStarted && !operatorStarted) {
          operatorStarted = true;
          continue;
        }

        if (fieldStarted) {
          fieldStarted = false;
          continue;
        }

        if (operatorStarted) {
          operatorStarted = false;
          continue;
        }

        break;
      }
      case OPERATORS.LESS:
      case OPERATORS.MORE:
      case OPERATORS.EQUAL: {
        operatorStarted = true;
        fieldStarted = false;
        break;
      }
      case TOKENS.SINGLE_QUOTE:
      case TOKENS.DOUBLE_QUOTE: {
        stringValue = true;
        continue;
      }
    }

    if (operatorStarted && isNumber(char)) {
      operatorStarted = false;
      valueStarted = true;
    }

    if (operatorStarted) {
      operator.push(char);
    }

    if (fieldStarted) {
      field.push(char);
    }

    if (valueStarted) {
      value.push(char);
    }

  }

  if (!validateOperator(operator.join(TOKENS.EMPTY))) {
    throw new Error(`Incorrect logical operator ${operator.join(TOKENS.EMPTY)}`);
  }

  return {
    field: field.join(TOKENS.EMPTY),
    value: stringValue ? value.join(TOKENS.EMPTY) : parseInt(value.join(TOKENS.EMPTY)),
    operator: operator.length === 1 ? operator[0] : operator.join(TOKENS.EMPTY),
  }
}

const handleStatement = (words) => {
  const [command] = words;
  const args = words.slice(1);

  switch(command.toLowerCase()) {
    case 'select': {
      const fields = [];
      const whereCondition = [];

      let table = '';
      let isFromMet = false;
      let isWhereMet = false;

      for (const arg of args) {

        switch(arg) {
          case KEYWORDS.FROM: {
            isFromMet = true;
            continue;
          }
          case KEYWORDS.WHERE: {
            isWhereMet = true;
            continue;
          }
        }

        if (!isFromMet) {
          fields.push(arg);
        }

        if (isFromMet && !isWhereMet) {
          table = arg;
        }

        if (isWhereMet && isFromMet) {
          whereCondition.push(arg);
        }
      }

      return {
        fields,
        table,
        whereCondition: whereCondition.length ? parseWhereCondition(whereCondition) : [],
      }
    }
    case 'insert': {
      break;
    }
    default: {
      return `Unknown command: ${command}`;
    }
  }
};

const parse = (code) => {
  const statements = [];
  let statement = [];

  for (let i = 0; i < code.length; ++ i) {
    const char = code[i];

    switch(char) {
      case TOKENS.LF:
      case TOKENS.DELIMITER: {
        statement.push(TOKENS.DELIMITER);
        statements.push(handleStatement(parseStatement(statement.join(TOKENS.EMPTY))));
        statement = [];
        continue;
      }
    }

    statement.push(char);
  }

  return statements;
}

// console.log(parse('select * from User;'));

const insert = async ({fields = '*', table, database}) => {
  const tablePath = `./databases/${database}/${table}`;
  
  const fd = await FileSystem.open(tablePath, 'a+');

  const buffer = new Uint32Array(2);

  buffer[0] = 2;
  buffer[1] = 32;

  await FileSystem.write(fd, buffer)
}

// 

const main = async () => {
  // await insert({ table: 'User', database: 'test' });
  // console.log(await parse('select * from User;'));
  // console.log(await select({fields: '*', table: 'User', database: 'test'}));
}

main();

void async function SimpleSelectTest() {
  const result = await select({fields: '*', table: 'User', database: 'test'});

  assert.deepEqual(result, [
    { id: 2, age: 24 }, { id: 2, age: 24 }, { id: 2, age: 32 }
  ]);
}();


void function SimpleStatementParsing() {
  const result = parse('select * from User;');

  assert.deepEqual(result, [
    {
      fields: ['*'],
      table: 'User',
      whereCondition: [],
    }
  ]);  
}();

void function ParsingExactField() {
  const result = parse('select id from User;');

  assert.deepEqual(result, [
    {
      fields: ['id'],
      table: 'User',
      whereCondition: [],
    }
  ]);  
}();


void function ParsingFewFields() {
  const result = parse('select id, age from User;');

  assert.deepEqual(result, [
    {
      fields: ['id', 'age'],
      table: 'User',
      whereCondition: [],
    }
  ]);  
}();

void function ParsingWhereCondition() {
  const result = parse('select id, age from User where id = 1;');

  assert.deepStrictEqual(result, [
    {
      fields: ['id', 'age'],
      table: 'User',
      whereCondition: {field: 'id', operator: '=', value: 1},
    }
  ]);
}();


export {
  parse,
}

