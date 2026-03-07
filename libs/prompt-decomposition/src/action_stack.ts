/**
 * Action Stack
 *
 * Produces a dependency-ordered, direction-tagged execution plan
 * from a complete PDE decomposition. This is the final output
 * structure that consumers (LangGraph, Flowise) use to execute tasks.
 *
 * This is the NORTH (Action) function of PDE — what actually executes.
 */

import { v4 as uuid } from "uuid";
import type { DirectionalAnalysis, Direction } from "./directional_decomposer.js";
import type { IntentExtractionResult, SecondaryIntent } from "./intent_extractor.js";
import type { DependencyGraph, ExecutionOrder } from "./dependency_mapper.js";
import { DependencyMapper } from "./dependency_mapper.js";

// =============================================================================
// Types
// =============================================================================

export interface ActionItem {
  id: string;
  text: string;
  direction: Direction;
  dependency: string | null; // ID of prerequisite action
  completed: boolean;
  confidence: number;
  implicit: boolean;
}

/** Structured ambiguity flag (mcp-pde lineage) */
export interface AmbiguityFlag {
  text: string;
  suggestion: string;
}

/** Expected outputs from the decomposition (mcp-pde lineage) */
export interface ExpectedOutputs {
  artifacts: string[];
  updates: string[];
  communications: string[];
}

export interface DecompositionResult {
  id: string;
  timestamp: string;
  prompt: string;
  primary: {
    action: string;
    target: string;
    urgency: string;
    confidence: number;
  };
  secondary: SecondaryIntent[];
  context: {
    filesNeeded: string[];
    toolsRequired: string[];
    assumptions: string[];
  };
  outputs: ExpectedOutputs;
  directions: Record<Direction, Array<{ text: string; confidence: number; implicit: boolean }>>;
  actionStack: ActionItem[];
  balance: number;
  leadDirection: Direction;
  neglectedDirections: Direction[];
  ambiguities: AmbiguityFlag[];
}

export interface ActionStackOptions {
  includeImplicit?: boolean; // Include implicit actions (default true)
  maxItems?: number; // Max actions in stack (default 20)
}

// =============================================================================
// ActionStack Builder
// =============================================================================

export class ActionStackBuilder {
  private readonly includeImplicit: boolean;
  private readonly maxItems: number;

  constructor(options?: ActionStackOptions) {
    this.includeImplicit = options?.includeImplicit ?? true;
    this.maxItems = options?.maxItems ?? 20;
  }

  /**
   * Build the complete PDE output from directional analysis and intent extraction.
   * This merges all decomposition outputs into the final action stack.
   */
  build(
    directionalAnalysis: DirectionalAnalysis,
    intentResult: IntentExtractionResult,
    executionOrder?: ExecutionOrder
  ): DecompositionResult {
    const id = uuid();

    // Build action stack from execution order or intents
    let actionStack: ActionItem[];
    if (executionOrder) {
      actionStack = this.fromExecutionOrder(executionOrder, intentResult);
    } else {
      actionStack = this.fromIntents(intentResult, directionalAnalysis);
    }

    // Apply max items limit
    if (actionStack.length > this.maxItems) {
      actionStack = actionStack.slice(0, this.maxItems);
    }

    // Filter implicit if disabled
    if (!this.includeImplicit) {
      actionStack = actionStack.filter((a) => !a.implicit);
    }

    // Detect ambiguities
    const ambiguities = this.detectAmbiguities(directionalAnalysis, intentResult);

    return {
      id,
      timestamp: new Date().toISOString(),
      prompt: intentResult.prompt,
      primary: {
        action: intentResult.primary.action,
        target: intentResult.primary.target,
        urgency: intentResult.primary.urgency,
        confidence: intentResult.primary.confidence,
      },
      secondary: intentResult.secondary,
      context: intentResult.context,
      outputs: this.extractExpectedOutputs(intentResult),
      directions: {
        east: directionalAnalysis.directions.east?.map((i) => ({
          text: i.text,
          confidence: i.confidence,
          implicit: i.implicit,
        })) ?? [],
        south: directionalAnalysis.directions.south?.map((i) => ({
          text: i.text,
          confidence: i.confidence,
          implicit: i.implicit,
        })) ?? [],
        west: directionalAnalysis.directions.west?.map((i) => ({
          text: i.text,
          confidence: i.confidence,
          implicit: i.implicit,
        })) ?? [],
        north: directionalAnalysis.directions.north?.map((i) => ({
          text: i.text,
          confidence: i.confidence,
          implicit: i.implicit,
        })) ?? [],
      },
      actionStack,
      balance: directionalAnalysis.balance,
      leadDirection: directionalAnalysis.leadDirection,
      neglectedDirections: directionalAnalysis.neglectedDirections,
      ambiguities,
    };
  }

