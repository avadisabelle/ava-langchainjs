/**
 * Inquiry Formatter
 *
 * Formats inquiries for consumption by different output channels:
 * - QMD semantic search queries (lex/vec/hyde modes)
 * - Academic deep-search queries with citation context
 * - Markdown reports for human review
 * - JSON serialization for storage and API transport
 *
 * This is the NORTH (Structure) function of inquiry routing —
 * preparing each inquiry for its journey into the knowledge stream.
 *
 * Canonical direction mapping: East=Vision, South=Action, West=Synthesis, North=Structure
 * (mcp-pde variant: WEST=Validation, NORTH=Action — see inquiry-router.md for canonical source)
 */

import type {
  Inquiry,
  InquiryBatch,
  QmdQuery,
  DeepSearchQuery,
  RoutedInquiryBatch,
} from "./types.js";
import { InquirySource } from "./types.js";

// =============================================================================
// Constants
// =============================================================================

const DIRECTION_EMOJI: Record<string, string> = {
  east: "🌅",
  south: "🌿",
  west: "🌊",
  north: "⚡",
};

/**
 * Direction labels follow canonical Medicine Wheel mapping:
 *   East=Vision, South=Action, West=Synthesis, North=Structure
 *
 * NOTE: mcp-pde uses a different mapping (WEST=Validation, NORTH=Action).
 * This package follows the canonical mapping from medicine-wheel-pi/agents/inquiry-router.md.
 * See also the DIRECTION_LABELS constant in the langgraph inquiry-routing-engine.
 */
const DIRECTION_LABEL: Record<string, string> = {
  east: "Waabinong (Vision)",
  south: "Zhaawanong (Action)",
  west: "Epangishmok (Synthesis)",
  north: "Kiiwedinong (Structure)",
};

const SOURCE_LABEL: Record<string, string> = {
  "qmd-local": "QMD Local Semantic",
  "deep-search-academic": "Deep Search Academic",
  "workspace-scan": "Workspace Scan",
};

// =============================================================================
// InquiryFormatter
// =============================================================================

/**
 * Formats inquiries for different output channels.
 *
 * @example
 * ```typescript
 * import { InquiryFormatter } from "ava-langchain-inquiry-routing";
 *
 * const formatter = new InquiryFormatter();
 *
 * // Format for QMD search
 * const qmdQuery = formatter.toQmdQuery(inquiry);
 *
 * // Render batch as markdown
 * const markdown = formatter.toMarkdown(batch);
 * ```
 */
export class InquiryFormatter {
  /**
   * Format an inquiry as a QMD semantic search query.
   *
   * QMD supports three search modes:
   * - lex: Lexical/keyword search
   * - vec: Vector similarity search
   * - hyde: Hypothetical document embedding search
   *
   * Mode selection is based on query structure:
   * - Short queries (< 10 words) → lex
   * - Questions → vec
   * - Complex queries → hyde
   */
  toQmdQuery(inquiry: Inquiry): QmdQuery {
    const wordCount = inquiry.query.split(/\s+/).length;
    const isQuestion = inquiry.query.trim().endsWith("?");

    let mode: QmdQuery["mode"];
    if (wordCount < 10 && !isQuestion) {
      mode = "lex";
    } else if (isQuestion) {
      mode = "vec";
    } else {
      mode = "hyde";
    }

    return {
      mode,
      query: inquiry.query,
      direction: inquiry.direction,
      context: inquiry.relational_context || undefined,
    };
  }

  /**
   * Format an inquiry as an academic deep-search query.
   *
   * Extracts search terms from the query and adds academic context
   * appropriate to the inquiry's direction and relational grounding.
   */
  toDeepSearchQuery(inquiry: Inquiry): DeepSearchQuery {
    const searchTerms = this.extractSearchTerms(inquiry.query);

    const academicContext = [
      inquiry.relational_context,
      inquiry.indigenous_lens,
      inquiry.western_lens,
    ]
      .filter(Boolean)
      .join(" ");

    return {
      query: inquiry.query,
      academic_context: academicContext || `Research inquiry from ${inquiry.direction} direction.`,
      direction: inquiry.direction,
      search_terms: searchTerms,
    };
  }

