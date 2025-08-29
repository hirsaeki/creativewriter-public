import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface User {
  username: string;
  displayName?: string;
  lastLogin: Date;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  constructor() {
    // Check for existing session on startup
    this.loadCurrentUser();
  }

  private loadCurrentUser(): void {
    // Check for local-only mode first
    const isLocalOnly = localStorage.getItem('creative-writer-local-only');
    if (isLocalOnly === 'true') {
      // Auto-login as local user
      const localUser: User = {
        username: 'local',
        displayName: 'Local User',
        lastLogin: new Date()
      };
      this.currentUserSubject.next(localUser);
      return;
    }

    // Check for regular user session
    const stored = localStorage.getItem('creative-writer-user');
    if (stored) {
      try {
        const user = JSON.parse(stored);
        user.lastLogin = new Date(user.lastLogin);
        this.currentUserSubject.next(user);
      } catch (error) {
        console.warn('Invalid stored user data:', error);
        this.logout();
      }
    }
  }

  private saveCurrentUser(user: User): void {
    localStorage.setItem('creative-writer-user', JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  login(username: string, displayName?: string): Promise<User> {
    return new Promise((resolve, reject) => {
      // Basic validation
      if (!username || username.length < 2) {
        reject(new Error('Benutzername muss mindestens 2 Zeichen lang sein'));
        return;
      }

      // Sanitize username for database naming
      const sanitizedUsername = username
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .substring(0, 20);

      if (!sanitizedUsername) {
        reject(new Error('Invalid username'));
        return;
      }

      const user: User = {
        username: sanitizedUsername,
        displayName: displayName || username,
        lastLogin: new Date()
      };

      // Clear local-only mode when logging in with a real user
      localStorage.removeItem('creative-writer-local-only');
      
      this.saveCurrentUser(user);
      resolve(user);
    });
  }

  loginLocalOnly(): void {
    // Set local-only flag
    localStorage.setItem('creative-writer-local-only', 'true');
    
    // Create local user
    const localUser: User = {
      username: 'local',
      displayName: 'Local User',
      lastLogin: new Date()
    };
    
    // Don't save to regular user storage, just update current user
    this.currentUserSubject.next(localUser);
  }

  logout(): void {
    localStorage.removeItem('creative-writer-user');
    localStorage.removeItem('creative-writer-local-only');
    this.currentUserSubject.next(null);
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isLoggedIn(): boolean {
    return this.getCurrentUser() !== null;
  }

  getUserDatabaseName(): string | null {
    const user = this.getCurrentUser();
    if (!user) return null;
    
    // For local-only mode, use the anonymous database
    if (user.username === 'local') {
      return 'creative-writer-stories-anonymous';
    }
    
    return `creative-writer-stories-${user.username}`;
  }
}