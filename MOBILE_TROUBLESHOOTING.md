# Mobile Crash Troubleshooting Guide

This guide helps diagnose and fix crashes on mobile devices (iOS/Android browsers).

## Quick Access to Debug Console

To view crash logs and diagnostics on your mobile device:

1. Add a route in your app to access `/mobile-debug`
2. Navigate to this page on your mobile device
3. View crash logs, memory usage, and device metrics
4. Export logs for debugging

## Common Causes of Mobile Crashes

### 1. Memory Issues (Most Common)

**Symptoms:**
- App suddenly closes
- White screen or frozen UI
- Crashes when loading large stories
- Crashes after using the app for a while

**Solutions:**
```typescript
// Monitor memory usage
const debugService = inject(MobileDebugService);
const memoryUsage = debugService.getMemoryUsagePercentage();
if (memoryUsage && memoryUsage > 90) {
  // Implement cleanup or warn user
}
```

**Best Practices:**
- Limit the number of stories loaded at once
- Implement pagination for large lists
- Clean up subscriptions properly (use `takeUntil` or `async` pipe)
- Clear unused data from IndexedDB periodically

### 2. IndexedDB/PouchDB Issues

**Symptoms:**
- Crashes when syncing
- "QuotaExceededError" in logs
- Slow performance before crash
- Crashes when opening specific stories

**Solutions:**
- Check storage quota: Navigate to debug console → Storage tab
- Clear old/unused data
- Implement data retention policies
- Monitor IndexedDB size

```typescript
// Example: Cleanup old sync logs
async cleanupOldLogs(): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30); // Keep last 30 days

  // Delete old logs from database
  const result = await this.db.find({
    selector: {
      createdAt: { $lt: cutoffDate.toISOString() },
      type: 'sync_log'
    }
  });

  await this.db.bulkDocs(
    result.docs.map(doc => ({ ...doc, _deleted: true }))
  );
}
```

### 3. Unhandled Promise Rejections

**Symptoms:**
- Random crashes with no error message
- Crashes during async operations
- Network-related crashes

**Solution:**
All promise rejections are now automatically caught and logged. Check the mobile debug console for details.

### 4. Large Data Operations

**Symptoms:**
- Crashes when exporting stories
- Crashes when loading story with many beats
- UI freeze before crash

**Solutions:**
```typescript
// Use pagination for large datasets
async loadStoriesInBatches(batchSize = 20): Promise<Story[]> {
  const allStories: Story[] = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const batch = await this.db.find({
      selector: { type: 'story' },
      limit: batchSize,
      skip: skip
    });

    allStories.push(...batch.docs as Story[]);
    skip += batchSize;
    hasMore = batch.docs.length === batchSize;

    // Give browser time to breathe
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return allStories;
}
```

### 5. iOS Safari Specific Issues

**Symptoms:**
- Works on Android, crashes on iOS
- Crashes in background/foreground transitions
- Crashes when keyboard appears

**Known Issues:**
- iOS Safari has stricter memory limits (~500MB-1GB depending on device)
- IndexedDB is less stable on iOS
- Service Workers have limited quota

**Solutions:**
- Test memory usage specifically on iOS devices
- Reduce asset sizes (images, fonts)
- Implement aggressive cleanup on iOS
- Consider using localStorage for critical small data

```typescript
isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

getMemoryLimitForPlatform(): number {
  return this.isIOS() ? 500 * 1024 * 1024 : 2 * 1024 * 1024 * 1024; // 500MB iOS, 2GB others
}
```

### 6. Subscription Memory Leaks

**Symptoms:**
- Memory gradually increases
- Crashes after navigating between pages multiple times
- Multiple console errors about destroyed components

**Check:**
```bash
# Search for components without proper cleanup
grep -r "subscribe(" src/app/stories/components --include="*.ts" | \
  grep -v "async" | \
  grep -v "takeUntil" | \
  grep -v "unsubscribe"
```

