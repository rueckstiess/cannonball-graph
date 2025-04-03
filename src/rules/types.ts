/**
 * Represents a graph transformation rule in Cannonball.
 * Rules are defined in Markdown code blocks with graphrule type.
 */
export interface Rule {
  /**
   * Unique identifier for the rule
   */
  name: string;

  /**
   * Human-readable explanation of the rule's purpose
   */
  description: string;

  /**
   * Numeric priority (higher numbers run first)
   */
  priority: number;

  /**
   * Whether the rule is currently disabled
   */
  disabled?: boolean;

  /**
   * The raw rule text containing the Cypher-like query
   */
  ruleText: string;

  /**
   * The original markdown string from which this rule was parsed
   */
  markdown: string;
}

/**
 * Options for rule extraction
 */
export interface RuleExtractionOptions {
  /**
   * The type of code block to look for (default: "graphrule")
   */
  codeBlockType?: string;
}

/**
 * Enum representing all possible token types in the Cypher-like query language
 */
export enum TokenType {
  // Keywords
  MATCH = 'MATCH',
  WHERE = 'WHERE',
  CREATE = 'CREATE',
  SET = 'SET',
  REMOVE = 'REMOVE',
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
