# Voice Chat with LLM (Netlify Version)

An aesthetically pleasing web application that provides a voice-based chat interface with an LLM (Language Learning Model). This application allows users to speak to the LLM and hear its responses, creating a more natural conversation experience.

## Features

- Voice input using the device microphone
- Speech visualization with audio waveforms
- Speech-to-text conversion using Google's Gemini API
- Text-to-speech conversion using ElevenLabs API
- Modern and responsive user interface

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Netlify Functions (JavaScript/Node.js)
- APIs:
  - Google Gemini API for LLM responses and speech-to-text
  - ElevenLabs API for text-to-speech

## Local Development

1. Install dependencies:
   ```
   npm install
   ```

2. Install the Netlify CLI if you haven't already:
   ```
   npm install netlify-cli -g
   ```

3. Run the local development server:
   ```
   netlify dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:8888
   ```

5. Enter your API keys:
   - Gemini API Key (from https://ai.google.dev/)
   - ElevenLabs API Key (from https://elevenlabs.io/)

## How to Use

1. Click the microphone button to start recording
2. Speak your message
3. Click the button again to stop recording
4. Wait for the LLM to process your speech and respond
5. The LLM's response will be displayed in the chat and spoken aloud

## Deployment to Netlify

### Deploy via Netlify Dashboard

1. Push your code to a GitHub repository.
2. Login to your Netlify account.
3. Click "New site from Git" and select your repository.
4. Configure the build settings:
   - Base directory: `.`
   - Build command: `npm install`
   - Publish directory: `.`
   - Functions directory: `netlify/functions`
5. Click "Deploy site".

### Using Netlify CLI

1. Login to Netlify CLI:
   ```
   netlify login
   ```

2. Link your local project to a Netlify site:
   ```
   netlify init
   ```

3. Deploy your site:
   ```
   netlify deploy --prod
   ```

## Environment Variables

After deployment, add the following environment variables in your Netlify dashboard under Site settings > Environment variables:

- `GEMINI_API_KEY` (optional - users can also enter this in the UI)
- `ELEVENLABS_API_KEY` (optional - users can also enter this in the UI)

## Required API Keys

- A Google Gemini API key from https://ai.google.dev/
- An ElevenLabs API key from https://elevenlabs.io/
