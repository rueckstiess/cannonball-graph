import {
  ASTRuleRoot,
  ASTCreateNodePatternNode,
  ASTCreateRelPatternNode,
  ASTPropertySettingNode,
  ASTDeleteNode // <-- Import ASTDeleteNode
} from '@/lang/ast-transformer';
import {
  RuleAction,
  ActionFactory as IActionFactory,
  CreateNodeAction as ICreateNodeAction,
  CreateRelationshipAction as ICreateRelationshipAction,
  SetPropertyAction as ISetPropertyAction,
  DeleteAction as IDeleteAction // <-- Import IDeleteAction
} from './rule-action';
import { CreateNodeAction } from './create-node-action';
import { CreateRelationshipAction } from './create-relationship-action';
import { SetPropertyAction } from './set-property-action';
import { DeleteAction } from './delete-action'; // <-- Import DeleteAction implementation
import { ConditionEvaluator } from '@/lang/condition-evaluator';

/**
 * Implementation of the ActionFactory interface
 */
export class ActionFactory<NodeData = any, EdgeData = any>
  implements IActionFactory<NodeData, EdgeData> {

  private conditionEvaluator: ConditionEvaluator<NodeData, EdgeData>;

  /**
   * Creates a new ActionFactory
   * 
   * @param conditionEvaluator Optional condition evaluator for evaluating expressions
   */
  constructor(conditionEvaluator?: ConditionEvaluator<NodeData, EdgeData>) {
    this.conditionEvaluator = conditionEvaluator || new ConditionEvaluator<NodeData, EdgeData>();
  }

  /**
   * Creates a CreateNodeAction from an AST node
   */
  createNodeActionFromAst(
    createNodeAst: ASTCreateNodePatternNode
  ): ICreateNodeAction<NodeData, EdgeData> {
    return new CreateNodeAction<NodeData, EdgeData>(
      createNodeAst.variable || '_anonymous_node_' + Math.random().toString(36).substring(2, 10),
      createNodeAst.labels,
      createNodeAst.properties
    );
  }

  /**
   * Creates a CreateRelationshipAction from an AST node
   */
  createRelationshipActionFromAst(
    createRelAst: ASTCreateRelPatternNode
  ): ICreateRelationshipAction<NodeData, EdgeData> {
    return new CreateRelationshipAction<NodeData, EdgeData>(
      createRelAst.fromVar,
      createRelAst.toVar,
      createRelAst.relationship.relType || '_RELATED_TO_',
      createRelAst.relationship.properties || {},
      createRelAst.relationship.variable
    );
  }

  /**
   * Creates a SetPropertyAction from an AST node
   */
  setPropertyActionFromAst(
    setPropertyAst: ASTPropertySettingNode
  ): ISetPropertyAction<NodeData, EdgeData> {
    // Extract the property value
    let value: any;

    // For literal expressions in the AST, extract the value directly
    if (setPropertyAst.value.type === 'literalExpression') {
      value = setPropertyAst.value.value;
    } else {
      // For more complex expressions, we might need a more sophisticated approach
      // This is a simplified version that assumes the value is already processed
      value = setPropertyAst.value;

      // In a more complete implementation, we would use the conditionEvaluator
      // to evaluate expressions dynamically at runtime
    }

    return new SetPropertyAction<NodeData, EdgeData>(
      setPropertyAst.target,
      setPropertyAst.property,
      value
    );
  }

  /**
   * Creates a DeleteAction from an AST node
   */
  createDeleteActionFromAst(
    deleteAst: ASTDeleteNode
  ): IDeleteAction<NodeData, EdgeData> {
    return new DeleteAction<NodeData, EdgeData>(
      deleteAst.variables,
      deleteAst.detach
    );
  }

  /**
   * Creates actions from a rule AST
   */
  createActionsFromRuleAst(
    ruleAst: ASTRuleRoot
  ): RuleAction<NodeData, EdgeData>[] {
    const actions: RuleAction<NodeData, EdgeData>[] = [];

    // Process each child node in the rule AST
    for (const node of ruleAst.children) {
      if (node.type === 'create') {
        // Process CREATE clause
        for (const createPattern of node.children) {
          if (createPattern.type === 'createNode') {
            actions.push(this.createNodeActionFromAst(createPattern));
          } else if (createPattern.type === 'createRelationship') {
            actions.push(this.createRelationshipActionFromAst(createPattern));
          }
        }
      } else if (node.type === 'set') {
        // Process SET clause
        for (const setPattern of node.children) {
          actions.push(this.setPropertyActionFromAst(setPattern));
        }
      } else if (node.type === 'delete') { // <-- Add handling for delete
        // Process DELETE clause
        actions.push(this.createDeleteActionFromAst(node));
      }
      // MATCH and WHERE clauses are handled earlier in the pattern matching phase
    }

    return actions;
  }
}