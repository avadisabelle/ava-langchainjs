import { NarrativeTracingHandler } from "../handler.js";
import { NarrativeEventType } from "../event_types.js";
import {
  WheelAssessment,
  ImportanceUnit,
  EpistemicCircle,
  SpiralShiftAnalysis,
  GateVerdict,
  HumanEngagementRequest,
  RelationalMilestone,
  LiminalInput,
} from "ava-langchain-relational-intelligence";

export interface RelationalIntelligenceBridgeOptions {
  autoFlush?: boolean;
}

/**
 * Adapter for integrating the Relational Intelligence (RI) components
 * with narrative tracing.
 *
 * This bridge captures key relational events and logs them as narrative events
 * to Langfuse via the NarrativeTracingHandler.
 */
export class RelationalIntelligenceBridge {
  private handler: NarrativeTracingHandler;
  private autoFlush: boolean;

  constructor(
    handler: NarrativeTracingHandler,
    options: RelationalIntelligenceBridgeOptions = {}
  ) {
    this.handler = handler;
    this.autoFlush = options.autoFlush ?? false;
  }

  /**
   * Log that a Medicine Wheel assessment was performed.
   */
  logWheelAssessmentPerformed(
    assessment: WheelAssessment,
    parentSpanId?: string
  ): string {
    const spanId = this.handler.logEvent({
      eventType: NarrativeEventType.WHEEL_ASSESSMENT_PERFORMED,
      inputData: { input_id: assessment.inputId },
      outputData: {
        lead_quadrant: assessment.leadQuadrant,
        relational_coverage: assessment.relationalCoverage,
        balanced: assessment.balanced,
        neglected_quadrants: assessment.neglectedQuadrants,
        presence: assessment.presence,
      },
      metadata: {
        lead_quadrant: assessment.leadQuadrant,
        balanced: assessment.balanced,
      },
      parentSpanId,
    });
    this._flushIfAuto();
    return spanId;
  }

  /**
   * Log the creation of an Importance Unit.
   */
  logImportanceUnitCreated(
    unit: ImportanceUnit,
    parentSpanId?: string
  ): string {
    const spanId = this.handler.logEvent({
      eventType: NarrativeEventType.IMPORTANCE_UNIT_CREATED,
      inputData: { content_preview: unit.content.substring(0, 200) },
      outputData: {
        unit_id: unit.id,
        context: unit.context,
        accountability_score: unit.accountabilityScore,
      },
      metadata: {
        unit_id: unit.id,
        context: unit.context,
      },
      parentSpanId,
    });
    this._flushIfAuto();
    return spanId;
  }

  /**
   * Log that an Importance Unit was deepened (revisited).
   */
  logImportanceUnitDeepened(
    unit: ImportanceUnit,
    refinement: string,
    parentSpanId?: string
  ): string {
    const spanId = this.handler.logEvent({
      eventType: NarrativeEventType.IMPORTANCE_UNIT_DEEPENED,
      inputData: { unit_id: unit.id, refinement_preview: refinement.substring(0, 200) },
      outputData: {
        new_iteration_count: unit.iterationCount,
        new_accountability_score: unit.accountabilityScore,
      },
      metadata: {
        unit_id: unit.id,
        iteration_count: unit.iterationCount,
      },
      parentSpanId,
    });
    this._flushIfAuto();
    return spanId;
  }

  /**
   * Log that an Importance Unit's accountability decayed.
   */
  logImportanceUnitDecayed(
    unit: ImportanceUnit,
    parentSpanId?: string
  ): string {
    const spanId = this.handler.logEvent({
      eventType: NarrativeEventType.IMPORTANCE_UNIT_DECAYED,
      inputData: { unit_id: unit.id },
      outputData: {
        new_accountability_score: unit.accountabilityScore,
      },
      metadata: {
        unit_id: unit.id,
      },
      parentSpanId,
    });
    this._flushIfAuto();
    return spanId;
  }

  /**
   * Log that a value conflict was detected for an Importance Unit.
   */
  logValueConflictDetected(
    unit: ImportanceUnit,
    parentSpanId?: string
  ): string {
    const spanId = this.handler.logEvent({
      eventType: NarrativeEventType.VALUE_CONFLICT_DETECTED,
      inputData: { unit_id: unit.id, content_preview: unit.content.substring(0, 200) },
      metadata: {
        unit_id: unit.id,
      },
      parentSpanId,
    });
    this._flushIfAuto();
    return spanId;
  }

  /**
   * Log that a circle was recorded in an epistemic spiral.
   */
  logSpiralCircleRecorded(
    circle: EpistemicCircle,
    parentSpanId?: string
  ): string {
    const spanId = this.handler.logEvent({
      eventType: NarrativeEventType.SPIRAL_CIRCLE_RECORDED,
      inputData: { topic_key: circle.topicKey, content_preview: circle.content.substring(0, 200) },
      outputData: {
        iteration: circle.iteration,
        delta_preview: circle.delta.substring(0, 200),
      },
      metadata: {
        topic_key: circle.topicKey,
        iteration: circle.iteration,
      },
      parentSpanId,
    });
    this._flushIfAuto();
    return spanId;
  }

