const axios = require('axios');

exports.handler = async function(event, context) {
  // Only allow GET
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  
  try {
    // Get API key from query parameter
    const elevenlabs_api_key = event.queryStringParameters?.api_key;
    
    if (!elevenlabs_api_key) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing API key' })
      };
    }
    
    console.log(`Fetching voices from ElevenLabs with API key length: ${elevenlabs_api_key.length}`);
    
    const url = "https://api.elevenlabs.io/v1/voices";
    
    const headers = {
      'Accept': 'application/json',
      'xi-api-key': elevenlabs_api_key
    };
    
    // Make the request to ElevenLabs
    const response = await axios.get(url, { headers });
    
    console.log(`ElevenLabs API response status: ${response.status}`);
    
    if (response.status === 200) {
      // Successfully got voices
      const voicesData = response.data;
      console.log(`Retrieved ${voicesData.voices?.length || 0} voices`);
      
      return {
        statusCode: 200,
        body: JSON.stringify(voicesData)
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
    console.error("Error fetching voices:", error);
    
    // Get a more useful error message from the response if available
    let errorMessage = error.message;
    if (error.response && error.response.data) {
      try {
        // Try to parse the error response if it's JSON
        const errorData = typeof error.response.data === 'object' 
          ? error.response.data 
          : JSON.parse(error.response.data);
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch (e) {
        // If parsing fails, use the error status
        errorMessage = `ElevenLabs API error: ${error.response.status}`;
      }
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: errorMessage
      })
    };
  }
}; 