Refactoring Plan: Complete Removal of Legacy Query APIs

  You're right - since this package isn't released yet, we can make more aggressive changes. Here's a plan to completely remove the legacy query interfaces:

  Phase 1: Identify and Remove All Legacy Interfaces

  1. Remove these interfaces from rule-engine.ts:
    - QueryResult
    - Legacy fields in RuleExecutionResult (queryResults)
  2. Remove these deprecated methods from RuleEngine class:
    - executeQuery()
    - executeRule()
    - executeRules()
    - executeQueryFromMarkdown()
    - executeRulesFromMarkdown()
    - extractQueryResults() (private helper)

  Phase 2: Update Formatter and Utils Classes

  1. Update QueryFormatter to only support GraphQueryResult:
    - Remove overloaded methods that accept QueryResult
    - Update implementation to only work with GraphQueryResult
  2. Update QueryUtils to only support GraphQueryResult:
    - Remove overloaded methods that accept QueryResult
    - Update implementation to only work with GraphQueryResult

  Phase 3: Clean Up All Test Files

  1. Update all references in test files to only use the unified API:
    - Replace any remaining references to removed methods
    - Ensure all expected result structures are updated

  Phase 4: Documentation and Examples

  1. Update documentation to only reference the new API:
    - Remove deprecated method mentions in JSDoc
    - Update examples to only show the new patterns
  2. Create clean examples without legacy API references

  Phase 5: Final Verification

  1. Run all tests to ensure everything works
  2. Run TypeScript checks to ensure no type errors
  3. Verify that no references to old interfaces remain

  This approach will give us a clean codebase with only the new unified query interface.