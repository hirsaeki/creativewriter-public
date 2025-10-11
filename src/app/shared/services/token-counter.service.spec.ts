import { TestBed } from '@angular/core/testing';
import { TokenCounterService, SupportedModel } from './token-counter.service';

describe('TokenCounterService', () => {
  let service: TokenCounterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TokenCounterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('countTokens', () => {
    it('should return token count for simple text', async () => {
      const result = await service.countTokens('Hello world', 'claude-3.7-sonnet');
      expect(result.tokens).toBeGreaterThan(0);
      expect(result.model).toBe('claude-3.7-sonnet');
      expect(result.method).toBe('estimation');
    });

    it('should handle empty string', async () => {
      const result = await service.countTokens('', 'claude-3.7-sonnet');
      expect(result.tokens).toBe(0);
    });

    it('should handle long text', async () => {
      const longText = 'Lorem ipsum '.repeat(100);
      const result = await service.countTokens(longText, 'gemini-2.5-pro');
      expect(result.tokens).toBeGreaterThan(100);
    });

    it('should count special characters as additional tokens', async () => {
      const textWithSpecial = 'Hello <world> {test} [array]';
      const textWithout = 'Hello world test array';
      
      const [resultWith, resultWithout] = await Promise.all([
        service.countTokens(textWithSpecial, 'claude-3.7-sonnet'),
        service.countTokens(textWithout, 'claude-3.7-sonnet')
      ]);
      
      expect(resultWith.tokens).toBeGreaterThan(resultWithout.tokens);
    });

    it('should handle code blocks', async () => {
      const textWithCode = '```\nfunction test() {\n  return true;\n}\n```';
      const result = await service.countTokens(textWithCode, 'grok-3');
      expect(result.tokens).toBeGreaterThan(10);
    });

    it('should use different ratios for different models', async () => {
      const text = 'This is a test prompt for token counting';
      const [claudeResult, geminiResult] = await Promise.all([
        service.countTokens(text, 'claude-3.7-sonnet'),
        service.countTokens(text, 'gemini-2.5-pro')
      ]);
      
      // Different models should produce different token counts
      expect(claudeResult.tokens).not.toBe(geminiResult.tokens);
    });
  });

  describe('estimateTokensAdvanced', () => {
    it('should provide advanced estimation', async () => {
      const text = 'The quick brown fox jumps over the lazy dog';
      const result = await service.estimateTokensAdvanced(text, 'claude-3.7-sonnet');
      
      expect(result.tokens).toBeGreaterThan(0);
      expect(result.method).toBe('estimation');
    });

    it('should handle multi-line text', async () => {
      const multiLineText = `Line one
      Line two
      Line three`;
      
      const result = await service.estimateTokensAdvanced(multiLineText);
      expect(result.tokens).toBeGreaterThan(5);
    });
  });

  describe('getModelTokenLimit', () => {
    it('should return correct limits for Claude models', () => {
      expect(service.getModelTokenLimit('claude-3.5-sonnet')).toBe(200000);
      expect(service.getModelTokenLimit('claude-3.7-sonnet')).toBe(200000);
    });

    it('should return correct limits for Gemini models', () => {
      expect(service.getModelTokenLimit('gemini-1.5-pro')).toBe(2000000);
      expect(service.getModelTokenLimit('gemini-2.5-pro')).toBe(1000000);
    });

    it('should return correct limit for Grok-3', () => {
      expect(service.getModelTokenLimit('grok-3')).toBe(131072);
    });
  });

  describe('isWithinLimit', () => {
    it('should return true for small prompts', () => {
      const smallPrompt = 'This is a small prompt';
      expect(service.isWithinLimit(smallPrompt, 'grok-3')).toBe(true);
    });

    it('should handle model limits correctly', () => {
      const text = 'a'.repeat(600000); // ~150k tokens
      expect(service.isWithinLimit(text, 'grok-3')).toBe(false);
      expect(service.isWithinLimit(text, 'claude-3.7-sonnet')).toBe(true);
      expect(service.isWithinLimit(text, 'gemini-2.5-pro')).toBe(true);
    });
  });

  describe('getUsagePercentage', () => {
    it('should calculate usage percentage correctly', () => {
      const text = 'Short text';
      const percentage = service.getUsagePercentage(text, 'claude-3.7-sonnet');
      
      expect(percentage).toBeGreaterThan(0);
      expect(percentage).toBeLessThan(0.01); // Should be less than 0.01% for short text with large context window
    });

    it('should return 0 for empty text', () => {
      const percentage = service.getUsagePercentage('', 'claude-3.7-sonnet');
      expect(percentage).toBe(0);
    });
  });

  describe('getModelOutputLimit', () => {
    it('should return correct output limits for all models', () => {
      expect(service.getModelOutputLimit('claude-3.5-sonnet')).toBe(4096);
      expect(service.getModelOutputLimit('claude-3.7-sonnet')).toBe(128000);
      expect(service.getModelOutputLimit('gemini-1.5-pro')).toBe(8192);
      expect(service.getModelOutputLimit('gemini-2.5-pro')).toBe(64000);
      expect(service.getModelOutputLimit('grok-3')).toBe(8192);
    });
  });

  describe('getModelInfo', () => {
    it('should return complete model information', () => {
      const info = service.getModelInfo('claude-3.7-sonnet');
      expect(info.name).toBe('Claude 3.7 Sonnet');
      expect(info.provider).toBe('Anthropic');
      expect(info.contextWindow).toBe(200000);
      expect(info.outputLimit).toBe(128000);
      expect(info.releaseDate).toBe('February 2025');
    });

    it('should return info for all supported models', () => {
      const models: SupportedModel[] = ['claude-3.5-sonnet', 'claude-3.7-sonnet', 'gemini-1.5-pro', 'gemini-2.5-pro', 'grok-3'];
      models.forEach(model => {
        const info = service.getModelInfo(model);
        expect(info.name).toBeTruthy();
        expect(info.provider).toBeTruthy();
        expect(info.contextWindow).toBeGreaterThan(0);
        expect(info.outputLimit).toBeGreaterThan(0);
      });
    });
  });
});
