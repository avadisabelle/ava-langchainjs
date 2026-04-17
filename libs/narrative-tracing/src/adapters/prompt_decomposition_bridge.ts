import { v4 as uuidv4 } from "uuid";
import { NarrativeTracingHandler } from "../handler.js";
import { NarrativeEventType } from "../event_types.js";
import {
  DirectionalAnalysis,
  IntentExtractionResult,
  DependencyGraph,
  ActionItem,
  WheelEnrichedAnalysis,
} from "../../../prompt-decomposition/src/index.js"; // Adjust path as necessary

export interface PromptDecompositionBridgeOptions {
  autoFlush?: boolean;
}

/**
 * Adapter for integrating the Prompt Decomposition Engine (PDE) with narrative tracing.
 *
 * This bridge captures key events throughout the PDE pipeline and logs them
 * as narrative events to Langfuse via the NarrativeTracingHandler.
 */
export class PromptDecompositionBridge {
  private handler: NarrativeTracingHandler;
  private autoFlush: boolean;

  constructor(
    handler: NarrativeTracingHandler,
    options: PromptDecompositionBridgeOptions = {}
  ) {
    this.handler = handler;
    this.autoFlush = options.autoFlush ?? false;
  }

  /**
   * Log the start of a prompt decomposition process.
   */
  logDecompositionStart(prompt: string, parentSpanId?: string): string {
    const spanId = this.handler.logEvent({
      eventType: NarrativeEventType.PROMPT_DECOMPOSITION_STARTED,
      inputData: { prompt_preview: prompt.substring(0, 500) },
      parentSpanId,
    });
    this._flushIfAuto();
    return spanId;
  }

  /**
   * Log the results of the directional analysis.
   */
  logDirectionalAnalysis(
    analysis: DirectionalAnalysis,
    parentSpanId?: string
  ): string {
    const spanId = this.handler.logEvent({
      eventType: NarrativeEventType.DIRECTIONAL_ANALYSIS_PERFORMED,
      inputData: { prompt_preview: analysis.prompt.substring(0, 500) },
      outputData: {
        lead_direction: analysis.leadDirection,
        balance: analysis.balance,
        neglected_directions: analysis.neglectedDirections,
        insights_count: Object.values(analysis.directions).flat().length,
      },
      metadata: {
        lead_direction: analysis.leadDirection,
        balance: analysis.balance,
      },
      parentSpanId,
    });
    this._flushIfAuto();
    return spanId;
  }

  /**
   * Log the results of intent extraction.
   */
  logIntentExtraction(
    result: IntentExtractionResult,
    parentSpanId?: string
  ): string {
    const spanId = this.handler.logEvent({
      eventType: NarrativeEventType.INTENT_EXTRACTION_PERFORMED,
      inputData: { prompt_preview: result.prompt.substring(0, 500) },
      outputData: {
        primary_action: result.primary.action,
        primary_target: result.primary.target,
        primary_confidence: result.primary.confidence,
        secondary_intents_count: result.secondary.length,
        extracted_files: result.context.filesNeeded,
        extracted_tools: result.context.toolsRequired,
      },
      metadata: {
        primary_action: result.primary.action,
        primary_confidence: result.primary.confidence,
      },
      parentSpanId,
    });
    this._flushIfAuto();
    return spanId;
  }

  /**
   * Log the creation of the dependency graph.
   */
  logDependencyGraph(
    graph: DependencyGraph,
    parentSpanId?: string
  ): string {
    const spanId = this.handler.logEvent({
      eventType: NarrativeEventType.DEPENDENCY_GRAPH_BUILT,
      outputData: {
        nodes_count: graph.nodes.size,
        roots_count: graph.roots.length,
        leaves_count: graph.leaves.length,
        max_depth: graph.maxDepth,
        has_cycle: graph.hasCycle,
      },
      metadata: {
        has_cycle: graph.hasCycle,
        max_depth: graph.maxDepth,
      },
      parentSpanId,
    });
    this._flushIfAuto();
    return spanId;
  }

  /**
   * Log the final action stack built.
   */
  logActionStackBuilt(actionStack: ActionItem[], parentSpanId?: string): string {
    const spanId = this.handler.logEvent({
      eventType: NarrativeEventType.ACTION_STACK_BUILT,
      outputData: {
        action_items_count: actionStack.length,
        first_action: actionStack[0]?.text,
        last_action: actionStack[actionStack.length - 1]?.text,
      },
      metadata: {
        action_items_count: actionStack.length,
      },
      parentSpanId,
    });
    this._flushIfAuto();
    return spanId;
  }

  /**
   * Log detection of ambiguities in the prompt.
   */
  logAmbiguityDetected(ambiguities: string[], parentSpanId?: string): string {
    const spanId = this.handler.logEvent({
      eventType: NarrativeEventType.AMBIGUITY_DETECTED,
      outputData: {
        ambiguities_count: ambiguities.length,
        ambiguity_previews: ambiguities.slice(0, 3),
      },
      metadata: {
        ambiguities_count: ambiguities.length,
      },
      parentSpanId,
    });
    this._flushIfAuto();
    return spanId;
  }

  /**
   * Log the Medicine Wheel assessment of the prompt.
   */
  logMedicineWheelAssessment(
    assessment: WheelEnrichedAnalysis,
    parentSpanId?: string
  ): string {
    const spanId = this.handler.logEvent({
      eventType: NarrativeEventType.MEDICINE_WHEEL_ASSESSMENT,
      inputData: { prompt_preview: assessment.prompt.substring(0, 500) },
      outputData: {
        lead_quadrant: assessment.leadDirection, // Direction is mapped to quadrant
        relational_coverage: assessment.relationalCoverage,
        ceremony_required: assessment.ceremonyRequired,
        quadrant_presence: assessment.quadrantPresence,
      },
      metadata: {
        ceremony_required: assessment.ceremonyRequired,
        relational_coverage: assessment.relationalCoverage,
      },
      parentSpanId,
    });
    this._flushIfAuto();
    return spanId;
  }

  private _flushIfAuto(): void {
    if (this.autoFlush) {
      this.handler.flush();
    }
  }
}
