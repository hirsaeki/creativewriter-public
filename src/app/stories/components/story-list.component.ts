import { Component, OnInit, TemplateRef, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonChip, IonIcon, IonButton, 
  IonContent, IonLabel
} from '@ionic/angular/standalone';
import { CdkDropList, CdkDrag, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { addIcons } from 'ionicons';
import { add, download, settings, statsChart, trash, create, images, menu, close, reorderThree, swapVertical, move, appsOutline } from 'ionicons/icons';
import { StoryService } from '../services/story.service';
import { Story } from '../models/story.interface';
import { SyncStatusComponent } from '../../shared/components/sync-status.component';
import { LoginComponent } from '../../shared/components/login.component';
import { AuthService, User } from '../../core/services/auth.service';
import { AppHeaderComponent, BurgerMenuItem, HeaderAction } from '../../shared/components/app-header.component';
import { HeaderNavigationService } from '../../shared/services/header-navigation.service';
import { VersionService } from '../../core/services/version.service';

@Component({
  selector: 'app-story-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonChip, IonIcon, IonButton, 
    IonContent, IonLabel,
    CdkDropList, CdkDrag,
    SyncStatusComponent, LoginComponent, AppHeaderComponent
  ],
  template: `
    <app-header
      title="My Stories"
      [showBurgerMenu]="true"
      [burgerMenuItems]="burgerMenuItems"
      [burgerMenuFooterContent]="burgerMenuFooter"
      [rightActions]="rightActions"
      [showUserInfo]="!!currentUser"
      [userGreeting]="currentUser ? '👋 ' + (currentUser.displayName || currentUser.username) : ''"
      (burgerMenuToggle)="onBurgerMenuToggle()">
      
      <app-sync-status 
        slot="user-status" 
        [showActions]="false" 
        class="compact-sync-status" 
        *ngIf="currentUser">
      </app-sync-status>
    </app-header>
    
    <ng-template #burgerMenuFooter>
      <div class="burger-menu-footer-content">
        <div *ngIf="currentUser">
          <app-sync-status [showActions]="true" class="full-sync-status"></app-sync-status>
          <ion-button fill="clear" color="danger" (click)="logout()" class="logout-button">
            Sign Out
          </ion-button>
        </div>
        <div class="version-info">
          <ion-chip color="medium" class="version-chip">
            <ion-label>v{{ versionService.getShortVersion() }}</ion-label>
          </ion-chip>
        </div>
      </div>
    </ng-template>

    <ion-content [scrollEvents]="true">
      <div class="story-list-container">
      
      <!-- App Branding Header -->
      <div class="app-branding">
        <h1 class="app-title">
          <span class="app-name">Creative Writer</span>
          <span class="app-tagline">Your Stories, Your World</span>
        </h1>
        <div class="brand-decoration"></div>
      </div>
      
      <div class="action-buttons">
        <ion-button expand="block" size="default" color="primary" (click)="createNewStory()">
          <ion-icon name="add" slot="start"></ion-icon>
          Write New Story
        </ion-button>
        <ion-button expand="block" size="default" fill="outline" color="medium" (click)="importNovelCrafter()">
          <ion-icon name="download" slot="start"></ion-icon>
          NovelCrafter Import
        </ion-button>
        <ion-button expand="block" size="default" fill="outline" color="secondary" (click)="goToImageGeneration()">
          <ion-icon name="images" slot="start"></ion-icon>
          Image Generation
        </ion-button>
      </div>
      
      <div class="stories-grid" *ngIf="stories.length > 0; else noStories" 
           [cdkDropListDisabled]="!reorderingEnabled"
           cdkDropList 
           (cdkDropListDropped)="drop($event)">
        <ion-card class="story-card" 
                  *ngFor="let story of stories" 
                  [cdkDragDisabled]="!reorderingEnabled"
                  cdkDrag 
                  (click)="!reorderingEnabled && openStory(story.id)" 
                  [class.reordering-enabled]="reorderingEnabled"
                  button>
          <!-- Cover Image -->
          <div class="story-cover" *ngIf="story.coverImage">
            <img [src]="getCoverImageUrl(story)" [alt]="story.title || 'Story cover'" />
            <div class="cover-overlay"></div>
          </div>
          
          <ion-card-header [class.with-cover]="!!story.coverImage">
            <div class="card-header-content">
              <ion-button fill="clear" size="small" color="medium" 
                          class="drag-handle" 
                          [style.visibility]="reorderingEnabled ? 'visible' : 'hidden'"
                          cdkDragHandle 
                          (click)="$event.stopPropagation()">
                <ion-icon name="reorder-three" slot="icon-only"></ion-icon>
              </ion-button>
              <ion-card-title>{{ story.title || 'Untitled Story' }}</ion-card-title>
              <ion-button fill="clear" size="small" color="danger" (click)="deleteStory($event, story.id)">
                <ion-icon name="trash" slot="icon-only"></ion-icon>
              </ion-button>
            </div>
          </ion-card-header>
          <ion-card-content>
            <p class="story-preview">{{ getStoryPreview(story) }}</p>
            <div class="story-chips">
              <ion-chip color="medium">
                <span>{{ getWordCount(story) }} words</span>
              </ion-chip>
              <ion-chip color="medium">
                <span>{{ story.updatedAt | date:'short' }}</span>
              </ion-chip>
            </div>
          </ion-card-content>
        </ion-card>
      </div>
      
      <ng-template #noStories>
        <div class="no-stories">
          <p>No stories available yet.</p>
          <p>Start writing your first story!</p>
        </div>
      </ng-template>
      
      <!-- Login Modal -->
      <app-login></app-login>
      
      <!-- Mobile FAB Button -->
      <div class="mobile-fab-container">
        <button class="mobile-fab-button" (click)="toggleFabMenu()">
          <ion-icon name="add"></ion-icon>
        </button>
        <div class="mobile-fab-menu" *ngIf="fabMenuOpen">
          <button class="mobile-fab-option" (click)="createNewStory()">
            <ion-icon name="create"></ion-icon>
            <span>New Story</span>
          </button>
          <button class="mobile-fab-option" (click)="importNovelCrafter()">
            <ion-icon name="download"></ion-icon>
            <span>Import</span>
          </button>
          <button class="mobile-fab-option" (click)="goToImageGeneration()">
            <ion-icon name="images"></ion-icon>
            <span>Images</span>
          </button>
        </div>
      </div>
      </div>
    </ion-content>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100vh;
      position: relative;
    }
    
    
    ion-content {
      --background: transparent !important;
      background: transparent !important;
      flex: 1;
      position: relative;
    }
    
    /* Make sure ion-content doesn't override our background */
    ion-content::part(background) {
      background: transparent !important;
    }
    
    :host {
      background: transparent;
    }
    
    .story-list-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem;
      background-color: transparent;
      position: relative;
      z-index: 1;
    }
    
    .title-gradient {
      background: linear-gradient(135deg, #f8f9fa 0%, #8bb4f8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    
    ion-header {
      backdrop-filter: blur(15px);
      background: rgba(45, 45, 45, 0.3);
      box-shadow: 0 2px 20px rgba(0, 0, 0, 0.2);
      position: relative;
      z-index: 100;
    }
    
    ion-toolbar {
      --background: transparent;
      --color: #f8f9fa;
    }
    
    /* App Branding Styles */
    .app-branding {
      text-align: center;
      margin: 1rem 0 2rem 0;
      position: relative;
    }
    
    .app-title {
      margin: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }
    
    .app-name {
      font-size: 3.5rem;
      font-weight: 800;
      background: linear-gradient(135deg, #4776E6 0%, #8E54E9 50%, #FF6B6B 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: -2px;
      line-height: 1;
    }
    
    .app-tagline {
      font-size: 1.1rem;
      font-weight: 300;
      color: #adb5bd;
      font-style: italic;
      letter-spacing: 1px;
      opacity: 0.8;
      text-transform: lowercase;
    }
    
    .brand-decoration {
      width: 120px;
      height: 4px;
      background: linear-gradient(90deg, transparent 0%, #4776E6 20%, #8E54E9 50%, #FF6B6B 80%, transparent 100%);
      margin: 1.5rem auto 0;
      border-radius: 2px;
      opacity: 0.7;
    }
    
    /* Responsive App Branding */
    @media (max-width: 768px) {
      .app-name { font-size: 2.5rem; }
      .app-tagline { font-size: 1rem; }
      .brand-decoration { width: 80px; height: 3px; }
    }
    
    @media (max-width: 480px) {
      .app-name { font-size: 2rem; }
      .app-tagline { font-size: 0.9rem; }
      .brand-decoration { width: 60px; height: 2px; }
    }
    
    
    /* Desktop optimizations for compact header */
    @media (min-width: 768px) {
      ion-header {
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
      
      ion-toolbar {
        --min-height: 44px;
        /* Padding now inherited from global :root variables */
      }
      
    }
    
    /* Header Info Styles */
    .header-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-right: 0.5rem;
    }
    
    .user-greeting {
      color: #f8f9fa;
      font-size: 0.8rem;
      font-weight: 500;
      white-space: nowrap;
    }
    
    .compact-sync-status {
      opacity: 0.8;
    }
    
    @media (max-width: 767px) {
      .header-info {
        display: none;
      }
    }
    
    /* Burger Menu Styles */
    .burger-menu-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 9998;
      backdrop-filter: blur(2px);
    }
    
    .burger-menu {
      position: fixed;
      top: 0;
      right: -320px;
      width: 320px;
      height: 100%;
      background: 
        /* Enhanced dark overlay with gradient for depth */
        linear-gradient(135deg, rgba(15, 15, 25, 0.95) 0%, rgba(10, 10, 20, 0.95) 50%, rgba(20, 20, 35, 0.95) 100%),
        /* Main anime image */
        url('/assets/cyberpunk-anime-girl.png'),
        /* Fallback dark background */
        #1a1a2e;
      background-size: cover, cover, auto;
      background-position: center, center, center;
      background-repeat: no-repeat, no-repeat, repeat;
      border-left: 2px solid rgba(139, 180, 248, 0.3);
      z-index: 9999;
      transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
      box-shadow: -8px 0 40px rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }
    
    .burger-menu.open {
      right: 0;
    }
    
    .burger-menu-content {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 0;
    }
    
    .burger-menu-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem 1.25rem;
      border-bottom: 2px solid rgba(139, 180, 248, 0.2);
      background: linear-gradient(135deg, rgba(15, 15, 25, 0.8) 0%, rgba(10, 10, 20, 0.8) 100%);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      box-shadow: 0 2px 15px rgba(0, 0, 0, 0.4);
      position: relative;
    }
    
    .burger-menu-header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, rgba(139, 180, 248, 0.05) 0%, rgba(71, 118, 230, 0.05) 100%);
      z-index: -1;
    }
    
    .burger-menu-header h3 {
      margin: 0;
      background: linear-gradient(135deg, #ffffff 0%, #8bb4f8 50%, #4776e6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-size: 1.4rem;
      font-weight: 800;
      letter-spacing: 1px;
      text-shadow: 0 2px 10px rgba(139, 180, 248, 0.3);
    }
    
    .burger-menu-header ion-button {
      --color: rgba(255, 255, 255, 0.8);
      --background: rgba(255, 255, 255, 0.1);
      --background-hover: rgba(255, 255, 255, 0.2);
      --border-radius: 12px;
      --padding-start: 8px;
      --padding-end: 8px;
      transition: all 0.3s ease;
    }
    
    .burger-menu-header ion-button:hover {
      transform: scale(1.1) rotate(90deg);
      --background: rgba(255, 107, 107, 0.2);
      --color: #ff6b6b;
    }
    
    .burger-menu-items {
      flex: 1;
      padding: 1.5rem 0;
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      overflow-y: auto;
    }
    
    .burger-menu-items ion-button {
      --color: #ffffff;
      --background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(139, 180, 248, 0.08) 100%);
      --background-hover: linear-gradient(135deg, rgba(71, 118, 230, 0.25) 0%, rgba(139, 180, 248, 0.25) 100%);
      --background-focused: linear-gradient(135deg, rgba(71, 118, 230, 0.3) 0%, rgba(139, 180, 248, 0.3) 100%);
      --ripple-color: rgba(139, 180, 248, 0.4);
      margin: 0 1.25rem 0.5rem 1.25rem;
      height: 54px;
      font-size: 1.05rem;
      font-weight: 500;
      justify-content: flex-start;
      text-align: left;
      border: 1px solid rgba(139, 180, 248, 0.2);
      border-radius: 16px;
      backdrop-filter: blur(15px);
      -webkit-backdrop-filter: blur(15px);
      transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
      position: relative;
      overflow: hidden;
    }
    
    .burger-menu-items ion-button::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
      transition: left 0.6s ease;
    }
    
    .burger-menu-items ion-button:hover::before {
      left: 100%;
    }
    
    .burger-menu-items ion-button:hover {
      --background: linear-gradient(135deg, rgba(71, 118, 230, 0.35) 0%, rgba(139, 180, 248, 0.35) 100%);
      border-color: rgba(139, 180, 248, 0.6);
      transform: translateY(-3px) scale(1.02);
      box-shadow: 0 8px 25px rgba(71, 118, 230, 0.4);
    }
    
    .burger-menu-items ion-button ion-icon {
      margin-right: 16px;
      font-size: 1.3rem;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
    }
    
    .burger-menu-footer {
      border-top: 2px solid rgba(139, 180, 248, 0.2);
      padding: 1.5rem 1.25rem;
      margin-top: auto;
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
      background: linear-gradient(135deg, rgba(15, 15, 25, 0.9) 0%, rgba(10, 10, 20, 0.9) 100%);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
      position: relative;
    }
    
    .burger-menu-footer::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, rgba(255, 107, 107, 0.03) 0%, rgba(220, 53, 69, 0.03) 100%);
      z-index: -1;
    }
    
    .burger-menu-footer ion-button {
      --color: #ff8a8a;
      --background: linear-gradient(135deg, rgba(255, 107, 107, 0.15) 0%, rgba(220, 53, 69, 0.15) 100%);
      --background-hover: linear-gradient(135deg, rgba(255, 107, 107, 0.3) 0%, rgba(220, 53, 69, 0.3) 100%);
      --background-focused: linear-gradient(135deg, rgba(255, 107, 107, 0.35) 0%, rgba(220, 53, 69, 0.35) 100%);
      --ripple-color: rgba(255, 107, 107, 0.4);
      border: 1px solid rgba(255, 107, 107, 0.3);
      border-radius: 16px;
      height: 48px;
      font-weight: 600;
      transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
      position: relative;
      overflow: hidden;
    }
    
    .burger-menu-footer ion-button:hover {
      transform: translateY(-2px) scale(1.02);
      box-shadow: 0 8px 25px rgba(255, 107, 107, 0.4);
      border-color: rgba(255, 107, 107, 0.6);
      -webkit-backdrop-filter: blur(8px);
      transition: all 0.3s ease;
    }
    
    .full-sync-status {
      align-self: stretch;
    }
    
    /* Burger Menu Footer Content */
    .burger-menu-footer-content {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    
    .version-info {
      display: flex;
      justify-content: center;
      padding-top: 0.5rem;
      margin-top: auto;
    }
    
    .version-chip {
      --background: rgba(139, 180, 248, 0.15);
      --color: #8bb4f8;
      border: 1px solid rgba(139, 180, 248, 0.3);
      font-size: 0.75rem;
      height: 24px;
    }
    
    /* Ensure burger menu can scroll on mobile */
    @media (max-width: 768px) {
      .burger-menu {
        max-height: 100vh;
        max-height: -webkit-fill-available;
        overflow: hidden;
      }
      
      .burger-menu-content {
        max-height: 100vh;
        max-height: -webkit-fill-available;
        overflow: hidden;
      }
      
      .burger-menu-items {
        min-height: 0;
        flex-shrink: 1;
      }
      
      .burger-menu-footer {
        flex-shrink: 0;
      }
    }
    
    .action-buttons {
      display: flex;
      gap: 1rem;
      margin: 0 auto 1rem;
      max-width: 600px;
      flex-wrap: wrap;
      padding: 0.5rem 0;
      overflow: visible;
    }
    
    /* Reorder button active state */
    :host ::ng-deep app-header ion-button.reorder-active {
      --background: rgba(71, 118, 230, 0.2);
      --color: #4776E6;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0% {
        box-shadow: 0 0 0 0 rgba(71, 118, 230, 0.4);
      }
      70% {
        box-shadow: 0 0 0 10px rgba(71, 118, 230, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(71, 118, 230, 0);
      }
    }
    
    .action-buttons ion-button {
      flex: 1;
      min-width: 160px;
      --color: rgba(255, 255, 255, 0.95);
      --background: rgba(255, 255, 255, 0.04);
      --background-hover: rgba(139, 180, 248, 0.15);
      --background-focused: rgba(139, 180, 248, 0.2);
      --ripple-color: rgba(139, 180, 248, 0.3);
      --border-width: 0.5px;
      min-height: 36px;
      font-size: 0.9rem;
      font-weight: 500;
      justify-content: flex-start;
      text-align: left;
      border-radius: 8px;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
      /* Padding now inherited from global :root variables */
    }
    
    .action-buttons ion-button::before {
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
    
    .action-buttons ion-button:hover {
      --background: rgba(139, 180, 248, 0.15);
      transform: scale(1.02);
      box-shadow: 0 2px 8px rgba(139, 180, 248, 0.2);
    }
    
    .action-buttons ion-button:hover::before {
      left: 100%;
    }
    
    .action-buttons ion-button ion-icon {
      position: relative;
      z-index: 2;
      margin-right: 8px;
      font-size: 1rem;
    }
    
    /* Custom Mobile FAB */
    .mobile-fab-container {
      display: none;
    }
    
    @media (max-width: 767px) {
      .mobile-fab-container {
        display: block;
        position: fixed;
        bottom: 100px;
        right: 20px;
        z-index: 9999;
      }
    }
    
    .mobile-fab-button {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(71, 118, 230, 0.8) 0%, rgba(139, 180, 248, 0.8) 100%);
      color: #f8f9fa;
      border: 2px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 6px 20px rgba(71, 118, 230, 0.4);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    
    .mobile-fab-button:hover {
      background: linear-gradient(135deg, rgba(71, 118, 230, 0.9) 0%, rgba(139, 180, 248, 0.9) 100%);
      border-color: rgba(255, 255, 255, 0.5);
      box-shadow: 0 8px 25px rgba(71, 118, 230, 0.6);
      transform: translateY(-2px);
    }
    
    .mobile-fab-button:active {
      transform: scale(0.95);
    }
    
    .mobile-fab-menu {
      position: absolute;
      bottom: 70px;
      right: 0;
      background: 
        linear-gradient(rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.8)),
        url('/assets/cyberpunk-anime-girl.png'),
        rgba(45, 45, 45, 0.95);
      background-size: cover, cover, auto;
      background-position: center, center, center;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      padding: 8px;
      backdrop-filter: blur(15px);
      -webkit-backdrop-filter: blur(15px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
      min-width: 160px;
    }
    
    .mobile-fab-option {
      display: flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(135deg, rgba(20, 20, 20, 0.3) 0%, rgba(15, 15, 15, 0.3) 100%);
      color: #f8f9fa;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 12px 16px;
      width: 100%;
      text-align: left;
      cursor: pointer;
      margin-bottom: 4px;
      transition: all 0.3s ease;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
    
    .mobile-fab-option:hover {
      background: linear-gradient(135deg, rgba(71, 118, 230, 0.3) 0%, rgba(139, 180, 248, 0.3) 100%);
      border-color: rgba(71, 118, 230, 0.5);
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(71, 118, 230, 0.3);
    }
    
    .mobile-fab-option:last-child {
      margin-bottom: 0;
    }
    
    .mobile-fab-option ion-icon {
      font-size: 20px;
    }
    
    
    /* Hide action buttons on mobile, show FAB */
    @media (max-width: 767px) {
      .story-list-container {
        padding-bottom: 4rem;
      }
      
      .action-buttons {
        display: none;
      }
    }
    
    @media (max-width: 480px) {
      .story-list-container {
        padding: 1rem 0.5rem 4rem;
      }
      
      
      .stories-grid {
        grid-template-columns: 1fr;
        gap: 0.75rem;
        padding: 0;
      }
    }
    
    .stories-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
      padding: 0;
    }
    
    .story-card {
      margin: 0;
      transition: all 0.3s ease;
      background: linear-gradient(135deg, rgba(20, 20, 20, 0.1) 0%, rgba(15, 15, 15, 0.1) 100%);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(2px) saturate(120%);
      -webkit-backdrop-filter: blur(2px) saturate(120%);
    }
    
    .story-card:not(.reordering-enabled):hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      border-color: rgba(71, 118, 230, 0.3);
      background: linear-gradient(135deg, rgba(25, 25, 25, 0.15) 0%, rgba(20, 20, 20, 0.15) 100%);
    }
    
    .story-card.reordering-enabled {
      cursor: move;
      border: 2px dashed rgba(139, 180, 248, 0.4);
    }
    
    .story-card.reordering-enabled:hover {
      border-color: rgba(139, 180, 248, 0.6);
      background: rgba(139, 180, 248, 0.05);
    }

    .story-cover {
      position: relative;
      width: 100%;
      height: 180px;
      overflow: hidden;
      border-radius: 16px 16px 0 0;
    }

    .story-cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s ease;
    }

    .story-card:hover .story-cover img {
      transform: scale(1.05);
    }

    .cover-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 50%;
      background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
      pointer-events: none;
    }

    ion-card-header.with-cover {
      position: relative;
      z-index: 2;
      margin-top: -40px;
      background: transparent;
      border-radius: 12px;
      margin-left: 12px;
      margin-right: 12px;
    }

    ion-card-header.with-cover::before {
      display: none; /* Remove the default overlay for cards with cover images */
    }
    
    
    .card-header-content {
      display: flex;
      align-items: flex-start;
      width: 100%;
      gap: 8px;
    }
    
    .drag-handle {
      --color: rgba(255, 255, 255, 0.6);
      --background: transparent;
      cursor: move;
      flex-shrink: 0;
      --padding-start: 4px;
      --padding-end: 4px;
    }
    
    .drag-handle:hover {
      --color: rgba(255, 255, 255, 0.9);
      --background: rgba(255, 255, 255, 0.1);
    }
    
    /* Make drag handle bigger on mobile for easier grabbing */
    @media (max-width: 767px) {
      .drag-handle {
        --padding-start: 8px;
        --padding-end: 8px;
        min-width: 44px;
        min-height: 44px;
      }
      
      .drag-handle ion-icon {
        font-size: 24px;
      }
    }
    
    /* Ensure proper cursor based on mode */
    .story-card:not(.reordering-enabled) {
      cursor: pointer;
    }
    
    .story-card.reordering-enabled {
      cursor: move;
    }
    
    .story-card.cdk-drag-dragging {
      cursor: move;
    }
    
    .card-header-content ion-card-title {
      flex: 1;
      font-size: 1.3rem;
      font-weight: 700;
      color: #f8f9fa;
      line-height: 1.3;
      transition: all 0.3s ease;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8), 0 1px 2px rgba(0, 0, 0, 0.6);
    }
    
    .story-card:hover .card-header-content ion-card-title {
      color: #a8c5f9;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
    }
    
    .story-preview {
      color: #e0e0e0;
      line-height: 1.4;
      margin: 0 0 12px 0;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      font-size: 0.9rem;
      opacity: 0.95;
      transition: all 0.3s ease;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
    }
    
    .story-card:hover .story-preview {
      opacity: 1;
      color: #f0f0f0;
      transform: translateY(-2px);
    }
    
    .story-chips {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    
    .story-chips ion-chip {
      font-size: 0.75rem;
      --background: rgba(71, 118, 230, 0.15);
      --color: #8bb4f8;
      border: 1px solid rgba(71, 118, 230, 0.3);
      height: 28px;
      border-radius: 14px;
    }
    
    ion-card {
      --background: transparent;
      --color: #f8f9fa;
      box-shadow: none;
      cursor: pointer;
      margin: 0;
    }
    
    ion-card-header {
      --background: transparent;
      padding: 16px 16px 12px 16px;
      position: relative;
    }
    
    ion-card-header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.2);
      z-index: -1;
      border-radius: 16px 16px 0 0;
    }
    
    ion-card-content {
      padding: 0 16px 16px 16px;
    }
    
    .no-stories {
      text-align: center;
      padding: 4rem 2rem;
      color: #adb5bd;
      background: linear-gradient(135deg, rgba(42, 42, 42, 0.3) 0%, rgba(31, 31, 31, 0.3) 100%);
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      margin: 2rem 0;
    }
    
    .no-stories p {
      margin-bottom: 2rem;
      font-size: 1.2rem;
      line-height: 1.6;
      opacity: 0.8;
    }
    
    .no-stories ion-button {
      --background: linear-gradient(135deg, #4776E6 0%, #8E54E9 100%);
      --border-radius: 12px;
      font-weight: 600;
      height: 48px;
    }
    
    /* CDK Drag and Drop Styles */
    .cdk-drag-preview {
      box-sizing: border-box;
      border-radius: 16px;
      box-shadow: 0 8px 25px rgba(71, 118, 230, 0.4);
      transform: rotate(5deg);
      opacity: 0.8;
    }
    
    .cdk-drag-placeholder {
      opacity: 0.4;
      transform: scale(0.95);
      background: rgba(139, 180, 248, 0.1) !important;
      border: 2px dashed rgba(139, 180, 248, 0.5) !important;
    }
    
    .cdk-drop-list.cdk-drop-list-receiving .cdk-drag-placeholder {
      transform: scale(1.05);
    }
    
    .cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }
    
    .stories-grid.cdk-drop-list-dragging .story-card:not(.cdk-drag-placeholder) {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }
    
  `]
})
export class StoryListComponent implements OnInit {
  private storyService = inject(StoryService);
  private router = inject(Router);
  private authService = inject(AuthService);
  private headerNavService = inject(HeaderNavigationService);
  versionService = inject(VersionService);

