import { Node, Parent } from 'unist';

import { inspect } from 'unist-util-inspect';

import {
  CypherStatement, ComparisonExpression, ExistsExpression, LiteralExpression,
  LogicalExpression, PropertyExpression, VariableExpression, Expression, MatchClause,
  WhereClause, CreateClause, SetClause
} from './rule-parser';

import { NodePattern, RelationshipPattern, PathPattern } from './pattern-matcher';


/**
 * Interface for rule AST nodes
 */
export interface ASTRuleNode extends Node {
  type: string;
}

/**
 * Root node of the Rule AST
 */
export interface ASTRuleRoot extends Parent {
  type: 'rule';
  name: string;
  description: string;
  priority: number;
  disabled?: boolean;
  children: Array<ASTMatchNode | ASTWhereNode | ASTCreateNode | ASTSetNode>;
}

/**
 * Match clause node in the Rule AST
 */
export interface ASTMatchNode extends Parent {
  type: 'match';
  children: ASTPathPatternNode[];
}

/**
 * Where clause node in the Rule AST
 */
export interface ASTWhereNode extends Parent {
  type: 'where';
  children: [ASTExpressionNode];
}

/**
 * Create clause node in the Rule AST
 */
export interface ASTCreateNode extends Parent {
  type: 'create';
  children: Array<ASTCreateNodePatternNode | ASTCreateRelPatternNode>;
}

/**
 * Set clause node in the Rule AST
 */
export interface ASTSetNode extends Parent {
  type: 'set';
  children: ASTPropertySettingNode[];
}

/**
 * Path pattern node in the Rule AST
 */
export interface ASTPathPatternNode extends Parent {
  type: 'pathPattern';
  children: [ASTNodePatternNode, ...ASTRelationshipSegmentNode[]];
}

/**
 * Node pattern node in the Rule AST
 */
export interface ASTNodePatternNode extends ASTRuleNode {
  type: 'nodePattern';
  variable?: string;
  labels: string[];
  properties: Record<string, any>;
}

/**
 * Relationship segment (relationship + node) node in the Rule AST
 */
export interface ASTRelationshipSegmentNode extends Parent {
  type: 'relationshipSegment';
  children: [ASTRelationshipPatternNode, ASTNodePatternNode];
}

/**
 * Relationship pattern node in the Rule AST
 */
export interface ASTRelationshipPatternNode extends ASTRuleNode {
  type: 'relationshipPattern';
  variable?: string;
  relType?: string;
  direction: 'outgoing' | 'incoming' | 'both';
  properties: Record<string, any>;
  minHops?: number;
  maxHops?: number;
}

/**
 * Create node pattern node in the Rule AST
 */
export interface ASTCreateNodePatternNode extends ASTRuleNode {
  type: 'createNode';
  variable?: string;
  labels: string[];
  properties: Record<string, any>;
}

/**
 * Create relationship pattern node in the Rule AST
 */
export interface ASTCreateRelPatternNode extends ASTRuleNode {
  type: 'createRelationship';
  fromVar: string;
  toVar: string;
  relationship: {
    variable?: string;
    relType?: string;
    direction: 'outgoing' | 'incoming' | 'both';
    properties: Record<string, any>;
  };
}

/**
 * Property setting node in the Rule AST
 */
export interface ASTPropertySettingNode extends ASTRuleNode {
  type: 'propertySetting';
  target: string;
  property: string;
  value: ASTExpressionNode;
}

/**
 * Base interface for expression nodes in the Rule AST
 */
export type ASTExpressionNode =
  | ASTLiteralExpressionNode
  | ASTVariableExpressionNode
  | ASTPropertyExpressionNode
  | ASTComparisonExpressionNode
  | ASTLogicalExpressionNode
  | ASTExistsExpressionNode;

/**
 * Literal expression node in the Rule AST
 */
export interface ASTLiteralExpressionNode extends ASTRuleNode {
  type: 'literalExpression';
  value: string | number | boolean | null;
  dataType: 'string' | 'number' | 'boolean' | 'null';
}

/**
 * Variable expression node in the Rule AST
 */
export interface ASTVariableExpressionNode extends ASTRuleNode {
  type: 'variableExpression';
  name: string;
}

/**
 * Property expression node in the Rule AST
 */
export interface ASTPropertyExpressionNode extends ASTRuleNode {
  type: 'propertyExpression';
  object: string;
  property: string;
}

/**
 * Comparison expression node in the Rule AST
 */
