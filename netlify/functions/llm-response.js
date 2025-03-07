const axios = require('axios');

exports.handler = async function(event, context) {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  
  try {
    const data = JSON.parse(event.body);
    const { message, history, gemini_api_key } = data;
    
    if (!message || !gemini_api_key) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing message or API key' })
      };
    }
    
    console.log(`User message: ${message}`);
    
    // System prompt to prevent asterisks and limit response length
    const systemPrompt = `You are a helpful AI assistant. Follow these rules strictly:

1. NEVER use asterisks (*) in your responses - not for emphasis, lists, or formatting.
2. Instead of asterisks for emphasis, use quotes, ALL CAPS, or dashes.
3. For lists, use numbers or hyphens (-) instead of bullet points.
4. Keep ALL responses under 240 characters. Be concise and direct.
5. If you cannot answer within 240 characters, prioritize the most important information.

Respond with short, clear answers without asterisks.`;
    
    // Prepare the request for Gemini API with system prompt
    const requestData = {
      contents: [
        {
          parts: [
            {
              text: message
            }
          ]
        }
      ],
      systemInstruction: {
        parts: [
          {
            text: systemPrompt
          }
        ]
      },
      generationConfig: {
        maxOutputTokens: 60 // Approximately 240 characters
      }
    };
    
    // If history is provided, we can format it appropriately for a chat
    if (history && history.length > 0) {
      // The actual implementation would depend on how your history is structured
      // and how Gemini expects chat history
      console.log("Chat history is available but not used in this implementation");
    }
    
    // Call Gemini API
    let response;
    try {
      response = await axios.post(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite:generateContent?key=${gemini_api_key}`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log("Gemini API response:", JSON.stringify(response.data));
      
      // Extract the response text
      let responseText = "";
      if (response.data.candidates && 
          response.data.candidates[0] && 
          response.data.candidates[0].content && 
          response.data.candidates[0].content.parts) {
        responseText = response.data.candidates[0].content.parts[0].text;
      }
      
      // If we get an error response or empty response, try with different settings
      if (!responseText || responseText.includes("I'm sorry, I couldn't process your request")) {
        // Try again with a different approach
        const fallbackRequestData = {
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: message
                }
              ]
            }
          ],
          systemInstruction: {
            parts: [
              {
                text: systemPrompt
              }
            ]
          },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 60 // Approximately 240 characters
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
          responseText = fallbackResponse.data.candidates[0].content.parts[0].text;
        }
      }
      
      // If we still don't have a good response, return a fallback message
      if (!responseText || responseText.includes("I'm sorry, I couldn't process your request")) {
        responseText = "I understood what you said, but I need to think about how to respond. Could you try asking your question in a different way?";
      }
      
      return {
        statusCode: 200,
        body: JSON.stringify({ response: responseText })
      };
      
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      throw error;
    }
    
  } catch (error) {
    console.error("Error in llm-response function:", error);
    
    return {
      statusCode: 200, // Return 200 with error message to avoid breaking UI
      body: JSON.stringify({ 
        response: 'I apologize, but I encountered an issue processing your request. Could you please try again or rephrase your question?'
      })
    };
  }
}; 