/**
 * Agent Harness Adapter for the Prompt Decomposition Engine.
 *
 * Provides a standardized interface for terminal agents (ava-code, mia-code)
 * to decompose prompts, display results, and track execution progress.
 *
 * This adapter is framework-agnostic — it works without LangChain/LangGraph
 * dependencies, making it suitable for lightweight CLI agents.
 *
 * @example
 * ```typescript
 * import { AgentPDE } from "ava-langchain-prompt-decomposition/agent";
 *
 * const pde = new AgentPDE();
 * const result = await pde.decompose("Build auth with JWT and tests");
 * console.log(pde.formatForTerminal(result));
 *
 * // Track execution progress
 * pde.markCompleted(result, "intent-0");
 * console.log(pde.getProgress(result));
 * ```
 */

import { DirectionalDecomposer, type DecomposerOptions } from "./directional_decomposer.js";
import { IntentExtractor, type ExtractorOptions } from "./intent_extractor.js";
import { DependencyMapper } from "./dependency_mapper.js";
import { ActionStackBuilder, type DecompositionResult, type ActionItem } from "./action_stack.js";
import { MedicineWheelBridge, type WheelEnrichedAnalysis } from "./wheel_bridge.js";
import { saveDecomposition, loadDecomposition, type StoredDecomposition } from "./storage.js";
import { Direction, ALL_DIRECTIONS } from "./directional_decomposer.js";

// =============================================================================
// Types
// =============================================================================

export interface AgentPDEOptions {
  decomposer?: DecomposerOptions;
  extractor?: ExtractorOptions;
  /** Working directory for .pde/ storage */
  workdir?: string;
}

export interface AgentDecompositionResult {
  id: string;
  decomposition: DecompositionResult;
  wheelEnriched: WheelEnrichedAnalysis;
  /** Ceremony required before execution? */
  ceremonyRequired: boolean;
  /** Dominant direction */
  leadDirection: Direction;
  /** Markdown output */
  markdown: string;
}

export interface ExecutionProgress {
  total: number;
  completed: number;
  remaining: number;
  percentage: number;
  nextActions: ActionItem[];
  currentDirection: Direction;
}

// =============================================================================
// Direction Display Constants
// =============================================================================

const DIRECTION_EMOJI: Record<Direction, string> = {
  [Direction.EAST]: "🌅",
  [Direction.SOUTH]: "🔥",
  [Direction.WEST]: "🌊",
  [Direction.NORTH]: "❄️",
};

const DIRECTION_LABELS: Record<Direction, string> = {
  [Direction.EAST]: "Vision & Understanding",
  [Direction.SOUTH]: "Growth & Analysis",
  [Direction.WEST]: "Validation & Living",
  [Direction.NORTH]: "Action & Wisdom",
};

const DIRECTION_SETTLING: Record<Direction, string> = {
  [Direction.EAST]: "settling into understanding what's being asked",
  [Direction.SOUTH]: "breathing into research and analysis",
  [Direction.WEST]: "feeling into whether this works",
  [Direction.NORTH]: "honoring what emerged with action",
};

// =============================================================================
// Agent PDE
// =============================================================================

export class AgentPDE {
  private decomposer: DirectionalDecomposer;
  private extractor: IntentExtractor;
  private mapper: DependencyMapper;
  private builder: ActionStackBuilder;
  private bridge: MedicineWheelBridge;
  private workdir: string;

  constructor(options?: AgentPDEOptions) {
    this.decomposer = new DirectionalDecomposer(options?.decomposer);
    this.extractor = new IntentExtractor(options?.extractor);
    this.mapper = new DependencyMapper();
    this.builder = new ActionStackBuilder();
    this.bridge = new MedicineWheelBridge();
    this.workdir = options?.workdir || process.cwd();
  }

