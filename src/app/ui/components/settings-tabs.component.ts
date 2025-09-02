import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonSegment, IonSegmentButton, IonIcon, IonLabel } from '@ionic/angular/standalone';

export interface TabItem {
  value: string;
  icon: string;
  label: string;
}

@Component({
  selector: 'app-settings-tabs',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonSegment, IonSegmentButton, IonIcon, IonLabel
  ],
  template: `
    <ion-segment 
      [ngModel]="selectedTab" 
      (ngModelChange)="onTabChange($event)"
      mode="md" 
      class="settings-tabs">
      <ion-segment-button 
        *ngFor="let tab of tabs" 
        [value]="tab.value">
        <ion-icon [name]="tab.icon"></ion-icon>
        <ion-label>{{ tab.label }}</ion-label>
      </ion-segment-button>
    </ion-segment>
  `,
  styles: [`
    /* Tab Navigation Styles */
    .settings-tabs {
      position: sticky;
      top: 0;
      z-index: 10;
      background: rgba(45, 45, 45, 0.3);
      backdrop-filter: blur(15px);
      -webkit-backdrop-filter: blur(15px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 2px 20px rgba(0, 0, 0, 0.2);
      padding: 0.5rem;
      margin-bottom: 1rem;
    }
    
    ion-segment {
      --background: transparent;
    }
    
    ion-segment-button {
      --background: transparent;
      --background-checked: linear-gradient(135deg, rgba(71, 118, 230, 0.2) 0%, rgba(139, 180, 248, 0.2) 100%);
      --color: #f8f9fa;
      --color-checked: #ffffff;
      --indicator-color: linear-gradient(135deg, #4776e6 0%, #8bb4f8 100%);
      --indicator-height: 3px;
      --border-radius: 8px;
      padding: 0.5rem;
      min-height: 48px;
      transition: all 0.3s ease;
      border: 1px solid transparent;
      opacity: 0.8;
    }
    
    ion-segment-button:hover {
      --background: rgba(139, 180, 248, 0.1);
      opacity: 1;
      transform: translateY(-1px);
    }
    
    ion-segment-button.segment-button-checked {
      border-color: rgba(139, 180, 248, 0.3);
      background: linear-gradient(135deg, rgba(71, 118, 230, 0.2) 0%, rgba(139, 180, 248, 0.2) 100%);
      opacity: 1;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    }
    
    ion-segment-button ion-icon {
      font-size: 1.3rem;
      margin-bottom: 0.2rem;
      color: inherit;
    }
    
    ion-segment-button ion-label {
      font-size: 0.85rem;
      font-weight: 500;
      letter-spacing: 0.3px;
      color: inherit;
    }
    
    ion-segment-button.segment-button-checked ion-icon,
    ion-segment-button.segment-button-checked ion-label {
      color: #ffffff;
    }

    @media (max-width: 768px) {
      .settings-tabs {
        padding: 0.25rem;
      }
      
      ion-segment-button {
        padding: 0.25rem;
        min-height: 40px;
      }
      
      ion-segment-button ion-icon {
        font-size: 1.1rem;
        margin-bottom: 0;
      }
      
      ion-segment-button ion-label {
        font-size: 0.75rem;
      }
    }
  `]
})
export class SettingsTabsComponent {
  @Input() tabs: TabItem[] = [];
  @Input() selectedTab = '';
  @Output() selectedTabChange = new EventEmitter<string>();

  onTabChange(value: string): void {
    this.selectedTab = value;
    this.selectedTabChange.emit(value);
  }
}
