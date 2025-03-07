const axios = require('axios');

exports.handler = async function(event, context) {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  
  try {
    const data = JSON.parse(event.body);
    const { text, elevenlabs_api_key, voice_id = 'pNInz6obpgDQGcFmaJgB' } = data;
    
    if (!text || !elevenlabs_api_key) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing text or API key' })
      };
    }
    
    console.log(`Sending TTS request to ElevenLabs with text: '${text.substring(0, 50)}...' using voice: ${voice_id}`);
    
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`;
    
    const headers = {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': elevenlabs_api_key
    };
    
    const ttsData = {
      text: text,
      model_id: "eleven_monolingual_v1",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5
      }
    };
    
    // Add timeout to prevent hanging requests
    const response = await axios.post(url, ttsData, {
      headers: headers,
      responseType: 'arraybuffer', // Important for binary data
      timeout: 30000 // 30 second timeout
    });
    
    console.log(`ElevenLabs TTS API response status: ${response.status}`);
    
    if (response.status === 200) {
      // Verify we actually received data
      if (!response.data || response.data.length === 0) {
        console.error('Received empty response from ElevenLabs');
        return {
          statusCode: 500,
          body: JSON.stringify({
            error: 'Received empty audio data from ElevenLabs'
          })
        };
      }
      
      // Convert the binary audio data to base64
      const audioContent = Buffer.from(response.data).toString('base64');
      console.log(`Successfully received audio data, size: ${response.data.length} bytes`);
      
      // Create the data URL format expected by the frontend
      const audioDataUrl = `data:audio/mpeg;base64,${audioContent}`;
      
      return {
        statusCode: 200,
        body: JSON.stringify({ audio: audioDataUrl })
      };
    } else {
      // This code shouldn't be reached since axios throws on non-2xx responses
      // but we'll leave it for completeness
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: `ElevenLabs API error: ${response.status}`
        })
      };
    }
    
  } catch (error) {
    console.error("Error in text-to-speech function:", error);
    
    // Get a more useful error message from the response if available
    let errorMessage = error.message;
    let statusCode = 500;
    
    if (error.code === 'ECONNABORTED') {
      errorMessage = 'ElevenLabs request timed out after 30 seconds';
    } else if (error.response) {
      statusCode = error.response.status;
      
      if (error.response.data) {
        try {
          // Try to parse the error response for JSON data
          if (Buffer.isBuffer(error.response.data)) {
            // Convert buffer to string
            const errorText = error.response.data.toString('utf8');
            try {
              const errorData = JSON.parse(errorText);
              errorMessage = errorData.detail || errorData.message || errorMessage;
            } catch (e) {
              // Not JSON, use text
              errorMessage = errorText.substring(0, 100); // Limit length
            }
          } else {
            // Handle case where response is already an object
            const errorData = typeof error.response.data === 'object' 
              ? error.response.data 
              : JSON.parse(error.response.data);
            errorMessage = errorData.detail || errorData.message || errorMessage;
          }
        } catch (e) {
          // If parsing fails, use the error status
          errorMessage = `ElevenLabs API error: ${error.response.status}`;
        }
      }
    }
    
    return {
      statusCode: statusCode,
      body: JSON.stringify({ 
        error: errorMessage
      })
    };
  }
}; 