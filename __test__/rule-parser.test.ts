import { parseRuleFromMarkdown, extractRulesFromMarkdown } from '../src/rules/rule-parser';
import { Rule } from '../src/rules/types';

describe('Rule Parser', () => {
  describe('parseRuleFromMarkdown', () => {
    it('should extract a valid rule from markdown', () => {
      const markdown = '```graphrule\nname: TestRule\ndescription: This is a test rule\npriority: 50\n\nMATCH (n:Task)\nWHERE n.completed = false\nSET n.status = "in-progress"\n```';
      
      const rule = parseRuleFromMarkdown(markdown);
      
      expect(rule).toBeDefined();
      expect(rule.name).toBe('TestRule');
      expect(rule.description).toBe('This is a test rule');
      expect(rule.priority).toBe(50);
      expect(rule.disabled).toBe(undefined);
      expect(rule.ruleText).toBe('MATCH (n:Task)\nWHERE n.completed = false\nSET n.status = "in-progress"');
      expect(rule.markdown).toBe(markdown);
    });
    
    it('should extract a rule with disabled flag', () => {
      const markdown = '```graphrule\nname: DisabledRule\ndescription: This is a disabled rule\npriority: 30\ndisabled: true\n\nMATCH (n:Task)\nSET n.status = "ignored"\n```';
      
      const rule = parseRuleFromMarkdown(markdown);
      
      expect(rule).toBeDefined();
      expect(rule.name).toBe('DisabledRule');
      expect(rule.disabled).toBe(true);
      expect(rule.ruleText).toBe('MATCH (n:Task)\nSET n.status = "ignored"');
    });
    
    it('should throw an error if required metadata is missing', () => {
      const missingName = '```graphrule\ndescription: Missing name\npriority: 50\n\nMATCH (n)\n```';
      const missingDescription = '```graphrule\nname: MissingDesc\npriority: 50\n\nMATCH (n)\n```';
      const missingPriority = '```graphrule\nname: MissingPriority\ndescription: No priority\n\nMATCH (n)\n```';
      
      expect(() => parseRuleFromMarkdown(missingName)).toThrow(/name/i);
      expect(() => parseRuleFromMarkdown(missingDescription)).toThrow(/description/i);
      expect(() => parseRuleFromMarkdown(missingPriority)).toThrow(/priority/i);
    });
    
    it('should throw an error if no rule text is provided', () => {
      const noRuleText = '```graphrule\nname: EmptyRule\ndescription: No rule text\npriority: 10\n\n```';
      
      expect(() => parseRuleFromMarkdown(noRuleText)).toThrow(/rule text/i);
    });
    
    it('should throw an error if the markdown does not contain a graphrule block', () => {
      const wrongBlock = '```javascript\nfunction test() {}\n```';
      const noCodeBlock = 'Just some plain markdown text';
      
      expect(() => parseRuleFromMarkdown(wrongBlock)).toThrow(/graphrule/i);
      expect(() => parseRuleFromMarkdown(noCodeBlock)).toThrow(/graphrule/i);
    });
    
    it('should allow custom code block types', () => {
      const markdown = '```custom-rule\nname: CustomRule\ndescription: Custom block type\npriority: 20\n\nMATCH (n)\n```';
      
      const rule = parseRuleFromMarkdown(markdown, { codeBlockType: 'custom-rule' });
      
      expect(rule).toBeDefined();
      expect(rule.name).toBe('CustomRule');
    });
    
    it('should extract a rule with multiple line rule text', () => {
      const markdown = 
`\`\`\`graphrule
name: ComplexRule
description: Rule with multiple lines
priority: 100

MATCH (parent:listItem {isTask: true})
-[:renders]->(:list)
-[:renders]->(child:listItem {isTask: true})
WHERE NOT EXISTS((parent)-[:dependsOn]->(child))
CREATE (parent)-[:dependsOn {auto: true}]->(child)
\`\`\``;
      
      const rule = parseRuleFromMarkdown(markdown);
      
      expect(rule).toBeDefined();
      expect(rule.name).toBe('ComplexRule');
      expect(rule.ruleText).toBe(
        'MATCH (parent:listItem {isTask: true})\n' +
        '-[:renders]->(:list)\n' +
        '-[:renders]->(child:listItem {isTask: true})\n' +
        'WHERE NOT EXISTS((parent)-[:dependsOn]->(child))\n' +
        'CREATE (parent)-[:dependsOn {auto: true}]->(child)'
      );
    });
  });

  describe('extractRulesFromMarkdown', () => {
    it('should extract multiple rules from a document', () => {
      const markdown = `
# Test Document

Here's a simple rule:

\`\`\`graphrule
name: Rule1
description: First rule
priority: 100

MATCH (n:Task)
SET n.processed = true
\`\`\`

And here's another one:

\`\`\`graphrule
name: Rule2
description: Second rule
priority: 50

MATCH (n:Project)
SET n.status = "active"
\`\`\`
`;

      const rules = extractRulesFromMarkdown(markdown);
      
      expect(rules).toHaveLength(2);
      expect(rules[0].name).toBe('Rule1');
      expect(rules[1].name).toBe('Rule2');
    });

    it('should skip invalid rules and extract valid ones', () => {
      const markdown = `
\`\`\`graphrule
name: ValidRule
description: This is valid
priority: 75

MATCH (n)
SET n.valid = true
\`\`\`

\`\`\`graphrule
name: InvalidRule
description: Missing priority

MATCH (n)
\`\`\`

\`\`\`graphrule
name: AnotherValidRule
description: Also valid
priority: 25

MATCH (n)
SET n.anotherValid = true
\`\`\`
`;

      // Temporarily disable console.warn
      const originalWarn = console.warn;
      console.warn = () => {}; // Simple no-op function

      const rules = extractRulesFromMarkdown(markdown);
      
      // Restore console.warn
      console.warn = originalWarn;
      
      expect(rules).toHaveLength(2);
      expect(rules[0].name).toBe('ValidRule');
      expect(rules[1].name).toBe('AnotherValidRule');
    });

    it('should extract rules with custom code block type', () => {
      const markdown = `
\`\`\`custom-rule
name: CustomRule1
description: Using custom block type
priority: 40

MATCH (n)
\`\`\`

\`\`\`graphrule
name: RegularRule
description: Using standard block type
priority: 30

MATCH (n)
\`\`\`
`;

      const customRules = extractRulesFromMarkdown(markdown, { codeBlockType: 'custom-rule' });
      expect(customRules).toHaveLength(1);
      expect(customRules[0].name).toBe('CustomRule1');
      
      const standardRules = extractRulesFromMarkdown(markdown);
      expect(standardRules).toHaveLength(1);
      expect(standardRules[0].name).toBe('RegularRule');
    });

    it('should return an empty array if no rules are found', () => {
      const markdown = '# Document with no rules';
      
      const rules = extractRulesFromMarkdown(markdown);
      
      expect(rules).toHaveLength(0);
    });
  });
});