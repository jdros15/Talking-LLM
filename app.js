document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const recordButton = document.getElementById('record-button');
    const recordingStatus = document.getElementById('recording-status');
    const recordingTime = document.querySelector('.recording-time');
    const statusElement = document.getElementById('status');
    const chatMessages = document.getElementById('chat-messages');
    const visualizer = document.getElementById('visualizer');
    const visualizerCtx = visualizer.getContext('2d');
    const saveApiKeysButton = document.getElementById('save-api-keys');
    const deleteApiKeysButton = document.getElementById('delete-api-keys');
    const geminiApiKeyInput = document.getElementById('gemini-api-key');
    const elevenlabsApiKeyInput = document.getElementById('elevenlabs-api-key');
    const voiceSelector = document.getElementById('voice-selector');
    const toggleSettingsButton = document.getElementById('toggle-settings');
    const closeSidebarButton = document.getElementById('close-sidebar');
    const settingsSidebar = document.getElementById('settings-sidebar');
    const settingsOverlay = document.getElementById('settings-overlay');

    // API Keys
    let geminiApiKey = localStorage.getItem('geminiApiKey') || '';
    let elevenlabsApiKey = localStorage.getItem('elevenlabsApiKey') || '';

    // Recording variables
    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;
    let recordingStartTime;
    let recordingTimer;
    let audioContext;
    let analyser;
    let source;
    let animationFrameId;

    // Mobile variables
    let isMobile = window.innerWidth <= 768;

    // Chat history
    let chatHistory = [];

    // Check if any API keys are missing and show a different welcome message
    function updateWelcomeMessage() {
        if (!geminiApiKey || !elevenlabsApiKey) {
            const firstMessage = chatMessages.querySelector('.message.assistant');
            if (firstMessage) {
                const paragraph = firstMessage.querySelector('p');
                if (paragraph) {
                    paragraph.textContent = "Hello! I'm your voice assistant. Please set your Gemini and ElevenLabs API keys in the settings first. Then click the microphone button to start speaking.";
                }
            }
        }
    }

    // Load saved API keys
    if (geminiApiKey) {
        geminiApiKeyInput.value = geminiApiKey;
    }
    if (elevenlabsApiKey) {
        elevenlabsApiKeyInput.value = elevenlabsApiKey;
        loadVoices();
    }
    
    // Update welcome message based on API key status
    updateWelcomeMessage();

    // Initialize visualizer
    function initVisualizer() {
        visualizer.width = visualizer.clientWidth;
        visualizer.height = visualizer.clientHeight;
    }

    // Open settings sidebar
    function openSettingsSidebar() {
        settingsSidebar.classList.add('active');
        settingsOverlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }

    // Close settings sidebar
    function closeSettingsSidebar() {
        settingsSidebar.classList.remove('active');
        settingsOverlay.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    }

    // Check if device is mobile and set initial state
    function checkMobileState() {
        isMobile = window.innerWidth <= 768;
    }

    // Initialize
    initVisualizer();
    window.addEventListener('resize', () => {
        initVisualizer();
        checkMobileState();
    });
    
    // Settings sidebar toggle events
    if (toggleSettingsButton) {
        toggleSettingsButton.addEventListener('click', openSettingsSidebar);
    }
    
    if (closeSidebarButton) {
        closeSidebarButton.addEventListener('click', closeSettingsSidebar);
    }
    
    if (settingsOverlay) {
        settingsOverlay.addEventListener('click', closeSettingsSidebar);
    }

    // Delete API keys
    if (deleteApiKeysButton) {
        deleteApiKeysButton.addEventListener('click', () => {
            // Clear localStorage
            localStorage.removeItem('geminiApiKey');
            localStorage.removeItem('elevenlabsApiKey');
            
            // Clear input fields
            geminiApiKeyInput.value = '';
            elevenlabsApiKeyInput.value = '';
            
            // Reset variables
            geminiApiKey = '';
            elevenlabsApiKey = '';
            
            // Reset voice selector
            while (voiceSelector.options.length > 1) {
                voiceSelector.remove(1);
            }
            
            updateStatus('API keys deleted');
            
            // Close sidebar on mobile after deleting
            if (isMobile) {
                closeSettingsSidebar();
            }
        });
    }

    // Scroll to bottom of chat messages when new message is added
    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Save API Keys
    saveApiKeysButton.addEventListener('click', () => {
        geminiApiKey = geminiApiKeyInput.value.trim();
        elevenlabsApiKey = elevenlabsApiKeyInput.value.trim();

        if (geminiApiKey && elevenlabsApiKey) {
            localStorage.setItem('geminiApiKey', geminiApiKey);
            localStorage.setItem('elevenlabsApiKey', elevenlabsApiKey);
            
            updateStatus('API keys saved');
            loadVoices();
            
            // Close sidebar on mobile after saving
            if (isMobile) {
                closeSettingsSidebar();
            }
        } else {
            updateStatus('Please enter both API keys');
        }
    });

    // Load ElevenLabs Voices
    async function loadVoices() {
        if (!elevenlabsApiKey) return;
        
        try {
            updateStatus('Loading voices...');
            const response = await fetch(`/.netlify/functions/elevenlabs-voices?api_key=${elevenlabsApiKey}`);
            const data = await response.json();
            
            if (data.error) {
                console.error('Error loading voices:', data.error);
                throw new Error(data.error);
            }
            
            // Clear existing options except the default
            while (voiceSelector.options.length > 1) {
                voiceSelector.remove(1);
            }
            
            // Add voices
            if (data.voices && data.voices.length > 0) {
                data.voices.forEach(voice => {
                    const option = document.createElement('option');
                    option.value = voice.voice_id;
                    option.textContent = voice.name;
                    voiceSelector.appendChild(option);
                });
                
                updateStatus('Voices loaded');
            } else {
                console.log('No voices found, adding fallback voices');
                // Add some default ElevenLabs voices as fallback
                const fallbackVoices = [
                    { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam' },
                    { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella' },
                    { voice_id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam' }
                ];
                
                fallbackVoices.forEach(voice => {
                    const option = document.createElement('option');
                    option.value = voice.voice_id;
                    option.textContent = voice.name;
                    voiceSelector.appendChild(option);
                });
                
                updateStatus('Using fallback voices');
            }
        } catch (error) {
            console.error('Error loading voices:', error);
            updateStatus('Error loading voices');
            
            // Add some default voices if we couldn't load them
            const fallbackVoices = [
                { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam' },
                { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella' },
                { voice_id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam' }
            ];
            
            fallbackVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.voice_id;
                option.textContent = voice.name;
                voiceSelector.appendChild(option);
            });
        }
    }

    // Update status message
    function updateStatus(message) {
        statusElement.textContent = message;
        setTimeout(() => {
            statusElement.textContent = isRecording ? 'Recording...' : 'Ready';
        }, 3000);
    }

    // Format recording time
    function formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    // Update recording time
    function updateRecordingTime() {
        if (!recordingStartTime) return;
        const elapsed = Date.now() - recordingStartTime;
        recordingTime.textContent = formatTime(elapsed);
    }

    // Draw visualizer
    function drawVisualizer() {
        if (!analyser) return;
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
        
        visualizerCtx.clearRect(0, 0, visualizer.width, visualizer.height);
        
        const barWidth = (visualizer.width / bufferLength) * 2.5;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            const barHeight = dataArray[i] / 255 * visualizer.height * 0.8;
            
            const gradient = visualizerCtx.createLinearGradient(0, visualizer.height - barHeight, 0, visualizer.height);
            gradient.addColorStop(0, '#4f46e5');
            gradient.addColorStop(1, '#818cf8');
            
            visualizerCtx.fillStyle = gradient;
            visualizerCtx.fillRect(x, visualizer.height - barHeight, barWidth, barHeight);
            
            x += barWidth + 1;
        }
        
        animationFrameId = requestAnimationFrame(drawVisualizer);
    }

    // Start recording
    async function startRecording() {
        if (!geminiApiKey || !elevenlabsApiKey) {
            updateStatus('Please enter both API keys');
            return;
        }
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Set up audio context for visualization
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            
            // Try to use a more compatible audio format
            // Gemini supports mp3, mp4, mpeg, mpga, m4a, wav, and webm
            const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
                ? 'audio/webm' 
                : (MediaRecorder.isTypeSupported('audio/mp4') 
                    ? 'audio/mp4' 
                    : 'audio/ogg; codecs=opus');
            
            console.log('Using audio MIME type:', mimeType);
            mediaRecorder = new MediaRecorder(stream, { mimeType });
            audioChunks = [];
            
            mediaRecorder.addEventListener('dataavailable', event => {
                audioChunks.push(event.data);
            });
            
            mediaRecorder.addEventListener('stop', () => {
                processRecording();
            });
            
            mediaRecorder.start();
            isRecording = true;
            recordingStartTime = Date.now();
            recordingTimer = setInterval(updateRecordingTime, 1000);
            
            // Update UI
            recordButton.classList.add('recording');
            recordButton.innerHTML = '<i class="fas fa-stop"></i>';
            recordingStatus.classList.add('active');
            updateStatus('Recording...');
            
            // Start visualizer
            drawVisualizer();
            
        } catch (error) {
            console.error('Error starting recording:', error);
            updateStatus('Error: ' + error.message);
        }
    }

    // Stop recording
    function stopRecording() {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
        
        mediaRecorder.stop();
        isRecording = false;
        clearInterval(recordingTimer);
        
        // Update UI
        recordButton.classList.remove('recording');
        recordButton.innerHTML = '<i class="fas fa-microphone"></i>';
        recordingStatus.classList.remove('active');
        updateStatus('Processing...');
        
        // Stop visualizer
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        
        // Clean up audio context
        if (source) {
            source.disconnect();
        }
        if (audioContext) {
            audioContext.close();
        }
    }

    // Process recording
    async function processRecording() {
        try {
            // Use the same MIME type that was used for recording
            const mimeType = mediaRecorder.mimeType;
            console.log('Processing recording with MIME type:', mimeType);
            const audioBlob = new Blob(audioChunks, { type: mimeType });
            console.log('Created audio blob:', audioBlob.size, 'bytes');
            
            // Convert blob to base64
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            
            reader.onloadend = async () => {
                const base64Audio = reader.result;
                console.log('Audio converted to base64, first 100 chars:', base64Audio.substring(0, 100));
                
                // Add user message to chat
                addMessage('user', '🎤 [Voice message]');
                
                // Send to Netlify Function for STT
                console.log('Sending audio to server with Gemini API key length:', geminiApiKey.length);
                try {
                    updateStatus('Transcribing audio...');
                    const response = await fetch('/.netlify/functions/speech-to-text', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            audio: base64Audio,
                            gemini_api_key: geminiApiKey
                        })
                    });
                    
                    console.log('Server response status:', response.status);
                    const data = await response.json();
                    console.log('Server response:', data);
                    
                    if (data.error) {
                        throw new Error(data.error);
                    }
                    
                    const transcription = data.transcription;
                    console.log('Received transcription:', transcription);
                    
                    // Update user message
                    updateLastUserMessage(transcription);
                    
                    // Add to chat history
                    chatHistory.push({ role: 'user', content: transcription });
                    
                    // Get response from LLM
                    await getLLMResponse(transcription);
                } catch (error) {
                    console.error('Network or parsing error:', error);
                    updateStatus('Error: ' + error.message);
                }
            };
        } catch (error) {
            console.error('Error processing recording:', error);
            updateStatus('Error: ' + error.message);
        }
    }

    // Get LLM response
    async function getLLMResponse(transcription) {
        try {
            updateStatus('Getting response...');
            
            // Call Netlify Function for LLM response
            const response = await fetch('/.netlify/functions/llm-response', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: transcription,
                    history: chatHistory,
                    gemini_api_key: geminiApiKey
                })
            });
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            const llmResponse = data.response;
            
            // Add LLM message to chat
            addMessage('assistant', llmResponse);
            
            // Add to chat history
            chatHistory.push({ role: 'assistant', content: llmResponse });
            
            // Speak the response
            await speakResponse(llmResponse);
            
            updateStatus('Ready');
        } catch (error) {
            console.error('Error getting LLM response:', error);
            updateStatus('Error: ' + error.message);
            
            // Fallback response in case of error
            const fallbackResponse = "I'm sorry, I couldn't process your request. Please try again.";
            addMessage('assistant', fallbackResponse);
            chatHistory.push({ role: 'assistant', content: fallbackResponse });
            await speakResponse(fallbackResponse);
        }
    }

    // Speak response using ElevenLabs
    async function speakResponse(text) {
        try {
            updateStatus('Speaking...');
            
            const selectedVoice = voiceSelector.value;
            console.log(`Speaking response with voice: ${selectedVoice}`);
            
            const response = await fetch('/.netlify/functions/text-to-speech', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    elevenlabs_api_key: elevenlabsApiKey,
                    voice_id: selectedVoice
                })
            });
            
            console.log('TTS response status:', response.status);
            const data = await response.json();
            console.log('TTS response data:', data);
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            if (!data.audio) {
                throw new Error('No audio data returned');
            }
            
            // Play the audio
            const audio = new Audio(data.audio);
            audio.play();
            
            audio.onended = () => {
                updateStatus('Ready');
            };
            
        } catch (error) {
            console.error('Error speaking response:', error);
            updateStatus('Error: ' + error.message);
        }
    }

    // Add message to chat
    function addMessage(role, content) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.classList.add(role);
        
        const contentElement = document.createElement('div');
        contentElement.classList.add('message-content');
        
        const paragraph = document.createElement('p');
        paragraph.textContent = content;
        
        contentElement.appendChild(paragraph);
        messageElement.appendChild(contentElement);
        
        chatMessages.appendChild(messageElement);
        
        // Ensure smooth scrolling, especially on mobile
        setTimeout(scrollToBottom, 50);
        
        return messageElement;
    }

    // Update last user message
    function updateLastUserMessage(content) {
        const userMessages = document.querySelectorAll('.message.user');
        if (userMessages.length > 0) {
            const lastUserMessage = userMessages[userMessages.length - 1];
            const paragraph = lastUserMessage.querySelector('p');
            paragraph.textContent = content;
            setTimeout(scrollToBottom, 50);
        }
    }

    // Toggle recording
    recordButton.addEventListener('click', () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });
}); 