import { describe, it, expect, beforeEach } from "vitest";
import { InquiryGenerator } from "../inquiry_generator.js";
import { InquiryRouter } from "../inquiry_router.js";
import { RelationalEnricher } from "../relational_enricher.js";
import { InquiryFormatter } from "../inquiry_formatter.js";
import { generateInquiries } from "../index.js";
import { InquirySource, InquiryStatus } from "../types.js";
import type { Inquiry, InquiryBatch } from "../types.js";
import { Direction } from "ava-langchain-prompt-decomposition";
import type { DecompositionResult } from "ava-langchain-prompt-decomposition";

// =============================================================================
// Mock Data
// =============================================================================

function createMockDecomposition(): DecompositionResult {
  return {
    id: "pde-test-001",
    timestamp: "2026-03-30T12:00:00.000Z",
    prompt: "Research indigenous epistemology frameworks and build a knowledge graph that explores existing codebase patterns",
    primary: {
      action: "build",
      target: "knowledge graph",
      urgency: "session",
      confidence: 0.85,
    },
    secondary: [],
    context: {
      filesNeeded: ["src/graph.ts", "src/schema.ts"],
      toolsRequired: ["typescript", "neo4j"],
      assumptions: [
        "The codebase uses TypeScript",
        "Neo4j is the target graph database",
        "Indigenous frameworks are documented in the workspace",
      ],
    },
    outputs: {
      artifacts: ["knowledge-graph-schema.ts"],
      updates: ["README.md"],
      communications: [],
    },
    directions: {
      [Direction.EAST]: [
        { text: "Build a knowledge graph for epistemological exploration", confidence: 0.9, implicit: false },
        { text: "Define the vision for relational data representation", confidence: 0.7, implicit: true },
      ],
      [Direction.SOUTH]: [
        { text: "Research indigenous epistemology frameworks from academic sources", confidence: 0.95, implicit: false },
        { text: "Study existing graph database patterns in the literature", confidence: 0.8, implicit: false },
      ],
      [Direction.WEST]: [
        { text: "Validate that the graph schema honors relational ontology", confidence: 0.75, implicit: false },
      ],
      [Direction.NORTH]: [
        { text: "Implement the graph schema in TypeScript", confidence: 0.85, implicit: false },
        { text: "Scan the workspace for existing dependency patterns", confidence: 0.6, implicit: true },
      ],
    },
    actionStack: [],
    balance: 0.72,
    leadDirection: Direction.SOUTH,
    neglectedDirections: [],
    ambiguities: [
      { text: "Which indigenous framework is primary?", suggestion: "Clarify with Wilson (2008) or Kovach (2009)" },
      { text: "Is the graph meant for read or write workloads?", suggestion: "Determine query patterns first" },
    ],
  };
}

// =============================================================================
// InquiryGenerator Tests
// =============================================================================

