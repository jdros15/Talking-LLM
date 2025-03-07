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
    const headerClearConversationButton = document.getElementById('header-clear-conversation');
    const clearConfirmationModal = document.getElementById('clear-confirmation-modal');
    const confirmClearButton = document.getElementById('confirm-clear');
    const cancelClearButton = document.getElementById('cancel-clear');
    const volumeSlider = document.getElementById('volume-slider');

    // API Keys
    let geminiApiKey = localStorage.getItem('geminiApiKey') || '';
    let elevenlabsApiKey = localStorage.getItem('elevenlabsApiKey') || '';

    // Volume setting
    let audioVolume = parseFloat(localStorage.getItem('audioVolume') || '0.6');
    if (volumeSlider) {
        volumeSlider.value = audioVolume * 100;
    }

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
    let audio; // To store current audio playback

    // Mobile variables
    let isMobile = window.innerWidth <= 768;

    // Flag to track if we should initialize chat
    let shouldInitializeChat = true;

    // Chat history and audio cache
    let chatHistory = [];
    let audioCache = {};

    // Try to load chat history and audio cache from localStorage safely
    try {
        const storedChatHistory = localStorage.getItem('chatHistory');
        if (storedChatHistory) {
            chatHistory = JSON.parse(storedChatHistory) || [];
        }
        
        const storedAudioCache = localStorage.getItem('audioCache');
        if (storedAudioCache) {
            audioCache = JSON.parse(storedAudioCache) || {};
        }
    } catch (error) {
        console.error('Error loading data from localStorage:', error);
        // Reset to defaults if there was an error
        chatHistory = [];
        audioCache = {};
    }

    let isVisualizerActive = false;

    // Cache management
    const MAX_CACHE_SIZE = 50; // Maximum number of messages to store
    const MAX_AUDIO_CACHE_SIZE = 30; // Maximum number of audio files to cache

    // Trim cache if it gets too large
    function trimCache() {
        // Trim chat history
        if (chatHistory.length > MAX_CACHE_SIZE) {
            chatHistory = chatHistory.slice(chatHistory.length - MAX_CACHE_SIZE);
            safeLocalStorageSetItem('chatHistory', JSON.stringify(chatHistory));
        }
        
        // Trim audio cache
        const audioTimestamps = Object.keys(audioCache);
        if (audioTimestamps.length > MAX_AUDIO_CACHE_SIZE) {
            // Sort timestamps by date (oldest first)
            audioTimestamps.sort((a, b) => new Date(a) - new Date(b));
            
            // Remove oldest entries
            const toRemove = audioTimestamps.slice(0, audioTimestamps.length - MAX_AUDIO_CACHE_SIZE);
            toRemove.forEach(timestamp => {
                delete audioCache[timestamp];
            });
            
            safeLocalStorageSetItem('audioCache', JSON.stringify(audioCache));
        }
    }

    // Initialize chat from cache if available
    function initializeChat() {
        // Skip initialization if we've decided not to initialize
        if (!shouldInitializeChat) {
            return;
        }
        
        // Clear chat UI first (remove any default messages)
        chatMessages.innerHTML = '';
        
        // Mark initialization as done to prevent future calls
        shouldInitializeChat = false;
        
        // If there's no chat history, add a welcome message
        if (chatHistory.length === 0) {
            const welcomeMessage = "Hello! I'm your voice assistant. Please click the microphone button to start speaking.";
            
            // Add welcome message to UI (don't save to history yet)
            const messageObj = {
                role: 'assistant',
                content: welcomeMessage,
                timestamp: new Date().toISOString()
            };
            
            // Add message to UI
            addMessageToUI(messageObj);
            
            // Save to chat history
            chatHistory.push(messageObj);
            safeLocalStorageSetItem('chatHistory', JSON.stringify(chatHistory));
        } else {
            // Validate chat history before populating
            const validatedHistory = [];
            const seenMessages = new Set();
            
            chatHistory.forEach(message => {
                // Check if message has valid properties
                if (!message.role || !message.content || !message.timestamp) {
                    return;
                }
                
                // Validate timestamp (should be a valid date string)
                try {
                    const date = new Date(message.timestamp);
                    if (isNaN(date.getTime())) {
                        // Invalid date, generate a new timestamp
                        message.timestamp = new Date().toISOString();
                    }
                } catch (e) {
                    message.timestamp = new Date().toISOString();
                }
                
                // Create a unique key for the message to detect duplicates
                const messageKey = `${message.role}-${message.content}-${message.timestamp}`;
                
                // Only add if not a duplicate
                if (!seenMessages.has(messageKey)) {
                    seenMessages.add(messageKey);
                    validatedHistory.push(message);
                    addMessageToUI(message);
                }
            });
            
            // Replace chatHistory with validated history
            chatHistory = validatedHistory;
            safeLocalStorageSetItem('chatHistory', JSON.stringify(chatHistory));
        }
        
        scrollToBottom();
    }
    
    // Separate function to add messages to UI only (without saving to history)
    function addMessageToUI(messageObj) {
        const { role, content, timestamp } = messageObj;
        
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.classList.add(role);
        
        const contentElement = document.createElement('div');
        contentElement.classList.add('message-content');
        
        const paragraph = document.createElement('p');
        paragraph.textContent = content;
        
        contentElement.appendChild(paragraph);
        
        // Add message footer with timestamp and audio replay button (for assistant messages)
        const messageFooter = document.createElement('div');
        messageFooter.classList.add('message-footer');
        
        // Add timestamp
        const messageTimestamp = document.createElement('span');
        messageTimestamp.classList.add('message-timestamp');
        const formattedTime = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageTimestamp.textContent = formattedTime;
        messageFooter.appendChild(messageTimestamp);
        
        // Add audio replay button for assistant messages
        if (role === 'assistant') {
            const audioReplayBtn = document.createElement('button');
            audioReplayBtn.classList.add('audio-replay-btn');
            audioReplayBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            audioReplayBtn.setAttribute('aria-label', 'Replay audio message');
            audioReplayBtn.setAttribute('title', 'Replay audio message');
            
            // Add timestamp as data attribute for finding in cache
            audioReplayBtn.dataset.timestamp = timestamp;
            
            // Add click event listener
            audioReplayBtn.addEventListener('click', () => {
                replayAudio(timestamp);
            });
            
            messageFooter.appendChild(audioReplayBtn);
        }
        
        contentElement.appendChild(messageFooter);
        messageElement.appendChild(contentElement);
        
        chatMessages.appendChild(messageElement);
        
        return messageElement;
    }

    // Initialize chat from cache only once, after a small delay to ensure DOM is ready
    setTimeout(initializeChat, 100);

    // Show clear conversation confirmation modal
    function showClearConfirmationModal() {
        clearConfirmationModal.classList.add('active');
    }

    // Hide clear conversation confirmation modal
    function hideClearConfirmationModal() {
        clearConfirmationModal.classList.remove('active');
    }

    // Clear conversation (after confirmation)
    function clearConversation() {
        // Clear chat history from localStorage
        localStorage.removeItem('chatHistory');
        
        // Clear audio cache from localStorage
        localStorage.removeItem('audioCache');
        
        // Reset variables
        chatHistory = [];
        audioCache = {};
        
        // Clear chat UI
        chatMessages.innerHTML = '';
        
        // Add welcome message
        const welcomeMessage = "Hello! I'm your voice assistant. Please click the microphone button to start speaking.";
        addMessage('assistant', welcomeMessage);
        
        updateStatus('Conversation cleared');
        
        // Close sidebar on mobile
        if (isMobile) {
            closeSettingsSidebar();
        }
        
        // Hide confirmation modal
        hideClearConfirmationModal();
    }

    // Volume slider change event
    if (volumeSlider) {
        const volumeSliderLabel = document.querySelector('label[for="volume-slider"]');
        
        // Set initial label
        if (volumeSliderLabel) {
            volumeSliderLabel.textContent = `Volume (${Math.round(audioVolume * 100)}%)`;
        }
        
        volumeSlider.addEventListener('input', () => {
            audioVolume = volumeSlider.value / 100;
            safeLocalStorageSetItem('audioVolume', audioVolume.toString());
            
            // Update label
            if (volumeSliderLabel) {
                volumeSliderLabel.textContent = `Volume (${volumeSlider.value}%)`;
            }
            
            // Update current audio if playing
            if (audio) {
                audio.volume = audioVolume;
            }
        });
    }

    // Header clear conversation button
    if (headerClearConversationButton) {
        headerClearConversationButton.addEventListener('click', showClearConfirmationModal);
    }
    
    // Confirm clear conversation button
    if (confirmClearButton) {
        confirmClearButton.addEventListener('click', clearConversation);
    }
    
    // Cancel clear conversation button
    if (cancelClearButton) {
        cancelClearButton.addEventListener('click', hideClearConfirmationModal);
    }

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
        document.body.classList.remove('sidebar-closed');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }

    // Close settings sidebar
    function closeSettingsSidebar() {
        settingsSidebar.classList.remove('active');
        settingsOverlay.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
        
        // Only add the sidebar-closed class on larger screens
        if (!isMobile) {
            document.body.classList.add('sidebar-closed');
        }
    }

    // Check if device is mobile and set initial state
    function checkMobileState() {
        isMobile = window.innerWidth <= 768;
        
        // Set initial sidebar state class
        if (isMobile) {
            document.body.classList.remove('sidebar-closed');
        } else {
            // On desktop, check if sidebar is visible by default
            const sidebarActive = settingsSidebar && settingsSidebar.classList.contains('active');
            if (!sidebarActive) {
                document.body.classList.add('sidebar-closed');
            } else {
                document.body.classList.remove('sidebar-closed');
            }
        }
    }

    // Initialize
    initVisualizer();
    checkMobileState();
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
            safeLocalStorageSetItem('geminiApiKey', geminiApiKey);
            safeLocalStorageSetItem('elevenlabsApiKey', elevenlabsApiKey);
            
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
            updateStatus('Loading voices...', 'generating', -1);
            const response = await fetch(`/.netlify/functions/elevenlabs-voices?api_key=${elevenlabsApiKey}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `ElevenLabs API error (${response.status})`);
            }
            
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
                
                updateStatus(`${data.voices.length} voices loaded`);
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
            updateStatus(`ElevenLabs error: ${error.message}`, 'error', 5000);
        }
    }

    // Update status message
    function updateStatus(message, type = '', duration = 3000) {
        const statusText = statusElement.querySelector('.status-text');
        statusText.textContent = message;
        
        // Clear previous status classes
        statusElement.classList.remove('generating', 'speaking', 'error');
        
        // Add appropriate class based on type
        if (type) {
            statusElement.classList.add(type);
        }
        
        // Only auto-reset the status if duration is positive and not a persistent state
        if (duration > 0 && type !== 'generating' && type !== 'speaking') {
            setTimeout(() => {
                statusElement.classList.remove('generating', 'speaking', 'error');
                statusText.textContent = isRecording ? 'Recording...' : 'Ready';
            }, duration);
        }
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
        if (!analyser && !isVisualizerActive) return;
        
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
            updateStatus('Recording...', '', -1);
            
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
            
            // Add LLM message to chat - this creates the timestamp
            const messageElement = addMessage('assistant', llmResponse);
            
            // Get the timestamp that was just created - safely
            let messageTimestamp;
            const replayButton = messageElement && messageElement.querySelector ? messageElement.querySelector('.audio-replay-btn') : null;
            if (replayButton) {
                messageTimestamp = replayButton.dataset.timestamp;
            } else {
                messageTimestamp = new Date().toISOString(); // Fallback to current time if button not found
            }
            
            // Add to chat history
            const lastIndex = chatHistory.length - 1;
            if (lastIndex >= 0 && chatHistory[lastIndex].role === 'assistant') {
                // Store the timestamp for audio caching
                const currentTimestamp = chatHistory[lastIndex].timestamp;
                
                // Speak the response - pass the timestamp for proper audio caching
                await speakResponse(llmResponse, currentTimestamp);
            } else {
                console.error('Could not find assistant message in chat history');
                await speakResponse(llmResponse, messageTimestamp);
            }
            
            updateStatus('Ready');
        } catch (error) {
            console.error('Error getting LLM response:', error);
            updateStatus('Error: ' + error.message);
            
            // Fallback response in case of error
            const fallbackResponse = "I'm sorry, I couldn't process your request. Please try again.";
            const messageElement = addMessage('assistant', fallbackResponse);
            
            // Safely get the timestamp
            let messageTimestamp;
            const replayButton = messageElement && messageElement.querySelector ? messageElement.querySelector('.audio-replay-btn') : null;
            if (replayButton) {
                messageTimestamp = replayButton.dataset.timestamp;
            } else {
                messageTimestamp = new Date().toISOString(); // Fallback to current time if button not found
            }
            
            await speakResponse(fallbackResponse, messageTimestamp);
        }
    }

    // Speak response using ElevenLabs
    async function speakResponse(text, timestamp) {
        try {
            // Show generating status (persistent until changed)
            updateStatus('Generating audio...', 'generating', -1);
            
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
            
            // If request failed with non-200 status
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `ElevenLabs API error (${response.status})`);
            }
            
            const data = await response.json();
            console.log('TTS response data:', data);
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            if (!data.audio) {
                throw new Error('No audio data returned from ElevenLabs');
            }
            
            // Cache the audio with timestamp
            if (timestamp) {
                audioCache[timestamp] = data.audio;
                safeLocalStorageSetItem('audioCache', JSON.stringify(audioCache));
                trimCache(); // Trim cache if needed
            } else {
                console.error('Could not find timestamp for the last assistant message');
            }
            
            // Change status to speaking
            updateStatus('Speaking...', 'speaking', -1);
            
            // Play the audio
            audio = new Audio(data.audio);
            audio.volume = audioVolume;
            
            // Setup audio context for visualization
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                
                const track = audioContext.createMediaElementSource(audio);
                track.connect(analyser);
                analyser.connect(audioContext.destination);
                
                // Start visualizer
                isVisualizerActive = true;
                drawVisualizer();
            } catch (e) {
                console.error('Error setting up audio visualization:', e);
            }
            
            // Setup audio events
            audio.addEventListener('play', () => {
                console.log('Audio started playing');
            });
            
            audio.addEventListener('error', (e) => {
                console.error('Audio playback error:', e);
                updateStatus('Audio playback error', 'error');
                isVisualizerActive = false;
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                }
            });
            
            audio.addEventListener('ended', () => {
                console.log('Audio playback complete');
                updateStatus('Ready');
                isVisualizerActive = false;
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                }
            });
            
            // Start playback
            audio.play().catch(error => {
                console.error('Audio play error:', error);
                updateStatus('Audio playback failed', 'error');
                isVisualizerActive = false;
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                }
            });
            
        } catch (error) {
            console.error('Error speaking response:', error);
            updateStatus(`ElevenLabs error: ${error.message}`, 'error', 5000);
        }
    }

    // Add message to chat
    function addMessage(role, content, timestamp = null) {
        const currentTime = timestamp || new Date().toISOString();
        
        // Create message object
        const messageObj = {
            role: role,
            content: content,
            timestamp: currentTime
        };
        
        // Add to UI
        addMessageToUI(messageObj);
        
        // Save to chat history (only if it's a new message)
        if (!timestamp) {
            chatHistory.push(messageObj);
            safeLocalStorageSetItem('chatHistory', JSON.stringify(chatHistory));
            
            // Trim cache if needed
            trimCache();
        }
        
        // Ensure smooth scrolling, especially on mobile
        setTimeout(scrollToBottom, 50);
        
        return messageObj;
    }

    // Update last user message
    function updateLastUserMessage(content) {
        const userMessages = document.querySelectorAll('.message.user');
        if (userMessages.length > 0) {
            const lastUserMessage = userMessages[userMessages.length - 1];
            const paragraph = lastUserMessage.querySelector('p');
            paragraph.textContent = content;
            
            // Update in chat history
            if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user') {
                chatHistory[chatHistory.length - 1].content = content;
                safeLocalStorageSetItem('chatHistory', JSON.stringify(chatHistory));
            }
            
            setTimeout(scrollToBottom, 50);
        }
    }

    // Replay audio from cache
    async function replayAudio(timestamp) {
        try {
            // Check if audio exists in cache
            if (audioCache[timestamp]) {
                playAudioFromCache(timestamp);
                return;
            }
            
            // If not in cache, show error
            updateStatus('Audio not available', 'error', 3000);
            
        } catch (error) {
            console.error('Error playing audio:', error);
            updateStatus(`Audio playback error: ${error.message}`, 'error', 5000);
        }
    }

    // Play audio from cache
    function playAudioFromCache(timestamp) {
        // Stop any currently playing audio
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
        
        // Update status to speaking
        updateStatus('Speaking...', 'speaking', -1);
        
        // Create and play audio
        audio = new Audio(audioCache[timestamp]);
        audio.volume = audioVolume;
        
        // Setup audio context for visualization
        try {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            
            const track = audioContext.createMediaElementSource(audio);
            track.connect(analyser);
            analyser.connect(audioContext.destination);
            
            // Start visualizer
            isVisualizerActive = true;
            drawVisualizer();
        } catch (e) {
            console.error('Error setting up audio visualization:', e);
        }
        
        // Setup audio events
        audio.addEventListener('play', () => {
            console.log('Audio started playing');
        });
        
        audio.addEventListener('error', (e) => {
            console.error('Audio playback error:', e);
            updateStatus('Audio playback error', 'error');
            isVisualizerActive = false;
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        });
        
        audio.addEventListener('ended', () => {
            console.log('Audio playback complete');
            updateStatus('Ready');
            isVisualizerActive = false;
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        });
        
        // Start playback
        audio.play().catch(error => {
            console.error('Audio play error:', error);
            updateStatus('Audio playback failed', 'error');
            isVisualizerActive = false;
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        });
    }

    // Toggle recording
    recordButton.addEventListener('click', () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    // Safely store data in localStorage
    function safeLocalStorageSetItem(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            console.error('Error storing data in localStorage:', e);
            
            // If quota exceeded error, try to clear some space
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                // Force trim cache more aggressively
                MAX_AUDIO_CACHE_SIZE = Math.floor(MAX_AUDIO_CACHE_SIZE / 2);
                trimCache();
                
                try {
                    // Try again
                    localStorage.setItem(key, value);
                    return true;
                } catch (e2) {
                    console.error('Failed to store data even after trimming cache:', e2);
                    updateStatus('Storage limit reached. Some data may be lost.', 'error', 5000);
                    return false;
                }
            }
            
            updateStatus('Error saving data', 'error', 5000);
            return false;
        }
    }
}); 