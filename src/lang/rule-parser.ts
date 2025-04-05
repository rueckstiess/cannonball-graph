import { Lexer, Token, TokenType } from './lexer';
import { NodePattern, RelationshipPattern, PathPattern } from './pattern-matcher';
import { Graph, Node, NodeId, Edge, Path, BFSVisitor } from '@/graph';

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
 * Represents the variables to return from a query
 */
export interface ReturnItem {
  /** The expression to return (can be a variable or property access) */
  expression: VariableExpression | PropertyExpression;
  /** Optional alias for the returned value */
  alias?: string;
}

/**
 * Represents the RETURN clause in a Cypher query
 */
export interface ReturnClause {
  /** Items to return from the query */
  items: ReturnItem[];
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
  /** The RETURN clause (optional) */
  return?: ReturnClause;
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


/**
 * Parses a graph rule from a markdown string.
 *
 * @param markdown - The markdown string containing the rule
 * @param options - Optional extraction options
 * @returns A Rule object
 * @throws Error if the rule is invalid or missing required metadata
 */
export function parseRuleFromMarkdown(
  markdown: string,
  options: RuleExtractionOptions = {},
): Rule {
  const codeBlockType = options.codeBlockType || "graphrule";
  const regex = new RegExp(`\`\`\`${codeBlockType}([\\s\\S]*?)\`\`\``);

  const match = regex.exec(markdown);
  if (!match) {
    throw new Error(
      `No ${codeBlockType} code block found in the provided markdown`,
    );
  }

  const blockContent = match[1].trim();
  const lines = blockContent.split("\n");

  // Extract metadata (lines before the first empty line)
  const metadata: Record<string, string | boolean | number> = {};
  let i = 0;

  while (i < lines.length && lines[i].trim() !== "") {
    const line = lines[i];
    const colonIndex = line.indexOf(":");

    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      // Convert values to appropriate types
      if (key === "priority") {
        metadata[key] = parseInt(value, 10);
        if (isNaN(metadata[key] as number)) {
          throw new Error(
            `Invalid priority value: ${value}. Must be a number.`,
          );
        }
      } else if (key === "disabled") {
        metadata[key] = value.toLowerCase() === "true";
      } else {
        metadata[key] = value;
      }
    }

    i++;
  }

  // Skip empty lines to find the rule text
  while (i < lines.length && lines[i].trim() === "") {
    i++;
  }

  // Extract rule text (all remaining lines)
  const ruleText = lines.slice(i).join("\n").trim();

  // Validate required metadata
  if (!metadata.name) {
    throw new Error("Rule is missing required metadata: name");
  }
  if (!metadata.description) {
    throw new Error("Rule is missing required metadata: description");
  }
  if (metadata.priority === undefined) {
    throw new Error("Rule is missing required metadata: priority");
  }

  // Validate rule text
  if (!ruleText) {
    throw new Error("Rule is missing rule text");
  }

  // Construct and return the Rule object
  return {
    name: metadata.name as string,
    description: metadata.description as string,
    priority: metadata.priority as number,
    disabled: metadata.disabled as boolean | undefined,
    ruleText,
    markdown,
  };
}

/**
 * Extracts all graph rules from a markdown document.
 *
 * @param markdown - The markdown document
 * @param options - Optional extraction options
 * @returns An array of Rule objects
 * @throws Error if any rule is invalid
 */
export function extractRulesFromMarkdown(
  markdown: string,
  options: RuleExtractionOptions = {},
): Rule[] {
  const codeBlockType = options.codeBlockType || "graphrule";
  const regex = new RegExp(`\`\`\`${codeBlockType}([\\s\\S]*?)\`\`\``, "g");

  const rules: Rule[] = [];
  let match;

  while ((match = regex.exec(markdown)) !== null) {
    const fullMatch = match[0];
    try {
      const rule = parseRuleFromMarkdown(fullMatch, options);
      rules.push(rule);
    } catch (error) {
      // Skip invalid rules or log them if needed
      console.error(`Found invalid rule definition: ${fullMatch}: ${error}`);
      throw error;
    }
  }

  return rules;
}

/**
 * Parser for Cypher-like query language used in graph rules
 */
export class CypherParser implements Parser {
  private lexer: Lexer;
  private currentToken: Token;
  private errors: string[] = [];

