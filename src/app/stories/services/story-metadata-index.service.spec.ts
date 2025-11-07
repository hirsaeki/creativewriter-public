import { TestBed } from '@angular/core/testing';
import { StoryMetadataIndexService } from './story-metadata-index.service';
import { DatabaseService } from '../../core/services/database.service';
import { StoryStatsService } from './story-stats.service';

describe('StoryMetadataIndexService', () => {
  let service: StoryMetadataIndexService;
  let mockDatabaseService: jasmine.SpyObj<DatabaseService>;
  let mockStoryStatsService: jasmine.SpyObj<StoryStatsService>;

  beforeEach(() => {
    // Create mock database
    const mockDb = jasmine.createSpyObj('PouchDB.Database', ['get', 'put', 'allDocs']);

    // Create mock services
    mockDatabaseService = jasmine.createSpyObj('DatabaseService', ['getDatabase']);
    mockDatabaseService.getDatabase.and.returnValue(Promise.resolve(mockDb));

    mockStoryStatsService = jasmine.createSpyObj('StoryStatsService', ['calculateTotalStoryWordCount']);
    mockStoryStatsService.calculateTotalStoryWordCount.and.returnValue(1000);

    TestBed.configureTestingModule({
      providers: [
        StoryMetadataIndexService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: StoryStatsService, useValue: mockStoryStatsService }
      ]
    });

    service = TestBed.inject(StoryMetadataIndexService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // Additional tests will be added in future phases
});
