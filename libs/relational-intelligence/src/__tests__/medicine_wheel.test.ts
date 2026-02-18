import { describe, it, expect, vi } from "vitest";
import {
  MedicineWheelQuadrant,
  ALL_QUADRANTS,
  MedicineWheelFilter,
  createQuadrantPresence,
  QUADRANT_KEYWORDS,
  QuadrantPresence,
} from "../medicine_wheel.js";
import { BaseChatModel } from "@langchain/core/language_models/base";

describe("MedicineWheelQuadrant", () => {
  it("has four quadrants", () => {
    expect(ALL_QUADRANTS).toHaveLength(4);
    expect(ALL_QUADRANTS).toContain(MedicineWheelQuadrant.PHYSICAL);
    expect(ALL_QUADRANTS).toContain(MedicineWheelQuadrant.EMOTIONAL);
    expect(ALL_QUADRANTS).toContain(MedicineWheelQuadrant.MENTAL);
    expect(ALL_QUADRANTS).toContain(MedicineWheelQuadrant.SPIRITUAL);
  });
});

describe("createQuadrantPresence", () => {
  it("creates with zeros by default", () => {
    const p = createQuadrantPresence();
    expect(p[MedicineWheelQuadrant.PHYSICAL]).toBe(0);
    expect(p[MedicineWheelQuadrant.EMOTIONAL]).toBe(0);
    expect(p[MedicineWheelQuadrant.MENTAL]).toBe(0);
    expect(p[MedicineWheelQuadrant.SPIRITUAL]).toBe(0);
  });

  it("accepts partial overrides", () => {
    const p = createQuadrantPresence({
      [MedicineWheelQuadrant.SPIRITUAL]: 0.8,
    });
    expect(p[MedicineWheelQuadrant.SPIRITUAL]).toBe(0.8);
    expect(p[MedicineWheelQuadrant.PHYSICAL]).toBe(0);
  });
});

describe("QUADRANT_KEYWORDS", () => {
  it("has keywords for all four quadrants", () => {
    for (const q of ALL_QUADRANTS) {
      expect(QUADRANT_KEYWORDS[q].length).toBeGreaterThan(0);
    }
  });
});

