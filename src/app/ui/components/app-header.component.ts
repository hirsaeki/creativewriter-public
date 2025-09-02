import { Component, Input, Output, EventEmitter, TemplateRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, IonPopover } from '@ionic/angular';
import { VersionService } from '../../core/services/version.service';
import { VersionTooltipComponent } from './version-tooltip.component';


export interface HeaderAction {
  icon: string;
  label?: string;
  color?: string;
  action: () => void;
  disabled?: boolean;
  showOnMobile?: boolean;
  showOnDesktop?: boolean;
  chipContent?: string;
  chipColor?: string;
  showVersionTooltip?: boolean;
  cssClass?: string;
  tooltip?: string;
}

export interface BurgerMenuItem {
  icon: string;
  label: string;
  action: () => void;
  color?: string;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, IonicModule, VersionTooltipComponent],
  template: `
    <ion-header>
      <ion-toolbar>
        <!-- Left Actions -->
        <ion-buttons slot="start">
          <ion-button *ngIf="showBackButton" (click)="handleBackAction()">
            <ion-icon name="arrow-back" slot="icon-only"></ion-icon>
          </ion-button>
          
          <ng-container *ngFor="let action of leftActions">
            <ion-button 
              [class.desktop-only]="!action.showOnMobile"
              [class.mobile-only]="!action.showOnDesktop"
              [disabled]="action.disabled"
              [color]="action.color"
              (click)="action.action()">
              <ion-icon [name]="action.icon" slot="icon-only"></ion-icon>
            </ion-button>
          </ng-container>
        </ion-buttons>

        <!-- Title -->
        <ion-title>
          <ng-container *ngIf="titleTemplate; else staticTitle">
            <ng-container *ngTemplateOutlet="titleTemplate"></ng-container>
          </ng-container>
          <ng-template #staticTitle>
            <div class="title-content">
              <img *ngIf="logoSrc" [src]="logoSrc" alt="Logo" class="header-logo">
              <span class="app-title">{{ title }}</span>
            </div>
          </ng-template>
        </ion-title>

        <!-- Right Actions -->
        <ion-buttons slot="end">
          <!-- User Info (Desktop Only) -->
          <div class="desktop-only user-info" *ngIf="showUserInfo && userGreeting">
            <span class="user-greeting">{{ userGreeting }}</span>
            <ng-content select="[slot=user-status]"></ng-content>
          </div>

          <!-- Action Buttons -->
          <ng-container *ngFor="let action of rightActions">
            <ion-button 
              [class.desktop-only]="!action.showOnMobile"
              [class.mobile-only]="!action.showOnDesktop"
              [class]="action.cssClass"
              [disabled]="action.disabled"
              [color]="action.color"
              [title]="action.tooltip"
              (click)="action.action()">
              <ion-icon [name]="action.icon" slot="start" *ngIf="action.label"></ion-icon>
              <ion-icon [name]="action.icon" slot="icon-only" *ngIf="!action.label && action.icon"></ion-icon>
              <span *ngIf="action.label">{{ action.label }}</span>
            </ion-button>
          </ng-container>

          <!-- Status Chips -->
          <ng-container *ngFor="let action of rightActions">
            <app-version-tooltip *ngIf="action.chipContent && action.showVersionTooltip">
              <ion-chip 
                [color]="action.chipColor || 'medium'"
                [class.desktop-only]="!action.showOnMobile"
                [class.mobile-only]="!action.showOnDesktop"
                (click)="action.action()"
                class="clickable-chip">
                <ion-icon [name]="action.icon" *ngIf="action.icon"></ion-icon>
                <ion-label>{{ action.chipContent }}</ion-label>
              </ion-chip>
            </app-version-tooltip>
            
            <ion-chip 
              *ngIf="action.chipContent && !action.showVersionTooltip"
              [color]="action.chipColor || 'medium'"
              [class.desktop-only]="!action.showOnMobile"
              [class.mobile-only]="!action.showOnDesktop"
              (click)="action.action()"
              class="clickable-chip">
              <ion-icon [name]="action.icon" *ngIf="action.icon"></ion-icon>
              <ion-label>{{ action.chipContent }}</ion-label>
            </ion-chip>
          </ng-container>

          <!-- Burger Menu Button -->
          <ion-button 
            *ngIf="showBurgerMenu" 
            id="burger-menu-trigger"
            aria-label="Open navigation menu"
            aria-haspopup="menu"
            [attr.aria-expanded]="isBurgerMenuOpen">
            <ion-icon name="menu" slot="icon-only" aria-hidden="true"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>

      <!-- Secondary Toolbar -->
      <ion-toolbar *ngIf="showSecondaryToolbar && secondaryContent">
        <ng-container *ngTemplateOutlet="secondaryContent"></ng-container>
      </ion-toolbar>
    </ion-header>

    <!-- Burger Menu Popover -->
    <ion-popover 
      #burgerMenuPopover
      *ngIf="showBurgerMenu"
      trigger="burger-menu-trigger" 
      triggerAction="click"
      side="bottom"
      alignment="end"
      [dismissOnSelect]="false"
      [showBackdrop]="true"
      [keepContentsMounted]="false"
      (ionPopoverWillPresent)="onBurgerMenuWillPresent()"
      (ionPopoverWillDismiss)="onBurgerMenuWillDismiss()">
      <ng-template>
        <ion-content>
          <div class="popover-header" *ngIf="burgerMenuTitle">
            <h3>{{ burgerMenuTitle || 'Navigation' }}</h3>
          </div>
          
          <ion-list lines="none" role="menu" aria-label="Navigation menu">
            <ion-item 
              button 
              *ngFor="let item of burgerMenuItems"
              (click)="handleBurgerMenuAction(item.action)"
              role="menuitem"
              [attr.aria-label]="item.label">
              <ion-icon [name]="item.icon" slot="start" [color]="item.color || 'medium'" aria-hidden="true"></ion-icon>
              <ion-label>{{ item.label }}</ion-label>
            </ion-item>
          </ion-list>
          
          <!-- Burger Menu Footer Content -->
          <div class="popover-footer" *ngIf="burgerMenuFooterContent">
            <ng-container *ngTemplateOutlet="burgerMenuFooterContent"></ng-container>
          </div>
        </ion-content>
      </ng-template>
    </ion-popover>
  `,
  styles: [`
    /* Base Header Styling */
    ion-header {
      backdrop-filter: blur(15px);
      background: rgba(45, 45, 45, 0.3);
      box-shadow: 0 2px 20px rgba(0, 0, 0, 0.2);
      position: relative;
      z-index: 100;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    /* Mobile header height fix for scroll calculation */
    @media (max-width: 768px) {
      ion-header {
        height: auto;
        min-height: 56px;
      }
    }
    
    ion-toolbar {
      --background: transparent;
      --color: #f8f9fa;
      --padding-start: 16px;
      --padding-end: 16px;
    }

    /* Title Styling */
    ion-title {
      overflow: visible !important;
      padding: 0 !important;
      position: relative;
      flex: 1;
      text-align: center;
    }
    
    .title-content {
      display: flex;
      align-items: center;
      gap: 12px;
      justify-content: center;
      overflow: visible;
      min-width: max-content;
      padding: 0 16px;
    }
    
    .header-logo {
      width: 48px;
      height: 48px;
      object-fit: contain;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
      flex-shrink: 0;
    }
    
    .app-title {
      background: linear-gradient(135deg, #f8f9fa 0%, #8bb4f8 50%, #4776e6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-shadow: 0 2px 10px rgba(139, 180, 248, 0.3);
    }

    /* Button Styling */
    ion-button {
      --color: #f8f9fa;
      --background: rgba(255, 255, 255, 0.1);
      --background-hover: rgba(255, 255, 255, 0.2);
      --border-radius: 8px;
      margin: 0 4px;
      transition: all 0.2s ease;
    }
    
    ion-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    
    ion-icon {
      font-size: 1.2rem;
    }

    /* User Info */
    .user-info {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-right: 1rem;
    }
    
    .user-greeting {
      color: #f8f9fa;
      font-size: 0.9rem;
      font-weight: 500;
    }

    /* Responsive Classes */
    .desktop-only {
      display: block;
    }
    
    .mobile-only {
      display: none;
    }

    @media (max-width: 768px) {
      .desktop-only {
        display: none;
      }
      
      .mobile-only {
        display: block;
      }
      
      .app-title {
        font-size: 1.2rem;
      }
    }

    /* Popover Styles */
    ion-popover {
      --backdrop-opacity: 0.6;
      --box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
      --width: 280px;
      --max-width: 90vw;
    }
    
    ion-popover::part(content) {
      background: linear-gradient(135deg, rgba(15, 15, 25, 0.6) 0%, rgba(10, 10, 20, 0.6) 50%, rgba(20, 20, 35, 0.6) 100%);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(139, 180, 248, 0.2);
      border-radius: 12px;
    }
    
    ion-popover ion-content {
      --background: transparent;
      --color: #f8f9fa;
    }
    
    ion-popover ion-list {
      background: transparent;
      padding: 0.5rem 0;
    }
    
    ion-popover ion-item {
      --background: rgba(255, 255, 255, 0.02);
      --background-hover: rgba(139, 180, 248, 0.1);
      --background-activated: rgba(139, 180, 248, 0.15);
      --color: rgba(255, 255, 255, 0.95);
      --ripple-color: rgba(139, 180, 248, 0.3);
      margin: 0 0.75rem 0.5rem 0.75rem;
      --border-radius: 8px;
      border: 1px solid rgba(139, 180, 248, 0.15);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }
    
    ion-popover ion-item::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(139, 180, 248, 0.1), transparent);
      transition: left 0.5s ease;
      z-index: 1;
    }
    
    ion-popover ion-item:hover {
      --background: rgba(139, 180, 248, 0.1);
      border-color: rgba(139, 180, 248, 0.3);
      transform: translateX(4px) scale(1.02);
      box-shadow: 0 4px 12px rgba(139, 180, 248, 0.2);
    }
    
    ion-popover ion-item:hover::before {
      left: 100%;
    }
    
    ion-popover ion-item ion-icon {
      position: relative;
      z-index: 2;
    }
    
    ion-popover ion-item ion-label {
      position: relative;
      z-index: 2;
      font-weight: 500;
    }
    
    .popover-header {
      padding: 1rem 1.25rem 0.75rem 1.25rem;
      border-bottom: 1px solid rgba(139, 180, 248, 0.15);
      background: linear-gradient(135deg, rgba(15, 15, 25, 0.4) 0%, rgba(10, 10, 20, 0.4) 100%);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      position: relative;
    }
    
    .popover-header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, rgba(139, 180, 248, 0.05) 0%, rgba(71, 118, 230, 0.05) 100%);
      z-index: -1;
    }
    
    .popover-header h3 {
      margin: 0;
      color: rgba(255, 255, 255, 0.95);
      font-size: 1rem;
      font-weight: 600;
      letter-spacing: 0.3px;
      background: linear-gradient(135deg, #ffffff 0%, #8bb4f8 50%, #4776e6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .popover-footer {
      border-top: 1px solid rgba(139, 180, 248, 0.15);
      padding: 0.75rem 1.25rem;
      background: linear-gradient(135deg, rgba(15, 15, 25, 0.4) 0%, rgba(10, 10, 20, 0.4) 100%);
      position: relative;
    }
    
    .popover-footer::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, rgba(139, 180, 248, 0.05) 0%, rgba(71, 118, 230, 0.05) 100%);
      z-index: -1;
    }

    /* Clickable chips */
    .clickable-chip {
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .clickable-chip:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      --background: rgba(255, 255, 255, 0.15);
    }

    /* Popover Footer Styles */
    .popover-footer ion-chip {
      font-size: 0.8rem;
      margin: 0.25rem 0;
    }
    
    .popover-footer .status-detail {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      align-items: center;
    }
    
    @media (min-width: 768px) {
      ion-header {
        box-shadow: 0 2px 20px rgba(0, 0, 0, 0.3);
      }
      
      ion-toolbar {
        --min-height: 44px;
        --padding-top: 4px;
        --padding-bottom: 4px;
      }
    }
  `]
})
export class AppHeaderComponent implements OnInit {
  versionService = inject(VersionService);