  /**
   * Creates a new CypherParser
   * @param lexer The lexer to use for tokenization
   * @param input Optional input string to parse (if provided, tokenizes immediately)
   */
  constructor(lexer: Lexer, input?: string) {
    this.lexer = lexer;

    if (input) {
      this.lexer.tokenize(input);
    }

    this.currentToken = this.lexer.next();
    this.previousToken = this.currentToken; // Initialize previousToken
  }

  /**
   * Parses the token stream to produce a Cypher statement
   * @returns The parsed Cypher statement
   */
  parse(): CypherStatement {
    const statement: CypherStatement = {};

    // Collect clauses until we reach the end of input
    while (!this.isAtEnd()) {
      try {
        if (this.match(TokenType.MATCH)) {
          statement.match = this.parseMatchClause();
        } else if (this.match(TokenType.WHERE)) {
          statement.where = this.parseWhereClause();
        } else if (this.match(TokenType.CREATE)) {
          statement.create = this.parseCreateClause();
        } else if (this.match(TokenType.SET)) {
          statement.set = this.parseSetClause();
        } else if (this.match(TokenType.RETURN)) {
          statement.return = this.parseReturnClause();
        } else {
          // Unrecognized token, record error and skip
          this.errors.push(`Unexpected token: ${this.currentToken.value} at line ${this.currentToken.line}, column ${this.currentToken.column}`);
          this.advance();
        }
      } catch (error: any) {
        // Catch any errors thrown during parsing and add to error list
        this.errors.push(error.message);

        // Skip to the next meaningful token (like a clause start) to try to recover
        this.synchronize();
      }
    }

    return statement;
  }

  /**
   * Synchronizes the parser after an error by skipping tokens until a recognizable clause start is found
   * This helps with error recovery
   */
  private synchronize(): void {
    this.advance();

    // Skip tokens until we find a clause keyword or reach the end
    while (!this.isAtEnd()) {
      if (
        this.check(TokenType.MATCH) ||
        this.check(TokenType.WHERE) ||
        this.check(TokenType.CREATE) ||
        this.check(TokenType.SET) ||
        this.check(TokenType.RETURN)
      ) {
        return;
      }

      this.advance();
    }
  }

  /**
   * Returns the list of errors encountered during parsing
   * @returns Array of error messages
   */
  getErrors(): string[] {
    return this.errors;
  }

  /**
   * Parses a MATCH clause
   * @returns The parsed match clause
   */
  private parseMatchClause(): MatchClause {
    const patterns: PathPattern[] = [];

    // Parse the first path pattern
    patterns.push(this.parsePathPattern());

    // Parse additional patterns separated by commas
    while (this.match(TokenType.COMMA)) {
      patterns.push(this.parsePathPattern());
    }

    return { patterns };
  }

  /**
   * Parses a path pattern (e.g., (a)-[:REL]->(b))
   * @returns The parsed path pattern
   */
  private parsePathPattern(): PathPattern {
    // Parse the starting node
    const start = this.parseNodePattern();
    const segments: { relationship: RelationshipPattern; node: NodePattern }[] = [];

    // Parse segments (relationship + node) until we don't see a relationship
    while (
      this.check(TokenType.MINUS) ||
      this.check(TokenType.FORWARD_ARROW) ||
      this.check(TokenType.BACKWARD_ARROW)
    ) {
      const relationship = this.parseRelationshipPattern();
      const node = this.parseNodePattern();
      segments.push({ relationship, node });
    }

    return { start, segments };
  }

  /**
   * Parses a node pattern (e.g., (variable:Label {property: value}))
   * @returns The parsed node pattern
   */
  private parseNodePattern(): NodePattern {
    // Expect an opening parenthesis
    this.consume(TokenType.OPEN_PAREN, "Expected '(' at the start of node pattern");

    const node: NodePattern = {
      labels: [],
      properties: {}
    };

    // Check if there's a variable name
    if (this.check(TokenType.IDENTIFIER)) {
      node.variable = this.currentToken.value;
      this.advance();
    }

    // Parse labels if any (can have multiple)
    while (this.match(TokenType.COLON)) {
      const label = this.consume(TokenType.IDENTIFIER, "Expected label after ':'").value;
      node.labels.push(label);
    }

    // Parse properties if any
    if (this.match(TokenType.OPEN_BRACE)) {
      node.properties = this.parsePropertyMap();
      this.consume(TokenType.CLOSE_BRACE, "Expected '}' after property map");
    }

    // Expect a closing parenthesis
    this.consume(TokenType.CLOSE_PAREN, "Expected ')' at the end of node pattern");

    return node;
  }

