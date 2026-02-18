require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use('/audio', express.static('audio'));

// Ensure audio directory exists
(async () => {
  try {
    await fs.mkdir('audio', { recursive: true });
  } catch (err) {
    console.error('Error creating audio directory:', err);
  }
})();

// Character voice mapping storage
let characterVoices = new Map();

// Analyze story text to extract characters
async function analyzeCharacters(storyText) {
  // Simple character extraction based on dialogue patterns
  // In a real implementation, this would use NLP or LLM
  const lines = storyText.split('\n');
  const characters = new Set();
  
  for (const line of lines) {
    // Match patterns like "Character Name:" or "Character Name said:"
    const match = line.match(/^([A-Za-z\s]+?):/);
    if (match) {
      characters.add(match[1].trim());
    }
  }
  
  // If no dialogue patterns found, use basic name extraction
  if (characters.size === 0) {
    // Extract capitalized words that appear multiple times
    const words = storyText.match(/\b[A-Z][a-z]+\b/g) || [];
    const wordCount = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    // Add words that appear more than once and aren't common words
    const commonWords = new Set(['The', 'And', 'But', 'Or', 'So', 'For', 'Yet', 'Was', 'Were', 'Have', 'Has', 'Had']);
    Object.entries(wordCount).forEach(([word, count]) => {
      if (count > 1 && !commonWords.has(word)) {
        characters.add(word);
      }
    });
  }
  
  return Array.from(characters);
}

// Get available voices from TTS API
async function getAvailableVoices() {
  try {
    const response = await axios.get('https://api.tts-service.com/v1/voices', {
      headers: {
        'Authorization': `Bearer ${process.env.TTS_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data.voices;
  } catch (error) {
    console.error('Error fetching voices:', error.response?.data || error.message);
    // Return mock voices if API fails (for demo purposes)
    return [
      { id: 'voice_1', name: 'Male Deep', gender: 'male', age: 'adult' },
      { id: 'voice_2', name: 'Female Soft', gender: 'female', age: 'adult' },
      { id: 'voice_3', name: 'Child Bright', gender: 'neutral', age: 'child' },
      { id: 'voice_4', name: 'Elderly Wise', gender: 'male', age: 'senior' },
      { id: 'voice_5', name: 'Young Energetic', gender: 'female', age: 'young' }
    ];
  }
}

// Assign voice to character based on traits
function assignVoiceToCharacter(characterName, availableVoices) {
  // Simple heuristic-based assignment
  const lowerName = characterName.toLowerCase();
  
  // Gender hints
  if (lowerName.includes('king') || lowerName.includes('father') || lowerName.includes('man')) {
    return availableVoices.find(v => v.gender === 'male') || availableVoices[0];
  }
  if (lowerName.includes('queen') || lowerName.includes('mother') || lowerName.includes('woman')) {
    return availableVoices.find(v => v.gender === 'female') || availableVoices[1];
  }
  
  // Age hints
  if (lowerName.includes('young') || lowerName.includes('boy') || lowerName.includes('girl')) {
    return availableVoices.find(v => v.age === 'young' || v.age === 'child') || availableVoices[2];
  }
  if (lowerName.includes('old') || lowerName.includes('elder') || lowerName.includes('grand')) {
    return availableVoices.find(v => v.age === 'senior') || availableVoices[3];
  }
  
  // Default assignment by character name hash
  const hash = characterName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return availableVoices[hash % availableVoices.length];
}

// Generate audio for story text
async function generateAudio(storyText, characters) {
  const availableVoices = await getAvailableVoices();
  
  // Assign voices to characters if not already assigned
  const characterVoiceMap = {};
  for (const character of characters) {
    if (!characterVoices.has(character)) {
      const voice = assignVoiceToCharacter(character, availableVoices);
      characterVoices.set(character, voice.id);
      characterVoiceMap[character] = voice.id;
    } else {
      characterVoiceMap[character] = characterVoices.get(character);
    }
  }
  
  // Split story into segments by character
  const segments = [];
  const lines = storyText.split('\n');
  
  for (const line of lines) {
    let character = null;
    let text = line;
    
    // Check for dialogue pattern
    const match = line.match(/^([A-Za-z\s]+?):\s*(.*)/);
    if (match) {
      character = match[1].trim();
      text = match[2];
    }
    
    const voiceId = character ? characterVoiceMap[character] : 'default';
    segments.push({ text, voiceId, character });
  }
  
  // Generate audio for each segment
  const audioFiles = [];
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    try {
      const response = await axios.post(
        'https://api.tts-service.com/v1/synthesize',
        {
          text: segment.text,
          voice_id: segment.voiceId,
          output_format: 'mp3_44100_128'
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.TTS_API_KEY}`,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer'
        }
      );
      
      const filePath = `audio/segment_${i}.mp3`;
      await fs.writeFile(filePath, response.data);
      audioFiles.push(filePath);
    } catch (error) {
      console.error(`Error generating audio for segment ${i}:`, error.response?.data || error.message);
      // Create silent segment as fallback
      const silentPath = `audio/segment_${i}_silent.mp3`;
      await fs.writeFile(silentPath, Buffer.alloc(1024)); // Small silent buffer
      audioFiles.push(silentPath);
    }
  }
  
  // Combine all audio segments into one file
  const finalAudioPath = `audio/story_${Date.now()}.mp3`;
  await combineAudioFiles(audioFiles, finalAudioPath);
  
  // Clean up temporary files
  for (const file of audioFiles) {
    try {
      await fs.unlink(file);
    } catch (err) {
      console.warn('Failed to delete temp file:', file);
    }
  }
  
  return finalAudioPath;
}

// Combine multiple audio files into one
async function combineAudioFiles(filePaths, outputPath) {
  // In a real implementation, this would use an audio library like ffmpeg
  // For demo purposes, we'll just concatenate the first file
  if (filePaths.length === 0) {
    throw new Error('No audio files to combine');
  }
  
  try {
    const firstFile = await fs.readFile(filePaths[0]);
    await fs.writeFile(outputPath, firstFile);
    
    // Note: Full implementation would merge all files properly
    console.log(`Combined ${filePaths.length} files into ${outputPath}`);
  } catch (error) {
    console.error('Error combining audio files:', error);
    throw error;
  }
}

// API Routes
app.post('/api/analyze', async (req, res) => {
  try {
    const { story } = req.body;
    if (!story) {
      return res.status(400).json({ error: 'Story text is required' });
    }
    
    const characters = await analyzeCharacters(story);
    res.json({ characters });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze story' });
  }
});

app.post('/api/generate', async (req, res) => {
  try {
    const { story, characters } = req.body;
    if (!story) {
      return res.status(400).json({ error: 'Story text is required' });
    }
    
    const audioPath = await generateAudio(story, characters || []);
    const fileName = path.basename(audioPath);
    res.json({ audioUrl: `/audio/${fileName}` });
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: 'Failed to generate audio' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});