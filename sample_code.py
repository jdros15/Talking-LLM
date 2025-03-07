import base64
import os
from google import genai
from google.genai import types


def generate():
    client = genai.Client(
        api_key=os.environ.get("GEMINI_API_KEY"),
    )

    files = [
        # Make the file available in local system working directory
        client.files.upload(file="Recorded Audio March 07, 2025 - 9:58PM.ogg"),
    ]
    model = "gemini-2.0-flash-lite"
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_uri(
                    file_uri=files[0].uri,
                    mime_type=files[0].mime_type,
                ),
            ],
        ),
        types.Content(
            role="model",
            parts=[
                types.Part.from_text(text="""Hi there. 
"""),
            ],
        ),
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text="""INSERT_INPUT_HERE"""),
            ],
        ),
    ]
    generate_content_config = types.GenerateContentConfig(
        temperature=1,
        top_p=0.95,
        top_k=40,
        max_output_tokens=60,
        response_mime_type="text/plain",
        system_instruction=[
            types.Part.from_text(text="""You are a helpful, concise, and friendly assistant.
Only respond with natural language. Strictly refrain from using special characters that aren't necessary in speaking (e.g.: * )
Always maintain a conversational tone and avoid technical jargon unless specifically asked."""),
        ],
    )

    for chunk in client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=generate_content_config,
    ):
        print(chunk.text, end="")

if __name__ == "__main__":
    generate() 
