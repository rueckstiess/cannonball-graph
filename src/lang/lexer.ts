/**
 * Enum representing all possible token types in the Cypher-like query language
 */
export enum TokenType {
  // Keywords
  MATCH = 'MATCH',
  WHERE = 'WHERE',
  CREATE = 'CREATE',
  SET = 'SET',
  UNSET = 'UNSET',
  DELETE = 'DELETE',
  EXISTS = 'EXISTS',
  NOT = 'NOT',
  AND = 'AND',
  OR = 'OR',
  XOR = 'XOR',
  NULL = 'NULL',
  IN = 'IN',
  CONTAINS = 'CONTAINS',
  STARTS = 'STARTS',
  ENDS = 'ENDS',
  WITH = 'WITH',
  IS = 'IS',
  RETURN = 'RETURN',

  // Literals
  IDENTIFIER = 'IDENTIFIER', // Variable names, property names
  STRING = 'STRING',         // Quoted strings
  NUMBER = 'NUMBER',         // Numeric literals
  BOOLEAN = 'BOOLEAN',       // true/false

  // Punctuation
  OPEN_PAREN = 'OPEN_PAREN',   // (
  CLOSE_PAREN = 'CLOSE_PAREN', // )
  OPEN_BRACE = 'OPEN_BRACE',   // {
  CLOSE_BRACE = 'CLOSE_BRACE', // }
  OPEN_BRACKET = 'OPEN_BRACKET', // [
  CLOSE_BRACKET = 'CLOSE_BRACKET', // ]
  COLON = 'COLON',           // :
  COMMA = 'COMMA',           // ,
  DOT = 'DOT',               // .
  SEMICOLON = 'SEMICOLON',   // ;
  ASTERISK = 'ASTERISK',     // *

  // Operators
  EQUALS = 'EQUALS',             // =
  NOT_EQUALS = 'NOT_EQUALS',     // <>
  LESS_THAN = 'LESS_THAN',       // <
  LESS_THAN_OR_EQUALS = 'LESS_THAN_OR_EQUALS', // <=
  GREATER_THAN = 'GREATER_THAN', // >
  GREATER_THAN_OR_EQUALS = 'GREATER_THAN_OR_EQUALS', // >=
  PLUS = 'PLUS',                 // +
  MINUS = 'MINUS',               // -
  FORWARD_ARROW = 'FORWARD_ARROW', // ->
  BACKWARD_ARROW = 'BACKWARD_ARROW', // <-

  // Special
  WHITESPACE = 'WHITESPACE',
  COMMENT = 'COMMENT', // // or /* */ style comments
  EOF = 'EOF',         // End of file
  UNKNOWN = 'UNKNOWN'  // Token that couldn't be recognized
}

/**
 * Represents a token in the Cypher-like query language
 */
export interface Token {
  /**
   * The type of the token
   */
  type: TokenType;

  /**
   * The raw text value of the token
   */
  value: string;

  /**
   * Line number where the token appears (1-based)
   */
  line: number;

  /**
   * Column number where the token starts (1-based)
   */
  column: number;

  /**
   * Position in the input string where the token starts (0-based)
   */
  position: number;
}

/**
 * Interface for the lexer that tokenizes Cypher-like query text
 */
export interface Lexer {
  /**
   * Tokenizes the input string and returns an array of tokens
   * @param input The Cypher-like query text to tokenize
   * @returns Array of tokens
   */
  tokenize(input: string): Token[];

  /**
   * Returns the current token without advancing
   */
  peek(): Token;

  /**
   * Returns the current token and advances to the next token
   */
  next(): Token;

  /**
   * Returns true if there are no more tokens
   */
  isAtEnd(): boolean;

  /**
   * Resets the lexer to the beginning of the input
   */
  reset(): void;
}

/**
 * Configuration options for the lexer
 */
export interface LexerOptions {
  /**
   * Whether to include whitespace tokens in the output
   * @default false
   */
  includeWhitespace?: boolean;

  /**
   * Whether to include comment tokens in the output
   * @default false
   */
  includeComments?: boolean;

  /**
   * Whether to ignore case for keywords (e.g., treat "match" same as "MATCH")
   * @default true
   */
  ignoreCase?: boolean;
}


