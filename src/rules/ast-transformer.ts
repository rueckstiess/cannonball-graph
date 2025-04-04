import { Node, Parent } from 'unist';
import { u } from 'unist-builder';
import { CypherStatement, ComparisonExpression, ExistsExpression, LiteralExpression, 
  LogicalExpression, PropertyExpression, VariableExpression, NodePattern, RelationshipPattern, 
  PathPattern, Expression, MatchClause, WhereClause, CreateClause, SetClause } from './types';
import { inspect } from 'unist-util-inspect';

/**
 * Interface for rule AST nodes
 */
export interface RuleNode extends Node {
  type: string;
}

/**
 * Root node of the Rule AST
 */
export interface RuleRoot extends Parent {
  type: 'rule';
  name: string;
  description: string;
  priority: number;
  disabled?: boolean;
  children: Array<MatchNode | WhereNode | CreateNode | SetNode>;
}

/**
 * Match clause node in the Rule AST
 */
export interface MatchNode extends Parent {
  type: 'match';
  children: PathPatternNode[];
}

/**
 * Where clause node in the Rule AST
 */
export interface WhereNode extends Parent {
  type: 'where';
  children: [ExpressionNode];
}

/**
 * Create clause node in the Rule AST
 */
export interface CreateNode extends Parent {
  type: 'create';
  children: Array<CreateNodePatternNode | CreateRelPatternNode>;
}

/**
 * Set clause node in the Rule AST
 */
export interface SetNode extends Parent {
  type: 'set';
  children: PropertySettingNode[];
}

/**
 * Path pattern node in the Rule AST
 */
export interface PathPatternNode extends Parent {
  type: 'pathPattern';
  children: [NodePatternNode, ...RelationshipSegmentNode[]];
}

/**
 * Node pattern node in the Rule AST
 */
export interface NodePatternNode extends RuleNode {
  type: 'nodePattern';
  variable?: string;
  labels: string[];
  properties: Record<string, any>;
}

/**
 * Relationship segment (relationship + node) node in the Rule AST
 */
export interface RelationshipSegmentNode extends Parent {
  type: 'relationshipSegment';
  children: [RelationshipPatternNode, NodePatternNode];
}

/**
 * Relationship pattern node in the Rule AST
 */