export interface ASTComparisonExpressionNode extends Parent {
  type: 'comparisonExpression';
  operator: string;
  children: [ASTExpressionNode, ASTExpressionNode];
}

/**
 * Logical expression node in the Rule AST
 */
export interface ASTLogicalExpressionNode extends Parent {
  type: 'logicalExpression';
  operator: string;
  children: ASTExpressionNode[];
}

/**
 * Exists expression node in the Rule AST
 */
export interface ASTExistsExpressionNode extends Parent {
  type: 'existsExpression';
  positive: boolean;
  children: [ASTPathPatternNode];
}

/**
 * Create a unist Node representing a RuleRoot
 */
function createASTRuleNode(
  name: string,
  description: string,
  priority: number,
  disabled: boolean | undefined,
  children: Array<ASTMatchNode | ASTWhereNode | ASTCreateNode | ASTSetNode>
): ASTRuleRoot {
  return {
    type: 'rule',
    name,
    description,
    priority,
    disabled,
    children
  };
}

/**
 * Create a unist Node representing a MatchNode
 */
function createASTMatchNode(children: ASTPathPatternNode[]): ASTMatchNode {
  return {
    type: 'match',
    children
  };
}

/**
 * Create a unist Node representing a WhereNode
 */
function createASTWhereNode(condition: ASTExpressionNode): ASTWhereNode {
  return {
    type: 'where',
    children: [condition]
  };
}

/**
 * Create a unist Node representing a CreateNode
 */
function createASTCreateNode(children: Array<ASTCreateNodePatternNode | ASTCreateRelPatternNode>): ASTCreateNode {
  return {
    type: 'create',
    children
  };
}

/**
 * Create a unist Node representing a SetNode
 */
function createASTSetNode(children: ASTPropertySettingNode[]): ASTSetNode {
  return {
    type: 'set',
    children
  };
}

/**
 * Create a unist Node representing a PathPatternNode
 */
function createASTPathPatternNode(
  startNode: ASTNodePatternNode,
  segments: ASTRelationshipSegmentNode[]
): ASTPathPatternNode {
  return {
    type: 'pathPattern',
    children: [startNode, ...segments]
  };
}

/**
 * Create a unist Node representing a NodePatternNode
 */
function createASTNodePatternNode(
  variable: string | undefined,
  labels: string[],
  properties: Record<string, any>
): ASTNodePatternNode {
  return {
    type: 'nodePattern',
    variable,
    labels,
    properties
  };
}

/**
 * Create a unist Node representing a RelationshipSegmentNode
 */
function createASTRelationshipSegmentNode(
  relationship: ASTRelationshipPatternNode,
  node: ASTNodePatternNode
): ASTRelationshipSegmentNode {
  return {
    type: 'relationshipSegment',
    children: [relationship, node]
  };
}

/**
 * Create a unist Node representing a RelationshipPatternNode
 */
function createASTRelationshipPatternNode(
  variable: string | undefined,
  relType: string | undefined,
  direction: 'outgoing' | 'incoming' | 'both',
  properties: Record<string, any>,
  minHops?: number,
  maxHops?: number
): ASTRelationshipPatternNode {
  return {
    type: 'relationshipPattern',
    variable,
    relType,
    direction,
    properties,
    minHops,
    maxHops
  };
}

/**
 * Create a unist Node representing a CreateNodePatternNode
 */
function createASTCreateNodePatternNode(
  variable: string | undefined,
  labels: string[],
  properties: Record<string, any>
): ASTCreateNodePatternNode {
  return {
    type: 'createNode',
    variable,
    labels,
    properties
  };
}

/**
 * Create a unist Node representing a CreateRelPatternNode
 */
function createASTCreateRelPatternNode(
  fromVar: string,
  toVar: string,
  relationship: {
    variable?: string;
    relType?: string;
    direction: 'outgoing' | 'incoming' | 'both';
    properties: Record<string, any>;
  }
): ASTCreateRelPatternNode {
  return {
    type: 'createRelationship',
    fromVar,
    toVar,
    relationship
  };
}

/**
 * Create a unist Node representing a PropertySettingNode
 */
function createASTPropertySettingNode(
  target: string,
  property: string,
  value: ASTExpressionNode
): ASTPropertySettingNode {
  return {
    type: 'propertySetting',
    target,
    property,
    value
  };
}

/**
 * Create a unist Node representing a LiteralExpressionNode
 */
