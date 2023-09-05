import fs from 'node:fs';
import { promisify } from 'node:util';

import { TOKENS } from './constants.js';

const ACode = 'A'.charCodeAt(0);
const ZCode = 'Z'.charCodeAt(0);
const aCode = 'a'.charCodeAt(0);
const zCode = 'z'.charCodeAt(0);

const isAlphabet = (char) => {
  if (char.charCodeAt(0) >= ACode && char.charCodeAt(0) <= ZCode) {
    return true;
  }

  if (char.charCodeAt(0) >= aCode && char.charCodeAt(0) <= zCode) {
    return true;
  }

  return false;
}

const DEFAULT_READING_SIZE = 32768;

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

const Types = {
  Int: 4,
  Date: 4,
  Char: (size) => size || 1,
  Null: null,
};

const getTypeSize = (rawType) => {
  const type = getType(rawType);

  const typeSizeHandler = Types[type];

  switch (type) {
    case 'Char': {
      return typeSizeHandler(getCharSize(rawType));
    }
  }

  return typeSizeHandler;
} 

const getCharSize = (charType) => {
  const result = [];

  let isBracketOpen = false;

  for (let i = 0; i < charType.length; ++ i) {
    const char = charType[i];

    switch (char) {
      case TOKENS.OPEN_BRACKET: {
        isBracketOpen = true;
        continue;
      }
      case TOKENS.CLOSE_BRACKET: {
        isBracketOpen = false;
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
  await FileSystem.read(fd, buffer, offset, size, position);

  return buffer;
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

const findData = async ({ table, incomingFields, schema, whereCondition }) => {
  const offset = calculateOffset(Object.values(schema.fields));
  const loadOptions = {
    offset,
    size: DEFAULT_READING_SIZE,
  };
  const fd = await FileSystem.open(`./databases/test/${table}`, 'a+');
  const chunk = await loadDataChunk(fd, loadOptions);
  const raws = workingWithBuffer(chunk, { schema, incomingFields });

  await FileSystem.close(fd);

  return raws;
};

const workingWithBuffer = (chunk, { schema, incomingFields }) => {
  let index = 0;
  let byte = null;
  
  let fieldIndex = 0;
  let fieldName = incomingFields[fieldIndex];
  let fieldType = schema.fields[fieldName];
  let fieldSize = getTypeSize(fieldType);
  let currentFieldValue = Buffer.alloc(fieldSize);
  let raw = createRaw(schema);
  let typeSizeIndex = 0;
  let rowAmount = 0;
  const raws = []; 

  const getNextField = () => {
    fieldIndex += 1;

    if (fieldIndex === incomingFields.length) {
      fieldIndex = -1;
      return true;
    }

    fieldName = incomingFields[fieldIndex];
    fieldType = schema.fields[fieldName];
    fieldSize = getTypeSize(fieldType);

    return false;
  }

  while(rowAmount < schema.rowAmount) {
    byte = chunk[index];
    currentFieldValue[typeSizeIndex] = byte;

    if (typeSizeIndex === fieldSize - 1) {
      if (fieldType === 'Int') {
        raw[fieldName] = currentFieldValue.readInt32LE(0);
      } else {
        raw[fieldName] = currentFieldValue.toString();
      }

      const isRawEnd = getNextField();

      if (isRawEnd) {
        rowAmount += 1;
        raws.push(raw);
        raw = createRaw(schema);
        getNextField();
      }
      
      typeSizeIndex = 0;
      currentFieldValue = Buffer.alloc(fieldSize);
      index += 1;
      continue;
    }

    
    index += 1;
    typeSizeIndex += 1;
  }

  return raws;
}

const NOOP = () => {};

const select = (fields, table, whereCondition) => {
  const schema = loadSchema(table);
  const isValid = validateFields(fields, schema);

  if (fields === TOKENS.ASTERISK) {
    fields = Object.keys(schema.fields);
  }

  if (!isValid) {
    return Types.Null;
  }

  return findData({ table, incomingFields: fields, schema, whereCondition });
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

const parse = (code) => {
  const statements = [];
  let statement = [];

  for (let i = 0; i < code.length; ++ i) {
    const char = code[i];

    switch(char) {
      case TOKENS.LF:
      case TOKENS.DELIMITER: {
        statement.push(TOKENS.DELIMITER);
        statements.push(parseStatement(statement.join(TOKENS.EMPTY)));
        statement = [];
        continue;
      }
    }

    statement.push(char);
  }

  return statements;
}

// console.log(parse('select * from User;'));

const insert = async (fields, tableName) => {
  const tablePath = './databases/test/User';
  
  const fd = await FileSystem.open(tablePath, 'a+');

  const buffer = new Uint32Array(2);

  buffer[0] = 2;
  buffer[1] = 24;

  await FileSystem.write(fd, buffer)
}

// insert();

const main = async () => {
  console.log(await select('*', 'User'));
}

main();

/**
 * 
 * select
 *   
 *  * from user
 * 
 */

