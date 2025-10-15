import { ErrorHandler, Injectable, inject } from '@angular/core';
import { AIRequestLoggerService } from './ai-request-logger.service';
import { MobileDebugService } from './mobile-debug.service';

interface PromiseRejectionError {
  rejection?: {
    message?: string;
    stack?: string;
  };
  reason?: unknown;
  promise?: Promise<unknown>;
}

interface HttpError {
  error?: {
    message?: string;
    error?: {
      message?: string;
    };
  };
  status?: number;
  statusText?: string;
  url?: string;
  message?: string;
}

interface ExtendedError extends Error {
  fileName?: string;
  lineNumber?: number;
  columnNumber?: number;
}

interface GoogleApiError {
  error?: {
    error?: {
      message?: string;
    };
  };
  candidates?: {
    finishReason?: string;
    safetyRatings?: unknown[];
  }[];
  promptFeedback?: {
    blockReason?: string;
    safetyRatings?: unknown[];
  };
  url?: string;
  status?: number;
}

type ErrorWithStack = Error & { stack?: string };

@Injectable()
export class GlobalErrorHandlerService implements ErrorHandler {
  private readonly aiLogger = inject(AIRequestLoggerService);
  private readonly mobileDebug = inject(MobileDebugService);

  handleError(error: unknown): void {
    const timestamp = new Date().toISOString();
    
    // Log comprehensive error information
    console.group(`🚨 Global Error Handler - ${timestamp}`);
    console.error('Original error:', error);
    
    let errorMessage = 'Unknown global error';
    let errorContext: Record<string, unknown> = {};

    try {
      // Extract error details based on error type
      if ((error as PromiseRejectionError)?.rejection) {
        // Promise rejection
        const rejectionError = error as PromiseRejectionError;
        errorMessage = `Unhandled Promise Rejection: ${rejectionError.rejection?.message || rejectionError.rejection}`;
        errorContext = {
          type: 'promise_rejection',
          reason: rejectionError.reason,
          promise: rejectionError.promise,
          stack: rejectionError.rejection?.stack
        };
      } else if (error instanceof Error) {
        // Standard JavaScript Error
        errorMessage = `${error.name}: ${error.message}`;
        errorContext = {
          type: 'javascript_error',
          name: error.name,
          message: error.message,
          stack: error.stack,
          fileName: (error as ExtendedError).fileName,
          lineNumber: (error as ExtendedError).lineNumber,
          columnNumber: (error as ExtendedError).columnNumber
        };
      } else if ((error as HttpError)?.error) {
        // HTTP Error or wrapped error
        const httpError = error as HttpError;
        errorMessage = `HTTP/API Error: ${httpError.error?.message || httpError.message || 'Unknown'}`;
        errorContext = {
          type: 'http_error',
          status: httpError.status,
          statusText: httpError.statusText,
          url: httpError.url,
          error: httpError.error
        };
      } else if (typeof error === 'string') {
        errorMessage = `String Error: ${error}`;
        errorContext = {
          type: 'string_error',
          value: error
        };
      } else {
        // Unknown error type
        errorMessage = `Unknown Error Type: ${JSON.stringify(error).substring(0, 200)}`;
        errorContext = {
          type: 'unknown',
          value: error
        };
      }

      console.error('Processed error message:', errorMessage);
      console.error('Error context:', errorContext);

      // Log to AI logger for tracking API-related errors
      if (this.isApiRelatedError(error, errorMessage)) {
        
        // Create a synthetic log entry for global errors
        const logId = this.aiLogger.logRequest({
          endpoint: 'GLOBAL_ERROR',
          model: 'unknown',
          wordCount: 0,
          maxTokens: 0,
          prompt: `Global error: ${errorMessage}`
        });

        this.aiLogger.logError(logId, errorMessage, 0);
      }

      // Additional context logging
      console.error('Error occurred at:', timestamp);
      console.error('User agent:', navigator.userAgent);
      console.error('URL:', window.location.href);

      // Log to mobile debug service for crash tracking
      if (error instanceof Error) {
        this.mobileDebug.logCrash(error);
      } else if (typeof error === 'string') {
        this.mobileDebug.logCrash(error);
      } else {
        this.mobileDebug.logCrash(new Error(errorMessage));
      }

    } catch (processingError) {
      console.error('Error in error handler:', processingError);
      errorMessage = `Error Handler Failed: ${error}`;
    }

    console.groupEnd();

    // Don't rethrow - we want to handle it gracefully
    // In a production app, you might send this to an error reporting service
  }

  private isApiRelatedError(error: unknown, errorMessage: string): boolean {
    // Check if error is related to API calls
    const apiKeywords = ['api', 'gemini', 'openrouter', 'http', 'fetch', 'network', 'timeout', 'cors', 'content', 'filter', 'safety', 'blocked', 'harm'];
    const messageContainsApi = apiKeywords.some(keyword => 
      errorMessage.toLowerCase().includes(keyword)
    );

    const googleApiError = error as GoogleApiError;
    const hasApiContext = !!(googleApiError?.url || 
                         googleApiError?.status || 
                         googleApiError?.error?.error || // Google API error structure
                         ((error as ErrorWithStack)?.stack && (error as ErrorWithStack).stack?.includes('HttpClient')));

    // Check for content filter specific errors
    const isContentFilterError = this.isContentFilterError(error, errorMessage);

    return messageContainsApi || hasApiContext || isContentFilterError;
  }

  private isContentFilterError(error: unknown, errorMessage: string): boolean {
    // Content filter keywords
    const contentFilterKeywords = [
      'safety rating',
      'blocked',
      'content filter',
      'harm category',
      'safety threshold',
      'recitation',
      'finish_reason',
      'other',
      'safety'
    ];

    const messageContainsFilter = contentFilterKeywords.some(keyword =>
      errorMessage.toLowerCase().includes(keyword.toLowerCase())
    );

    // Check Google API response structure for safety-related blocking
    const googleError = error as GoogleApiError;
    const hasSafetyBlock = !!(googleError?.error?.error?.message?.includes('blocked') ||
                          googleError?.candidates?.[0]?.finishReason === 'SAFETY' ||
                          googleError?.candidates?.[0]?.finishReason === 'OTHER' ||
                          googleError?.promptFeedback?.blockReason);

    // Check for safety ratings that might indicate content filtering
    const hasSafetyRatings = !!(googleError?.candidates?.[0]?.safetyRatings ||
                               googleError?.promptFeedback?.safetyRatings);

    return messageContainsFilter || hasSafetyBlock || hasSafetyRatings;
  }
}