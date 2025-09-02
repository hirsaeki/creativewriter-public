import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-replicate-icon',
  standalone: true,
  template: `
    <svg 
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 1000 1000" 
      xmlns="http://www.w3.org/2000/svg" 
      [attr.fill]="color"
      [attr.style]="'display: inline-block; vertical-align: middle;'">
      <title>Replicate glyph</title>
      <g>
        <polygon points="1000,427.6 1000,540.6 603.4,540.6 603.4,1000 477,1000 477,427.6"></polygon>
        <polygon points="1000,213.8 1000,327 364.8,327 364.8,1000 238.4,1000 238.4,213.8"></polygon>
        <polygon points="1000,0 1000,113.2 126.4,113.2 126.4,1000 0,1000 0,0"></polygon>
      </g>
    </svg>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
  `]
})
export class ReplicateIconComponent {
  @Input() size: string | number = '24';
  @Input() color = '#9c27b0'; // Replicate purple color
}