describe("InquiryGenerator", () => {
  let generator: InquiryGenerator;
  let decomposition: DecompositionResult;

  beforeEach(() => {
    generator = new InquiryGenerator();
    decomposition = createMockDecomposition();
  });

  describe("generate", () => {
    it("should produce a valid InquiryBatch with all directions", () => {
      const batch = generator.generate(decomposition);

      expect(batch.id).toBeDefined();
      expect(batch.timestamp).toBeDefined();
      expect(batch.pde_id).toBe("pde-test-001");
      expect(batch.total).toBeGreaterThan(0);

      // All four directions should be arrays
      expect(Array.isArray(batch.east)).toBe(true);
      expect(Array.isArray(batch.south)).toBe(true);
      expect(Array.isArray(batch.west)).toBe(true);
      expect(Array.isArray(batch.north)).toBe(true);
    });

    it("should generate inquiries from EAST directional insights", () => {
      const batch = generator.generate(decomposition);
      expect(batch.east.length).toBe(2);
      expect(batch.east[0].direction).toBe("east");
      expect(batch.east[0].status).toBe(InquiryStatus.PENDING);
    });

    it("should generate inquiries from SOUTH directional insights", () => {
      const batch = generator.generate(decomposition);
      // 2 from directional insights + 3 from assumptions
      expect(batch.south.length).toBeGreaterThanOrEqual(2);
      expect(batch.south[0].direction).toBe("south");
    });

    it("should generate inquiries from WEST insights and ambiguities", () => {
      const batch = generator.generate(decomposition);
      // 1 from directional insight + 2 from ambiguities
      expect(batch.west.length).toBe(3);
    });

    it("should generate inquiries from NORTH directional insights", () => {
      const batch = generator.generate(decomposition);
      expect(batch.north.length).toBe(2);
      expect(batch.north[0].direction).toBe("north");
    });

    it("should include ambiguity-generated inquiries in WEST", () => {
      const batch = generator.generate(decomposition);
      const ambiguityInquiries = batch.west.filter((i) =>
        i.query.startsWith("Clarify:")
      );
      expect(ambiguityInquiries.length).toBe(2);
    });

    it("should include assumption-generated inquiries in SOUTH", () => {
      const batch = generator.generate(decomposition);
      const assumptionInquiries = batch.south.filter((i) =>
        i.query.startsWith("Verify assumption:")
      );
      expect(assumptionInquiries.length).toBe(3);
    });

    it("should respect minConfidence filter", () => {
      const strictGenerator = new InquiryGenerator({ minConfidence: 0.8 });
      const batch = strictGenerator.generate(decomposition);

      // Only insights with confidence >= 0.8 should appear
      const allInquiries = generator.flatten(batch);
      for (const inquiry of allInquiries) {
        // Ambiguity/assumption inquiries have their own fixed confidences
        if (!inquiry.query.startsWith("Clarify:") && !inquiry.query.startsWith("Verify assumption:")) {
          expect(inquiry.confidence).toBeGreaterThanOrEqual(0.8);
        }
      }
    });

    it("should exclude ambiguities when configured", () => {
      const noAmbiguityGen = new InquiryGenerator({ includeAmbiguities: false });
      const batch = noAmbiguityGen.generate(decomposition);
      const ambiguityInquiries = batch.west.filter((i) =>
        i.query.startsWith("Clarify:")
      );
      expect(ambiguityInquiries.length).toBe(0);
    });

    it("should exclude assumptions when configured", () => {
      const noAssumptionGen = new InquiryGenerator({ includeAssumptions: false });
      const batch = noAssumptionGen.generate(decomposition);
      const assumptionInquiries = batch.south.filter((i) =>
        i.query.startsWith("Verify assumption:")
      );
      expect(assumptionInquiries.length).toBe(0);
    });

    it("should calculate correct total", () => {
      const batch = generator.generate(decomposition);
      const sum = batch.east.length + batch.south.length + batch.west.length + batch.north.length;
      expect(batch.total).toBe(sum);
    });

    it("should carry pde_id on every inquiry", () => {
      const batch = generator.generate(decomposition);
      const allInquiries = generator.flatten(batch);
      for (const inquiry of allInquiries) {
        expect(inquiry.pde_id).toBe("pde-test-001");
      }
    });
  });

  describe("flatten", () => {
    it("should return all inquiries as a flat array", () => {
      const batch = generator.generate(decomposition);
      const flat = generator.flatten(batch);
      expect(flat.length).toBe(batch.total);
    });
  });

  describe("source classification", () => {
    it("should classify academic queries to deep-search", () => {
      const batch = generator.generate(decomposition);
      // "Research indigenous epistemology frameworks from academic sources"
      const academicInquiry = batch.south.find((i) =>
        i.query.toLowerCase().includes("research") && i.query.toLowerCase().includes("academic")
      );
      expect(academicInquiry).toBeDefined();
      expect(academicInquiry!.source).toBe(InquirySource.DEEP_SEARCH_ACADEMIC);
    });

    it("should classify workspace scan queries appropriately", () => {
      const batch = generator.generate(decomposition);
      // "Scan the workspace for existing dependency patterns"
      const scanInquiry = batch.north.find((i) =>
        i.query.toLowerCase().includes("scan") || i.query.toLowerCase().includes("dependency")
      );
      expect(scanInquiry).toBeDefined();
      if (scanInquiry) {
        expect([InquirySource.WORKSPACE_SCAN, InquirySource.QMD_LOCAL]).toContain(scanInquiry.source);
      }
    });
  });
});

// =============================================================================
// InquiryRouter Tests
// =============================================================================

