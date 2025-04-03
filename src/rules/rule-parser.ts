import { Rule, RuleExtractionOptions } from "./types";

/**
 * Parses a graph rule from a markdown string.
 *
 * @param markdown - The markdown string containing the rule
 * @param options - Optional extraction options
 * @returns A Rule object
 * @throws Error if the rule is invalid or missing required metadata
 */
export function parseRuleFromMarkdown(
  markdown: string,
  options: RuleExtractionOptions = {},
): Rule {
  const codeBlockType = options.codeBlockType || "graphrule";
  const regex = new RegExp(`\`\`\`${codeBlockType}([\\s\\S]*?)\`\`\``);

  const match = regex.exec(markdown);
  if (!match) {
    throw new Error(
      `No ${codeBlockType} code block found in the provided markdown`,
    );
  }

  const blockContent = match[1].trim();
  const lines = blockContent.split("\n");

  // Extract metadata (lines before the first empty line)
  const metadata: Record<string, string | boolean | number> = {};
  let i = 0;

  while (i < lines.length && lines[i].trim() !== "") {
    const line = lines[i];
    const colonIndex = line.indexOf(":");

    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      // Convert values to appropriate types
      if (key === "priority") {
        metadata[key] = parseInt(value, 10);
        if (isNaN(metadata[key] as number)) {
          throw new Error(
            `Invalid priority value: ${value}. Must be a number.`,
          );
        }
      } else if (key === "disabled") {
        metadata[key] = value.toLowerCase() === "true";
      } else {
        metadata[key] = value;
      }
    }

    i++;
  }

  // Skip empty lines to find the rule text
  while (i < lines.length && lines[i].trim() === "") {
    i++;
  }

  // Extract rule text (all remaining lines)
  const ruleText = lines.slice(i).join("\n").trim();

  // Validate required metadata
  if (!metadata.name) {
    throw new Error("Rule is missing required metadata: name");
  }
  if (!metadata.description) {
    throw new Error("Rule is missing required metadata: description");
  }
  if (metadata.priority === undefined) {
    throw new Error("Rule is missing required metadata: priority");
  }

  // Validate rule text
  if (!ruleText) {
    throw new Error("Rule is missing rule text");
  }

  // Construct and return the Rule object
  return {
    name: metadata.name as string,
    description: metadata.description as string,
    priority: metadata.priority as number,
    disabled: metadata.disabled as boolean | undefined,
    ruleText,
    markdown,
  };
}

/**
 * Extracts all graph rules from a markdown document.
 *
 * @param markdown - The markdown document
 * @param options - Optional extraction options
 * @returns An array of Rule objects
 */
export function extractRulesFromMarkdown(
  markdown: string,
  options: RuleExtractionOptions = {},
): Rule[] {
  const codeBlockType = options.codeBlockType || "graphrule";
  const regex = new RegExp(`\`\`\`${codeBlockType}([\\s\\S]*?)\`\`\``, "g");

  const rules: Rule[] = [];
  let match;

  while ((match = regex.exec(markdown)) !== null) {
    const fullMatch = match[0];
    try {
      const rule = parseRuleFromMarkdown(fullMatch, options);
      rules.push(rule);
    } catch (error) {
      // Skip invalid rules or log them if needed
      console.warn("Skipping invalid rule:", error);
    }
  }

  return rules;
}
