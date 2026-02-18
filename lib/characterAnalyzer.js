export async function analyzeCharacters(storyText) {
  const lines = storyText.split('\n');
  const characters = new Set();
  
  for (const line of lines) {
    const match = line.match(/^([A-Za-z\s]+?):/);
    if (match) {
      characters.add(match[1].trim());
    }
  }
  
  if (characters.size === 0) {
    const words = storyText.match(/\b[A-Z][a-z]+\b/g) || [];
    const wordCount = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    const commonWords = new Set(['The', 'And', 'But', 'Or', 'So', 'For', 'Yet', 'Was', 'Were', 'Have', 'Has', 'Had']);
    Object.entries(wordCount).forEach(([word, count]) => {
      if (count > 1 && !commonWords.has(word)) {
        characters.add(word);
      }
    });
  }
  
  return Array.from(characters);
}