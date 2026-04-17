/**
 * Accountability Gap Detection — Preventing Unroutable Work
 *
 * This example demonstrates:
 *
 *   An accountability gap in the spec means a state where no role is named.
 *   At runtime, that means no agent session knows to pick up the work.
 *   The work sits unrouted. The ceremony stalls. The system deadlocks.
 *
 *   Validation that catches accountability gaps before the graph runs is not
 *   philosophical hygiene — it is preventing unroutable work from entering
 *   the system.
 *
 * The example:
 *   1. Creates a spec with deliberate accountability gaps
 *   2. Shows what those gaps look like (unroutable states)
 *   3. Fixes the gaps by assigning accountability
 *   4. Validates the fixed spec is fully routable
 *
 * Run with: pnpm run start ./src/accountability-routing/accountability_gap_detection.ts
 */

import {
  createStateMachineSpec,
  createStateSpec,
  createTransitionSpec,
  validateSpec,
  inferAccountabilityFromSpec,
  findAccountabilityGaps,
  generateAccountabilityNarrative,
  type StateMachineSpec,
  type AccountabilityMap,
} from "ava-langchain-state-machine-spec";

// ---------------------------------------------------------------------------
// 1. Create a spec with DELIBERATE accountability gaps
//
//    This models a document approval workflow. Notice that some states
//    have no accountability assigned — nobody holds them.
// ---------------------------------------------------------------------------

function createGappySpec(): StateMachineSpec {
  return createStateMachineSpec(
    "document_approval_gappy",
    "A document approval workflow with accountability gaps",
    "draft",
    {
      finalStates: ["published", "archived"],
      states: [
        createStateSpec("draft", "Document is being written", {
          allowedTransitions: ["submit_for_review"],
        }),
        createStateSpec("in_review", "Document is under review", {
          allowedTransitions: ["approve", "reject"],
        }),
        createStateSpec("revision", "Document needs revision", {
          allowedTransitions: ["resubmit"],
        }),
        createStateSpec("approved", "Document is approved, awaiting publish", {
          allowedTransitions: ["publish", "archive"],
        }),
        createStateSpec("published", "Document is live", { isTerminal: true }),
        createStateSpec("archived", "Document is archived", {
          isTerminal: true,
        }),
      ],
      transitions: [
        createTransitionSpec("submit_for_review", "draft", "in_review"),
        createTransitionSpec("approve", "in_review", "approved"),
        createTransitionSpec("reject", "in_review", "revision"),
        createTransitionSpec("resubmit", "revision", "in_review"),
        createTransitionSpec("publish", "approved", "published"),
        createTransitionSpec("archive", "approved", "archived"),
      ],
      metadata: {
        version: "1.0.0",
        author: "ava",
        langgraphCompatible: true,
        // DELIBERATE GAPS: only some states have accountability assigned.
        // "revision", "approved", "published", "archived" are missing.
        relationalContext: {
          entities: ["writer", "editor", "publisher"],
          responsibilities: "Partial assignment — gaps exist.",
          stateResponsibilities: {
            draft: ["writer"],
            in_review: ["editor"],
            // revision: ???  — nobody holds this
            // approved: ???  — nobody holds this
            // published: ??? — nobody holds this
            // archived: ???  — nobody holds this
          },
        },
      },
    }
  );
}

// ---------------------------------------------------------------------------
// 2. Create the fixed spec — all states have accountability
// ---------------------------------------------------------------------------

