/**
 * Agent Session Router — Accountability Map as Runtime Dispatcher
 *
 * This example builds the bridge between spec and execution:
 *
 *   1. A state machine spec declares WHO holds each state (accountability)
 *   2. A local server maintains agent sessions, each bound to a role
 *   3. The AccountabilityRouter reads the spec's accountability map
 *      and dispatches state transitions to the correct agent session
 *   4. When an accountability gap exists, the router catches it before
 *      the work becomes stranded
 *
 * This is the engineering realization of the insight:
 *   "Accountability is routing. The ceremonial question and the engineering
 *    question are the same question asked in two languages."
 *
 * Run with: pnpm run start ./src/accountability-routing/agent_session_router.ts
 */

import {
  createStateMachineSpec,
  createStateSpec,
  createTransitionSpec,
  validateSpec,
  inferAccountabilityFromSpec,
  findAccountabilityGaps,
  getResponsibleAt,
  getTransitionsFrom,
  getState,
  type StateMachineSpec,
  type AccountabilityMap,
} from "ava-langchain-state-machine-spec";

import {
  FireKeeper,
  createAgentReport,
  type AgentReport,
} from "ava-langchain-relational-intelligence";

// ===========================================================================
// Agent Session — represents one agent process on the local server
// ===========================================================================

interface AgentSession {
  sessionId: string;
  role: string;
  status: "idle" | "working" | "completed";
  currentState: string | null;
  history: Array<{ state: string; action: string; timestamp: string }>;
}

function createAgentSession(role: string): AgentSession {
  return {
    sessionId: `session-${role}-${Date.now().toString(36)}`,
    role,
    status: "idle",
    currentState: null,
    history: [],
  };
}

// ===========================================================================
// Accountability Router — dispatches work based on the accountability map
// ===========================================================================

interface RouteResult {
  routed: boolean;
  session: AgentSession | null;
  state: string;
  reason: string;
}

class AccountabilityRouter {
  private spec: StateMachineSpec;
  private accountabilityMap: AccountabilityMap;
  private sessions: Map<string, AgentSession>;
  private currentState: string;
  private fireKeeper: FireKeeper;

  constructor(spec: StateMachineSpec, vision: string) {
    // Validate before anything else
    const validation = validateSpec(spec);
    if (!validation.valid) {
      const errors = validation.issues
        .filter((i) => i.severity === "error")
        .map((i) => i.message);
      throw new Error(
        `Spec is invalid. Cannot build router.\n${errors.join("\n")}`
      );
    }

    this.spec = spec;
    this.accountabilityMap = inferAccountabilityFromSpec(spec);
    this.sessions = new Map();
    this.currentState = spec.initialState;
    this.fireKeeper = new FireKeeper(vision);

    // Check for gaps at construction time — fail fast
    const gaps = findAccountabilityGaps(this.accountabilityMap);
    if (gaps.length > 0) {
      console.warn(
        `[AccountabilityRouter] WARNING: ${gaps.length} accountability gap(s) detected.`
      );
      console.warn(
        `  Unroutable states: ${gaps.join(", ")}`
      );
      console.warn(
        `  These states will cause routing failures at runtime.`
      );
    }
  }

  /**
   * Register an agent session for a given role.
   * This is how the local server tells the router: "this process handles this role."
   */
  registerSession(session: AgentSession): void {
    this.sessions.set(session.role, session);
    console.log(
      `  [Router] Registered session ${session.sessionId} for role "${session.role}"`
    );
  }

  /**
   * Route the current state to the responsible agent session.
   * This is the core operation: accountability → routing.
   */
  routeCurrentState(): RouteResult {
    const responsibility = getResponsibleAt(
      this.accountabilityMap,
      this.currentState
    );

    // Accountability gap — no one holds this state
    if (!responsibility || responsibility.primaryHolders.length === 0) {
      return {
        routed: false,
        session: null,
        state: this.currentState,
        reason: `No accountability assigned for state "${this.currentState}". Work is unroutable.`,
      };
    }

    // Find the agent session for the primary holder
    const role = responsibility.primaryHolders[0];
    const session = this.sessions.get(role);

    if (!session) {
      return {
        routed: false,
        session: null,
        state: this.currentState,
        reason: `Role "${role}" holds accountability for "${this.currentState}" but no agent session is registered for this role.`,
      };
    }

    // Route the work
    session.status = "working";
    session.currentState = this.currentState;

    return {
      routed: true,
      session,
      state: this.currentState,
      reason: `Routed to ${session.sessionId} (role: ${role})`,
    };
  }

