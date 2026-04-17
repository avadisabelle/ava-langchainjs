/**
 * Polyphonic Parser
 *
 * Parses talking-circle markdown (multi-speaker documents) into
 * individual voice segments with speaker attribution. Supports the
 * polyphonic artifact parsing pattern from the literature landscape.
 *
 * Features:
 * - Speaker detection from markdown headers and "Name:" patterns
 * - Medicine Wheel direction attribution via keyword analysis
 * - Emotional tone detection via keyword matching
 * - Segment merging for consecutive same-speaker passages
 *
 * No LLM dependency — all classification is keyword-based.
 */

// =============================================================================
// Types
// =============================================================================

/**
 * A single voice segment — one speaker's contribution within
 * a polyphonic transcript.
 */
export interface VoiceSegment {
  /** Speaker name */
  speaker: string;
  /** Speaker's role (e.g., "facilitator", "participant", "observer") */
  role?: string;
  /** The content spoken or written */
  content: string;
  /** ISO timestamp if present in source */
  timestamp?: string;
  /** Medicine Wheel direction attribution */
  direction?: "east" | "south" | "west" | "north";
  /** Detected emotional tone */
  emotionalTone?: string;
  /** Start and end line numbers in source [start, end] */
  lineRange: [number, number];
}

/**
 * A fully parsed multi-speaker transcript.
 */
export interface ParsedTranscript {
  /** Document title if detected */
  title?: string;
  /** Document date if detected */
  date?: string;
  /** List of all unique speaker names */
  speakers: string[];
  /** Ordered list of voice segments */
  segments: VoiceSegment[];
  /** Additional metadata extracted from document frontmatter */
  metadata: Record<string, string>;
}

/**
 * Configuration options for PolyphonicParser.
 */
export interface PolyphonicParserOptions {
  /** Regex pattern for detecting speaker lines (default: markdown header or "Name:" pattern) */
  speakerPattern?: RegExp;
  /** Auto-detect Medicine Wheel direction from content (default true) */
  detectDirections?: boolean;
  /** Auto-detect emotional tone from content (default true) */
  detectEmotionalTone?: boolean;
}

// =============================================================================
// Direction Keywords (local to avoid hard dependency on prompt-decomposition)
// =============================================================================

/** Keywords for Medicine Wheel direction detection */
const DIRECTION_KEYWORDS: Record<string, string[]> = {
  east: [
    "vision", "goal", "purpose", "intention", "want", "need", "desire",
    "dream", "imagine", "envision", "aspire", "mission", "why", "objective",
    "outcome", "result", "achieve", "create", "build", "design",
  ],
  south: [
    "learn", "research", "investigate", "understand", "study", "analyze",
    "explore", "discover", "examine", "review", "compare", "assess",
    "dependency", "require", "prerequisite", "context", "background",
    "pattern", "existing", "current",
  ],
  west: [
    "test", "verify", "validate", "check", "ensure", "confirm",
    "reflect", "review", "audit", "quality", "feedback", "iterate",
    "ceremony", "accountable", "responsible", "ethical", "protocol",
    "appropriate", "respectful", "consent",
  ],
  north: [
    "implement", "execute", "deploy", "run", "build", "code", "script",
    "install", "configure", "setup", "create", "write", "develop",
    "ship", "launch", "deliver", "produce", "output", "generate",
    "commit", "push", "merge",
  ],
};

// =============================================================================
// Emotional Tone Keywords
// =============================================================================

/** Keywords for emotional tone detection */
const TONE_KEYWORDS: Record<string, string[]> = {
  hopeful: [
    "hope", "optimistic", "excited", "looking forward", "promising",
    "bright", "opportunity", "potential", "aspire", "believe",
  ],
  concerned: [
    "worried", "concerned", "risk", "careful", "caution", "uncertain",
    "fear", "afraid", "anxious", "nervous", "doubt",
  ],
  celebratory: [
    "celebrate", "success", "achievement", "accomplished", "proud",
    "joy", "grateful", "thankful", "wonderful", "amazing", "great",
  ],
  reflective: [
    "reflect", "consider", "think", "ponder", "wonder", "contemplate",
    "lesson", "learned", "realize", "insight", "understand", "remember",
  ],
  urgent: [
    "urgent", "immediately", "asap", "critical", "emergency", "now",
    "deadline", "pressing", "must", "required", "blocker",
  ],
  grief: [
    "loss", "grief", "mourn", "miss", "gone", "sad", "sorrow",
    "pain", "hurt", "difficult", "struggle", "heavy",
  ],
  ceremonial: [
    "ceremony", "sacred", "prayer", "offering", "spirit", "ancestor",
    "medicine", "circle", "gather", "honor", "witness", "gratitude",
  ],
};

