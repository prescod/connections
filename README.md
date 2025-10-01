# 🔗 Connections Game Solver

A mobile-first web application that uses your device's camera and OpenAI's vision API to solve the popular Connections word puzzle game.

## Features

- 📱 **Mobile-optimized**: Designed specifically for mobile devices with touch-friendly interface
- 📷 **Camera integration**: Take photos directly from your device's camera
- 🖼️ **File upload**: Alternative option to upload images from your gallery
- 🧠 **AI-powered**: Uses OpenAI's GPT-4 Vision model to analyze and solve puzzles
- 🎨 **Modern UI**: Beautiful, responsive design with smooth animations
- 🔐 **Privacy-focused**: API key stored locally, never sent to external servers
- ⚡ **Fast**: Optimized for quick puzzle solving

## How to Use

1. **Open the app** in your mobile browser
2. **Enter your OpenAI API key** (get one at [platform.openai.com](https://platform.openai.com/api-keys))
3. **Take a photo** of the Connections puzzle or upload from gallery
4. **Tap "Solve Connections Game"** and wait for the AI analysis
5. **View the solution** with grouped words and explanations

## Setup Instructions

### Local Development

1. Clone or download the project files
2. Serve the files using any local web server:
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Node.js (if you have http-server installed)
   npx http-server
   
   # Using PHP
   php -S localhost:8000
   ```
3. Open your browser to `http://localhost:8000`

### Deployment

Since this is a static web app, you can deploy it to any static hosting service:

- **Netlify**: Drag and drop the folder
- **Vercel**: Connect your Git repository
- **GitHub Pages**: Push to a repository and enable Pages
- **Firebase Hosting**: Use Firebase CLI

## Requirements

- **OpenAI API Key**: You'll need an active OpenAI account with API access
- **Modern Browser**: Chrome, Safari, Firefox, or Edge with camera support
- **HTTPS**: Camera access requires HTTPS (automatic with most hosting services)

## API Usage

The app uses OpenAI's GPT-4 Vision model (`gpt-4o`) to analyze images. Typical costs:
- ~$0.01-0.03 per image analysis
- Exact cost depends on image size and response length
- Pricing data is loaded from `model_prices.json` for accurate cost calculations
- The app displays detailed token usage and cost breakdown after each analysis

## Development

### Architecture

The application is split into two main JavaScript files:
- **openai_api.js**: Reusable library for OpenAI API calls and cost calculations
- **script.js**: UI and application logic for the Connections solver

The `openai_api.js` library is designed to work in both browser and Node.js environments, making it easy to test and reuse.

### Running Tests

Integration tests are available for the OpenAI API library:

```bash
# Install dependencies
npm install

# Run tests (without API key - skips API integration tests)
npm test

# Run tests with real API calls (requires OpenAI API key)
OPENAI_API_KEY=sk-your-key-here npm test
```

The tests cover:
- Model price loading and parsing
- Cost calculation accuracy
- API integration (when API key provided)
- Error handling

## Technical Details

### Built With
- **Vanilla JavaScript**: No frameworks, pure ES6+
- **CSS3**: Modern styling with flexbox and grid
- **HTML5**: Semantic markup with accessibility features

### Browser Support
- Chrome 61+ (mobile and desktop)
- Safari 14+ (iOS and macOS)
- Firefox 55+
- Edge 79+

### Features
- Responsive design for all screen sizes
- Camera API with environment camera preference
- File drag & drop support
- Local storage for API key persistence
- Error handling and loading states
- Image compression for optimal API usage

## Privacy & Security

- ✅ API key stored locally in browser storage
- ✅ Images processed client-side before sending to OpenAI
- ✅ No data stored on external servers
- ✅ Direct communication with OpenAI API only

## Updating Model Prices

The `model_prices.json` file contains pricing information for OpenAI models. To keep it up to date:

1. The pricing data follows the LiteLLM format with per-token costs
2. Use the `refresh_token_costs.sh` script to automatically update prices
3. Prices are stored as `input_cost_per_token` and `output_cost_per_token`
4. The app falls back to hardcoded defaults if a model is not found in the JSON

## Troubleshooting

### Camera Not Working
- Ensure you've granted camera permissions
- Try refreshing the page
- Use file upload as alternative

### API Errors
- Verify your API key is correct and active
- Check your OpenAI account has sufficient credits
- Ensure image is clear and contains the puzzle

### Image Quality Tips
- Ensure good lighting
- Keep camera steady
- Make sure all 16 words are visible
- Avoid glare or shadows on the puzzle

## License

MIT License - feel free to modify and distribute!

## Contributing

This is a hobby project, but suggestions and improvements are welcome!
