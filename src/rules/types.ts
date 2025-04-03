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
  IS = 'IS',
  
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
 * Represents a node pattern in a Cypher query
 * e.g., (variable:Label {property: value})
 */
export interface NodePattern {
  /** Variable name to reference the node (optional) */
  variable?: string;
  /** Node labels (optional) */
  labels: string[];
  /** Property constraints (optional) */
  properties: Record<string, string | number | boolean | null>;
}

/**
 * Represents a relationship pattern in a Cypher query
 * e.g., -[variable:TYPE {property: value}]->
 */
export interface RelationshipPattern {
  /** Variable name to reference the relationship (optional) */
  variable?: string;
  /** Relationship type (optional) */
  type?: string;
  /** Property constraints (optional) */
  properties: Record<string, string | number | boolean | null>;
  /** Direction of the relationship: 'outgoing' (->), 'incoming' (<-), or 'both' (-) */
  direction: 'outgoing' | 'incoming' | 'both';
  /** Min path length for variable-length relationships (optional) */
  minHops?: number;
  /** Max path length for variable-length relationships (optional) */
  maxHops?: number;
}

/**
 * Represents a path pattern in a Cypher query
 * e.g., (a)-[:CONTAINS]->(b)
 */
export interface PathPattern {
  /** Starting node pattern */
  start: NodePattern;
  /** Array of relationships and nodes that form the path */
  segments: Array<{
    relationship: RelationshipPattern;
    node: NodePattern;
  }>;
}

/**
 * Types of comparison operators in WHERE conditions
 */
export enum ComparisonOperator {
  EQUALS = '=',
  NOT_EQUALS = '<>',
  LESS_THAN = '<',
  LESS_THAN_OR_EQUALS = '<=',
  GREATER_THAN = '>',
  GREATER_THAN_OR_EQUALS = '>=',
  IN = 'IN',
  CONTAINS = 'CONTAINS',
  STARTS_WITH = 'STARTS WITH',
  ENDS_WITH = 'ENDS WITH',
  IS_NULL = 'IS NULL',
  IS_NOT_NULL = 'IS NOT NULL'
}

/**
 * Types of logical operators in WHERE conditions
 */
export enum LogicalOperator {
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',
  XOR = 'XOR'
}

/**
 * Base type for all expressions in the AST
 */
export type Expression = 
  | LiteralExpression
  | VariableExpression
  | PropertyExpression
  | ComparisonExpression
  | LogicalExpression
  | ExistsExpression;

/**
 * Represents a literal value (string, number, boolean, null)
 */
export interface LiteralExpression {
  type: 'literal';
  /** The literal value */
  value: string | number | boolean | null;
  /** The data type of the value */
  dataType: 'string' | 'number' | 'boolean' | 'null';
}

/**
 * Represents a variable reference (node or relationship)
 */
export interface VariableExpression {
  type: 'variable';
  /** The variable name */
  name: string;
}

/**
 * Represents a property access (e.g., node.property)
 */
export interface PropertyExpression {
  type: 'property';
  /** The object that contains the property */
  object: VariableExpression;
  /** The property name */
  property: string;
}

/**
 * Represents a comparison expression (e.g., a.prop = 'value')
 */
export interface ComparisonExpression {
  type: 'comparison';
  /** Left side of the comparison */
  left: Expression;
  /** Comparison operator */
  operator: ComparisonOperator;
  /** Right side of the comparison */
  right: Expression;
}

/**
 * Represents a logical expression (AND, OR, NOT, XOR)
 */
export interface LogicalExpression {
  type: 'logical';
  /** Logical operator */
  operator: LogicalOperator;
  /** Operands (expressions) */
  operands: Expression[];
}

/**
 * Represents an EXISTS check 
 * e.g., EXISTS((a)-[:DEPENDS_ON]->(b))
 */
export interface ExistsExpression {
  type: 'exists';
  /** Whether this is a positive or negative check (EXISTS vs NOT EXISTS) */
  positive: boolean;
  /** The pattern to check for existence */
  pattern: PathPattern;
}

/**
 * Represents the MATCH clause in a Cypher query
 */
export interface MatchClause {
  /** Array of path patterns to match */
  patterns: PathPattern[];
}

/**
 * Represents the WHERE clause in a Cypher query
 */
export interface WhereClause {
  /** The condition expression */
  condition: Expression;
}

/**
 * Represents a property setting in a SET clause
 * e.g., n.property = value
 */
export interface PropertySetting {
  /** The target object (variable) */
  target: VariableExpression;
  /** The property to set */
  property: string;
  /** The value expression */
  value: Expression;
}

/**
 * Represents the SET clause in a Cypher query
 */
export interface SetClause {
  /** Array of property settings */
  settings: PropertySetting[];
}

/**
 * Represents a node to be created in a CREATE clause
 */
export interface CreateNode {
  /** The node pattern to create */
  node: NodePattern;
}

/**
 * Represents a relationship to be created in a CREATE clause
 */
export interface CreateRelationship {
  /** The starting node (must be a variable that was matched earlier) */
  fromNode: VariableExpression;
  /** The relationship pattern to create */
  relationship: RelationshipPattern;
  /** The ending node (must be a variable that was matched earlier) */
  toNode: VariableExpression;
}

/**
 * Represents the CREATE clause in a Cypher query
 */
export interface CreateClause {
  /** Array of nodes and relationships to create */
  patterns: Array<CreateNode | CreateRelationship>;
}

/**
 * Represents a complete Cypher query statement
 */
export interface CypherStatement {
  /** The MATCH clause (optional) */
  match?: MatchClause;
  /** The WHERE clause (optional) */
  where?: WhereClause;
  /** The CREATE clause (optional) */
  create?: CreateClause;
  /** The SET clause (optional) */
  set?: SetClause;
}

/**
 * Interface for the Parser that parses Cypher queries
 */
export interface Parser {
  /**
   * Parses the token stream to produce a Cypher statement
   * @returns The parsed Cypher statement
   */
  parse(): CypherStatement;
  
  /**
   * Returns the list of errors encountered during parsing
   * @returns Array of error messages
   */
  getErrors(): string[];
}
