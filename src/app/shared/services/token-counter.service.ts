import { Injectable } from '@angular/core';

export interface TokenCountResult {
  tokens: number;
  model: string;
  method: 'improved_estimation' | 'estimation';
}

export type SupportedModel =
  | 'claude-3.5-sonnet'
  | 'claude-3.7-sonnet'
  | 'claude-sonnet-4'
  | 'claude-sonnet-4-5'
  | 'gemini-1.5-pro'
  | 'gemini-2.5-pro'
  | 'gemini-2.5-flash'
  | 'grok-3'
  | 'custom';

@Injectable({
  providedIn: 'root'
})
export class TokenCounterService {
  
  private readonly CHARS_PER_TOKEN_ESTIMATES: Record<SupportedModel, number> = {
    'claude-3.5-sonnet': 3.5,
    'claude-3.7-sonnet': 3.5,
    'claude-sonnet-4': 3.5,
    'claude-sonnet-4-5': 3.5,
    'gemini-1.5-pro': 4.0,
    'gemini-2.5-pro': 4.0,
    'gemini-2.5-flash': 4.0,
    'grok-3': 3.8,
    'custom': 4.0
  };

  async countTokens(prompt: string, model: SupportedModel = 'claude-3.7-sonnet'): Promise<TokenCountResult> {
    const cleanedPrompt = this.preprocessText(prompt);
    
    // Try to use improved estimation for Claude models
    if (this.isClaudeModel(model)) {
      try {
        const tokens = await this.countTokensWithImprovedEstimation(cleanedPrompt);
        return {
          tokens,
          model,
          method: 'improved_estimation'
        };
      } catch (error) {
        console.warn('Failed to use improved estimation, falling back to basic estimation:', error);
      }
    }
    
    // Fallback to estimation for non-Claude models or when improved estimation fails
    const tokens = this.estimateTokens(cleanedPrompt, model);
    
    return {
      tokens,
      model,
      method: 'estimation'
    };
  }

  // Synchronous version for backward compatibility
  countTokensSync(prompt: string, model: SupportedModel = 'claude-3.7-sonnet'): TokenCountResult {
    const cleanedPrompt = this.preprocessText(prompt);
    const tokens = this.estimateTokens(cleanedPrompt, model);
    
    return {
      tokens,
      model,
      method: 'estimation'
    };
  }

