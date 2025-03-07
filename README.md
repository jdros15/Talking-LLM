# Voice Chat with LLM

An aesthetically pleasing web application that provides a voice-based chat interface with an LLM (Language Learning Model). This application allows users to speak to the LLM and hear its responses, creating a more natural conversation experience.

## Features

- Voice input using the device microphone
- Speech visualization with audio waveforms
- Speech-to-text conversion using Google's Gemini API
- Text-to-speech conversion using ElevenLabs API
- Modern and responsive user interface

## Setup

1. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Run the Flask server:
   ```
   python server.py
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

4. Enter your API keys:
   - Gemini API Key (from https://ai.google.dev/)
   - ElevenLabs API Key (from https://elevenlabs.io/)

## How to Use

1. Click the microphone button to start recording
2. Speak your message
3. Click the button again to stop recording
4. Wait for the LLM to process your speech and respond
5. The LLM's response will be displayed in the chat and spoken aloud

## Technologies Used

- Frontend: HTML, CSS, JavaScript
- Backend: Flask (Python)
- APIs:
  - Google Gemini API for speech-to-text
  - ElevenLabs API for text-to-speech

## Requirements

- Modern web browser with microphone access
- API keys for Gemini and ElevenLabs
- Python 3.7+

You can test it out from here: https://voicellm.netlify.app/
