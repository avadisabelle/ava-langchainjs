import { describe, it, expect } from "vitest";
import {
  RelationalSource,
  ALL_SOURCES,
  createRelationalString,
  ImportanceContext,
  CONTEXT_WEIGHTS,
  createImportanceUnit,
  deepenUnit,
  decayAccountability,
  connectToSource,
  calculateRelationalCompleteness,
  hasValueConflict,
  ImportanceStore,
} from "../importance_unit.js";

describe("RelationalSource", () => {
  it("has four sources", () => {
    expect(ALL_SOURCES).toHaveLength(4);
    expect(ALL_SOURCES).toContain(RelationalSource.LAND);
    expect(ALL_SOURCES).toContain(RelationalSource.DREAM);
    expect(ALL_SOURCES).toContain(RelationalSource.CODE);
    expect(ALL_SOURCES).toContain(RelationalSource.VISION);
  });
});

describe("CONTEXT_WEIGHTS", () => {
  it("gives highest weight to liminal and ceremonial contexts", () => {
    expect(CONTEXT_WEIGHTS[ImportanceContext.LIMINAL]).toBe(1.5);
    expect(CONTEXT_WEIGHTS[ImportanceContext.CEREMONIAL]).toBe(1.4);
  });

  it("gives lowest weight to extracted context", () => {
    expect(CONTEXT_WEIGHTS[ImportanceContext.EXTRACTED]).toBe(0.7);
  });

  it("gives default weight to analytical context", () => {
    expect(CONTEXT_WEIGHTS[ImportanceContext.ANALYTICAL]).toBe(1.0);
  });
});

describe("createRelationalString", () => {
  it("creates a relational string", () => {
    const rs = createRelationalString(
      RelationalSource.DREAM,
      0.8,
      "Captured during hypnagogic state"
    );
    expect(rs.source).toBe(RelationalSource.DREAM);
    expect(rs.strength).toBe(0.8);
    expect(rs.nature).toBe("Captured during hypnagogic state");
    expect(rs.lastAffirmed).toBeTruthy();
  });

  it("clamps strength to 0-1", () => {
    const rs = createRelationalString(RelationalSource.LAND, 1.5, "test");
    expect(rs.strength).toBe(1);

    const rs2 = createRelationalString(RelationalSource.LAND, -0.5, "test");
    expect(rs2.strength).toBe(0);
  });
});

describe("createImportanceUnit", () => {
  it("creates a unit with defaults", () => {
    const unit = createImportanceUnit(
      "The graph should be alive",
      "session_1",
      ImportanceContext.LIMINAL
    );
    expect(unit.content).toBe("The graph should be alive");
    expect(unit.sourceSessionId).toBe("session_1");
    expect(unit.context).toBe(ImportanceContext.LIMINAL);
    expect(unit.id).toBeTruthy();
    expect(unit.relationalStrings).toHaveLength(0);
    expect(unit.iterationCount).toBe(0);
    expect(unit.humanValidated).toBe(false);
  });

  it("applies context weight to accountability score", () => {
    const liminalUnit = createImportanceUnit(
      "test",
      "s1",
      ImportanceContext.LIMINAL
    );
    const analyticalUnit = createImportanceUnit(
      "test",
      "s1",
      ImportanceContext.ANALYTICAL
    );

    // Liminal gets 1.5x weight, analytical gets 1.0x
    expect(liminalUnit.accountabilityScore).toBeGreaterThan(
      analyticalUnit.accountabilityScore
    );
  });
});