  /**
   * Parses a relationship pattern (e.g., -[variable:TYPE {property: value}]->)
   * @param startingTokenIndex Optional index to start from. Used for testing isolated relationship patterns.
   * @returns The parsed relationship pattern
   */
  private parseRelationshipPattern(startingTokenIndex?: number): RelationshipPattern {
    // If given a starting index, reset the lexer to that position
    if (startingTokenIndex !== undefined) {
      // Reset to beginning
      this.lexer.reset();
      // Advance to the starting position
      for (let i = 0; i < startingTokenIndex; i++) {
        this.lexer.next();
      }
      // Update current token
      this.currentToken = this.lexer.next();
    }

    // Check for the start of the relationship and determine direction
    let direction: 'outgoing' | 'incoming' | 'both' = 'both';

    if (this.match(TokenType.BACKWARD_ARROW)) {
      direction = 'incoming';
    } else if (this.match(TokenType.FORWARD_ARROW)) {
      direction = 'outgoing';
    } else {
      this.consume(TokenType.MINUS, "Expected relationship pattern to start with '-', '->', or '<-'");
    }

    // Initialize relationship with default values for fixed-length relationships
    const relationship: RelationshipPattern = {
      properties: {},
      direction,
      minHops: 1,  // Default to 1 for fixed-length relationships
      maxHops: 1   // Default to 1 for fixed-length relationships
    };

    // Check if we have a relationship detail in square brackets
    if (this.match(TokenType.OPEN_BRACKET)) {
      // Check for variable name
      if (this.check(TokenType.IDENTIFIER) && this.peekNext().type === TokenType.COLON) {
        relationship.variable = this.currentToken.value;
        this.advance(); // Consume the variable name
        this.advance(); // Skip the colon
      } else if (this.match(TokenType.COLON)) {
        // No variable name, just a colon
      }

      // Parse relationship type
      if (this.check(TokenType.IDENTIFIER)) {
        relationship.type = this.currentToken.value;
        this.advance();

        // Check for variable length path (e.g., *1..3)
        if (this.match(TokenType.ASTERISK)) {
          relationship.minHops = 1; // Default for variable length paths
          relationship.maxHops = undefined; // Reset to undefined for unbounded paths by default

          // Check for specific range
          if (this.check(TokenType.NUMBER)) {
            relationship.minHops = Number(this.currentToken.value);
            this.advance();

            // Check for max range
            if (this.match(TokenType.DOT) && this.match(TokenType.DOT)) {
              if (this.check(TokenType.NUMBER)) {
                relationship.maxHops = Number(this.currentToken.value);
                this.advance();
              }
            }
          }
        }
      }

      // Parse properties
      if (this.match(TokenType.OPEN_BRACE)) {
        relationship.properties = this.parsePropertyMap();
        this.consume(TokenType.CLOSE_BRACE, "Expected '}' after property map");
      }

      this.consume(TokenType.CLOSE_BRACKET, "Expected ']' after relationship details");
    }

    // Parse the second part of the direction if needed
    if (direction === 'both' && this.match(TokenType.FORWARD_ARROW)) {
      relationship.direction = 'outgoing';
    } else if (direction === 'both' && this.match(TokenType.BACKWARD_ARROW)) {
      relationship.direction = 'incoming';
    } else if (direction === 'both') {
      this.consume(TokenType.MINUS, "Expected relationship pattern to end with '-', '->', or '<-'");
    }

    return relationship;
  }