  @ViewChild('burgerMenuFooter', { static: true }) burgerMenuFooter!: TemplateRef<unknown>;
  stories: Story[] = [];
  currentUser: User | null = null;
  fabMenuOpen = false;
  burgerMenuItems: BurgerMenuItem[] = [];
  rightActions: HeaderAction[] = [];
  reorderingEnabled = false;

  constructor() {
    // Register Ionic icons
    addIcons({ add, download, settings, statsChart, trash, create, images, menu, close, reorderThree, swapVertical, move, appsOutline });
  }

  ngOnInit(): void {
    this.loadStories().then(() => {
      // Setup right actions after stories are loaded
      this.setupRightActions();
    });
    
    // Subscribe to user changes
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      // Reload stories when user changes (different database)
      this.loadStories().then(() => {
        this.setupRightActions();
      });
    });
    
    // Subscribe to version changes and setup right actions when version is available
    this.versionService.version$.subscribe(version => {
      if (version) {
        this.setupRightActions();
      }
    });
    
    // Setup burger menu items
    this.setupBurgerMenu();
  }
  
  private setupRightActions(): void {
    this.rightActions = [];
    
    // Add reorder toggle button if there are multiple stories
    if (this.stories.length > 1) {
      this.rightActions.push({
        icon: 'apps-outline',
        action: () => this.toggleReordering(),
        showOnMobile: true,
        showOnDesktop: true,
        cssClass: this.reorderingEnabled ? 'reorder-active' : '',
        tooltip: this.reorderingEnabled ? 'Sortierung beenden' : 'Stories sortieren'
      });
    }
    
    // Add version chip (version is guaranteed to be available when this is called)
    this.rightActions.push({
      icon: '',
      chipContent: this.versionService.getShortVersion(),
      chipColor: 'medium',
      action: () => { /* No action needed for version chip */ },
      showOnMobile: true,
      showOnDesktop: true,
      showVersionTooltip: true
    });
  }

  logout(): void {
    if (confirm('Do you really want to sign out? Local changes will be preserved.')) {
      this.authService.logout();
    }
  }

  async loadStories(): Promise<void> {
    this.stories = await this.storyService.getAllStories();
  }

  async drop(event: CdkDragDrop<Story[]>): Promise<void> {
    if (event.previousIndex !== event.currentIndex) {
      // Move item in local array
      moveItemInArray(this.stories, event.previousIndex, event.currentIndex);
      
      try {
        // Persist the new order to the database
        await this.storyService.reorderStories(this.stories);
      } catch (error) {
        console.error('Failed to save story order:', error);
        // Reload stories to reset to previous state if save fails
        await this.loadStories();
      }
    }
  }
  
  toggleReordering(): void {
    this.reorderingEnabled = !this.reorderingEnabled;
    // Update the header actions to reflect the new state
    this.setupRightActions();
    
    // Optionally show feedback when toggling reorder mode
    if (this.reorderingEnabled) {
      console.log('Reordering mode enabled - drag stories to reorder');
    } else {
      console.log('Reordering mode disabled - click stories to open');
    }
  }

  toggleFabMenu(): void {
    this.fabMenuOpen = !this.fabMenuOpen;
  }

  onBurgerMenuToggle(): void {
    // Handle burger menu state changes if needed
  }
  
  private setupBurgerMenu(): void {
    this.burgerMenuItems = [
      ...this.headerNavService.getStoryBurgerMenuItems()
    ];
  }

  async createNewStory(): Promise<void> {
    this.fabMenuOpen = false;
    const newStory = await this.storyService.createStory();
    this.router.navigate(['/stories/editor', newStory.id]);
  }

  openStory(storyId: string): void {
    this.router.navigate(['/stories/editor', storyId]);
  }

  goToSettings(): void {
    this.router.navigate(['/settings']);
  }

  goToAILogger(): void {
    this.router.navigate(['/logs']);
  }

  importNovelCrafter(): void {
    this.fabMenuOpen = false;
    this.router.navigate(['/stories/import/novelcrafter']);
  }

  goToImageGeneration(): void {
    this.fabMenuOpen = false;
    this.router.navigate(['/stories/image-generation']);
  }

  async deleteStory(event: Event, storyId: string): Promise<void> {
    event.stopPropagation();
    if (confirm('Do you really want to delete this story?')) {
      await this.storyService.deleteStory(storyId);
      await this.loadStories();
    }
  }

  getStoryPreview(story: Story): string {
    // For legacy stories with content
    if (story.content) {
      const cleanContent = this.stripHtmlTags(story.content);
      return cleanContent.length > 150 ? cleanContent.substring(0, 150) + '...' : cleanContent;
    }
    
    // For new chapter/scene structure
    if (story.chapters && story.chapters.length > 0 && story.chapters[0].scenes && story.chapters[0].scenes.length > 0) {
      const firstScene = story.chapters[0].scenes[0];
      const content = firstScene.content || '';
      const cleanContent = this.stripHtmlTags(content);
      return cleanContent.length > 150 ? cleanContent.substring(0, 150) + '...' : cleanContent;
    }
    
    return 'No content yet...';
  }

  getWordCount(story: Story): number {
    // For legacy stories with content
    if (story.content) {
      const cleanContent = this.stripHtmlTags(story.content);
      return cleanContent.trim().split(/\s+/).filter(word => word.length > 0).length;
    }
    
    // For new chapter/scene structure - count all scenes
    let totalWords = 0;
    if (story.chapters) {
      story.chapters.forEach(chapter => {
        if (chapter.scenes) {
          chapter.scenes.forEach(scene => {
            const content = scene.content || '';
            const cleanContent = this.stripHtmlTags(content);
            totalWords += cleanContent.trim().split(/\s+/).filter(word => word.length > 0).length;
          });
        }
      });
    }
    
    return totalWords;
  }

  getCoverImageUrl(story: Story): string | null {
    if (!story.coverImage) return null;
    return `data:image/png;base64,${story.coverImage}`;
  }

  private stripHtmlTags(html: string): string {
    if (!html) return '';
    
    // First remove Beat AI nodes completely (they are editor-only components)
    const cleanHtml = html.replace(/<div[^>]*class="beat-ai-node"[^>]*>.*?<\/div>/gs, '');
    
    // Create a temporary DOM element to safely strip remaining HTML tags
    const div = document.createElement('div');
    div.innerHTML = cleanHtml;
    
    // Get text content and normalize whitespace
    const textContent = div.textContent || div.innerText || '';
    
    // Remove any remaining Beat AI artifacts that might appear as plain text
    return textContent
      .replace(/🎭\s*Beat\s*AI/gi, '')
      .replace(/Prompt:\s*/gi, '')
      .replace(/BeatAIPrompt/gi, '')
      .trim()
      .replace(/\s+/g, ' '); // Normalize whitespace
  }
}