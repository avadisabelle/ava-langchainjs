import { describe, it, expect } from "vitest";
import {
  LiminalMode,
  LIMINAL_MODE_WEIGHTS,
  createLiminalInput,
  LiminalBuffer,
} from "../liminal_buffer.js";
import { RelationalSource } from "../importance_unit.js";

describe("LiminalMode", () => {
  it("has weight multipliers for all modes", () => {
    const modes = [
      LiminalMode.HYPNAGOGIC,
      LiminalMode.DREAM_RECALL,
      LiminalMode.CONTEMPLATIVE,
      LiminalMode.CEREMONIAL,
      LiminalMode.LAND_WALK,
      LiminalMode.SPONTANEOUS,
    ];

    for (const mode of modes) {
      expect(LIMINAL_MODE_WEIGHTS[mode]).toBeGreaterThan(1.0);
    }
  });

  it("hypnagogic and ceremonial have highest weights", () => {
    expect(LIMINAL_MODE_WEIGHTS[LiminalMode.HYPNAGOGIC]).toBe(1.5);
    expect(LIMINAL_MODE_WEIGHTS[LiminalMode.CEREMONIAL]).toBe(1.5);
  });
});

describe("createLiminalInput", () => {
  it("creates with defaults", () => {
    const input = createLiminalInput(
      "The system breathes",
      LiminalMode.HYPNAGOGIC,
      "session_1"
    );
    expect(input.content).toBe("The system breathes");
    expect(input.mode).toBe(LiminalMode.HYPNAGOGIC);
    expect(input.weight).toBe(1.5);
    expect(input.integrated).toBe(false);
    expect(input.influenceCount).toBe(0);
  });
});

