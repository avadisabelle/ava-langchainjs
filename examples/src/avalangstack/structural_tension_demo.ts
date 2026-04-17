/**
 * AvaLangStack — Structural Tension End-to-End Demo
 *
 * This example demonstrates the four core chain primitives working together
 * in a realistic development scenario:
 *
 *   1. StructuralTensionChain — evaluate the gap between current reality
 *      (monolith, no tests, siloed team) and desired outcome (microservices,
 *      full coverage, daily ceremonies). The resulting TensionVector drives
 *      all downstream routing.
 *
 *   2. PolyphonicParser — parse a multi-speaker talking-circle transcript
 *      from the ceremony. Each speaker's contribution is attributed with
 *      Medicine Wheel direction and emotional tone.
 *
 *   3. EpisodeBundler — bundle the session artifacts (narrative spans) into
 *      an episode with kinship-aware metadata for cross-session continuity.
 *
 *   4. ExecutionPlanner — take a prompt decomposition result and produce a
 *      staged execution plan with checkpoints and fallback strategies.
 *
 * All primitives are zero-LLM — keyword-based analysis only.
 *
 * Run with:
 *   pnpm run start ./src/avalangstack/structural_tension_demo.ts
 */

// ---------------------------------------------------------------------------
// Imports from AvaLangStack packages
// ---------------------------------------------------------------------------

import {
  StructuralTensionChain,
  type TensionVector,
  type RoutingSignal,
} from "ava-langchain-relational-intelligence";

import {
  PolyphonicParser,
  EpisodeBundler,
  NarrativeEventType,
  createNarrativeSpan,
  type VoiceSegment,
  type ParsedTranscript,
  type EpisodeBundle,
  type NarrativeSpan,
} from "ava-langchain-narrative-tracing";

import {
  DirectionalDecomposer,
  IntentExtractor,
  DependencyMapper,
  ActionStackBuilder,
  ExecutionPlanner,
  type DecompositionResult,
  type ExecutionPlan,
} from "ava-langchain-prompt-decomposition";

// ═══════════════════════════════════════════════════════════════════════════
// 1. Evaluate Structural Tension
//
//    The team is considering migrating from a monolith to microservices.
//    We measure the gap across four dimensions: technical, relational,
//    ceremonial, and narrative.
// ═══════════════════════════════════════════════════════════════════════════

console.log("═".repeat(72));
console.log("  1. STRUCTURAL TENSION EVALUATION");
console.log("═".repeat(72));
console.log();

const chain = new StructuralTensionChain();

const currentReality =
  "We have a monolith with no tests. The team works in silos. " +
  "No code review ceremony exists. Deployments are manual and fragile. " +
  "There is no shared story of where the architecture is headed.";

const desiredOutcome =
  "Microservices architecture with full test coverage and CI/CD pipeline. " +
  "Daily standup ceremonies with the team. Code review as relational practice. " +
  "A shared narrative chronicle that tracks every episode of the migration journey.";

const vector: TensionVector = chain.evaluate(currentReality, desiredOutcome);

console.log(`  Current Reality: "${currentReality.slice(0, 80)}..."`);
console.log(`  Desired Outcome: "${desiredOutcome.slice(0, 80)}..."`);
console.log();
console.log(`  Overall Magnitude: ${(vector.magnitude * 100).toFixed(1)}%`);
console.log(`  Direction: ${vector.direction}`);
console.log();
console.log("  Per-Dimension Breakdown:");
for (const comp of vector.components) {
  const bar = "█".repeat(Math.round(comp.gap * 20));
  console.log(
    `    ${comp.dimension.padEnd(12)} ${bar} ${(comp.gap * 100).toFixed(0)}%`
  );
  if (comp.keywords.length > 0) {
    console.log(
      `${"".padEnd(17)}keywords: ${comp.keywords.slice(0, 6).join(", ")}`
    );
  }
}
console.log();

// Derive routing signal
const signal: RoutingSignal = chain.toRoutingSignal(vector);

console.log("  Routing Signal:");
console.log(`    Recommended Direction: ${signal.recommendedDirection.toUpperCase()}`);
console.log(`    Confidence: ${(signal.confidence * 100).toFixed(0)}%`);
console.log(`    Rationale: ${signal.rationale}`);
console.log();

// ═══════════════════════════════════════════════════════════════════════════
// 2. Parse Talking-Circle Transcript
//
//    After the structural tension was surfaced, the team held a talking
//    circle. Three speakers shared their perspectives. The PolyphonicParser
//    extracts each voice with direction attribution and emotional tone.
// ═══════════════════════════════════════════════════════════════════════════

console.log("═".repeat(72));
console.log("  2. POLYPHONIC PARSER — Talking Circle Transcript");
console.log("═".repeat(72));
console.log();

