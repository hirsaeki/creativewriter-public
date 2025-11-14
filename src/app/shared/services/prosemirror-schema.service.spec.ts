import { TestBed } from '@angular/core/testing';
import { ProseMirrorSchemaService } from './prosemirror-schema.service';
import { Schema } from 'prosemirror-model';

describe('ProseMirrorSchemaService', () => {
  let service: ProseMirrorSchemaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProseMirrorSchemaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getEditorSchema', () => {
    it('should return a valid schema', () => {
      const schema = service.getEditorSchema();
      expect(schema).toBeInstanceOf(Schema);
    });

    it('should include basic nodes (doc, paragraph, text)', () => {
      const schema = service.getEditorSchema();
      expect(schema.nodes['doc']).toBeDefined();
      expect(schema.nodes['paragraph']).toBeDefined();
      expect(schema.nodes['text']).toBeDefined();
    });

    it('should include list nodes (bullet_list, ordered_list)', () => {
      const schema = service.getEditorSchema();
      expect(schema.nodes['bullet_list']).toBeDefined();
      expect(schema.nodes['ordered_list']).toBeDefined();
      expect(schema.nodes['list_item']).toBeDefined();
    });

    it('should include custom image node', () => {
      const schema = service.getEditorSchema();
      expect(schema.nodes['image']).toBeDefined();

      const imageSpec = schema.nodes['image'].spec;
      expect(imageSpec.attrs).toBeDefined();
      if (imageSpec.attrs) {
        expect(imageSpec.attrs['src']).toBeDefined();
        expect(imageSpec.attrs['alt']).toBeDefined();
        expect(imageSpec.attrs['imageId']).toBeDefined();
      }
    });

    it('should include custom beatAI node', () => {
      const schema = service.getEditorSchema();
      expect(schema.nodes['beatAI']).toBeDefined();

      const beatSpec = schema.nodes['beatAI'].spec;
      expect(beatSpec.attrs).toBeDefined();
      if (beatSpec.attrs) {
        expect(beatSpec.attrs['id']).toBeDefined();
        expect(beatSpec.attrs['prompt']).toBeDefined();
        expect(beatSpec.attrs['generatedContent']).toBeDefined();
        expect(beatSpec.attrs['isGenerating']).toBeDefined();
      }
    });

    it('should have beatAI as an atom node', () => {
      const schema = service.getEditorSchema();
      const beatSpec = schema.nodes['beatAI'].spec;
      expect(beatSpec.atom).toBe(true);
    });

    it('should include basic marks', () => {
      const schema = service.getEditorSchema();
      expect(schema.marks['strong']).toBeDefined();
      expect(schema.marks['em']).toBeDefined();
      expect(schema.marks['code']).toBeDefined();
    });
  });

  describe('getSimpleSchema', () => {
    it('should return a valid schema', () => {
      const schema = service.getSimpleSchema();
      expect(schema).toBeInstanceOf(Schema);
    });

    it('should include only basic nodes', () => {
      const schema = service.getSimpleSchema();
      expect(schema.nodes['doc']).toBeDefined();
      expect(schema.nodes['paragraph']).toBeDefined();
      expect(schema.nodes['text']).toBeDefined();
      expect(schema.nodes['hard_break']).toBeDefined();
    });

    it('should not include image or beatAI nodes', () => {
      const schema = service.getSimpleSchema();
      expect(schema.nodes['image']).toBeUndefined();
      expect(schema.nodes['beatAI']).toBeUndefined();
    });

    it('should not include list nodes', () => {
      const schema = service.getSimpleSchema();
      expect(schema.nodes['bullet_list']).toBeUndefined();
      expect(schema.nodes['ordered_list']).toBeUndefined();
    });
  });

  describe('schema consistency', () => {
    it('should return the same schema instance on multiple calls', () => {
      const schema1 = service.getEditorSchema();
      const schema2 = service.getEditorSchema();
      expect(schema1).toBe(schema2);
    });

    it('should return the same simple schema instance on multiple calls', () => {
      const schema1 = service.getSimpleSchema();
      const schema2 = service.getSimpleSchema();
      expect(schema1).toBe(schema2);
    });
  });
});
