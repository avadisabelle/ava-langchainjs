/**
 * Storytelling Hooks Adapter
 *
 * Provides hooks for the Storytelling system to automatically trace
 * beat creation, lesson extraction, and narrative arc progression.
 */

import { NarrativeTracingHandler } from "../handler.js";
import { NarrativeEventType } from "../event_types.js";

/**
 * Information about a story beat being traced
 */
export interface BeatInfo {
  beatId: string;
  sequence: number;
  content: string;
  narrativeFunction: string;
  act: number;
  emotionalTone?: string;
  characterId?: string;
  lessons: string[];
  createdAt: string;
  qualityBefore: number;
  qualityAfter: number;
}

/**
 * Create a BeatInfo with defaults
 */
export function createBeatInfo(beatId: string): BeatInfo {
  return {
    beatId,
    sequence: 0,
    content: "",
    narrativeFunction: "beat",
    act: 2,
    lessons: [],
    createdAt: new Date().toISOString(),
    qualityBefore: 0,
    qualityAfter: 0,
  };
}

/**
 * Character arc update information
 */
export interface CharacterUpdate {
  characterId: string;
  characterName: string;
  arcPositionBefore: number;
  arcPositionAfter: number;
  growthDescription: string;
  beatId?: string;
}

/**
 * Theme thread update information
 */
export interface ThemeUpdate {
  themeId: string;
  themeName: string;
  strengthBefore: number;
  strengthAfter: number;
  description: string;
  beatId?: string;
}

/**
 * Context-scoped tracer for a single beat's lifecycle
 */
export class BeatTracer {
  beatId: string;
  private handler: NarrativeTracingHandler;
  private parentSpanId?: string;

  contentLogged: boolean = false;
  analysisLogged: boolean = false;
  enrichmentLogged: boolean = false;
  lessonsLogged: boolean = false;

  private _contentSpanId?: string;
  private _analysisSpanId?: string;
  private _enrichmentSpanId?: string;
  private _beatInfo: BeatInfo;

  constructor(
    beatId: string,
    handler: NarrativeTracingHandler,
    parentSpanId?: string
  ) {
    this.beatId = beatId;
    this.handler = handler;
    this.parentSpanId = parentSpanId;
    this._beatInfo = createBeatInfo(beatId);
  }

  /**
   * Log beat content creation
   */
  logContent(
    content: string,
    options: {
      sequence?: number;
      narrativeFunction?: string;
      act?: number;
      emotionalTone?: string;
      characterId?: string;
    } = {}
  ): string {
    this._beatInfo.content = content;
    this._beatInfo.sequence = options.sequence ?? 0;
    this._beatInfo.narrativeFunction = options.narrativeFunction ?? "beat";
    this._beatInfo.act = options.act ?? 2;
    this._beatInfo.emotionalTone = options.emotionalTone;
    this._beatInfo.characterId = options.characterId;

    this._contentSpanId = this.handler.logBeatCreation(
      this.beatId,
      content,
      this._beatInfo.sequence,
      this._beatInfo.narrativeFunction,
      {
        emotionalTone: options.emotionalTone,
        characterId: options.characterId,
        parentSpanId: this.parentSpanId,
      }
    );

    this.contentLogged = true;
    return this._contentSpanId;
  }

  /**
   * Log beat analysis results
   */
  logAnalysis(
    classification: string,
    confidence: number,
    options: {
      detectedEmotions?: string[];
      analysisType?: string;
    } = {}
  ): string {
    this._analysisSpanId = this.handler.logBeatAnalysis(
      this.beatId,
      options.analysisType ?? "emotional",
      classification,
      confidence,
      {
        detectedEmotions: options.detectedEmotions,
        parentSpanId: this._contentSpanId || this.parentSpanId,
      }
    );

    this._beatInfo.emotionalTone = classification;
    this.analysisLogged = true;
    return this._analysisSpanId;
  }