  /**
   * Parses a property map (e.g., {name: "John", age: 30})
   * @returns Object with property key-value pairs
   */
  private parsePropertyMap(): Record<string, string | number | boolean | null> {
    const properties: Record<string, string | number | boolean | null> = {};

    // Parse first property
    if (!this.check(TokenType.CLOSE_BRACE)) {
      // Get property name
      const key = this.consume(TokenType.IDENTIFIER, "Expected property name").value;

      // Expect colon
      this.consume(TokenType.COLON, "Expected ':' after property name");

      // Parse literal value based on token type
      if (this.check(TokenType.STRING)) {
        properties[key] = this.advance().value;
      } else if (this.check(TokenType.NUMBER)) {
        properties[key] = Number(this.advance().value);
      } else if (this.check(TokenType.BOOLEAN)) {
        properties[key] = this.advance().value === 'true';
      } else if (this.check(TokenType.NULL)) {
        this.advance();
        properties[key] = null;
      } else {
        throw this.error(`Expected a literal value after ':' for property ${key}`);
      }

      // Parse additional properties
      while (this.match(TokenType.COMMA)) {
        // Get property name
        const key = this.consume(TokenType.IDENTIFIER, "Expected property name").value;

        // Expect colon
        this.consume(TokenType.COLON, "Expected ':' after property name");

        // Parse literal value based on token type
        if (this.check(TokenType.STRING)) {
          properties[key] = this.advance().value;
        } else if (this.check(TokenType.NUMBER)) {
          properties[key] = Number(this.advance().value);
        } else if (this.check(TokenType.BOOLEAN)) {
          properties[key] = this.advance().value === 'true';
        } else if (this.check(TokenType.NULL)) {
          this.advance();
          properties[key] = null;
        } else {
          throw this.error(`Expected a literal value after ':' for property ${key}`);
        }
      }
    }

    return properties;
  }

  /**
   * Parses a literal value (string, number, boolean, null)
   * @returns The literal value
   */
  private parseLiteral(): string | number | boolean | null {
    if (this.match(TokenType.STRING)) {
      return this.previous().value;
    }

    if (this.match(TokenType.NUMBER)) {
      return Number(this.previous().value);
    }

    if (this.match(TokenType.BOOLEAN)) {
      return this.previous().value === 'true';
    }

    if (this.match(TokenType.NULL)) {
      return null;
    }

    throw this.error("Expected a literal value (string, number, boolean, or null)");
  }

  /**
   * Parses a WHERE clause
   * @returns The parsed where clause
   */
  private parseWhereClause(): WhereClause {
    const condition = this.parseExpression();
    return { condition };
  }

  /**
   * Parses an expression
   * @returns The parsed expression
   */
  private parseExpression(): Expression {
    return this.parseLogicalExpression();
  }

  /**
   * Parses a logical expression (AND, OR, NOT, XOR)
   * @returns The parsed logical expression
   */
  private parseLogicalExpression(): Expression {
    // Handle NOT operator (prefix)
    if (this.match(TokenType.NOT)) {
      if (this.match(TokenType.EXISTS)) {
        return this.parseExistsExpression(false);
      }

      const operand = this.parseLogicalExpression();
      return {
        type: 'logical',
        operator: LogicalOperator.NOT,
        operands: [operand]
      };
    }

    // Handle EXISTS
    if (this.match(TokenType.EXISTS)) {
      return this.parseExistsExpression(true);
    }

    // Parse the first comparison expression
    let expr = this.parseComparisonExpression();

    // Look for AND, OR, XOR operators
    while (
      this.match(TokenType.AND) ||
      this.match(TokenType.OR) ||
      this.match(TokenType.XOR)
    ) {
      const operator = this.tokenTypeToLogicalOperator(this.previous().type);
      const right = this.parseComparisonExpression();

      // If we already have a logical expression with the same operator, add to it
      if (
        expr.type === 'logical' &&
        (expr as LogicalExpression).operator === operator
      ) {
        (expr as LogicalExpression).operands.push(right);
      } else {
        // Otherwise, create a new logical expression
        expr = {
          type: 'logical',
          operator,
          operands: [expr, right]
        };
      }
    }

    return expr;
  }