  @ViewChild('burgerMenuPopover') burgerMenuPopover?: IonPopover;
  
  @Input() title = '';
  @Input() titleTemplate?: TemplateRef<unknown>;
  @Input() logoSrc?: string;
  @Input() showBackButton = false;
  @Input() backAction?: () => void;
  @Input() leftActions: HeaderAction[] = [];
  @Input() rightActions: HeaderAction[] = [];
  @Input() showBurgerMenu = false;
  @Input() burgerMenuTitle = 'Navigation';
  @Input() burgerMenuItems: BurgerMenuItem[] = [];
  @Input() burgerMenuFooterContent?: TemplateRef<unknown>;
  @Input() showSecondaryToolbar = false;
  @Input() secondaryContent?: TemplateRef<unknown>;
  @Input() showUserInfo = false;
  @Input() userGreeting = '';

  @Output() burgerMenuToggle = new EventEmitter<boolean>();
  
  public isBurgerMenuOpen = false;

  ngOnInit(): void {
    // Initialize header component - version service loads automatically
    this.isBurgerMenuOpen = false;
  }

  handleBackAction(): void {
    if (this.backAction) {
      this.backAction();
    } else {
      // Default back navigation
      window.history.back();
    }
  }

  handleBurgerMenuAction(action: () => void): void {
    action();
    // Close the popover programmatically
    if (this.burgerMenuPopover) {
      this.burgerMenuPopover.dismiss();
    }
    // Emit that burger menu was used (for any parent components that need to know)
    this.burgerMenuToggle.emit(false);
  }

  onBurgerMenuWillPresent(): void {
    this.isBurgerMenuOpen = true;
  }

  onBurgerMenuWillDismiss(): void {
    this.isBurgerMenuOpen = false;
  }
}