export interface RelationshipPatternNode extends RuleNode {
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
export interface CreateNodePatternNode extends RuleNode {
  type: 'createNode';
  variable?: string;
  labels: string[];
  properties: Record<string, any>;
}

/**
 * Create relationship pattern node in the Rule AST
 */
export interface CreateRelPatternNode extends RuleNode {
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
export interface PropertySettingNode extends RuleNode {
  type: 'propertySetting';
  target: string;
  property: string;
  value: ExpressionNode;
}

/**
 * Base interface for expression nodes in the Rule AST
 */
export type ExpressionNode = 
  | LiteralExpressionNode
  | VariableExpressionNode
  | PropertyExpressionNode
  | ComparisonExpressionNode
  | LogicalExpressionNode
  | ExistsExpressionNode;

/**
 * Literal expression node in the Rule AST
 */
export interface LiteralExpressionNode extends RuleNode {
  type: 'literalExpression';
  value: string | number | boolean | null;
  dataType: 'string' | 'number' | 'boolean' | 'null';
}

/**
 * Variable expression node in the Rule AST
 */
export interface VariableExpressionNode extends RuleNode {
  type: 'variableExpression';
  name: string;
}

/**
 * Property expression node in the Rule AST
 */
export interface PropertyExpressionNode extends RuleNode {
  type: 'propertyExpression';
  object: string;
  property: string;
}

/**
 * Comparison expression node in the Rule AST
 */
export interface ComparisonExpressionNode extends Parent {
  type: 'comparisonExpression';
  operator: string;
  children: [ExpressionNode, ExpressionNode];
}

/**
 * Logical expression node in the Rule AST
 */
export interface LogicalExpressionNode extends Parent {
  type: 'logicalExpression';
  operator: string;
  children: ExpressionNode[];
}

/**
 * Exists expression node in the Rule AST
 */
export interface ExistsExpressionNode extends Parent {
  type: 'existsExpression';
  positive: boolean;
  children: [PathPatternNode];
}

/**
 * Create a unist Node representing a RuleRoot
 */
function createRuleNode(
  name: string,
  description: string,
  priority: number,
  disabled: boolean | undefined,
  children: Array<MatchNode | WhereNode | CreateNode | SetNode>
): RuleRoot {
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
function createMatchNode(children: PathPatternNode[]): MatchNode {
  return {
    type: 'match',
    children
  };
}

/**
 * Create a unist Node representing a WhereNode
 */
function createWhereNode(condition: ExpressionNode): WhereNode {
  return {
    type: 'where',
    children: [condition]
  };
}

/**
 * Create a unist Node representing a CreateNode
 */
function createCreateNode(children: Array<CreateNodePatternNode | CreateRelPatternNode>): CreateNode {
  return {
    type: 'create',
    children
  };
}

/**
 * Create a unist Node representing a SetNode
 */
function createSetNode(children: PropertySettingNode[]): SetNode {
  return {
    type: 'set',
    children
  };
}

/**
 * Create a unist Node representing a PathPatternNode
 */
function createPathPatternNode(
  startNode: NodePatternNode,
  segments: RelationshipSegmentNode[]
): PathPatternNode {
  return {
    type: 'pathPattern',
    children: [startNode, ...segments]
  };
}

/**
 * Create a unist Node representing a NodePatternNode
 */
function createNodePatternNode(
  variable: string | undefined,
  labels: string[],
  properties: Record<string, any>
): NodePatternNode {
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
function createRelationshipSegmentNode(
  relationship: RelationshipPatternNode,
  node: NodePatternNode
): RelationshipSegmentNode {
  return {
    type: 'relationshipSegment',
    children: [relationship, node]
  };
}

/**
 * Create a unist Node representing a RelationshipPatternNode
 */
function createRelationshipPatternNode(
  variable: string | undefined,
  relType: string | undefined,
  direction: 'outgoing' | 'incoming' | 'both',
  properties: Record<string, any>,
  minHops?: number,
  maxHops?: number
): RelationshipPatternNode {
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
function createCreateNodePatternNode(
  variable: string | undefined,
  labels: string[],
  properties: Record<string, any>
): CreateNodePatternNode {
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
function createCreateRelPatternNode(
  fromVar: string,
  toVar: string,
  relationship: {
    variable?: string;
    relType?: string;
    direction: 'outgoing' | 'incoming' | 'both';
    properties: Record<string, any>;
  }
): CreateRelPatternNode {
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
function createPropertySettingNode(
  target: string,
  property: string,
  value: ExpressionNode
): PropertySettingNode {
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
function createLiteralExpressionNode(
  value: string | number | boolean | null,
  dataType: 'string' | 'number' | 'boolean' | 'null'
): LiteralExpressionNode {
  return {
    type: 'literalExpression',
    value,
    dataType
  };
}

/**
 * Create a unist Node representing a VariableExpressionNode
 */
function createVariableExpressionNode(name: string): VariableExpressionNode {
  return {
    type: 'variableExpression',
    name
  };
}

/**
 * Create a unist Node representing a PropertyExpressionNode
 */
function createPropertyExpressionNode(
  object: string,
  property: string
): PropertyExpressionNode {
  return {
    type: 'propertyExpression',
    object,
    property
  };
}

/**
 * Create a unist Node representing a ComparisonExpressionNode
 */
function createComparisonExpressionNode(
  operator: string,
  left: ExpressionNode,
  right: ExpressionNode
): ComparisonExpressionNode {
  return {
    type: 'comparisonExpression',
    operator,
    children: [left, right]
  };
}

/**
 * Create a unist Node representing a LogicalExpressionNode
 */
function createLogicalExpressionNode(
  operator: string,
  children: ExpressionNode[]
): LogicalExpressionNode {
  return {
    type: 'logicalExpression',
    operator,
    children
  };
}

/**
 * Create a unist Node representing an ExistsExpressionNode
 */
function createExistsExpressionNode(
  positive: boolean,
  pattern: PathPatternNode
): ExistsExpressionNode {
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
): RuleRoot {
  const children: Array<MatchNode | WhereNode | CreateNode | SetNode> = [];
  
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
  
  return createRuleNode(ruleName, description, priority, disabled, children);
}

/**
 * Transforms a MATCH clause into a Match node
 * @param matchClause The MATCH clause to transform
 * @returns The transformed Match node
 */
function transformMatchClause(matchClause: MatchClause): MatchNode {
  const pathPatterns = matchClause.patterns.map(transformPathPattern);
  return createMatchNode(pathPatterns);
}

/**
 * Transforms a WHERE clause into a Where node
 * @param whereClause The WHERE clause to transform
 * @returns The transformed Where node
 */
function transformWhereClause(whereClause: WhereClause): WhereNode {
  const condition = transformExpression(whereClause.condition);
  return createWhereNode(condition);
}

/**
 * Transforms a CREATE clause into a Create node
 * @param createClause The CREATE clause to transform
 * @returns The transformed Create node
 */
function transformCreateClause(createClause: CreateClause): CreateNode {
  const patterns = createClause.patterns.map(pattern => {
    if ('node' in pattern) {
      return transformCreateNodePattern(pattern.node);
    } else {
      return transformCreateRelationshipPattern(pattern);
    }
  });
  
  return createCreateNode(patterns);
}

/**
 * Transforms a SET clause into a Set node
 * @param setClause The SET clause to transform
 * @returns The transformed Set node
 */
function transformSetClause(setClause: SetClause): SetNode {
  const settings = setClause.settings.map(transformPropertySetting);
  return createSetNode(settings);
}

/**
 * Transforms a path pattern into a PathPattern node
 * @param pathPattern The path pattern to transform
 * @returns The transformed PathPattern node
 */
function transformPathPattern(pathPattern: PathPattern): PathPatternNode {
  const startNode = transformNodePattern(pathPattern.start);
  const segments = pathPattern.segments.map(segment => {
    return createRelationshipSegmentNode(
      transformRelationshipPattern(segment.relationship),
      transformNodePattern(segment.node)
    );
  });
  
  return createPathPatternNode(startNode, segments);
}

/**
 * Transforms a node pattern into a NodePattern node
 * @param nodePattern The node pattern to transform
 * @returns The transformed NodePattern node
 */
function transformNodePattern(nodePattern: NodePattern): NodePatternNode {
  return createNodePatternNode(
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
function transformRelationshipPattern(relationshipPattern: RelationshipPattern): RelationshipPatternNode {
  return createRelationshipPatternNode(
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
function transformCreateNodePattern(nodePattern: NodePattern): CreateNodePatternNode {
  return createCreateNodePatternNode(
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
function transformCreateRelationshipPattern(createRelationship: any): CreateRelPatternNode {
  return createCreateRelPatternNode(
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
function transformPropertySetting(propertySetting: any): PropertySettingNode {
  return createPropertySettingNode(
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
function transformExpression(expression: Expression): ExpressionNode {
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
function transformLiteralExpression(literalExpression: LiteralExpression): LiteralExpressionNode {
  return createLiteralExpressionNode(
    literalExpression.value,
    literalExpression.dataType
  );
}

/**
 * Transforms a variable expression into a VariableExpression node
 * @param variableExpression The variable expression to transform
 * @returns The transformed VariableExpression node
 */
function transformVariableExpression(variableExpression: VariableExpression): VariableExpressionNode {
  return createVariableExpressionNode(variableExpression.name);
}

/**
 * Transforms a property expression into a PropertyExpression node
 * @param propertyExpression The property expression to transform
 * @returns The transformed PropertyExpression node
 */
function transformPropertyExpression(propertyExpression: PropertyExpression): PropertyExpressionNode {
  return createPropertyExpressionNode(
    propertyExpression.object.name,
    propertyExpression.property
  );
}

/**
 * Transforms a comparison expression into a ComparisonExpression node
 * @param comparisonExpression The comparison expression to transform
 * @returns The transformed ComparisonExpression node
 */
function transformComparisonExpression(comparisonExpression: ComparisonExpression): ComparisonExpressionNode {
  const left = transformExpression(comparisonExpression.left);
  const right = transformExpression(comparisonExpression.right);
  
  return createComparisonExpressionNode(
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
function transformLogicalExpression(logicalExpression: LogicalExpression): LogicalExpressionNode {
  const operands = logicalExpression.operands.map(transformExpression);
  
  return createLogicalExpressionNode(
    logicalExpression.operator,
    operands
  );
}

/**
 * Transforms an exists expression into an ExistsExpression node
 * @param existsExpression The exists expression to transform
 * @returns The transformed ExistsExpression node
 */
function transformExistsExpression(existsExpression: ExistsExpression): ExistsExpressionNode {
  const pattern = transformPathPattern(existsExpression.pattern);
  
  return createExistsExpressionNode(
    existsExpression.positive,
    pattern
  );
}

/**
 * Provides a unist-compatible inspection of the AST
 * @param ast The AST to inspect
 * @returns A string representation of the AST
 */
export function inspectAst(ast: RuleRoot): string {
  return inspect(ast);
}

/**
 * Generates a simple ASCII visualization of the AST
 * @param node The node to visualize
 * @param indent The indentation level (default: 0)
 * @returns The ASCII visualization
 */
export function visualizeAst(node: RuleNode | Parent, indent: number = 0): string {
  const padding = ' '.repeat(indent * 2);
  let result = `${padding}${node.type}`;
  
  // Add properties based on node type
  switch (node.type) {
    case 'rule':
      const ruleNode = node as RuleRoot;
      result += ` (name: "${ruleNode.name}", priority: ${ruleNode.priority})`;
      break;
    case 'nodePattern':
      const nodePattern = node as NodePatternNode;
      result += ` (${nodePattern.variable || ''}:${nodePattern.labels.join(':')})`;
      if (Object.keys(nodePattern.properties).length > 0) {
        result += ` properties: ${JSON.stringify(nodePattern.properties)}`;
      }
      break;
    case 'relationshipPattern':
      const relPattern = node as RelationshipPatternNode;
      result += ` [${relPattern.variable || ''}:${relPattern.relType || ''}] dir: ${relPattern.direction}`;
      if (relPattern.minHops !== undefined || relPattern.maxHops !== undefined) {
        result += ` *${relPattern.minHops || ''}..${relPattern.maxHops || ''}`;
      }
      break;
    case 'literalExpression':
      const litExpr = node as LiteralExpressionNode;
      result += ` (${litExpr.dataType}: ${litExpr.value})`;
      break;
    case 'variableExpression':
      const varExpr = node as VariableExpressionNode;
      result += ` (${varExpr.name})`;
      break;
    case 'propertyExpression':
      const propExpr = node as PropertyExpressionNode;
      result += ` (${propExpr.object}.${propExpr.property})`;
      break;
    case 'comparisonExpression':
      const compExpr = node as ComparisonExpressionNode;
      result += ` (operator: ${compExpr.operator})`;
      break;
    case 'logicalExpression':
      const logExpr = node as LogicalExpressionNode;
      result += ` (operator: ${logExpr.operator})`;
      break;
    case 'existsExpression':
      const existsExpr = node as ExistsExpressionNode;
      result += ` (${existsExpr.positive ? 'EXISTS' : 'NOT EXISTS'})`;
      break;
    case 'propertySetting':
      const propSetting = node as PropertySettingNode;
      result += ` (${propSetting.target}.${propSetting.property})`;
      break;
    case 'createNode':
      const createNode = node as CreateNodePatternNode;
      result += ` (${createNode.variable || ''}:${createNode.labels.join(':')})`;
      break;
    case 'createRelationship':
      const createRel = node as CreateRelPatternNode;
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
export function validateAst(ast: RuleRoot): string[] {
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
function collectDeclaredVariables(node: MatchNode, variables: Set<string>): void {
  for (const pathPattern of node.children) {
    if (pathPattern.children[0].variable) {
      variables.add(pathPattern.children[0].variable);
    }
    
    for (const segment of pathPattern.children.slice(1)) {
      const relationshipSegment = segment as RelationshipSegmentNode;
      const relationshipPattern = relationshipSegment.children[0] as RelationshipPatternNode;
      const nodePattern = relationshipSegment.children[1] as NodePatternNode;
      
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
  node: WhereNode | CreateNode | SetNode,
  variables: Set<string>
): void {
  if (node.type === 'where') {
    const whereNode = node as WhereNode;
    collectVariablesInExpression(whereNode.children[0], variables);
  } else if (node.type === 'create') {
    const createNode = node as CreateNode;
    for (const pattern of createNode.children) {
      if (pattern.type === 'createRelationship') {
        const createRel = pattern as CreateRelPatternNode;
        variables.add(createRel.fromVar);
        variables.add(createRel.toVar);
      }
    }
  } else if (node.type === 'set') {
    const setNode = node as SetNode;
    for (const setting of setNode.children) {
      const propertySetting = setting as PropertySettingNode;
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
function collectVariablesInExpression(node: ExpressionNode, variables: Set<string>): void {
  if (node.type === 'variableExpression') {
    variables.add((node as VariableExpressionNode).name);
  } else if (node.type === 'propertyExpression') {
    variables.add((node as PropertyExpressionNode).object);
  } else if (node.type === 'comparisonExpression') {
    const compExpr = node as ComparisonExpressionNode;
    collectVariablesInExpression(compExpr.children[0], variables);
    collectVariablesInExpression(compExpr.children[1], variables);
  } else if (node.type === 'logicalExpression') {
    const logExpr = node as LogicalExpressionNode;
    for (const operand of logExpr.children) {
      collectVariablesInExpression(operand, variables);
    }
  } else if (node.type === 'existsExpression') {
    // Variables in EXISTS patterns create their own scope, so they don't count as references
  }
}