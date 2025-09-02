import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-settings-content',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="settings-content">
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    .settings-content {
      max-width: 800px;
      margin: 0 auto;
      padding: 1rem;
      padding-bottom: 4rem; /* Extra space for bottom buttons */
      animation: fadeIn 0.3s ease-in-out;
    }
    
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (max-width: 768px) {
      .settings-content {
        padding: 0.5rem;
      }
    }
  `]
})
export class SettingsContentComponent {
}