// =============================================================================
// Role Keywords
// =============================================================================

/** Keywords for role detection */
const ROLE_KEYWORDS: Record<string, string[]> = {
  facilitator: [
    "let's begin", "i'd like to invite", "next we'll", "thank you for",
    "moving on to", "shall we", "let me summarize", "to wrap up",
  ],
  observer: [
    "i notice", "i observe", "from my perspective", "watching this",
    "it seems", "i'm seeing", "what strikes me",
  ],
  participant: [], // default role
};

// =============================================================================
// PolyphonicParser
// =============================================================================

/**
 * Parses multi-speaker markdown documents into structured transcripts
 * with speaker attribution, direction detection, and emotional tone.
 *
 * @example
 * ```typescript
 * const parser = new PolyphonicParser();
 *
 * const transcript = parser.parse(`
 * # Council Session
 *
 * ## Mia:
 * The architecture needs restructuring. We should build
 * a new module for the relational layer.
 *
 * ## Miette:
 * I feel the story wants to breathe here. There's a ceremony
 * in how these pieces come together.
 * `);
 *
 * console.log(transcript.speakers); // ["Mia", "Miette"]
 * console.log(transcript.segments[0].direction); // "north" (build/implement)
 * console.log(transcript.segments[1].emotionalTone); // "ceremonial"
 * ```
 */
export class PolyphonicParser {
  private readonly speakerPattern: RegExp;
  private readonly detectDirections: boolean;
  private readonly detectEmotionalTone: boolean;

  constructor(options?: PolyphonicParserOptions) {
    this.speakerPattern =
      options?.speakerPattern ?? /^(?:#{1,3}\s+)?(\w[\w\s]*?):\s*/m;
    this.detectDirections = options?.detectDirections ?? true;
    this.detectEmotionalTone = options?.detectEmotionalTone ?? true;
  }

  /**
   * Parse markdown text into a structured transcript.
   * Splits on speaker patterns, extracts metadata, detects
   * directions and emotional tones.
   */
  parse(markdown: string): ParsedTranscript {
    const lines = markdown.split("\n");
    const metadata: Record<string, string> = {};
    let title: string | undefined;
    let date: string | undefined;
    const segments: VoiceSegment[] = [];
    const speakersSet = new Set<string>();

    // Extract title from first H1
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    // Extract date from common patterns
    const dateMatch = markdown.match(
      /(?:date|Date|DATE):\s*(\d{4}[-/]\d{2}[-/]\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?)/
    );
    if (dateMatch) {
      date = dateMatch[1];
      metadata["date"] = date;
    }

    // Extract YAML-like frontmatter metadata
    const frontmatterMatch = markdown.match(/^---\s*\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const fmLines = frontmatterMatch[1].split("\n");
      for (const fmLine of fmLines) {
        const kvMatch = fmLine.match(/^(\w[\w\s]*?):\s*(.+)$/);
        if (kvMatch) {
          metadata[kvMatch[1].trim()] = kvMatch[2].trim();
        }
      }
      if (metadata["date"] && !date) {
        date = metadata["date"];
      }
      if (metadata["title"] && !title) {
        title = metadata["title"];
      }
    }

    // Parse speaker segments
    let currentSpeaker: string | null = null;
    let currentContent: string[] = [];
    let segmentStartLine = 0;

    // Build a global regex from the speaker pattern
    const speakerRegex = new RegExp(this.speakerPattern.source, "m");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(speakerRegex);

      if (match && match[1]) {
        // Found a new speaker — save previous segment
        if (currentSpeaker !== null && currentContent.length > 0) {
          const content = currentContent.join("\n").trim();
          if (content) {
            segments.push(
              this.buildSegment(
                currentSpeaker,
                content,
                segmentStartLine,
                i - 1
              )
            );
            speakersSet.add(currentSpeaker);
          }
        }

        currentSpeaker = match[1].trim();
        // Content after the speaker name on the same line
        const remainder = line.slice(match[0].length).trim();
        currentContent = remainder ? [remainder] : [];
        segmentStartLine = i + 1;
      } else if (currentSpeaker !== null) {
        currentContent.push(line);
      }
    }

    // Save final segment
    if (currentSpeaker !== null && currentContent.length > 0) {
      const content = currentContent.join("\n").trim();
      if (content) {
        segments.push(
          this.buildSegment(
            currentSpeaker,
            content,
            segmentStartLine,
            lines.length - 1
          )
        );
        speakersSet.add(currentSpeaker);
      }
    }

    return {
      title,
      date,
      speakers: [...speakersSet],
      segments,
      metadata,
    };
  }

