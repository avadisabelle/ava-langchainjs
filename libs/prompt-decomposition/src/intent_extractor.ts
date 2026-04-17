/**
 * Intent Extractor
 *
 * Extracts primary and secondary intents from a prompt,
 * following the PDE (Prompt Decomposition Engine) structure:
 * - Primary intent: single action-target-urgency-confidence tuple
 * - Secondary intents: multiple action items with dependency mapping,
 *   implicit/explicit classification, and confidence scoring
 *
 * This is the EAST (Vision) function of PDE — clarifying what is being asked.
 */

import { v4 as uuid } from "uuid";
import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import { z } from "zod";

// =============================================================================
// Types
// =============================================================================

export enum Urgency {
  IMMEDIATE = "immediate",
  SESSION = "session",
  SPRINT = "sprint",
  ONGOING = "ongoing",
}

export interface PrimaryIntent {
  action: string;
  target: string;
  urgency: Urgency;
  confidence: number; // 0-1
}

export interface SecondaryIntent {
  id: string;
  action: string;
  target: string;
  implicit: boolean;
  dependency: string | null; // ID of another secondary intent
  confidence: number;
}

export interface IntentExtractionResult {
  id: string;
  timestamp: string;
  prompt: string;
  primary: PrimaryIntent;
  secondary: SecondaryIntent[];
  context: ExtractionContext;
}

export interface ExtractionContext {
  filesNeeded: string[];
  toolsRequired: string[];
  assumptions: string[];
}

// Action verb categories for classification
const ACTION_VERBS: Record<string, string[]> = {
  create: ["create", "build", "make", "generate", "write", "develop", "design", "scaffold", "initialize", "init", "implement"],
  modify: ["modify", "update", "change", "edit", "adjust", "refactor", "rename", "move", "restructure"],
  investigate: ["investigate", "research", "explore", "understand", "learn", "study", "analyze", "examine", "look", "check", "review", "see"],
  add: ["add", "install", "include", "import", "integrate", "connect", "wire", "attach", "link"],
  remove: ["remove", "delete", "clean", "prune", "drop", "uninstall"],
  test: ["test", "verify", "validate", "ensure", "confirm", "check", "assert"],
  deploy: ["deploy", "ship", "publish", "release", "push", "launch"],
  manage: ["manage", "organize", "coordinate", "orchestrate", "maintain", "handle"],
  use: ["use", "leverage", "utilize", "employ", "apply", "run", "execute"],
  draft: ["draft", "outline", "plan", "sketch", "propose", "document"],
};

const URGENCY_KEYWORDS: Record<Urgency, string[]> = {
  [Urgency.IMMEDIATE]: ["now", "immediately", "urgent", "asap", "right away", "quickly"],
  [Urgency.SESSION]: ["today", "this session", "let's", "get to work", "start"],
  [Urgency.SPRINT]: ["this week", "sprint", "soon", "next", "upcoming"],
  [Urgency.ONGOING]: ["eventually", "someday", "long-term", "future", "ongoing", "continuous"],
};

// =============================================================================
// IntentExtractor
// =============================================================================

// Zod schema for LLM output validation
const SecondaryIntentSchema = z.object({
  action: z.string().describe("The primary verb or action from the prompt. Must be one of: create, modify, investigate, add, remove, test, deploy, manage, use, draft."),
  target: z.string().describe("The object or goal of the action."),
  implicit: z.boolean().describe("True if this intent was implied rather than explicitly stated. Defaults to false."),
  dependency: z.string().nullable().describe("The ID of another secondary intent that this intent depends on. Set to null if no dependency is found."),
  confidence: z.number().min(0).max(1).describe("Confidence score (0-1) that this intent is correct and actionable."),
  id: z.string().optional().describe("Unique identifier for this intent."),
});

const IntentExtractionResultSchema = z.object({
  primary: z.object({
    action: z.string().describe("The primary verb or action for the main goal. Must be one of: create, modify, investigate, add, remove, test, deploy, manage, use, draft."),
    target: z.string().describe("The object or goal of the main action."),
    urgency: z.nativeEnum(Urgency).describe("The detected urgency of the primary intent. One of: immediate, session, sprint, ongoing."),
    confidence: z.number().min(0).max(1).describe("Confidence score (0-1) in the primary intent."),
  }),
  secondary: z.array(SecondaryIntentSchema).describe("A list of secondary, detailed intents extracted from the prompt, each with a unique ID."),
  context: z.object({
    filesNeeded: z.array(z.string()).describe("List of file paths or references mentioned in the prompt (e.g., /src/file.ts, @package/module)."),
    toolsRequired: z.array(z.string()).describe("List of tools or external systems mentioned as required (e.g., 'git', 'docker', 'npm')."),
    assumptions: z.array(z.string()).describe("List of assumptions made or explicit assumptions stated in the prompt."),
  }),
});

