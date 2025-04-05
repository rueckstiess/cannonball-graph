 Phase 1: Remove Legacy Interfaces and Methods from rule-engine.ts

  Step 1.1: Remove the QueryResult interface

  - Delete the interface definition (lines 157-183)
  - This interface is replaced by the GraphQueryResult interface

  Step 1.2: Remove Legacy Fields in RuleExecutionResult

  - Remove the deprecated queryResults field from the interface (lines 217-221)
  - Update any implementations that use this field to use GraphQueryResult.query instead

  Step 1.3: Remove Deprecated Methods

  - Remove executeQuery() method (lines 389-436)
  - Remove executeRule() method (lines 447-491)
  - Remove executeRules() method (lines 787-818)
  - Remove executeQueryFromMarkdown() method (lines 918-970)
  - Remove executeRulesFromMarkdown() method (lines 846-853)
  - Remove extractQueryResults() private helper method (lines 682-694)

  Phase 2: Update Formatter and Utils Classes

  Step 2.1: Update QueryFormatter Class

  - Remove all type union parameters (GraphQueryResult | QueryResult) to just GraphQueryResult
    - Update parameter types in toMarkdownTable, toJson, and toTextTable methods
  - Remove all legacy format handling code:
    - Remove code blocks that check for 'query' in result and handle the legacy format
    - Remove the legacy QueryResult type casting blocks
  - Update private methods to simplify them since they now only handle one data structure

  Step 2.2: Update QueryUtils Class

  - Remove all type union parameters (GraphQueryResult | QueryResult) to just GraphQueryResult
    - Update parameter types in extractColumn, toObjectArray, extractNodes, extractEdges, etc.
  - Remove all legacy format handling code:
    - Remove code blocks that check for 'query' in result and handle the legacy format
    - Remove the legacy QueryResult type casting blocks
  - Remove combineQueryResults() deprecated method (lines 486-527)
  - Update implementation of combineResults() to only handle GraphQueryResult objects

  Phase 3: Update Test Files

  Step 3.1: Update rule-engine.test.ts

  - Replace any calls to deprecated methods with their new equivalents:
    - executeQuery() → executeGraphQuery()
    - executeRule() → executeGraphQuery()
    - executeRules() → executeGraphQueries()

  Step 3.2: Update rule-engine-query.test.ts

  - Ensure all tests use executeGraphQuery() instead of any legacy methods
  - Update test expectations to check for GraphQueryResult structure instead of QueryResult

  Step 3.3: Update query-api.test.ts

  - Remove tests for deprecated methods if they exist
  - Update all remaining tests to use executeGraphQuery() and GraphQueryResult
  - Ensure QueryFormatter and QueryUtils tests are updated to only use GraphQueryResult

  Phase 4: Documentation and Examples

  Step 4.1: Update JSDoc Comments

  - Remove @deprecated tags and mentions
  - Update examples in JSDoc comments to use executeGraphQuery instead of executeQuery
  - Update parameter and return type documentation

  Step 4.2: Update Examples

  - Check examples in src/examples/ directory and update any that use legacy APIs
  - Replace any example code that uses QueryResult with GraphQueryResult

  Phase 5: Final Verification

  Step 5.1: Run Tests

  - Execute npm run test to verify all tests pass with the updated code

  Step 5.2: TypeScript Checks

  - Run npm run build to verify TypeScript compilation works without errors

  Step 5.3: Code Audit

  - Search for 'QueryResult' across the codebase to ensure all instances are removed
  - Search for all deprecated method names to ensure they're completely removed
  - Check for any remaining imports or references to the removed interfaces

  This detailed breakdown provides a systematic approach to completely removing the legacy query APIs while ensuring the codebase remains functional with the unified
  API.
