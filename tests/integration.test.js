/**
 * Integration tests for OpenAI API Client
 * 
 * These tests make real API calls to OpenAI (if API key is provided).
 * Set OPENAI_API_KEY environment variable to run the tests.
 * 
 * Usage:
 *   OPENAI_API_KEY=sk-... node tests/integration.test.js
 */

const OpenAIClient = require('../openai_api.js');
const fs = require('fs').promises;
const path = require('path');

// Test configuration
const SKIP_REAL_API_TESTS = !process.env.OPENAI_API_KEY;
const TEST_MODEL = 'gpt-4o-mini'; // Use cheaper model for testing

// ANSI color codes for better output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    gray: '\x1b[90m'
};

class TestRunner {
    constructor() {
        this.passed = 0;
        this.failed = 0;
        this.skipped = 0;
        this.tests = [];
    }

    async runTest(name, testFn, skip = false) {
        if (skip) {
            console.log(`${colors.yellow}⊘ SKIP${colors.reset} ${colors.gray}${name}${colors.reset}`);
            this.skipped++;
            return;
        }

        try {
            await testFn();
            console.log(`${colors.green}✓ PASS${colors.reset} ${name}`);
            this.passed++;
        } catch (error) {
            console.log(`${colors.red}✗ FAIL${colors.reset} ${name}`);
            console.log(`  ${colors.red}${error.message}${colors.reset}`);
            if (error.stack) {
                console.log(`  ${colors.gray}${error.stack.split('\n').slice(1, 3).join('\n  ')}${colors.reset}`);
            }
            this.failed++;
        }
    }

    async runSuite(suiteName, tests) {
        console.log(`\n${colors.blue}${suiteName}${colors.reset}`);
        for (const test of tests) {
            await this.runTest(test.name, test.fn, test.skip);
        }
    }

    summary() {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`${colors.blue}Test Summary${colors.reset}`);
        console.log(`  ${colors.green}Passed:${colors.reset} ${this.passed}`);
        console.log(`  ${colors.red}Failed:${colors.reset} ${this.failed}`);
        console.log(`  ${colors.yellow}Skipped:${colors.reset} ${this.skipped}`);
        console.log(`  Total: ${this.passed + this.failed + this.skipped}`);
        console.log(`${'='.repeat(60)}\n`);
        
        return this.failed === 0;
    }
}

// Helper function to assert
function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertApproxEqual(actual, expected, tolerance, message) {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(message || `Expected ${actual} to be approximately ${expected} (tolerance: ${tolerance})`);
    }
}

// Create a simple test image (1x1 pixel red PNG as base64)
function getTestImageBase64() {
    // This is a minimal valid PNG - 1x1 red pixel
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    return `data:image/png;base64,${pngBase64}`;
}