/**
 * Default options for the CypherLexer
 */
const DEFAULT_LEXER_OPTIONS: Required<LexerOptions> = {
  includeWhitespace: false,
  includeComments: false,
  ignoreCase: true,
};

/**
 * A map of keyword strings to their corresponding TokenType
 */
const KEYWORDS: Record<string, TokenType> = {
  MATCH: TokenType.MATCH,
  WHERE: TokenType.WHERE,
  CREATE: TokenType.CREATE,
  SET: TokenType.SET,
  UNSET: TokenType.UNSET,
  DELETE: TokenType.DELETE,
  EXISTS: TokenType.EXISTS,
  NOT: TokenType.NOT,
  AND: TokenType.AND,
  OR: TokenType.OR,
  XOR: TokenType.XOR,
  NULL: TokenType.NULL,
  IN: TokenType.IN,
  CONTAINS: TokenType.CONTAINS,
  STARTS: TokenType.STARTS,
  ENDS: TokenType.ENDS,
  WITH: TokenType.WITH,
  IS: TokenType.IS,
  RETURN: TokenType.RETURN,
  TRUE: TokenType.BOOLEAN,
  FALSE: TokenType.BOOLEAN,
};

/**
 * Implementation of the Lexer interface for Cypher-like query language
 */
export class Lexer implements Lexer {
  private input: string = '';
  private tokens: Token[] = [];
  private currentPosition: number = 0;
  private currentTokenIndex: number = 0;
  private line: number = 1;
  private column: number = 1;
  private options: Required<LexerOptions>;

  /**
   * Creates a new CypherLexer with the given options
   * @param options Configuration options for the lexer
   */
  constructor(options: LexerOptions = {}) {
    this.options = { ...DEFAULT_LEXER_OPTIONS, ...options };
  }

  /**
   * Tokenizes the input string and returns an array of tokens
   * @param input The Cypher-like query text to tokenize
   * @returns Array of tokens
   */
  tokenize(input: string): Token[] {
    this.input = input;
    this.tokens = [];
    this.currentPosition = 0;
    this.currentTokenIndex = 0;
    this.line = 1;
    this.column = 1;

    while (!this.isAtEndOfInput()) {
      const startPos = this.currentPosition;
      const startLine = this.line;
      const startColumn = this.column;
      const char = this.advance();

      // Token starting position info
      const positionInfo = {
        line: startLine,
        column: startColumn,
        position: startPos,
      };

      // Handle different character types
      if (this.isWhitespace(char)) {
        this.tokenizeWhitespace(positionInfo);
      } else if (char === '/' && (this.peekChar() === '/' || this.peekChar() === '*')) {
        this.tokenizeComment(positionInfo);
      } else if (this.isDigit(char)) {
        this.tokenizeNumber(char, positionInfo);
      } else if (this.isAlpha(char)) {
        this.tokenizeIdentifierOrKeyword(char, positionInfo);
      } else if (char === '"' || char === "'") {
        this.tokenizeString(char, positionInfo);
      } else {
        // Handle operators and punctuation
        this.tokenizeOperatorOrPunctuation(char, positionInfo);
      }
    }

    // Add EOF token
    this.addToken(TokenType.EOF, '', { line: this.line, column: this.column, position: this.currentPosition });

    // Filter out whitespace and comments if not requested
    const filteredTokens = this.tokens.filter(token => {
      return (
        (token.type !== TokenType.WHITESPACE || this.options.includeWhitespace) &&
        (token.type !== TokenType.COMMENT || this.options.includeComments)
      );
    });

    this.tokens = filteredTokens;
    this.currentTokenIndex = 0;
    return this.tokens;
  }

  /**
   * Returns the current token without advancing
   */
  peek(): Token {
    if (this.currentTokenIndex >= this.tokens.length) {
      // Return an EOF token if we're at the end
      return {
        type: TokenType.EOF,
        value: '',
        line: this.line,
        column: this.column,
        position: this.currentPosition,
      };
    }
    return this.tokens[this.currentTokenIndex];
  }

  /**
   * Returns the current token and advances to the next token
   */
  next(): Token {
    const token = this.peek();
    this.currentTokenIndex++;
    return token;
  }