  /**
   * Get all segments from a specific speaker.
   */
  filterBySpeaker(
    transcript: ParsedTranscript,
    speaker: string
  ): VoiceSegment[] {
    const lower = speaker.toLowerCase();
    return transcript.segments.filter(
      (s) => s.speaker.toLowerCase() === lower
    );
  }

  /**
   * Get segments by Medicine Wheel direction.
   */
  filterByDirection(
    transcript: ParsedTranscript,
    direction: string
  ): VoiceSegment[] {
    const lower = direction.toLowerCase();
    return transcript.segments.filter(
      (s) => s.direction === lower
    );
  }

  /**
   * Merge consecutive segments from the same speaker into single segments.
   * Preserves the first segment's metadata and extends the line range.
   */
  mergeConsecutive(segments: VoiceSegment[]): VoiceSegment[] {
    if (segments.length <= 1) return [...segments];

    const merged: VoiceSegment[] = [];
    let current = { ...segments[0] };

    for (let i = 1; i < segments.length; i++) {
      const next = segments[i];
      if (next.speaker === current.speaker) {
        // Merge: append content, extend line range
        current = {
          ...current,
          content: current.content + "\n\n" + next.content,
          lineRange: [current.lineRange[0], next.lineRange[1]],
        };
      } else {
        merged.push(current);
        current = { ...next };
      }
    }
    merged.push(current);

    return merged;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Build a VoiceSegment with optional direction and tone detection.
   */
  private buildSegment(
    speaker: string,
    content: string,
    startLine: number,
    endLine: number
  ): VoiceSegment {
    const segment: VoiceSegment = {
      speaker,
      content,
      lineRange: [startLine + 1, endLine + 1], // 1-indexed
    };

    // Detect role from content
    segment.role = this.detectRole(content);

    // Detect timestamp in content
    const tsMatch = content.match(
      /\[(\d{4}[-/]\d{2}[-/]\d{2}[T ]\d{2}:\d{2}(?::\d{2})?)\]/
    );
    if (tsMatch) {
      segment.timestamp = tsMatch[1];
    }

    // Detect direction
    if (this.detectDirections) {
      segment.direction = this.detectDirection(content);
    }

    // Detect emotional tone
    if (this.detectEmotionalTone) {
      segment.emotionalTone = this.detectTone(content);
    }

    return segment;
  }

  /**
   * Detect the dominant Medicine Wheel direction from content keywords.
   */
  private detectDirection(
    content: string
  ): "east" | "south" | "west" | "north" | undefined {
    const lower = content.toLowerCase();
    const words = lower.split(/\s+/);
    const scores: Record<string, number> = {
      east: 0,
      south: 0,
      west: 0,
      north: 0,
    };

    for (const [direction, keywords] of Object.entries(DIRECTION_KEYWORDS)) {
      for (const word of words) {
        for (const kw of keywords) {
          if (word.includes(kw)) {
            scores[direction]++;
            break;
          }
        }
      }
    }

    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    if (total === 0) return undefined;

    // Find highest scoring direction
    let best = "east";
    let max = -1;
    for (const [dir, score] of Object.entries(scores)) {
      if (score > max) {
        max = score;
        best = dir;
      }
    }

    return best as "east" | "south" | "west" | "north";
  }

  /**
   * Detect the dominant emotional tone from content keywords.
   */
  private detectTone(content: string): string | undefined {
    const lower = content.toLowerCase();
    const scores: Record<string, number> = {};

    for (const [tone, keywords] of Object.entries(TONE_KEYWORDS)) {
      let hits = 0;
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          hits++;
        }
      }
      if (hits > 0) {
        scores[tone] = hits;
      }
    }

    if (Object.keys(scores).length === 0) return undefined;

    // Return the tone with most keyword hits
    let best = "";
    let max = 0;
    for (const [tone, score] of Object.entries(scores)) {
      if (score > max) {
        max = score;
        best = tone;
      }
    }

    return best || undefined;
  }

  /**
   * Detect the speaker's role from content patterns.
   */
  private detectRole(content: string): string | undefined {
    const lower = content.toLowerCase();

    for (const [role, phrases] of Object.entries(ROLE_KEYWORDS)) {
      if (role === "participant") continue; // default, skip
      for (const phrase of phrases) {
        if (lower.includes(phrase)) {
          return role;
        }
      }
    }

    return "participant";
  }
}