describe("deepenUnit", () => {
  it("increments iteration count", () => {
    const unit = createImportanceUnit("test", "s1", ImportanceContext.ANALYTICAL);
    expect(unit.iterationCount).toBe(0);

    deepenUnit(unit, "Added more detail");
    expect(unit.iterationCount).toBe(1);
    expect(unit.lastRevisitedAt).toBeTruthy();
  });

  it("appends refinement to content", () => {
    const unit = createImportanceUnit(
      "Original insight",
      "s1",
      ImportanceContext.ANALYTICAL
    );
    deepenUnit(unit, "Deeper understanding");
    expect(unit.content).toContain("Original insight");
    expect(unit.content).toContain("[Iteration 1]: Deeper understanding");
  });

  it("strengthens accountability on revisit", () => {
    const unit = createImportanceUnit("test", "s1", ImportanceContext.ANALYTICAL);
    const before = unit.accountabilityScore;
    deepenUnit(unit, "Revisited");
    expect(unit.accountabilityScore).toBeGreaterThan(before);
  });

  it("applies context boost when new context provided", () => {
    const unit = createImportanceUnit("test", "s1", ImportanceContext.ANALYTICAL);
    const before = unit.accountabilityScore;
    deepenUnit(unit, "Ceremonial revisit", ImportanceContext.CEREMONIAL);
    expect(unit.accountabilityScore).toBeGreaterThan(before);
  });
});

describe("decayAccountability", () => {
  it("reduces accountability score", () => {
    const unit = createImportanceUnit("test", "s1", ImportanceContext.ANALYTICAL);
    const before = unit.accountabilityScore;
    decayAccountability(unit);
    expect(unit.accountabilityScore).toBeLessThan(before);
  });

  it("does not decay below 0.1", () => {
    const unit = createImportanceUnit("test", "s1", ImportanceContext.EXTRACTED);
    // Decay many times
    for (let i = 0; i < 100; i++) {
      decayAccountability(unit);
    }
    expect(unit.accountabilityScore).toBeGreaterThanOrEqual(0.1);
  });

  it("respects custom decay factor", () => {
    const unit = createImportanceUnit("test", "s1", ImportanceContext.ANALYTICAL);
    const before = unit.accountabilityScore;
    decayAccountability(unit, 0.5); // aggressive decay
    expect(unit.accountabilityScore).toBeLessThan(before * 0.6);
  });
});

describe("connectToSource", () => {
  it("adds a new relational string", () => {
    const unit = createImportanceUnit("test", "s1", ImportanceContext.ANALYTICAL);
    connectToSource(unit, RelationalSource.DREAM, 0.8, "Dream connection");
    expect(unit.relationalStrings).toHaveLength(1);
    expect(unit.relationalStrings[0].source).toBe(RelationalSource.DREAM);
  });

  it("deepens existing connection on re-connect", () => {
    const unit = createImportanceUnit("test", "s1", ImportanceContext.ANALYTICAL);
    connectToSource(unit, RelationalSource.DREAM, 0.5, "First connection");
    connectToSource(unit, RelationalSource.DREAM, 0.3, "Deepened");

    expect(unit.relationalStrings).toHaveLength(1);
    expect(unit.relationalStrings[0].strength).toBeGreaterThan(0.5);
    expect(unit.relationalStrings[0].nature).toContain("Deepened");
  });
});

describe("calculateRelationalCompleteness", () => {
  it("returns 0 for no connections", () => {
    const unit = createImportanceUnit("test", "s1", ImportanceContext.ANALYTICAL);
    expect(calculateRelationalCompleteness(unit)).toBe(0);
  });

  it("increases with more source connections", () => {
    const unit = createImportanceUnit("test", "s1", ImportanceContext.ANALYTICAL);
    connectToSource(unit, RelationalSource.LAND, 0.8, "test");
    const one = calculateRelationalCompleteness(unit);

    connectToSource(unit, RelationalSource.DREAM, 0.8, "test");
    const two = calculateRelationalCompleteness(unit);

    expect(two).toBeGreaterThan(one);
  });

  it("returns high value when all sources connected with high strength", () => {
    const unit = createImportanceUnit("test", "s1", ImportanceContext.ANALYTICAL);
    for (const source of ALL_SOURCES) {
      connectToSource(unit, source, 0.9, "Strong connection");
    }
    expect(calculateRelationalCompleteness(unit)).toBeGreaterThan(0.8);
  });
});