const talkingCircleMarkdown = `# Migration Talking Circle — 2025-01-15

## Mia (Architect)

The monolith is our biggest technical debt. We need to design clear service
boundaries before we build anything. I envision three core services: user
management, data pipeline, and the narrative engine. The goal is to achieve
independent deployability so each team can ship without blocking others.

Testing infrastructure must come first — you cannot refactor what you cannot
verify. I want 80% coverage on critical paths before we touch the monolith.

## Tushell (Elder / Facilitator)

Before we rush to build, let us pause and reflect on what the monolith has
given us. It carried us here. We should honor that journey and acknowledge
the relationships the team formed around it. We gather in ceremony not to
destroy the old, but to offer gratitude and carry forward what served us.

I ask: has each person consented to this change? Have we listened to the
quietest voice? The medicine wheel teaches that vision without ceremony is
just ambition. Let us move with intention and accountability.

## Miette (Story Engine)

Every migration is a story. The monolith is our protagonist facing a crisis —
it can no longer carry the weight of the tale. The microservices are the
ensemble cast that will share the narrative burden. I want to chronicle each
episode of this journey: the first service extracted, the first ceremony held,
the moment the team felt trust shift. This story will become our knowledge
base, the telling that guides future teams who face the same tension.
`;

const parser = new PolyphonicParser({ detectDirections: true, detectEmotionalTone: true });
const transcript: ParsedTranscript = parser.parse(talkingCircleMarkdown);

console.log(`  Title: ${transcript.title ?? "(untitled)"}`);
console.log(`  Date: ${transcript.date ?? "(no date)"}`);
console.log(`  Speakers: ${transcript.speakers.join(", ")}`);
console.log(`  Segments: ${transcript.segments.length}`);
console.log();

