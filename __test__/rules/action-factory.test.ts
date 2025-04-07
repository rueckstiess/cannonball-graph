import { ActionFactory, CreateNodeAction, CreateRelationshipAction, SetPropertyAction, DeleteAction } from '@/query';
import {
  ASTRuleRoot,
  ASTCreateNodePatternNode,
  ASTCreateRelPatternNode,
  ASTPropertySettingNode,
  ASTDeleteNode,
  ASTSetNode,
  ASTCreateNode,
} from '@/lang/ast-transformer';

describe('ActionFactory', () => {
  let factory: ActionFactory;

  beforeEach(() => {
    factory = new ActionFactory();
  });

  test('should create a CreateNodeAction from an ASTCreateNodePatternNode', () => {
    const createNodeAst: ASTCreateNodePatternNode = {
      type: 'createNode',
      variable: 'n',
      labels: ['Person'],
      properties: { name: 'Alice', age: 30 }
    };

    const action = factory.createNodeActionFromAst(createNodeAst);

    expect(action).toBeInstanceOf(CreateNodeAction);
    expect(action.variable).toBe('n');
    expect(action.labels).toEqual(['Person']);
    expect(action.properties).toEqual({ name: 'Alice', age: 30 });
  });

  test('should create a CreateRelationshipAction from an ASTCreateRelPatternNode', () => {
    const createRelAst: ASTCreateRelPatternNode = {
      type: 'createRelationship',
      fromVar: 'a',
      toVar: 'b',
      relationship: {
        variable: 'r',
        relType: 'KNOWS',
        direction: 'outgoing',
        properties: { since: 2020 }
      }
    };

    const action = factory.createRelationshipActionFromAst(createRelAst);

    expect(action).toBeInstanceOf(CreateRelationshipAction);
    expect(action.fromVariable).toBe('a');
    expect(action.toVariable).toBe('b');
    expect(action.relType).toBe('KNOWS');
    expect(action.variable).toBe('r');
    expect(action.properties).toEqual({ since: 2020 });
  });

  test('should create a SetPropertyAction from an ASTPropertySettingNode', () => {
    const setPropertyAst: ASTPropertySettingNode = {
      type: 'propertySetting',
      target: 'n',
      property: 'age',
      value: {
        type: 'literalExpression',
        value: 30,
        dataType: 'number'
      }
    };

    const action = factory.setPropertyActionFromAst(setPropertyAst);

    expect(action).toBeInstanceOf(SetPropertyAction);
    expect(action.targetVariable).toBe('n');
    expect(action.propertyName).toBe('age');
    expect(action.value).toBe(30);
  });

  test('should create a DeleteAction from an ASTDeleteNode', () => {
    const deleteAst: ASTDeleteNode = {
      type: 'delete',
      variables: ['n', 'r'],
      detach: true
    };

    const action = factory.createDeleteActionFromAst(deleteAst);

    expect(action).toBeInstanceOf(DeleteAction);
    expect(action.variableNames).toEqual(['n', 'r']);
    expect(action.detach).toBe(true);
  });

  test('should include all actions in actions created from ASTRuleRoot', () => {
    const ruleAst: ASTRuleRoot = {
      type: 'rule',
      name: 'TestRule',
      description: 'Test rule with multiple actions',
      priority: 10,
      children: [
        {
          type: 'create',
          children: [
            {
              type: 'createNode',
              variable: 'n',
              labels: ['Person'],
              properties: { name: 'Alice' },
            } as ASTCreateNodePatternNode,
            {
              type: 'createRelationship',
              fromVar: 'n',
              toVar: 'm',
              relationship: {
                variable: 'r',
                relType: 'KNOWS',
                direction: 'outgoing',
                properties: { since: 2020 }
              }
            } as ASTCreateRelPatternNode
          ]
        } as ASTCreateNode,
        {
          type: 'set',
          children: [
            {
              type: 'propertySetting',
              target: 'n',
              property: 'age',
              value: {
                type: 'literalExpression',
                value: 30,
                dataType: 'number'
              }
            } as ASTPropertySettingNode
          ]
        } as ASTSetNode,
        {
          type: 'delete',
          variables: ['n'],
          detach: false
        } as ASTDeleteNode
      ]
    };

    const actions = factory.createActionsFromRuleAst(ruleAst);

    expect(actions).toHaveLength(4);

    const [createNodeAction, createRelAction, setPropertyAction, deleteAction] = actions;

    expect(createNodeAction).toBeInstanceOf(CreateNodeAction);
    expect((createNodeAction as CreateNodeAction).variable).toBe('n');

    expect(createRelAction).toBeInstanceOf(CreateRelationshipAction);
    expect((createRelAction as CreateRelationshipAction).fromVariable).toBe('n');
    expect((createRelAction as CreateRelationshipAction).toVariable).toBe('m');

    expect(setPropertyAction).toBeInstanceOf(SetPropertyAction);
    expect((setPropertyAction as SetPropertyAction).targetVariable).toBe('n');
    expect((setPropertyAction as SetPropertyAction).propertyName).toBe('age');

    expect(deleteAction).toBeInstanceOf(DeleteAction);
    expect((deleteAction as DeleteAction).variableNames).toEqual(['n']);
    expect((deleteAction as DeleteAction).detach).toBe(false);
  });
});
