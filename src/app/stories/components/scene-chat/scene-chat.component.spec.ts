import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { SceneChatComponent } from './scene-chat.component';
import { ActivatedRoute, Router } from '@angular/router';
import { StoryService } from '../../services/story.service';
import { SettingsService } from '../../../core/services/settings.service';
import { BeatAIService } from '../../../shared/services/beat-ai.service';
import { PromptManagerService } from '../../../shared/services/prompt-manager.service';
import { CodexService } from '../../services/codex.service';
import { AIRequestLoggerService } from '../../../core/services/ai-request-logger.service';
import { ModelService } from '../../../core/services/model.service';
import { AlertController } from '@ionic/angular';
import { ChatHistoryService } from '../../services/chat-history.service';
import { Codex, CodexCategory, CodexEntry, StoryRole } from '../../models/codex.interface';
import { Story } from '../../models/story.interface';

describe('SceneChatComponent', () => {
  let component: SceneChatComponent;
  let fixture: ComponentFixture<SceneChatComponent>;
  let codexService: jasmine.SpyObj<CodexService>;

  beforeEach(async () => {
    const now = new Date();
    const mockCategory: CodexCategory = {
      id: 'characters-category',
      title: 'Characters',
      description: '',
      icon: '👤',
      entries: [],
      order: 0,
      createdAt: now,
      updatedAt: now
    };

    const mockCodex: Codex = {
      id: 'codex-1',
      storyId: 'story-1',
      title: 'Codex',
      categories: [mockCategory],
      createdAt: now,
      updatedAt: now
    };

    codexService = jasmine.createSpyObj<CodexService>('CodexService', ['getOrCreateCodex', 'addEntry']);
    codexService.getOrCreateCodex.and.resolveTo(mockCodex);
    codexService.addEntry.and.resolveTo({} as CodexEntry);

    await TestBed.configureTestingModule({
      imports: [SceneChatComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({}),
            snapshot: { paramMap: convertToParamMap({}) }
          }
        },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        { provide: StoryService, useValue: {} },
        {
          provide: SettingsService,
          useValue: {
            settings$: of({}),
            getSettings: () => ({ selectedModel: '', openRouter: {}, googleGemini: {} })
          }
        },
        { provide: BeatAIService, useValue: {} },
        { provide: PromptManagerService, useValue: {} },
        { provide: CodexService, useValue: codexService },
        { provide: AIRequestLoggerService, useValue: {} },
        { provide: ModelService, useValue: { getCombinedModels: () => of([]) } },
        {
          provide: AlertController,
          useValue: {
            create: () => Promise.resolve({ present: () => Promise.resolve() })
          }
        },
        { provide: ChatHistoryService, useValue: {} }
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(SceneChatComponent);
    component = fixture.componentInstance;
  });

  it('maps parsed fields to codex metadata for characters', async () => {
    component.story = {
      id: 'story-1',
      title: 'Test Story',
      chapters: [],
      createdAt: new Date(),
      updatedAt: new Date()
    } as Story;

    component.codexReviewExtractionType = 'characters';
    component.codexReviewEntries = [
      {
        name: 'Ayla',
        description: 'Central figure description',
        role: 'Protagonist',
        tags: ['Hero'],
        fields: {
          Description: 'Central figure description',
          'Physical Appearance': 'Tall and agile',
          Personality: 'Curious and brave',
          'History with Protagonist': 'Childhood friend of the main hero',
          'Motivations & Goals': 'Retrieve the ancient relic',
          'Plot Hooks': 'Owes a favor to the Shadow Court'
        },
        selected: true
      }
    ];

    await component.confirmCodexReviewAdd();

    expect(codexService.addEntry).toHaveBeenCalledTimes(1);
    const [, categoryId, payload] = codexService.addEntry.calls.mostRecent().args;

    expect(categoryId).toBe('characters-category');

    const entryPayload = payload as Partial<CodexEntry> & { metadata?: { customFields?: { name: string; value: string }[]; storyRole?: StoryRole } };
    expect(entryPayload.title).toBe('Ayla');
    expect(entryPayload.content).toBe('Central figure description');
    expect(entryPayload.tags).toEqual(['Hero']);

    expect(entryPayload.metadata?.storyRole).toBe('Protagonist');
    expect(entryPayload.metadata?.customFields).toEqual(jasmine.arrayContaining([
      jasmine.objectContaining({ name: 'Physical Appearance', value: 'Tall and agile' }),
      jasmine.objectContaining({ name: 'Personality', value: 'Curious and brave' }),
      jasmine.objectContaining({ name: 'History with Protagonist', value: 'Childhood friend of the main hero' }),
      jasmine.objectContaining({ name: 'Motivations & Goals', value: 'Retrieve the ancient relic' }),
      jasmine.objectContaining({ name: 'Plot Hooks', value: 'Owes a favor to the Shadow Court' })
    ]));
  });
});
