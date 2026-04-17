/**
 * Accountability as Routing
 *
 * This example demonstrates the core insight:
 *
 *   The "accountability" field in a state machine spec is not just a label —
 *   it is a routing address. When the graph enters a state, the system asks:
 *   "Which agent session on this server holds this role?" and sends the work there.
 *
 *   Accountability = Assignment = Session Routing.
 *
 *   The ceremonial question ("who holds this?") and the engineering question
 *   ("which agent process handles this node?") are the same question asked
 *   in two languages.
 *
 * Run with: pnpm run start ./src/accountability-routing/accountability_as_routing.ts
 */

import {
  createStateMachineSpec,
  createStateSpec,
  createTransitionSpec,
  validateSpec,
  inferAccountabilityFromSpec,
  findAccountabilityGaps,
  getResponsibleAt,
  generateAccountabilityNarrative,
  generateMermaid,
  type AccountabilityMap,
} from "ava-langchain-state-machine-spec";

// ---------------------------------------------------------------------------
// 1. Define a workflow spec with relational accountability
//
//    Imagine a code review ceremony with three roles:
//    - author: writes the code, holds it through drafting
//    - reviewer: receives the code, holds it through review
//    - maintainer: merges or closes, holds the final gate
// ---------------------------------------------------------------------------

const codeReviewSpec = createStateMachineSpec(
  "code_review_ceremony",
  "A code review workflow where accountability maps to agent sessions",
  "drafting",
  {
    finalStates: ["merged", "closed"],
    states: [
      createStateSpec("drafting", "Author is preparing the change", {
        allowedTransitions: ["submit_for_review"],
      }),
      createStateSpec("under_review", "Reviewer is examining the change", {
        entryConditions: ["At least one reviewer assigned"],
        allowedTransitions: ["approve", "request_changes", "close"],
      }),
      createStateSpec("changes_requested", "Author is addressing feedback", {
        allowedTransitions: ["resubmit"],
      }),
      createStateSpec("approved", "Maintainer decides on merge", {
        allowedTransitions: ["merge", "close"],
      }),
      createStateSpec("merged", "Change is integrated", { isTerminal: true }),
      createStateSpec("closed", "Change is withdrawn", { isTerminal: true }),
    ],
    transitions: [
      createTransitionSpec("submit_for_review", "drafting", "under_review", {
        actions: ["notify_reviewer"],
      }),
      createTransitionSpec("approve", "under_review", "approved", {
        preconditions: ["All required reviewers approved"],
      }),
      createTransitionSpec(
        "request_changes",
        "under_review",
        "changes_requested",
        {
          actions: ["notify_author"],
        }
      ),
      createTransitionSpec("resubmit", "changes_requested", "under_review", {
        actions: ["notify_reviewer"],
      }),
      createTransitionSpec("merge", "approved", "merged", {
        preconditions: ["CI passes", "No merge conflicts"],
        actions: ["merge_branch", "notify_team"],
      }),
      createTransitionSpec("close", "under_review", "closed", {
        actions: ["notify_author"],
      }),
    ],
    metadata: {
      version: "1.0.0",
      author: "ava",
      langgraphCompatible: true,
      // This is where accountability lives in the spec.
      // Each state names WHO holds it. At runtime, this becomes
      // the session routing table.
      relationalContext: {
        entities: ["author", "reviewer", "maintainer"],
        responsibilities:
          "Each role holds accountability during specific states. " +
          "The author holds during drafting and changes_requested. " +
          "The reviewer holds during under_review. " +
          "The maintainer holds during approved.",
        stateResponsibilities: {
          drafting: ["author"],
          under_review: ["reviewer"],
          changes_requested: ["author"],
          approved: ["maintainer"],
          merged: ["maintainer"],
          closed: ["maintainer"],
        },
      },
    },
  }
);

// ---------------------------------------------------------------------------
// 2. Validate the spec
// ---------------------------------------------------------------------------

