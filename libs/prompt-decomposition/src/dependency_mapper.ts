/**
 * Dependency Mapper
 *
 * Maps dependencies between tasks, detects implicit requirements,
 * and produces a dependency-aware ordering.
 *
 * This is the SOUTH (Analysis) function of PDE — understanding
 * what needs to be learned and what depends on what.
 */

import { v4 as uuid } from "uuid";
import type { SecondaryIntent } from "./intent_extractor.js";
import type { Direction } from "./directional_decomposer.js";

// =============================================================================
// Types
// =============================================================================

export interface DependencyNode {
  id: string;
  intentId: string;
  action: string;
  target: string;
  direction: Direction;
  dependencies: string[]; // IDs of other DependencyNodes
  dependents: string[]; // IDs that depend on this
  depth: number; // 0 = root (no dependencies)
  completed: boolean;
}

export interface DependencyGraph {
  id: string;
  nodes: Map<string, DependencyNode>;
  roots: string[]; // Nodes with no dependencies
  leaves: string[]; // Nodes with no dependents
  maxDepth: number;
  hasCycle: boolean;
}

export interface ExecutionOrder {
  layers: DependencyNode[][]; // Parallel execution layers
  totalSteps: number;
  criticalPath: string[]; // Longest dependency chain
}

// =============================================================================
// DependencyMapper
// =============================================================================

export class DependencyMapper {
  /**
   * Build a dependency graph from secondary intents and their
   * directional classifications.
   */
  buildGraph(
    intents: SecondaryIntent[],
    directionMap?: Map<string, Direction>
  ): DependencyGraph {
    const id = uuid();
    const nodes = new Map<string, DependencyNode>();

    // Create nodes
    for (const intent of intents) {
      const nodeId = intent.id;
      const direction = directionMap?.get(intent.id) ?? this.inferDirection(intent);

      nodes.set(nodeId, {
        id: nodeId,
        intentId: intent.id,
        action: intent.action,
        target: intent.target,
        direction,
        dependencies: [],
        dependents: [],
        depth: 0,
        completed: false,
      });
    }

    // Wire dependencies from intent dependency field
    for (const intent of intents) {
      if (intent.dependency) {
        const node = nodes.get(intent.id);
        const depNode = nodes.get(intent.dependency);
        if (node && depNode) {
          node.dependencies.push(depNode.id);
          depNode.dependents.push(node.id);
        }
      }
    }

    // Infer additional structural dependencies
    this.inferStructuralDependencies(nodes);

    // Detect cycles
    const hasCycle = this.detectCycle(nodes);

    // Calculate depths
    if (!hasCycle) {
      this.calculateDepths(nodes);
    }

    // Find roots and leaves
    const roots: string[] = [];
    const leaves: string[] = [];
    let maxDepth = 0;

    for (const [id, node] of nodes) {
      if (node.dependencies.length === 0) roots.push(id);
      if (node.dependents.length === 0) leaves.push(id);
      if (node.depth > maxDepth) maxDepth = node.depth;
    }

    return { id, nodes, roots, leaves, maxDepth, hasCycle };
  }