describe("hasValueConflict", () => {
  it("returns false when alignment and accountability are balanced", () => {
    const unit = createImportanceUnit("test", "s1", ImportanceContext.ANALYTICAL);
    unit.valueAlignmentScore = 0.7;
    unit.accountabilityScore = 0.7;
    expect(hasValueConflict(unit)).toBe(false);
  });

  it("returns true when low alignment but high accountability", () => {
    const unit = createImportanceUnit("test", "s1", ImportanceContext.ANALYTICAL);
    unit.valueAlignmentScore = 0.2;
    unit.accountabilityScore = 0.8;
    expect(hasValueConflict(unit)).toBe(true);
  });
});

describe("ImportanceStore", () => {
  it("adds and retrieves units", () => {
    const store = new ImportanceStore();
    const unit = createImportanceUnit("test", "s1", ImportanceContext.ANALYTICAL);
    store.add(unit);
    expect(store.get(unit.id)).toBe(unit);
    expect(store.size).toBe(1);
  });

  it("filters by context", () => {
    const store = new ImportanceStore();
    store.add(createImportanceUnit("a", "s1", ImportanceContext.LIMINAL));
    store.add(createImportanceUnit("b", "s1", ImportanceContext.ANALYTICAL));
    store.add(createImportanceUnit("c", "s1", ImportanceContext.LIMINAL));

    const liminal = store.getAll({ context: ImportanceContext.LIMINAL });
    expect(liminal).toHaveLength(2);
  });

  it("filters by source", () => {
    const store = new ImportanceStore();
    const unit = createImportanceUnit("a", "s1", ImportanceContext.ANALYTICAL);
    connectToSource(unit, RelationalSource.DREAM, 0.8, "test");
    store.add(unit);
    store.add(createImportanceUnit("b", "s1", ImportanceContext.ANALYTICAL));

    const dreamConnected = store.getAll({ source: RelationalSource.DREAM });
    expect(dreamConnected).toHaveLength(1);
  });

  it("filters by minimum accountability", () => {
    const store = new ImportanceStore();
    const high = createImportanceUnit("a", "s1", ImportanceContext.LIMINAL);
    const low = createImportanceUnit("b", "s1", ImportanceContext.EXTRACTED);
    store.add(high);
    store.add(low);

    const highOnly = store.getAll({ minAccountability: 0.6 });
    expect(highOnly.length).toBeLessThanOrEqual(2);
  });

  it("gets by accountability order", () => {
    const store = new ImportanceStore();
    store.add(createImportanceUnit("low", "s1", ImportanceContext.EXTRACTED));
    store.add(createImportanceUnit("high", "s1", ImportanceContext.LIMINAL));

    const sorted = store.getByAccountability(2);
    expect(sorted[0].accountabilityScore).toBeGreaterThanOrEqual(
      sorted[1].accountabilityScore
    );
  });

  it("gets units needing attention", () => {
    const store = new ImportanceStore();
    const unit = createImportanceUnit("conflicted", "s1", ImportanceContext.ANALYTICAL);
    unit.valueAlignmentScore = 0.2;
    unit.accountabilityScore = 0.8;
    store.add(unit);

    const needing = store.getNeedingAttention();
    expect(needing).toHaveLength(1);
  });

  it("applies decay to all units", () => {
    const store = new ImportanceStore();
    const unit = createImportanceUnit("test", "s1", ImportanceContext.ANALYTICAL);
    const before = unit.accountabilityScore;
    store.add(unit);

    store.applyDecay();
    expect(unit.accountabilityScore).toBeLessThan(before);
  });

  it("removes units", () => {
    const store = new ImportanceStore();
    const unit = createImportanceUnit("test", "s1", ImportanceContext.ANALYTICAL);
    store.add(unit);
    expect(store.remove(unit.id)).toBe(true);
    expect(store.size).toBe(0);
  });

  it("serializes and loads", () => {
    const store = new ImportanceStore();
    store.add(createImportanceUnit("a", "s1", ImportanceContext.LIMINAL));
    store.add(createImportanceUnit("b", "s1", ImportanceContext.ANALYTICAL));

    const json = store.serialize();
    const store2 = new ImportanceStore();
    store2.load(json);
    expect(store2.size).toBe(2);
  });
});
