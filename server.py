import os
import base64
import tempfile
import json
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
import google.generativeai as genai
from google.generativeai import types

app = Flask(__name__, static_folder='.')
CORS(app)

@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/api/speech-to-text', methods=['POST'])
def speech_to_text():
    data = request.json
    audio_data = data.get('audio')
    gemini_api_key = data.get('gemini_api_key')
    
    if not audio_data or not gemini_api_key:
        return jsonify({'error': 'Missing audio data or API key'}), 400
    
    # Decode base64 audio
    try:
        # Print the first 100 characters to debug
        print(f"Audio data preview: {audio_data[:100]}...")
        
        # Determine file extension from MIME type
        mime_type = audio_data.split(';')[0]
        file_extension = '.ogg'  # default
        
        if 'audio/webm' in mime_type:
            file_extension = '.webm'
        elif 'audio/mp4' in mime_type:
            file_extension = '.mp4'
        elif 'audio/wav' in mime_type:
            file_extension = '.wav'
        
        print(f"Detected MIME type: {mime_type}, using extension: {file_extension}")
        
        # Split at the comma (data:audio/TYPE;base64, ...)
        audio_parts = audio_data.split(',')
        if len(audio_parts) < 2:
            return jsonify({'error': 'Invalid audio format - no base64 content found'}), 400
            
        audio_bytes = base64.b64decode(audio_parts[1])
        print(f"Successfully decoded {len(audio_bytes)} bytes")
    except Exception as e:
        print(f"Error decoding audio: {str(e)}")
        return jsonify({'error': f'Invalid audio data: {str(e)}'}), 400
    
    # Save audio to temporary file
    temp_audio_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=file_extension, delete=False) as temp_audio:
            temp_audio.write(audio_bytes)
            temp_audio_path = temp_audio.name
            print(f"Saved audio to {temp_audio_path} with extension {file_extension}")
    except Exception as e:
        print(f"Error saving temp file: {str(e)}")
        return jsonify({'error': f'Error saving audio file: {str(e)}'}), 500
    
    try:
        # Configure Gemini
        print(f"Configuring Gemini with API key length: {len(gemini_api_key)}")
        genai.configure(api_key=gemini_api_key)
        
        # Set up the model
        model = genai.GenerativeModel("gemini-2.0-flash-lite")
        print(f"Model initialized: gemini-2.0-flash-lite")
        
        # Use a different approach - generate a text prompt asking for transcription
        print(f"Processing audio file: {temp_audio_path}")
        
        # We'll upload the audio as an attachment to a chat
        with open(temp_audio_path, 'rb') as f:
            audio_bytes = f.read()
        
        model = genai.GenerativeModel("gemini-2.0-flash-lite")
        
        # Upload the file
        file_mimetype = f"audio/{file_extension[1:]}"
        print(f"Uploading with MIME type: {file_mimetype}")
        
        # Create a chat session
        chat = model.start_chat()
        
        # Send a message with the audio file attached
        response = chat.send_message([
            "Please transcribe this audio file. Just return the raw transcription text without any commentary or explanation.",
            {"mime_type": file_mimetype, "data": audio_bytes}
        ])
        
        transcription = response.text
        print(f"Got transcription: {transcription}")
        
        # Clean up temporary file
        os.unlink(temp_audio_path)
        
        return jsonify({'transcription': transcription})
    
    except Exception as e:
        # Print the full error for debugging
        import traceback
        print(f"Error in speech-to-text: {str(e)}")
        print(traceback.format_exc())
        
        # Clean up temporary file
        if os.path.exists(temp_audio_path):
            os.unlink(temp_audio_path)
        
        return jsonify({'error': str(e)}), 500

@app.route('/api/llm-response', methods=['POST'])
def llm_response():
    data = request.json
    message = data.get('message')
    history = data.get('history', [])
    gemini_api_key = data.get('gemini_api_key')
    
    if not message or not gemini_api_key:
        return jsonify({'error': 'Missing message or API key'}), 400
    
    try:
        # Configure Gemini
        print(f"Configuring Gemini with API key length: {len(gemini_api_key)}")
        genai.configure(api_key=gemini_api_key)
        
        # Set up the model
        model = genai.GenerativeModel("gemini-1.5-pro")
        print(f"Model initialized: gemini-1.5-pro")
        
        # Create the prompt with just the current message for simplicity
        print(f"User message: {message}")
        
        # Generate response using simple text input
        response = model.generate_content(message)
        
        response_text = response.text
        print(f"LLM response: {response_text[:100]}...")
        
        return jsonify({'response': response_text})
    
    except Exception as e:
        # Print the full error for debugging
        import traceback
        print(f"Error in LLM response: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/text-to-speech', methods=['POST'])
def text_to_speech():
    data = request.json
    text = data.get('text')
    elevenlabs_api_key = data.get('elevenlabs_api_key')
    voice_id = data.get('voice_id', 'pNInz6obpgDQGcFmaJgB')  # default voice
    
    if not text or not elevenlabs_api_key:
        return jsonify({'error': 'Missing text or API key'}), 400
    
    try:
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": elevenlabs_api_key
        }
        
        data = {
            "text": text,
            "model_id": "eleven_monolingual_v1",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.5
            }
        }
        
        response = requests.post(url, json=data, headers=headers)
        
        if response.status_code == 200:
            audio_content = base64.b64encode(response.content).decode('utf-8')
            return jsonify({
                'audio': f"data:audio/mpeg;base64,{audio_content}"
            })
        else:
            return jsonify({
                'error': f"ElevenLabs API error: {response.status_code} - {response.text}"
            }), 500
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/elevenlabs/voices', methods=['GET'])
def get_voices():
    elevenlabs_api_key = request.args.get('api_key')
    
    if not elevenlabs_api_key:
        return jsonify({'error': 'Missing API key'}), 400
    
    try:
        url = "https://api.elevenlabs.io/v1/voices"
        
        headers = {
            "Accept": "application/json",
            "xi-api-key": elevenlabs_api_key
        }
        
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({
                'error': f"ElevenLabs API error: {response.status_code} - {response.text}"
            }), 500
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True) 