  /**
   * Returns true if there are no more tokens
   */
  isAtEnd(): boolean {
    return this.currentTokenIndex >= this.tokens.length;
  }

  /**
   * Resets the lexer to the beginning of the input
   */
  reset(): void {
    this.currentTokenIndex = 0;
  }

  /**
   * Checks if we've reached the end of the input string
   */
  private isAtEndOfInput(): boolean {
    return this.currentPosition >= this.input.length;
  }

  /**
   * Advances the current position and returns the current character
   */
  private advance(): string {
    const char = this.input.charAt(this.currentPosition);
    this.currentPosition++;

    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }

    return char;
  }

  /**
   * Returns the current character without advancing
   */
  private peekChar(): string {
    if (this.isAtEndOfInput()) return '';
    return this.input.charAt(this.currentPosition);
  }

  /**
   * Returns the character after the current one without advancing
   */
  private peekNext(): string {
    if (this.currentPosition + 1 >= this.input.length) return '';
    return this.input.charAt(this.currentPosition + 1);
  }

  /**
   * Checks if a character is whitespace
   */
  private isWhitespace(char: string): boolean {
    return char === ' ' || char === '\t' || char === '\r' || char === '\n';
  }

  /**
   * Checks if a character is a digit
   */
  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  /**
   * Checks if a character is a letter or underscore
   */
  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') ||
      (char >= 'A' && char <= 'Z') ||
      char === '_';
  }

  /**
   * Checks if a character is alphanumeric or underscore
   */
  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }

  /**
   * Adds a token to the tokens array
   */
  private addToken(type: TokenType, value: string, positionInfo: { line: number; column: number; position: number }): void {
    this.tokens.push({
      type,
      value,
      line: positionInfo.line,
      column: positionInfo.column,
      position: positionInfo.position,
    });
  }

  /**
   * Tokenizes whitespace characters
   */
  private tokenizeWhitespace(positionInfo: { line: number; column: number; position: number }): void {
    let value = '';

    // Back up to include the first whitespace character
    this.currentPosition--;
    this.column--;

    // Consume all consecutive whitespace
    while (!this.isAtEndOfInput() && this.isWhitespace(this.peekChar())) {
      value += this.advance();
    }

    if (this.options.includeWhitespace) {
      this.addToken(TokenType.WHITESPACE, value, positionInfo);
    }
  }

  /**
   * Tokenizes comments (both line comments and  block comments
   */
  private tokenizeComment(positionInfo: { line: number; column: number; position: number }): void {
    let value = '/';
    const nextChar = this.advance();
    value += nextChar;

    if (nextChar === '/') {
      // Line comment
      while (!this.isAtEndOfInput() && this.peekChar() !== '\n') {
        value += this.advance();
      }
    } else if (nextChar === '*') {
      // Block comment
      let terminated = false;
      while (!this.isAtEndOfInput() && !terminated) {
        const char = this.advance();
        value += char;
        if (char === '*' && this.peekChar() === '/') {
          value += this.advance(); // Consume the closing '/'
          terminated = true;
        }
      }
    }

    if (this.options.includeComments) {
      this.addToken(TokenType.COMMENT, value, positionInfo);
    }
  }

  /**
   * Tokenizes numeric literals
   */
  private tokenizeNumber(firstChar: string, positionInfo: { line: number; column: number; position: number }): void {
    let value = firstChar;

    // Consume digits
    while (!this.isAtEndOfInput() && this.isDigit(this.peekChar())) {
      value += this.advance();
    }

    // Look for decimal point followed by digits
    if (this.peekChar() === '.' && this.isDigit(this.peekNext())) {
      value += this.advance(); // Consume the '.'

      while (!this.isAtEndOfInput() && this.isDigit(this.peekChar())) {
        value += this.advance();
      }
    }

    this.addToken(TokenType.NUMBER, value, positionInfo);
  }

  /**
   * Tokenizes identifiers and keywords
   */
  private tokenizeIdentifierOrKeyword(firstChar: string, positionInfo: { line: number; column: number; position: number }): void {
    let value = firstChar;

    // Consume alphanumeric characters
    while (!this.isAtEndOfInput() && this.isAlphaNumeric(this.peekChar())) {
      value += this.advance();
    }

    // Check if it's a keyword
    const upperValue = value.toUpperCase();
    const type = this.options.ignoreCase && KEYWORDS[upperValue]
      ? KEYWORDS[upperValue]
      : (KEYWORDS[value] || TokenType.IDENTIFIER);

    // For boolean literals, normalize the value
    const normalizedValue = type === TokenType.BOOLEAN
      ? (upperValue === 'TRUE' ? 'true' : 'false')
      : value;

    this.addToken(type, normalizedValue, positionInfo);
  }

  /**
   * Tokenizes string literals
   */
  private tokenizeString(quoteChar: string, positionInfo: { line: number; column: number; position: number }): void {
    let value = '';
    let terminated = false;

    while (!this.isAtEndOfInput() && !terminated) {
      const char = this.peekChar();

      if (char === quoteChar) {
        terminated = true;
        this.advance(); // Consume the closing quote
      } else if (char === '\\' && this.peekNext() === quoteChar) {
        // Handle escaped quotes
        this.advance(); // Skip the backslash
        value += this.advance(); // Add the quote
      } else if (char === '\n') {
        // Strings can't contain newlines without escaping
        break;
      } else {
        value += this.advance();
      }
    }

    this.addToken(TokenType.STRING, value, positionInfo);
  }

  /**
   * Tokenizes operators and punctuation
   */
  private tokenizeOperatorOrPunctuation(char: string, positionInfo: { line: number; column: number; position: number }): void {
    switch (char) {
      case '(':
        this.addToken(TokenType.OPEN_PAREN, char, positionInfo);
        break;
      case ')':
        this.addToken(TokenType.CLOSE_PAREN, char, positionInfo);
        break;
      case '{':
        this.addToken(TokenType.OPEN_BRACE, char, positionInfo);
        break;
      case '}':
        this.addToken(TokenType.CLOSE_BRACE, char, positionInfo);
        break;
      case '[':
        this.addToken(TokenType.OPEN_BRACKET, char, positionInfo);
        break;
      case ']':
        this.addToken(TokenType.CLOSE_BRACKET, char, positionInfo);
        break;
      case ':':
        this.addToken(TokenType.COLON, char, positionInfo);
        break;
      case ',':
        this.addToken(TokenType.COMMA, char, positionInfo);
        break;
      case '.':
        this.addToken(TokenType.DOT, char, positionInfo);
        break;
      case ';':
        this.addToken(TokenType.SEMICOLON, char, positionInfo);
        break;
      case '*':
        this.addToken(TokenType.ASTERISK, char, positionInfo);
        break;
      case '+':
        this.addToken(TokenType.PLUS, char, positionInfo);
        break;

      // Two-character operators
      case '-':
        if (this.peekChar() === '>') {
          this.advance(); // Consume '>'
          this.addToken(TokenType.FORWARD_ARROW, '->', positionInfo);
        } else {
          this.addToken(TokenType.MINUS, char, positionInfo);
        }
        break;
      case '<':
        if (this.peekChar() === '-') {
          this.advance(); // Consume '-'
          this.addToken(TokenType.BACKWARD_ARROW, '<-', positionInfo);
        } else if (this.peekChar() === '=') {
          this.advance(); // Consume '='
          this.addToken(TokenType.LESS_THAN_OR_EQUALS, '<=', positionInfo);
        } else if (this.peekChar() === '>') {
          this.advance(); // Consume '>'
          this.addToken(TokenType.NOT_EQUALS, '<>', positionInfo);
        } else {
          this.addToken(TokenType.LESS_THAN, char, positionInfo);
        }
        break;
      case '>':
        if (this.peekChar() === '=') {
          this.advance(); // Consume '='
          this.addToken(TokenType.GREATER_THAN_OR_EQUALS, '>=', positionInfo);
        } else {
          this.addToken(TokenType.GREATER_THAN, char, positionInfo);
        }
        break;
      case '=':
        this.addToken(TokenType.EQUALS, char, positionInfo);
        break;
      default:
        this.addToken(TokenType.UNKNOWN, char, positionInfo);
    }
  }
}