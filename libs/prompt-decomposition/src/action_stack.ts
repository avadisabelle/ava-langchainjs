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
  directions: Record<Direction, Array<{ text: string; confidence: number; implicit: boolean }>>;
  actionStack: ActionItem[];
  balance: number;
  leadDirection: Direction;
  neglectedDirections: Direction[];
  ambiguities: string[];
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

    lines.push(`# 🧭 Prompt Decomposition`);
    lines.push("");
    lines.push(`**Primary Intent:** ${result.primary.action} → ${result.primary.target}`);
    lines.push(`**Urgency:** ${result.primary.urgency} | **Confidence:** ${(result.primary.confidence * 100).toFixed(0)}%`);
    lines.push(`**Balance:** ${(result.balance * 100).toFixed(0)}% | **Lead:** ${result.leadDirection}`);
    lines.push("");

    // Directions
    const dirEmoji: Record<string, string> = {
      east: "🌅",
      south: "🔥",
      west: "🌊",
      north: "❄️",
    };

    for (const dir of ["east", "south", "west", "north"] as Direction[]) {
      const insights = result.directions[dir];
      if (insights.length > 0) {
        lines.push(`## ${dirEmoji[dir]} ${dir.toUpperCase()}`);
        for (const insight of insights) {
          const tag = insight.implicit ? " _(implicit)_" : "";
          lines.push(`- ${insight.text}${tag} [${(insight.confidence * 100).toFixed(0)}%]`);
        }
        lines.push("");
      }
    }

    // Action Stack
    lines.push(`## 📋 Action Stack`);
    for (const action of result.actionStack) {
      const check = action.completed ? "x" : " ";
      const dep = action.dependency ? ` → depends on: ${action.dependency}` : "";
      const tag = action.implicit ? " _(implicit)_" : "";
      lines.push(`- [${check}] [${action.direction}] ${action.text}${tag}${dep}`);
    }
    lines.push("");

    // Ambiguities
    if (result.ambiguities.length > 0) {
      lines.push(`## ⚠️ Ambiguities`);
      for (const amb of result.ambiguities) {
        lines.push(`- ${amb}`);
      }
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
  ): string[] {
    const ambiguities: string[] = [];

    // Low confidence primary
    if (intentResult.primary.confidence < 0.5) {
      ambiguities.push(
        `Primary intent has low confidence (${(intentResult.primary.confidence * 100).toFixed(0)}%) — consider clarifying the main goal.`
      );
    }

    // Neglected directions
    for (const dir of directionalAnalysis.neglectedDirections) {
      ambiguities.push(
        `Direction ${dir} is neglected — the prompt lacks ${dir === "east" ? "vision clarity" : dir === "south" ? "research context" : dir === "west" ? "validation criteria" : "actionable steps"}.`
      );
    }

    // Circular dependencies would be caught by DependencyMapper

    return ambiguities;
  }
}
