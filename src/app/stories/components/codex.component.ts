import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel,
  IonSearchbar, IonList, IonChip, IonTextarea, IonInput, IonButton, IonIcon,
  IonModal, IonGrid, IonRow, IonCol, IonText, IonNote, IonButtons, IonToolbar, IonTitle, IonHeader,
  IonSelect, IonSelectOption, IonToggle
} from '@ionic/angular/standalone';
import { AppHeaderComponent, HeaderAction } from '../../shared/components/app-header.component';
import { addIcons } from 'ionicons';
import {
  arrowBack, add, ellipsisVertical, create, trash, save, close,
  search, person, bookmark, pricetag, star
} from 'ionicons/icons';
import { CodexService } from '../services/codex.service';
import { Codex, CodexCategory, CodexEntry, STORY_ROLES, CustomField, StoryRole } from '../models/codex.interface';

@Component({
  selector: 'app-codex',
  standalone: true,
  imports: [
    CommonModule, FormsModule, NgSelectModule, AppHeaderComponent,
    IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel,
    IonSearchbar, IonList, IonChip, IonTextarea, IonInput, IonButton, IonIcon,
    IonModal, IonGrid, IonRow, IonCol, IonText, IonNote, IonButtons, IonToolbar, IonTitle, IonHeader,
    IonSelect, IonSelectOption, IonToggle
  ],
  template: `
    <div class="ion-page">
      <!-- Header -->
      <app-header 
        title="Codex" 
        [showBackButton]="true"
        [backAction]="goBack.bind(this)"
        [rightActions]="headerActions"
        [showSecondaryToolbar]="true"
        [secondaryContent]="searchToolbar">
      </app-header>
      
      <ng-template #searchToolbar>
        <ion-searchbar
          placeholder="Search by title, content, or tags..."
          [(ngModel)]="searchQuery"
          (ionInput)="onSearch()"
          debounce="300">
        </ion-searchbar>
      </ng-template>

      <!-- Content -->
      <ion-content>
        <ion-grid class="codex-grid">
          <ion-row>
            <!-- Sidebar with categories -->
            <ion-col size="12" size-md="3" class="categories-sidebar">
              <ion-card>
                <ion-card-header>
                  <ion-card-title>Categories</ion-card-title>
                </ion-card-header>
                <ion-card-content>
                  <ion-list>
                    <ion-item 
                      *ngFor="let category of sortedCategories()" 
                      button
                      [class.active-category]="selectedCategoryId() === category.id"
                      (click)="selectCategory(category.id)">
                      <ion-icon [name]="getDefaultIcon()" slot="start"></ion-icon>
                      <ion-label>
                        <h3>{{ category.icon }} {{ category.title }}</h3>
                        <p>{{ category.entries.length }} entries</p>
                      </ion-label>
                      <ion-button 
                        fill="clear" 
                        size="small"
                        (click)="$event.stopPropagation(); toggleCategoryMenu(category.id)"
                        slot="end">
                        <ion-icon name="ellipsis-vertical" slot="icon-only"></ion-icon>
                      </ion-button>
                      
                      <!-- Category menu -->
                      <ion-list *ngIf="categoryMenuId() === category.id" class="category-menu">
                        <ion-item button (click)="editCategory()">
                          <ion-icon name="create" slot="start"></ion-icon>
                          <ion-label>Edit</ion-label>
                        </ion-item>
                        <ion-item button (click)="deleteCategory(category.id)" color="danger">
                          <ion-icon name="trash" slot="start"></ion-icon>
                          <ion-label>Delete</ion-label>
                        </ion-item>
                      </ion-list>
                    </ion-item>
                  </ion-list>
                </ion-card-content>
              </ion-card>
            </ion-col>

            <!-- Main content area -->
            <ion-col size="12" size-md="9" class="entries-main">
              <div *ngIf="searchQuery(); else normalView">
                <ion-card>
                  <ion-card-header>
                    <ion-card-title>Search results for "{{ searchQuery() }}"</ion-card-title>
                  </ion-card-header>
                  <ion-card-content>
                    <ion-grid>
                      <ion-row>
                        <ion-col *ngFor="let entry of searchResults()" size="12" size-md="6" size-lg="4">
                          <ion-card button (click)="selectEntry(entry)" class="entry-card">
                            <ion-card-header>
                              <ion-card-title>{{ entry.title }}</ion-card-title>
                            </ion-card-header>
                            <ion-card-content>
                              <ion-text color="medium">
                                <p>{{ getContentPreview(entry.content) }}</p>
                              </ion-text>
                              <div class="entry-meta">
                                <ion-chip color="primary">
                                  <ion-label>{{ getCategoryName(entry.categoryId) }}</ion-label>
                                </ion-chip>
                                <ion-chip *ngIf="entry.alwaysInclude" color="warning">
                                  <ion-icon name="star"></ion-icon>
                                  <ion-label>Always included</ion-label>
                                </ion-chip>
                                <ion-chip *ngIf="entry.metadata?.['storyRole']" color="success">
                                  <ion-icon name="person"></ion-icon>
                                  <ion-label>{{ entry.metadata?.['storyRole'] }}</ion-label>
                                </ion-chip>
                                <ion-chip *ngFor="let field of getCustomFields(entry)" color="secondary">
                                  <ion-label>{{ field.name }}: {{ getFieldValuePreview(field.value) }}</ion-label>
                                </ion-chip>
                                <ion-chip *ngFor="let tag of entry.tags" color="medium">
                                  <ion-icon name="pricetag"></ion-icon>
                                  <ion-label>{{ tag }}</ion-label>
                                </ion-chip>
                              </div>
                            </ion-card-content>
                          </ion-card>
                        </ion-col>
                      </ion-row>
                    </ion-grid>
                  </ion-card-content>
                </ion-card>
              </div>

              <ng-template #normalView>
                <div *ngIf="selectedCategory(); else selectCategoryPrompt">
                  <ion-card>
                    <ion-card-header>
                      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <ion-card-title>
                          {{ selectedCategory()!.icon }} {{ selectedCategory()!.title }}
                        </ion-card-title>
                        <ion-button 
                          fill="outline" 
                          size="small" 
                          (click)="createNewEntry()">
                          <ion-icon name="add" slot="start"></ion-icon>
                          Add Entry
                        </ion-button>
                      </div>
                    </ion-card-header>
                    <ion-card-content>
                      <ion-grid>
                        <ion-row>
                          <ion-col 
                            *ngFor="let entry of sortedEntries()" 
                            size="12" 
                            size-md="6" 
                            size-lg="4">
                            <ion-card button (click)="selectEntry(entry)" class="entry-card">
                              <ion-card-header>
                                <ion-card-title>{{ entry.title }}</ion-card-title>
                              </ion-card-header>
                              <ion-card-content>
                                <ion-text color="medium">
                                  <p>{{ getContentPreview(entry.content) }}</p>
                                </ion-text>
                                <div class="entry-meta">
                                  <ion-chip *ngIf="entry.alwaysInclude" color="warning">
                                    <ion-icon name="star"></ion-icon>
                                    <ion-label>Always included</ion-label>
                                  </ion-chip>
                                  <ion-chip *ngIf="entry.metadata?.['storyRole']" color="success">
                                    <ion-icon name="person"></ion-icon>
                                    <ion-label>{{ entry.metadata?.['storyRole'] }}</ion-label>
                                  </ion-chip>
                                  <ion-chip *ngFor="let field of getCustomFields(entry)" color="secondary">
                                    <ion-label>{{ field.name }}: {{ getFieldValuePreview(field.value) }}</ion-label>
                                  </ion-chip>
                                  <ion-chip *ngFor="let tag of entry.tags" color="medium">
                                    <ion-icon name="tag"></ion-icon>
                                    <ion-label>{{ tag }}</ion-label>
                                  </ion-chip>
                                  <ion-note>{{ formatDate(entry.updatedAt) }}</ion-note>
                                </div>
                              </ion-card-content>
                            </ion-card>
                          </ion-col>
                        </ion-row>
                      </ion-grid>
                    </ion-card-content>
                  </ion-card>
                </div>
              </ng-template>

              <ng-template #selectCategoryPrompt>
                <ion-card>
                  <ion-card-content class="ion-text-center">
                    <ion-text color="medium">
                      <h2>Choose a category</h2>
                      <p>Choose a category from the sidebar to see the entries.</p>
                    </ion-text>
                  </ion-card-content>
                </ion-card>
              </ng-template>
            </ion-col>
          </ion-row>
        </ion-grid>
      </ion-content>

      <!-- Entry Modal -->
      <ion-modal [isOpen]="!!selectedEntry()" (didDismiss)="closeEntryModal()" class="entry-modal">
        <ng-template>
          <ion-header>
            <ion-toolbar>
              <ion-title>{{ editingEntry.title || 'Edit Entry' }}</ion-title>
              <ion-buttons slot="end">
                <ion-button (click)="closeEntryModal()">
                  <ion-icon name="close" slot="icon-only"></ion-icon>
                </ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          
          <ion-content class="entry-modal-content">
            <div class="modal-form-container">
              <!-- Basic Information Section -->
              <div class="form-section">
                <h3 class="section-title">Basic Information</h3>
                
                <div class="form-group">
                  <ion-item lines="none" class="form-item">
                    <ion-label position="stacked">Title <span class="required">*</span></ion-label>
                    <ion-input 
                      [(ngModel)]="editingEntry.title" 
                      placeholder="Enter title..."
                      type="text"
                      class="title-input">
                    </ion-input>
                  </ion-item>
                </div>

                <!-- Tags Section -->
                <div class="form-group">
                  <ion-item lines="none" class="form-item">
                    <ion-label position="stacked">Tags</ion-label>
                    <ion-input 
                      [(ngModel)]="tagInput" 
                      (ionBlur)="parseAndAddTags()"
                      placeholder="Enter tags (comma-separated)..."
                      class="tag-input">
                    </ion-input>
                  </ion-item>
                  <ion-note class="tag-help-text">
                    Tags for identification in Beat-AI (e.g. Combat, Romance, Conflict)
                  </ion-note>
                  <div class="tags-container" *ngIf="editingEntry.tags?.length">
                    <ion-chip 
                      *ngFor="let tag of editingEntry.tags" 
                      (click)="removeTag(tag)"
                      color="primary"
                      class="tag-chip">
                      <ion-label>{{ tag }}</ion-label>
                      <ion-icon name="close" size="small"></ion-icon>
                    </ion-chip>
                  </div>
                </div>
              </div>

              <!-- Media Section -->
              <div class="form-section" *ngIf="editingEntry.imageUrl || !editingEntry.imageUrl">
                <h3 class="section-title">Media</h3>
                
                <div class="form-group">
                  <ion-item lines="none" class="form-item">
                    <ion-label position="stacked">Image URL</ion-label>
                    <ion-input 
                      [(ngModel)]="editingEntry.imageUrl" 
                      placeholder="https://example.com/image.jpg"
                      type="url"
                      class="url-input">
                    </ion-input>
                  </ion-item>
                  <div class="image-preview" *ngIf="editingEntry.imageUrl">
                    <img 
                      [src]="editingEntry.imageUrl" 
                      alt="Preview"
                      (error)="editingEntry.imageUrl = ''">
                  </div>
                </div>
              </div>
                
              <!-- Story Role Section -->
              <div class="form-section" *ngIf="isCharacterEntry()">
                <h3 class="section-title">Story Settings</h3>
                
                <div class="form-group">
                  <ion-item lines="none" class="form-item">
                    <ion-label position="stacked">Story Role</ion-label>
                    <ion-select 
                      [(ngModel)]="editingEntry.storyRole"
                      placeholder="Select role..."
                      interface="popover"
                      class="role-select">
                      <ion-select-option value="">No Role</ion-select-option>
                      <ion-select-option 
                        *ngFor="let role of storyRoles" 
                        [value]="role.value">
                        {{ role.label }}
                      </ion-select-option>
                    </ion-select>
                  </ion-item>
                </div>
              </div>
              
              <!-- Always Include Section -->
              <div class="form-section">
                <h3 class="section-title">AI Settings</h3>
                
                <div class="form-group">
                  <ion-item lines="none" class="form-item">
                    <ion-label position="stacked">Always include in beat prompt</ion-label>
                    <ion-toggle 
                      [(ngModel)]="editingEntry.alwaysInclude"
                      slot="end"
                      color="primary">
                    </ion-toggle>
                  </ion-item>
                  <ion-note color="medium" style="padding: 0 16px; font-size: 0.9rem;">
                    When enabled, this entry will always be included in the beat prompt, regardless of relevance scoring.
                  </ion-note>
                </div>
              </div>
                
              <!-- Custom Fields Section -->
              <div class="form-section">
                <div class="section-header">
                  <h3 class="section-title">Custom Fields</h3>
                  <ion-button 
                    size="small" 
                    fill="outline" 
                    color="primary"
                    [disabled]="!newCustomFieldName.trim()"
                    (click)="addCustomField()">
                    <ion-icon name="add" slot="start"></ion-icon>
                    Add Field
                  </ion-button>
                </div>
                  
                <!-- Existing custom fields -->
                <div class="custom-fields-container">
                  <div *ngFor="let field of editingEntry.customFields" class="custom-field-item">
                    <div class="custom-field-header">
                      <ion-item lines="none" class="form-item field-name-item">
                        <ion-label position="stacked">Field Name</ion-label>
                        <ion-input 
                          [(ngModel)]="field.name" 
                          placeholder="Enter field name...">
                        </ion-input>
                      </ion-item>
                      <ion-button 
                        fill="clear" 
                        color="danger"
                        size="small"
                        (click)="removeCustomField(field.id)"
                        class="remove-field-btn">
                        <ion-icon name="trash" slot="icon-only"></ion-icon>
                      </ion-button>
                    </div>
                    <ion-item lines="none" class="form-item">
                      <ion-label position="stacked">Field Value</ion-label>
                      <ion-textarea 
                        [(ngModel)]="field.value" 
                        placeholder="Enter field value..."
                        rows="3"
                        [autoGrow]="true"
                        class="scrollable-textarea"
                        (ionInput)="onTextareaInput($event)">
                      </ion-textarea>
                    </ion-item>
                  </div>
                  
                  <!-- Add new custom field form -->
                  <div class="new-custom-field">
                    <ion-item lines="none" class="form-item">
                      <ion-label position="stacked">New Field Name</ion-label>
                      <ion-input 
                        [(ngModel)]="newCustomFieldName" 
                        placeholder="Enter field name...">
                      </ion-input>
                    </ion-item>
                    <ion-item lines="none" class="form-item">
                      <ion-label position="stacked">Field Value</ion-label>
                      <ion-textarea 
                        [(ngModel)]="newCustomFieldValue" 
                        placeholder="Enter field value..."
                        rows="3"
                        [autoGrow]="true"
                        class="scrollable-textarea"
                        (ionInput)="onTextareaInput($event)">
                      </ion-textarea>
                    </ion-item>
                  </div>
                </div>
              </div>
                
              <!-- Content Section -->
              <div class="form-section">
                <h3 class="section-title">Content</h3>
                
                <div class="form-group">
                  <ion-item lines="none" class="form-item content-item">
                    <ion-label position="stacked">Description</ion-label>
                    <ion-textarea 
                      [(ngModel)]="editingEntry.content" 
                      placeholder="Description, details, notes..."
                      rows="8"
                      [autoGrow]="true"
                      class="content-textarea scrollable-textarea"
                      (ionInput)="onTextareaInput($event)">
                    </ion-textarea>
                  </ion-item>
                </div>
              </div>
                
              <!-- Action Buttons -->
              <div class="modal-actions">
                <ion-button (click)="deleteEntry()" fill="outline" color="danger" size="default">
                  <ion-icon name="trash" slot="start"></ion-icon>
                  Delete
                </ion-button>
                <ion-button (click)="saveEntry()" color="primary" size="default">
                  <ion-icon name="save" slot="start"></ion-icon>
                  Save
                </ion-button>
              </div>
            </div>
          </ion-content>
        </ng-template>
      </ion-modal>

      <!-- Add Category Modal -->
      <ion-modal [isOpen]="showAddCategoryModal()" (didDismiss)="showAddCategoryModal.set(false)" class="category-modal">
        <ng-template>
          <ion-header>
            <ion-toolbar>
              <ion-title>New Category</ion-title>
              <ion-buttons slot="end">
                <ion-button (click)="addCategory()" color="primary">
                  <ion-icon name="save" slot="start"></ion-icon>
                  Create
                </ion-button>
                <ion-button (click)="showAddCategoryModal.set(false)">
                  <ion-icon name="close" slot="icon-only"></ion-icon>
                </ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          
          <ion-content>
            <ion-card>
              <ion-card-content>
                <ion-item>
                  <ion-label position="stacked">Category Name</ion-label>
                  <ion-input 
                    [(ngModel)]="newCategory.title" 
                    placeholder="Category Name"
                    type="text">
                  </ion-input>
                </ion-item>
                
                <ion-item>
                  <ion-label position="stacked">Icon (Emoji)</ion-label>
                  <ion-input 
                    [(ngModel)]="newCategory.icon" 
                    placeholder="🏷️"
                    maxlength="2"
                    type="text">
                  </ion-input>
                </ion-item>
                
                <ion-item>
                  <ion-label position="stacked">Description (optional)</ion-label>
                  <ion-textarea 
                    [(ngModel)]="newCategory.description" 
                    placeholder="Description..."
                    rows="3"
                    [autoGrow]="true"
                    class="scrollable-textarea"
                    (ionInput)="onTextareaInput($event)">
                  </ion-textarea>
                </ion-item>
              </ion-card-content>
            </ion-card>
          </ion-content>
        </ng-template>
      </ion-modal>

    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100vh;
      position: relative;
      background: transparent;
    }
    
    .ion-page {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: transparent;
    }
    
    ion-content {
      --background: transparent !important;
      background: transparent !important;
      flex: 1;
      position: relative;
    }
    
    /* Remove mobile-specific overrides - use same layout as story-list */
    
    ion-content::part(background) {
      background: transparent !important;
    }

    .codex-grid {
      height: 100%;
      padding: 0.125rem;
      max-width: none;
    }
    
    /* Card padding now inherited from global :root variables */
    
    /* Grid and column spacing now inherited from global :root variables */

    .categories-sidebar {
      position: sticky;
      top: 0;
      height: fit-content;
    }
    
    /* Make category items more compact */
    .categories-sidebar ion-item {
      --min-height: 40px;
      --padding-top: 4px;
      --padding-bottom: 4px;
      --padding-start: 8px;
      --padding-end: 8px;
    }
    
    /* Make category titles smaller */
    .categories-sidebar ion-label h3 {
      font-size: 0.9rem !important;
      margin: 0 !important;
      font-weight: 500 !important;
    }
    
    .categories-sidebar ion-label p {
      font-size: 0.75rem !important;
      margin: 2px 0 0 0 !important;
    }
    
    /* Apply cyberpunk styling to all ion-cards */
    ion-card {
      background: linear-gradient(135deg, rgba(20, 20, 20, 0.3) 0%, rgba(15, 15, 15, 0.3) 100%);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      backdrop-filter: blur(8px) saturate(120%);
      -webkit-backdrop-filter: blur(8px) saturate(120%);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      transition: all 0.3s ease;
      --color: #f8f9fa;
    }
    
    ion-card-header {
      background: transparent !important;
      --background: transparent !important;
    }
    
    ion-card-title {
      color: #f8f9fa !important;
      --color: #f8f9fa !important;
      font-size: 1rem !important;
      font-weight: 600 !important;
    }
    
    ion-card-content {
      background: transparent !important;
      --background: transparent !important;
    }
    
    ion-card:hover {
      background: linear-gradient(135deg, rgba(25, 25, 25, 0.4) 0%, rgba(20, 20, 20, 0.4) 100%);
      border-color: rgba(71, 118, 230, 0.3);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
      transform: translateY(-2px);
    }
    

    /* Make ion-list and ion-items transparent */
    ion-list {
      background: transparent !important;
      --background: transparent !important;
    }
    
    ion-item {
      --background: transparent !important;
      --background-hover: rgba(255, 255, 255, 0.1) !important;
      --background-focused: rgba(255, 255, 255, 0.1) !important;
      --color: #f8f9fa !important;
      --border-color: rgba(255, 255, 255, 0.1) !important;
    }
    
    ion-item::part(native) {
      background: transparent !important;
    }
    
    .active-category {
      --background: linear-gradient(135deg, rgba(71, 118, 230, 0.3) 0%, rgba(143, 84, 233, 0.3) 100%) !important;
      --color: #f8f9fa !important;
      backdrop-filter: blur(5px);
    }
    
    .active-category::after {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background: linear-gradient(135deg, #4776E6 0%, #8E54E9 100%);
    }

    .category-menu {
      position: absolute;
      right: 1rem;
      top: 100%;
      background: linear-gradient(135deg, rgba(20, 20, 20, 0.95) 0%, rgba(15, 15, 15, 0.95) 100%);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      z-index: 100;
      min-width: 150px;
    }
    
    .category-menu ion-item {
      --background: transparent !important;
    }
    
    .category-menu ion-list {
      background: transparent !important;
    }

    .entries-main {
      padding: 0;
    }

    .entry-card {
      background: linear-gradient(135deg, rgba(20, 20, 20, 0.3) 0%, rgba(15, 15, 15, 0.3) 100%) !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-radius: 16px !important;
      backdrop-filter: blur(8px) saturate(120%) !important;
      -webkit-backdrop-filter: blur(8px) saturate(120%) !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2) !important;
      transition: all 0.3s ease;
      margin-bottom: 0.125rem;
      --background: transparent !important;
    }
    
    .entry-card::part(native) {
      background: transparent !important;
    }
    
    .entry-card ion-card-header,
    .entry-card ion-card-content {
      background: transparent !important;
      --background: transparent !important;
      /* Padding inherited from global :root variables */
    }
    
    .entry-card ion-card-title {
      color: #f8f9fa !important;
      --color: #f8f9fa !important;
      font-size: 0.9rem !important;
      font-weight: 600 !important;
    }
    
    .entry-card ion-text {
      --color: #e0e0e0 !important;
      color: #e0e0e0 !important;
    }

    .entry-card:hover {
      background: linear-gradient(135deg, rgba(25, 25, 25, 0.4) 0%, rgba(20, 20, 20, 0.4) 100%);
      border-color: rgba(71, 118, 230, 0.3);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
      transform: translateY(-4px);
    }

    .entry-meta {
      display: flex;
      gap: 2px;
      flex-wrap: wrap;
      align-items: center;
    }
    
    .entry-meta ion-chip {
      --background: rgba(71, 118, 230, 0.15) !important;
      --color: #8bb4f8 !important;
      border: 1px solid rgba(71, 118, 230, 0.3) !important;
      backdrop-filter: blur(5px);
      font-size: 0.7rem !important;
      height: 20px !important;
      margin: 1px !important;
      /* Padding now inherited from global :root variables */
    }
    
    /* Tag chips in search results and entry cards */
    .entry-meta ion-chip[color="medium"] {
      --background: rgba(146, 146, 146, 0.15) !important;
      --color: var(--ion-color-medium) !important;
      border: 1px solid rgba(146, 146, 146, 0.3) !important;
      font-size: 0.7rem !important;
      height: 20px !important;
    }
    
    .entry-meta ion-chip[color="medium"] ion-icon {
      font-size: 12px !important;
      margin-right: 2px !important;
    }
    
    .entry-meta ion-note {
      color: #adb5bd !important;
    }

    .tags-list {
      display: flex;
      gap: 0.125rem;
      flex-wrap: wrap;
      align-items: center;
    }

    @media (max-width: 768px) {
      .codex-grid {
        padding: 0.125rem;
      }
      
      .categories-sidebar {
        position: static;
      }
    }

    /* Entry Modal Styling */
    .entry-modal {
      --width: 85vw;
      --max-width: 750px;
      --height: 85vh;
      --border-radius: 16px;
      --background: linear-gradient(135deg, rgba(20, 20, 20, 0.92) 0%, rgba(15, 15, 15, 0.92) 100%);
      backdrop-filter: blur(20px) saturate(120%);
      --box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    }
    
    .entry-modal::part(backdrop) {
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(8px);
    }
    
    .entry-modal ion-header {
      background: transparent !important;
      --background: transparent !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px) saturate(120%);
    }
    
    .entry-modal ion-toolbar {
      --background: transparent !important;
      background: linear-gradient(135deg, rgba(20, 20, 20, 0.6) 0%, rgba(15, 15, 15, 0.6) 100%) !important;
      --border-width: 0;
      --padding-start: 20px;
      --padding-end: 20px;
      --min-height: 64px;
      --color: #f8f9fa;
    }
    
    .entry-modal ion-title {
      font-size: 1.2rem;
      font-weight: 600;
      letter-spacing: 0.5px;
      color: #f8f9fa !important;
    }
    
    .entry-modal ion-button {
      --color: #f8f9fa;
    }
    
    .entry-modal ion-content {
      --background: transparent;
    }

    @media (max-width: 768px) {
      .entry-modal {
        --width: 100vw;
        --height: 100vh;
        --border-radius: 0;
      }
    }

    .entry-modal-content {
      --padding-start: 0;
      --padding-end: 0;
      --padding-top: 0;
      --padding-bottom: 0;
    }

    .modal-form-container {
      padding: 0;
      max-width: none;
      background: transparent;
    }

    /* Form Sections */
    .form-section {
      background: linear-gradient(135deg, rgba(20, 20, 20, 0.4) 0%, rgba(15, 15, 15, 0.4) 100%);
      margin: 12px;
      padding: 16px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(10px) saturate(130%);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
      transition: all 0.3s ease;
    }
    
    .form-section:hover {
      background: linear-gradient(135deg, rgba(25, 25, 25, 0.5) 0%, rgba(20, 20, 20, 0.5) 100%);
      border-color: rgba(71, 118, 230, 0.25);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
    }

    .form-section:last-of-type {
      margin-bottom: 80px; /* Space for sticky action buttons */
    }

    .section-title {
      margin: 0 0 12px 0;
      font-size: 0.95rem;
      font-weight: 600;
      color: rgba(248, 249, 250, 0.95);
      display: flex;
      align-items: center;
      gap: 8px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }

    .section-title::before {
      content: '';
      width: 3px;
      height: 18px;
      background: linear-gradient(135deg, #4776E6 0%, #8E54E9 100%);
      border-radius: 2px;
      box-shadow: 0 0 6px rgba(71, 118, 230, 0.3);
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 12px;
    }

    /* Form Groups and Items */
    .form-group {
      margin-bottom: 16px;
    }

    .form-group:last-child {
      margin-bottom: 0;
    }

    .form-item {
      --background: transparent;
      --border-color: transparent;
      --border-width: 0;
      --border-style: none;
      --border-radius: 0;
      --padding-start: 0;
      --padding-end: 0;
      --inner-padding-start: 0;
      --inner-padding-end: 0;
      --min-height: auto;
      margin-bottom: 0;
    }

    .form-item ion-label {
      font-weight: 500;
      color: rgba(224, 224, 224, 0.9);
      margin-bottom: 4px;
      font-size: 0.9rem;
      letter-spacing: 0.2px;
    }

    .form-item ion-input,
    .form-item ion-textarea,
    .form-item ion-select {
      --background: rgba(0, 0, 0, 0.25);
      --padding-start: 12px;
      --padding-end: 12px;
      --padding-top: 10px;
      --padding-bottom: 10px;
      font-size: 0.93rem;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      margin-top: 4px;
      color: #f8f9fa;
      transition: all 0.3s ease;
    }
    
    .form-item ion-input:hover,
    .form-item ion-textarea:hover,
    .form-item ion-select:hover {
      --background: rgba(0, 0, 0, 0.35);
      border-color: rgba(255, 255, 255, 0.12);
    }
    
    .form-item ion-input:focus,
    .form-item ion-textarea:focus,
    .form-item ion-select:focus {
      --background: rgba(0, 0, 0, 0.4);
      border-color: rgba(71, 118, 230, 0.4);
      box-shadow: 0 0 0 2px rgba(71, 118, 230, 0.1);
    }

    .required {
      color: var(--ion-color-danger);
      font-weight: 600;
    }

    /* Specific Input Styling */
    .title-input {
      font-weight: 600;
      font-size: 1rem;
    }

    .content-item {
      --min-height: 100px;
    }

    .content-textarea {
      min-height: 100px;
      font-family: 'Georgia', serif;
      line-height: 1.5;
    }

    /* Tags Styling */
    .tags-container {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 12px;
      padding: 14px 16px;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      min-height: 56px;
      align-items: flex-start;
      align-content: flex-start;
      transition: all 0.3s ease;
    }
    
    .tags-container:hover {
      background: rgba(0, 0, 0, 0.3);
      border-color: rgba(255, 255, 255, 0.15);
    }

    .tag-help-text {
      display: block;
      margin-top: 8px;
      margin-left: 4px;
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.5);
      font-style: normal;
      letter-spacing: 0.2px;
    }

    .tag-chip {
      --background: linear-gradient(135deg, rgba(71, 118, 230, 0.2) 0%, rgba(143, 84, 233, 0.2) 100%);
      --color: #8bb4f8;
      border: 1px solid rgba(71, 118, 230, 0.3);
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 0.875rem;
      height: 32px;
      border-radius: 16px;
      backdrop-filter: blur(10px);
    }

    .tag-chip:hover {
      --background: linear-gradient(135deg, rgba(71, 118, 230, 0.3) 0%, rgba(143, 84, 233, 0.3) 100%);
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(71, 118, 230, 0.2);
      border-color: rgba(71, 118, 230, 0.5);
    }

    .tag-chip ion-icon {
      margin-left: 6px;
      font-size: 14px;
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    .tag-chip:hover ion-icon {
      opacity: 1;
      color: #ff4444;
    }

    /* Image Preview */
    .image-preview {
      margin-top: 8px;
      padding: 12px;
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      text-align: center;
      transition: all 0.3s ease;
    }
    
    .image-preview:hover {
      background: rgba(0, 0, 0, 0.3);
      border-color: rgba(255, 255, 255, 0.15);
    }

    .image-preview img {
      max-width: 100%;
      max-height: 200px;
      height: auto;
      border-radius: 8px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    /* Custom Fields Styling */
    .custom-fields-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .custom-field-item {
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      padding: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      transition: all 0.3s ease;
    }
    
    .custom-field-item:hover {
      background: rgba(0, 0, 0, 0.3);
      border-color: rgba(71, 118, 230, 0.3);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .custom-field-header {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      margin-bottom: 12px;
    }

    .field-name-item {
      flex: 1;
      margin-bottom: 0;
    }

    .remove-field-btn {
      --padding-start: 8px;
      --padding-end: 8px;
      --color: #ff6b6b;
      height: 40px;
      margin-bottom: 0;
      transition: all 0.2s ease;
    }
    
    .remove-field-btn:hover {
      --color: #ff4444;
      transform: scale(1.1);
    }

    .new-custom-field {
      background: rgba(71, 118, 230, 0.05);
      border: 2px dashed rgba(71, 118, 230, 0.2);
      border-radius: 8px;
      padding: 16px;
      transition: all 0.3s ease;
    }

    .new-custom-field:hover {
      border-color: rgba(71, 118, 230, 0.3);
      background: rgba(71, 118, 230, 0.1);
      box-shadow: 0 2px 8px rgba(71, 118, 230, 0.1);
    }

    /* Modal Actions */
    .modal-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      background: linear-gradient(135deg, rgba(20, 20, 20, 0.98) 0%, rgba(15, 15, 15, 0.98) 100%);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      position: sticky;
      bottom: 0;
      z-index: 10;
      backdrop-filter: blur(15px) saturate(150%);
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.4);
    }

    .modal-actions ion-button {
      --padding-start: 20px;
      --padding-end: 20px;
      --height: 42px;
      font-weight: 600;
      font-size: 0.92rem;
      letter-spacing: 0.4px;
      --border-radius: 10px;
      transition: all 0.3s ease;
    }
    
    .modal-actions ion-button[color="danger"] {
      --background: rgba(255, 67, 67, 0.1);
      --color: #ff6b6b;
      --border-width: 1px;
      --border-style: solid;
      --border-color: rgba(255, 67, 67, 0.3);
    }
    
    .modal-actions ion-button[color="danger"]:hover {
      --background: rgba(255, 67, 67, 0.2);
      --border-color: rgba(255, 67, 67, 0.5);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(255, 67, 67, 0.2);
    }
    
    .modal-actions ion-button[color="primary"] {
      --background: linear-gradient(135deg, #4776E6 0%, #8E54E9 100%);
      --color: white;
      box-shadow: 0 4px 12px rgba(71, 118, 230, 0.3);
    }
    
    .modal-actions ion-button[color="primary"]:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(71, 118, 230, 0.4);
    }

    /* Responsive adjustments */
    @media (max-width: 768px) {
      .form-section {
        padding: 16px;
      }

      .section-header {
        flex-direction: column;
        align-items: stretch;
      }

      .custom-field-header {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
      }

      .remove-field-btn {
        align-self: flex-end;
        width: fit-content;
      }

      .modal-actions {
        flex-direction: column-reverse;
        gap: 8px;
        padding: 16px;
      }

      .modal-actions ion-button {
        width: 100%;
      }
    }

    /* Focus states */
    .form-item ion-input.has-focus,
    .form-item ion-textarea.has-focus,
    .form-item ion-select.has-focus {
      border-color: var(--ion-color-primary);
      box-shadow: 0 0 0 2px var(--ion-color-primary-tint);
    }

    /* Loading and disabled states */
    .form-item[disabled] {
      opacity: 0.6;
      pointer-events: none;
    }

    /* Scrollable textarea improvements */
    .scrollable-textarea {
      min-height: 60px;
      max-height: 300px;
      --padding-start: 12px;
      --padding-end: 12px;
      --padding-top: 12px;
      --padding-bottom: 12px;
      resize: vertical;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: var(--ion-color-medium) transparent;
    }

    .scrollable-textarea::-webkit-scrollbar {
      width: 6px;
    }

    .scrollable-textarea::-webkit-scrollbar-track {
      background: transparent;
    }

    .scrollable-textarea::-webkit-scrollbar-thumb {
      background: var(--ion-color-medium);
      border-radius: 3px;
    }

    .scrollable-textarea::-webkit-scrollbar-thumb:hover {
      background: var(--ion-color-medium-shade);
    }

    /* Enhanced content textarea */
    .content-textarea {
      min-height: 120px;
      max-height: 400px;
    }

    /* Toggle styling */
    .form-item ion-toggle {
      --background: rgba(255, 255, 255, 0.1);
      --background-checked: linear-gradient(135deg, #4776E6 0%, #8E54E9 100%);
      --handle-background: #ffffff;
      --handle-background-checked: #ffffff;
      --handle-box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      padding-top: 12px;
      padding-bottom: 12px;
    }

    /* Dark mode is already the default theme - these styles are applied by default */
    .scrollable-textarea::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
    }

    .scrollable-textarea::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    /* Category Modal Styling - same as entry modal */
    .category-modal {
      --width: 90vw;
      --max-width: 600px;
      --height: auto;
      --border-radius: 16px;
      --background: linear-gradient(135deg, rgba(20, 20, 20, 0.95) 0%, rgba(15, 15, 15, 0.95) 100%);
      backdrop-filter: blur(20px) saturate(120%);
      --box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }
    
    .category-modal::part(backdrop) {
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(8px);
    }
    
    .category-modal ion-header {
      background: transparent !important;
      --background: transparent !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px) saturate(120%);
    }
    
    .category-modal ion-toolbar {
      --background: transparent !important;
      background: linear-gradient(135deg, rgba(20, 20, 20, 0.6) 0%, rgba(15, 15, 15, 0.6) 100%) !important;
      --border-width: 0;
      --padding-start: 20px;
      --padding-end: 20px;
      --min-height: 64px;
      --color: #f8f9fa;
    }
    
    .category-modal ion-title {
      font-size: 1.2rem;
      font-weight: 600;
      letter-spacing: 0.5px;
      color: #f8f9fa !important;
    }
    
    .category-modal ion-button {
      --color: #f8f9fa;
    }
    
    .category-modal ion-content {
      --background: transparent;
    }
  `]
})
export class CodexComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private codexService = inject(CodexService);
  private cdr = inject(ChangeDetectorRef);
  private subscriptions = new Subscription();

  storyId = signal<string>('');
  codex = signal<Codex | undefined>(undefined);
  selectedCategoryId = signal<string | null>(null);
  selectedEntry = signal<CodexEntry | null>(null);
  searchQuery = signal<string>('');
  searchResults = signal<CodexEntry[]>([]);
  categoryMenuId = signal<string | null>(null);

  // Modals
  showAddCategoryModal = signal<boolean>(false);

  // Form data
  newCategory = { title: '', icon: '', description: '' };
  editingEntry: Partial<CodexEntry> = {};
  tagInput = '';
  
  // Story roles
  storyRoles = STORY_ROLES;
  
  // Custom fields
  newCustomFieldName = '';
  newCustomFieldValue = '';
  
  headerActions: HeaderAction[] = [];

  constructor() {
    addIcons({
      arrowBack, add, ellipsisVertical, create, trash, save, close,
      search, person, bookmark, pricetag, star
    });
    this.initializeHeaderActions();
  }

  getDefaultIcon(): string {
    return 'bookmark';
  }

  // Computed values
  sortedCategories = computed(() => {
    const codex = this.codex();
    if (!codex) return [];
    return [...codex.categories].sort((a, b) => a.order - b.order);
  });

  selectedCategory = computed(() => {
    const codex = this.codex();
    const categoryId = this.selectedCategoryId();
    if (!codex || !categoryId) return null;
    return codex.categories.find((c: CodexCategory) => c.id === categoryId) || null;
  });

  sortedEntries = computed(() => {
    const category = this.selectedCategory();
    if (!category) return [];
    return [...category.entries].sort((a: CodexEntry, b: CodexEntry) => a.order - b.order);
  });

  ngOnInit() {
    this.subscriptions.add(
      this.route.params.subscribe(params => {
        const storyId = params['id'];
        this.storyId.set(storyId);
        this.loadCodex(storyId);
      })
    );
    
    // Subscribe to codex changes from service
    this.subscriptions.add(
      this.codexService.codex$.subscribe(codexMap => {
        const storyId = this.storyId();
        if (storyId && codexMap.has(storyId)) {
          const codex = codexMap.get(storyId);
          this.codex.set(codex);
          
          // Auto-select first category if none selected and categories exist
          if (codex && codex.categories.length > 0 && !this.selectedCategoryId()) {
            this.selectedCategoryId.set(codex.categories[0].id);
          }
          
          // Force change detection
          this.cdr.detectChanges();
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  private async loadCodex(storyId: string) {
    try {
      const codex = await this.codexService.getOrCreateCodex(storyId);
      this.codex.set(codex);
      
      // Auto-select first category if none selected
      if (codex.categories.length > 0 && !this.selectedCategoryId()) {
        this.selectedCategoryId.set(codex.categories[0].id);
      }
    } catch (error) {
      console.error('Error loading codex:', error);
    }
  }

  selectCategory(categoryId: string) {
    this.selectedCategoryId.set(categoryId);
    this.categoryMenuId.set(null);
  }

  selectEntry(entry: CodexEntry) {
    this.selectedEntry.set(entry);
    this.editingEntry = {
      ...entry,
      tags: entry.tags ? [...entry.tags] : [],
      storyRole: (entry.metadata?.['storyRole'] as StoryRole) || '',
      customFields: entry.metadata?.['customFields'] && Array.isArray(entry.metadata['customFields']) ? [...entry.metadata['customFields']] : [],
      alwaysInclude: entry.alwaysInclude || false
    };
    // Clear tag input - tags are already in editingEntry.tags
    this.tagInput = '';
    this.resetCustomFieldInputs();
  }

  closeEntryModal() {
    this.selectedEntry.set(null);
    this.editingEntry = {};
    this.resetCustomFieldInputs();
  }

  async addCategory() {
    const storyId = this.storyId();
    if (!storyId || !this.newCategory.title.trim()) return;

    try {
      await this.codexService.addCategory(storyId, this.newCategory);
      this.newCategory = { title: '', icon: '', description: '' };
      this.showAddCategoryModal.set(false);
    } catch (error) {
      console.error('Error adding category:', error);
    }
  }

  editCategory() {
    // TODO: Implement category editing
    this.categoryMenuId.set(null);
  }

  async deleteCategory(categoryId: string) {
    const storyId = this.storyId();
    if (!storyId) return;

    if (confirm('Delete category and all entries?')) {
      try {
        await this.codexService.deleteCategory(storyId, categoryId);
        if (this.selectedCategoryId() === categoryId) {
          const codex = this.codex();
          this.selectedCategoryId.set(codex?.categories[0]?.id || null);
        }
      } catch (error) {
        console.error('Error deleting category:', error);
      }
    }
    this.categoryMenuId.set(null);
  }

  async createNewEntry() {
    const storyId = this.storyId();
    const categoryId = this.selectedCategoryId();
    if (!storyId || !categoryId) return;

    try {
      // Create a new entry with default values
      const newEntry = {
        title: 'New Entry',
        content: '',
        tags: []
      };
      
      const createdEntry = await this.codexService.addEntry(storyId, categoryId, newEntry);
      
      // Directly open the edit dialog for the new entry
      this.selectEntry(createdEntry);
    } catch (error) {
      console.error('Error creating entry:', error);
    }
  }

  async saveEntry() {
    const storyId = this.storyId();
    const entry = this.selectedEntry();
    if (!storyId || !entry) return;

    try {
      // Parse tags before saving
      this.parseAndAddTags();
      
      // Prepare the updated entry with story role and custom fields in metadata
      const updatedEntry = {
        ...this.editingEntry,
        alwaysInclude: this.editingEntry.alwaysInclude || false,
        metadata: {
          ...this.editingEntry.metadata,
          storyRole: this.editingEntry.storyRole,
          customFields: this.editingEntry.customFields || []
        }
      };
      
      // Remove temporary fields from top level as they should be in metadata
      delete updatedEntry.storyRole;
      delete updatedEntry.customFields;

      await this.codexService.updateEntry(storyId, entry.categoryId, entry.id, updatedEntry);
      this.closeEntryModal();
    } catch (error) {
      console.error('Error saving entry:', error);
    }
  }

  async deleteEntry() {
    const storyId = this.storyId();
    const entry = this.selectedEntry();
    if (!storyId || !entry) return;

    if (confirm('Delete entry?')) {
      try {
        await this.codexService.deleteEntry(storyId, entry.categoryId, entry.id);
        this.closeEntryModal();
      } catch (error) {
        console.error('Error deleting entry:', error);
      }
    }
  }

  parseAndAddTags() {
    if (!this.tagInput || !this.tagInput.trim()) return;
    
    // Ensure tags array exists
    if (!this.editingEntry.tags) {
      this.editingEntry.tags = [];
    }
    
    // Parse comma-separated tags
    const newTags = this.tagInput
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .filter(tag => !this.editingEntry.tags!.includes(tag));
    
    // Add new tags
    this.editingEntry.tags.push(...newTags);
    
    // Clear input
    this.tagInput = '';
  }

  removeTag(tag: string) {
    if (!this.editingEntry.tags) return;
    
    const index = this.editingEntry.tags.indexOf(tag);
    if (index > -1) {
      this.editingEntry.tags.splice(index, 1);
    }
  }

  onSearch() {
    const query = this.searchQuery();
    const storyId = this.storyId();
    
    if (!query.trim() || !storyId) {
      this.searchResults.set([]);
      return;
    }

    const results = this.codexService.searchEntries(storyId, query);
    this.searchResults.set(results);
  }

  toggleCategoryMenu(categoryId: string) {
    this.categoryMenuId.set(
      this.categoryMenuId() === categoryId ? null : categoryId
    );
  }

  getCategoryName(categoryId: string): string {
    const codex = this.codex();
    if (!codex) return '';
    const category = codex.categories.find((c: CodexCategory) => c.id === categoryId);
    return category?.title || '';
  }

  getContentPreview(content: string): string {
    return content.length > 100 ? content.substring(0, 100) + '...' : content;
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }

  isCharacterEntry(): boolean {
    const category = this.selectedCategory();
    return category?.title === 'Characters' || false;
  }

  addCustomField() {
    const name = this.newCustomFieldName.trim();
    const value = this.newCustomFieldValue.trim();
    
    if (!name) return;

    if (!this.editingEntry.customFields) {
      this.editingEntry.customFields = [];
    }

    const newField: CustomField = {
      id: Date.now().toString(),
      name: name,
      value: value
    };

    this.editingEntry.customFields.push(newField);
    this.resetCustomFieldInputs();
  }

  removeCustomField(fieldId: string) {
    if (this.editingEntry.customFields) {
      this.editingEntry.customFields = this.editingEntry.customFields.filter((field: CustomField) => field.id !== fieldId);
    }
  }

  resetCustomFieldInputs() {
    this.newCustomFieldName = '';
    this.newCustomFieldValue = '';
  }

  getFieldValuePreview(value: string): string {
    if (!value) return '';
    // Replace line breaks with spaces and limit length
    const singleLine = value.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    return singleLine.length > 30 ? singleLine.substring(0, 30) + '...' : singleLine;
  }

  getCustomFields(entry: CodexEntry): CustomField[] {
    const fields = entry.metadata?.['customFields'];
    return Array.isArray(fields) ? fields : [];
  }

  goBack() {
    this.router.navigate(['/stories/editor', this.storyId()]);
  }

  onTextareaInput(event: CustomEvent) {
    // Fix for autoGrow scroll-to-top issue
    setTimeout(() => {
      const target = event.target as HTMLIonTextareaElement;
      if (target && typeof target.getInputElement === 'function') {
        target.getInputElement().then((textArea: HTMLTextAreaElement) => {
          if (textArea) {
            textArea.style.scrollBehavior = 'smooth';
            textArea.scrollTop = textArea.scrollHeight;
          }
        });
      }
    }, 0);
  }

  private initializeHeaderActions(): void {
    this.headerActions = [
      {
        icon: 'add',
        label: 'Category',
        action: () => this.showAddCategoryModal.set(true),
        showOnMobile: true,
        showOnDesktop: true
      }
    ];
  }
}