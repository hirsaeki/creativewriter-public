import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonTitle, 
  IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonItem, IonLabel, IonInput, IonTextarea, IonSelect, IonSelectOption,
  IonRange, IonCheckbox, IonSpinner, IonGrid, IonRow, IonCol,
  IonImg, IonChip, IonProgressBar, IonToast
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  arrowBack, imageOutline, downloadOutline, refreshOutline,
  settingsOutline, checkmarkCircle, closeCircle, timeOutline
} from 'ionicons/icons';
import { ImageGenerationService } from '../../../shared/services/image-generation.service';
import { 
  ImageGenerationModel, 
  ModelInput, 
  ImageGenerationJob 
} from '../../../shared/models/image-generation.interface';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-image-generation',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonTitle,
    IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonItem, IonLabel, IonInput, IonTextarea, IonSelect, IonSelectOption,
    IonRange, IonCheckbox, IonSpinner, IonGrid, IonRow, IonCol,
    IonImg, IonChip, IonProgressBar, IonToast
  ],
  templateUrl: './image-generation.component.html',
  styleUrls: ['./image-generation.component.scss']
})
export class ImageGenerationComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private imageGenService = inject(ImageGenerationService);

  availableModels: ImageGenerationModel[] = [];
  selectedModelId = '';
  selectedModel: ImageGenerationModel | null = null;
  parameters: Record<string, unknown> = {};
  jobs: ImageGenerationJob[] = [];
  isGenerating = false;
  showToast = false;
  toastMessage = '';
  
  private subscription: Subscription = new Subscription();

  constructor() {
    addIcons({ 
      arrowBack, imageOutline, downloadOutline, refreshOutline,
      settingsOutline, checkmarkCircle, closeCircle, timeOutline
    });
  }

  ngOnInit(): void {
    this.availableModels = this.imageGenService.getAvailableModels();
    
    // Try to load last prompt and parameters
    const lastPrompt = this.imageGenService.getLastPrompt();
    if (lastPrompt && this.availableModels.find(m => m.id === lastPrompt.modelId)) {
      this.selectedModelId = lastPrompt.modelId;
      this.onModelChange();
      // Restore parameters after model change
      setTimeout(() => {
        this.parameters = { ...lastPrompt.parameters };
      }, 0);
    } else if (this.availableModels.length > 0) {
      this.selectedModelId = this.availableModels[0].id;
      this.onModelChange();
    }

    // Subscribe to jobs updates
    this.subscription.add(
      this.imageGenService.jobs$.subscribe(jobs => {
        this.jobs = jobs.slice().reverse(); // Show newest first
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  onModelChange(): void {
    this.selectedModel = this.imageGenService.getModel(this.selectedModelId) || null;
    if (this.selectedModel) {
      this.initializeParameters();
    }
  }

  private initializeParameters(): void {
    if (!this.selectedModel) return;
    
    this.parameters = {};
    this.selectedModel.inputs.forEach(input => {
      if (input.default !== undefined) {
        this.parameters[input.name] = input.default;
      } else if (input.options && input.options.length > 0) {
        // Set first option as default if no default specified
        this.parameters[input.name] = input.options[0];
      }
    });
  }

  generateImage(): void {
    if (!this.selectedModel || !this.parameters['prompt'] || this.isGenerating) {
      return;
    }

    // Save current prompt and parameters
    this.imageGenService.saveLastPrompt(this.selectedModelId, this.parameters);

    this.isGenerating = true;
    
    this.subscription.add(
      this.imageGenService.generateImage(this.selectedModelId, this.parameters)
        .subscribe({
          next: (job) => {
            this.isGenerating = false;
            if (job.status === 'completed') {
              this.showToastMessage('Image generated successfully!');
            }
          },
          error: (error) => {
            this.isGenerating = false;
            console.error('Generation error:', error);
            
            // Show detailed error message
            const errorMessage = error.message || 'Unbekannter Fehler';
            this.showToastMessage(`Fehler: ${errorMessage}`);
          }
        })
    );
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'danger';
      case 'processing': return 'warning';
      default: return 'medium';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'completed': return 'checkmark-circle';
      case 'failed': return 'close-circle';
      case 'processing': return 'time-outline';
      default: return 'time-outline';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'completed': return 'Done';
      case 'failed': return 'Fehler';
      case 'processing': return 'Generating';
      case 'pending': return 'Wartend';
      default: return status;
    }
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit'
    }).format(date);
  }

  viewImage(url: string): void {
    // Open image in new tab for full-size viewing
    window.open(url, '_blank');
  }

  downloadImage(url: string, filename: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename.slice(0, 50)}.jpg`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  clearHistory(): void {
    this.imageGenService.clearJobs();
    this.showToastMessage('History deleted');
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  getStepSize(input: ModelInput): number {
    // Use step size of 8 for width and height to ensure divisibility by 8
    if (input.name === 'width' || input.name === 'height') {
      return 8;
    }
    
    // Use 0.5 for guidance_scale for finer control
    if (input.name === 'guidance_scale') {
      return 0.5;
    }
    
    // Default step sizes for other inputs
    return input.type === 'integer' ? 1 : 0.1;
  }

  private showToastMessage(message: string): void {
    this.toastMessage = message;
    this.showToast = true;
  }
}