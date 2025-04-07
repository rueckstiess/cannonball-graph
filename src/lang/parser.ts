import { Lexer, Token, TokenType } from './lexer';
import { NodePattern, RelationshipPattern, PathPattern } from './pattern-matcher';


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
 * Represents the DELETE clause in a Cypher query
 */
export interface DeleteClause {
  /** Array of variables (nodes or relationships) to delete */
  variables: VariableExpression[];
  /** Whether to detach nodes before deleting (DETACH DELETE) */
  detach?: boolean;
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
  /** The DELETE clause (optional) */
  delete?: DeleteClause;
  /** The RETURN clause (optional) */
  return?: ReturnClause;
}


/**
 * Parser for Cypher-like query language
 */
export class Parser {
  private lexer: Lexer;
  private currentToken: Token;
  private errors: string[] = [];

  /**
   * Creates a new Parser
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
        let detach = false;
        // Check for DETACH first
        if (this.match(TokenType.DETACH)) {
          detach = true;
        }

        if (this.match(TokenType.MATCH)) {
          if (detach) throw this.error("DETACH cannot be used with MATCH");
          statement.match = this.parseMatchClause();
        } else if (this.match(TokenType.WHERE)) {
          if (detach) throw this.error("DETACH cannot be used with WHERE");
          statement.where = this.parseWhereClause();
        } else if (this.match(TokenType.CREATE)) {
          if (detach) throw this.error("DETACH cannot be used with CREATE");
          statement.create = this.parseCreateClause();
        } else if (this.match(TokenType.SET)) {
          if (detach) throw this.error("DETACH cannot be used with SET");
          statement.set = this.parseSetClause();
        } else if (this.match(TokenType.DELETE)) {
          // Pass the detach flag to the delete clause parser
          statement.delete = this.parseDeleteClause(detach);
        } else if (this.match(TokenType.RETURN)) {
          if (detach) throw this.error("DETACH cannot be used with RETURN");
          statement.return = this.parseReturnClause();
        } else if (detach) {
          // If we matched DETACH but no DELETE followed
          throw this.error("Expected DELETE after DETACH");
        }
        else {
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
        this.check(TokenType.DELETE) || // Add DELETE
        this.check(TokenType.DETACH) || // Add DETACH
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
   * Generic parser for comma-separated lists or items separated by repeating keywords
   * @param parseItem Function to parse a single item
   * @param separatorTypes Token types that can separate items (e.g., COMMA or clause keywords)
   * @returns Array of parsed items
   */
  private parseList<T>(parseItem: () => T, separatorTypes: TokenType[]): T[] {
    const items: T[] = [];

    // Parse the first item
    items.push(parseItem());

    // Parse additional items separated by specified tokens
    while (separatorTypes.some(type => this.match(type))) {
      items.push(parseItem());
    }

    return items;
  }

