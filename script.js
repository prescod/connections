class ConnectionsSolver {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.capturedImage = null;
        this.stream = null;
        this.apiClient = new OpenAIClient();
        this.logMessages = [];
        
        this.initializeElements();
        this.bindEvents();
        this.apiClient.loadModelPrices();
        this.loadApiKey();
        this.loadModelPreference();
        this.loadSavedImage();

        // Capture console logs
        this.captureConsoleLogs();
    }

    captureConsoleLogs() {
        const originalLog = console.log;
        const originalError = console.error;
        
        console.log = (...args) => {
            this.logMessages.push({ type: 'log', message: args.join(' ') });
            originalLog.apply(console, args);
        };

        console.error = (...args) => {
            this.logMessages.push({ type: 'error', message: args.join(' ') });
            originalError.apply(console, args);
        };
    }

    initializeElements() {
        this.startCameraBtn = document.getElementById('startCamera');
        this.capturePhotoBtn = document.getElementById('capturePhoto');
        this.retakePhotoBtn = document.getElementById('retakePhoto');
        this.fileInput = document.getElementById('fileInput');
        this.apiKeyInput = document.getElementById('apiKey');
        this.modelSelect = document.getElementById('modelSelect');
        this.solveGameBtn = document.getElementById('solveGame');
        this.retryButton = document.getElementById('retryButton');
        this.imagePreview = document.getElementById('imagePreview');
        this.previewImage = document.getElementById('previewImage');
        this.loading = document.getElementById('loading');
        this.results = document.getElementById('results');
        this.error = document.getElementById('error');
        this.errorMessage = document.getElementById('errorMessage');
        this.debugButton = document.getElementById('debugButton');
        this.debugInfo = document.getElementById('debugInfo');
        this.solutionContent = document.getElementById('solutionContent');
        this.lastDebugData = null;
    }

    bindEvents() {
        this.startCameraBtn.addEventListener('click', () => this.startCamera());
        this.capturePhotoBtn.addEventListener('click', () => this.capturePhoto());
        this.retakePhotoBtn.addEventListener('click', () => this.retakePhoto());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.apiKeyInput.addEventListener('input', () => {
            this.validateInputs();
            this.fetchAvailableModels();
        });
        this.modelSelect.addEventListener('change', () => this.saveModelPreference());
        this.solveGameBtn.addEventListener('click', () => this.solveGame());
        this.retryButton.addEventListener('click', () => this.retryWithDifferentModel());
        this.debugButton.addEventListener('click', () => this.toggleDebugInfo());
    }

    async startCamera() {
        try {
            this.hideError();
            
            const constraints = {
                video: {
                    facingMode: 'environment', // Use back camera on mobile
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            
            this.startCameraBtn.style.display = 'none';
            this.capturePhotoBtn.style.display = 'inline-flex';
            
            // Hide image preview when starting camera
            this.imagePreview.style.display = 'none';
            this.capturedImage = null;
            this.validateInputs();
            
        } catch (error) {
            console.error('Error accessing camera:', error);
            this.showError('Unable to access camera. Please make sure you have granted camera permissions or try uploading a photo instead.');
        }
    }

    capturePhoto() {
        // Set canvas size to match video
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        
        // Save the context state
        this.ctx.save();
        
        // Flip the canvas horizontally to correct the mirrored video
        this.ctx.scale(-1, 1);
        this.ctx.translate(-this.canvas.width, 0);
        
        // Draw video frame to canvas (this will un-flip the image)
        this.ctx.drawImage(this.video, 0, 0);
        
        // Restore the context state
        this.ctx.restore();
        
        // Convert to base64
        this.capturedImage = this.canvas.toDataURL('image/jpeg', 0.8);
        
        // Display preview
        this.previewImage.src = this.capturedImage;
        this.imagePreview.style.display = 'block';
        
        // Update buttons
        this.capturePhotoBtn.style.display = 'none';
        this.retakePhotoBtn.style.display = 'inline-flex';
        
        // Stop camera stream
        this.stopCamera();
        
        // Save image to localStorage
        this.saveImageToStorage();
        
        this.validateInputs();
    }

    retakePhoto() {
        this.imagePreview.style.display = 'none';
        this.capturedImage = null;
        this.retakePhotoBtn.style.display = 'none';
        this.startCameraBtn.style.display = 'inline-flex';
        this.clearSavedImage();
        this.validateInputs();
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.video.srcObject = null;
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showError('Please select a valid image file.');
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            this.showError('Image file is too large. Please select an image smaller than 10MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.capturedImage = e.target.result;
            this.previewImage.src = this.capturedImage;
            this.imagePreview.style.display = 'block';
            
            // Stop camera if running
            this.stopCamera();
            this.startCameraBtn.style.display = 'inline-flex';
            this.capturePhotoBtn.style.display = 'none';
            this.retakePhotoBtn.style.display = 'none';
            
            // Save image to localStorage
            this.saveImageToStorage();
            
            this.validateInputs();
        };
        reader.readAsDataURL(file);
    }

    validateInputs() {
        const hasImage = !!this.capturedImage;
        const hasApiKey = this.apiKeyInput.value.trim().startsWith('sk-');
        
        this.solveGameBtn.disabled = !(hasImage && hasApiKey);
    }

    async solveGame() {
        if (!this.capturedImage || !this.apiKeyInput.value.trim()) {
            this.showError('Please capture an image and enter your OpenAI API key.');
            return;
        }

        this.showLoading();
        this.hideError();
        this.hideResults();
        
        try {
            const apiKey = this.apiKeyInput.value.trim();
            this.saveApiKey(apiKey);
            
            const selectedModel = this.modelSelect.value;
            console.log('Attempting to solve game with model:', selectedModel);
            const solution = await this.apiClient.callOpenAIAPI(apiKey, this.capturedImage, selectedModel);
            console.log('Solution received:', solution);
            this.displaySolution(solution);
            
        } catch (error) {
            console.error('Error solving game:', error);
            this.showError(`Failed to solve the game: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    displaySolution(solution) {
        this.solutionContent.innerHTML = '';
        
        if (solution.groups && Array.isArray(solution.groups)) {
            solution.groups.forEach((group, index) => {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'group';
                
                const themeTitle = document.createElement('h4');
                themeTitle.textContent = group.theme;
                groupDiv.appendChild(themeTitle);
                
                if (group.explanation) {
                    const explanation = document.createElement('p');
                    explanation.textContent = group.explanation;
                    explanation.style.fontSize = '0.9rem';
                    explanation.style.color = '#6c757d';
                    explanation.style.marginBottom = '10px';
                    groupDiv.appendChild(explanation);
                }
                
                const wordsDiv = document.createElement('div');
                wordsDiv.className = 'group-words';
                
                group.words.forEach(word => {
                    const wordSpan = document.createElement('span');
                    wordSpan.className = 'word';
                    wordSpan.textContent = word;
                    wordsDiv.appendChild(wordSpan);
                });
                
                groupDiv.appendChild(wordsDiv);
                this.solutionContent.appendChild(groupDiv);
            });
        } else if (solution.textResponse) {
            // Fallback for text response
            const textDiv = document.createElement('div');
            textDiv.innerHTML = solution.textResponse.replace(/\n/g, '<br>');
            this.solutionContent.appendChild(textDiv);
        } else {
            // Store detailed debug info
            this.lastDebugData = {
                ...this.lastDebugData,
                solution: solution,
                error: 'Invalid response format - no groups array or textResponse found'
            };
            throw new Error('Invalid response format from OpenAI API');
        }
        
        // Add cost information if available
        if (solution.cost) {
            this.displayCostInfo(solution.cost);
        }
        
        this.showResults();
        this.showRetryButton();
    }

    displayCostInfo(cost) {
        const costDiv = document.createElement('div');
        costDiv.className = 'cost-info';
        costDiv.style.marginTop = '20px';
        costDiv.style.padding = '15px';
        costDiv.style.background = '#e8f5e9';
        costDiv.style.borderRadius = '10px';
        costDiv.style.fontSize = '0.9rem';
        
        const costTitle = document.createElement('h4');
        costTitle.textContent = '💰 API Usage & Cost';
        costTitle.style.marginBottom = '10px';
        costTitle.style.color = '#2e7d32';
        costDiv.appendChild(costTitle);
        
        const detailsDiv = document.createElement('div');
        detailsDiv.style.color = '#1b5e20';
        
        const tokenInfo = document.createElement('p');
        tokenInfo.style.margin = '5px 0';
        tokenInfo.innerHTML = `
            <strong>Tokens:</strong> ${cost.promptTokens.toLocaleString()} input + 
            ${cost.completionTokens.toLocaleString()} output = 
            ${cost.totalTokens.toLocaleString()} total
        `;
        detailsDiv.appendChild(tokenInfo);
        
        const costInfo = document.createElement('p');
        costInfo.style.margin = '5px 0';
        costInfo.innerHTML = `
            <strong>Cost:</strong> $${cost.inputCost.toFixed(4)} input + 
            $${cost.outputCost.toFixed(4)} output = 
            <strong>$${cost.totalCost.toFixed(4)} total</strong>
        `;
        detailsDiv.appendChild(costInfo);
        
        // Add elapsed time if available
        if (cost.elapsedSeconds !== undefined) {
            const timeInfo = document.createElement('p');
            timeInfo.style.margin = '5px 0';
            timeInfo.innerHTML = `
                <strong>Time:</strong> ${cost.elapsedSeconds.toFixed(2)} seconds
            `;
            detailsDiv.appendChild(timeInfo);
        }
        
        costDiv.appendChild(detailsDiv);
        this.solutionContent.appendChild(costDiv);
    }

    async retryWithDifferentModel() {
        if (!this.capturedImage || !this.apiKeyInput.value.trim()) {
            this.showError('Please capture an image and enter your OpenAI API key.');
            return;
        }

        this.hideError();
        this.hideResults();
        this.hideRetryButton();
        
        // Show a different loading message for retry
        this.showLoadingWithMessage('Retrying with different model...');
        
        try {
            const apiKey = this.apiKeyInput.value.trim();
            const selectedModel = this.modelSelect.value;
            const solution = await this.apiClient.callOpenAIAPI(apiKey, this.capturedImage, selectedModel);
            this.displaySolution(solution);
            
        } catch (error) {
            console.error('Error retrying game:', error);
            this.showError(`Retry failed: ${error.message}`);
            this.showRetryButton(); // Show retry button again on error
        } finally {
            this.hideLoading();
        }
    }

    showLoading() {
        this.loading.style.display = 'block';
        this.loading.querySelector('p').textContent = 'Analyzing your image and solving the puzzle...';
    }

    showLoadingWithMessage(message) {
        this.loading.style.display = 'block';
        this.loading.querySelector('p').textContent = message;
    }

    hideLoading() {
        this.loading.style.display = 'none';
    }

    showResults() {
        this.results.style.display = 'block';
    }

    hideResults() {
        this.results.style.display = 'none';
    }

    showRetryButton() {
        this.retryButton.style.display = 'inline-flex';
    }

    hideRetryButton() {
        this.retryButton.style.display = 'none';
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.error.style.display = 'block';
        
        // Show debug button if we have debug data
        if (this.lastDebugData) {
            this.debugButton.style.display = 'inline-flex';
        }
    }

    hideError() {
        this.error.style.display = 'none';
        this.debugButton.style.display = 'none';
        this.debugInfo.style.display = 'none';
    }

    toggleDebugInfo() {
        if (this.debugInfo.style.display === 'none') {
            this.debugInfo.style.display = 'block';
            this.debugInfo.textContent = this.logMessages.map(log => `${log.type.toUpperCase()}: ${log.message}`).join('\n');
            this.debugButton.textContent = '🐛 Hide Debug Info';
        } else {
            this.debugInfo.style.display = 'none';
            this.debugButton.textContent = '🐛 Show Debug Info';
        }
    }

    saveApiKey(apiKey) {
        try {
            localStorage.setItem('openai_api_key', apiKey);
        } catch (error) {
            console.warn('Could not save API key to localStorage:', error);
        }
    }

    loadApiKey() {
        try {
            const savedKey = localStorage.getItem('openai_api_key');
            if (savedKey) {
                this.apiKeyInput.value = savedKey;
                this.validateInputs();
                // Fetch available models on startup if API key is available
                this.fetchAvailableModels();
            }
        } catch (error) {
            console.warn('Could not load API key from localStorage:', error);
        }
    }

    saveModelPreference() {
        try {
            const selectedModel = this.modelSelect.value;
            localStorage.setItem('preferred_model', selectedModel);
        } catch (error) {
            console.warn('Could not save model preference to localStorage:', error);
        }
    }

    loadModelPreference() {
        try {
            const savedModel = localStorage.getItem('preferred_model');
            if (savedModel) {
                this.modelSelect.value = savedModel;
            }
        } catch (error) {
            console.warn('Could not load model preference from localStorage:', error);
        }
    }

    saveImageToStorage() {
        try {
            const imageData = {
                image: this.capturedImage,
                timestamp: Date.now()
            };
            localStorage.setItem('saved_connections_image', JSON.stringify(imageData));
        } catch (error) {
            console.warn('Could not save image to localStorage:', error);
            // If storage is full, try to clear old data
            if (error.name === 'QuotaExceededError') {
                this.clearSavedImage();
                console.warn('localStorage quota exceeded, cleared saved image');
            }
        }
    }

    loadSavedImage() {
        try {
            const savedData = localStorage.getItem('saved_connections_image');
            if (!savedData) return;

            const imageData = JSON.parse(savedData);
            const oneHourInMs = 60 * 60 * 1000; // 1 hour in milliseconds
            const timeSinceSave = Date.now() - imageData.timestamp;

            // Check if image is less than 1 hour old
            if (timeSinceSave < oneHourInMs && imageData.image) {
                this.capturedImage = imageData.image;
                this.previewImage.src = this.capturedImage;
                this.imagePreview.style.display = 'block';
                this.retakePhotoBtn.style.display = 'inline-flex';
                this.validateInputs();
                
                console.log(`Restored image from ${Math.floor(timeSinceSave / 60000)} minutes ago`);
            } else {
                // Image is too old, clear it
                this.clearSavedImage();
            }
        } catch (error) {
            console.warn('Could not load saved image from localStorage:', error);
            this.clearSavedImage();
        }
    }

    clearSavedImage() {
        try {
            localStorage.removeItem('saved_connections_image');
        } catch (error) {
            console.warn('Could not clear saved image from localStorage:', error);
        }
    }

    async fetchAvailableModels() {
        const apiKey = this.apiKeyInput.value.trim();
        if (!apiKey.startsWith('sk-')) {
            return; // Don't fetch if API key is invalid
        }

        // Debounce the API calls to avoid too many requests
        clearTimeout(this.modelFetchTimeout);
        this.modelFetchTimeout = setTimeout(async () => {
            try {
                const response = await fetch('https://api.openai.com/v1/models', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`
                    }
                });

                if (!response.ok) {
                    console.warn('Could not fetch models from OpenAI API');
                    return;
                }

                const data = await response.json();
                this.updateModelOptions(data.data);
                
            } catch (error) {
                console.warn('Error fetching available models:', error);
            }
        }, 1000); // Wait 1 second after user stops typing
    }

    updateModelOptions(models) {
        // Filter out models that are definitely not vision-capable
        const filteredModels = models.filter(model => {
            const modelId = model.id.toLowerCase();
            
            // Exclude models that are definitely not vision-capable
            const excludePatterns = [
                'gpt-3',           // GPT-3 models
                'tts-',            // Text-to-speech models
                'whisper-',        // Speech-to-text models
                'ft:',             // Fine-tuned models (start with ft:)
                'audio',           // Audio models
                'realtime'         // Realtime models
            ];
            
            return !excludePatterns.some(pattern => modelId.includes(pattern));
        }).sort((a, b) => {
            // Sort by preference: gpt-4o models first, then others
            const aScore = this.getModelScore(a.id);
            const bScore = this.getModelScore(b.id);
            return bScore - aScore;
        });

        // Save current selection
        const currentValue = this.modelSelect.value;
        
        // Clear existing options except the default ones
        this.modelSelect.innerHTML = '';
        
        // Add default recommended options first
        // Only include models that are currently available and support vision
        const defaultOptions = [
            { id: 'gpt-4o', name: 'GPT-4o (Recommended)' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Faster, Cheaper)' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' }
        ];

        defaultOptions.forEach(defaultModel => {
            const option = document.createElement('option');
            option.value = defaultModel.id;
            option.textContent = defaultModel.name;
            this.modelSelect.appendChild(option);
        });

        // Add separator if we have additional models
        if (filteredModels.length > 0) {
            const separator = document.createElement('option');
            separator.disabled = true;
            separator.textContent = '--- Available Models ---';
            this.modelSelect.appendChild(separator);

            // Add fetched models
            filteredModels.forEach(model => {
                // Skip if already in default list
                if (defaultOptions.some(def => def.id === model.id)) {
                    return;
                }

                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = this.formatModelName(model.id);
                this.modelSelect.appendChild(option);
            });
        }

        // Restore selection if possible
        if (currentValue && this.isOptionAvailable(currentValue)) {
            this.modelSelect.value = currentValue;
        }
    }

    getModelScore(modelId) {
        // Scoring system to prioritize models
        const id = modelId.toLowerCase();
        
        // Highest priority: GPT-4o models (best current vision models)
        if (id.includes('gpt-4o')) return 100;
        
        // High priority: GPT-4 models
        if (id.includes('gpt-4-turbo')) return 80;
        if (id.includes('gpt-4') && id.includes('vision')) return 75;
        if (id.includes('gpt-4')) return 70;
        
        // Medium priority: Other potentially capable models
        if (id.includes('claude')) return 60; // In case other providers are added
        if (id.includes('vision')) return 50; // Any model with "vision" in name
        
        // Lower priority: Other models
        return 10;
    }

    formatModelName(modelId) {
        // Format model ID into a readable name
        return modelId
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase())
            .replace(/Gpt/g, 'GPT');
    }

    isOptionAvailable(value) {
        const options = Array.from(this.modelSelect.options);
        return options.some(option => option.value === value);
    }

    // Cleanup when page unloads
    destroy() {
        this.stopCamera();
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new ConnectionsSolver();
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        app.destroy();
    });
});

// Handle page visibility changes to manage camera
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page is hidden, stop camera to save battery
        const video = document.getElementById('video');
        if (video && video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
        }
    }
});