describe("InquiryRouter", () => {
  let router: InquiryRouter;

  beforeEach(() => {
    router = new InquiryRouter();
  });

  describe("classify", () => {
    it("should classify an inquiry with academic keywords to deep-search", () => {
      const inquiry: Inquiry = {
        id: "test-1",
        timestamp: new Date().toISOString(),
        direction: "south",
        source: "qmd-local",
        query: "What does the academic research say about relational ontology?",
        status: "pending",
        relational_context: "",
        accountability: "",
        pde_id: "pde-001",
        confidence: 0.8,
      };

      const decision = router.classify(inquiry);
      expect(decision.source).toBe(InquirySource.DEEP_SEARCH_ACADEMIC);
      expect(decision.matched_keywords.length).toBeGreaterThan(0);
    });

    it("should classify workspace queries to workspace-scan", () => {
      const inquiry: Inquiry = {
        id: "test-2",
        timestamp: new Date().toISOString(),
        direction: "north",
        source: "qmd-local",
        query: "Find all files in the directory that import the dependency",
        status: "pending",
        relational_context: "",
        accountability: "",
        pde_id: "pde-001",
        confidence: 0.7,
      };

      const decision = router.classify(inquiry);
      expect(decision.source).toBe(InquirySource.WORKSPACE_SCAN);
    });

    it("should use direction affinity as fallback", () => {
      const inquiry: Inquiry = {
        id: "test-3",
        timestamp: new Date().toISOString(),
        direction: "south",
        source: "qmd-local",
        query: "Elaborate on the matter at hand",
        status: "pending",
        relational_context: "",
        accountability: "",
        pde_id: "pde-001",
        confidence: 0.5,
      };

      const decision = router.classify(inquiry);
      // South direction affinity → deep-search-academic
      expect(decision.source).toBe(InquirySource.DEEP_SEARCH_ACADEMIC);
    });
  });

  describe("route methods", () => {
    const baseInquiry: Inquiry = {
      id: "test-route",
      timestamp: new Date().toISOString(),
      direction: "east",
      source: "qmd-local",
      query: "Test query",
      status: "pending",
      relational_context: "",
      accountability: "",
      pde_id: "pde-001",
      confidence: 0.8,
    };

    it("routeToQmd should set source to qmd-local", () => {
      const routed = router.routeToQmd(baseInquiry);
      expect(routed.source).toBe(InquirySource.QMD_LOCAL);
      expect(routed.status).toBe(InquiryStatus.ROUTED);
    });

    it("routeToDeepSearch should set source to deep-search-academic", () => {
      const routed = router.routeToDeepSearch(baseInquiry);
      expect(routed.source).toBe(InquirySource.DEEP_SEARCH_ACADEMIC);
      expect(routed.status).toBe(InquiryStatus.ROUTED);
    });

    it("routeToWorkspaceScan should set source to workspace-scan", () => {
      const routed = router.routeToWorkspaceScan(baseInquiry);
      expect(routed.source).toBe(InquirySource.WORKSPACE_SCAN);
      expect(routed.status).toBe(InquiryStatus.ROUTED);
    });
  });

  describe("routeAll", () => {
    it("should route all inquiries in a batch", () => {
      const generator = new InquiryGenerator();
      const batch = generator.generate(createMockDecomposition());
      const routed = router.routeAll(batch);

      expect(routed.decisions.length).toBe(batch.total);
      expect(routed.routing_timestamp).toBeDefined();

      // All inquiries should now be ROUTED
      const allRouted = [
        ...routed.east,
        ...routed.south,
        ...routed.west,
        ...routed.north,
      ];
      for (const inquiry of allRouted) {
        expect(inquiry.status).toBe(InquiryStatus.ROUTED);
      }
    });
  });
});

// =============================================================================
// RelationalEnricher Tests
// =============================================================================

