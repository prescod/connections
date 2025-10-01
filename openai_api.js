/**
 * OpenAI API Client Library
 * Works in both browser and Node.js environments
 */

class OpenAIClient {
    constructor() {
        this.modelPrices = null;
    }

    /**
     * Load model pricing data from model_prices.json
     * @param {string} jsonPath - Path to model_prices.json (optional, defaults to './model_prices.json')
     * @returns {Promise<Object>} The loaded pricing data
     */
    async loadModelPrices(jsonPath = './model_prices.json') {
        try {
            // Check if we're in Node.js or browser environment
            const isNode = typeof window === 'undefined';
            
            if (isNode) {
                // Node.js environment
                const fs = require('fs').promises;
                const path = require('path');
                const fullPath = path.resolve(jsonPath);
                const data = await fs.readFile(fullPath, 'utf8');
                this.modelPrices = JSON.parse(data);
            } else {
                // Browser environment
                const response = await fetch(jsonPath);
                if (!response.ok) {
                    console.warn('Could not load model prices, using defaults');
                    return null;
                }
                this.modelPrices = await response.json();
            }
            
            console.log('Model prices loaded successfully');
            return this.modelPrices;
        } catch (error) {
            console.warn('Error loading model prices:', error);
            return null;
        }
    }

    /**
     * Call OpenAI's Chat Completions API with vision support
     * @param {string} apiKey - OpenAI API key
     * @param {string} imageData - Base64-encoded image data URI
     * @param {string} model - Model ID to use (default: 'gpt-4o')
     * @param {string} prompt - Custom prompt (optional)
     * @returns {Promise<Object>} API response with groups, usage, and cost information
     */
    async callOpenAIAPI(apiKey, imageData, model = 'gpt-4o', prompt = null) {
        const startTime = performance.now();
        
        const defaultPrompt = `You are looking at a Connections game puzzle. This is a word puzzle where you need to group 16 words or phrases into 4 groups of 4, where each group shares a common theme or connection.

Please analyze the image and:
1. Identify all 16 words/phrases in the puzzle
2. Group them into 4 categories of 4 words each
3. Explain the theme/connection for each group
4. Present your answer in a clear, structured format

Format your response as a JSON object with this structure:
{
  "groups": [
    {
      "theme": "Theme description",
      "words": ["word1", "word2", "word3", "word4"],
      "explanation": "Brief explanation of the connection"
    }
  ]
}

Make sure each word appears in exactly one group, and that there are exactly 4 groups with 4 words each.`;

        const requestBody = {
            model: model,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: prompt || defaultPrompt
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: imageData
                            }
                        }
                    ]
                }
            ]
        };

        // Check if we're in Node.js environment
        const isNode = typeof window === 'undefined';
        let response;

        if (isNode) {
            // Use node-fetch or native fetch in newer Node versions
            const fetch = globalThis.fetch || require('node-fetch');
            response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody)
            });
        } else {
            // Browser environment
            response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody)
            });
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
        }

        const data = await response.json();
        
        const content = data.choices[0].message.content;
        const finishReason = data.choices[0].finish_reason;
        const usage = data.usage;
        
        // Check for empty response or length limit
        if (!content || content.trim() === '') {
            if (finishReason === 'length') {
                throw new Error('Model ran out of tokens before completing the response.');
            } else {
                throw new Error(`Received empty response from API. Finish reason: ${finishReason}`);
            }
        }
        
        // Try to parse JSON from the response
        let result;
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            } else {
                result = { textResponse: content };
            }
        } catch (parseError) {
            console.warn('Could not parse JSON, using text response');
            result = { textResponse: content };
        }
        
        // Calculate elapsed time
        const endTime = performance.now();
        const elapsedMs = endTime - startTime;
        
        // Add usage and cost information
        if (usage) {
            result.usage = usage;
            result.cost = this.calculateCost(model, usage);
            result.cost.elapsedMs = elapsedMs;
            result.cost.elapsedSeconds = elapsedMs / 1000;
        }
        
        // Add metadata
        result.model = model;
        result.finishReason = finishReason;
        result.elapsedMs = elapsedMs;
        
        return result;
    }

    /**
     * Calculate the cost of an API call based on token usage
     * @param {string} model - Model ID used
     * @param {Object} usage - Usage object from API response
     * @returns {Object} Cost breakdown with inputCost, outputCost, and totalCost
     */
    calculateCost(model, usage) {
        const promptTokens = usage.prompt_tokens || 0;
        const completionTokens = usage.completion_tokens || 0;
        
        // Try to get pricing from loaded model_prices.json
        let inputCostPerToken = null;
        let outputCostPerToken = null;
        
        if (this.modelPrices && this.modelPrices[model]) {
            const modelData = this.modelPrices[model];
            inputCostPerToken = modelData.input_cost_per_token;
            outputCostPerToken = modelData.output_cost_per_token;
        }
        
        // Fallback to hardcoded pricing if model not found in JSON
        if (inputCostPerToken === null || outputCostPerToken === null) {
            console.warn(`Model ${model} not found in model_prices.json, using fallback pricing`);
            
            // Fallback pricing (per million tokens)
            // Based on OpenAI's published pricing as of 2024
            const fallbackPricing = {
                // GPT-4o models
                'gpt-4o': { input: 2.50, output: 10.00 },
                'gpt-4o-mini': { input: 0.15, output: 0.60 },
                
                // GPT-4 Turbo models
                'gpt-4-turbo': { input: 10.00, output: 30.00 },
                'gpt-4': { input: 30.00, output: 60.00 },
                
                // Default
                'default': { input: 5.00, output: 15.00 }
            };
            
            // Find pricing for this model
            let modelPricing = fallbackPricing[model];
            
            // If exact match not found, try to find closest match
            if (!modelPricing) {
                const modelLower = model.toLowerCase();
                for (const [key, value] of Object.entries(fallbackPricing)) {
                    if (modelLower.includes(key.toLowerCase())) {
                        modelPricing = value;
                        break;
                    }
                }
            }
            
            // Default pricing if model not found
            if (!modelPricing) {
                modelPricing = fallbackPricing['default'];
            }
            
            // Convert from per-million to per-token
            inputCostPerToken = modelPricing.input / 1_000_000;
            outputCostPerToken = modelPricing.output / 1_000_000;
        }
        
        // Calculate costs using per-token pricing
        const inputCost = promptTokens * inputCostPerToken;
        const outputCost = completionTokens * outputCostPerToken;
        const totalCost = inputCost + outputCost;
        
        return {
            inputCost: inputCost,
            outputCost: outputCost,
            totalCost: totalCost,
            promptTokens: promptTokens,
            completionTokens: completionTokens,
            totalTokens: usage.total_tokens || (promptTokens + completionTokens)
        };
    }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OpenAIClient;
} else if (typeof window !== 'undefined') {
    window.OpenAIClient = OpenAIClient;
}

