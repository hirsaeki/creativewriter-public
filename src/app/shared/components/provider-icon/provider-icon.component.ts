import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { getProviderIcon, getProviderColor, getProviderTooltip, isCustomProviderIcon, getProviderSvg } from '../../../core/provider-icons';

/**
 * Unified provider icon component
 * Replaces individual icon components (OpenRouterIconComponent, ClaudeIconComponent, etc.)
 * Uses inline SVG for custom icons to ensure reliable rendering
 * Usage: <app-provider-icon [provider]="'openrouter'" [size]="20"></app-provider-icon>
 */
@Component({
  selector: 'app-provider-icon',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <!-- Custom SVG icons (rendered inline for reliability) -->
    <span
      *ngIf="isCustomIcon"
      class="custom-icon"
      [innerHTML]="safeSvg"
      [style.color]="useColor ? iconColor : null"
      [style.width.px]="size"
      [style.height.px]="size"
      [title]="showTooltip ? tooltip : ''">
    </span>
    <!-- Standard Ionicons -->
    <ion-icon
      *ngIf="!isCustomIcon"
      [name]="iconName"
      [style.color]="useColor ? iconColor : null"
      [style.font-size.px]="size"
      [style.width.px]="size"
      [style.height.px]="size"
      [title]="showTooltip ? tooltip : null">
    </ion-icon>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    ion-icon {
      display: block;
    }
    .custom-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .custom-icon ::ng-deep svg {
      width: 100%;
      height: 100%;
      display: block;
    }
  `]
})
export class ProviderIconComponent {
  /** Provider identifier (e.g., 'openrouter', 'claude', 'ollama') */
  @Input() provider!: string;

  /** Icon size in pixels */
  @Input() size = 16;

  /** Whether to apply the provider's brand color */
  @Input() useColor = true;

  /** Whether to show the provider tooltip on hover */
  @Input() showTooltip = false;

  private sanitizer = inject(DomSanitizer);

  get isCustomIcon(): boolean {
    return isCustomProviderIcon(this.provider);
  }

  get iconName(): string {
    return getProviderIcon(this.provider);
  }

  get iconColor(): string {
    return getProviderColor(this.provider);
  }

  get tooltip(): string {
    return getProviderTooltip(this.provider);
  }

  get safeSvg(): SafeHtml {
    const svg = getProviderSvg(this.provider);
    return svg ? this.sanitizer.bypassSecurityTrustHtml(svg) : '';
  }
}