function createASTLiteralExpressionNode(
  value: string | number | boolean | null,
  dataType: 'string' | 'number' | 'boolean' | 'null'
): ASTLiteralExpressionNode {
  return {
    type: 'literalExpression',
    value,
    dataType
  };
}

/**
 * Create a unist Node representing a VariableExpressionNode
 */
function createASTVariableExpressionNode(name: string): ASTVariableExpressionNode {
  return {
    type: 'variableExpression',
    name
  };
}

/**
 * Create a unist Node representing a PropertyExpressionNode
 */
function createASTPropertyExpressionNode(
  object: string,
  property: string
): ASTPropertyExpressionNode {
  return {
    type: 'propertyExpression',
    object,
    property
  };
}

/**
 * Create a unist Node representing a ComparisonExpressionNode
 */
function createASTComparisonExpressionNode(
  operator: string,
  left: ASTExpressionNode,
  right: ASTExpressionNode
): ASTComparisonExpressionNode {
  return {
    type: 'comparisonExpression',
    operator,
    children: [left, right]
  };
}

/**
 * Create a unist Node representing a LogicalExpressionNode
 */
function createASTLogicalExpressionNode(
  operator: string,
  children: ASTExpressionNode[]
): ASTLogicalExpressionNode {
  return {
    type: 'logicalExpression',
    operator,
    children
  };
}

/**
 * Create a unist Node representing an ExistsExpressionNode
 */
function createASTExistsExpressionNode(
  positive: boolean,
  pattern: ASTPathPatternNode
): ASTExistsExpressionNode {
  return {
    type: 'existsExpression',
    positive,
    children: [pattern]
  };
}

/**
 * Transforms a Cypher statement into a Rule AST
 * @param statement The Cypher statement to transform
 * @param ruleName The name of the rule
 * @param description The description of the rule
 * @param priority The priority of the rule
 * @param disabled Whether the rule is disabled
 * @returns The transformed Rule AST
 */
export function transformToCypherAst(
  statement: CypherStatement,
  ruleName: string,
  description: string,
  priority: number,
  disabled?: boolean
): ASTRuleRoot {
  const children: Array<ASTMatchNode | ASTWhereNode | ASTCreateNode | ASTSetNode> = [];

  // Add MATCH clause if it exists
  if (statement.match) {
    children.push(transformMatchClause(statement.match));
  }

  // Add WHERE clause if it exists
  if (statement.where) {
    children.push(transformWhereClause(statement.where));
  }

  // Add CREATE clause if it exists
  if (statement.create) {
    children.push(transformCreateClause(statement.create));
  }

  // Add SET clause if it exists
  if (statement.set) {
    children.push(transformSetClause(statement.set));
  }

  return createASTRuleNode(ruleName, description, priority, disabled, children);
}

/**
 * Transforms a MATCH clause into a Match node
 * @param matchClause The MATCH clause to transform
 * @returns The transformed Match node
 */
function transformMatchClause(matchClause: MatchClause): ASTMatchNode {
  const pathPatterns = matchClause.patterns.map(transformPathPattern);
  return createASTMatchNode(pathPatterns);
}

/**
 * Transforms a WHERE clause into a Where node
 * @param whereClause The WHERE clause to transform
 * @returns The transformed Where node
 */
function transformWhereClause(whereClause: WhereClause): ASTWhereNode {
  const condition = transformExpression(whereClause.condition);
  return createASTWhereNode(condition);
}

/**
 * Transforms a CREATE clause into a Create node
 * @param createClause The CREATE clause to transform
 * @returns The transformed Create node
 */
function transformCreateClause(createClause: CreateClause): ASTCreateNode {
  const patterns = createClause.patterns.map(pattern => {
    if ('node' in pattern) {
      return transformCreateNodePattern(pattern.node);
    } else {
      return transformCreateRelationshipPattern(pattern);
    }
  });

  return createASTCreateNode(patterns);
}

/**
 * Transforms a SET clause into a Set node
 * @param setClause The SET clause to transform
 * @returns The transformed Set node
 */
function transformSetClause(setClause: SetClause): ASTSetNode {
  const settings = setClause.settings.map(transformPropertySetting);
  return createASTSetNode(settings);
}

/**
 * Transforms a path pattern into a PathPattern node
 * @param pathPattern The path pattern to transform
 * @returns The transformed PathPattern node
 */
function transformPathPattern(pathPattern: PathPattern): ASTPathPatternNode {
  const startNode = transformNodePattern(pathPattern.start);
  const segments = pathPattern.segments.map(segment => {
    return createASTRelationshipSegmentNode(
      transformRelationshipPattern(segment.relationship),
      transformNodePattern(segment.node)
    );
  });

  return createASTPathPatternNode(startNode, segments);
}