  /**
   * Log the analysis of a spiral shift.
   */
  logSpiralShiftAnalyzed(
    analysis: SpiralShiftAnalysis,
    parentSpanId?: string
  ): string {
    const spanId = this.handler.logEvent({
      eventType: NarrativeEventType.SPIRAL_SHIFT_ANALYZED,
      inputData: { circle_id: analysis.circleId },
      outputData: {
        shift_type: analysis.shiftType,
        significance: analysis.significance,
        new_concepts: analysis.newConcepts.join(", "),
        refined_concepts: analysis.refinedConcepts.join(", "),
      },
      metadata: {
        shift_type: analysis.shiftType,
        significance: analysis.significance,
      },
      parentSpanId,
    });
    this._flushIfAuto();
    return spanId;
  }

  /**
   * Log that a Value Gate verdict was issued.
   */
  logValueGateVerdictIssued(
    verdict: GateVerdict,
    parentSpanId?: string
  ): string {
    const spanId = this.handler.logEvent({
      eventType: NarrativeEventType.VALUE_GATE_VERDICT_ISSUED,
      outputData: {
        can_proceed: verdict.canProceed,
        requires_human: verdict.requiresHuman,
        failure_summary: verdict.failureSummary.join(" | "),
      },
      metadata: {
        can_proceed: verdict.canProceed,
        requires_human: verdict.requiresHuman,
      },
      parentSpanId,
    });
    this._flushIfAuto();
    return spanId;
  }

  /**
   * Log that human engagement was requested.
   */
  logHumanEngagementRequested(
    request: HumanEngagementRequest,
    parentSpanId?: string
  ): string {
    const spanId = this.handler.logEvent({
      eventType: NarrativeEventType.HUMAN_ENGAGEMENT_REQUESTED,
      inputData: { reason: request.reason, context_preview: request.context.substring(0, 200) },
      outputData: {
        request_id: request.id,
        mode: request.mode,
        priority: request.priority,
      },
      metadata: {
        request_id: request.id,
        mode: request.mode,
      },
      parentSpanId,
    });
    this._flushIfAuto();
    return spanId;
  }

  /**
   * Log that a human engagement request was resolved.
   */
  logHumanEngagementResolved(requestId: string, parentSpanId?: string): string {
    const spanId = this.handler.logEvent({
      eventType: NarrativeEventType.HUMAN_ENGAGEMENT_RESOLVED,
      inputData: { request_id: requestId },
      metadata: {
        request_id: requestId,
      },
      parentSpanId,
    });
    this._flushIfAuto();
    return spanId;
  }

  /**
   * Log that a relational milestone was recorded.
   */
  logRelationalMilestoneRecorded(
    milestone: RelationalMilestone,
    parentSpanId?: string
  ): string {
    const spanId = this.handler.logEvent({
      eventType: NarrativeEventType.RELATIONAL_MILESTONE_RECORDED,
      inputData: { description_preview: milestone.description.substring(0, 200) },
      outputData: {
        milestone_id: milestone.id,
        allows_pruning: milestone.allowsPruning,
      },
      metadata: {
        milestone_id: milestone.id,
        allows_pruning: milestone.allowsPruning,
      },
      parentSpanId,
    });
    this._flushIfAuto();
    return spanId;
  }

  /**
   * Log that a liminal input was captured.
   */
  logLiminalInputCaptured(
    input: LiminalInput,
    parentSpanId?: string
  ): string {
    const spanId = this.handler.logEvent({
      eventType: NarrativeEventType.LIMINAL_INPUT_CAPTURED,
      inputData: { content_preview: input.content.substring(0, 200) },
      outputData: {
        input_id: input.id,
        mode: input.mode,
        weight: input.weight,
      },
      metadata: {
        input_id: input.id,
        mode: input.mode,
      },
      parentSpanId,
    });
    this._flushIfAuto();
    return spanId;
  }

  /**
   * Log the result of a liminal input alignment check.
   */
  logLiminalInputAlignmentChecked(
    checkResult: { aligned: boolean; conflicts: string[] },
    parentSpanId?: string
  ): string {
    const spanId = this.handler.logEvent({
      eventType: NarrativeEventType.LIMINAL_INPUT_ALIGNMENT_CHECKED,
      outputData: {
        aligned: checkResult.aligned,
        conflicts_count: checkResult.conflicts.length,
        conflicts_preview: checkResult.conflicts.slice(0, 3).join(" | "),
      },
      metadata: {
        aligned: checkResult.aligned,
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