  /**
   * Parses a comparison expression
   * @returns The parsed comparison expression
   */
  private parseComparisonExpression(): Expression {
    const left = this.parsePrimaryExpression();

    // Check for comparison operators
    if (
      this.match(TokenType.EQUALS) ||
      this.match(TokenType.NOT_EQUALS) ||
      this.match(TokenType.LESS_THAN) ||
      this.match(TokenType.LESS_THAN_OR_EQUALS) ||
      this.match(TokenType.GREATER_THAN) ||
      this.match(TokenType.GREATER_THAN_OR_EQUALS)
    ) {
      const operator = this.tokenTypeToComparisonOperator(this.previous().type);
      const right = this.parsePrimaryExpression();

      return {
        type: 'comparison',
        left,
        operator,
        right
      };
    }

    // Handle special operators like IS NULL, IS NOT NULL, etc.
    if (this.match(TokenType.IS)) {
      if (this.match(TokenType.NULL)) {
        return {
          type: 'comparison',
          left,
          operator: ComparisonOperator.IS_NULL,
          right: { type: 'literal', value: null, dataType: 'null' }
        };
      }

      if (this.match(TokenType.NOT) && this.match(TokenType.NULL)) {
        return {
          type: 'comparison',
          left,
          operator: ComparisonOperator.IS_NOT_NULL,
          right: { type: 'literal', value: null, dataType: 'null' }
        };
      }

      throw this.error("Expected 'NULL' or 'NOT NULL' after 'IS'");
    }

    // Handle CONTAINS, STARTS WITH, ENDS WITH
    if (this.match(TokenType.CONTAINS)) {
      const right = this.parsePrimaryExpression();
      return {
        type: 'comparison',
        left,
        operator: ComparisonOperator.CONTAINS,
        right
      };
    }

    if (this.match(TokenType.STARTS) && this.match(TokenType.WITH)) {
      const right = this.parsePrimaryExpression();
      return {
        type: 'comparison',
        left,
        operator: ComparisonOperator.STARTS_WITH,
        right
      };
    }

    if (this.match(TokenType.ENDS) && this.match(TokenType.WITH)) {
      const right = this.parsePrimaryExpression();
      return {
        type: 'comparison',
        left,
        operator: ComparisonOperator.ENDS_WITH,
        right
      };
    }

    // Handle IN operator
    if (this.match(TokenType.IN)) {
      const right = this.parsePrimaryExpression();
      return {
        type: 'comparison',
        left,
        operator: ComparisonOperator.IN,
        right
      };
    }

    return left;
  }

  /**
   * Parses a primary expression (variable, property access, literal)
   * @returns The parsed expression
   */
  private parsePrimaryExpression(): Expression {
    // Handle literals
    if (
      this.check(TokenType.STRING) ||
      this.check(TokenType.NUMBER) ||
      this.check(TokenType.BOOLEAN) ||
      this.check(TokenType.NULL)
    ) {
      return this.parseLiteralExpression();
    }

    // Handle variable
    if (this.check(TokenType.IDENTIFIER)) {
      // Save the variable name token before advancing
      const variableName = this.currentToken.value;
      this.advance(); // Consume the identifier

      const variable: VariableExpression = {
        type: 'variable',
        name: variableName
      };

      // Check for property access (dot notation)
      if (this.match(TokenType.DOT)) {
        const property = this.consume(TokenType.IDENTIFIER, "Expected property name after '.'").value;
        return {
          type: 'property',
          object: variable,
          property
        };
      }

      return variable;
    }

    // Handle parenthesized expressions
    if (this.match(TokenType.OPEN_PAREN)) {
      // Check if this is a path pattern for EXISTS expression
      if (this.check(TokenType.IDENTIFIER) || this.check(TokenType.COLON)) {
        this.lexer.reset();
        this.currentToken = this.lexer.next();
        throw this.error("Path patterns should be used with EXISTS or in MATCH clauses");
      }

      // Otherwise it's a grouped expression
      const expr = this.parseExpression();
      this.consume(TokenType.CLOSE_PAREN, "Expected ')' after expression");
      return expr;
    }

    throw this.error("Expected expression");
  }

  /**
   * Parses a literal expression
   * @returns The parsed literal expression
   */
  private parseLiteralExpression(): LiteralExpression {
    // Save the current token before advancing
    const token = this.currentToken;

    if (this.match(TokenType.STRING)) {
      return {
        type: 'literal',
        value: token.value,
        dataType: 'string'
      };
    }

    if (this.match(TokenType.NUMBER)) {
      return {
        type: 'literal',
        value: Number(token.value),
        dataType: 'number'
      };
    }

    if (this.match(TokenType.BOOLEAN)) {
      return {
        type: 'literal',
        value: token.value === 'true',
        dataType: 'boolean'
      };
    }

    if (this.match(TokenType.NULL)) {
      return {
        type: 'literal',
        value: null,
        dataType: 'null'
      };
    }

    throw this.error("Expected literal value");
  }