function createFixedSpec(): StateMachineSpec {
  return createStateMachineSpec(
    "document_approval_complete",
    "A document approval workflow with complete accountability",
    "draft",
    {
      finalStates: ["published", "archived"],
      states: [
        createStateSpec("draft", "Document is being written", {
          allowedTransitions: ["submit_for_review"],
        }),
        createStateSpec("in_review", "Document is under review", {
          allowedTransitions: ["approve", "reject"],
        }),
        createStateSpec("revision", "Document needs revision", {
          allowedTransitions: ["resubmit"],
        }),
        createStateSpec("approved", "Document is approved, awaiting publish", {
          allowedTransitions: ["publish", "archive"],
        }),
        createStateSpec("published", "Document is live", { isTerminal: true }),
        createStateSpec("archived", "Document is archived", {
          isTerminal: true,
        }),
      ],
      transitions: [
        createTransitionSpec("submit_for_review", "draft", "in_review"),
        createTransitionSpec("approve", "in_review", "approved"),
        createTransitionSpec("reject", "in_review", "revision"),
        createTransitionSpec("resubmit", "revision", "in_review"),
        createTransitionSpec("publish", "approved", "published"),
        createTransitionSpec("archive", "approved", "archived"),
      ],
      metadata: {
        version: "1.0.0",
        author: "ava",
        langgraphCompatible: true,
        // COMPLETE: every state names who holds it
        relationalContext: {
          entities: ["writer", "editor", "publisher"],
          responsibilities:
            "Writer holds draft and revision. Editor holds review. " +
            "Publisher holds approved, published, and archived.",
          stateResponsibilities: {
            draft: ["writer"],
            in_review: ["editor"],
            revision: ["writer"], // writer takes it back
            approved: ["publisher"], // publisher decides what to do
            published: ["publisher"], // publisher holds the record
            archived: ["publisher"], // publisher holds the archive
          },
        },
      },
    }
  );
}

// ---------------------------------------------------------------------------
// 3. Run the analysis
// ---------------------------------------------------------------------------

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║  Accountability Gap Detection — Preventing Unroutable   ║");
console.log("║  Work From Entering the System                         ║");
console.log("╚══════════════════════════════════════════════════════════╝");
console.log();

// --- Gappy spec ---

const gappySpec = createGappySpec();
const gappyValidation = validateSpec(gappySpec);
const gappyMap: AccountabilityMap = inferAccountabilityFromSpec(gappySpec);
const gappyGaps = findAccountabilityGaps(gappyMap);

console.log("=== BEFORE: Spec with Accountability Gaps ===");
console.log();
console.log(`Spec is structurally valid: ${gappyValidation.valid}`);
console.log(
  `But structural validity is not enough. Check accountability...`
);
console.log();

console.log("State routing table:");
for (const resp of gappyMap.stateResponsibilities) {
  const holders =
    resp.primaryHolders.length > 0
      ? resp.primaryHolders.join(", ")
      : "** NOBODY — UNROUTABLE **";
  const marker = resp.primaryHolders.length > 0 ? "  " : "! ";
  console.log(`${marker} "${resp.stateName}" → ${holders}`);
}
console.log();

if (gappyGaps.length > 0) {
  console.log(`Found ${gappyGaps.length} accountability gap(s):`);
  for (const gap of gappyGaps) {
    console.log(`  - "${gap}": No entity holds responsibility.`);
    console.log(
      `    At runtime: work enters this state and no agent session picks it up.`
    );
    console.log(`    The graph stalls. The ceremony breaks.`);
  }
} else {
  console.log("No gaps found.");
}
console.log();

console.log("Narrative of the gappy spec:");
console.log("---");
console.log(generateAccountabilityNarrative(gappySpec, gappyMap));
console.log("---");
console.log();

// --- Fixed spec ---

const fixedSpec = createFixedSpec();
const fixedValidation = validateSpec(fixedSpec);
const fixedMap: AccountabilityMap = inferAccountabilityFromSpec(fixedSpec);
const fixedGaps = findAccountabilityGaps(fixedMap);

console.log("=== AFTER: Spec with Complete Accountability ===");
console.log();
console.log(`Spec is structurally valid: ${fixedValidation.valid}`);
console.log();

console.log("State routing table:");
for (const resp of fixedMap.stateResponsibilities) {
  const holders =
    resp.primaryHolders.length > 0
      ? resp.primaryHolders.join(", ")
      : "** NOBODY — UNROUTABLE **";
  console.log(`  "${resp.stateName}" → ${holders}`);
}
console.log();

if (fixedGaps.length > 0) {
  console.log(`Still found ${fixedGaps.length} gap(s). More work needed.`);
} else {
  console.log("No accountability gaps. Every state has a route.");
  console.log("Every node in the graph will be picked up by an agent session.");
  console.log("The ceremony can complete. The system will not deadlock.");
}
console.log();

console.log("Narrative of the complete spec:");
console.log("---");
console.log(generateAccountabilityNarrative(fixedSpec, fixedMap));
console.log("---");
