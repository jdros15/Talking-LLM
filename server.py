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
        
        # Try a different approach with just regular generate_content
        model = genai.GenerativeModel("gemini-2.0-flash-lite")
        print(f"Model initialized: gemini-2.0-flash-lite")
        
        # Try to open and verify the audio file
        try:
            with open(temp_audio_path, 'rb') as f:
                audio_bytes = f.read()
                print(f"Successfully read {len(audio_bytes)} bytes from the audio file")
        except Exception as e:
            print(f"Error reading the audio file: {str(e)}")
            return jsonify({'error': f'Error reading the audio file: {str(e)}'}), 500
        
        # Use simpler approach - just generate content directly
        try:
            parts = [
                genai.Part(text="You're an expert at transcribing audio. Please accurately transcribe the audio file I'm about to send you. Only return the transcription with no additional text."),
                genai.Part(inline_data=genai.Blob(mime_type=f"audio/{file_extension[1:]}", data=audio_bytes))
            ]
            
            response = model.generate_content(parts)
            
            # If we get a response but it's the "I'm sorry..." message, try one more time with a different approach
            if "I'm sorry, I couldn't process your request" in response.text:
                print("Got 'I couldn't process' error, trying alternative approach")
                
                # Try a simpler approach without the instruction
                parts = [
                    genai.Part(inline_data=genai.Blob(mime_type=f"audio/{file_extension[1:]}", data=audio_bytes))
                ]
                
                response = model.generate_content(parts)
            
            transcription = response.text.strip()
            print(f"Got transcription: {transcription}")
            
            # Clean up temporary file
            os.unlink(temp_audio_path)
            
            return jsonify({'transcription': transcription})
        except Exception as e:
            print(f"Error in generate_content: {str(e)}")
            import traceback
            print(traceback.format_exc())
            
            # Try one last approach with a chat
            try:
                print("Trying chat approach as fallback")
                chat = model.start_chat()
                
                chat_response = chat.send_message([
                    "This is a transcription job. Please transcribe the audio and respond with only the transcription text.",
                    {"mime_type": f"audio/{file_extension[1:]}", "data": audio_bytes}
                ])
                
                transcription = chat_response.text.strip()
                print(f"Got transcription from chat: {transcription}")
                
                # Clean up temporary file
                os.unlink(temp_audio_path)
                
                return jsonify({'transcription': transcription})
            except Exception as chat_e:
                print(f"Error in chat approach: {str(chat_e)}")
                raise e  # Re-raise the original error if both approaches fail
        
    except Exception as e:
        # Print the full error for debugging
        import traceback
        print(f"Error in speech-to-text: {str(e)}")
        print(traceback.format_exc())
        
        # Clean up temporary file
        if os.path.exists(temp_audio_path):
            os.unlink(temp_audio_path)
        
        # Return a more user-friendly error message
        return jsonify({'error': 'Unable to transcribe audio. Please try again with clearer audio.'}), 500

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
        model = genai.GenerativeModel("gemini-2.0-flash-lite")
        print(f"Model initialized: gemini-2.0-flash-lite")
        
        # Create the prompt with just the current message for simplicity
        print(f"User message: {message}")
        
        # Generate response using different formats to ensure compatibility
        try:
            # First approach: Use simpler text input
            print("Using simple text input approach")
            response = model.generate_content(message)
            
            if "I'm sorry, I couldn't process your request" in response.text:
                print("Got 'I couldn't process' error, trying alternative approach")
                
                # Second approach: Use more structured input
                parts = [genai.Part(text=message)]
                response = model.generate_content(parts)
                
                # If still failing, try one more approach with different formatting
                if "I'm sorry, I couldn't process your request" in response.text:
                    print("Still getting error, trying with Content object")
                    
                    # Third approach: Try with chat
                    chat = model.start_chat()
                    response = chat.send_message(message)
            
            response_text = response.text
            print(f"LLM response: {response_text[:100]}...")
            
            # If we still get an error message, return a better fallback
            if "I'm sorry, I couldn't process your request" in response_text:
                return jsonify({'response': 'I understood what you said, but I need to think about how to respond. Could you try asking your question in a different way?'})
            
            return jsonify({'response': response_text})
            
        except Exception as inner_e:
            print(f"Error generating content: {str(inner_e)}")
            import traceback
            print(traceback.format_exc())
            
            # One final approach with safety settings adjusted
            safety_settings = {
                genai.types.HarmCategory.HARM_CATEGORY_HARASSMENT: genai.types.HarmBlockThreshold.BLOCK_NONE,
                genai.types.HarmCategory.HARM_CATEGORY_HATE_SPEECH: genai.types.HarmBlockThreshold.BLOCK_NONE,
                genai.types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: genai.types.HarmBlockThreshold.BLOCK_NONE,
                genai.types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: genai.types.HarmBlockThreshold.BLOCK_NONE,
            }
            
            model = genai.GenerativeModel("gemini-2.0-flash-lite", safety_settings=safety_settings)
            response = model.generate_content(message)
            
            response_text = response.text
            print(f"LLM response with safety settings: {response_text[:100]}...")
            
            return jsonify({'response': response_text})
    
    except Exception as e:
        # Print the full error for debugging
        import traceback
        print(f"Error in LLM response: {str(e)}")
        print(traceback.format_exc())
        
        # Return a more friendly error message
        return jsonify({'response': 'I apologize, but I encountered an issue processing your request. Could you please try again or rephrase your question?'}), 200

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
        
        tts_data = {
            "text": text,
            "model_id": "eleven_monolingual_v1",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.5
            }
        }
        
        print(f"Sending TTS request to ElevenLabs with text: '{text[:50]}...' using voice: {voice_id}")
        response = requests.post(url, json=tts_data, headers=headers)
        
        print(f"ElevenLabs TTS API response status: {response.status_code}")
        
        if response.status_code == 200:
            # We got audio data back
            audio_content = base64.b64encode(response.content).decode('utf-8')
            print(f"Successfully received audio data, size: {len(response.content)} bytes")
            
            audio_data_url = f"data:audio/mpeg;base64,{audio_content}"
            return jsonify({'audio': audio_data_url})
        else:
            # Handle error response
            error_text = response.text
            print(f"ElevenLabs TTS API error: {response.status_code} - {error_text}")
            return jsonify({
                'error': f"ElevenLabs API error: {response.status_code} - {error_text[:200]}"
            }), 500
    
    except Exception as e:
        # Print the full error for debugging
        import traceback
        print(f"Error in text-to-speech: {str(e)}")
        print(traceback.format_exc())
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
        
        print(f"Fetching voices from ElevenLabs with API key length: {len(elevenlabs_api_key)}")
        response = requests.get(url, headers=headers)
        
        print(f"ElevenLabs API response status: {response.status_code}")
        
        if response.status_code == 200:
            # Successfully got voices
            voices_data = response.json()
            print(f"Retrieved {len(voices_data.get('voices', []))} voices")
            return jsonify(voices_data)
        else:
            # Handle error response
            error_text = response.text
            print(f"ElevenLabs API error: {response.status_code} - {error_text}")
            return jsonify({
                'error': f"ElevenLabs API error: {response.status_code} - {error_text[:200]}"
            }), 500
    
    except Exception as e:
        # Print the full error for debugging
        import traceback
        print(f"Error fetching voices: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True) 