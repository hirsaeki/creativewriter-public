import { Injectable, inject } from '@angular/core';
import jsPDF from 'jspdf';
import { BackgroundService } from './background.service';
import { SyncedCustomBackgroundService } from './synced-custom-background.service';
import { Story } from '../../stories/models/story.interface';

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

@Injectable({
  providedIn: 'root'
})
export class PDFExportService {
  private backgroundService = inject(BackgroundService);
  private customBackgroundService = inject(SyncedCustomBackgroundService);
  private currentYPosition = 0;

  async exportStoryToPDF(story: Story, options: PDFExportOptions = {}): Promise<void> {
    const defaultOptions: Required<PDFExportOptions> = {
      filename: `${story.title || 'Story'}.pdf`,
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
      // Create PDF
      const pdf = new jsPDF({
        orientation: config.orientation,
        unit: 'mm',
        format: config.format
      });

      // Get page dimensions
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Add background if enabled
      if (config.includeBackground) {
        await this.addBackgroundToPDF(pdf, pageWidth, pageHeight);
      }

      // Add text content directly to PDF
      await this.addTextContentToPDF(pdf, story, config);

      // Save the PDF
      pdf.save(config.filename);
      
    } catch (error) {
      console.error('Error exporting story to PDF:', error);
      throw new Error('Failed to export story to PDF');
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
    const titleLines = pdf.splitTextToSize(story.title, maxWidth);
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
    for (const chapter of story.chapters || []) {
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
    rightMargin: number,
    maxWidth: number,
    pageHeight: number,
    startY: number
  ): Promise<void> {
    this.currentYPosition = startY;
    // const bottomMargin = pageHeight - config.margins.bottom; // Unused in this function
    
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
    
    // Process all child nodes in order
    const nodes = Array.from(tempDiv.childNodes);
    
    for (const node of nodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        
        // Handle images
        if (element.tagName === 'IMG') {
          await this.addImageToPDF(pdf, element as HTMLImageElement, config, leftMargin, maxWidth, pageHeight);
        }
        // Handle paragraphs
        else if (element.tagName === 'P') {
          await this.addParagraphToPDF(pdf, element.textContent || '', config, leftMargin, maxWidth, pageHeight);
        }
        // Handle other elements with text content
        else if (element.textContent?.trim()) {
          await this.addParagraphToPDF(pdf, element.textContent, config, leftMargin, maxWidth, pageHeight);
        }
      }
      // Handle text nodes
      else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        await this.addParagraphToPDF(pdf, node.textContent, config, leftMargin, maxWidth, pageHeight);
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
    const currentBackground = this.backgroundService.getCurrentBackground();
    
    if (currentBackground === 'none' || !currentBackground) {
      // Add dark background color if no image
      pdf.setFillColor('#1a1a1a');
      pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
      return;
    }

    try {
      let backgroundImageData: string | null = null;

      // Handle custom backgrounds
      if (currentBackground.startsWith('custom:')) {
        const customId = currentBackground.replace('custom:', '');
        const customBg = this.customBackgroundService.backgrounds().find(bg => bg.id === customId);
        
        if (customBg) {
          backgroundImageData = await this.convertBlobToBase64(customBg.blobUrl);
        }
      } else {
        // Handle standard backgrounds - load from assets
        backgroundImageData = await this.loadImageAsBase64(`assets/backgrounds/${currentBackground}`);
      }

      if (backgroundImageData) {
        // Create a canvas to composite the background image with overlay
        const backgroundCanvas = await this.createBackgroundCanvas(backgroundImageData, pdfWidth, pdfHeight);
        const backgroundDataUrl = backgroundCanvas.toDataURL('image/jpeg', 0.9);
        
        // Add the composited background to PDF
        pdf.addImage(backgroundDataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      } else {
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
}