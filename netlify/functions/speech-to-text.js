const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');

exports.handler = async function(event, context) {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  
  try {
    const data = JSON.parse(event.body);
    const { audio, gemini_api_key } = data;
    
    if (!audio || !gemini_api_key) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing audio data or API key' })
      };
    }
    
    // Determine file extension from MIME type
    const mimeType = audio.split(';')[0];
    let fileExtension = '.ogg';  // default
    
    if (mimeType.includes('audio/webm')) {
      fileExtension = '.webm';
    } else if (mimeType.includes('audio/mp4')) {
      fileExtension = '.mp4';
    } else if (mimeType.includes('audio/wav')) {
      fileExtension = '.wav';
    }
    
    console.log(`Detected MIME type: ${mimeType}, using extension: ${fileExtension}`);
    
    // Split at the comma (data:audio/TYPE;base64, ...)
    const audioParts = audio.split(',');
    if (audioParts.length < 2) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid audio format - no base64 content found' })
      };
    }
    
    // Decode base64
    const audioBuffer = Buffer.from(audioParts[1], 'base64');
    
    // Save to temp file - in Netlify we need to use /tmp
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `audio-${Date.now()}${fileExtension}`);
    
    fs.writeFileSync(tempFilePath, audioBuffer);
    console.log(`Saved audio to ${tempFilePath}`);
    
    // Call Gemini API for speech-to-text
    // First prepare our audio file and create multipart form
    const formData = new FormData();
    
    // Create blob from file
    const audioBlob = new Blob([fs.readFileSync(tempFilePath)], { 
      type: `audio/${fileExtension.substring(1)}` 
    });
    
    // Create model parts for the API request
    const requestData = {
      contents: [
        {
          parts: [
            {
              text: "You're an expert at transcribing audio. Please accurately transcribe the audio file I'm about to send you. Only return the transcription with no additional text. Never use asterisks (*) in your response."
            },
            {
              inline_data: {
                mime_type: `audio/${fileExtension.substring(1)}`,
                data: audioParts[1] // The base64 encoded audio data without the prefix
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0
      }
    };
    
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite:generateContent?key=${gemini_api_key}`,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log("Gemini API response:", JSON.stringify(response.data));
    
    // Clean up the temp file
    fs.unlinkSync(tempFilePath);
    
    // Extract the transcription from the response
    let transcription = "";
    if (response.data.candidates && 
        response.data.candidates[0] && 
        response.data.candidates[0].content && 
        response.data.candidates[0].content.parts) {
      transcription = response.data.candidates[0].content.parts[0].text;
    }
    
    // Handle case where no valid transcription was returned
    if (!transcription || transcription.includes("I'm sorry, I couldn't process your request")) {
      // Try again with a simpler approach
      const fallbackRequestData = {
        contents: [
          {
            parts: [
              {
                text: "Transcribe this audio accurately. Never use asterisks in your response."
              },
              {
                inline_data: {
                  mime_type: `audio/${fileExtension.substring(1)}`,
                  data: audioParts[1]
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0
        }
      };
      
      const fallbackResponse = await axios.post(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite:generateContent?key=${gemini_api_key}`,
        fallbackRequestData,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (fallbackResponse.data.candidates && 
          fallbackResponse.data.candidates[0] && 
          fallbackResponse.data.candidates[0].content && 
          fallbackResponse.data.candidates[0].content.parts) {
        transcription = fallbackResponse.data.candidates[0].content.parts[0].text;
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ transcription: transcription })
    };
    
  } catch (error) {
    console.error("Error in speech-to-text function:", error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Unable to transcribe audio. Please try again with clearer audio.',
        details: error.message
      })
    };
  }
}; 