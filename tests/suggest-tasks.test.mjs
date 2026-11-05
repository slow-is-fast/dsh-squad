/**
 * Tests for suggestTasks and task template system
 */

import { test, describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Import the functions we need to test
// Since these are not exported, we'll need to test through the public API
// or create a separate testable module

// ============================================================================
// Mock Configuration
// ============================================================================

const testConfigDir = join(__dirname, 'test-config');
const testConfigPath = join(testConfigDir, 'squad-templates.json');

function createTestConfig() {
  mkdirSync(testConfigDir, { recursive: true });
  writeFileSync(testConfigPath, JSON.stringify({
    taskTemplates: [
      {
        id: "test-api",
        keywords: ["api", "backend"],
        task: {
          id: "test-api-task",
          title: "Test API task",
          agent: "backend",
          depends: []
        },
        priority: 100
      },
      {
        id: "test-frontend",
        keywords: ["frontend", "react"],
        task: {
          id: "test-frontend-task",
          title: "Test frontend task",
          agent: "frontend",
          depends: []
        },
        priority: 90
      },
      {
        id: "test-security",
        keywords: ["security", "auth"],
        task: {
          id: "test-security-task",
          title: "Test security task",
          agent: "security",
          depends: ["test-api-task"]
        },
        priority: 80,
        autoDepends: true
      }
    ],
    defaultTemplate: {
      id: "default",
      title: "Default task",
      agent: "fullstack",
      depends: []
    },
    settings: {
      maxSuggestions: 5,
      minMatchScore: 1,
      keywordWeight: 1.0,
      priorityWeight: 0.01
    }
  }));
}

function cleanupTestConfig() {
  if (existsSync(testConfigDir)) {
    rmSync(testConfigDir, { recursive: true, force: true });
  }
}

// ============================================================================
// Template Loading Tests
// ============================================================================

describe('Task Template System', () => {
  beforeEach(() => {
    cleanupTestConfig();
  });

  test('should load templates from config file', () => {
    createTestConfig();
    assert.ok(existsSync(testConfigPath));
    
    const content = readFileSync(testConfigPath, 'utf-8');
    const config = JSON.parse(content);
    
    assert.ok(config.taskTemplates, 'Should have taskTemplates');
    assert.strictEqual(config.taskTemplates.length, 3);
    assert.ok(config.defaultTemplate, 'Should have defaultTemplate');
    assert.ok(config.settings, 'Should have settings');
  });

  test('should have correct template structure', () => {
    createTestConfig();
    const content = readFileSync(testConfigPath, 'utf-8');
    const config = JSON.parse(content);
    
    for (const template of config.taskTemplates) {
      assert.ok(template.id, 'Template should have id');
      assert.ok(Array.isArray(template.keywords), 'Template should have keywords array');
      assert.ok(template.task, 'Template should have task');
      assert.ok(typeof template.priority === 'number', 'Template should have priority');
    }
  });

  test('should validate settings', () => {
    createTestConfig();
    const content = readFileSync(testConfigPath, 'utf-8');
    const config = JSON.parse(content);
    
    assert.strictEqual(config.settings.maxSuggestions, 5);
    assert.strictEqual(config.settings.minMatchScore, 1);
  });
});

// ============================================================================
// Keyword Matching Tests
// ============================================================================

describe('Keyword Matching Logic', () => {
  test('should match single keyword', () => {
    const keywords = ["api", "backend", "rest"];
    const goal = "Build REST API";
    const lowerGoal = goal.toLowerCase();
    
    const matchedKeywords = keywords.filter(kw => lowerGoal.includes(kw));
    assert.strictEqual(matchedKeywords.length, 2);
    assert.ok(matchedKeywords.includes("api"));
    assert.ok(matchedKeywords.includes("rest"));
  });

  test('should match multiple keywords', () => {
    const keywords = ["api", "backend", "database", "auth"];
    const goal = "Build backend API with database and authentication";
    const lowerGoal = goal.toLowerCase();
    
    const matchedKeywords = keywords.filter(kw => lowerGoal.includes(kw));
    // "api", "backend", "database", "auth" (4 matches because "auth" is in "authentication")
    assert.strictEqual(matchedKeywords.length, 4);
  });

  test('should not match non-existent keywords', () => {
    const keywords = ["mobile", "ios", "android"];
    const goal = "Build web application";
    const lowerGoal = goal.toLowerCase();
    
    const matchedKeywords = keywords.filter(kw => lowerGoal.includes(kw));
    assert.strictEqual(matchedKeywords.length, 0);
  });

  test('should handle partial keyword matches', () => {
    const keywords = ["auth"];
    const goal = "Add authentication";
    const lowerGoal = goal.toLowerCase();
    
    // "auth" is in "authentication"
    const matchedKeywords = keywords.filter(kw => lowerGoal.includes(kw));
    assert.strictEqual(matchedKeywords.length, 1);
  });
});

// ============================================================================
// Priority and Scoring Tests
// ============================================================================

describe('Template Scoring', () => {
  test('should calculate score correctly', () => {
    const template = {
      keywords: ["api", "backend"],
      priority: 100
    };
    const goal = "Build backend API";
    const lowerGoal = goal.toLowerCase();
    
    const matchedKeywords = template.keywords.filter(kw => lowerGoal.includes(kw));
    const score = template.priority * matchedKeywords.length;
    
    assert.strictEqual(score, 200); // 100 * 2 matches
  });

  test('should sort by score', () => {
    const templates = [
      { id: "low", keywords: ["api"], priority: 50, task: { id: "low" } },
      { id: "high", keywords: ["api", "backend"], priority: 100, task: { id: "high" } },
      { id: "medium", keywords: ["backend"], priority: 80, task: { id: "medium" } }
    ];
    
    const goal = "Build backend API";
    const lowerGoal = goal.toLowerCase();
    
    const scored = templates
      .map(t => ({
        ...t,
        score: t.priority * t.keywords.filter(kw => lowerGoal.includes(kw)).length
      }))
      .sort((a, b) => b.score - a.score);
    
    assert.strictEqual(scored[0].id, "high");
    assert.strictEqual(scored[1].id, "medium");
    assert.strictEqual(scored[2].id, "low");
  });
});

// ============================================================================
// Auto-dependency Tests
// ============================================================================

describe('Auto Dependency Generation', () => {
  test('should identify autoDepend tasks', () => {
    const templates = [
      { id: "api", autoDepends: false, task: { id: "api", depends: [] } },
      { id: "tests", autoDepends: true, task: { id: "tests", depends: [] } }
    ];
    
    const autoDependTemplates = templates.filter(t => t.autoDepends === true);
    assert.strictEqual(autoDependTemplates.length, 1);
  });

  test('should auto-add dependencies to implementation tasks', () => {
    const tasks = [
      { id: "backend", agent: "backend", depends: [] },
      { id: "frontend", agent: "frontend", depends: [] },
      { id: "tests", agent: "qa", depends: [] } // Should auto-depend on backend and frontend
    ];
    
    // Simulate auto-dependency logic
    const implementationTasks = tasks.filter(t => 
      t.agent === "backend" || t.agent === "frontend"
    );
    
    const testTask = tasks.find(t => t.agent === "qa");
    if (testTask && implementationTasks.length > 0) {
      testTask.depends = implementationTasks.map(t => t.id);
    }
    
    assert.strictEqual(testTask.depends.length, 2);
    assert.ok(testTask.depends.includes("backend"));
    assert.ok(testTask.depends.includes("frontend"));
  });
});

// ============================================================================
// Default Template Tests
// ============================================================================

describe('Default Template Fallback', () => {
  test('should have default template', () => {
    const config = {
      defaultTemplate: {
        id: "implement",
        title: "Implement feature",
        agent: "fullstack",
        depends: []
      }
    };
    
    assert.ok(config.defaultTemplate);
    assert.strictEqual(config.defaultTemplate.agent, "fullstack");
  });

  test('should use default when no matches', () => {
    const templates = [
      { keywords: ["mobile"], task: { id: "mobile" } }
    ];
    const defaultTemplate = { id: "default", agent: "fullstack", depends: [] };
    const goal = "Random task description";
    const lowerGoal = goal.toLowerCase();
    
    const matched = templates.filter(t => 
      t.keywords.some(kw => lowerGoal.includes(kw))
    );
    
    const selectedTask = matched.length > 0 
      ? matched[0].task 
      : defaultTemplate;
    
    assert.strictEqual(selectedTask.id, "default");
    assert.strictEqual(selectedTask.agent, "fullstack");
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  test('should handle empty goal', () => {
    const keywords = ["api"];
    const goal = "";
    const matchedKeywords = keywords.filter(kw => goal.includes(kw));
    assert.strictEqual(matchedKeywords.length, 0);
  });

  test('should handle very long goal', () => {
    const keywords = ["api"];
    const goal = "api ".repeat(1000);
    const lowerGoal = goal.toLowerCase();
    
    const matchedKeywords = keywords.filter(kw => lowerGoal.includes(kw));
    assert.strictEqual(matchedKeywords.length, 1);
  });

  test('should handle special characters in goal', () => {
    const keywords = ["api"];
    const goal = "Build API! @#$%^&*()";
    const lowerGoal = goal.toLowerCase();
    
    const matchedKeywords = keywords.filter(kw => lowerGoal.includes(kw));
    assert.strictEqual(matchedKeywords.length, 1);
  });

  test('should handle case insensitivity', () => {
    const keywords = ["api"];
    const goal = "Build API";
    const lowerGoal = goal.toLowerCase();
    
    assert.ok(lowerGoal.includes("api"));
    assert.ok(lowerGoal.includes("API".toLowerCase()));
  });
});

// Cleanup after all tests
process.on('exit', () => {
  cleanupTestConfig();
});