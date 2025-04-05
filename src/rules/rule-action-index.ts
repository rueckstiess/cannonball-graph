// Export interfaces
export * from './rule-action';

// Import
import { ActionFactory } from './action-factory';
import { ActionExecutor } from './action-executor';

// Export implementations
export { CreateNodeAction } from './create-node-action';
export { CreateRelationshipAction } from './create-relationship-action';
export { SetPropertyAction } from './set-property-action';
export { ActionExecutor } from './action-executor';
export { ActionFactory } from './action-factory';

/**
 * Creates a new action factory
 * @returns A new ActionFactory instance
 */
export function createActionFactory<NodeData = any, EdgeData = any>() {
  return new ActionFactory<NodeData, EdgeData>();
}

/**
 * Creates a new action executor
 * @returns A new ActionExecutor instance
 */
export function createActionExecutor<NodeData = any, EdgeData = any>() {
  return new ActionExecutor<NodeData, EdgeData>();
}