  /**
   * Serialize a DecompositionResult to the PDE JSON format
   * (compatible with /workspace/.pde/ structure)
   */
  toJSON(result: DecompositionResult): string {
    return JSON.stringify(
      {
        id: result.id,
        timestamp: result.timestamp,
        prompt: result.prompt,
        result: {
          primary: result.primary,
          secondary: result.secondary,
          context: {
            files_needed: result.context.filesNeeded,
            tools_required: result.context.toolsRequired,
            assumptions: result.context.assumptions,
          },
          outputs: result.outputs,
          directions: result.directions,
          actionStack: result.actionStack,
          ambiguities: result.ambiguities,
        },
        options: {
          extractImplicit: this.includeImplicit,
          mapDependencies: true,
        },
      },
      null,
      2
    );
  }

  /**
   * Render a DecompositionResult as human-readable Markdown
   */
  toMarkdown(result: DecompositionResult): string {
    const lines: string[] = [];

    lines.push(`# Prompt Decomposition`);
    lines.push("");

    // Four Directions (canonical container)
    lines.push(`## Four Directions`);
    lines.push("");

    const dirEmoji: Record<string, string> = {
      east: "🌅",
      south: "🔥",
      west: "🌊",
      north: "❄️",
    };
    const dirSubtitle: Record<string, string> = {
      east: "Vision",
      south: "Analysis",
      west: "Validation",
      north: "Action",
    };

    for (const dir of ["east", "south", "west", "north"] as Direction[]) {
      const insights = result.directions[dir];
      if (insights.length > 0) {
        lines.push(`### ${dirEmoji[dir]} ${dir.toUpperCase()} — ${dirSubtitle[dir]}`);
        for (const insight of insights) {
          const tag = insight.implicit ? " _(implicit)_" : "";
          lines.push(`- ${insight.text} [${(insight.confidence * 100).toFixed(0)}%]${tag}`);
        }
        lines.push("");
      }
    }

    // Primary Intent
    lines.push(`## Primary Intent`);
    lines.push(`**Action:** ${result.primary.action} → ${result.primary.target}`);
    lines.push(`**Urgency:** ${result.primary.urgency} | **Confidence:** ${(result.primary.confidence * 100).toFixed(0)}%`);
    lines.push(`**Balance:** ${(result.balance * 100).toFixed(0)}% | **Lead:** ${result.leadDirection}`);
    lines.push("");

    // Secondary Intents
    if (result.secondary.length > 0) {
      lines.push(`## Secondary Intents`);
      for (const s of result.secondary) {
        const tag = s.implicit ? " _(implicit)_" : "";
        const dep = s.dependency ? ` → depends on: ${s.dependency}` : "";
        lines.push(`- ${s.action} → ${s.target} [${(s.confidence * 100).toFixed(0)}%]${tag}${dep}`);
      }
      lines.push("");
    }

    // Context Requirements
    if (result.context.filesNeeded.length || result.context.toolsRequired.length || result.context.assumptions.length) {
      lines.push(`## Context Requirements`);
      if (result.context.filesNeeded.length) {
        lines.push(`### Files Needed`);
        result.context.filesNeeded.forEach((f) => lines.push(`- ${f}`));
        lines.push("");
      }
      if (result.context.toolsRequired.length) {
        lines.push(`### Tools Required`);
        result.context.toolsRequired.forEach((t) => lines.push(`- ${t}`));
        lines.push("");
      }
      if (result.context.assumptions.length) {
        lines.push(`### Assumptions`);
        result.context.assumptions.forEach((a) => lines.push(`- ${a}`));
        lines.push("");
      }
    }

    // Expected Outputs
    if (result.outputs.artifacts.length || result.outputs.updates.length || result.outputs.communications.length) {
      lines.push(`## Expected Outputs`);
      if (result.outputs.artifacts.length) {
        lines.push(`### Artifacts`);
        result.outputs.artifacts.forEach((a) => lines.push(`- ${a}`));
        lines.push("");
      }
      if (result.outputs.updates.length) {
        lines.push(`### Updates`);
        result.outputs.updates.forEach((u) => lines.push(`- ${u}`));
        lines.push("");
      }
      if (result.outputs.communications.length) {
        lines.push(`### Communications`);
        result.outputs.communications.forEach((c) => lines.push(`- ${c}`));
        lines.push("");
      }
    }

    // Action Stack
    lines.push(`## Action Stack`);
    for (const action of result.actionStack) {
      const check = action.completed ? "x" : " ";
      const dep = action.dependency ? ` → depends on: ${action.dependency}` : "";
      const tag = action.implicit ? " _(implicit)_" : "";
      lines.push(`- [${check}] [${action.direction}] ${action.text}${tag}${dep}`);
    }
    lines.push("");

    // Ambiguity Flags
    if (result.ambiguities.length > 0) {
      lines.push(`## Ambiguity Flags`);
      for (const amb of result.ambiguities) {
        lines.push(`- **"${amb.text}"**`);
        lines.push(`  - Suggestion: ${amb.suggestion}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private fromExecutionOrder(
    order: ExecutionOrder,
    intentResult: IntentExtractionResult
  ): ActionItem[] {
    const items: ActionItem[] = [];
    const intentMap = new Map(
      intentResult.secondary.map((s) => [s.id, s])
    );

    for (const layer of order.layers) {
      for (const node of layer) {
        const intent = intentMap.get(node.intentId);
        items.push({
          id: node.id,
          text: `${node.action} ${node.target}`,
          direction: node.direction,
          dependency: node.dependencies[0] ?? null,
          completed: node.completed,
          confidence: intent?.confidence ?? 0.7,
          implicit: intent?.implicit ?? false,
        });
      }
    }

    return items;
  }

  private fromIntents(
    intentResult: IntentExtractionResult,
    directionalAnalysis: DirectionalAnalysis
  ): ActionItem[] {
    const mapper = new DependencyMapper();
    const graph = mapper.buildGraph(intentResult.secondary);
    const order = mapper.computeExecutionOrder(graph);
    return this.fromExecutionOrder(order, intentResult);
  }

  private detectAmbiguities(
    directionalAnalysis: DirectionalAnalysis,
    intentResult: IntentExtractionResult
  ): AmbiguityFlag[] {
    const ambiguities: AmbiguityFlag[] = [];

    // Low confidence primary
    if (intentResult.primary.confidence < 0.5) {
      ambiguities.push({
        text: `Primary intent has low confidence (${(intentResult.primary.confidence * 100).toFixed(0)}%)`,
        suggestion: "Clarify the main goal with a more specific action verb and target.",
      });
    }

    // Neglected directions
    for (const dir of directionalAnalysis.neglectedDirections) {
      const desc = dir === "east" ? "vision clarity" : dir === "south" ? "research context" : dir === "west" ? "validation criteria" : "actionable steps";
      ambiguities.push({
        text: `Direction ${dir} is neglected`,
        suggestion: `The prompt lacks ${desc}. Consider addressing what is missing from this perspective.`,
      });
    }

    // Hedging language in prompt → ambiguity flags
    const lower = intentResult.prompt.toLowerCase();
    if (/\bsomehow\b/.test(lower)) {
      ambiguities.push({
        text: `"somehow" — method left unspecified`,
        suggestion: "Specify the approach or method to use.",
      });
    }
    if (/\bprobably\b|\bmaybe\b|\bperhaps\b/.test(lower)) {
      ambiguities.push({
        text: `Hedging language detected ("probably", "maybe", "perhaps")`,
        suggestion: "Confirm or deny the hedged assumptions before proceeding.",
      });
    }

    return ambiguities;
  }

  private extractExpectedOutputs(
    intentResult: IntentExtractionResult
  ): ExpectedOutputs {
    const artifacts: string[] = [];
    const updates: string[] = [];
    const communications: string[] = [];

    for (const intent of intentResult.secondary) {
      if (["create", "add"].includes(intent.action)) {
        artifacts.push(intent.target);
      } else if (["modify", "use"].includes(intent.action)) {
        updates.push(intent.target);
      } else if (["deploy", "draft"].includes(intent.action)) {
        communications.push(intent.target);
      }
    }

    // Primary also contributes
    if (["create", "add"].includes(intentResult.primary.action)) {
      artifacts.push(intentResult.primary.target);
    } else if (["modify"].includes(intentResult.primary.action)) {
      updates.push(intentResult.primary.target);
    }

    return { artifacts, updates, communications };
  }
}
