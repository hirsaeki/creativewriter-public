import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { FalImageProvider } from './fal-image.provider';

// Real fal.ai API response examples for testing model name derivation
// These represent actual patterns seen from the fal.ai Platform API
const REAL_API_EXAMPLES = {
  // Case: display_name is just the creator name (the bug we're fixing)
  bytedanceSeedream: {
    endpoint_id: 'bytedance-seed/seedream-4.5',
    metadata: {
      display_name: 'bytedance',
      category: 'text-to-image',
      description: 'Seedream 4.5 by ByteDance',
      status: 'active'
    }
  },
  // Case: display_name is proper model name
  fluxDev: {
    endpoint_id: 'fal-ai/flux/dev',
    metadata: {
      display_name: 'FLUX.1 [dev]',
      category: 'text-to-image',
      description: 'FLUX.1 dev variant',
      status: 'active'
    }
  },
  // Case: display_name is proper model name
  fluxSchnell: {
    endpoint_id: 'fal-ai/flux/schnell',
    metadata: {
      display_name: 'FLUX.1 [schnell]',
      category: 'text-to-image',
      description: 'Fast FLUX variant',
      status: 'active'
    }
  },
  // Case: display_name matches creator
  blackForest: {
    endpoint_id: 'black-forest-labs/flux-1.1-ultra',
    metadata: {
      display_name: 'Black Forest Labs',
      category: 'text-to-image',
      description: 'FLUX 1.1 Ultra',
      status: 'active'
    }
  },
  // Case: Short but valid display_name
  sdxl: {
    endpoint_id: 'fal-ai/fast-sdxl',
    metadata: {
      display_name: 'SDXL',
      category: 'text-to-image',
      description: 'Fast SDXL inference',
      status: 'active'
    }
  },
  // Case: Very short display_name that is valid
  sd3: {
    endpoint_id: 'fal-ai/stable-diffusion-3',
    metadata: {
      display_name: 'SD3',
      category: 'text-to-image',
      description: 'Stable Diffusion 3',
      status: 'active'
    }
  },
  // Case: Multi-level path
  fluxProUltra: {
    endpoint_id: 'fal-ai/flux-pro/v1.1-ultra',
    metadata: {
      display_name: 'FLUX Pro Ultra',
      category: 'text-to-image',
      description: 'Professional FLUX model',
      status: 'active'
    }
  },
  // Case: display_name contains creator name but is valid
  stableDiffusion: {
    endpoint_id: 'stability-ai/stable-diffusion-xl',
    metadata: {
      display_name: 'Stable Diffusion XL',
      category: 'text-to-image',
      description: 'SDXL by Stability AI',
      status: 'active'
    }
  },
  // Case: Empty display_name (edge case)
  emptyDisplayName: {
    endpoint_id: 'some-org/model-name',
    metadata: {
      display_name: '',
      category: 'text-to-image',
      description: 'A model with no display name',
      status: 'active'
    }
  },
  // Case: display_name is whitespace only
  whitespaceDisplayName: {
    endpoint_id: 'some-org/cool-model',
    metadata: {
      display_name: '   ',
      category: 'text-to-image',
      description: 'A model with whitespace display name',
      status: 'active'
    }
  }
};