export interface ExtractorOptions {
  extractImplicit?: boolean; // Default true
  mapDependencies?: boolean; // Default true
  llm?: BaseLanguageModel; // Optional LLM for enhanced extraction
}

export class IntentExtractor {
  private readonly extractImplicit: boolean;
  private readonly mapDependencies: boolean;
  private readonly llm?: BaseLanguageModel;

  constructor(options?: ExtractorOptions) {
    this.extractImplicit = options?.extractImplicit ?? true;
    this.mapDependencies = options?.mapDependencies ?? true;
    this.llm = options?.llm;
  }

  /**
   * Extract intents from a prompt.
   * Returns a structured result with primary + secondary intents.
   */
  async extract(prompt: string): Promise<IntentExtractionResult> {
    const id = uuid();
    const timestamp = new Date().toISOString();
    const context = this.extractContext(prompt);

    if (this.llm) {
      try {
        const llmResult = await this._extractIntentsWithLLM(prompt);
        // Ensure IDs are generated for secondary intents if missing
        llmResult.secondary.forEach((s) => {
          if (!s.id) {
            s.id = uuid();
          }
          // Also ensure action is one of the valid ACTION_VERBS categories
          if (!Object.keys(ACTION_VERBS).includes(s.action)) {
            s.action = "investigate"; // Fallback to a safe default
          }
        });
        return {
          id,
          timestamp,
          prompt,
          primary: llmResult.primary,
          secondary: llmResult.secondary as SecondaryIntent[],
          context: llmResult.context ?? context,
        };
      } catch (e) {
        console.warn("LLM intent extraction failed, falling back to heuristics:", e);
        // Fallback to heuristic-based extraction on LLM failure
      }
    }

    const sentences = this.splitSentences(prompt);
    const rawIntents = this.extractRawIntents(sentences);

    // The primary intent is the one with highest confidence
    const primary = this.determinePrimary(rawIntents, prompt);

    // Remaining become secondary, with dependency mapping
    const secondary = this.buildSecondaryIntents(rawIntents);

    return {
      id,
      timestamp,
      prompt,
      primary,
      secondary,
      context,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private async _extractIntentsWithLLM(prompt: string): Promise<z.infer<typeof IntentExtractionResultSchema>> {
    if (!this.llm) {
      throw new Error("LLM not provided for LLM-based extraction.");
    }

    const schemaDescription = JSON.stringify({
      primary: { action: "string (one of action verbs)", target: "string", urgency: "immediate|session|sprint|ongoing", confidence: "number 0-1" },
      secondary: [{ id: "uuid", action: "string", target: "string", implicit: "boolean", dependency: "string|null", confidence: "number 0-1" }],
      context: { filesNeeded: ["string"], toolsRequired: ["string"], assumptions: ["string"] },
    }, null, 2);

    const systemPrompt = `You are an expert software engineer assistant specializing in breaking down complex user prompts into structured, actionable intents.
Your goal is to extract a primary intent, a list of secondary intents (sub-tasks), and relevant context (files, tools, assumptions).
Each intent should have an action (one of: ${Object.keys(ACTION_VERBS).join(", ")}), a target, a confidence score (0-1), and an optional dependency on another secondary intent by its ID.
Also identify if an intent is implicit (implied but not explicitly stated).
Assign a unique ID (UUID) to each secondary intent.
Determine the overall urgency of the primary intent.

Think step-by-step:
1. Identify the main goal or objective (Primary Intent).
2. Break down the main goal into smaller, discrete tasks (Secondary Intents).
3. For each secondary intent, identify its action, target, and estimate a confidence score.
4. Look for implicit tasks (e.g., "ensure quality" implies "test").
5. Determine if any secondary intents depend on others.
6. Extract any mentioned file paths, tool requirements, or explicit assumptions.
7. Return the result in JSON matching this schema:

${schemaDescription}

Ensure the JSON is perfectly valid and can be directly parsed. Do not include any additional text outside the JSON object.
`;

    const response = await (this.llm as any).invoke([
      ["system", systemPrompt],
      ["human", prompt],
    ]);

    const content = typeof response === "string"
      ? response
      : typeof response?.content === "string"
        ? response.content
        : String(response);

    let parsedResult;
    try {
      parsedResult = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse LLM response as JSON:", e);
      console.error("LLM response content:", content);
      throw new Error("LLM output was not valid JSON.");
    }

    const validationResult = IntentExtractionResultSchema.safeParse(parsedResult);
    if (!validationResult.success) {
      console.error("LLM output did not match schema:", validationResult.error);
      throw new Error("LLM output did not match expected schema.");
    }

    return validationResult.data;
  }

  private splitSentences(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+|\n+|,\s+(?=[A-Z])|;\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);
  }

  private extractRawIntents(
    sentences: string[]
  ): Array<{ action: string; target: string; confidence: number; implicit: boolean; sentence: string }> {
    const intents: Array<{
      action: string;
      target: string;
      confidence: number;
      implicit: boolean;
      sentence: string;
    }> = [];

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      let bestAction = "";
      let bestCategory = "";
      let found = false;

      for (const [category, verbs] of Object.entries(ACTION_VERBS)) {
        for (const verb of verbs) {
          if (lower.includes(verb)) {
            if (!found || verb.length > bestAction.length) {
              bestAction = verb;
              bestCategory = category;
              found = true;
            }
          }
        }
      }

      if (found) {
        // Extract target: everything after the action verb
        const verbIdx = lower.indexOf(bestAction);
        const afterVerb = sentence.substring(verbIdx + bestAction.length).trim();
        const target = afterVerb.replace(/^(the|a|an|this|that|our|your)\s+/i, "",).trim();

        intents.push({
          action: bestCategory,
          target: target || sentence,
          confidence: this.calculateConfidence(sentence, bestAction),
          implicit: false,
          sentence,
        });
      }
    }

    // Extract implicit intents if enabled
    if (this.extractImplicit) {
      const implicitIntents = this.findImplicitIntents(sentences, intents);
      intents.push(...implicitIntents);
    }

    return intents;
  }

