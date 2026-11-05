/**
 * Unit tests for dsh-squad CLI
 */

import { test, describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { 
  loadAgents,
  loadTasks,
  validateTasks,
  buildDependencyGraph,
  detectCycles,
  calculateDepths,
  countParallelTasks
} from '../lib/core.mjs';

// ============================================================================
// loadAgents() Tests
// ============================================================================

describe('loadAgents', () => {
  test('should return array of agents', () => {
    const agents = loadAgents();
    assert.ok(Array.isArray(agents), 'Result should be an array');
    assert.ok(agents.length > 0, 'Should have at least one agent');
  });
  
  test('each agent should have required properties', () => {
    const agents = loadAgents();
    for (const agent of agents) {
      assert.ok(agent.name, 'Agent should have name');
      assert.ok(agent.role, 'Agent should have role');
      assert.ok(Array.isArray(agent.tags), 'Agent should have tags array');
      assert.ok(agent.description, 'Agent should have description');
    }
  });
  
  test('should not include disabled agents', () => {
    const agents = loadAgents();
    const disabled = agents.filter(a => a.disabled === true);
    assert.strictEqual(disabled.length, 0, 'Should not include disabled agents');
  });
  
  test('all agents should have valid tag types', () => {
    const agents = loadAgents();
    for (const agent of agents) {
      assert.ok(
        agent.tags.every(tag => typeof tag === 'string'),
        'All tags should be strings'
      );
    }
  });
});

// ============================================================================
// loadTasks() Tests
// ============================================================================

describe('loadTasks', () => {
  test('should reject invalid filepath - null', () => {
    assert.throws(
      () => loadTasks(null),
      /Invalid file path/,
      'Should throw for null filepath'
    );
  });
  
  test('should reject invalid filepath - empty string', () => {
    assert.throws(
      () => loadTasks(''),
      /Invalid file path/,
      'Should throw for empty string filepath'
    );
  });
  
  test('should reject invalid filepath - number', () => {
    assert.throws(
      () => loadTasks(123),
      /Invalid file path/,
      'Should throw for number filepath'
    );
  });
  
  test('should reject invalid filepath - undefined', () => {
    assert.throws(
      () => loadTasks(undefined),
      /Invalid file path/,
      'Should throw for undefined filepath'
    );
  });
  
  test('should handle non-existent file', () => {
    assert.throws(
      () => loadTasks('nonexistent.json'),
      /File not found/,
      'Should throw for non-existent file'
    );
  });
  
  test('should load valid task file', () => {
    // This test would require a test fixture file
    // For now, we'll skip it or use a mock
    // See integration tests for file loading
  });
});

// ============================================================================
// detectCycles() Tests
// ============================================================================

describe('detectCycles', () => {
  test('should detect simple cycle', () => {
    const graph = { a: ['b'], b: ['a'] };
    const cycles = detectCycles(graph);
    assert.ok(cycles.length > 0, 'Should detect cycle');
    assert.ok(cycles[0].includes('a'), 'Cycle should include node a');
    assert.ok(cycles[0].includes('b'), 'Cycle should include node b');
  });
  
  test('should return empty for no cycles', () => {
    const graph = { a: [], b: ['a'], c: ['b'] };
    const cycles = detectCycles(graph);
    assert.strictEqual(cycles.length, 0, 'Should not detect cycles');
  });
  
  test('should handle empty graph', () => {
    const graph = {};
    const cycles = detectCycles(graph);
    assert.strictEqual(cycles.length, 0, 'Empty graph should have no cycles');
  });
  
  test('should detect self-loop', () => {
    const graph = { a: ['a'] };
    const cycles = detectCycles(graph);
    assert.ok(cycles.length > 0, 'Should detect self-loop');
  });
  
  test('should detect complex cycle', () => {
    const graph = {
      a: ['b'],
      b: ['c'],
      c: ['a']
    };
    const cycles = detectCycles(graph);
    assert.ok(cycles.length > 0, 'Should detect complex cycle');
  });
  
  test('should detect multiple independent cycles', () => {
    const graph = {
      a: ['b'],
      b: ['a'],
      c: ['d'],
      d: ['c']
    };
    const cycles = detectCycles(graph);
    assert.ok(cycles.length >= 2, 'Should detect multiple cycles');
  });
  
  test('should handle disconnected nodes', () => {
    const graph = {
      a: [],
      b: [],
      c: []
    };
    const cycles = detectCycles(graph);
    assert.strictEqual(cycles.length, 0, 'Disconnected nodes should not create cycles');
  });
});

// ============================================================================
// validateTasks() Tests
// ============================================================================

describe('validateTasks', () => {
  test('should validate correct tasks', () => {
    const tasks = [
      { id: 'test', agent: 'backend', title: 'Test' }
    ];
    const errors = validateTasks(tasks);
    assert.strictEqual(errors.length, 0, 'Valid tasks should have no errors');
  });
  
  test('should detect duplicate IDs', () => {
    const tasks = [
      { id: 'test', agent: 'backend', title: 'Test 1' },
      { id: 'test', agent: 'frontend', title: 'Test 2' }
    ];
    const errors = validateTasks(tasks);
    assert.ok(errors.length > 0, 'Should detect errors');
    assert.ok(errors.some(e => e.includes('Duplicate')), 'Should report duplicate ID');
  });
  
  test('should detect invalid dependencies', () => {
    const tasks = [
      { id: 'test', agent: 'backend', title: 'Test', depends: ['nonexistent'] }
    ];
    const errors = validateTasks(tasks);
    assert.ok(errors.length > 0, 'Should detect errors');
    assert.ok(
      errors.some(e => e.includes('non-existent')),
      'Should report non-existent dependency'
    );
  });
  
  test('should detect unknown agents', () => {
    const tasks = [
      { id: 'test', agent: 'unknown-agent', title: 'Test' }
    ];
    const errors = validateTasks(tasks);
    assert.ok(errors.length > 0, 'Should detect errors');
    assert.ok(
      errors.some(e => e.includes('unknown agent')),
      'Should report unknown agent'
    );
  });
  
  test('should detect dependency cycles', () => {
    const tasks = [
      { id: 'a', agent: 'backend', title: 'Task A', depends: ['b'] },
      { id: 'b', agent: 'frontend', title: 'Task B', depends: ['a'] }
    ];
    const errors = validateTasks(tasks);
    assert.ok(errors.length > 0, 'Should detect errors');
    assert.ok(
      errors.some(e => e.includes('cycle')),
      'Should report dependency cycle'
    );
  });
  
  test('should validate multiple errors at once', () => {
    const tasks = [
      { id: 'dup', agent: 'backend', title: 'Task 1' },
      { id: 'dup', agent: 'frontend', title: 'Task 2' },
      { id: 'unknown', agent: 'nonexistent', title: 'Task 3' }
    ];
    const errors = validateTasks(tasks);
    assert.ok(errors.length >= 2, 'Should detect multiple errors');
  });
  
  test('should handle tasks without depends', () => {
    const tasks = [
      { id: 'test', agent: 'backend', title: 'Test' }
    ];
    const errors = validateTasks(tasks);
    assert.strictEqual(errors.length, 0, 'Tasks without depends should be valid');
  });
  
  test('should handle empty tasks array', () => {
    const tasks = [];
    const errors = validateTasks(tasks);
    assert.strictEqual(errors.length, 0, 'Empty tasks array should be valid');
  });
});

// ============================================================================
// buildDependencyGraph() Tests
// ============================================================================

describe('buildDependencyGraph', () => {
  test('should build correct graph', () => {
    const tasks = [
      { id: 'a', depends: [] },
      { id: 'b', depends: ['a'] }
    ];
    const graph = buildDependencyGraph(tasks);
    assert.deepStrictEqual(graph, { a: [], b: ['a'] });
  });
  
  test('should handle tasks without depends', () => {
    const tasks = [
      { id: 'a' }
    ];
    const graph = buildDependencyGraph(tasks);
    assert.deepStrictEqual(graph, { a: [] });
  });
  
  test('should handle multiple dependencies', () => {
    const tasks = [
      { id: 'a', depends: [] },
      { id: 'b', depends: [] },
      { id: 'c', depends: ['a', 'b'] }
    ];
    const graph = buildDependencyGraph(tasks);
    assert.deepStrictEqual(graph, { a: [], b: [], c: ['a', 'b'] });
  });
  
  test('should handle empty tasks array', () => {
    const tasks = [];
    const graph = buildDependencyGraph(tasks);
    assert.deepStrictEqual(graph, {});
  });
});

// ============================================================================
// calculateDepths() Tests
// ============================================================================

describe('calculateDepths', () => {
  test('should calculate correct depths', () => {
    const graph = { a: [], b: ['a'], c: ['b'] };
    const depths = calculateDepths(graph);
    assert.strictEqual(depths.a, 0, 'Root node should have depth 0');
    assert.strictEqual(depths.b, 1, 'First level should have depth 1');
    assert.strictEqual(depths.c, 2, 'Second level should have depth 2');
  });
  
  test('should handle parallel tasks', () => {
    const graph = { a: [], b: [], c: ['a', 'b'] };
    const depths = calculateDepths(graph);
    assert.strictEqual(depths.c, 1, 'Task with multiple roots should have correct depth');
  });
  
  test('should handle diamond dependency', () => {
    const graph = {
      a: [],
      b: ['a'],
      c: ['a'],
      d: ['b', 'c']
    };
    const depths = calculateDepths(graph);
    assert.strictEqual(depths.a, 0);
    assert.strictEqual(depths.b, 1);
    assert.strictEqual(depths.c, 1);
    assert.strictEqual(depths.d, 2);
  });
  
  test('should handle empty graph', () => {
    const graph = {};
    const depths = calculateDepths(graph);
    assert.deepStrictEqual(depths, {});
  });
  
  test('should handle disconnected graph', () => {
    const graph = { a: [], b: [], c: [] };
    const depths = calculateDepths(graph);
    assert.strictEqual(depths.a, 0);
    assert.strictEqual(depths.b, 0);
    assert.strictEqual(depths.c, 0);
  });
});

// ============================================================================
// countParallelTasks() Tests
// ============================================================================

describe('countParallelTasks', () => {
  test('should count parallel tasks correctly', () => {
    const graph = { a: [], b: [], c: ['a', 'b'] };
    const depths = calculateDepths(graph);
    const parallel = countParallelTasks(graph, depths);
    assert.strictEqual(parallel, 2, 'Should count 2 parallel tasks at root level');
  });
  
  test('should return 1 for sequential tasks', () => {
    const graph = { a: [], b: ['a'], c: ['b'] };
    const depths = calculateDepths(graph);
    const parallel = countParallelTasks(graph, depths);
    assert.strictEqual(parallel, 1, 'Sequential tasks should have parallelism 1');
  });
  
  test('should handle empty graph', () => {
    const graph = {};
    const depths = calculateDepths(graph);
    const parallel = countParallelTasks(graph, depths);
    assert.strictEqual(parallel, 0, 'Empty graph should have 0 parallelism');
  });
});

// ============================================================================
// Edge Cases and Integration Tests
// ============================================================================

describe('Edge Cases', () => {
  test('validateTasks should handle missing task properties', () => {
    const tasks = [
      { id: 'test', agent: 'backend' }
    ];
    const errors = validateTasks(tasks);
    assert.strictEqual(errors.length, 0, 'Task without title should be valid');
  });
  
  test('detectCycles should handle missing nodes gracefully', () => {
    const graph = { a: ['b'] };
    const cycles = detectCycles(graph);
    assert.strictEqual(cycles.length, 0, 'Missing dependency should not cause error');
  });
  
  test('calculateDepths should handle missing dependencies', () => {
    const graph = { a: ['nonexistent'] };
    const depths = calculateDepths(graph);
    assert.ok(depths.a !== undefined, 'Should calculate depth even with missing dep');
  });
  
  test('buildDependencyGraph should preserve task order', () => {
    const tasks = [
      { id: 'first', depends: [] },
      { id: 'second', depends: ['first'] },
      { id: 'third', depends: ['first', 'second'] }
    ];
    const graph = buildDependencyGraph(tasks);
    const keys = Object.keys(graph);
    assert.strictEqual(keys[0], 'first');
    assert.strictEqual(keys[1], 'second');
    assert.strictEqual(keys[2], 'third');
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance', () => {
  test('detectCycles should handle large graphs', () => {
    // Create a large graph without cycles
    const graph = {};
    for (let i = 0; i < 100; i++) {
      graph[`task_${i}`] = i > 0 ? [`task_${i-1}`] : [];
    }
    
    const cycles = detectCycles(graph);
    assert.strictEqual(cycles.length, 0, 'Large graph should be processed without cycles');
  });
  
  test('calculateDepths should handle large graphs', () => {
    // Create a large graph
    const graph = {};
    for (let i = 0; i < 100; i++) {
      graph[`task_${i}`] = i > 0 ? [`task_${i-1}`] : [];
    }
    
    const depths = calculateDepths(graph);
    assert.strictEqual(Object.keys(depths).length, 100);
    assert.strictEqual(depths.task_99, 99);
  });
});

console.log('All tests loaded successfully');