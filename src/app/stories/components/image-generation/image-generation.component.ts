import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonTitle,
  IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonLabel, IonInput, IonTextarea,
  IonRange, IonSpinner,
  IonChip, IonProgressBar, IonToast, IonSearchbar,
  IonSegment, IonSegmentButton, IonBadge
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBack, imageOutline, downloadOutline, refreshOutline,
  settingsOutline, checkmarkCircle, closeCircle, timeOutline,
  copyOutline, trashOutline, cloudOutline, alertCircleOutline,
  sparklesOutline, chevronUp, chevronDown
} from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { ImageGenerationService } from '../../../shared/services/image-generation.service';
import {
  ImageGenerationModel,
  ImageGenerationJob,
  ImageGenerationRequest,
  ImageProvider,
  GeneratedImage
} from '../../../shared/models/image-generation.interface';
import { ImageGalleryModalComponent } from '../../../shared/components/image-gallery-modal/image-gallery-modal.component';

// Aspect ratio options
interface AspectRatioOption {
  value: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-image-generation',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonTitle,
    IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonLabel, IonInput, IonTextarea,
    IonRange, IonSpinner,
    IonChip, IonProgressBar, IonToast, IonSearchbar,
    IonSegment, IonSegmentButton, IonBadge,
    ImageGalleryModalComponent
  ],
  templateUrl: './image-generation.component.html',
  styleUrls: ['./image-generation.component.scss']
})
export class ImageGenerationComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private imageGenService = inject(ImageGenerationService);

  // Provider management
  providers: ImageProvider[] = ['openrouter', 'fal', 'replicate'];
  selectedProvider: ImageProvider = 'openrouter';
  configuredProviders: ImageProvider[] = [];

  // Model management
  allModels: ImageGenerationModel[] = [];
  filteredModels: ImageGenerationModel[] = [];
  modelSearchTerm = '';
  modelsLoading = false;
  selectedModel: ImageGenerationModel | null = null;

  // Generation parameters
  prompt = '';
  negativePrompt = '';
  selectedAspectRatio = '1:1';
  numImages = 1;
  seed: number | undefined;
  guidanceScale = 7.5;
  inferenceSteps = 28;
  showAdvancedOptions = false;

  // Safety settings (fal.ai)
  enableSafetyChecker = true;
  safetyTolerance: '1' | '2' | '3' | '4' | '5' = '2';

  // Aspect ratio options
  aspectRatios: AspectRatioOption[] = [
    { value: '1:1', label: '1:1', icon: 'square' },
    { value: '16:9', label: '16:9', icon: 'landscape' },
    { value: '9:16', label: '9:16', icon: 'portrait' },
    { value: '4:3', label: '4:3', icon: 'landscape' },
    { value: '3:4', label: '3:4', icon: 'portrait' }
  ];

  // Jobs and state
  jobs: ImageGenerationJob[] = [];
  isGenerating = false;

  // Toast
  showToast = false;
  toastMessage = '';
  toastColor = 'primary';

  // Gallery modal
  showGallery = false;
  galleryImages: GeneratedImage[] = [];
  galleryInitialIndex = 0;
  galleryPrompt = '';

  private subscription = new Subscription();
  private settingsInitialized = false;

  constructor() {
    addIcons({
      arrowBack, imageOutline, downloadOutline, refreshOutline,
      settingsOutline, checkmarkCircle, closeCircle, timeOutline,
      copyOutline, trashOutline, cloudOutline, alertCircleOutline,
      sparklesOutline, chevronUp, chevronDown
    });
  }

  ngOnInit(): void {
    // Update configured providers
    this.configuredProviders = this.imageGenService.getConfiguredProviders();

    // Set initial provider to first configured one
    if (this.configuredProviders.length > 0) {
      this.selectedProvider = this.configuredProviders[0];
    }

    // Subscribe to models
    this.subscription.add(
      this.imageGenService.models$.subscribe(models => {
        this.allModels = models;
        this.filterModelsByProvider();
        // Only initialize from saved settings once to avoid overwriting user changes
        if (!this.settingsInitialized) {
          this.initializeFromLastPrompt();
          this.settingsInitialized = true;
        }
      })
    );

    // Subscribe to loading state
    this.subscription.add(
      this.imageGenService.modelsLoading$.subscribe(loading => {
        this.modelsLoading = loading;
      })
    );

    // Subscribe to jobs
    this.subscription.add(
      this.imageGenService.jobs$.subscribe(jobs => {
        // Sort by creation date, newest first
        this.jobs = [...jobs].sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      })
    );

    // Subscribe to generating state
    this.subscription.add(
      this.imageGenService.generating$.subscribe(generating => {
        this.isGenerating = generating;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  // Provider methods
  onProviderChange(): void {
    this.filterModelsByProvider();
    this.selectedModel = null;

    // Auto-select first model for this provider
    if (this.filteredModels.length > 0) {
      this.selectModel(this.filteredModels[0]);
    }
  }

  isProviderConfigured(provider: ImageProvider): boolean {
    return this.configuredProviders.includes(provider);
  }

  getProviderDisplayName(provider: ImageProvider): string {
    return this.imageGenService.getProviderDisplayName(provider);
  }

  getProviderModelCount(provider: ImageProvider): number {
    return this.allModels.filter(m => m.provider === provider).length;
  }

  // Model methods
  filterModelsByProvider(): void {
    let models = this.allModels.filter(m => m.provider === this.selectedProvider);

    // Apply search filter
    if (this.modelSearchTerm) {
      const term = this.modelSearchTerm.toLowerCase();
      models = models.filter(m =>
        m.name.toLowerCase().includes(term) ||
        m.description.toLowerCase().includes(term) ||
        m.id.toLowerCase().includes(term)
      );
    }

    this.filteredModels = models;
  }

  onModelSearch(): void {
    this.filterModelsByProvider();
  }

  selectModel(model: ImageGenerationModel): void {
    this.selectedModel = model;

    // Update aspect ratios based on model capabilities
    if (model.capabilities.aspectRatios) {
      this.aspectRatios = model.capabilities.aspectRatios.map(ratio => ({
        value: ratio,
        label: ratio,
        icon: this.getAspectRatioIcon(ratio)
      }));

      // Select default if current not available
      if (!this.aspectRatios.find(r => r.value === this.selectedAspectRatio)) {
        this.selectedAspectRatio = this.aspectRatios[0]?.value || '1:1';
      }
    }
  }

  private getAspectRatioIcon(ratio: string): string {
    if (ratio.includes('16:9') || ratio.includes('landscape')) return 'landscape';
    if (ratio.includes('9:16') || ratio.includes('portrait')) return 'portrait';
    return 'square';
  }

  private initializeFromLastPrompt(): void {
    const lastPrompt = this.imageGenService.getLastPrompt();
    if (lastPrompt) {
      // Find the model
      const model = this.allModels.find(m => m.id === lastPrompt.modelId);
      if (model) {
        this.selectedProvider = model.provider;
        this.filterModelsByProvider();
        this.selectModel(model);
      }

      // Restore all settings from the saved request
      const s = lastPrompt.settings;
      if (s) {
        if (s.prompt !== undefined) this.prompt = s.prompt;
        if (s.negativePrompt !== undefined) this.negativePrompt = s.negativePrompt;
        if (s.aspectRatio !== undefined) this.selectedAspectRatio = s.aspectRatio;
        if (s.numImages !== undefined) this.numImages = s.numImages;
        if (s.seed !== undefined) this.seed = s.seed;
        if (s.guidanceScale !== undefined) this.guidanceScale = s.guidanceScale;
        if (s.inferenceSteps !== undefined) this.inferenceSteps = s.inferenceSteps;
        if (s.enableSafetyChecker !== undefined) this.enableSafetyChecker = s.enableSafetyChecker;
        if (s.safetyTolerance !== undefined) this.safetyTolerance = s.safetyTolerance;
      }
    } else if (this.filteredModels.length > 0 && !this.selectedModel) {
      this.selectModel(this.filteredModels[0]);
    }
  }

  // Generation methods

  /**
   * Build a complete ImageGenerationRequest from current component state.
   * This ensures all settings are captured in one place.
   */
  private buildRequest(): ImageGenerationRequest {
    const request: ImageGenerationRequest = {
      modelId: this.selectedModel!.id,
      prompt: this.prompt.trim(),
      aspectRatio: this.selectedAspectRatio,
      numImages: this.numImages
    };

    // Add optional parameters based on model capabilities
    if (this.selectedModel!.capabilities.supportsNegativePrompt && this.negativePrompt.trim()) {
      request.negativePrompt = this.negativePrompt.trim();
    }
    if (this.selectedModel!.capabilities.supportsSeed && this.seed !== undefined) {
      request.seed = this.seed;
    }
    if (this.selectedModel!.capabilities.supportsGuidanceScale) {
      request.guidanceScale = this.guidanceScale;
    }
    if (this.selectedModel!.capabilities.supportsInferenceSteps) {
      request.inferenceSteps = this.inferenceSteps;
    }

    // Safety settings (always include for fal provider)
    if (this.selectedProvider === 'fal') {
      request.enableSafetyChecker = this.enableSafetyChecker;
      if (this.enableSafetyChecker) {
        request.safetyTolerance = this.safetyTolerance;
      }
    }

    return request;
  }

  async generateImage(): Promise<void> {
    if (!this.selectedModel || !this.prompt.trim() || this.isGenerating) {
      return;
    }

    // Build request (single source of truth for all settings)
    const request = this.buildRequest();

    // Save settings for next time (uses the same complete request object)
    this.imageGenService.saveLastPrompt(this.selectedModel.id, request);

    // Generate
    this.subscription.add(
      this.imageGenService.generateImage(request).subscribe({
        next: (job) => {
          if (job.status === 'completed') {
            this.showToastMessage('Image generated successfully!', 'success');
          } else if (job.status === 'failed') {
            this.showToastMessage(`Generation failed: ${job.error}`, 'danger');
          }
        },
        error: (error) => {
          this.showToastMessage(`Error: ${error.message}`, 'danger');
        }
      })
    );
  }

  // History methods
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
      case 'failed': return 'Failed';
      case 'processing': return 'Generating';
      case 'pending': return 'Pending';
      default: return status;
    }
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit'
    }).format(new Date(date));
  }

  getImageUrl(job: ImageGenerationJob): string | null {
    if (job.images && job.images.length > 0) {
      return job.images[0].url;
    }
    return null;
  }

  getJobImages(job: ImageGenerationJob): GeneratedImage[] {
    return job.images || [];
  }

  viewImage(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  openGallery(job: ImageGenerationJob, imageIndex: number): void {
    this.galleryImages = job.images || [];
    this.galleryInitialIndex = imageIndex;
    this.galleryPrompt = job.prompt;
    this.showGallery = true;
  }

  downloadImage(url: string, filename: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename.slice(0, 50)}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  copyPrompt(prompt: string): void {
    navigator.clipboard.writeText(prompt).then(() => {
      this.showToastMessage('Prompt copied to clipboard', 'primary');
    });
  }

  regenerateAndAppend(job: ImageGenerationJob): void {
    if (this.isGenerating || job.status !== 'completed') return;

    this.subscription.add(
      this.imageGenService.regenerateAndAppend(job.id).subscribe({
        next: (updatedJob) => {
          if (updatedJob.images && updatedJob.images.length > (job.images?.length || 0)) {
            this.showToastMessage('Images added to generation!', 'success');
          }
        },
        error: (error) => {
          this.showToastMessage(`Regeneration failed: ${error.message}`, 'danger');
        }
      })
    );
  }

  deleteJob(jobId: string): void {
    this.imageGenService.deleteJob(jobId);
  }

  clearHistory(): void {
    this.imageGenService.clearJobs();
    this.showToastMessage('History cleared', 'primary');
  }

  // Refresh models
  async refreshModels(): Promise<void> {
    await this.imageGenService.refreshModels();
    this.configuredProviders = this.imageGenService.getConfiguredProviders();
    this.showToastMessage('Models refreshed', 'primary');
  }

  // Navigation
  goBack(): void {
    this.router.navigate(['/']);
  }

  goToSettings(): void {
    this.router.navigate(['/settings']);
  }

  // Toast
  private showToastMessage(message: string, color = 'primary'): void {
    this.toastMessage = message;
    this.toastColor = color;
    this.showToast = true;
  }

  // Toggle advanced options
  toggleAdvancedOptions(): void {
    this.showAdvancedOptions = !this.showAdvancedOptions;
  }
}