  /**
   * Complete work in the current state and transition to the next.
   * The agent session reports back, then the router advances the graph.
   */
  async completeAndTransition(
    transitionName: string,
    outcomeDescription: string
  ): Promise<{ transitioned: boolean; from: string; to: string; report: AgentReport }> {
    const currentSession = [...this.sessions.values()].find(
      (s) => s.currentState === this.currentState && s.status === "working"
    );

    if (!currentSession) {
      throw new Error(
        `No active session working on state "${this.currentState}"`
      );
    }

    // Find the transition
    const outgoing = getTransitionsFrom(this.spec, this.currentState);
    const transition = outgoing.find((t) => t.name === transitionName);

    if (!transition) {
      throw new Error(
        `No transition "${transitionName}" from state "${this.currentState}". ` +
          `Available: ${outgoing.map((t) => t.name).join(", ")}`
      );
    }

    // Create an agent report (ceremony)
    const report = createAgentReport(
      currentSession.sessionId,
      currentSession.role,
      transitionName,
      outcomeDescription,
      { complete: true }
    );

    // Fire Keeper reviews the report (vision alignment)
    const review = await this.fireKeeper.reviewReport(report);

    // Record in session history
    currentSession.history.push({
      state: this.currentState,
      action: transitionName,
      timestamp: new Date().toISOString(),
    });
    currentSession.status = "idle";
    currentSession.currentState = null;

    // Advance the graph
    const from = this.currentState;
    this.currentState = transition.toState;

    return {
      transitioned: true,
      from,
      to: transition.toState,
      report,
    };
  }

  getCurrentState(): string {
    return this.currentState;
  }

  isComplete(): boolean {
    const state = getState(this.spec, this.currentState);
    return state?.isTerminal ?? false;
  }

  getSessionSummary(): string {
    const lines: string[] = [];
    for (const [role, session] of this.sessions) {
      lines.push(
        `  ${role}: ${session.sessionId} [${session.status}] — ` +
          `${session.history.length} actions completed`
      );
    }
    return lines.join("\n");
  }
}

