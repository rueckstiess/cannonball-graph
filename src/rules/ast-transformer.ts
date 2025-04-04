import { Node, Parent } from 'unist';
import { u } from 'unist-builder';
import { CypherStatement, ComparisonExpression, ExistsExpression, LiteralExpression, 
  LogicalExpression, PropertyExpression, VariableExpression, NodePattern, RelationshipPattern, 
  PathPattern, Expression, MatchClause, WhereClause, CreateClause, SetClause } from './types';

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
  
  return u('rule', {
    name: ruleName,
    description,
    priority,
    disabled,
    children
  }) as unknown as RuleRoot;
}

/**
 * Transforms a MATCH clause into a Match node
 * @param matchClause The MATCH clause to transform
 * @returns The transformed Match node
 */
function transformMatchClause(matchClause: MatchClause): MatchNode {
  const pathPatterns = matchClause.patterns.map(transformPathPattern);
  
  return u('match', {
    children: pathPatterns
  }) as MatchNode;
}

/**
 * Transforms a WHERE clause into a Where node
 * @param whereClause The WHERE clause to transform
 * @returns The transformed Where node
 */
function transformWhereClause(whereClause: WhereClause): WhereNode {
  const condition = transformExpression(whereClause.condition);
  
  return u('where', {
    children: [condition]
  }) as WhereNode;
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
  
  return u('create', {
    children: patterns
  }) as CreateNode;
}

/**
 * Transforms a SET clause into a Set node
 * @param setClause The SET clause to transform
 * @returns The transformed Set node
 */
function transformSetClause(setClause: SetClause): SetNode {
  const settings = setClause.settings.map(transformPropertySetting);
  
  return u('set', {
    children: settings
  }) as SetNode;
}

/**
 * Transforms a path pattern into a PathPattern node
 * @param pathPattern The path pattern to transform
 * @returns The transformed PathPattern node
 */
function transformPathPattern(pathPattern: PathPattern): PathPatternNode {
  const startNode = transformNodePattern(pathPattern.start);
  const segments = pathPattern.segments.map(segment => {
    return u('relationshipSegment', {
      children: [
        transformRelationshipPattern(segment.relationship),
        transformNodePattern(segment.node)
      ]
    }) as RelationshipSegmentNode;
  });
  
  return u('pathPattern', {
    children: [startNode, ...segments]
  }) as PathPatternNode;
}

/**
 * Transforms a node pattern into a NodePattern node
 * @param nodePattern The node pattern to transform
 * @returns The transformed NodePattern node
 */
function transformNodePattern(nodePattern: NodePattern): NodePatternNode {
  return u('nodePattern', {
    variable: nodePattern.variable,
    labels: nodePattern.labels,
    properties: nodePattern.properties
  }) as NodePatternNode;
}

/**
 * Transforms a relationship pattern into a RelationshipPattern node
 * @param relationshipPattern The relationship pattern to transform
 * @returns The transformed RelationshipPattern node
 */
function transformRelationshipPattern(relationshipPattern: RelationshipPattern): RelationshipPatternNode {
  return u('relationshipPattern', {
    variable: relationshipPattern.variable,
    relType: relationshipPattern.type,
    direction: relationshipPattern.direction,
    properties: relationshipPattern.properties,
    minHops: relationshipPattern.minHops,
    maxHops: relationshipPattern.maxHops
  }) as RelationshipPatternNode;
}

/**
 * Transforms a CREATE node pattern into a CreateNodePattern node
 * @param nodePattern The node pattern to transform
 * @returns The transformed CreateNodePattern node
 */
function transformCreateNodePattern(nodePattern: NodePattern): CreateNodePatternNode {
  return u('createNode', {
    variable: nodePattern.variable,
    labels: nodePattern.labels,
    properties: nodePattern.properties
  }) as CreateNodePatternNode;
}

/**
 * Transforms a CREATE relationship pattern into a CreateRelationshipPattern node
 * @param createRelationship The CREATE relationship pattern to transform
 * @returns The transformed CreateRelationshipPattern node
 */
function transformCreateRelationshipPattern(createRelationship: any): CreateRelPatternNode {
  return u('createRelationship', {
    fromVar: createRelationship.fromNode.name,
    toVar: createRelationship.toNode.name,
    relationship: {
      variable: createRelationship.relationship.variable,
      relType: createRelationship.relationship.type,
      direction: createRelationship.relationship.direction,
      properties: createRelationship.relationship.properties
    }
  }) as CreateRelPatternNode;
}

/**
 * Transforms a property setting into a PropertySetting node
 * @param propertySetting The property setting to transform
 * @returns The transformed PropertySetting node
 */
function transformPropertySetting(propertySetting: any): PropertySettingNode {
  return u('propertySetting', {
    target: propertySetting.target.name,
    property: propertySetting.property,
    value: transformExpression(propertySetting.value)
  }) as PropertySettingNode;
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
  return u('literalExpression', {
    value: literalExpression.value,
    dataType: literalExpression.dataType
  }) as LiteralExpressionNode;
}

/**
 * Transforms a variable expression into a VariableExpression node
 * @param variableExpression The variable expression to transform
 * @returns The transformed VariableExpression node
 */
function transformVariableExpression(variableExpression: VariableExpression): VariableExpressionNode {
  return u('variableExpression', {
    name: variableExpression.name
  }) as VariableExpressionNode;
}

/**
 * Transforms a property expression into a PropertyExpression node
 * @param propertyExpression The property expression to transform
 * @returns The transformed PropertyExpression node
 */
function transformPropertyExpression(propertyExpression: PropertyExpression): PropertyExpressionNode {
  return u('propertyExpression', {
    object: propertyExpression.object.name,
    property: propertyExpression.property
  }) as PropertyExpressionNode;
}

/**
 * Transforms a comparison expression into a ComparisonExpression node
 * @param comparisonExpression The comparison expression to transform
 * @returns The transformed ComparisonExpression node
 */
function transformComparisonExpression(comparisonExpression: ComparisonExpression): ComparisonExpressionNode {
  const left = transformExpression(comparisonExpression.left);
  const right = transformExpression(comparisonExpression.right);
  
  return u('comparisonExpression', {
    operator: comparisonExpression.operator,
    children: [left, right]
  }) as ComparisonExpressionNode;
}

/**
 * Transforms a logical expression into a LogicalExpression node
 * @param logicalExpression The logical expression to transform
 * @returns The transformed LogicalExpression node
 */
function transformLogicalExpression(logicalExpression: LogicalExpression): LogicalExpressionNode {
  const operands = logicalExpression.operands.map(transformExpression);
  
  return u('logicalExpression', {
    operator: logicalExpression.operator,
    children: operands
  }) as LogicalExpressionNode;
}

/**
 * Transforms an exists expression into an ExistsExpression node
 * @param existsExpression The exists expression to transform
 * @returns The transformed ExistsExpression node
 */
function transformExistsExpression(existsExpression: ExistsExpression): ExistsExpressionNode {
  const pattern = transformPathPattern(existsExpression.pattern);
  
  return u('existsExpression', {
    positive: existsExpression.positive,
    children: [pattern]
  }) as ExistsExpressionNode;
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