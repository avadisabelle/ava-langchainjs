/**
 * Shared test fixtures — a PR review workflow spec used across all test suites.
 */

import {
  StateMachineSpec,
  createStateSpec,
  createTransitionSpec,
  createStateMachineSpec,
} from "../spec_types.js";

/**
 * A complete PR review workflow spec for testing.
 */
export function createPRReviewSpec(): StateMachineSpec {
  const states = [
    createStateSpec("initialized", "PR has been created and is ready for review", {
      entryConditions: ["PR branch exists", "CI pipeline configured"],
      allowedTransitions: ["to_under_review"],
    }),
    createStateSpec("under_review", "PR is being reviewed by maintainers", {
      entryConditions: ["At least one reviewer assigned"],
      exitConditions: ["Review decision made"],
      allowedTransitions: ["to_changes_requested", "to_approved"],
    }),
    createStateSpec("changes_requested", "Reviewer has requested changes to the PR", {
      entryConditions: ["Review comments posted"],
      exitConditions: ["Author has addressed comments"],
      allowedTransitions: ["to_under_review"],
    }),
    createStateSpec("approved", "PR has been approved by required reviewers", {
      entryConditions: ["Required approvals met"],
      allowedTransitions: ["to_merged", "to_changes_requested"],
    }),
    createStateSpec("merged", "PR has been merged into the target branch", {
      entryConditions: ["CI passes", "No merge conflicts"],
      isTerminal: true,
    }),
    createStateSpec("closed", "PR has been closed without merging", {
      isTerminal: true,
    }),
  ];

  const transitions = [
    createTransitionSpec("to_under_review", "initialized", "under_review", {
      triggerEvents: ["reviewer_assigned"],
      preconditions: ["PR is not draft"],
      actions: ["notify_reviewers"],
    }),
    createTransitionSpec("to_changes_requested", "under_review", "changes_requested", {
      triggerEvents: ["review_submitted"],
      preconditions: ["Review contains change requests"],
      actions: ["notify_author"],
    }),
    createTransitionSpec("to_under_review_again", "changes_requested", "under_review", {
      triggerEvents: ["changes_pushed"],
      preconditions: ["Author addressed all comments"],
      actions: ["re_request_review"],
    }),
    createTransitionSpec("to_approved", "under_review", "approved", {
      triggerEvents: ["review_submitted"],
      preconditions: ["All required reviewers approved"],
      actions: ["update_status_check"],
    }),
    createTransitionSpec("to_merged", "approved", "merged", {
      triggerEvents: ["merge_button_clicked"],
      preconditions: ["CI passes", "No merge conflicts"],
      actions: ["merge_pr", "delete_branch", "notify_team"],
      postconditions: ["Branch merged", "PR closed"],
    }),
    createTransitionSpec("to_closed", "approved", "closed", {
      triggerEvents: ["close_button_clicked"],
      actions: ["notify_author"],
    }),
  ];

  return createStateMachineSpec("pr_review_workflow", "Pull Request Review Workflow", "initialized", {
    finalStates: ["merged", "closed"],
    states,
    transitions,
    metadata: {
      version: "1.0.0",
      author: "ava",
      langgraphCompatible: true,
      relationalContext: {
        entities: ["author", "reviewer", "maintainer"],
        responsibilities:
          "Author creates and updates PR. Reviewer evaluates code. Maintainer makes final merge decision.",
        stateResponsibilities: {
          initialized: ["author"],
          under_review: ["reviewer"],
          changes_requested: ["author"],
          approved: ["maintainer"],
          merged: ["maintainer"],
          closed: ["maintainer"],
        },
      },
    },
  });
}

/**
 * A minimal spec for edge-case testing.
 */
export function createMinimalSpec(): StateMachineSpec {
  return createStateMachineSpec("minimal", "Minimal workflow", "start", {
    finalStates: ["done"],
    states: [
      createStateSpec("start", "Starting state"),
      createStateSpec("done", "Final state", { isTerminal: true }),
    ],
    transitions: [
      createTransitionSpec("finish", "start", "done"),
    ],
  });
}

/**
 * A spec with known structural issues for validator testing.
 */
export function createBrokenSpec(): StateMachineSpec {
  return {
    name: "broken_workflow",
    description: "Intentionally broken for testing",
    initialState: "ghost_state",
    finalStates: ["also_ghost"],
    states: [
      createStateSpec("orphan", "Cannot be reached", {
        allowedTransitions: ["nonexistent_transition"],
      }),
      createStateSpec("deadlock", "No way out and not terminal"),
      createStateSpec("terminal_with_exit", "Terminal but has outgoing", {
        isTerminal: true,
        allowedTransitions: ["illegal_exit"],
      }),
    ],
    transitions: [
      createTransitionSpec("illegal_exit", "terminal_with_exit", "deadlock"),
    ],
    metadata: {
      version: "1.0.0",
      author: "",
      langgraphCompatible: true,
    },
  };
}

/**
 * Snake_case JSON string (Python-style) for parser testing.
 */
export const SNAKE_CASE_JSON = JSON.stringify({
  name: "python_workflow",
  description: "From Python",
  initial_state: "idle",
  final_states: ["complete"],
  states: [
    {
      name: "idle",
      description: "Waiting",
      entry_conditions: [],
      exit_conditions: [],
      allowed_transitions: ["start_work"],
      is_terminal: false,
    },
    {
      name: "working",
      description: "Processing",
      entry_conditions: ["task assigned"],
      exit_conditions: ["task done"],
      allowed_transitions: ["complete_work"],
      is_terminal: false,
    },
    {
      name: "complete",
      description: "Done",
      entry_conditions: [],
      exit_conditions: [],
      allowed_transitions: [],
      is_terminal: true,
    },
  ],
  transitions: [
    {
      name: "start_work",
      from_state: "idle",
      to_state: "working",
      trigger_events: ["task_created"],
      preconditions: ["resources available"],
      actions: ["allocate_resources"],
      postconditions: ["task in progress"],
    },
    {
      name: "complete_work",
      from_state: "working",
      to_state: "complete",
      trigger_events: ["task_finished"],
      preconditions: [],
      actions: ["release_resources"],
      postconditions: ["task marked done"],
    },
  ],
  metadata: {
    version: "1.0.0",
    author: "python_dev",
    langgraph_compatible: true,
    relational_context: {
      entities: ["worker", "supervisor"],
      responsibilities: "Worker does the work, supervisor oversees.",
      state_responsibilities: {
        idle: ["supervisor"],
        working: ["worker"],
        complete: ["supervisor"],
      },
    },
  },
});
