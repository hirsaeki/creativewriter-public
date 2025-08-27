import { StoryLanguage } from '../components/language-selection-dialog.component';

// Cache for loaded system messages
const systemMessageCache = new Map<StoryLanguage, string>();

export async function getSystemMessage(language: StoryLanguage = 'en'): Promise<string> {
  // Check cache first
  if (systemMessageCache.has(language)) {
    return systemMessageCache.get(language)!;
  }

  try {
    const response = await fetch(`assets/templates/system-message-${language}.txt`);
    if (response.ok) {
      const message = await response.text();
      systemMessageCache.set(language, message.trim());
      return message.trim();
    }
  } catch (error) {
    console.warn(`Failed to load system message for language ${language}:`, error);
  }

  // Fallback to English
  if (language !== 'en') {
    return getSystemMessage('en');
  }
  
  // Hard fallback
  return 'You are a creative writing assistant that helps with writing stories. Maintain the style and tone of the existing story.';
}

// Cache for loaded beat generation templates
const beatTemplateCache = new Map<StoryLanguage, string>();

export async function getBeatGenerationTemplate(language: StoryLanguage = 'en'): Promise<string> {
  // Check cache first
  if (beatTemplateCache.has(language)) {
    return beatTemplateCache.get(language)!;
  }

  try {
    const response = await fetch(`assets/templates/beat-generation-${language}.template`);
    if (response.ok) {
      const template = await response.text();
      beatTemplateCache.set(language, template.trim());
      return template.trim();
    }
  } catch (error) {
    console.warn(`Failed to load beat generation template for language ${language}:`, error);
  }

  // Fallback to English
  if (language !== 'en') {
    return getBeatGenerationTemplate('en');
  }
  
  // Hard fallback
  return `<messages>
<message role="system">{systemMessage}</message>
<message role="user">You are continuing a story. Here is the context:

<story_title>{storyTitle}</story_title>

<glossary>
{codexEntries}
</glossary>

<story_context>
{storySoFar}
</story_context>

<current_scene>
{sceneFullText}
</current_scene>

<instructions>
{pointOfView}
Write approximately {wordCount} words that continue this story.
{writingStyle}

Task: {prompt}
</instructions>

Continue the story now with {wordCount} words:</message>
</messages>`;
}