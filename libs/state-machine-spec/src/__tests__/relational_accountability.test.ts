import { describe, it, expect } from "vitest";
import {
  createAccountabilityMap,
  inferAccountabilityFromSpec,
  findAccountabilityGaps,
  getResponsibleAt,
  getTransitionAccountability,
  generateAccountabilityNarrative,
} from "../relational_accountability.js";
import { createPRReviewSpec, createMinimalSpec } from "./fixtures.js";

describe("inferAccountabilityFromSpec", () => {
  it("creates entities from relational context", () => {
    const spec = createPRReviewSpec();
    const map = inferAccountabilityFromSpec(spec);
    expect(map.entities.length).toBe(3);
    const names = map.entities.map((e) => e.name);
    expect(names).toContain("author");
    expect(names).toContain("reviewer");
    expect(names).toContain("maintainer");
  });

  it("assigns state responsibilities from stateResponsibilities", () => {
    const spec = createPRReviewSpec();
    const map = inferAccountabilityFromSpec(spec);

    const underReview = map.stateResponsibilities.find(
      (r) => r.stateName === "under_review"
    );
    expect(underReview).toBeDefined();
    expect(underReview!.primaryHolders).toEqual(["reviewer"]);
    expect(underReview!.waitingEntities).toContain("author");
    expect(underReview!.waitingEntities).toContain("maintainer");
  });

  it("sets correct obligations", () => {
    const spec = createPRReviewSpec();
    const map = inferAccountabilityFromSpec(spec);

    const merged = map.stateResponsibilities.find(
      (r) => r.stateName === "merged"
    );
    expect(merged).toBeDefined();
    expect(merged!.obligation).toContain("merged");
  });

  it("creates transition accountability", () => {
    const spec = createPRReviewSpec();
    const map = inferAccountabilityFromSpec(spec);
    expect(map.transitionAccountability.length).toBe(spec.transitions.length);
  });

  it("assigns precondition owners from source state responsibility", () => {
    const spec = createPRReviewSpec();
    const map = inferAccountabilityFromSpec(spec);

    const toMerged = map.transitionAccountability.find(
      (t) => t.transitionName === "to_merged"
    );
    expect(toMerged).toBeDefined();
    // approved state is owned by maintainer
    expect(toMerged!.preconditionOwners).toContain("maintainer");
  });

  it("assigns postcondition verifiers from target state responsibility", () => {
    const spec = createPRReviewSpec();
    const map = inferAccountabilityFromSpec(spec);

    const toUnderReview = map.transitionAccountability.find(
      (t) => t.transitionName === "to_under_review"
    );
    expect(toUnderReview).toBeDefined();
    // under_review state is owned by reviewer
    expect(toUnderReview!.postconditionVerifiers).toContain("reviewer");
  });

  it("updates entity responsible states", () => {
    const spec = createPRReviewSpec();
    const map = inferAccountabilityFromSpec(spec);

    const reviewer = map.entities.find((e) => e.name === "reviewer");
    expect(reviewer).toBeDefined();
    expect(reviewer!.responsibleStates).toContain("under_review");
  });

  it("handles specs without relational context", () => {
    const spec = createMinimalSpec();
    const map = inferAccountabilityFromSpec(spec);
    expect(map.entities).toEqual([]);
    expect(map.stateResponsibilities.length).toBe(2); // start + done
  });

  it("has a valid id and timestamp", () => {
    const map = inferAccountabilityFromSpec(createPRReviewSpec());
    expect(map.id).toBeTruthy();
    expect(map.timestamp).toBeTruthy();
    expect(new Date(map.timestamp).getTime()).not.toBeNaN();
  });
});

describe("findAccountabilityGaps", () => {
  it("returns no gaps for spec with full state coverage", () => {
    const spec = createPRReviewSpec();
    const map = inferAccountabilityFromSpec(spec);
    const gaps = findAccountabilityGaps(map);
    expect(gaps).toEqual([]);
  });

  it("finds gaps for spec without relational context", () => {
    const spec = createMinimalSpec();
    const map = inferAccountabilityFromSpec(spec);
    const gaps = findAccountabilityGaps(map);
    expect(gaps).toContain("start");
    expect(gaps).toContain("done");
  });
});