  /**
   * Decompose a prompt for agent execution.
   */
  async decompose(prompt: string): Promise<AgentDecompositionResult> {
    const directionalAnalysis = this.decomposer.decompose(prompt);
    const intentResult = await this.extractor.extract(prompt);
    const graph = this.mapper.buildGraph(intentResult.secondary);
    const order = this.mapper.computeExecutionOrder(graph);
    const decomposition = this.builder.build(directionalAnalysis, intentResult, order);
    const wheelEnriched = this.bridge.enrich(directionalAnalysis);

    const id = `agpde-${Date.now()}`;
    const markdown = this.builder.toMarkdown(decomposition);

    // Determine lead direction from action stack
    const directionCounts: Record<Direction, number> = {
      [Direction.EAST]: 0, [Direction.SOUTH]: 0, [Direction.WEST]: 0, [Direction.NORTH]: 0,
    };
    for (const item of decomposition.actionStack) {
      directionCounts[item.direction]++;
    }
    const leadDirection = (Object.entries(directionCounts) as [Direction, number][])
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? Direction.EAST;

    return {
      id,
      decomposition,
      wheelEnriched,
      ceremonyRequired: wheelEnriched.ceremonyRequired ?? false,
      leadDirection,
      markdown,
    };
  }

  /**
   * Format decomposition result for terminal display.
   * Returns a plain text string suitable for console.log().
   */
  formatForTerminal(result: AgentDecompositionResult): string {
    const lines: string[] = [];
    const { decomposition } = result;

    lines.push("");
    lines.push("💕 Prompt Decomposition (Four Directions)");
    lines.push("─".repeat(45));

    // Group action stack by direction
    const byDirection: Record<Direction, ActionItem[]> = {
      [Direction.EAST]: [], [Direction.SOUTH]: [], [Direction.WEST]: [], [Direction.NORTH]: [],
    };
    for (const item of decomposition.actionStack) {
      byDirection[item.direction].push(item);
    }

    let stageNum = 0;
    for (const dir of ALL_DIRECTIONS) {
      const items = byDirection[dir];
      if (items.length === 0) continue;
      stageNum++;

      const emoji = DIRECTION_EMOJI[dir];
      const label = DIRECTION_LABELS[dir];
      const settling = DIRECTION_SETTLING[dir];

      lines.push(`\nStage ${stageNum} (${emoji} ${dir.toUpperCase()} — ${label}):`);
      lines.push(`  💕 *${settling}*`);

      for (const item of items) {
        const dep = item.dependency ? ` [after: ${item.dependency}]` : "";
        const check = item.completed ? "●" : "○";
        lines.push(`  ${check} ${item.text}${dep}`);
      }
    }

    // Ambiguities
    if (decomposition.ambiguities.length > 0) {
      lines.push("\n⚠ Ambiguities:");
      for (const a of decomposition.ambiguities) {
        lines.push(`  ? ${a.text}`);
        lines.push(`    → ${a.suggestion}`);
      }
    }

    // Ceremony check
    if (result.ceremonyRequired) {
      lines.push("\n🙏 Ceremony recommended before proceeding.");
    }

    // Summary
    const intentCount = decomposition.actionStack.length;
    const ambCount = decomposition.ambiguities.length;
    lines.push(`\n${intentCount} tasks · ${ambCount} ambiguities · lead: ${DIRECTION_EMOJI[result.leadDirection]} ${result.leadDirection.toUpperCase()}`);

    return lines.join("\n");
  }

  /**
   * Mark an action item as completed and return updated progress.
   */
  markCompleted(result: AgentDecompositionResult, actionId: string): ExecutionProgress {
    const item = result.decomposition.actionStack.find(a => a.id === actionId);
    if (item) item.completed = true;
    return this.getProgress(result);
  }

  /**
   * Get current execution progress.
   */
  getProgress(result: AgentDecompositionResult): ExecutionProgress {
    const { actionStack } = result.decomposition;
    const completed = actionStack.filter(a => a.completed).length;
    const remaining = actionStack.length - completed;

    // Find next actionable items (no uncompleted dependencies)
    const completedIds = new Set(actionStack.filter(a => a.completed).map(a => a.id));
    const nextActions = actionStack.filter(a =>
      !a.completed && (!a.dependency || completedIds.has(a.dependency))
    );

    const currentDirection = nextActions[0]?.direction ?? Direction.EAST;

    return {
      total: actionStack.length,
      completed,
      remaining,
      percentage: actionStack.length > 0 ? Math.round((completed / actionStack.length) * 100) : 100,
      nextActions,
      currentDirection,
    };
  }

  /**
   * Save decomposition to .pde/ folder.
   */
  save(result: AgentDecompositionResult): StoredDecomposition | null {
    try {
      return saveDecomposition(this.workdir, result.decomposition);
    } catch {
      return null;
    }
  }
}
