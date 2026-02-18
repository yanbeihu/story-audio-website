import { analyzeCharacters } from '../lib/characterAnalyzer.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
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
}