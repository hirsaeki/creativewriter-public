import { Injectable, inject } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
import { StoryService } from '../../stories/services/story.service';
import { CodexService } from '../../stories/services/codex.service';
import { Story, Chapter, Scene } from '../../stories/models/story.interface';
import { CodexEntry, StoryRole, CustomField } from '../../stories/models/codex.interface';

export interface TestStoryResult {
  story: Story;
  title: string;
}

interface BeatContent {
  prompt: string;
  content: string;
}

@Injectable({
  providedIn: 'root'
})
export class TestStoryGeneratorService {
  private readonly storyService = inject(StoryService);
  private readonly codexService = inject(CodexService);

  /**
   * Creates a complete test story with chapters, scenes, beats, and codex entries
   */
  async createTestStory(): Promise<TestStoryResult> {
    // 1. Create story with default settings
    const story = await this.storyService.createStory('en', 'third-person-limited', 'past');
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // 2. Build complete story structure in memory
    story.title = `Test Story - ${timestamp}`;

    // Build Chapter 1 with 3 scenes
    const chapter1: Chapter = {
      id: uuidv4(),
      title: 'The Beginning',
      order: 1,
      chapterNumber: 1,
      scenes: [
        this.createScene(1, 'Opening Scene', [
          {
            prompt: 'Elena arrives at Ravenwood Manor at dusk',
            content: 'The gravel crunched beneath Elena\'s boots as she approached the imposing Victorian mansion. Its dark silhouette against the twilight sky sent a chill down her spine, but she pressed forward. Her brother had last been seen here, and she would find answers.'
          },
          {
            prompt: 'She notices something strange about the windows',
            content: 'As she drew closer, Elena noticed the peculiar arrangement of lights in the upper windows. They flickered in an almost rhythmic pattern, as if signaling to someone—or something—in the encroaching darkness of the Whispering Forest behind her.'
          }
        ]),
        this.createScene(2, 'First Encounter', [
          {
            prompt: 'Elena meets Marcus Vale for the first time',
            content: 'The door swung open before she could knock, revealing a man in his mid-forties with silver-streaked hair and eyes that seemed to analyze her every movement. "Miss Blackwood, I presume," he said, his smile not quite reaching those calculating eyes. "We\'ve been expecting you."'
          }
        ]),
        this.createScene(3, 'Rising Tension', [
          {
            prompt: 'Elena explores the manor library',
            content: 'The library was vast, its walls lined with ancient tomes that smelled of dust and secrets. Elena\'s fingers traced the spines, searching for any clue about her brother\'s disappearance. A leather-bound journal caught her eye—its cover bore the same symbol she\'d found in David\'s apartment.'
          },
          {
            prompt: 'She discovers a hidden compartment',
            content: 'Behind a false book spine, her fingers found a small lever. With a soft click, a section of shelving swung inward, revealing a narrow passage. Cool air rushed out, carrying with it the faint scent of earth and something metallic. Blood, perhaps?'
          }
        ])
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Build Chapter 2 with 3 scenes
    const chapter2: Chapter = {
      id: uuidv4(),
      title: 'The Climax',
      order: 2,
      chapterNumber: 2,
      scenes: [
        this.createScene(1, 'The Confrontation', [
          {
            prompt: 'Elena confronts Marcus with evidence',
            content: 'The obsidian amulet pulsed with an eerie warmth as Elena stepped into Marcus\'s study. "I know what you did," she said, her voice steady despite her racing heart. "I found the map. I found the tunnels. And I found what you\'ve been hiding down there."'
          },
          {
            prompt: 'Marcus reveals his true nature',
            content: 'Marcus\'s facade crumbled, replaced by something cold and ancient. "Your brother was clever too," he admitted, rising from his chair. "Too clever for his own good. Just like you, it seems. But unlike him, you still have a choice, Miss Blackwood."'
          }
        ]),
        this.createScene(2, 'The Resolution', [
          {
            prompt: 'Dr. Sarah Chen arrives with reinforcements',
            content: 'Glass shattered as Sarah burst through the study window, followed by a tactical team. "Elena! Get down!" The next few seconds were a blur of shouting, the crack of gunfire, and Marcus\'s inhuman shriek as the amulet was torn from his grasp.'
          }
        ]),
        this.createScene(3, 'Epilogue', [
          {
            prompt: 'Elena finds her brother and reflects on the experience',
            content: 'David was thin, pale, but alive. As Elena held him in the ambulance, the first rays of dawn breaking over the Whispering Forest, she knew this was only the beginning. The amulet had been destroyed, but Marcus had spoken of others. Other artifacts. Other seekers. Her investigation had just begun.'
          }
        ])
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Replace chapters array
    story.chapters = [chapter1, chapter2];
    story.updatedAt = new Date();

    // 3. Save the complete story
    await this.storyService.updateStory(story);

    // 4. Create codex entries
    await this.createCodexEntries(story.id);

    // 5. Return the final story
    const finalStory = await this.storyService.getStory(story.id);

    return {
      story: finalStory || story,
      title: story.title
    };
  }

  private createScene(sceneNumber: number, title: string, beats: BeatContent[]): Scene {
    return {
      id: uuidv4(),
      title,
      content: this.createSceneContentWithBeats(beats),
      order: sceneNumber,
      sceneNumber,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private async createCodexEntries(storyId: string): Promise<void> {
    const codex = await this.codexService.getOrCreateCodex(storyId);

    // Find category IDs
    const charactersCategory = codex.categories.find(c => c.title === 'Characters');
    const locationsCategory = codex.categories.find(c => c.title === 'Locations');
    const objectsCategory = codex.categories.find(c => c.title === 'Objects');
    const notesCategory = codex.categories.find(c => c.title === 'Notes');

    // Add character entries
    if (charactersCategory) {
      await this.codexService.addEntry(storyId, charactersCategory.id, this.createCodexEntry(
        'Elena Blackwood',
        'A determined private investigator in her early thirties with sharp intuition and an unwavering resolve. After her younger brother David disappeared while investigating Ravenwood Manor, she took on the case herself, driven by both professional duty and personal desperation.',
        'Protagonist',
        true,
        [
          { id: uuidv4(), name: 'Age', value: '32' },
          { id: uuidv4(), name: 'Occupation', value: 'Private Investigator' },
          { id: uuidv4(), name: 'Motivation', value: 'Find her missing brother David' }
        ]
      ));

      await this.codexService.addEntry(storyId, charactersCategory.id, this.createCodexEntry(
        'Marcus Vale',
        'A charming but ruthless businessman who has owned Ravenwood Manor for decades. Behind his sophisticated facade lies something ancient and malevolent, connected to artifacts of immense power.',
        'Antagonist',
        false,
        [
          { id: uuidv4(), name: 'Age', value: '45 (appears)' },
          { id: uuidv4(), name: 'Weakness', value: 'Overconfidence in his perceived immortality' },
          { id: uuidv4(), name: 'Secret', value: 'Knows the truth about the disappearances spanning centuries' }
        ]
      ));

      await this.codexService.addEntry(storyId, charactersCategory.id, this.createCodexEntry(
        'Dr. Sarah Chen',
        'Elena\'s trusted friend and former college roommate, now a forensic psychologist working with law enforcement. Her expertise in criminal psychology and access to official resources make her an invaluable ally.',
        'Supporting Character',
        false,
        [
          { id: uuidv4(), name: 'Specialty', value: 'Forensic Psychology' },
          { id: uuidv4(), name: 'Relationship', value: 'College roommate and best friend of Elena' }
        ]
      ));
    }

    // Add location entries
    if (locationsCategory) {
      await this.codexService.addEntry(storyId, locationsCategory.id, this.createCodexEntry(
        'Ravenwood Manor',
        'An imposing Victorian mansion perched on a cliff overlooking the sea. Built in 1887 by the enigmatic Cornelius Ravenwood, it has passed through many hands—all of whom met mysterious ends. The manor is a labyrinth of secret passages, hidden rooms, and dark history.',
        undefined,
        false,
        [
          { id: uuidv4(), name: 'Era Built', value: '1887' },
          { id: uuidv4(), name: 'Atmosphere', value: 'Gothic, foreboding, with an ever-present sense of being watched' },
          { id: uuidv4(), name: 'Secret Passage', value: 'Behind the library fireplace, leading to underground tunnels' }
        ]
      ));

      await this.codexService.addEntry(storyId, locationsCategory.id, this.createCodexEntry(
        'The Whispering Forest',
        'Ancient woods surrounding Ravenwood Manor on three sides. Local legends speak of travelers who entered and never returned, their voices sometimes heard on moonless nights, whispering warnings to stay away.',
        undefined,
        false,
        [
          { id: uuidv4(), name: 'Size', value: 'Approximately 200 acres' },
          { id: uuidv4(), name: 'Known Dangers', value: 'Disorienting paths that seem to shift, strange sounds at night, areas of unnatural cold' }
        ]
      ));
    }

    // Add object entries
    if (objectsCategory) {
      await this.codexService.addEntry(storyId, objectsCategory.id, this.createCodexEntry(
        'The Obsidian Amulet',
        'A black gemstone pendant that seems to absorb light rather than reflect it. Ancient symbols are etched into its surface, pulsing with an inner warmth when near sources of hidden truth. It was found around Marcus Vale\'s neck.',
        undefined,
        false,
        [
          { id: uuidv4(), name: 'Origin', value: 'Unknown, possibly Egyptian or Mesopotamian' },
          { id: uuidv4(), name: 'Power', value: 'Said to reveal hidden truths and grant unnatural longevity' },
          { id: uuidv4(), name: 'Current Location', value: 'Destroyed during the final confrontation' }
        ]
      ));

      await this.codexService.addEntry(storyId, objectsCategory.id, this.createCodexEntry(
        'Ancient Map',
        'A yellowed parchment discovered in the library\'s hidden compartment. It details a network of underground tunnels beneath Ravenwood Manor, some extending far into the Whispering Forest. Certain chambers are marked with the same symbol found on the amulet.',
        undefined,
        false,
        [
          { id: uuidv4(), name: 'Age', value: '150+ years old' },
          { id: uuidv4(), name: 'Material', value: 'Vellum, remarkably well-preserved' },
          { id: uuidv4(), name: 'What It Shows', value: 'Underground tunnels, ritual chambers, and a central vault' }
        ]
      ));
    }

    // Add notes entry
    if (notesCategory) {
      await this.codexService.addEntry(storyId, notesCategory.id, this.createCodexEntry(
        'World Rules',
        'Key rules governing the supernatural elements in this story. Magic is subtle and tied to ancient artifacts. The modern world is mostly unaware of these forces, with only a few individuals—like Marcus—having discovered and exploited them.',
        undefined,
        false,
        [
          { id: uuidv4(), name: 'Magic System', value: 'Subtle, artifact-based. No flashy spells, but genuine power over life, death, and truth.' },
          { id: uuidv4(), name: 'Time Period', value: 'Present day, with deep roots in Victorian-era occultism' }
        ]
      ));
    }
  }

  private createSceneContentWithBeats(beats: BeatContent[]): string {
    let html = '';
    beats.forEach((beat, index) => {
      if (index > 0) {
        html += '<p></p>'; // Add paragraph spacing between beats
      }
      // Add story text as regular paragraphs (visible content)
      html += `<p>${this.escapeHtml(beat.content)}</p>`;
      // Add a beat input node for testing (prompt only, no generated content yet)
      const beatId = `beat-${uuidv4()}`;
      html += `<div class="beat-ai-node" data-beat-id="${beatId}" data-prompt="${this.escapeHtml(beat.prompt)}" data-word-count="150" data-collapsed="false"></div>`;
    });
    return html;
  }

  private createCodexEntry(
    title: string,
    content: string,
    storyRole: StoryRole | undefined,
    alwaysInclude: boolean,
    customFields: CustomField[]
  ): Partial<CodexEntry> {
    return {
      title,
      content,
      storyRole: storyRole || '',
      alwaysInclude,
      tags: [],
      metadata: {
        customFields
      }
    };
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
