import { TestBed } from '@angular/core/testing';
import { ImageOperationsService } from './image-operations.service';
import { EditorView } from 'prosemirror-view';
import { EditorState } from 'prosemirror-state';
import { Schema } from 'prosemirror-model';
import { schema } from 'prosemirror-schema-basic';

describe('ImageOperationsService', () => {
  let service: ImageOperationsService;
  let editorView: EditorView;
  let container: HTMLElement;
  let customSchema: Schema;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ImageOperationsService);

    // Create a schema with image node
    const nodes = schema.spec.nodes.append({
      image: {
        attrs: {
          src: { default: '' },
          alt: { default: '' },
          title: { default: null },
          imageId: { default: null }
        },
        inline: false,
        group: 'block',
        draggable: true,
        parseDOM: [{
          tag: 'img[src]',
          getAttrs: (dom: Element) => ({
            src: dom.getAttribute('src'),
            alt: dom.getAttribute('alt'),
            title: dom.getAttribute('title'),
            imageId: dom.getAttribute('data-image-id')
          })
        }],
        toDOM: (node) => ['img', {
          src: node.attrs['src'],
          alt: node.attrs['alt']
        }]
      }
    });

    customSchema = new Schema({
      nodes,
      marks: schema.spec.marks
    });

    container = document.createElement('div');
    document.body.appendChild(container);

    const state = EditorState.create({ schema: customSchema });
    editorView = new EditorView(container, { state });
  });

  afterEach(() => {
    if (editorView) {
      editorView.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('insertImage', () => {
    it('should handle null editor view gracefully', () => {
      const imageData = {
        url: 'test.jpg',
        alt: 'Test image',
        title: 'Test',
        imageId: 'img-123'
      };

      expect(() => {
        service.insertImage(null, customSchema, imageData);
      }).not.toThrow();
    });

    it('should insert an image node', () => {
      const imageData = {
        url: 'test.jpg',
        alt: 'Test image',
        title: 'Test',
        imageId: 'img-123'
      };

      service.insertImage(editorView, customSchema, imageData);

      // Check that image was inserted
      let hasImage = false;
      editorView.state.doc.descendants((node) => {
        if (node.type.name === 'image') {
          hasImage = true;
          expect(node.attrs['src']).toBe('test.jpg');
          expect(node.attrs['alt']).toBe('Test image');
          expect(node.attrs['imageId']).toBe('img-123');
        }
      });

      expect(hasImage).toBe(true);
    });

    it('should insert at specified position', () => {
      const imageData = {
        url: 'test.jpg',
        alt: 'Test',
        title: undefined,
        imageId: undefined
      };

      service.insertImage(editorView, customSchema, imageData, 1);

      // Verify position (doc starts at 0, first position inside is 1)
      const nodeAtPos = editorView.state.doc.nodeAt(1);
      expect(nodeAtPos?.type.name).toBe('image');
    });

    it('should replace slash when replaceSlash is true', () => {
      // Insert a slash first
      const tr = editorView.state.tr.insertText('/', 1);
      editorView.dispatch(tr);

      const imageData = {
        url: 'test.jpg',
        alt: 'Test',
        title: undefined,
        imageId: undefined
      };

      // Position is after the slash
      service.insertImage(editorView, customSchema, imageData, 2, true);

      // Verify slash was replaced
      const text = editorView.state.doc.textContent;
      expect(text).not.toContain('/');
    });
  });

  describe('updateImageId', () => {
    it('should handle null editor view gracefully', () => {
      expect(() => {
        service.updateImageId(null, 'test.jpg', 'new-id');
      }).not.toThrow();
    });

    it('should update image ID for matching images', () => {
      // Insert an image first
      const imageData = {
        url: 'test.jpg',
        alt: 'Test',
        title: undefined,
        imageId: 'old-id'
      };

      service.insertImage(editorView, customSchema, imageData);

      // Update the ID
      service.updateImageId(editorView, 'test.jpg', 'new-id');

      // Verify ID was updated
      let foundImage = false;
      editorView.state.doc.descendants((node) => {
        if (node.type.name === 'image' && node.attrs['src'] === 'test.jpg') {
          foundImage = true;
          expect(node.attrs['imageId']).toBe('new-id');
        }
      });

      expect(foundImage).toBe(true);
    });

    it('should not affect images with different src', () => {
      // Insert two images
      const imageData1 = {
        url: 'test1.jpg',
        alt: 'Test1',
        title: undefined,
        imageId: 'id-1'
      };

      const imageData2 = {
        url: 'test2.jpg',
        alt: 'Test2',
        title: undefined,
        imageId: 'id-2'
      };

      service.insertImage(editorView, customSchema, imageData1);
      service.insertImage(editorView, customSchema, imageData2);

      // Update only first image
      service.updateImageId(editorView, 'test1.jpg', 'new-id-1');

      // Verify second image unchanged
      editorView.state.doc.descendants((node) => {
        if (node.type.name === 'image' && node.attrs['src'] === 'test2.jpg') {
          expect(node.attrs['imageId']).toBe('id-2');
        }
      });
    });
  });
});
