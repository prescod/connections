# Integration Tests

This directory contains integration tests for the OpenAI API client library.

## Running Tests

### Without API Key (Basic Tests Only)

```bash
npm test
```

This will run tests for:
- ✓ Model price loading
- ✓ Cost calculations
- ⊘ API integration tests (skipped)

### With API Key (Full Integration Tests)

```bash
OPENAI_API_KEY=sk-your-key-here npm test
```

This runs all tests including real API calls to OpenAI. The tests use `gpt-4o-mini` to minimize costs (typically < $0.01 per test run).

## Test Coverage

### Model Price Loading Tests
- Creates OpenAIClient instance
- Loads model_prices.json
- Verifies pricing data for common models

### Cost Calculation Tests
- Calculates accurate costs for known models
- Falls back gracefully for unknown models
- Handles edge cases (zero tokens)

### API Integration Tests (requires API key)
- Successfully calls OpenAI API
- Handles authentication errors
- Verifies cost calculations against real usage

## Writing New Tests

The test file uses a simple custom test runner. Add new tests like this:

```javascript
await runner.runSuite('Your Test Suite', [
    {
        name: 'should do something',
        fn: async () => {
            // Test code here
            assert(condition, 'Error message');
        }
    },
    {
        name: 'should do something that requires API',
        fn: async () => {
            // Test code
        },
        skip: SKIP_REAL_API_TESTS  // Skip if no API key
    }
]);
```

## CI/CD Integration

To run tests in CI/CD pipelines:

1. Add API key as a secret environment variable
2. Run `npm install` to get dependencies
3. Run `npm test` 
4. Exit code 0 = all tests passed, non-zero = failures

Example GitHub Actions:
```yaml
- name: Run Integration Tests
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: npm test
```