  private findImplicitIntents(
    sentences: string[],
    explicitIntents: Array<{ action: string; target: string; confidence: number; implicit: boolean; sentence: string }>
  ): Array<{ action: string; target: string; confidence: number; implicit: boolean; sentence: string }> {
    const implicit: Array<{
      action: string;
      target: string;
      confidence: number;
      implicit: boolean;
      sentence: string;
    }> = [];

    // Pattern: "which" clauses imply investigation
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      if (lower.includes("which") && !explicitIntents.some((i) => i.sentence === sentence)) {
        implicit.push({
          action: "investigate",
          target: sentence,
          confidence: 0.6,
          implicit: true,
          sentence,
        });
      }
    }

    // Pattern: conditional ("if", "when") implies validation need
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      if (
        (lower.startsWith("if ") || lower.includes(" if ") || lower.includes("when ")) &&
        !explicitIntents.some((i) => i.sentence === sentence)
      ) {
        implicit.push({
          action: "test",
          target: sentence,
          confidence: 0.5,
          implicit: true,
          sentence,
        });
      }
    }

    // Pattern: hedging language implies implicit intent (from mcp-pde lineage)
    // Detects: "I assume", "I expect", "you will need", "probably", "somehow", "should"
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      if (explicitIntents.some((i) => i.sentence === sentence)) continue;
      if (implicit.some((i) => i.sentence === sentence)) continue;

      if (/i assume|which i assume|assuming/.test(lower)) {
        implicit.push({
          action: "investigate",
          target: sentence,
          confidence: 0.5,
          implicit: true,
          sentence,
        });
      } else if (/i expect|expecting|you will need/.test(lower)) {
        implicit.push({
          action: "investigate",
          target: sentence,
          confidence: 0.55,
          implicit: true,
          sentence,
        });
      } else if (/\bsomehow\b/.test(lower)) {
        implicit.push({
          action: "investigate",
          target: sentence,
          confidence: 0.4,
          implicit: true,
          sentence,
        });
      } else if (/\bprobably\b|\bshould\b(?!\s+not)/.test(lower) &&
                 !explicitIntents.some((i) => i.sentence === sentence)) {
        implicit.push({
          action: "investigate",
          target: sentence,
          confidence: 0.45,
          implicit: true,
          sentence,
        });
      }
    }

    return implicit;
  }

  private determinePrimary(
    rawIntents: Array<{ action: string; target: string; confidence: number }>,
    prompt: string
  ): PrimaryIntent {
    if (rawIntents.length === 0) {
      return {
        action: "investigate",
        target: prompt.substring(0, 100),
        urgency: this.detectUrgency(prompt),
        confidence: 0.5,
      };
    }

    // Sort by confidence, pick highest
    const sorted = [...rawIntents].sort((a, b) => b.confidence - a.confidence);
    const top = sorted[0];

    return {
      action: top.action,
      target: top.target.substring(0, 200),
      urgency: this.detectUrgency(prompt),
      confidence: top.confidence,
    };
  }

  private buildSecondaryIntents(
    rawIntents: Array<{ action: string; target: string; confidence: number; implicit: boolean }>
  ): SecondaryIntent[] {
    const secondaries: SecondaryIntent[] = rawIntents.map((raw) => ({
      id: uuid(),
      action: raw.action,
      target: raw.target.substring(0, 300),
      implicit: raw.implicit,
      dependency: null,
      confidence: raw.confidence,
    }));

    // Map dependencies if enabled
    if (this.mapDependencies && secondaries.length > 1) {
      this.inferDependencies(secondaries);
    }

    return secondaries;
  }

  private inferDependencies(intents: SecondaryIntent[]): void {
    // Investigation before creation
    const investigations = intents.filter((i) => i.action === "investigate");
    const creations = intents.filter((i) =>
      ["create", "add", "modify"].includes(i.action)
    );

    for (const creation of creations) {
      for (const inv of investigations) {
        if (this.targetsOverlap(inv.target, creation.target)) {
          creation.dependency = inv.id;
          break;
        }
      }
    }

    // Testing after creation
    const tests = intents.filter((i) => i.action === "test");
    for (const test of tests) {
      for (const creation of creations) {
        if (this.targetsOverlap(creation.target, test.target)) {
          test.dependency = creation.id;
          break;
        }
      }
    }

    // Deploy after test
    const deploys = intents.filter((i) => i.action === "deploy");
    for (const deploy of deploys) {
      if (tests.length > 0) {
        deploy.dependency = tests[tests.length - 1].id;
      } else if (creations.length > 0) {
        deploy.dependency = creations[creations.length - 1].id;
      }
    }
  }

  private targetsOverlap(a: string, b: string): boolean {
    const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
    const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
    let overlap = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) overlap++;
    }
    return overlap >= 1;
  }

  private detectUrgency(prompt: string): Urgency {
    const lower = prompt.toLowerCase();
    for (const [urgency, keywords] of Object.entries(URGENCY_KEYWORDS) as Array<
      [Urgency, string[]]
    >) {
      for (const kw of keywords) {
        if (lower.includes(kw)) return urgency;
      }
    }
    return Urgency.SESSION;
  }

  private calculateConfidence(sentence: string, verb: string): number {
    const lower = sentence.toLowerCase();
    let confidence = 0.7;

    // Boost for imperative voice
    if (lower.startsWith(verb)) confidence += 0.15;

    // Boost for specific targets (paths, names)
    if (/\/[a-z]/.test(lower) || /@[a-z]/.test(lower)) confidence += 0.1;

    // Reduce for hedging language
    if (/maybe|perhaps|could|might|possibly/.test(lower)) confidence -= 0.2;

    return Math.min(1, Math.max(0.1, confidence));
  }

  private extractContext(prompt: string): ExtractionContext {
    const filesNeeded: string[] = [];
    const toolsRequired: string[] = [];
    const assumptions: string[] = [];

    // Extract file paths
    const pathMatches = prompt.match(/(?:\/[\w.-]+)+\/?/g);
    if (pathMatches) {
      filesNeeded.push(...new Set(pathMatches));
    }

    // Extract @-references
    const atRefs = prompt.match(/@[\w./-]+/g);
    if (atRefs) {
      filesNeeded.push(...atRefs.map((r) => r.substring(1)));
    }

    // Extract tool references
    const toolPatterns = /(?:mcp|tool|use)\s+(\S+)/gi;
    let match;
    while ((match = toolPatterns.exec(prompt)) !== null) {
      toolsRequired.push(match[1]);
    }

    // Extract assumptions from hedging language (mcp-pde lineage)
    const sentences = prompt.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.length > 5);
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      if (/i assume|i expect|i know that|which i assume|assuming that/.test(lower)) {
        assumptions.push(sentence.trim());
      } else if (/\bprobably\b|\bsomehow\b|\bshould\b/.test(lower) && lower.length < 200) {
        assumptions.push(sentence.trim());
      }
    }

    return { filesNeeded, toolsRequired, assumptions };
  }
}