  /**
   * Parses an EXISTS expression
   * @param positive Whether this is a positive (EXISTS) or negative (NOT EXISTS) check
   * @returns The parsed EXISTS expression
   */
  private parseExistsExpression(positive: boolean): ExistsExpression {
    this.consume(TokenType.OPEN_PAREN, "Expected '(' after EXISTS");
    const pattern = this.parsePathPattern();
    this.consume(TokenType.CLOSE_PAREN, "Expected ')' after pattern");

    return {
      type: 'exists',
      positive,
      pattern
    };
  }

  /**
   * Parses a CREATE clause
   * @returns The parsed CREATE clause
   */
  private parseCreateClause(): CreateClause {
    const patterns: Array<CreateNode | CreateRelationship> = [];

    // Parse the first pattern
    if (this.check(TokenType.OPEN_PAREN)) {
      const firstChar = this.currentToken.value;

      // Check if this is a node or a path (for relationship creation)
      if (firstChar === '(') {
        // Parse first node or path
        const node = this.parseNodePattern();

        // Check if this is a standalone node or the start of a path
        if (
          this.check(TokenType.MINUS) ||
          this.check(TokenType.FORWARD_ARROW) ||
          this.check(TokenType.BACKWARD_ARROW)
        ) {
          // This is a path - parse the relationship and end node
          const relationship = this.parseRelationshipPattern();
          const endNode = this.parseNodePattern();

          // Create a relationship pattern
          patterns.push({
            fromNode: { type: 'variable', name: node.variable! },
            relationship,
            toNode: { type: 'variable', name: endNode.variable! }
          });
        } else {
          // This is a standalone node
          patterns.push({ node });
        }
      }
    }

    // Parse additional patterns separated by commas
    while (this.match(TokenType.COMMA)) {
      if (this.check(TokenType.OPEN_PAREN)) {
        const firstChar = this.currentToken.value;

        if (firstChar === '(') {
          // Parse node or path
          const node = this.parseNodePattern();

          // Check if this is a standalone node or the start of a path
          if (
            this.check(TokenType.MINUS) ||
            this.check(TokenType.FORWARD_ARROW) ||
            this.check(TokenType.BACKWARD_ARROW)
          ) {
            // This is a path
            const relationship = this.parseRelationshipPattern();
            const endNode = this.parseNodePattern();

            patterns.push({
              fromNode: { type: 'variable', name: node.variable! },
              relationship,
              toNode: { type: 'variable', name: endNode.variable! }
            });
          } else {
            // This is a standalone node
            patterns.push({ node });
          }
        }
      }
    }

    return { patterns };
  }

  /**
   * Parses a SET clause
   * @returns The parsed SET clause
   */
  private parseSetClause(): SetClause {
    const settings: PropertySetting[] = [];

    // Parse the first property setting
    const target = this.parseVariableExpression();
    this.consume(TokenType.DOT, "Expected '.' after variable");
    const property = this.consume(TokenType.IDENTIFIER, "Expected property name").value;
    this.consume(TokenType.EQUALS, "Expected '=' after property name");
    const value = this.parseExpression();

    settings.push({ target, property, value });

    // Parse additional settings separated by commas
    while (this.match(TokenType.COMMA)) {
      const target = this.parseVariableExpression();
      this.consume(TokenType.DOT, "Expected '.' after variable");
      const property = this.consume(TokenType.IDENTIFIER, "Expected property name").value;
      this.consume(TokenType.EQUALS, "Expected '=' after property name");
      const value = this.parseExpression();

      settings.push({ target, property, value });
    }

    return { settings };
  }

  /**
   * Parses a RETURN clause
   * @returns The parsed RETURN clause
   */
  private parseReturnClause(): ReturnClause {
    const items: ReturnItem[] = [];

    // Parse the first return item
    items.push(this.parseReturnItem());

    // Parse additional items separated by commas
    while (this.match(TokenType.COMMA)) {
      items.push(this.parseReturnItem());
    }

    return { items };
  }

  /**
   * Parses a single item in a RETURN clause
   * @returns The parsed return item
   */
  private parseReturnItem(): ReturnItem {
    // Parse the expression (variable or property access)
    const variable = this.parseVariableExpression();
    
    // Check if this is a property access
    let expression: VariableExpression | PropertyExpression = variable;
    if (this.match(TokenType.DOT)) {
      const property = this.consume(TokenType.IDENTIFIER, "Expected property name after '.'").value;
      expression = {
        type: 'property',
        object: variable,
        property
      };
    }

    // Check for AS alias (not implemented yet, for future extension)
    let alias: string | undefined = undefined;
    
    // Return the item
    return { expression, alias };
  }

