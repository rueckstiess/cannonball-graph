import { Graph } from '@/graph';
import { 
  Rule, parseRuleFromMarkdown, extractRulesFromMarkdown, CypherParser 
} from '@/lang/rule-parser';
import { Lexer } from '@/lang/lexer';
import { transformToCypherAst } from '@/lang/ast-transformer';
import { PatternMatcherWithConditions } from '@/lang/pattern-matcher-with-conditions';
import { BindingContext } from '@/lang/condition-evaluator';
import { 
  ActionFactory, ActionExecutor, RuleAction, ActionExecutionOptions, ActionExecutionResult 
} from './rule-action-index';

/**
 * Options for rule execution
 */
export interface RuleExecutionOptions extends ActionExecutionOptions {
  /**
   * Maximum number of matches to process
   */
  maxMatches?: number;
}

/**
 * Result of rule execution
 */
export interface RuleExecutionResult<NodeData = any, EdgeData = any> {
  /**
   * The rule that was executed
   */
  rule: Rule;
  
  /**
   * Whether execution was successful
   */
  success: boolean;
  
  /**
   * Results from action execution
   */
  actionResults: ActionExecutionResult<NodeData, EdgeData>[];
  
  /**
   * Number of pattern matches found
   */
  matchCount: number;
  
  /**
   * Error message if execution failed
   */
  error?: string;
}

/**
 * Integrated rule engine that handles the complete flow from rule text to execution
 */
export class RuleEngine<NodeData = any, EdgeData = any> {
  private patternMatcher: PatternMatcherWithConditions<NodeData, EdgeData>;
  private actionFactory: ActionFactory<NodeData, EdgeData>;
  private actionExecutor: ActionExecutor<NodeData, EdgeData>;
  
  /**
   * Creates a new rule engine
   */
  constructor() {
    this.patternMatcher = new PatternMatcherWithConditions<NodeData, EdgeData>();
    this.actionFactory = new ActionFactory<NodeData, EdgeData>();
    this.actionExecutor = new ActionExecutor<NodeData, EdgeData>();
  }
  
  /**
   * Executes a rule on a graph
   * 
   * @param graph The graph to execute the rule on
   * @param rule The rule to execute
   * @param options Execution options
   * @returns Result of the rule execution
   */
  executeRule(
    graph: Graph<NodeData, EdgeData>,
    rule: Rule,
    options?: RuleExecutionOptions
  ): RuleExecutionResult<NodeData, EdgeData> {
    try {
      // 1. Parse the rule text to a CypherStatement
      const lexer = new Lexer();
      const parser = new CypherParser(lexer, rule.ruleText);
      const cypherStatement = parser.parse();
      
      const parseErrors = parser.getErrors();
      if (parseErrors.length > 0) {
        return {
          rule,
          success: false,
          actionResults: [],
          matchCount: 0,
          error: `Parse errors: ${parseErrors.join(', ')}`
        };
      }
      
      // 2. Transform to AST
      const ast = transformToCypherAst(
        cypherStatement,
        rule.name,
        rule.description,
        rule.priority,
        rule.disabled
      );
      
      // 3. Execute MATCH-WHERE to find pattern matches
      const matches: BindingContext<NodeData, EdgeData>[] = [];
      
      if (cypherStatement.match) {
        for (const pattern of cypherStatement.match.patterns) {
          const pathMatches = this.patternMatcher.findMatchingPathsWithCondition(
            graph,
            pattern,
            cypherStatement.where?.condition
          );
          
          // Convert path matches to binding contexts
          for (const path of pathMatches) {
            const bindings = new BindingContext<NodeData, EdgeData>();
            
            // Bind the starting node if it has a variable
            if (pattern.start.variable) {
              bindings.set(pattern.start.variable, path.nodes[0]);
            }
            
            // Bind segments (relationships and end nodes)
            for (let i = 0; i < pattern.segments.length; i++) {
              const segment = pattern.segments[i];
              
              if (segment.relationship.variable) {
                bindings.set(segment.relationship.variable, path.edges[i]);
              }
              
              if (segment.node.variable) {
                bindings.set(segment.node.variable, path.nodes[i + 1]);
              }
            }
            
            matches.push(bindings);
            
            // Limit matches if maxMatches is specified
            if (options?.maxMatches && matches.length >= options.maxMatches) {
              break;
            }
          }
        }
      } else {
        // If no MATCH clause, create a single empty binding context
        matches.push(new BindingContext<NodeData, EdgeData>());
      }
      
      // 4. Convert AST CREATE/SET clauses to actions
      const actions = this.actionFactory.createActionsFromRuleAst(ast);
      
      // 5. Execute actions for each match
      const actionResults: ActionExecutionResult<NodeData, EdgeData>[] = [];
      let allSuccessful = true;
      
      for (const match of matches) {
        const result = this.actionExecutor.executeActions(
          graph,
          actions,
          match,
          options
        );
        
        actionResults.push(result);
        
        if (!result.success) {
          allSuccessful = false;
        }
      }
      
      return {
        rule,
        success: allSuccessful,
        actionResults,
        matchCount: matches.length,
        error: allSuccessful ? undefined : 'Some actions failed during execution'
      };
    } catch (error: any) {
      return {
        rule,
        success: false,
        actionResults: [],
        matchCount: 0,
        error: error.message || String(error)
      };
    }
  }
  
  /**
   * Executes multiple rules on a graph in priority order (highest first)
   * 
   * @param graph The graph to execute the rules on
   * @param rules The rules to execute
   * @param options Execution options
   * @returns Results of rule execution
   */
  executeRules(
    graph: Graph<NodeData, EdgeData>,
    rules: Rule[],
    options?: RuleExecutionOptions
  ): RuleExecutionResult<NodeData, EdgeData>[] {
    // Sort rules by priority (highest first)
    const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);
    
    // Execute each rule
    const results: RuleExecutionResult<NodeData, EdgeData>[] = [];
    
    for (const rule of sortedRules) {
      // Skip disabled rules
      if (rule.disabled) {
        continue;
      }
      
      const result = this.executeRule(graph, rule, options);
      results.push(result);
      
      // Log execution for monitoring
      console.log(`Executed rule '${rule.name}': ${result.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`  - Matches: ${result.matchCount}`);
      console.log(`  - Actions executed: ${result.actionResults.reduce((sum, r) => sum + r.actionResults.length, 0)}`);
      
      if (result.error) {
        console.error(`  - Error: ${result.error}`);
      }
    }
    
    return results;
  }
  
  /**
   * Parse and execute rules from markdown
   * 
   * @param graph The graph to execute the rules on
   * @param markdown The markdown containing the rules
   * @param options Execution options
   * @returns Results of rule execution
   */
  executeRulesFromMarkdown(
    graph: Graph<NodeData, EdgeData>,
    markdown: string,
    options?: RuleExecutionOptions
  ): RuleExecutionResult<NodeData, EdgeData>[] {
    const rules = extractRulesFromMarkdown(markdown);
    return this.executeRules(graph, rules, options);
  }
}

/**
 * Creates a new rule engine
 * @returns A new RuleEngine instance
 */
export function createRuleEngine<NodeData = any, EdgeData = any>(): RuleEngine<NodeData, EdgeData> {
  return new RuleEngine<NodeData, EdgeData>();
}