  /**
   * Compute execution order from a dependency graph.
   * Groups tasks into parallel layers where all tasks in a layer
   * can execute simultaneously.
   */
  computeExecutionOrder(graph: DependencyGraph): ExecutionOrder {
    if (graph.hasCycle) {
      // Fall back to sequential if cycles detected
      const allNodes = Array.from(graph.nodes.values());
      return {
        layers: allNodes.map((n) => [n]),
        totalSteps: allNodes.length,
        criticalPath: allNodes.map((n) => n.id),
      };
    }

    const layers: DependencyNode[][] = [];
    const visited = new Set<string>();

    for (let depth = 0; depth <= graph.maxDepth; depth++) {
      const layer: DependencyNode[] = [];
      for (const node of graph.nodes.values()) {
        if (node.depth === depth && !visited.has(node.id)) {
          layer.push(node);
          visited.add(node.id);
        }
      }
      if (layer.length > 0) {
        layers.push(layer);
      }
    }

    // Add any unvisited nodes (shouldn't happen, but safety net)
    const remaining: DependencyNode[] = [];
    for (const node of graph.nodes.values()) {
      if (!visited.has(node.id)) {
        remaining.push(node);
        visited.add(node.id);
      }
    }
    if (remaining.length > 0) {
      layers.push(remaining);
    }

    const criticalPath = this.findCriticalPath(graph);

    return {
      layers,
      totalSteps: layers.length,
      criticalPath,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private inferDirection(intent: SecondaryIntent): Direction {
    const action = intent.action.toLowerCase();
    if (["investigate", "research", "explore", "study", "analyze"].includes(action)) {
      return "south" as Direction;
    }
    if (["test", "verify", "validate", "review", "check"].includes(action)) {
      return "west" as Direction;
    }
    if (["create", "build", "implement", "add", "deploy", "install", "modify", "use", "run"].includes(action)) {
      return "north" as Direction;
    }
    // Vision/planning
    if (["draft", "plan", "design", "manage"].includes(action)) {
      return "east" as Direction;
    }
    return "north" as Direction;
  }

  private inferStructuralDependencies(nodes: Map<string, DependencyNode>): void {
    const nodeArray = Array.from(nodes.values());

    // South (research) should come before North (action) on same topic
    const southNodes = nodeArray.filter((n) => n.direction === "south");
    const northNodes = nodeArray.filter((n) => n.direction === "north");

    for (const south of southNodes) {
      for (const north of northNodes) {
        if (
          this.topicsRelated(south.target, north.target) &&
          !north.dependencies.includes(south.id) &&
          !south.dependencies.includes(north.id) // avoid creating cycles
        ) {
          north.dependencies.push(south.id);
          south.dependents.push(north.id);
        }
      }
    }

    // West (validation) should come after North (action) on same topic
    const westNodes = nodeArray.filter((n) => n.direction === "west");
    for (const north of northNodes) {
      for (const west of westNodes) {
        if (
          this.topicsRelated(north.target, west.target) &&
          !west.dependencies.includes(north.id) &&
          !north.dependencies.includes(west.id)
        ) {
          west.dependencies.push(north.id);
          north.dependents.push(west.id);
        }
      }
    }
  }

  private topicsRelated(a: string, b: string): boolean {
    const wordsA = new Set(
      a.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
    );
    const wordsB = new Set(
      b.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
    );
    let overlap = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) overlap++;
    }
    return overlap >= 2;
  }

  private detectCycle(nodes: Map<string, DependencyNode>): boolean {
    const visited = new Set<string>();
    const inStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      if (inStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      inStack.add(nodeId);

      const node = nodes.get(nodeId);
      if (node) {
        for (const dep of node.dependents) {
          if (dfs(dep)) return true;
        }
      }

      inStack.delete(nodeId);
      return false;
    };

    for (const nodeId of nodes.keys()) {
      if (dfs(nodeId)) return true;
    }
    return false;
  }

  private calculateDepths(nodes: Map<string, DependencyNode>): void {
    const calculated = new Set<string>();

    const calcDepth = (nodeId: string): number => {
      if (calculated.has(nodeId)) {
        return nodes.get(nodeId)?.depth ?? 0;
      }

      const node = nodes.get(nodeId);
      if (!node) return 0;

      if (node.dependencies.length === 0) {
        node.depth = 0;
        calculated.add(nodeId);
        return 0;
      }

      let maxDepDep = 0;
      for (const depId of node.dependencies) {
        maxDepDep = Math.max(maxDepDep, calcDepth(depId));
      }

      node.depth = maxDepDep + 1;
      calculated.add(nodeId);
      return node.depth;
    };

    for (const nodeId of nodes.keys()) {
      calcDepth(nodeId);
    }
  }

  private findCriticalPath(graph: DependencyGraph): string[] {
    if (graph.leaves.length === 0) return [];

    let longestPath: string[] = [];

    const buildPath = (nodeId: string, path: string[]): void => {
      const node = graph.nodes.get(nodeId);
      if (!node) return;

      path.push(nodeId);

      if (node.dependencies.length === 0) {
        if (path.length > longestPath.length) {
          longestPath = [...path];
        }
      } else {
        for (const depId of node.dependencies) {
          buildPath(depId, [...path]);
        }
      }
    };

    for (const leafId of graph.leaves) {
      buildPath(leafId, []);
    }

    return longestPath.reverse();
  }
}