  private preprocessText(text: string): string {
    // Remove excessive whitespace while preserving structure
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, '    ')
      .trim();
  }

  private estimateTokens(text: string, model: SupportedModel): number {
    const charsPerToken = this.CHARS_PER_TOKEN_ESTIMATES[model];
    const baseTokens = Math.ceil(text.length / charsPerToken);
    
    // Add special token considerations
    const specialTokensCount = this.countSpecialTokens(text);
    
    return baseTokens + specialTokensCount;
  }

  private countSpecialTokens(text: string): number {
    let count = 0;
    
    // Count newlines (often tokenized separately)
    count += (text.match(/\n/g) || []).length;
    
    // Count punctuation clusters
    count += (text.match(/[.!?]{2,}/g) || []).length;
    
    // Count code blocks (triple backticks)
    count += (text.match(/```/g) || []).length * 2;
    
    // Count special characters that often create separate tokens
    count += (text.match(/[<>{}[\]()]/g) || []).length * 0.5;
    
    return Math.ceil(count);
  }

  private async countTokensWithImprovedEstimation(prompt: string): Promise<number> {
    // Improved estimation algorithm based on Claude tokenization patterns
    const tokens = this.getImprovedClaudeTokenCount(prompt);
    return tokens;
  }

  private getImprovedClaudeTokenCount(text: string): number {
    // More accurate estimation based on Claude tokenization research
    // This algorithm accounts for:
    // - Subword tokenization patterns
    // - Special handling of punctuation
    // - Unicode and multi-byte character handling
    // - Common word boundaries and patterns
    
    let tokenCount = 0;
    
    // Split text into segments for more accurate counting
    const segments = this.segmentTextForTokenization(text);
    
    for (const segment of segments) {
      if (segment.type === 'word') {
        tokenCount += this.estimateWordTokens(segment.content);
      } else if (segment.type === 'punctuation') {
        tokenCount += this.estimatePunctuationTokens(segment.content);
      } else if (segment.type === 'whitespace') {
        // Whitespace is usually not tokenized separately in Claude
        continue;
      } else if (segment.type === 'special') {
        tokenCount += segment.content.length; // Special chars often = 1 token each
      }
    }
    
    return Math.max(1, tokenCount); // Minimum 1 token
  }

  private segmentTextForTokenization(text: string): {type: string, content: string}[] {
    const segments: {type: string, content: string}[] = [];
    let currentSegment = '';
    let currentType = '';
    
    for (const char of text) {
      let charType = '';
      
      if (/\s/.test(char)) {
        charType = 'whitespace';
      } else if (/[a-zA-Z0-9]/.test(char)) {
        charType = 'word';
      } else if (/[.!?,:;"'()[\]{}]/.test(char)) {
        charType = 'punctuation';
      } else {
        charType = 'special';
      }
      
      if (charType !== currentType) {
        if (currentSegment) {
          segments.push({type: currentType, content: currentSegment});
        }
        currentSegment = char;
        currentType = charType;
      } else {
        currentSegment += char;
      }
    }
    
    if (currentSegment) {
      segments.push({type: currentType, content: currentSegment});
    }
    
    return segments;
  }

  private estimateWordTokens(word: string): number {
    // Subword tokenization estimation
    if (word.length <= 3) return 1;
    if (word.length <= 6) return Math.ceil(word.length / 4.5);
    if (word.length <= 10) return Math.ceil(word.length / 4.2);
    return Math.ceil(word.length / 3.8);
  }
  
  private estimatePunctuationTokens(punct: string): number {
    // Most punctuation is 1 token, but some combinations might be more
    return Math.max(1, Math.ceil(punct.length * 0.8));
  }

  private isClaudeModel(model: SupportedModel): boolean {
    return model.startsWith('claude');
  }

  // Advanced estimation with word-based approach
  estimateTokensAdvanced(prompt: string, model: SupportedModel = 'claude-3.7-sonnet'): TokenCountResult {
    const words = prompt.split(/\s+/).filter(word => word.length > 0);
    const avgTokensPerWord = model.startsWith('claude') ? 1.3 : model.startsWith('gemini') ? 1.2 : 1.4;
    
    const wordBasedTokens = Math.ceil(words.length * avgTokensPerWord);
    const charBasedTokens = this.estimateTokens(prompt, model);
    
    // Use weighted average of both methods
    const tokens = Math.ceil((wordBasedTokens * 0.4) + (charBasedTokens * 0.6));
    
    return {
      tokens,
      model,
      method: 'estimation'
    };
  }

  // Async version of advanced estimation
  async estimateTokensAdvancedAsync(prompt: string, model: SupportedModel = 'claude-3.7-sonnet'): Promise<TokenCountResult> {
    if (this.isClaudeModel(model)) {
      try {
        return await this.countTokens(prompt, model);
      } catch (error) {
        console.warn('Failed to use improved tokenization, falling back to estimation:', error);
      }
    }
    
    return this.estimateTokensAdvanced(prompt, model);
  }

  // Get token limit for a model
  getModelTokenLimit(model: SupportedModel): number {
    const tokenLimits: Record<SupportedModel, number> = {
      'claude-3.5-sonnet': 200000,
      'claude-3.7-sonnet': 200000,
      'claude-sonnet-4': 200000,
      'claude-sonnet-4-5': 200000,
      'gemini-1.5-pro': 2000000,
      'gemini-2.5-pro': 1000000,
      'gemini-2.5-flash': 1048576,
      'grok-3': 131072,
      'custom': 4096
    };

    return tokenLimits[model];
  }

  // Check if prompt exceeds model limit (sync version)
  isWithinLimit(prompt: string, model: SupportedModel = 'claude-3.7-sonnet'): boolean {
    const result = this.countTokensSync(prompt, model);
    const limit = this.getModelTokenLimit(model);
    return result.tokens <= limit;
  }

  // Get percentage of limit used (sync version)
  getUsagePercentage(prompt: string, model: SupportedModel = 'claude-3.7-sonnet'): number {
    const result = this.countTokensSync(prompt, model);
    const limit = this.getModelTokenLimit(model);
    return (result.tokens / limit) * 100;
  }

  // Async versions for more accurate results
  async isWithinLimitAsync(prompt: string, model: SupportedModel = 'claude-3.7-sonnet'): Promise<boolean> {
    const result = await this.countTokens(prompt, model);
    const limit = this.getModelTokenLimit(model);
    return result.tokens <= limit;
  }

  async getUsagePercentageAsync(prompt: string, model: SupportedModel = 'claude-3.7-sonnet'): Promise<number> {
    const result = await this.countTokens(prompt, model);
    const limit = this.getModelTokenLimit(model);
    return (result.tokens / limit) * 100;
  }

  // Get output token limit for a model
  getModelOutputLimit(model: SupportedModel): number {
    const outputLimits: Record<SupportedModel, number> = {
      'claude-3.5-sonnet': 4096,
      'claude-3.7-sonnet': 128000, // With extended output API header
      'claude-sonnet-4': 64000,
      'claude-sonnet-4-5': 64000,
      'gemini-1.5-pro': 8192,
      'gemini-2.5-pro': 64000,
      'gemini-2.5-flash': 65535,
      'grok-3': 8192,
      'custom': 4096
    };

    return outputLimits[model];
  }

  // Get model information
  getModelInfo(model: SupportedModel): {
    name: string;
    contextWindow: number;
    outputLimit: number;
    provider: string;
    releaseDate: string;
  } {
    const modelInfo: Record<SupportedModel, { name: string; provider: string; releaseDate: string }> = {
      'claude-3.5-sonnet': { name: 'Claude 3.5 Sonnet', provider: 'Anthropic', releaseDate: '2024' },
      'claude-3.7-sonnet': { name: 'Claude 3.7 Sonnet', provider: 'Anthropic', releaseDate: 'February 2025' },
      'claude-sonnet-4': { name: 'Claude Sonnet 4', provider: 'Anthropic', releaseDate: 'May 2025' },
      'claude-sonnet-4-5': { name: 'Claude Sonnet 4.5', provider: 'Anthropic', releaseDate: 'September 2025' },
      'gemini-1.5-pro': { name: 'Gemini 1.5 Pro', provider: 'Google', releaseDate: '2024' },
      'gemini-2.5-pro': { name: 'Gemini 2.5 Pro', provider: 'Google', releaseDate: '2025' },
      'gemini-2.5-flash': { name: 'Gemini 2.5 Flash', provider: 'Google', releaseDate: '2025' },
      'grok-3': { name: 'Grok-3', provider: 'xAI', releaseDate: 'February 2025' },
      'custom': { name: 'Custom Model', provider: 'Unknown', releaseDate: 'Unknown' }
    };

    return {
      ...modelInfo[model],
      contextWindow: this.getModelTokenLimit(model),
      outputLimit: this.getModelOutputLimit(model)
    };
  }
}