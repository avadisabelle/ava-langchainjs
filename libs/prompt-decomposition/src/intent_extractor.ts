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
  create: ["create", "build", "make", "generate", "write", "develop", "design", "scaffold", "initialize", "init"],
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

export interface ExtractorOptions {
  extractImplicit?: boolean; // Default true
  mapDependencies?: boolean; // Default true
}

export class IntentExtractor {
  private readonly extractImplicit: boolean;
  private readonly mapDependencies: boolean;

  constructor(options?: ExtractorOptions) {
    this.extractImplicit = options?.extractImplicit ?? true;
    this.mapDependencies = options?.mapDependencies ?? true;
  }

  /**
   * Extract intents from a prompt.
   * Returns a structured result with primary + secondary intents.
   */
  extract(prompt: string): IntentExtractionResult {
    const id = uuid();
    const sentences = this.splitSentences(prompt);
    const rawIntents = this.extractRawIntents(sentences);

    // The primary intent is the one with highest confidence
    const primary = this.determinePrimary(rawIntents, prompt);

    // Remaining become secondary, with dependency mapping
    const secondary = this.buildSecondaryIntents(rawIntents);

    // Extract context
    const context = this.extractContext(prompt);

    return {
      id,
      timestamp: new Date().toISOString(),
      prompt,
      primary,
      secondary,
      context,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

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
        const target = afterVerb.replace(/^(the|a|an|this|that|our|your)\s+/i, "").trim();

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

    return { filesNeeded, toolsRequired, assumptions };
  }
}