  /**
   * Render an inquiry batch as a structured Markdown report.
   */
  toMarkdown(batch: InquiryBatch): string {
    const lines: string[] = [];

    lines.push(`# Inquiry Report`);
    lines.push("");
    lines.push(`**Batch ID:** \`${batch.id}\``);
    lines.push(`**PDE Source:** \`${batch.pde_id}\``);
    lines.push(`**Generated:** ${batch.timestamp}`);
    lines.push(`**Total Inquiries:** ${batch.total}`);
    lines.push("");

    // Render each direction
    for (const direction of ["east", "south", "west", "north"] as const) {
      const inquiries = batch[direction];
      if (inquiries.length === 0) continue;

      const emoji = DIRECTION_EMOJI[direction];
      const label = DIRECTION_LABEL[direction];

      lines.push(`## ${emoji} ${label}`);
      lines.push("");

      for (const inquiry of inquiries) {
        lines.push(`### ${inquiry.query}`);
        lines.push("");
        lines.push(`- **Source:** ${SOURCE_LABEL[inquiry.source] ?? inquiry.source}`);
        lines.push(`- **Status:** ${inquiry.status}`);
        lines.push(`- **Confidence:** ${(inquiry.confidence * 100).toFixed(0)}%`);

        if (inquiry.relational_context) {
          lines.push(`- **Relational Context:** ${inquiry.relational_context}`);
        }
        if (inquiry.accountability) {
          lines.push(`- **Accountability:** ${inquiry.accountability}`);
        }
        if (inquiry.ceremonial_intent) {
          lines.push(`- **Ceremonial Intent:** ${inquiry.ceremonial_intent}`);
        }
        if (inquiry.indigenous_lens) {
          lines.push(`- **Indigenous Lens:** ${inquiry.indigenous_lens}`);
        }
        if (inquiry.western_lens) {
          lines.push(`- **Western Lens:** ${inquiry.western_lens}`);
        }
        if (inquiry.response) {
          lines.push("");
          lines.push(`> **Response:** ${inquiry.response}`);
        }

        lines.push("");
      }
    }

    // Add routing decisions if present
    const routed = batch as RoutedInquiryBatch;
    if (routed.decisions?.length) {
      lines.push(`## 🔀 Routing Decisions`);
      lines.push("");
      lines.push("| Inquiry | Source | Confidence | Keywords |");
      lines.push("|---------|--------|------------|----------|");

      for (const decision of routed.decisions) {
        const kwStr = decision.matched_keywords.length > 0
          ? decision.matched_keywords.join(", ")
          : "—";
        lines.push(
          `| \`${decision.inquiry_id.slice(0, 8)}…\` | ${decision.source} | ${(decision.confidence * 100).toFixed(0)}% | ${kwStr} |`
        );
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Serialize an inquiry batch to JSON.
   */
  toJSON(batch: InquiryBatch): string {
    return JSON.stringify(batch, null, 2);
  }

  /**
   * Serialize a single inquiry to JSON.
   */
  inquiryToJSON(inquiry: Inquiry): string {
    return JSON.stringify(inquiry, null, 2);
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  /**
   * Extract meaningful search terms from a query string.
   * Removes common stop words and short words.
   */
  private extractSearchTerms(query: string): string[] {
    const stopWords = new Set([
      "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
      "have", "has", "had", "do", "does", "did", "will", "would", "could",
      "should", "may", "might", "shall", "can", "need", "must", "ought",
      "to", "of", "in", "for", "on", "with", "at", "by", "from", "as",
      "into", "through", "during", "before", "after", "above", "below",
      "between", "out", "off", "over", "under", "again", "further",
      "then", "once", "here", "there", "when", "where", "why", "how",
      "all", "each", "every", "both", "few", "more", "most", "other",
      "some", "such", "no", "nor", "not", "only", "own", "same", "so",
      "than", "too", "very", "just", "about", "what", "which", "who",
      "this", "that", "these", "those", "it", "its", "we", "they",
      "and", "but", "or", "if", "while", "because",
    ]);

    return query
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));
  }
}