describe("LiminalBuffer", () => {
  describe("capture", () => {
    it("captures a liminal input", () => {
      const buffer = new LiminalBuffer();
      const input = buffer.capture(
        "The knowledge graph should be alive, not flat",
        LiminalMode.HYPNAGOGIC,
        "session_1"
      );

      expect(input.id).toBeTruthy();
      expect(input.weight).toBe(1.5);
      expect(input.wheelAssessment).toBeTruthy();
      expect(input.importanceUnits).toHaveLength(1);
      expect(buffer.size).toBe(1);
    });

    it("creates importance unit with dream source connection", () => {
      const buffer = new LiminalBuffer();
      const input = buffer.capture(
        "Spirit showed the way",
        LiminalMode.DREAM_RECALL,
        "s1"
      );

      const unit = input.importanceUnits[0];
      const dreamString = unit.relationalStrings.find(
        (rs) => rs.source === RelationalSource.DREAM
      );
      expect(dreamString).toBeTruthy();
      expect(dreamString!.strength).toBe(0.9);
    });

    it("creates importance unit with vision source connection", () => {
      const buffer = new LiminalBuffer();
      const input = buffer.capture(
        "The direction became clear",
        LiminalMode.CONTEMPLATIVE,
        "s1"
      );

      const unit = input.importanceUnits[0];
      const visionString = unit.relationalStrings.find(
        (rs) => rs.source === RelationalSource.VISION
      );
      expect(visionString).toBeTruthy();
    });

    it("attaches source file when provided", () => {
      const buffer = new LiminalBuffer();
      const input = buffer.capture(
        "Recording content",
        LiminalMode.HYPNAGOGIC,
        "s1",
        { sourceFile: "recording_2am.m4a" }
      );

      expect(input.sourceFile).toBe("recording_2am.m4a");
    });
  });

  describe("get and getAll", () => {
    it("retrieves by ID", () => {
      const buffer = new LiminalBuffer();
      const input = buffer.capture("test", LiminalMode.HYPNAGOGIC, "s1");
      expect(buffer.get(input.id)).toBe(input);
    });

    it("filters by mode", () => {
      const buffer = new LiminalBuffer();
      buffer.capture("a", LiminalMode.HYPNAGOGIC, "s1");
      buffer.capture("b", LiminalMode.CEREMONIAL, "s1");
      buffer.capture("c", LiminalMode.HYPNAGOGIC, "s1");

      const hypnagogic = buffer.getAll({ mode: LiminalMode.HYPNAGOGIC });
      expect(hypnagogic).toHaveLength(2);
    });

    it("filters by integration status", () => {
      const buffer = new LiminalBuffer();
      const input = buffer.capture("a", LiminalMode.HYPNAGOGIC, "s1");
      buffer.capture("b", LiminalMode.CEREMONIAL, "s1");
      buffer.markIntegrated(input.id);

      const unintegrated = buffer.getAll({ integrated: false });
      expect(unintegrated).toHaveLength(1);
    });

    it("filters by minimum weight", () => {
      const buffer = new LiminalBuffer();
      buffer.capture("a", LiminalMode.HYPNAGOGIC, "s1"); // 1.5
      buffer.capture("b", LiminalMode.SPONTANEOUS, "s1"); // 1.2

      const highWeight = buffer.getAll({ minWeight: 1.4 });
      expect(highWeight).toHaveLength(1);
    });
  });

  describe("getRootContext", () => {
    it("returns unintegrated inputs sorted by weight", () => {
      const buffer = new LiminalBuffer();
      buffer.capture("low", LiminalMode.SPONTANEOUS, "s1"); // 1.2
      buffer.capture("high", LiminalMode.HYPNAGOGIC, "s1"); // 1.5
      buffer.capture("mid", LiminalMode.CONTEMPLATIVE, "s1"); // 1.3

      const root = buffer.getRootContext();
      expect(root[0].weight).toBe(1.5);
      expect(root[1].weight).toBe(1.3);
    });

    it("excludes integrated inputs", () => {
      const buffer = new LiminalBuffer();
      const input = buffer.capture("a", LiminalMode.HYPNAGOGIC, "s1");
      buffer.capture("b", LiminalMode.CEREMONIAL, "s1");
      buffer.markIntegrated(input.id);

      const root = buffer.getRootContext();
      expect(root).toHaveLength(1);
    });
  });

  describe("checkAlignment", () => {
    it("checks alignment of technical work against liminal context", () => {
      const buffer = new LiminalBuffer();
      buffer.capture(
        "The system needs to be alive with ceremony and spirit and relationship",
        LiminalMode.HYPNAGOGIC,
        "s1"
      );

      const result = buffer.checkAlignment(
        "Add flat JSON schema for knowledge graph"
      );

      expect(typeof result.aligned).toBe("boolean");
      expect(Array.isArray(result.conflicts)).toBe(true);
      expect(Array.isArray(result.supportingInputs)).toBe(true);
    });

    it("returns aligned when no liminal context exists", () => {
      const buffer = new LiminalBuffer();
      const result = buffer.checkAlignment("Build anything");
      expect(result.aligned).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe("markIntegrated", () => {
    it("marks input as integrated", () => {
      const buffer = new LiminalBuffer();
      const input = buffer.capture("test", LiminalMode.HYPNAGOGIC, "s1");

      buffer.markIntegrated(input.id);
      expect(buffer.get(input.id)!.integrated).toBe(true);
      expect(buffer.get(input.id)!.integratedAt).toBeTruthy();
    });
  });

  describe("recordInfluence", () => {
    it("increments influence count", () => {
      const buffer = new LiminalBuffer();
      const input = buffer.capture("test", LiminalMode.HYPNAGOGIC, "s1");

      buffer.recordInfluence(input.id);
      buffer.recordInfluence(input.id);
      expect(buffer.get(input.id)!.influenceCount).toBe(2);
    });
  });

  describe("getMostInfluential", () => {
    it("returns inputs sorted by influence", () => {
      const buffer = new LiminalBuffer();
      const a = buffer.capture("a", LiminalMode.HYPNAGOGIC, "s1");
      const b = buffer.capture("b", LiminalMode.CEREMONIAL, "s1");

      buffer.recordInfluence(a.id);
      buffer.recordInfluence(b.id);
      buffer.recordInfluence(b.id);
      buffer.recordInfluence(b.id);

      const influential = buffer.getMostInfluential();
      expect(influential[0].id).toBe(b.id);
    });
  });

  describe("serialization", () => {
    it("serializes and loads", () => {
      const buffer = new LiminalBuffer();
      buffer.capture("a", LiminalMode.HYPNAGOGIC, "s1");
      buffer.capture("b", LiminalMode.CEREMONIAL, "s1");

      const json = buffer.serialize();
      const buffer2 = new LiminalBuffer();
      buffer2.load(json);
      expect(buffer2.size).toBe(2);
    });
  });
});