describe('FalImageProvider', () => {
  let service: FalImageProvider;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        FalImageProvider
      ]
    });
    service = TestBed.inject(FalImageProvider);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('mapFalModelToInternal (model name derivation)', () => {
    // Access private method for testing via type assertion
    const mapModel = (falModel: typeof REAL_API_EXAMPLES.fluxDev) => {
      return (service as unknown as { mapFalModelToInternal: (m: typeof falModel) => { name: string } })
        .mapFalModelToInternal(falModel);
    };

    describe('when display_name is just the creator name', () => {
      it('should extract model name from endpoint_id for bytedance-seed', () => {
        const result = mapModel(REAL_API_EXAMPLES.bytedanceSeedream);
        expect(result.name).toBe('Seedream 4.5');
      });

      it('should extract model name for Black Forest Labs', () => {
        const result = mapModel(REAL_API_EXAMPLES.blackForest);
        // "black-forest-labs" starts with "blackforestlabs" (normalized)
        // "Black Forest Labs" -> "blackforestlabs" (normalized)
        // Since they match, it should extract from endpoint_id
        expect(result.name).toBe('Flux 1.1 Ultra');
      });
    });

    describe('when display_name is a proper model name', () => {
      it('should use display_name for FLUX.1 [dev]', () => {
        const result = mapModel(REAL_API_EXAMPLES.fluxDev);
        expect(result.name).toBe('FLUX.1 [dev]');
      });

      it('should use display_name for FLUX.1 [schnell]', () => {
        const result = mapModel(REAL_API_EXAMPLES.fluxSchnell);
        expect(result.name).toBe('FLUX.1 [schnell]');
      });

      it('should use display_name for FLUX Pro Ultra', () => {
        const result = mapModel(REAL_API_EXAMPLES.fluxProUltra);
        expect(result.name).toBe('FLUX Pro Ultra');
      });

      it('should use display_name for Stable Diffusion XL', () => {
        const result = mapModel(REAL_API_EXAMPLES.stableDiffusion);
        expect(result.name).toBe('Stable Diffusion XL');
      });
    });

    describe('when display_name is short but valid', () => {
      it('should preserve short valid names like SDXL', () => {
        const result = mapModel(REAL_API_EXAMPLES.sdxl);
        expect(result.name).toBe('SDXL');
      });

      it('should preserve short valid names like SD3', () => {
        const result = mapModel(REAL_API_EXAMPLES.sd3);
        expect(result.name).toBe('SD3');
      });
    });

    describe('edge cases', () => {
      it('should handle empty display_name by extracting from endpoint_id', () => {
        const result = mapModel(REAL_API_EXAMPLES.emptyDisplayName);
        expect(result.name).toBe('Model Name');
      });

      it('should handle whitespace-only display_name by extracting from endpoint_id', () => {
        const result = mapModel(REAL_API_EXAMPLES.whitespaceDisplayName);
        expect(result.name).toBe('Cool Model');
      });

      it('should handle single-part endpoint_id', () => {
        const model = {
          endpoint_id: 'standalone-model',
          metadata: {
            display_name: '',
            category: 'text-to-image',
            description: 'A standalone model',
            status: 'active'
          }
        };
        const result = mapModel(model);
        expect(result.name).toBe('standalone-model');
      });

      it('should return "Unknown Model" for completely empty data', () => {
        const model = {
          endpoint_id: '',
          metadata: {
            display_name: '',
            category: 'text-to-image',
            description: '',
            status: 'active'
          }
        };
        const result = mapModel(model);
        expect(result.name).toBe('Unknown Model');
      });
    });
  });

  describe('formatModelName (via mapFalModelToInternal)', () => {
    // Helper that uses a creator name that will trigger the fallback logic
    const getFormattedName = (endpointPath: string) => {
      const model = {
        endpoint_id: `bytedance-labs/${endpointPath}`,
        metadata: {
          display_name: 'bytedance',  // Matches creator prefix, will trigger fallback
          category: 'text-to-image',
          description: '',
          status: 'active'
        }
      };
      return (service as unknown as { mapFalModelToInternal: (m: typeof model) => { name: string } })
        .mapFalModelToInternal(model).name;
    };

    it('should convert hyphenated names to Title Case', () => {
      expect(getFormattedName('my-cool-model')).toBe('My Cool Model');
    });

    it('should handle version numbers correctly', () => {
      expect(getFormattedName('flux-1.1-ultra')).toBe('Flux 1.1 Ultra');
      expect(getFormattedName('seedream-4.5')).toBe('Seedream 4.5');
    });

    it('should handle underscores', () => {
      expect(getFormattedName('my_model_name')).toBe('My Model Name');
    });

    it('should handle mixed separators', () => {
      expect(getFormattedName('my-model_v2')).toBe('My Model V2');
    });

    it('should collapse multiple spaces', () => {
      expect(getFormattedName('model--name')).toBe('Model Name');
    });

    it('should handle multi-level paths', () => {
      const model = {
        endpoint_id: 'bytedance-labs/path/to/model',
        metadata: {
          display_name: 'bytedance',  // Matches creator prefix
          category: 'text-to-image',
          description: '',
          status: 'active'
        }
      };
      const result = (service as unknown as { mapFalModelToInternal: (m: typeof model) => { name: string } })
        .mapFalModelToInternal(model);
      expect(result.name).toBe('Path To Model');
    });
  });

  describe('model ID preservation', () => {
    it('should always preserve the original endpoint_id as the model ID', () => {
      const mapModel = (falModel: typeof REAL_API_EXAMPLES.fluxDev) => {
        return (service as unknown as { mapFalModelToInternal: (m: typeof falModel) => { id: string; name: string } })
          .mapFalModelToInternal(falModel);
      };

      // Even when name is derived differently, ID should remain unchanged
      const bytedance = mapModel(REAL_API_EXAMPLES.bytedanceSeedream);
      expect(bytedance.id).toBe('bytedance-seed/seedream-4.5');
      expect(bytedance.name).toBe('Seedream 4.5');

      const flux = mapModel(REAL_API_EXAMPLES.fluxDev);
      expect(flux.id).toBe('fal-ai/flux/dev');
      expect(flux.name).toBe('FLUX.1 [dev]');
    });
  });
});