// ===========================================================================
// Run the example
// ===========================================================================

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Agent Session Router — Accountability as Dispatcher    ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log();

  // -------------------------------------------------------------------------
  // Define the spec
  // -------------------------------------------------------------------------

  const spec = createStateMachineSpec(
    "feature_development",
    "A feature development workflow routing work to agent sessions",
    "planning",
    {
      finalStates: ["deployed", "abandoned"],
      states: [
        createStateSpec("planning", "Architect plans the feature", {
          allowedTransitions: ["start_implementation"],
        }),
        createStateSpec("implementing", "Developer builds the feature", {
          allowedTransitions: ["submit_for_testing"],
        }),
        createStateSpec("testing", "QA validates the feature", {
          allowedTransitions: ["pass_testing", "fail_testing"],
        }),
        createStateSpec("fixing", "Developer fixes test failures", {
          allowedTransitions: ["resubmit_for_testing", "abandon"],
        }),
        createStateSpec("deploying", "Ops deploys to production", {
          allowedTransitions: ["deploy_complete"],
        }),
        createStateSpec("deployed", "Feature is live", { isTerminal: true }),
        createStateSpec("abandoned", "Feature was abandoned", {
          isTerminal: true,
        }),
      ],
      transitions: [
        createTransitionSpec(
          "start_implementation",
          "planning",
          "implementing",
          {
            actions: ["create_branch"],
          }
        ),
        createTransitionSpec(
          "submit_for_testing",
          "implementing",
          "testing",
          {
            actions: ["run_ci"],
          }
        ),
        createTransitionSpec("pass_testing", "testing", "deploying", {
          preconditions: ["All tests pass", "Coverage threshold met"],
        }),
        createTransitionSpec("fail_testing", "testing", "fixing"),
        createTransitionSpec(
          "resubmit_for_testing",
          "fixing",
          "testing",
          {
            actions: ["run_ci"],
          }
        ),
        createTransitionSpec("abandon", "fixing", "abandoned"),
        createTransitionSpec("deploy_complete", "deploying", "deployed", {
          actions: ["notify_team", "update_changelog"],
        }),
      ],
      metadata: {
        version: "1.0.0",
        author: "ava",
        langgraphCompatible: true,
        relationalContext: {
          entities: ["architect", "developer", "qa", "ops"],
          responsibilities:
            "Architect holds planning. Developer holds implementing and fixing. " +
            "QA holds testing. Ops holds deploying.",
          stateResponsibilities: {
            planning: ["architect"],
            implementing: ["developer"],
            testing: ["qa"],
            fixing: ["developer"],
            deploying: ["ops"],
            deployed: ["ops"],
            abandoned: ["developer"],
          },
        },
      },
    }
  );

  // -------------------------------------------------------------------------
  // Create the router
  // -------------------------------------------------------------------------

  console.log("1. Creating router from spec...");
  const router = new AccountabilityRouter(
    spec,
    "Ship reliable features through accountable collaboration"
  );
  console.log();

  // -------------------------------------------------------------------------
  // Register agent sessions (the local server's running processes)
  // -------------------------------------------------------------------------

  console.log("2. Registering agent sessions on local server...");
  router.registerSession(createAgentSession("architect"));
  router.registerSession(createAgentSession("developer"));
  router.registerSession(createAgentSession("qa"));
  router.registerSession(createAgentSession("ops"));
  console.log();

  // -------------------------------------------------------------------------
  // Walk through the workflow — each step routes to the right session
  // -------------------------------------------------------------------------

  console.log("3. Walking the workflow...");
  console.log();

  // Step 1: Planning → route to architect
  let route = router.routeCurrentState();
  console.log(
    `  [${router.getCurrentState()}] ${route.reason}`
  );

  let result = await router.completeAndTransition(
    "start_implementation",
    "Feature architecture documented, branch created"
  );
  console.log(
    `  Transitioned: ${result.from} → ${result.to}`
  );
  console.log();

  // Step 2: Implementing → route to developer
  route = router.routeCurrentState();
  console.log(
    `  [${router.getCurrentState()}] ${route.reason}`
  );

  result = await router.completeAndTransition(
    "submit_for_testing",
    "Implementation complete, CI triggered"
  );
  console.log(
    `  Transitioned: ${result.from} → ${result.to}`
  );
  console.log();

  // Step 3: Testing → route to QA
  route = router.routeCurrentState();
  console.log(
    `  [${router.getCurrentState()}] ${route.reason}`
  );

  // Simulate a test failure
  result = await router.completeAndTransition(
    "fail_testing",
    "Integration tests failed — edge case in auth flow"
  );
  console.log(
    `  Transitioned: ${result.from} → ${result.to}`
  );
  console.log();

  // Step 4: Fixing → route back to developer
  route = router.routeCurrentState();
  console.log(
    `  [${router.getCurrentState()}] ${route.reason}`
  );

  result = await router.completeAndTransition(
    "resubmit_for_testing",
    "Auth edge case fixed, re-running CI"
  );
  console.log(
    `  Transitioned: ${result.from} → ${result.to}`
  );
  console.log();

  // Step 5: Testing again → route to QA
  route = router.routeCurrentState();
  console.log(
    `  [${router.getCurrentState()}] ${route.reason}`
  );

  result = await router.completeAndTransition(
    "pass_testing",
    "All tests pass, coverage at 94%"
  );
  console.log(
    `  Transitioned: ${result.from} → ${result.to}`
  );
  console.log();

  // Step 6: Deploying → route to ops
  route = router.routeCurrentState();
  console.log(
    `  [${router.getCurrentState()}] ${route.reason}`
  );

  result = await router.completeAndTransition(
    "deploy_complete",
    "Deployed to production, team notified"
  );
  console.log(
    `  Transitioned: ${result.from} → ${result.to}`
  );
  console.log();

  // -------------------------------------------------------------------------
  // Final status
  // -------------------------------------------------------------------------

  console.log(
    `4. Workflow complete: ${router.isComplete()}`
  );
  console.log(`   Final state: ${router.getCurrentState()}`);
  console.log();

  console.log("5. Session summary:");
  console.log(router.getSessionSummary());
  console.log();

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  The accountability map in the spec was the routing table.");
  console.log("  Each state knew its holder. Each holder had a session.");
  console.log("  The ceremony question and the engineering question");
  console.log("  were the same question, asked in two languages.");
  console.log("═══════════════════════════════════════════════════════════");
}

main().catch(console.error);