  /**
   * Log beat enrichment results
   */
  logEnrichment(
    enrichmentType: string,
    flowsUsed: string[],
    qualityBefore: number,
    qualityAfter: number
  ): string {
    this._enrichmentSpanId = this.handler.logBeatEnrichment(
      this.beatId,
      enrichmentType,
      flowsUsed,
      qualityBefore,
      qualityAfter,
      this._analysisSpanId || this._contentSpanId || this.parentSpanId
    );

    this._beatInfo.qualityBefore = qualityBefore;
    this._beatInfo.qualityAfter = qualityAfter;
    this.enrichmentLogged = true;
    return this._enrichmentSpanId;
  }

  /**
   * Log extracted lessons
   */
  logLessons(lessons: string[]): void {
    this._beatInfo.lessons = lessons;
    this.lessonsLogged = true;
  }

  get beatInfo(): BeatInfo {
    return this._beatInfo;
  }
}

export interface StorytellingHooksOptions {
  autoSequence?: boolean;
}

/**
 * Hooks for integrating narrative-tracing with the Storytelling system.
 *
 * @example
 * ```typescript
 * const hooks = new StorytellingHooks(handler);
 *
 * // Trace a beat's full lifecycle
 * const tracer = hooks.createBeatTracer("beat_001");
 * tracer.logContent(content, { narrativeFunction: "inciting_incident" });
 * tracer.logAnalysis("wonder", 0.85);
 * tracer.logLessons(["Integration requires patience"]);
 * hooks.finishBeatTracer(tracer);
 *
 * // Log character updates
 * hooks.logCharacterArcUpdate({
 *   characterId: "char_001",
 *   characterName: "The Developer",
 *   arcPositionBefore: 0.2,
 *   arcPositionAfter: 0.35,
 *   growthDescription: "Gained confidence in integration"
 * });
 * ```
 */
export class StorytellingHooks {
  private handler: NarrativeTracingHandler;
  private autoSequence: boolean;

  private _sequenceCounter: number = 0;
  private _currentAct: number = 1;

  private _beats: BeatInfo[] = [];
  private _characterUpdates: CharacterUpdate[] = [];
  private _themeUpdates: ThemeUpdate[] = [];

  constructor(
    handler: NarrativeTracingHandler,
    options: StorytellingHooksOptions = {}
  ) {
    this.handler = handler;
    this.autoSequence = options.autoSequence ?? true;
  }

  // ===========================================================================
  // BEAT LIFECYCLE
  // ===========================================================================

  /**
   * Create a BeatTracer for tracing a beat's full lifecycle
   */
  createBeatTracer(beatId: string, parentSpanId?: string): BeatTracer {
    if (this.autoSequence) {
      this._sequenceCounter += 1;
    }

    return new BeatTracer(beatId, this.handler, parentSpanId);
  }

  /**
   * Finish and record a BeatTracer
   */
  finishBeatTracer(tracer: BeatTracer): void {
    this._beats.push(tracer.beatInfo);
  }

  /**
   * Log beat creation directly (without tracer pattern)
   */
  logBeatCreation(
    beatId: string,
    content: string,
    options: {
      narrativeFunction?: string;
      act?: number;
      emotionalTone?: string;
      characterId?: string;
      parentSpanId?: string;
    } = {}
  ): string {
    if (this.autoSequence) {
      this._sequenceCounter += 1;
    }

    const spanId = this.handler.logBeatCreation(
      beatId,
      content,
      this._sequenceCounter,
      options.narrativeFunction ?? "beat",
      {
        emotionalTone: options.emotionalTone,
        characterId: options.characterId,
        parentSpanId: options.parentSpanId,
      }
    );

    // Track the beat
    const beatInfo = createBeatInfo(beatId);
    beatInfo.sequence = this._sequenceCounter;
    beatInfo.content = content;
    beatInfo.narrativeFunction = options.narrativeFunction ?? "beat";
    beatInfo.act = options.act ?? 2;
    beatInfo.emotionalTone = options.emotionalTone;
    beatInfo.characterId = options.characterId;
    this._beats.push(beatInfo);

    return spanId;
  }

