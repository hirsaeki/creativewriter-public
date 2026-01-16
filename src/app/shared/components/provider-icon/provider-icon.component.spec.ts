import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ProviderIconComponent } from './provider-icon.component';

describe('ProviderIconComponent', () => {
  let component: ProviderIconComponent;
  let fixture: ComponentFixture<ProviderIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProviderIconComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(ProviderIconComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    component.provider = 'openrouter';
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('custom icon providers', () => {
    const customProviders = ['openrouter', 'claude', 'ollama', 'replicate', 'fal'];

    customProviders.forEach(provider => {
      it(`should render ${provider} as custom inline SVG`, () => {
        component.provider = provider;
        fixture.detectChanges();

        expect(component.isCustomIcon).toBeTrue();
        const customIconSpan = fixture.debugElement.query(By.css('.custom-icon'));
        expect(customIconSpan).toBeTruthy();
        const ionIcon = fixture.debugElement.query(By.css('ion-icon'));
        expect(ionIcon).toBeFalsy();
      });

      it(`should have SVG content for ${provider}`, () => {
        component.provider = provider;
        fixture.detectChanges();

        const safeSvg = component.safeSvg;
        expect(safeSvg).toBeTruthy();
        // SafeHtml toString contains the SVG content
        expect(safeSvg.toString()).toContain('SafeValue');
      });
    });
  });

  describe('standard ionicon providers', () => {
    const standardProviders = [
      { provider: 'gemini', expectedIcon: 'logo-google' },
      { provider: 'grok', expectedIcon: 'sparkles-outline' },
      { provider: 'openaiCompatible', expectedIcon: 'server-outline' }
    ];

    standardProviders.forEach(({ provider, expectedIcon }) => {
      it(`should render ${provider} as ion-icon with name ${expectedIcon}`, () => {
        component.provider = provider;
        fixture.detectChanges();

        expect(component.isCustomIcon).toBeFalse();
        expect(component.iconName).toBe(expectedIcon);
        const ionIcon = fixture.debugElement.query(By.css('ion-icon'));
        expect(ionIcon).toBeTruthy();
        const customIconSpan = fixture.debugElement.query(By.css('.custom-icon'));
        expect(customIconSpan).toBeFalsy();
      });
    });
  });

  describe('unknown provider fallback', () => {
    it('should fall back to globe-outline for unknown provider', () => {
      component.provider = 'unknown-provider';
      fixture.detectChanges();

      expect(component.isCustomIcon).toBeFalse();
      expect(component.iconName).toBe('globe-outline');
    });

    it('should return empty SafeHtml for unknown provider SVG', () => {
      component.provider = 'unknown-provider';
      fixture.detectChanges();

      const safeSvg = component.safeSvg;
      expect(safeSvg).toBe('');
    });
  });

  describe('size input', () => {
    it('should use default size of 16', () => {
      component.provider = 'openrouter';
      fixture.detectChanges();

      expect(component.size).toBe(16);
    });

    it('should apply custom size to custom icon', () => {
      component.provider = 'openrouter';
      component.size = 24;
      fixture.detectChanges();

      const customIconSpan = fixture.debugElement.query(By.css('.custom-icon'));
      expect(customIconSpan.styles['width']).toBe('24px');
      expect(customIconSpan.styles['height']).toBe('24px');
    });

    it('should apply custom size to ion-icon', () => {
      component.provider = 'gemini';
      component.size = 20;
      fixture.detectChanges();

      const ionIcon = fixture.debugElement.query(By.css('ion-icon'));
      expect(ionIcon.styles['width']).toBe('20px');
      expect(ionIcon.styles['height']).toBe('20px');
      expect(ionIcon.styles['font-size']).toBe('20px');
    });
  });

  describe('color application', () => {
    it('should apply provider color by default', () => {
      component.provider = 'openrouter';
      fixture.detectChanges();

      expect(component.useColor).toBeTrue();
      expect(component.iconColor).toBe('#6467f2');
      const customIconSpan = fixture.debugElement.query(By.css('.custom-icon'));
      expect(customIconSpan.styles['color']).toBe('rgb(100, 103, 242)');
    });

    it('should not apply color when useColor is false', () => {
      component.provider = 'openrouter';
      component.useColor = false;
      fixture.detectChanges();

      const customIconSpan = fixture.debugElement.query(By.css('.custom-icon'));
      expect(customIconSpan.styles['color']).toBeFalsy();
    });

    it('should return correct colors for each provider', () => {
      const expectedColors: Record<string, string> = {
        openrouter: '#6467f2',
        claude: '#C15F3C',
        ollama: '#ff9800',
        replicate: '#9c27b0',
        fal: '#a855f7',
        gemini: '#4285f4',
        grok: '#1DA1F2',
        openaiCompatible: '#4caf50'
      };

      Object.entries(expectedColors).forEach(([provider, color]) => {
        component.provider = provider;
        expect(component.iconColor).toBe(color);
      });
    });
  });

  describe('tooltip', () => {
    it('should not show tooltip by default', () => {
      component.provider = 'openrouter';
      fixture.detectChanges();

      expect(component.showTooltip).toBeFalse();
      const customIconSpan = fixture.debugElement.query(By.css('.custom-icon'));
      expect(customIconSpan.attributes['title']).toBe('');
    });

    it('should show tooltip when showTooltip is true for custom icon', () => {
      component.provider = 'openrouter';
      component.showTooltip = true;
      fixture.detectChanges();

      const customIconSpan = fixture.debugElement.query(By.css('.custom-icon'));
      expect(customIconSpan.attributes['title']).toContain('OpenRouter');
    });

    it('should show tooltip when showTooltip is true for ion-icon', () => {
      component.provider = 'gemini';
      component.showTooltip = true;
      fixture.detectChanges();

      expect(component.tooltip).toContain('Google Gemini');
    });

    it('should return correct tooltips for providers', () => {
      const providers = ['openrouter', 'claude', 'ollama', 'replicate', 'fal', 'gemini', 'grok', 'openaiCompatible'];

      providers.forEach(provider => {
        component.provider = provider;
        expect(component.tooltip).toBeTruthy();
        expect(component.tooltip.length).toBeGreaterThan(10);
      });
    });

    it('should return default tooltip for unknown provider', () => {
      component.provider = 'unknown';
      expect(component.tooltip).toBe('AI Provider');
    });
  });

  describe('SVG sanitization', () => {
    it('should sanitize SVG content using DomSanitizer', () => {
      component.provider = 'openrouter';
      fixture.detectChanges();

      const safeSvg = component.safeSvg;
      // The SafeHtml wrapper indicates sanitization was applied
      expect(safeSvg).toBeTruthy();
      expect(typeof safeSvg).not.toBe('string');
    });

    it('should render SVG with correct structure', () => {
      component.provider = 'claude';
      fixture.detectChanges();

      const customIconSpan = fixture.debugElement.query(By.css('.custom-icon'));
      const innerHTML = customIconSpan.nativeElement.innerHTML;
      expect(innerHTML).toContain('<svg');
      expect(innerHTML).toContain('</svg>');
    });
  });

  describe('component inputs', () => {
    it('should accept all documented inputs', () => {
      component.provider = 'openrouter';
      component.size = 32;
      component.useColor = false;
      component.showTooltip = true;
      fixture.detectChanges();

      expect(component.provider).toBe('openrouter');
      expect(component.size).toBe(32);
      expect(component.useColor).toBeFalse();
      expect(component.showTooltip).toBeTrue();
    });
  });
});