**Solution:**
```typescript
import { Component, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({...})
export class YourComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.someService.data$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        // Handle data
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

## Debugging Steps

### Step 1: Access Debug Console on Mobile

1. On your mobile device, navigate to `/mobile-debug` in the app
2. Review the "Crashes" tab for recent errors
3. Check "Metrics" tab for memory usage
4. Check "Storage" tab for quota issues

### Step 2: Export Crash Logs

1. Click "Export Logs" button
2. Share the JSON file via email/cloud storage
3. Open on desktop for analysis

### Step 3: Reproduce with Remote Debugging

**For Android (Chrome DevTools):**
```bash
# Enable USB debugging on Android device
# Connect via USB
# Open chrome://inspect in Chrome on desktop
# Click "Inspect" on your device
```

**For iOS (Safari Web Inspector):**
```bash
# Enable Web Inspector on iOS: Settings → Safari → Advanced
# Connect via USB
# Open Safari on Mac → Develop → [Your Device]
```

### Step 4: Monitor Memory in Real-Time

The debug console shows live memory usage. Watch for:
- Steady memory increase (memory leak)
- Sudden spikes (large data operations)
- High baseline (too much data loaded)

### Step 5: Test on Different Devices

Mobile devices have varying capabilities:
- **High-end** (iPhone 14+, Samsung S23+): 4GB+ RAM available to browser
- **Mid-range** (iPhone 11-13, Pixel 5-7): 2-3GB RAM
- **Low-end** (iPhone 8-X, budget Android): 1-2GB RAM

## Prevention Best Practices

### Code Review Checklist

- [ ] All subscriptions use `takeUntil` or `async` pipe
- [ ] Large data operations are paginated
- [ ] Components implement `OnDestroy` when using subscriptions
- [ ] Images are optimized and lazy-loaded
- [ ] Database queries use limits and indexes
- [ ] Error handlers don't cause infinite loops
- [ ] Memory-intensive operations are throttled/debounced

### Performance Monitoring

```typescript
// Add to main component
export class AppComponent implements OnInit {
  constructor(private mobileDebug: MobileDebugService) {}

  ngOnInit() {
    // Log memory every minute in development
    if (!environment.production) {
      setInterval(() => {
        const usage = this.mobileDebug.getMemoryUsagePercentage();
        if (usage && usage > 80) {
          console.warn(`High memory usage: ${usage.toFixed(1)}%`);
        }
      }, 60000);
    }
  }
}
```

### Testing on Real Devices

Always test on:
1. Oldest supported iOS device (e.g., iPhone 8)
2. Mid-range Android device (e.g., Samsung Galaxy A series)
3. Slow network conditions (throttled to 3G)
4. Low battery mode (iOS reduces performance)

## Emergency User Actions

If users report frequent crashes, advise them to:

1. **Clear App Data:**
   - iOS: Settings → Safari → Clear History and Website Data
   - Android: Chrome → Settings → Privacy → Clear Browsing Data

2. **Export Important Stories:**
   - Before clearing data, export stories to backup

3. **Reduce Active Data:**
   - Archive or delete old stories
   - Clear sync logs
   - Reduce number of beats per story

4. **Update Browser:**
   - Ensure latest iOS/Android version
   - Update Chrome/Safari to latest version

## Further Help

If crashes persist after following this guide:

1. Export crash logs from mobile debug console
2. Note device model, OS version, and browser version
3. Document exact steps to reproduce
4. Check browser console for additional errors
5. Open an issue with all collected information

## Debug Console Features

The `/mobile-debug` page provides:

- **Crash Logs**: All captured errors with stack traces
- **Live Metrics**: Real-time memory, network, and device info
- **Storage Info**: IndexedDB and localStorage usage
- **Export**: Download all diagnostic data as JSON
- **Test Crash**: Trigger a test error to verify logging works

Access it by adding a route to your Angular router configuration.