describe("RelationalEnricher", () => {
  let enricher: RelationalEnricher;

  beforeEach(() => {
    enricher = new RelationalEnricher();
  });

  describe("enrich", () => {
    it("should add relational context to an inquiry", () => {
      const inquiry: Inquiry = {
        id: "test-enrich",
        timestamp: new Date().toISOString(),
        direction: "west",
        source: "qmd-local",
        query: "Validate the schema integrity",
        status: "pending",
        relational_context: "",
        accountability: "",
        pde_id: "pde-001",
        confidence: 0.8,
      };

      const enriched = enricher.enrich(inquiry);
      expect(enriched.relational_context).toContain("reflection");
      expect(enriched.accountability).toContain("honest reflection");
      expect(enriched.ceremonial_intent).toBeDefined();
      expect(enriched.indigenous_lens).toBeDefined();
      expect(enriched.western_lens).toBeDefined();
    });

    it("should add Two-Eyed Seeing markers by default", () => {
      const inquiry: Inquiry = {
        id: "test-tes",
        timestamp: new Date().toISOString(),
        direction: "south",
        source: "deep-search-academic",
        query: "Research relational ontology",
        status: "pending",
        relational_context: "",
        accountability: "",
        pde_id: "pde-001",
        confidence: 0.9,
      };

      const enriched = enricher.enrich(inquiry);
      expect(enriched.indigenous_lens).toContain("Medicine Wheel");
      expect(enriched.western_lens).toContain("Literature review");
    });

    it("should skip Two-Eyed Seeing when disabled", () => {
      const noTES = new RelationalEnricher({ addTwoEyedSeeing: false });
      const inquiry: Inquiry = {
        id: "test-no-tes",
        timestamp: new Date().toISOString(),
        direction: "east",
        source: "qmd-local",
        query: "What is the vision?",
        status: "pending",
        relational_context: "",
        accountability: "",
        pde_id: "pde-001",
        confidence: 0.7,
      };

      const enriched = noTES.enrich(inquiry);
      expect(enriched.indigenous_lens).toBeUndefined();
      expect(enriched.western_lens).toBeUndefined();
    });

    it("should skip ceremonial intent when disabled", () => {
      const noCeremony = new RelationalEnricher({ addCeremonialIntent: false });
      const inquiry: Inquiry = {
        id: "test-no-ceremony",
        timestamp: new Date().toISOString(),
        direction: "west",
        source: "qmd-local",
        query: "Reflect on this",
        status: "pending",
        relational_context: "",
        accountability: "",
        pde_id: "pde-001",
        confidence: 0.6,
      };

      const enriched = noCeremony.enrich(inquiry);
      expect(enriched.ceremonial_intent).toBeUndefined();
    });

    it("should append additional context when provided", () => {
      const inquiry: Inquiry = {
        id: "test-ctx",
        timestamp: new Date().toISOString(),
        direction: "north",
        source: "workspace-scan",
        query: "Execute deployment",
        status: "pending",
        relational_context: "",
        accountability: "",
        pde_id: "pde-001",
        confidence: 0.85,
      };

      const enriched = enricher.enrich(inquiry, "This serves the Anishinaabe community.");
      expect(enriched.relational_context).toContain("Anishinaabe");
    });
  });

  describe("enrichBatch", () => {
    it("should enrich all inquiries in a batch", () => {
      const generator = new InquiryGenerator();
      const batch = generator.generate(createMockDecomposition());
      const enriched = enricher.enrichBatch(batch);

      const allInquiries = [
        ...enriched.east,
        ...enriched.south,
        ...enriched.west,
        ...enriched.north,
      ];

      for (const inquiry of allInquiries) {
        expect(inquiry.relational_context).toBeTruthy();
        expect(inquiry.accountability).toBeTruthy();
        expect(inquiry.indigenous_lens).toBeTruthy();
        expect(inquiry.western_lens).toBeTruthy();
      }
    });
  });
});

// =============================================================================
// InquiryFormatter Tests
// =============================================================================

