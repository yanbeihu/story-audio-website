import axios from 'axios';

const TTS_API_KEY = process.env.TTS_API_KEY;

let characterVoices = new Map();

async function getAvailableVoices() {
  try {
    const response = await axios.get('https://api.tts-service.com/v1/voices', {
      headers: {
        'Authorization': `Bearer ${TTS_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data.voices;
  } catch (error) {
    console.error('Error fetching voices:', error.response?.data || error.message);
    return [
      { id: 'voice_1', name: 'Male Deep', gender: 'male', age: 'adult' },
      { id: 'voice_2', name: 'Female Soft', gender: 'female', age: 'adult' },
      { id: 'voice_3', name: 'Child Bright', gender: 'neutral', age: 'child' },
      { id: 'voice_4', name: 'Elderly Wise', gender: 'male', age: 'senior' },
      { id: 'voice_5', name: 'Young Energetic', gender: 'female', age: 'young' }
    ];
  }
}

function assignVoiceToCharacter(characterName, availableVoices) {
  const lowerName = characterName.toLowerCase();
  
  if (lowerName.includes('king') || lowerName.includes('father') || lowerName.includes('man')) {
    return availableVoices.find(v => v.gender === 'male') || availableVoices[0];
  }
  if (lowerName.includes('queen') || lowerName.includes('mother') || lowerName.includes('woman')) {
    return availableVoices.find(v => v.gender === 'female') || availableVoices[1];
  }
  if (lowerName.includes('young') || lowerName.includes('boy') || lowerName.includes('girl')) {
    return availableVoices.find(v => v.age === 'young' || v.age === 'child') || availableVoices[2];
  }
  if (lowerName.includes('old') || lowerName.includes('elder') || lowerName.includes('grand')) {
    return availableVoices.find(v => v.age === 'senior') || availableVoices[3];
  }
  
  const hash = characterName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return availableVoices[hash % availableVoices.length];
}

export async function generateAudio(storyText, characters) {
  const availableVoices = await getAvailableVoices();
  
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
  
  const segments = [];
  const lines = storyText.split('\n');
  
  for (const line of lines) {
    let character = null;
    let text = line;
    
    const match = line.match(/^([A-Za-z\s]+?):\s*(.*)/);
    if (match) {
      character = match[1].trim();
      text = match[2];
    }
    
    const voiceId = character ? characterVoiceMap[character] : 'default';
    segments.push({ text, voiceId, character });
  }
  
  // In a real Vercel deployment, we would use Vercel Blob Storage or similar
  // For now, we'll simulate the audio generation and return a placeholder URL
  // The actual implementation would call the TTS API and store the result
  
  const audioUrl = `/api/audio/${Date.now()}.mp3`;
  return audioUrl;
}