for (const seg of transcript.segments) {
  const direction = seg.direction ? ` [${seg.direction.toUpperCase()}]` : "";
  const tone = seg.emotionalTone ? ` — tone: ${seg.emotionalTone}` : "";
  console.log(`  🗣️  ${seg.speaker}${direction}${tone}`);
  // Show first 120 chars of content
  const preview = seg.content.replace(/\n/g, " ").trim().slice(0, 120);
  console.log(`      "${preview}..."`);
  console.log();
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Bundle as Episode
//
//    We create narrative spans representing the ceremony and the tension
//    evaluation, then bundle them into an episode with kinship metadata.
// ═══════════════════════════════════════════════════════════════════════════

console.log("═".repeat(72));
console.log("  3. EPISODE BUNDLER — Session Artifact Bundling");
console.log("═".repeat(72));
console.log();

const sessionId = "session-migration-ceremony-001";
const traceId = "trace-migration-2025-01-15";
const storyId = "story-monolith-to-microservices";

// Create narrative spans representing work done in this session
const spans: NarrativeSpan[] = [
  createNarrativeSpan({
    spanId: "span-tension-eval",
    traceId,
    eventType: NarrativeEventType.MEDICINE_WHEEL_ASSESSMENT,
    storyId,
    sessionId,
    emotionalTone: "analytical",
    inputData: { currentReality, desiredOutcome },
    outputData: { magnitude: vector.magnitude, direction: vector.direction },
  }),
  createNarrativeSpan({
    spanId: "span-talking-circle",
    traceId,
    eventType: NarrativeEventType.NARRATIVE_CHECKPOINT,
    storyId,
    sessionId,
    emotionalTone: "reflective",
    characterIds: ["mia", "tushell", "miette"],
    inputData: { speakers: transcript.speakers, segmentCount: transcript.segments.length },
  }),
  createNarrativeSpan({
    spanId: "span-routing-decision",
    traceId,
    eventType: NarrativeEventType.ROUTING_DECISION,
    storyId,
    sessionId,
    emotionalTone: "decisive",
    outputData: {
      recommendedDirection: signal.recommendedDirection,
      confidence: signal.confidence,
    },
  }),
];

const bundler = new EpisodeBundler();
const episode: EpisodeBundle = bundler.bundle(sessionId, spans, {
  speakers: transcript.speakers,
  roles: ["architect", "facilitator", "narrator"],
  relationships: [
    "Mia architects what Tushell blesses",
    "Miette chronicles what the team creates",
    "Tushell ensures ceremony before action",
  ],
  consent: "granted",
});

console.log(`  Episode ID: ${episode.id}`);
console.log(`  Title: ${episode.title}`);
console.log(`  Session: ${episode.sessionId}`);
console.log(`  Spans: ${episode.spans.length}`);
console.log(`  Tags: ${episode.tags.join(", ")}`);
console.log(`  Summary: ${episode.summary}`);
console.log();
console.log("  Kinship Record:");
console.log(`    Speakers: ${episode.kinship.speakers.join(", ")}`);
console.log(`    Roles: ${episode.kinship.roles.join(", ")}`);
console.log(`    Consent: ${episode.kinship.consent}`);
console.log(`    Relationships:`);
for (const rel of episode.kinship.relationships) {
  console.log(`      • ${rel}`);
}
console.log();

// ═══════════════════════════════════════════════════════════════════════════
// 4. Decompose & Plan Execution
//
//    The structural tension evaluation surfaced that technical and
//    ceremonial gaps are highest. We decompose a prompt that addresses
//    both, then plan execution with checkpoints.
// ═══════════════════════════════════════════════════════════════════════════

console.log("═".repeat(72));
console.log("  4. EXECUTION PLANNER — From Decomposition to Action");
console.log("═".repeat(72));
console.log();

const migrationPrompt =
  "Extract the user-management service from the monolith. " +
  "First, envision the API boundary and design the schema for the new service. " +
  "Then research which authentication library to use and analyze migration risks. " +
  "Hold a ceremony with the team to validate the approach and reflect on consent. " +
  "Finally, implement the extraction, deploy to staging, build the CI pipeline, " +
  "and execute integration tests. Document the whole journey as a story episode.";

console.log(`  Prompt: "${migrationPrompt.slice(0, 100)}..."`);
console.log();

// Layer 1: Directional decomposition
const decomposer = new DirectionalDecomposer();
const directionalAnalysis = decomposer.decompose(migrationPrompt);

console.log("  Directional Analysis:");
for (const insight of directionalAnalysis.insights) {
  console.log(
    `    ${insight.direction.toUpperCase().padEnd(6)} ` +
    `(${(insight.confidence * 100).toFixed(0)}%) "${insight.text.slice(0, 70)}..."`
  );
}
console.log();

// Layer 2: Intent extraction
const extractor = new IntentExtractor();
const intentResult = await extractor.extract(migrationPrompt);

console.log("  Intent Extraction:");
console.log(
  `    Primary: "${intentResult.primary.text}" ` +
  `(urgency: ${intentResult.primary.urgency})`
);
console.log(`    Secondary intents: ${intentResult.secondary.length}`);
for (const sec of intentResult.secondary.slice(0, 5)) {
  console.log(`      • "${sec.text}" [${sec.direction}]`);
}
console.log();

// Layer 3: Dependency mapping
const mapper = new DependencyMapper();
const graph = mapper.buildGraph(intentResult.secondary);
const order = mapper.computeExecutionOrder(graph);

console.log("  Execution Order:");
for (let i = 0; i < order.phases.length; i++) {
  const phase = order.phases[i];
  console.log(`    Phase ${i + 1}: ${phase.items.map((it) => it.id).join(", ")}`);
}
console.log();

// Layer 4: Action stack
const builder = new ActionStackBuilder();
const decomposition: DecompositionResult = builder.build(
  directionalAnalysis,
  intentResult,
  order
);

console.log(`  Decomposition: ${decomposition.actions.length} actions`);
console.log(`  Ambiguities: ${decomposition.ambiguities.length}`);
console.log();

// Layer 5: Execution planning
const planner = new ExecutionPlanner();
const plan: ExecutionPlan = planner.plan(decomposition);

console.log("  Execution Plan:");
console.log(`    Plan ID: ${plan.id}`);
console.log(`    Stages: ${plan.stages.length}`);
console.log(`    Checkpoints: ${plan.checkpoints.length}`);
console.log(`    Fallbacks: ${plan.fallbacks.length}`);
console.log(`    Complexity: ${plan.estimatedComplexity}`);
console.log();

for (const stage of plan.stages) {
  console.log(`    📋 Stage: ${stage.title} [${stage.direction.toUpperCase()}]`);
  console.log(`       Complexity: ${stage.estimatedComplexity}`);
  if (stage.dependencies.length > 0) {
    console.log(`       Depends on: ${stage.dependencies.join(", ")}`);
  }
  for (const action of stage.actions) {
    console.log(`         → ${action.text}`);
  }
  console.log();
}

if (plan.checkpoints.length > 0) {
  console.log("  Checkpoints:");
  for (const cp of plan.checkpoints) {
    const reviewTag = cp.requiresHumanReview ? " 🛑 HUMAN REVIEW" : "";
    console.log(`    ✓ After stage ${cp.afterStageId}:${reviewTag}`);
    console.log(`      ${cp.description}`);
    for (const criterion of cp.validationCriteria) {
      console.log(`        • ${criterion}`);
    }
  }
  console.log();
}

if (plan.successCriteria.length > 0) {
  console.log("  Success Criteria:");
  for (const criterion of plan.successCriteria) {
    console.log(`    ✅ ${criterion}`);
  }
  console.log();
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Summary — Connecting the Dots
// ═══════════════════════════════════════════════════════════════════════════

console.log("═".repeat(72));
console.log("  5. SUMMARY — End-to-End Flow");
console.log("═".repeat(72));
console.log();
console.log("  Structural Tension →");
console.log(`    Magnitude ${(vector.magnitude * 100).toFixed(0)}% ` +
  `(${vector.direction}) → route ${signal.recommendedDirection.toUpperCase()}`);
console.log();
console.log("  Talking Circle →");
console.log(`    ${transcript.speakers.length} speakers, ` +
  `${transcript.segments.length} segments parsed`);
console.log();
console.log("  Episode →");
console.log(`    "${episode.title}" with ${episode.spans.length} spans, ` +
  `consent: ${episode.kinship.consent}`);
console.log();
console.log("  Execution Plan →");
console.log(`    ${plan.stages.length} stages across Four Directions, ` +
  `${plan.checkpoints.length} checkpoints, ` +
  `complexity: ${plan.estimatedComplexity}`);
console.log();
console.log("  Done. All primitives exercised with zero LLM calls.");
console.log();