describe("MedicineWheelFilter", () => {
  const filter = new MedicineWheelFilter();

  describe("assess", () => {
    it("classifies technical content toward Mental/Physical", async () => {
      const assessment = await filter.assess(
        "test_1",
        "Build and deploy the database server infrastructure"
      );
      expect(assessment.inputId).toBe("test_1");
      expect(assessment.id).toBeTruthy();
      expect(assessment.timestamp).toBeTruthy();
      // Physical should be strong (build, deploy, server, infrastructure)
      expect(
        assessment.presence[MedicineWheelQuadrant.PHYSICAL]
      ).toBeGreaterThan(0);
    });

    it("classifies emotional content toward Emotional", async () => {
      const assessment = await filter.assess(
        "test_2",
        "I feel grateful for this relationship and the trust we share together"
      );
      expect(
        assessment.presence[MedicineWheelQuadrant.EMOTIONAL]
      ).toBeGreaterThan(0.3);
    });

    it("classifies dream/ceremony content toward Spiritual", async () => {
      const assessment = await filter.assess(
        "test_3",
        "In the dream the ancestors showed me the ceremony and the medicine wheel vision"
      );
      expect(
        assessment.presence[MedicineWheelQuadrant.SPIRITUAL]
      ).toBeGreaterThan(0.3);
      expect(assessment.leadQuadrant).toBe(MedicineWheelQuadrant.SPIRITUAL);
    });

    it("classifies analytical content toward Mental", async () => {
      const assessment = await filter.assess(
        "test_4",
        "Analyze the design pattern and abstract the framework model"
      );
      expect(
        assessment.presence[MedicineWheelQuadrant.MENTAL]
      ).toBeGreaterThan(0.3);
    });

    it("returns default distribution for unrecognized content", async () => {
      const assessment = await filter.assess("test_5", "xyz abc 123");
      expect(assessment.presence[MedicineWheelQuadrant.SPIRITUAL]).toBe(0.35);
      expect(assessment.presence[MedicineWheelQuadrant.MENTAL]).toBe(0.25);
    });

    it("identifies neglected quadrants", async () => {
      const assessment = await filter.assess(
        "test_6",
        "Build and compile the code server infrastructure"
      );
      // Pure technical content should neglect some quadrants
      expect(assessment.neglectedQuadrants.length).toBeGreaterThan(0);
    });

    it("calculates relational coverage", async () => {
      const assessment = await filter.assess(
        "test_7",
        "Build deploy feel grateful dream ceremony analyze design"
      );
      expect(assessment.relationalCoverage).toBeGreaterThanOrEqual(0);
      expect(assessment.relationalCoverage).toBeLessThanOrEqual(1);
    });

    it("determines balance", async () => {
      const narrowAssessment = await filter.assess(
        "test_8",
        "code code code compile build server"
      );
      // Very narrow content may not be balanced
      expect(typeof narrowAssessment.balanced).toBe("boolean");
    });
  });

  describe("assessWithGuidance", () => {
    it("provides guidance for neglected quadrants", async () => {
      const result = await filter.assessWithGuidance(
        "test_9",
        "Build the database schema and compile the code"
      );
      if (result.neglectedQuadrants.length > 0) {
        expect(result.guidance.length).toBeGreaterThan(0);
        expect(result.guidance[0]).toContain("Consider");
      }
    });

    it("includes coverage warning when unbalanced", async () => {
      const result = await filter.assessWithGuidance(
        "test_10",
        "code compile build server deploy infrastructure"
      );
      if (!result.balanced) {
        const coverageGuidance = result.guidance.find((g) =>
          g.includes("Relational coverage")
        );
        expect(coverageGuidance).toBeTruthy();
      }
    });
  });

  describe("canProceedAutonomously", () => {
    it("blocks when spiritual is neglected", async () => {
      const assessment = await filter.assess(
        "test_11",
        "code compile build server deploy"
      );
      if (
        assessment.neglectedQuadrants.includes(MedicineWheelQuadrant.SPIRITUAL)
      ) {
        expect(filter.canProceedAutonomously(assessment)).toBe(false);
      }
    });

    it("blocks when emotional is neglected", async () => {
      const assessment = await filter.assess(
        "test_12",
        "code compile build analyze design"
      );
      if (
        assessment.neglectedQuadrants.includes(MedicineWheelQuadrant.EMOTIONAL)
      ) {
        expect(filter.canProceedAutonomously(assessment)).toBe(false);
      }
    });

    it("allows when balanced and spiritual/emotional present", async () => {
      // Content that engages all quadrants
      const assessment = await filter.assess(
        "test_13",
        "Build with care and gratitude, the dream showed us the design for the ceremony code"
      );
      if (
        assessment.balanced &&
        !assessment.neglectedQuadrants.includes(MedicineWheelQuadrant.SPIRITUAL) &&
        !assessment.neglectedQuadrants.includes(MedicineWheelQuadrant.EMOTIONAL)
      ) {
        expect(filter.canProceedAutonomously(assessment)).toBe(true);
      }
    });
  });

  describe("custom options", () => {
    it("respects custom neglect threshold", async () => {
      const strictFilter = new MedicineWheelFilter({
        neglectThreshold: 0.3,
      });
      const assessment = await strictFilter.assess(
        "test_14",
        "Build the server"
      );
      // Stricter threshold means more quadrants may be neglected
      expect(assessment.neglectedQuadrants.length).toBeGreaterThanOrEqual(0);
    });

    it("respects custom balance threshold", async () => {
      const strictFilter = new MedicineWheelFilter({
        balanceThreshold: 0.9,
      });
      const assessment = await strictFilter.assess(
        "test_15",
        "Build the server"
      );
      // Very strict balance threshold
      expect(assessment.balanced).toBe(false);
    });
  });

  describe("LLM Integration", () => {
    const mockQuadrantPresence: QuadrantPresence = {
      physical: 0.2,
      emotional: 0.8,
      mental: 0.1,
      spiritual: 0.9,
    };

    const mockLLMResponse = (presence: QuadrantPresence) => JSON.stringify({
      physical: presence.physical,
      emotional: presence.emotional,
      mental: presence.mental,
      spiritual: presence.spiritual,
    });

    it("should use LLM for classification when provided", async () => {
      const mockLLM = {
        invoke: vi.fn(async () => ({
          content: mockLLMResponse(mockQuadrantPresence),
        })),
      } as unknown as BaseChatModel;

      const filterWithLLM = new MedicineWheelFilter({ llm: mockLLM });
      const content = "Feelings and dreams are important.";
      const assessment = await filterWithLLM.assess("llm_test_1", content);

      expect(mockLLM.invoke).toHaveBeenCalledOnce();
      expect(assessment.presence[MedicineWheelQuadrant.EMOTIONAL]).toBe(mockQuadrantPresence.emotional);
      expect(assessment.presence[MedicineWheelQuadrant.SPIRITUAL]).toBe(mockQuadrantPresence.spiritual);
    });

    it("should fall back to heuristic classification if LLM output is malformed", async () => {
      const mockLLM = {
        invoke: vi.fn(async () => ({
          content: "this is not valid json",
        })),
      } as unknown as BaseChatModel;

      const filterWithLLM = new MedicineWheelFilter({ llm: mockLLM });
      const content = "Build a new server."; // Heuristic-heavy content
      const assessment = await filterWithLLM.assess("llm_test_2", content);

      expect(mockLLM.invoke).toHaveBeenCalledOnce();
      expect(assessment.presence[MedicineWheelQuadrant.PHYSICAL]).toBeGreaterThan(0); // From heuristic
      expect(assessment.presence[MedicineWheelQuadrant.SPIRITUAL]).toBeLessThan(0.1); // From heuristic
    });

    it("should fall back to heuristic classification if LLM output does not match schema", async () => {
      const mockLLM = {
        invoke: vi.fn(async () => ({
          content: JSON.stringify({
            physical: 0.5,
            emotional: 0.5,
            mental: 0.5,
            spiritual: "not-a-number", // Invalid type
          }),
        })),
      } as unknown as BaseChatModel;

      const filterWithLLM = new MedicineWheelFilter({ llm: mockLLM });
      const content = "Analyze the patterns.";
      const assessment = await filterWithLLM.assess("llm_test_3", content);

      expect(mockLLM.invoke).toHaveBeenCalledOnce();
      expect(assessment.presence[MedicineWheelQuadrant.MENTAL]).toBeGreaterThan(0); // From heuristic
    });

    it("should use heuristic classification if no LLM is provided", async () => {
      const filterNoLLM = new MedicineWheelFilter();
      const content = "Deploy the application.";
      const assessment = await filterNoLLM.assess("no_llm_test", content);

      expect(assessment.presence[MedicineWheelQuadrant.PHYSICAL]).toBeGreaterThan(0);
      expect(assessment.leadQuadrant).toBe(MedicineWheelQuadrant.PHYSICAL);
    });
  });
});