/**
 * Transforms a node pattern into a NodePattern node
 * @param nodePattern The node pattern to transform
 * @returns The transformed NodePattern node
 */
function transformNodePattern(nodePattern: NodePattern): ASTNodePatternNode {
  return createASTNodePatternNode(
    nodePattern.variable,
    nodePattern.labels,
    nodePattern.properties
  );
}

/**
 * Transforms a relationship pattern into a RelationshipPattern node
 * @param relationshipPattern The relationship pattern to transform
 * @returns The transformed RelationshipPattern node
 */
function transformRelationshipPattern(relationshipPattern: RelationshipPattern): ASTRelationshipPatternNode {
  return createASTRelationshipPatternNode(
    relationshipPattern.variable,
    relationshipPattern.type,
    relationshipPattern.direction,
    relationshipPattern.properties,
    relationshipPattern.minHops,
    relationshipPattern.maxHops
  );
}

/**
 * Transforms a CREATE node pattern into a CreateNodePattern node
 * @param nodePattern The node pattern to transform
 * @returns The transformed CreateNodePattern node
 */
function transformCreateNodePattern(nodePattern: NodePattern): ASTCreateNodePatternNode {
  return createASTCreateNodePatternNode(
    nodePattern.variable,
    nodePattern.labels,
    nodePattern.properties
  );
}

/**
 * Transforms a CREATE relationship pattern into a CreateRelationshipPattern node
 * @param createRelationship The CREATE relationship pattern to transform
 * @returns The transformed CreateRelationshipPattern node
 */
function transformCreateRelationshipPattern(createRelationship: any): ASTCreateRelPatternNode {
  return createASTCreateRelPatternNode(
    createRelationship.fromNode.name,
    createRelationship.toNode.name,
    {
      variable: createRelationship.relationship.variable,
      relType: createRelationship.relationship.type,
      direction: createRelationship.relationship.direction,
      properties: createRelationship.relationship.properties
    }
  );
}

/**
 * Transforms a property setting into a PropertySetting node
 * @param propertySetting The property setting to transform
 * @returns The transformed PropertySetting node
 */
function transformPropertySetting(propertySetting: any): ASTPropertySettingNode {
  return createASTPropertySettingNode(
    propertySetting.target.name,
    propertySetting.property,
    transformExpression(propertySetting.value)
  );
}

/**
 * Transforms an expression into an Expression node
 * @param expression The expression to transform
 * @returns The transformed Expression node
 */
function transformExpression(expression: Expression): ASTExpressionNode {
  switch (expression.type) {
    case 'literal':
      return transformLiteralExpression(expression as LiteralExpression);
    case 'variable':
      return transformVariableExpression(expression as VariableExpression);
    case 'property':
      return transformPropertyExpression(expression as PropertyExpression);
    case 'comparison':
      return transformComparisonExpression(expression as ComparisonExpression);
    case 'logical':
      return transformLogicalExpression(expression as LogicalExpression);
    case 'exists':
      return transformExistsExpression(expression as ExistsExpression);
    default:
      throw new Error(`Unsupported expression type: ${(expression as any).type}`);
  }
}

/**
 * Transforms a literal expression into a LiteralExpression node
 * @param literalExpression The literal expression to transform
 * @returns The transformed LiteralExpression node
 */
function transformLiteralExpression(literalExpression: LiteralExpression): ASTLiteralExpressionNode {
  return createASTLiteralExpressionNode(
    literalExpression.value,
    literalExpression.dataType
  );
}

/**
 * Transforms a variable expression into a VariableExpression node
 * @param variableExpression The variable expression to transform
 * @returns The transformed VariableExpression node
 */
function transformVariableExpression(variableExpression: VariableExpression): ASTVariableExpressionNode {
  return createASTVariableExpressionNode(variableExpression.name);
}

/**
 * Transforms a property expression into a PropertyExpression node
 * @param propertyExpression The property expression to transform
 * @returns The transformed PropertyExpression node
 */
function transformPropertyExpression(propertyExpression: PropertyExpression): ASTPropertyExpressionNode {
  return createASTPropertyExpressionNode(
    propertyExpression.object.name,
    propertyExpression.property
  );
}

/**
 * Transforms a comparison expression into a ComparisonExpression node
 * @param comparisonExpression The comparison expression to transform
 * @returns The transformed ComparisonExpression node
 */