  // ===========================================================================
  // CHARACTER ARC TRACKING
  // ===========================================================================

  /**
   * Log a character arc update
   */
  logCharacterArcUpdate(update: CharacterUpdate, parentSpanId?: string): string {
    const spanId = this.handler.logCharacterArcUpdate(
      update.characterId,
      update.characterName,
      update.arcPositionBefore,
      update.arcPositionAfter,
      update.growthDescription,
      {
        beatId: update.beatId,
        parentSpanId,
      }
    );

    this._characterUpdates.push(update);
    return spanId;
  }

  // ===========================================================================
  // THEME TRACKING
  // ===========================================================================

  /**
   * Log a theme thread update
   */
  logThemeUpdate(update: ThemeUpdate, parentSpanId?: string): string {
    const spanId = this.handler.logEvent({
      eventType: NarrativeEventType.THEME_REINFORCED,
      inputData: {
        theme_id: update.themeId,
        theme_name: update.themeName,
        strength_before: update.strengthBefore,
      },
      outputData: {
        strength_after: update.strengthAfter,
        change: update.strengthAfter - update.strengthBefore,
        description: update.description,
      },
      beatId: update.beatId,
      parentSpanId,
    });

    this._themeUpdates.push(update);
    return spanId;
  }

  // ===========================================================================
  // ACT TRANSITIONS
  // ===========================================================================

  /**
   * Log transition between acts
   */
  logActTransition(
    fromAct: number,
    toAct: number,
    options: {
      beatId?: string;
      reason?: string;
      parentSpanId?: string;
    } = {}
  ): string {
    this._currentAct = toAct;

    return this.handler.logEvent({
      eventType: NarrativeEventType.STORY_GENERATION_END,
      inputData: {
        transition: "act_change",
        from_act: fromAct,
        to_act: toAct,
      },
      outputData: {
        reason: options.reason ?? "narrative_progression",
        beat_id: options.beatId,
      },
      metadata: {
        current_act: toAct,
      },
      parentSpanId: options.parentSpanId,
    });
  }

  // ===========================================================================
  // GAP TRACKING
  // ===========================================================================

  /**
   * Log identification of a narrative gap
   */
  logNarrativeGap(
    gapType: string,
    description: string,
    severity: number,
    options: {
      beatId?: string;
      suggestedRemediation?: string;
      parentSpanId?: string;
    } = {}
  ): string {
    return this.handler.logGapIdentified(gapType, description, severity, {
      beatId: options.beatId,
      suggestedRemediation: options.suggestedRemediation,
      parentSpanId: options.parentSpanId,
    });
  }

  // ===========================================================================
  // SESSION STATISTICS
  // ===========================================================================

  get beatCount(): number {
    return this._beats.length;
  }

  get currentSequence(): number {
    return this._sequenceCounter;
  }

  get currentAct(): number {
    return this._currentAct;
  }

  get beats(): BeatInfo[] {
    return [...this._beats];
  }

  get characterUpdates(): CharacterUpdate[] {
    return [...this._characterUpdates];
  }

  get themeUpdates(): ThemeUpdate[] {
    return [...this._themeUpdates];
  }

  getSessionSummary(): Record<string, unknown> {
    return {
      beat_count: this.beatCount,
      current_sequence: this.currentSequence,
      current_act: this.currentAct,
      character_updates_count: this._characterUpdates.length,
      theme_updates_count: this._themeUpdates.length,
      beats: this._beats,
    };
  }

  resetSession(): void {
    this._sequenceCounter = 0;
    this._currentAct = 1;
    this._beats = [];
    this._characterUpdates = [];
    this._themeUpdates = [];
  }
}