// Main test execution
async function main() {
    const runner = new TestRunner();

    // Initialize client
    const client = new OpenAIClient();

    // Test Suite 1: Model Price Loading
    await runner.runSuite('Model Price Loading Tests', [
        {
            name: 'should create OpenAIClient instance',
            fn: async () => {
                assert(client instanceof OpenAIClient, 'Client should be instance of OpenAIClient');
                assert(client.modelPrices === null, 'Model prices should initially be null');
            }
        },
        {
            name: 'should load model_prices.json',
            fn: async () => {
                const prices = await client.loadModelPrices('./model_prices.json');
                assert(prices !== null, 'Prices should be loaded');
                assert(client.modelPrices !== null, 'Client should have prices');
                assert(typeof client.modelPrices === 'object', 'Prices should be an object');
            }
        },
        {
            name: 'should have pricing for common models',
            fn: async () => {
                if (!client.modelPrices) {
                    await client.loadModelPrices('./model_prices.json');
                }
                
                const commonModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4'];
                for (const model of commonModels) {
                    assert(client.modelPrices[model], `Should have pricing for ${model}`);
                    assert(client.modelPrices[model].input_cost_per_token !== undefined, 
                        `${model} should have input_cost_per_token`);
                    assert(client.modelPrices[model].output_cost_per_token !== undefined,
                        `${model} should have output_cost_per_token`);
                }
            }
        }
    ]);

    // Test Suite 2: Cost Calculation
    await runner.runSuite('Cost Calculation Tests', [
        {
            name: 'should calculate cost for gpt-4o',
            fn: async () => {
                if (!client.modelPrices) {
                    await client.loadModelPrices('./model_prices.json');
                }
                
                const usage = {
                    prompt_tokens: 1000,
                    completion_tokens: 500,
                    total_tokens: 1500
                };
                
                const cost = client.calculateCost('gpt-4o', usage);
                
                assert(cost.promptTokens === 1000, 'Prompt tokens should be 1000');
                assert(cost.completionTokens === 500, 'Completion tokens should be 500');
                assert(cost.totalTokens === 1500, 'Total tokens should be 1500');
                assert(cost.totalCost > 0, 'Total cost should be greater than 0');
                assert(cost.inputCost > 0, 'Input cost should be greater than 0');
                assert(cost.outputCost > 0, 'Output cost should be greater than 0');
                
                // Verify the calculation (gpt-4o: $2.50 input, $10.00 output per 1M tokens)
                const expectedInputCost = (1000 / 1_000_000) * 2.50;
                const expectedOutputCost = (500 / 1_000_000) * 10.00;
                assertApproxEqual(cost.inputCost, expectedInputCost, 0.000001, 
                    'Input cost calculation should match expected');
                assertApproxEqual(cost.outputCost, expectedOutputCost, 0.000001,
                    'Output cost calculation should match expected');
            }
        },
        {
            name: 'should use fallback pricing for unknown model',
            fn: async () => {
                const usage = {
                    prompt_tokens: 1000,
                    completion_tokens: 500,
                    total_tokens: 1500
                };
                
                const cost = client.calculateCost('unknown-model-xyz', usage);
                
                assert(cost.totalCost > 0, 'Should still calculate cost with fallback');
                assert(cost.promptTokens === 1000, 'Should track tokens correctly');
            }
        },
        {
            name: 'should handle zero tokens',
            fn: async () => {
                const usage = {
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0
                };
                
                const cost = client.calculateCost('gpt-4o', usage);
                
                assert(cost.totalCost === 0, 'Cost should be 0 for zero tokens');
                assert(cost.inputCost === 0, 'Input cost should be 0');
                assert(cost.outputCost === 0, 'Output cost should be 0');
            }
        }
    ]);

    // Test Suite 3: API Integration Tests (skipped if no API key)
    await runner.runSuite('OpenAI API Integration Tests', [
        {
            name: 'should successfully call OpenAI API with test image',
            fn: async () => {
                const apiKey = process.env.OPENAI_API_KEY;
                const testImage = getTestImageBase64();
                const customPrompt = 'Describe this image in one word.';
                
                const result = await client.callOpenAIAPI(apiKey, testImage, TEST_MODEL, customPrompt);
                
                assert(result !== null, 'Result should not be null');
                assert(result.usage !== undefined, 'Result should have usage data');
                assert(result.cost !== undefined, 'Result should have cost data');
                assert(result.model === TEST_MODEL, `Model should be ${TEST_MODEL}`);
                assert(result.finishReason !== undefined, 'Should have finish reason');
                
                // Check that we got some kind of response
                assert(result.textResponse || result.groups, 'Should have either text response or groups');
                
                console.log(`    ${colors.gray}→ API call successful: ${result.usage.total_tokens} tokens, $${result.cost.totalCost.toFixed(6)}${colors.reset}`);
            },
            skip: SKIP_REAL_API_TESTS
        },
        {
            name: 'should handle API errors gracefully',
            fn: async () => {
                const invalidKey = 'sk-invalid-key-12345';
                const testImage = getTestImageBase64();
                
                try {
                    await client.callOpenAIAPI(invalidKey, testImage, TEST_MODEL);
                    throw new Error('Should have thrown an error for invalid API key');
                } catch (error) {
                    assert(error.message.includes('API request failed') || 
                           error.message.includes('Incorrect API key'), 
                        'Should throw meaningful error for invalid API key');
                }
            },
            skip: SKIP_REAL_API_TESTS
        },
        {
            name: 'should calculate cost correctly after real API call',
            fn: async () => {
                const apiKey = process.env.OPENAI_API_KEY;
                const testImage = getTestImageBase64();
                const customPrompt = 'Say "test" and nothing else.';
                
                const result = await client.callOpenAIAPI(apiKey, testImage, TEST_MODEL, customPrompt);
                
                // Verify cost structure
                assert(typeof result.cost.totalCost === 'number', 'Total cost should be a number');
                assert(result.cost.totalCost > 0, 'Total cost should be greater than 0');
                assert(result.cost.inputCost + result.cost.outputCost === result.cost.totalCost,
                    'Input + output costs should equal total cost');
                
                console.log(`    ${colors.gray}→ Cost breakdown: Input=$${result.cost.inputCost.toFixed(6)}, Output=$${result.cost.outputCost.toFixed(6)}${colors.reset}`);
            },
            skip: SKIP_REAL_API_TESTS
        },
        {
            name: 'should track elapsed time for API calls',
            fn: async () => {
                const apiKey = process.env.OPENAI_API_KEY;
                const testImage = getTestImageBase64();
                const customPrompt = 'Say "test" and nothing else.';
                
                const result = await client.callOpenAIAPI(apiKey, testImage, TEST_MODEL, customPrompt);
                
                // Verify elapsed time tracking
                assert(result.elapsedMs !== undefined, 'Result should have elapsedMs');
                assert(result.cost.elapsedMs !== undefined, 'Cost should have elapsedMs');
                assert(result.cost.elapsedSeconds !== undefined, 'Cost should have elapsedSeconds');
                assert(typeof result.cost.elapsedMs === 'number', 'elapsedMs should be a number');
                assert(result.cost.elapsedMs > 0, 'elapsedMs should be greater than 0');
                assert(result.cost.elapsedSeconds === result.cost.elapsedMs / 1000,
                    'elapsedSeconds should be elapsedMs / 1000');
                
                console.log(`    ${colors.gray}→ API call completed in ${result.cost.elapsedSeconds.toFixed(2)} seconds${colors.reset}`);
            },
            skip: SKIP_REAL_API_TESTS
        }
    ]);

    // Print summary
    const allTestsPassed = runner.summary();

    if (SKIP_REAL_API_TESTS) {
        console.log(`${colors.yellow}⚠ API integration tests were skipped${colors.reset}`);
        console.log(`  Set OPENAI_API_KEY environment variable to run them:\n`);
        console.log(`  ${colors.gray}OPENAI_API_KEY=sk-... node tests/integration.test.js${colors.reset}\n`);
    }

    // Exit with appropriate code
    process.exit(allTestsPassed ? 0 : 1);
}

// Run tests
if (require.main === module) {
    main().catch(error => {
        console.error(`${colors.red}Fatal error:${colors.reset}`, error);
        process.exit(1);
    });
}