describe("InquiryFormatter", () => {
  let formatter: InquiryFormatter;

  beforeEach(() => {
    formatter = new InquiryFormatter();
  });

  describe("toQmdQuery", () => {
    it("should use vec mode for questions", () => {
      const inquiry: Inquiry = {
        id: "fmt-1",
        timestamp: new Date().toISOString(),
        direction: "south",
        source: "qmd-local",
        query: "What patterns exist in the current knowledge graph implementation?",
        status: "routed",
        relational_context: "Test context",
        accountability: "",
        pde_id: "pde-001",
        confidence: 0.8,
      };

      const qmd = formatter.toQmdQuery(inquiry);
      expect(qmd.mode).toBe("vec");
      expect(qmd.query).toBe(inquiry.query);
      expect(qmd.direction).toBe("south");
    });

    it("should use lex mode for short non-question queries", () => {
      const inquiry: Inquiry = {
        id: "fmt-2",
        timestamp: new Date().toISOString(),
        direction: "east",
        source: "qmd-local",
        query: "knowledge graph schema",
        status: "routed",
        relational_context: "",
        accountability: "",
        pde_id: "pde-001",
        confidence: 0.7,
      };

      const qmd = formatter.toQmdQuery(inquiry);
      expect(qmd.mode).toBe("lex");
    });

    it("should use hyde mode for complex non-question queries", () => {
      const inquiry: Inquiry = {
        id: "fmt-3",
        timestamp: new Date().toISOString(),
        direction: "west",
        source: "qmd-local",
        query: "The relational ontology framework should integrate with existing graph patterns and honor indigenous epistemology",
        status: "routed",
        relational_context: "",
        accountability: "",
        pde_id: "pde-001",
        confidence: 0.65,
      };

      const qmd = formatter.toQmdQuery(inquiry);
      expect(qmd.mode).toBe("hyde");
    });
  });

  describe("toDeepSearchQuery", () => {
    it("should extract search terms from the query", () => {
      const inquiry: Inquiry = {
        id: "fmt-ds",
        timestamp: new Date().toISOString(),
        direction: "south",
        source: "deep-search-academic",
        query: "Research indigenous epistemology frameworks for knowledge representation",
        status: "routed",
        relational_context: "Learning context",
        accountability: "",
        indigenous_lens: "Medicine Wheel perspective",
        western_lens: "Literature review",
        pde_id: "pde-001",
        confidence: 0.9,
      };

      const ds = formatter.toDeepSearchQuery(inquiry);
      expect(ds.search_terms).toContain("indigenous");
      expect(ds.search_terms).toContain("epistemology");
      expect(ds.search_terms).toContain("frameworks");
      expect(ds.academic_context).toContain("Learning context");
    });
  });

  describe("toMarkdown", () => {
    it("should produce valid markdown with all sections", () => {
      const generator = new InquiryGenerator();
      const batch = generator.generate(createMockDecomposition());
      const md = formatter.toMarkdown(batch);

      expect(md).toContain("# Inquiry Report");
      expect(md).toContain("**Batch ID:**");
      expect(md).toContain("**PDE Source:**");
      expect(md).toContain("pde-test-001");
      expect(md).toContain("🌅"); // East emoji
      expect(md).toContain("🌿"); // South emoji
    });
  });

  describe("toJSON", () => {
    it("should produce valid JSON", () => {
      const generator = new InquiryGenerator();
      const batch = generator.generate(createMockDecomposition());
      const json = formatter.toJSON(batch);

      const parsed = JSON.parse(json);
      expect(parsed.id).toBeDefined();
      expect(parsed.pde_id).toBe("pde-test-001");
      expect(parsed.total).toBe(batch.total);
    });
  });
});

// =============================================================================
// Full Pipeline Tests
// =============================================================================

describe("generateInquiries (full pipeline)", () => {
  it("should run the full pipeline and produce routed inquiries", () => {
    const decomposition = createMockDecomposition();
    const result = generateInquiries(decomposition);

    expect(result.batch).toBeDefined();
    expect(result.batch.total).toBeGreaterThan(0);
    expect(result.batch.decisions).toBeDefined();
    expect(result.batch.decisions.length).toBe(result.batch.total);
    expect(result.markdown).toContain("# Inquiry Report");
    expect(result.json).toBeTruthy();

    // All inquiries should be routed
    const allInquiries = [
      ...result.batch.east,
      ...result.batch.south,
      ...result.batch.west,
      ...result.batch.north,
    ];
    for (const inquiry of allInquiries) {
      expect(inquiry.status).toBe(InquiryStatus.ROUTED);
      expect(inquiry.relational_context).toBeTruthy();
      expect(inquiry.indigenous_lens).toBeTruthy();
      expect(inquiry.western_lens).toBeTruthy();
    }
  });

  it("should accept generator options", () => {
    const decomposition = createMockDecomposition();
    const result = generateInquiries(decomposition, {
      generator: { includeAmbiguities: false, includeAssumptions: false },
    });

    // Should only have directional insight inquiries
    const allInquiries = [
      ...result.batch.east,
      ...result.batch.south,
      ...result.batch.west,
      ...result.batch.north,
    ];
    const ambiguities = allInquiries.filter((i) => i.query.startsWith("Clarify:"));
    const assumptions = allInquiries.filter((i) => i.query.startsWith("Verify assumption:"));
    expect(ambiguities.length).toBe(0);
    expect(assumptions.length).toBe(0);
  });
});
