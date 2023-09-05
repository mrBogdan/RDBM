const TOKENS = {
  SP: ' ',
  EMPTY: '',
  LF: '\n',
  CR: '\r',
  DELIMITER: ';',
  OPEN_BRACKET: '(',
  CLOSE_BRACKET: ')',
  ASTERISK: '*',
  COMMA: ',',
  
  SINGLE_QUOTE: '\'',
  DOUBLE_QUOTE: '"',
};

const OPERATORS = {
  EQUAL: '=',
  AND: 'AND',
  OR: 'OR',
  LESS: '<',
  MORE: '>',
  NOT_EQUAL: '!=',
};

const SYSTEM_NAMES = {
  DATABASES: 'databases',
};

const ENTITIES = {
  TABLE: 'table',
  DATABASE: 'database',
  USER: 'user',
};

const ERRORS = {
  EEXIST: 'EEXIST',
}

export {
  TOKENS,
  OPERATORS,
  ENTITIES,
  ERRORS,
  SYSTEM_NAMES,
}