describe("getResponsibleAt", () => {
  it("returns responsibility for a known state", () => {
    const map = inferAccountabilityFromSpec(createPRReviewSpec());
    const resp = getResponsibleAt(map, "changes_requested");
    expect(resp).toBeDefined();
    expect(resp!.primaryHolders).toContain("author");
  });

  it("returns undefined for unknown state", () => {
    const map = inferAccountabilityFromSpec(createPRReviewSpec());
    expect(getResponsibleAt(map, "nonexistent")).toBeUndefined();
  });
});

describe("getTransitionAccountability", () => {
  it("returns accountability for a known transition", () => {
    const map = inferAccountabilityFromSpec(createPRReviewSpec());
    const acct = getTransitionAccountability(map, "to_merged");
    expect(acct).toBeDefined();
    expect(acct!.fromState).toBe("approved");
    expect(acct!.toState).toBe("merged");
  });

  it("returns undefined for unknown transition", () => {
    const map = inferAccountabilityFromSpec(createPRReviewSpec());
    expect(getTransitionAccountability(map, "nonexistent")).toBeUndefined();
  });
});

describe("createAccountabilityMap", () => {
  it("creates a map with provided data", () => {
    const spec = createPRReviewSpec();
    const map = createAccountabilityMap(spec, [], [], []);
    expect(map.specName).toBe("pr_review_workflow");
    expect(map.entities).toEqual([]);
    expect(map.stateResponsibilities).toEqual([]);
    expect(map.transitionAccountability).toEqual([]);
    expect(map.id).toBeTruthy();
    expect(map.timestamp).toBeTruthy();
  });
});

describe("generateAccountabilityNarrative", () => {
  it("produces a narrative string", () => {
    const spec = createPRReviewSpec();
    const map = inferAccountabilityFromSpec(spec);
    const narrative = generateAccountabilityNarrative(spec, map);
    expect(typeof narrative).toBe("string");
    expect(narrative.length).toBeGreaterThan(0);
  });

  it("includes the spec name in the header", () => {
    const spec = createPRReviewSpec();
    const map = inferAccountabilityFromSpec(spec);
    const narrative = generateAccountabilityNarrative(spec, map);
    expect(narrative).toContain("pr_review_workflow");
  });

  it("mentions responsible entities", () => {
    const spec = createPRReviewSpec();
    const map = inferAccountabilityFromSpec(spec);
    const narrative = generateAccountabilityNarrative(spec, map);
    expect(narrative).toContain("reviewer");
    expect(narrative).toContain("author");
    expect(narrative).toContain("maintainer");
  });

  it("shows transitions from states", () => {
    const spec = createPRReviewSpec();
    const map = inferAccountabilityFromSpec(spec);
    const narrative = generateAccountabilityNarrative(spec, map);
    expect(narrative).toContain("to_under_review");
    expect(narrative).toContain("to_merged");
  });

  it("marks terminal states", () => {
    const spec = createPRReviewSpec();
    const map = inferAccountabilityFromSpec(spec);
    const narrative = generateAccountabilityNarrative(spec, map);
    expect(narrative).toContain("resting place");
  });

  it("reports accountability gaps for minimal spec", () => {
    const spec = createMinimalSpec();
    const map = inferAccountabilityFromSpec(spec);
    const narrative = generateAccountabilityNarrative(spec, map);
    expect(narrative).toContain("Accountability Gaps:");
    expect(narrative).toContain("No entity holds explicit responsibility");
  });

  it("includes waiting entities", () => {
    const spec = createPRReviewSpec();
    const map = inferAccountabilityFromSpec(spec);
    const narrative = generateAccountabilityNarrative(spec, map);
    expect(narrative).toContain("Waiting respectfully");
  });

  it("shows preconditions on transitions", () => {
    const spec = createPRReviewSpec();
    const map = inferAccountabilityFromSpec(spec);
    const narrative = generateAccountabilityNarrative(spec, map);
    expect(narrative).toContain("Requires:");
  });
});