  /**
   * Parses a MATCH clause
   * @returns The parsed match clause
   */
  private parseMatchClause(): MatchClause {
    const patterns = this.parseList(
      () => this.parsePathPattern(),
      [TokenType.COMMA, TokenType.MATCH]
    );
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

    // Parse segments (relationship + node) until we don't see a relationship indicator
    while (
      this.check(TokenType.MINUS) ||
      this.check(TokenType.FORWARD_ARROW) ||
      this.check(TokenType.BACKWARD_ARROW)
    ) {
      // Each segment consists of a relationship followed by a node
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

    // Use helper method for parsing labels
    this.parseLabels(node);

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
   * Helper method to parse labels for a node
   * @param node The node object to add labels to
   */
  private parseLabels(node: NodePattern): void {
    while (this.match(TokenType.COLON)) {
      const label = this.consume(TokenType.IDENTIFIER, "Expected label after ':'").value;
      node.labels.push(label);
    }

    // Currently we only support matching on a single label
    if (node.labels.length > 1) {
      throw Error(`Only a single label supported, but got ${node.labels}`);
    }
  }

  /**
   * Parses a relationship pattern (e.g., -[variable:TYPE {property: value}]->)
   * @param startingTokenIndex Optional index to start from. Used for testing isolated relationship patterns.
   * @returns The parsed relationship pattern
   */
  private parseRelationshipPattern(startingTokenIndex?: number): RelationshipPattern {
    // Reset lexer if needed
    if (startingTokenIndex !== undefined) {
      this.resetLexerToIndex(startingTokenIndex);
    }

    // Parse the direction and initial part of the relationship
    const { direction: initialDirection } = this.parseRelationshipDirection();

    // Initialize relationship with default values
    const relationship = this.initializeRelationship(initialDirection);

    // Parse relationship details if present
    if (this.match(TokenType.OPEN_BRACKET)) {
      this.parseRelationshipDetails(relationship);
      this.consume(TokenType.CLOSE_BRACKET, "Expected ']' after relationship details");
    }

    // Parse the ending part of the relationship
    const { direction: endingDirection } = this.parseRelationshipDirection();

    // Update direction if it wasn't explicitly set in the first part
    if (relationship.direction === 'both') {
      relationship.direction = endingDirection !== 'both' ? endingDirection : 'both';
    }

    return relationship;
  }

  /**
   * Helper method to reset the lexer to a specific index
   * @param index The index to reset to
   */
  private resetLexerToIndex(index: number): void {
    this.lexer.reset();
    // Advance to the starting position
    for (let i = 0; i < index; i++) {
      this.lexer.next();
    }
    // Update current token
    this.currentToken = this.lexer.next();
  }

  /**
   * Initializes a relationship object with default values
   * @param direction Initial direction
   * @returns A relationship pattern object
   */
  private initializeRelationship(direction: 'outgoing' | 'incoming' | 'both'): RelationshipPattern {
    return {
      properties: {},
      direction,
      minHops: 1,
      maxHops: 1
    };
  }

  /**
   * Parses relationship direction indicators (->, <-, -)
   * @returns The direction and whether a token was consumed
   */
  private parseRelationshipDirection(): { direction: 'outgoing' | 'incoming' | 'both', consumed: boolean } {
    if (this.match(TokenType.BACKWARD_ARROW)) {
      return { direction: 'incoming', consumed: true };
    } else if (this.match(TokenType.FORWARD_ARROW)) {
      return { direction: 'outgoing', consumed: true };
    } else if (this.match(TokenType.MINUS)) {
      return { direction: 'both', consumed: true };
    } else {
      throw this.error("Expected relationship pattern token: '-', '->', or '<-'");
    }
  }

  /**
   * Parses the details inside a relationship bracket [...]
   * @param relationship The relationship object to update
   */
  private parseRelationshipDetails(relationship: RelationshipPattern): void {
    // Check for variable name
    if (this.check(TokenType.IDENTIFIER) && this.peekNext().type === TokenType.COLON) {
      relationship.variable = this.currentToken.value;
      this.advance(); // Consume the variable name
      this.advance(); // Skip the colon
    } else if (this.match(TokenType.COLON)) {
      // No variable name, just a colon
    }

    // Parse relationship type
    this.parseRelationshipType(relationship);

    // Parse variable length path if present
    this.parseRelationshipLength(relationship);

    // Parse properties if present
    this.parseRelationshipProperties(relationship);
  }

  /**
   * Parses the relationship type (e.g., :TYPE)
   * @param relationship The relationship object to update
   */
  private parseRelationshipType(relationship: RelationshipPattern): void {
    // Parse relationship type (allow quoted strings for reserved keywords)
    if (this.check(TokenType.IDENTIFIER) || this.check(TokenType.STRING)) {
      relationship.type = this.currentToken.value;
      this.advance();
    }
  }

  /**
   * Parses a variable length relationship (e.g., *1..3)
   * @param relationship The relationship object to update
   */
  private parseRelationshipLength(relationship: RelationshipPattern): void {
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

  /**
   * Parses relationship properties (e.g., {key: value})
   * @param relationship The relationship object to update
   */
  private parseRelationshipProperties(relationship: RelationshipPattern): void {
    // Parse properties
    if (this.match(TokenType.OPEN_BRACE)) {
      relationship.properties = this.parsePropertyMap();
      this.consume(TokenType.CLOSE_BRACE, "Expected '}' after property map");
    }
  }

  /**
   * Parses a property map (e.g., {name: "John", age: 30})
   * @returns Object with property key-value pairs
   */
  private parsePropertyMap(): Record<string, string | number | boolean | null> {
    const properties: Record<string, string | number | boolean | null> = {};

    // Parse first property
    if (!this.check(TokenType.CLOSE_BRACE)) {
      // Use helper method to parse a single property
      this.addPropertyKeyValue(properties);

      // Parse additional properties
      while (this.match(TokenType.COMMA)) {
        this.addPropertyKeyValue(properties);
      }
    }

    return properties;
  }

  /**
   * Helper method to parse a single property key-value pair and add it to the properties object
   * @param properties The properties object to add to
   */
  private addPropertyKeyValue(properties: Record<string, string | number | boolean | null>): void {
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
   * Parses a primary expression (variable, property access, literal, array)
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

    // Parse additional patterns separated by commas OR additional CREATE tokens
    while (this.match(TokenType.COMMA) || this.match(TokenType.CREATE)) {
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
    const parsePropertySetting = (): PropertySetting => {
      const target = this.parseVariableExpression();
      this.consume(TokenType.DOT, "Expected '.' after variable");
      const property = this.consume(TokenType.IDENTIFIER, "Expected property name").value;
      this.consume(TokenType.EQUALS, "Expected '=' after property name");
      const value = this.parseExpression();

      return { target, property, value };
    };

    const settings = this.parseList(
      parsePropertySetting,
      [TokenType.COMMA, TokenType.SET]
    );

    return { settings };
  }

  /**
   * Parses a DELETE clause
   * @param detach Whether DETACH was specified before DELETE
   * @returns The parsed DELETE clause
   */
  private parseDeleteClause(detach: boolean): DeleteClause {
    const variables = this.parseList(
      () => this.parseVariableExpression(),
      [TokenType.COMMA, TokenType.DELETE]
    );

    return { variables, detach };
  }

  /**
   * Parses a RETURN clause
   * @returns The parsed RETURN clause
   */
  private parseReturnClause(): ReturnClause {
    const items = this.parseList(
      () => this.parseReturnItem(),
      [TokenType.COMMA, TokenType.RETURN]
    );

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
