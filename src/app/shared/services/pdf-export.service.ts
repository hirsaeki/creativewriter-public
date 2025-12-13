import { Injectable, inject } from '@angular/core';
import jsPDF from 'jspdf';
import { BackgroundService } from './background.service';
import { SyncedCustomBackgroundService } from './synced-custom-background.service';
import { Story } from '../../stories/models/story.interface';
import { BehaviorSubject } from 'rxjs';

interface PDFExportOptions {
  filename?: string;
  includeBackground?: boolean;
  format?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface PDFExportProgress {
  phase: 'initializing' | 'background' | 'content' | 'finalizing';
  progress: number; // 0-100
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class PDFExportService {
  private backgroundService = inject(BackgroundService);
  private customBackgroundService = inject(SyncedCustomBackgroundService);
  private currentYPosition = 0;

  // Progress tracking
  private progressSubject = new BehaviorSubject<PDFExportProgress>({
    phase: 'initializing',
    progress: 0,
    message: 'Initializing PDF export...'
  });
  
  public progress$ = this.progressSubject.asObservable();

  private updateProgress(phase: PDFExportProgress['phase'], progress: number, message: string): void {
    this.progressSubject.next({ phase, progress, message });
  }

  async exportStoryToPDF(story: Story, options: PDFExportOptions = {}): Promise<void> {
    // Reset progress
    this.updateProgress('initializing', 0, 'Starting PDF export...');
    const defaultOptions: Required<PDFExportOptions> = {
      filename: `${story.title?.trim() || 'Untitled Story'}.pdf`,
      includeBackground: true,
      format: 'a4',
      orientation: 'portrait',
      margins: {
        top: 20,
        right: 20,
        bottom: 20,
        left: 20
      }
    };

    const config = { ...defaultOptions, ...options };

    try {
      console.log('Starting PDF export for story:', story.title);
      this.updateProgress('initializing', 10, 'Creating PDF document...');
      
      // Create PDF
      const pdf = new jsPDF({
        orientation: config.orientation,
        unit: 'mm',
        format: config.format
      });

      console.log('jsPDF instance created successfully');
      this.updateProgress('initializing', 20, 'PDF document created');

      // Get page dimensions
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      console.log('Page dimensions:', { pageWidth, pageHeight });

      // Add background if enabled
      if (config.includeBackground) {
        console.log('Adding background to PDF');
        this.updateProgress('background', 30, 'Adding background...');
        await this.addBackgroundToPDF(pdf, pageWidth, pageHeight);
        this.updateProgress('background', 40, 'Background added');
      } else {
        this.updateProgress('content', 40, 'Skipping background');
      }

      // Add text content directly to PDF
      console.log('Adding text content to PDF');
      this.updateProgress('content', 50, 'Processing story content...');
      await this.addTextContentToPDF(pdf, story, config);
      this.updateProgress('content', 90, 'Content processing complete');

      // Save the PDF
      console.log('Saving PDF with filename:', config.filename);
      this.updateProgress('finalizing', 95, 'Saving PDF file...');
      pdf.save(config.filename);
      this.updateProgress('finalizing', 100, 'PDF export completed successfully');
      console.log('PDF export completed successfully');
      
    } catch (error) {
      console.error('Error exporting story to PDF:', error);
      console.error('Error details:', error);
      
      // Try a simplified fallback approach
      try {
        console.log('Attempting fallback PDF export');
        this.updateProgress('initializing', 30, 'Trying fallback method...');
        await this.fallbackPDFExport(story, config);
      } catch (fallbackError) {
        console.error('Fallback PDF export also failed:', fallbackError);
        this.updateProgress('finalizing', 0, 'PDF export failed');
        throw new Error(`Failed to export story to PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  private async addTextContentToPDF(pdf: jsPDF, story: Story, config: Required<PDFExportOptions>): Promise<void> {
    // Set up text styling
    let currentY = config.margins.top;
    const leftMargin = config.margins.left;
    const rightMargin = config.margins.right;
    const maxWidth = pdf.internal.pageSize.getWidth() - leftMargin - rightMargin;
    const pageHeight = pdf.internal.pageSize.getHeight();
    const bottomMargin = pageHeight - config.margins.bottom;
    
    // Set font for title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(24);
    // Set text color to white if background is enabled, black otherwise
    if (config.includeBackground) {
      pdf.setTextColor(255, 255, 255); // White text
    } else {
      pdf.setTextColor(0, 0, 0); // Black text
    }
    
    // Add title
    const titleLines = pdf.splitTextToSize(story.title?.trim() || 'Untitled Story', maxWidth);
    for (const line of titleLines) {
      if (currentY > bottomMargin) {
        pdf.addPage();
        currentY = config.margins.top;
        if (config.includeBackground) {
          await this.addBackgroundToPDF(pdf, pdf.internal.pageSize.getWidth(), pageHeight);
        }
      }
      pdf.text(line, leftMargin, currentY);
      currentY += 10;
    }
    
    currentY += 10; // Extra space after title
    
    // Process chapters and scenes
    const totalChapters = story.chapters?.length || 0;
    for (let chapterIndex = 0; chapterIndex < totalChapters; chapterIndex++) {
      const chapter = story.chapters![chapterIndex];
      
      // Update progress for chapter processing
      const chapterProgress = 50 + (chapterIndex / totalChapters) * 35; // Progress from 50% to 85%
      this.updateProgress('content', Math.round(chapterProgress), `Processing chapter ${chapterIndex + 1} of ${totalChapters}...`);
      // Check if we need a new page for chapter
      if (currentY > bottomMargin - 20) {
        pdf.addPage();
        currentY = config.margins.top;
        if (config.includeBackground) {
          await this.addBackgroundToPDF(pdf, pdf.internal.pageSize.getWidth(), pageHeight);
        }
      }
      
      // Add chapter title
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      // Set text color for chapter
      if (config.includeBackground) {
        pdf.setTextColor(255, 255, 255); // White text
      } else {
        pdf.setTextColor(0, 0, 0); // Black text
      }
      const chapterLines = pdf.splitTextToSize(chapter.title, maxWidth);
      for (const line of chapterLines) {
        if (currentY > bottomMargin) {
          pdf.addPage();
          currentY = config.margins.top;
          if (config.includeBackground) {
            await this.addBackgroundToPDF(pdf, pdf.internal.pageSize.getWidth(), pageHeight);
          }
        }
        pdf.text(line, leftMargin, currentY);
        currentY += 8;
      }
      
      currentY += 5; // Space after chapter title
      
      // Process scenes
      for (const scene of chapter.scenes || []) {
        // Add scene title if exists
        if (scene.title) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(14);
          // Set text color for scene title
          if (config.includeBackground) {
            pdf.setTextColor(255, 255, 255); // White text
          } else {
            pdf.setTextColor(0, 0, 0); // Black text
          }
          const sceneLines = pdf.splitTextToSize(scene.title, maxWidth);
          for (const line of sceneLines) {
            if (currentY > bottomMargin) {
              pdf.addPage();
              currentY = config.margins.top;
              if (config.includeBackground) {
                await this.addBackgroundToPDF(pdf, pdf.internal.pageSize.getWidth(), pageHeight);
              }
            }
            pdf.text(line, leftMargin, currentY);
            currentY += 6;
          }
          currentY += 3;
        }
        
        // Add scene content
        if (scene.content) {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(12);
          // Set text color for content
          if (config.includeBackground) {
            pdf.setTextColor(255, 255, 255); // White text
          } else {
            pdf.setTextColor(0, 0, 0); // Black text
          }
          
          // Process content with images and text
          await this.addContentToPDF(pdf, scene.content, config, leftMargin, rightMargin, maxWidth, pageHeight, currentY);
          currentY = await this.getCurrentY(); // Get updated Y position
        }
      }
      
      currentY += 10; // Extra space after chapter
    }
  }
  
  private extractPlainText(htmlContent: string): string {
    // Use DOMParser for safe HTML parsing
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const tempDiv = doc.body;
    
    // Remove Beat AI components
    const beatAIElements = tempDiv.querySelectorAll('.beat-ai-wrapper, .beat-ai-container, .beat-ai-node');
    beatAIElements.forEach(element => {
      // Extract paragraphs before removing
      const paragraphs = element.querySelectorAll('p');
      paragraphs.forEach(p => {
        element.parentNode?.insertBefore(p.cloneNode(true), element);
      });
      element.remove();
    });
    
    // Extract text while preserving paragraph structure
    const paragraphs = tempDiv.querySelectorAll('p');
    const textParts: string[] = [];
    
    paragraphs.forEach(p => {
      const text = p.textContent?.trim();
      if (text) {
        textParts.push(text);
      }
    });
    
    // If no paragraphs found, fall back to plain text content
    if (textParts.length === 0) {
      return tempDiv.textContent || '';
    }
    
    return textParts.join('\n\n');
  }

  private async getCurrentY(): Promise<number> {
    return this.currentYPosition;
  }

  private async addContentToPDF(
    pdf: jsPDF,
    htmlContent: string,
    config: Required<PDFExportOptions>,
    leftMargin: number,
    _rightMargin: number,
    maxWidth: number,
    pageHeight: number,
    startY: number
  ): Promise<void> {
    this.currentYPosition = startY;

    // Use DOMParser for safe HTML parsing
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const tempDiv = doc.body;

    // Remove Beat AI components first
    const beatAIElements = tempDiv.querySelectorAll('.beat-ai-wrapper, .beat-ai-container, .beat-ai-node');
    beatAIElements.forEach(element => {
      // Extract paragraphs before removing
      const paragraphs = element.querySelectorAll('p');
      paragraphs.forEach(p => {
        element.parentNode?.insertBefore(p.cloneNode(true), element);
      });
      element.remove();
    });

    // Recursively process all nodes to handle nested structures
    await this.processNodeRecursively(tempDiv, pdf, config, leftMargin, maxWidth, pageHeight);
  }

  /**
   * Recursively process DOM nodes to extract all content at any nesting level.
   * This fixes text truncation caused by nested HTML structures.
   * @param depth - Current recursion depth (defaults to 0)
   * @param maxDepth - Maximum allowed recursion depth to prevent stack overflow (defaults to 50)
   */
  private async processNodeRecursively(
    node: Node,
    pdf: jsPDF,
    config: Required<PDFExportOptions>,
    leftMargin: number,
    maxWidth: number,
    pageHeight: number,
    depth = 0,
    maxDepth = 50
  ): Promise<void> {
    // Prevent stack overflow from deeply nested or malicious HTML
    if (depth > maxDepth) {
      console.warn('PDF export: Max recursion depth reached, skipping nested content');
      return;
    }

    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as Element;

        // Handle images
        if (element.tagName === 'IMG') {
          await this.addImageToPDF(pdf, element as HTMLImageElement, config, leftMargin, maxWidth, pageHeight);
        }
        // Handle paragraphs directly
        else if (element.tagName === 'P') {
          const text = element.textContent?.trim();
          if (text) {
            await this.addParagraphToPDF(pdf, text, config, leftMargin, maxWidth, pageHeight);
          }
        }
        // Handle headings
        else if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(element.tagName)) {
          const text = element.textContent?.trim();
          if (text) {
            await this.addParagraphToPDF(pdf, text, config, leftMargin, maxWidth, pageHeight);
          }
        }
        // Handle lists - extract list items
        else if (element.tagName === 'UL' || element.tagName === 'OL') {
          const listItems = element.querySelectorAll('li');
          for (const li of Array.from(listItems)) {
            const text = li.textContent?.trim();
            if (text) {
              const bullet = element.tagName === 'UL' ? '\u2022 ' : '';
              await this.addParagraphToPDF(pdf, bullet + text, config, leftMargin, maxWidth, pageHeight);
            }
          }
        }
        // Handle block elements - recurse into them
        else if (['DIV', 'SECTION', 'ARTICLE', 'MAIN', 'BLOCKQUOTE', 'SPAN'].includes(element.tagName)) {
          await this.processNodeRecursively(element, pdf, config, leftMargin, maxWidth, pageHeight, depth + 1, maxDepth);
        }
        // Handle inline elements and unknown elements with text
        else if (element.textContent?.trim()) {
          // Check if element has block-level children
          const hasBlockChildren = element.querySelector('p, div, section, ul, ol, h1, h2, h3, h4, h5, h6');
          if (hasBlockChildren) {
            // Recurse to handle children properly
            await this.processNodeRecursively(element, pdf, config, leftMargin, maxWidth, pageHeight, depth + 1, maxDepth);
          } else {
            // Treat as inline text
            await this.addParagraphToPDF(pdf, element.textContent.trim(), config, leftMargin, maxWidth, pageHeight);
          }
        }
      }
      // Handle text nodes
      else if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent?.trim();
        if (text) {
          await this.addParagraphToPDF(pdf, text, config, leftMargin, maxWidth, pageHeight);
        }
      }
    }
  }

  private async addImageToPDF(
    pdf: jsPDF,
    img: HTMLImageElement,
    config: Required<PDFExportOptions>,
    leftMargin: number,
    maxWidth: number,
    pageHeight: number
  ): Promise<void> {
    try {
      const bottomMargin = pageHeight - config.margins.bottom;
      
      // Load image data
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      // Create a new image element to ensure it's loaded
      const imageElement = new Image();
      imageElement.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        imageElement.onload = () => resolve();
        imageElement.onerror = () => reject(new Error('Failed to load image'));
        imageElement.src = img.src;
      });
      
      // Calculate image dimensions (max width, maintain aspect ratio)
      const aspectRatio = imageElement.naturalHeight / imageElement.naturalWidth;
      const imageWidth = Math.min(maxWidth, imageElement.naturalWidth * 0.264583); // Convert px to mm
      const imageHeight = imageWidth * aspectRatio;
      
      // Check if we need a new page
      if (this.currentYPosition + imageHeight > bottomMargin) {
        pdf.addPage();
        this.currentYPosition = config.margins.top;
        if (config.includeBackground) {
          await this.addBackgroundToPDF(pdf, pdf.internal.pageSize.getWidth(), pageHeight);
        }
      }
      
      // Draw image to canvas
      canvas.width = imageElement.naturalWidth;
      canvas.height = imageElement.naturalHeight;
      ctx.drawImage(imageElement, 0, 0);
      
      // Add image to PDF
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      pdf.addImage(imageData, 'JPEG', leftMargin, this.currentYPosition, imageWidth, imageHeight);
      
      this.currentYPosition += imageHeight + 5; // Add some spacing after image
      
    } catch (error) {
      console.warn('Failed to add image to PDF:', error);
      // Continue without the image
    }
  }

  private async addParagraphToPDF(
    pdf: jsPDF,
    text: string,
    config: Required<PDFExportOptions>,
    leftMargin: number,
    maxWidth: number,
    pageHeight: number
  ): Promise<void> {
    if (!text.trim()) return;
    
    const bottomMargin = pageHeight - config.margins.bottom;
    
    // Set text styling
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    if (config.includeBackground) {
      pdf.setTextColor(255, 255, 255); // White text
    } else {
      pdf.setTextColor(0, 0, 0); // Black text
    }
    
    const lines = pdf.splitTextToSize(text, maxWidth);
    
    for (const line of lines) {
      if (this.currentYPosition > bottomMargin) {
        pdf.addPage();
        this.currentYPosition = config.margins.top;
        if (config.includeBackground) {
          await this.addBackgroundToPDF(pdf, pdf.internal.pageSize.getWidth(), pageHeight);
        }
      }
      pdf.text(line, leftMargin, this.currentYPosition);
      this.currentYPosition += 5;
    }
    
    this.currentYPosition += 3; // Paragraph spacing
  }


  private async convertBlobToBase64(blobUrl: string): Promise<string> {
    try {
      const response = await fetch(blobUrl);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting blob to base64:', error);
      return '';
    }
  }


  private async addBackgroundToPDF(pdf: jsPDF, pdfWidth: number, pdfHeight: number): Promise<void> {
    try {
      const currentBackground = this.backgroundService.getCurrentBackground();
      
      if (currentBackground === 'none' || !currentBackground) {
        // Add dark background color if no image
        console.log('No background specified, using dark background');
        pdf.setFillColor('#1a1a1a');
        pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
        return;
      }

      console.log('Current background:', currentBackground);
      let backgroundImageData: string | null = null;

      // Handle custom backgrounds
      if (currentBackground.startsWith('custom:')) {
        console.log('Processing custom background');
        const customId = currentBackground.replace('custom:', '');
        const customBg = this.customBackgroundService.backgrounds().find(bg => bg.id === customId);
        
        if (customBg) {
          backgroundImageData = await this.convertBlobToBase64(customBg.blobUrl);
        }
      } else {
        // Handle standard backgrounds - load from assets
        console.log('Processing standard background from assets');
        backgroundImageData = await this.loadImageAsBase64(`assets/backgrounds/${currentBackground}`);
      }

      if (backgroundImageData) {
        console.log('Background image data loaded, creating canvas');
        // Create a canvas to composite the background image with overlay
        const backgroundCanvas = await this.createBackgroundCanvas(backgroundImageData, pdfWidth, pdfHeight);
        const backgroundDataUrl = backgroundCanvas.toDataURL('image/jpeg', 0.9);
        
        // Add the composited background to PDF
        console.log('Adding background image to PDF');
        pdf.addImage(backgroundDataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      } else {
        console.log('No background image data, using fallback dark background');
        // Fallback to dark background
        pdf.setFillColor('#1a1a1a');
        pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
      }
    } catch (error) {
      console.warn('Failed to add background to PDF:', error);
      // Fallback to dark background
      pdf.setFillColor('#1a1a1a');
      pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
    }
  }

  private async loadImageAsBase64(imagePath: string): Promise<string | null> {
    try {
      const response = await fetch(imagePath);
      if (!response.ok) {
        throw new Error(`Failed to load image: ${response.status}`);
      }
      
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error loading image as base64:', error);
      return null;
    }
  }

  private async createBackgroundCanvas(backgroundImageData: string, pdfWidth: number, pdfHeight: number): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      // Set canvas size (convert mm to pixels at 150 DPI for good quality)
      const dpi = 150;
      const mmToInch = 1 / 25.4;
      canvas.width = pdfWidth * mmToInch * dpi;
      canvas.height = pdfHeight * mmToInch * dpi;
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          // Fill with dark background first
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Draw background image to cover entire canvas
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Add semi-transparent dark overlay for text readability (lighter for better text visibility)
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          resolve(canvas);
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load background image'));
      };
      
      img.src = backgroundImageData;
    });
  }

  private async fallbackPDFExport(story: Story, config: Required<PDFExportOptions>): Promise<void> {
    console.log('Using fallback PDF export method');
    this.updateProgress('initializing', 40, 'Creating simplified PDF...');
    
    // Create a simple PDF without backgrounds or complex formatting
    const pdf = new jsPDF({
      orientation: config.orientation,
      unit: 'mm',
      format: config.format
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const leftMargin = config.margins.left;
    const rightMargin = config.margins.right;
    const maxWidth = pageWidth - leftMargin - rightMargin;
    let currentY = config.margins.top;
    
    this.updateProgress('content', 50, 'Adding story content...');

    // Set basic font
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0); // Black text

    // Add title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    const titleLines = pdf.splitTextToSize(story.title?.trim() || 'Untitled Story', maxWidth);
    for (const line of titleLines) {
      pdf.text(line, leftMargin, currentY);
      currentY += 8;
    }
    currentY += 10;

    // Add content
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);

    const totalChapters = story.chapters?.length || 0;
    for (let chapterIndex = 0; chapterIndex < totalChapters; chapterIndex++) {
      const chapter = story.chapters![chapterIndex];
      
      // Update progress for fallback chapter processing
      const chapterProgress = 50 + (chapterIndex / totalChapters) * 40; // Progress from 50% to 90%
      this.updateProgress('content', Math.round(chapterProgress), `Processing chapter ${chapterIndex + 1} of ${totalChapters} (simplified)...`);
      // Add chapter title
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      const chapterLines = pdf.splitTextToSize(chapter.title || 'Untitled Chapter', maxWidth);
      for (const line of chapterLines) {
        if (currentY > pdf.internal.pageSize.getHeight() - config.margins.bottom) {
          pdf.addPage();
          currentY = config.margins.top;
        }
        pdf.text(line, leftMargin, currentY);
        currentY += 7;
      }
      currentY += 5;

      // Add scenes
      for (const scene of chapter.scenes || []) {
        if (scene.title) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(14);
          const sceneLines = pdf.splitTextToSize(scene.title, maxWidth);
          for (const line of sceneLines) {
            if (currentY > pdf.internal.pageSize.getHeight() - config.margins.bottom) {
              pdf.addPage();
              currentY = config.margins.top;
            }
            pdf.text(line, leftMargin, currentY);
            currentY += 6;
          }
          currentY += 3;
        }

        if (scene.content) {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(12);
          
          // Extract plain text from HTML content
          const plainText = this.extractPlainText(scene.content);
          const contentLines = pdf.splitTextToSize(plainText, maxWidth);
          
          for (const line of contentLines) {
            if (currentY > pdf.internal.pageSize.getHeight() - config.margins.bottom) {
              pdf.addPage();
              currentY = config.margins.top;
            }
            pdf.text(line, leftMargin, currentY);
            currentY += 5;
          }
          currentY += 5;
        }
      }
      currentY += 10;
    }

    // Save the PDF
    this.updateProgress('finalizing', 95, 'Saving simplified PDF...');
    pdf.save(config.filename);
    this.updateProgress('finalizing', 100, 'Simplified PDF export completed successfully');
    console.log('Fallback PDF export completed successfully');
  }
}