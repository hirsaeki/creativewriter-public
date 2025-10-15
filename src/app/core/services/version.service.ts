import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface VersionInfo {
  version: string;
  buildNumber: string;
  commitHash: string;
  commitMessage: string;
  buildDate: string;
  branch: string;
}

@Injectable({
  providedIn: 'root'
})
export class VersionService {
  private http = inject(HttpClient);

  private versionSubject = new BehaviorSubject<VersionInfo | null>(null);
  public version$ = this.versionSubject.asObservable();

  constructor() {
    this.loadVersion();
  }

  private loadVersion(): void {
    // Add cache-busting parameter to ensure we always get the latest version
    const cacheBuster = new Date().getTime();
    this.http.get<VersionInfo>(`/assets/version.json?t=${cacheBuster}`)
      .pipe(
        catchError(() => of({
          version: '0.0.0',
          buildNumber: 'dev',
          commitHash: 'unknown',
          commitMessage: 'Development build',
          buildDate: new Date().toISOString(),
          branch: 'local'
        }))
      )
      .subscribe(version => {
        this.versionSubject.next(version);
      });
  }

  getVersion(): Observable<VersionInfo | null> {
    return this.version$;
  }

  getVersionSync(): VersionInfo | null {
    return this.versionSubject.value;
  }

  getShortVersion(): string {
    const version = this.versionSubject.value;
    if (!version) return 'v0.0.0';
    
    return `v${version.version}`;
  }

  getVersionWithBuild(): string {
    const version = this.versionSubject.value;
    if (!version) return 'v0.0.0-dev';
    
    return `v${version.version}-${version.buildNumber}`;
  }
}