function transformComparisonExpression(comparisonExpression: ComparisonExpression): ASTComparisonExpressionNode {
  const left = transformExpression(comparisonExpression.left);
  const right = transformExpression(comparisonExpression.right);

  return createASTComparisonExpressionNode(
    comparisonExpression.operator,
    left,
    right
  );
}

/**
 * Transforms a logical expression into a LogicalExpression node
 * @param logicalExpression The logical expression to transform
 * @returns The transformed LogicalExpression node
 */
function transformLogicalExpression(logicalExpression: LogicalExpression): ASTLogicalExpressionNode {
  const operands = logicalExpression.operands.map(transformExpression);

  return createASTLogicalExpressionNode(
    logicalExpression.operator,
    operands
  );
}

/**
 * Transforms an exists expression into an ExistsExpression node
 * @param existsExpression The exists expression to transform
 * @returns The transformed ExistsExpression node
 */
function transformExistsExpression(existsExpression: ExistsExpression): ASTExistsExpressionNode {
  const pattern = transformPathPattern(existsExpression.pattern);

  return createASTExistsExpressionNode(
    existsExpression.positive,
    pattern
  );
}

/**
 * Provides a unist-compatible inspection of the AST
 * @param ast The AST to inspect
 * @returns A string representation of the AST
 */
export function inspectAst(ast: ASTRuleRoot): string {
  return inspect(ast);
}

/**
 * Generates a simple ASCII visualization of the AST
 * @param node The node to visualize
 * @param indent The indentation level (default: 0)
 * @returns The ASCII visualization
 */
export function visualizeAst(node: ASTRuleNode | Parent, indent: number = 0): string {
  const padding = ' '.repeat(indent * 2);
  let result = `${padding}${node.type}`;

  // Add properties based on node type
  switch (node.type) {
    case 'rule':
      const ruleNode = node as ASTRuleRoot;
      result += ` (name: "${ruleNode.name}", priority: ${ruleNode.priority})`;
      break;
    case 'nodePattern':
      const nodePattern = node as ASTNodePatternNode;
      result += ` (${nodePattern.variable || ''}:${nodePattern.labels.join(':')})`;
      if (Object.keys(nodePattern.properties).length > 0) {
        result += ` properties: ${JSON.stringify(nodePattern.properties)}`;
      }
      break;
    case 'relationshipPattern':
      const relPattern = node as ASTRelationshipPatternNode;
      result += ` [${relPattern.variable || ''}:${relPattern.relType || ''}] dir: ${relPattern.direction}`;
      if (relPattern.minHops !== undefined || relPattern.maxHops !== undefined) {
        result += ` *${relPattern.minHops || ''}..${relPattern.maxHops || ''}`;
      }
      break;
    case 'literalExpression':
      const litExpr = node as ASTLiteralExpressionNode;
      result += ` (${litExpr.dataType}: ${litExpr.value})`;
      break;
    case 'variableExpression':
      const varExpr = node as ASTVariableExpressionNode;
      result += ` (${varExpr.name})`;
      break;
    case 'propertyExpression':
      const propExpr = node as ASTPropertyExpressionNode;
      result += ` (${propExpr.object}.${propExpr.property})`;
      break;
    case 'comparisonExpression':
      const compExpr = node as ASTComparisonExpressionNode;
      result += ` (operator: ${compExpr.operator})`;
      break;
    case 'logicalExpression':
      const logExpr = node as ASTLogicalExpressionNode;
      result += ` (operator: ${logExpr.operator})`;
      break;
    case 'existsExpression':
      const existsExpr = node as ASTExistsExpressionNode;
      result += ` (${existsExpr.positive ? 'EXISTS' : 'NOT EXISTS'})`;
      break;
    case 'propertySetting':
      const propSetting = node as ASTPropertySettingNode;
      result += ` (${propSetting.target}.${propSetting.property})`;
      break;
    case 'createNode':
      const createNode = node as ASTCreateNodePatternNode;
      result += ` (${createNode.variable || ''}:${createNode.labels.join(':')})`;
      break;
    case 'createRelationship':
      const createRel = node as ASTCreateRelPatternNode;
      result += ` (${createRel.fromVar})-[${createRel.relationship.variable || ''}:${createRel.relationship.relType || ''}]->(${createRel.toVar})`;
      break;
  }

  result += '\n';

  // Recursively visualize children
  if ('children' in node && Array.isArray(node.children)) {
    for (const child of node.children) {
      result += visualizeAst(child, indent + 1);
    }
  }

  return result;
}