const validation = validateSpec(codeReviewSpec);
console.log("=== Spec Validation ===");
console.log(`Valid: ${validation.valid}`);
console.log(`States: ${validation.properties.stateCount}`);
console.log(`Transitions: ${validation.properties.transitionCount}`);
console.log(
  `Reachable: ${validation.properties.reachableStates.join(", ")}`
);
if (validation.properties.unreachableStates.length > 0) {
  console.log(
    `Unreachable: ${validation.properties.unreachableStates.join(", ")}`
  );
}
if (validation.properties.deadlockedStates.length > 0) {
  console.log(
    `Deadlocked: ${validation.properties.deadlockedStates.join(", ")}`
  );
}
console.log();

// ---------------------------------------------------------------------------
// 3. Infer the accountability map — this IS the routing table
// ---------------------------------------------------------------------------

const accountabilityMap: AccountabilityMap =
  inferAccountabilityFromSpec(codeReviewSpec);

console.log("=== Accountability Map (= Session Routing Table) ===");
console.log();

for (const resp of accountabilityMap.stateResponsibilities) {
  const holders =
    resp.primaryHolders.length > 0
      ? resp.primaryHolders.join(", ")
      : "[UNASSIGNED — no agent will pick this up!]";
  console.log(`  State "${resp.stateName}" → routed to: ${holders}`);
}
console.log();

// ---------------------------------------------------------------------------
// 4. Show the mapping: role → agent session
//
//    On a local server, each role maps to an agent session.
//    The accountability map tells the router which session handles what.
// ---------------------------------------------------------------------------

console.log("=== Role → Agent Session Mapping ===");
console.log();

// Simulate a local server with agent sessions
const agentSessions: Record<string, { sessionId: string; role: string }> = {
  author: { sessionId: "session-author-001", role: "author" },
  reviewer: { sessionId: "session-reviewer-002", role: "reviewer" },
  maintainer: { sessionId: "session-maintainer-003", role: "maintainer" },
};

for (const entity of accountabilityMap.entities) {
  const session = agentSessions[entity.role];
  if (session) {
    console.log(
      `  Role "${entity.role}" → Agent Session ${session.sessionId}`
    );
    console.log(
      `    Responsible for states: ${entity.responsibleStates.join(", ")}`
    );
  }
}
console.log();

// ---------------------------------------------------------------------------
// 5. Demonstrate routing: given a current state, who handles it?
// ---------------------------------------------------------------------------

console.log("=== Routing Demonstration ===");
console.log();

const statesToRoute = [
  "drafting",
  "under_review",
  "changes_requested",
  "approved",
];

for (const stateName of statesToRoute) {
  const responsibility = getResponsibleAt(accountabilityMap, stateName);
  if (responsibility && responsibility.primaryHolders.length > 0) {
    const role = responsibility.primaryHolders[0];
    const session = agentSessions[role];
    console.log(
      `  Graph enters "${stateName}" → ` +
        `route to ${role} (${session?.sessionId ?? "no session!"})`
    );
    if (responsibility.waitingEntities.length > 0) {
      console.log(
        `    Waiting respectfully: ${responsibility.waitingEntities.join(", ")}`
      );
    }
  } else {
    console.log(
      `  Graph enters "${stateName}" → ` +
        `NO ROUTE — work sits unrouted. System deadlocks.`
    );
  }
}
console.log();

// ---------------------------------------------------------------------------
// 6. Check for gaps — unroutable states
// ---------------------------------------------------------------------------

const gaps = findAccountabilityGaps(accountabilityMap);
if (gaps.length === 0) {
  console.log("=== No Accountability Gaps ===");
  console.log("  Every state has a route. No work will be stranded.");
} else {
  console.log("=== Accountability Gaps Found ===");
  for (const gap of gaps) {
    console.log(`  State "${gap}" has no accountability assignment.`);
    console.log(`  At runtime, no agent session will pick up this work.`);
  }
}
console.log();

// ---------------------------------------------------------------------------
// 7. Generate the full narrative — the human-readable story of routing
// ---------------------------------------------------------------------------

console.log("=== Accountability Narrative ===");
console.log();
console.log(
  generateAccountabilityNarrative(codeReviewSpec, accountabilityMap)
);
console.log();

// ---------------------------------------------------------------------------
// 8. Visualize as Mermaid state diagram
// ---------------------------------------------------------------------------

console.log("=== Mermaid State Diagram ===");
console.log("(paste into https://mermaid.live to render)");
console.log();
console.log(
  generateMermaid(codeReviewSpec, {
    showConditions: true,
    showActions: true,
  })
);
