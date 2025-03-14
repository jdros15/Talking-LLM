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
    
    // Updated system prompt with less emphasis
    const systemPrompt = "IMPORTANT: NEVER use asterisks (*) in your responses. Keep your answer under 240 characters. Be concise and direct. Use emphasis sparingly. Avoid excessive use of ALL CAPS. Only capitalize for acronyms or subtle emphasis of 1-2 key words when necessary. Use a natural, conversational tone.";
    
    // Prepare the API request contents with conversation history
    let contents = [];
    
    // Add system prompt as the first message if there's no history
    // otherwise, add it to the latest user message
    if (!history || history.length === 0) {
      // First message in conversation - include system prompt with user message
      contents.push({
        role: "user",
        parts: [
          {
            text: systemPrompt + "\n\n" + message
          }
        ]
      });
    } else {
      // Format history for Gemini API
      // First add all previous messages
      history.forEach(item => {
        contents.push({
          role: item.role,
          parts: [
            {
              text: item.content || item.message // Support both formats
            }
          ]
        });
      });
      
      // Then add the current user message
      contents.push({
        role: "user",
        parts: [
          {
            text: message
          }
        ]
      });
    }
    
    // Prepare the request for Gemini API
    const requestData = {
      contents: contents,
      generationConfig: {
        maxOutputTokens: 60 // Approximately 240 characters
      }
    };
    
    console.log("Sending to Gemini with conversation history. Total messages:", contents.length);
    
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
        // Try again with a different approach - slightly adjust the format
        const fallbackRequestData = {
          contents: contents,
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