/**
 * Validates the AST for semantic correctness
 * @param ast The AST to validate
 * @returns An array of validation errors, or an empty array if the AST is valid
 */
export function validateAst(ast: ASTRuleRoot): string[] {
  const errors: string[] = [];

  // Validate rule metadata
  if (!ast.name) {
    errors.push('Rule must have a name');
  }

  if (!ast.description) {
    errors.push('Rule must have a description');
  }

  if (typeof ast.priority !== 'number' || isNaN(ast.priority)) {
    errors.push('Rule must have a numeric priority');
  }

  // Validate that the rule has at least one clause
  if (!ast.children || ast.children.length === 0) {
    errors.push('Rule must have at least one clause (MATCH, WHERE, CREATE, SET)');
  }

  // Validate variable references
  const declaredVariables = new Set<string>();
  const usedVariables = new Set<string>();

  // Collect declared variables
  for (const node of ast.children) {
    if (node.type === 'match') {
      collectDeclaredVariables(node, declaredVariables);
    }
  }

  // Collect used variables
  for (const node of ast.children) {
    if (node.type === 'where' || node.type === 'create' || node.type === 'set') {
      collectUsedVariables(node, usedVariables);
    }
  }

  // Check for undeclared variables
  for (const variable of usedVariables) {
    if (!declaredVariables.has(variable)) {
      errors.push(`Variable '${variable}' is used but not declared in a MATCH clause`);
    }
  }

  return errors;
}

/**
 * Collects all declared variables in a MATCH clause
 * @param node The MATCH node
 * @param variables The set to collect variables into
 */
function collectDeclaredVariables(node: ASTMatchNode, variables: Set<string>): void {
  for (const pathPattern of node.children) {
    if (pathPattern.children[0].variable) {
      variables.add(pathPattern.children[0].variable);
    }

    for (const segment of pathPattern.children.slice(1)) {
      const relationshipSegment = segment as ASTRelationshipSegmentNode;
      const relationshipPattern = relationshipSegment.children[0] as ASTRelationshipPatternNode;
      const nodePattern = relationshipSegment.children[1] as ASTNodePatternNode;

      if (relationshipPattern.variable) {
        variables.add(relationshipPattern.variable);
      }

      if (nodePattern.variable) {
        variables.add(nodePattern.variable);
      }
    }
  }
}

/**
 * Collects all used variables in a WHERE, CREATE, or SET clause
 * @param node The clause node
 * @param variables The set to collect variables into
 */
function collectUsedVariables(
  node: ASTWhereNode | ASTCreateNode | ASTSetNode,
  variables: Set<string>
): void {
  if (node.type === 'where') {
    const whereNode = node as ASTWhereNode;
    collectVariablesInExpression(whereNode.children[0], variables);
  } else if (node.type === 'create') {
    const createNode = node as ASTCreateNode;
    for (const pattern of createNode.children) {
      if (pattern.type === 'createRelationship') {
        const createRel = pattern as ASTCreateRelPatternNode;
        variables.add(createRel.fromVar);
        variables.add(createRel.toVar);
      }
    }
  } else if (node.type === 'set') {
    const setNode = node as ASTSetNode;
    for (const setting of setNode.children) {
      const propertySetting = setting as ASTPropertySettingNode;
      variables.add(propertySetting.target);
      collectVariablesInExpression(propertySetting.value, variables);
    }
  }
}

/**
 * Collects all variables used in an expression
 * @param node The expression node
 * @param variables The set to collect variables into
 */
function collectVariablesInExpression(node: ASTExpressionNode, variables: Set<string>): void {
  if (node.type === 'variableExpression') {
    variables.add((node as ASTVariableExpressionNode).name);
  } else if (node.type === 'propertyExpression') {
    variables.add((node as ASTPropertyExpressionNode).object);
  } else if (node.type === 'comparisonExpression') {
    const compExpr = node as ASTComparisonExpressionNode;
    collectVariablesInExpression(compExpr.children[0], variables);
    collectVariablesInExpression(compExpr.children[1], variables);
  } else if (node.type === 'logicalExpression') {
    const logExpr = node as ASTLogicalExpressionNode;
    for (const operand of logExpr.children) {
      collectVariablesInExpression(operand, variables);
    }
  } else if (node.type === 'existsExpression') {
    // Variables in EXISTS patterns create their own scope, so they don't count as references
  }
}