  /**
   * Parses a variable expression
   * @returns The parsed variable expression
   */
  private parseVariableExpression(): VariableExpression {
    const name = this.consume(TokenType.IDENTIFIER, "Expected variable name").value;
    return { type: 'variable', name };
  }

  /**
   * Checks if the current token matches the expected type, and advances if it does
   * @param type The expected token type
   * @returns True if the token matches and was consumed, false otherwise
   */
  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  /**
   * Checks if the current token is of the expected type
   * @param type The expected token type
   * @returns True if the token matches, false otherwise
   */
  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.currentToken.type === type;
  }

  // Store the previously consumed token
  private previousToken: Token | null = null;

  /**
   * Advances to the next token
   * @returns The previous token
   */
  private advance(): Token {
    this.previousToken = this.currentToken;
    if (!this.isAtEnd()) {
      this.currentToken = this.lexer.next();
    }
    return this.previousToken;
  }

  /**
   * Returns the previously consumed token
   * @returns The previous token
   */
  private previous(): Token {
    // Return the stored previous token
    if (!this.previousToken) {
      throw new Error('No previous token available');
    }
    return this.previousToken;
  }

  /**
   * Returns the next token without consuming it
   */
  private peekNext(): Token {
    // Save the current token
    const currentToken = this.currentToken;
    // Save the previous token 
    const savedPreviousToken = this.previousToken;

    // Get the next token (this advances the lexer)
    this.advance();
    // Save the next token
    const nextToken = this.currentToken;

    // We need to restore the lexer state by rewinding one token
    // First we need to make the lexer go back one position
    (this.lexer as any).currentTokenIndex--;

    // Restore our parser's state
    this.currentToken = currentToken;
    this.previousToken = savedPreviousToken;

    return nextToken;
  }

  /**
   * Consumes the current token if it matches the expected type, otherwise throws an error
   * @param type The expected token type
   * @param message The error message if the token doesn't match
   * @returns The consumed token
   */
  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) {
      return this.advance();
    }

    throw this.error(message);
  }

  /**
   * Creates an error with the current token information
   * @param message The error message
   * @returns The error
   */
  private error(message: string): Error {
    const errorMsg = `${message} at line ${this.currentToken.line}, column ${this.currentToken.column}`;
    this.errors.push(errorMsg);
    return new Error(errorMsg);
  }

  /**
   * Checks if we've reached the end of the token stream
   * @returns True if we're at the end, false otherwise
   */
  private isAtEnd(): boolean {
    return this.currentToken.type === TokenType.EOF;
  }

  /**
   * Converts a token type to a comparison operator
   * @param type The token type
   * @returns The corresponding comparison operator
   */
  private tokenTypeToComparisonOperator(type: TokenType): ComparisonOperator {
    switch (type) {
      case TokenType.EQUALS:
        return ComparisonOperator.EQUALS;
      case TokenType.NOT_EQUALS:
        return ComparisonOperator.NOT_EQUALS;
      case TokenType.LESS_THAN:
        return ComparisonOperator.LESS_THAN;
      case TokenType.LESS_THAN_OR_EQUALS:
        return ComparisonOperator.LESS_THAN_OR_EQUALS;
      case TokenType.GREATER_THAN:
        return ComparisonOperator.GREATER_THAN;
      case TokenType.GREATER_THAN_OR_EQUALS:
        return ComparisonOperator.GREATER_THAN_OR_EQUALS;
      default:
        throw new Error(`Token type ${type} is not a comparison operator`);
    }
  }

  /**
   * Converts a token type to a logical operator
   * @param type The token type
   * @returns The corresponding logical operator
   */
  private tokenTypeToLogicalOperator(type: TokenType): LogicalOperator {
    switch (type) {
      case TokenType.AND:
        return LogicalOperator.AND;
      case TokenType.OR:
        return LogicalOperator.OR;
      case TokenType.NOT:
        return LogicalOperator.NOT;
      case TokenType.XOR:
        return LogicalOperator.XOR;
      default:
        throw new Error(`Token type ${type} is not a logical operator`);
    }
  }
}