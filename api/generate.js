import { generateAudio } from '../lib/audioGenerator.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { story, characters } = req.body;
    if (!story) {
      return res.status(400).json({ error: 'Story text is required' });
    }
    
    const audioUrl = await generateAudio(story, characters || []);
    res.json({ audioUrl });
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: 'Failed to generate audio' });
  }
}