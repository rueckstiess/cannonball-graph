/**
 * Represents a graph transformation rule in Cannonball.
 * Rules are defined in Markdown code blocks with graphrule type.
 */
export interface Rule {
  /**
   * Unique identifier for the rule
   */
  name: string;

  /**
   * Human-readable explanation of the rule's purpose
   */
  description: string;

  /**
   * Numeric priority (higher numbers run first)
   */
  priority: number;

  /**
   * Whether the rule is currently disabled
   */
  disabled?: boolean;

  /**
   * The raw rule text containing the Cypher-like query
   */
  ruleText: string;

  /**
   * The original markdown string from which this rule was parsed
   */
  markdown: string;
}

/**
 * Options for rule extraction
 */
export interface RuleExtractionOptions {
  /**
   * The type of code block to look for (default: "graphrule")
   */
  codeBlockType?: string;
}
