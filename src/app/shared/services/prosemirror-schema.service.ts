import { Injectable } from '@angular/core';
import { Schema, Node as ProseMirrorNode } from 'prosemirror-model';
import { schema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';

@Injectable({
  providedIn: 'root'
})
export class ProseMirrorSchemaService {
  private _editorSchema: Schema;
  private _simpleSchema: Schema;

  constructor() {
    this._editorSchema = this.createEditorSchema();
    this._simpleSchema = this.createSimpleSchema();
  }

  get editorSchema(): Schema {
    return this._editorSchema;
  }

  get simpleSchema(): Schema {
    return this._simpleSchema;
  }

  private createEditorSchema(): Schema {
    const baseNodes = addListNodes(schema.spec.nodes, 'paragraph block*', 'block');
    
    const extendedNodes = baseNodes.append({
      image: {
        attrs: {
          src: { default: '' },
          alt: { default: '' },
          title: { default: null },
          imageId: { default: null },
          width: { default: null },
          height: { default: null }
        },
        inline: false,
        group: 'block',
        draggable: true,
        parseDOM: [{
          tag: 'img[src]',
          getAttrs: (dom: Element) => ({
            src: dom.getAttribute('src'),
            alt: dom.getAttribute('alt') || '',
            title: dom.getAttribute('title') || null,
            imageId: dom.getAttribute('data-image-id') || null,
            width: dom.getAttribute('width') || null,
            height: dom.getAttribute('height') || null
          })
        }],
        toDOM: (node: ProseMirrorNode) => {
          const attrs: Record<string, string> = {
            src: node.attrs['src'],
            alt: node.attrs['alt']
          };
          
          let style = 'display: block; margin: 1rem auto;';
          
          if (node.attrs['width'] && node.attrs['height']) {
            style += ` width: ${node.attrs['width']}px; height: ${node.attrs['height']}px;`;
          } else {
            style += ' max-width: 100%; height: auto;';
          }
          
          attrs['style'] = style;
          
          if (node.attrs['title']) {
            attrs['title'] = node.attrs['title'];
          }
          
          if (node.attrs['imageId']) {
            attrs['data-image-id'] = node.attrs['imageId'];
            attrs['class'] = 'image-id-' + node.attrs['imageId'];
          }
          
          if (node.attrs['width']) {
            attrs['width'] = node.attrs['width'];
          }
          
          if (node.attrs['height']) {
            attrs['height'] = node.attrs['height'];
          }
          
          return ['img', attrs];
        }
      },
      beatAI: {
        attrs: {
          id: { default: '' },
          prompt: { default: '' },
          generatedContent: { default: '' },
          isGenerating: { default: false },
          isEditing: { default: false },
          createdAt: { default: '' },
          updatedAt: { default: '' },
          wordCount: { default: 400 },
          beatType: { default: 'story' },
          model: { default: '' },
          selectedScenes: { default: '' },
          includeStoryOutline: { default: true }
        },
        group: 'block',
        atom: true,
        toDOM: (node: ProseMirrorNode) => {
          const attrs = {
            class: 'beat-ai-node',
            'data-id': node.attrs['id'] || '',
            'data-prompt': node.attrs['prompt'] || '',
            'data-content': node.attrs['generatedContent'] || '',
            'data-generating': node.attrs['isGenerating'] ? 'true' : 'false',
            'data-editing': node.attrs['isEditing'] ? 'true' : 'false',
            'data-created': node.attrs['createdAt'] || '',
            'data-updated': node.attrs['updatedAt'] || '',
            'data-word-count': node.attrs['wordCount'] || 400,
            'data-beat-type': node.attrs['beatType'] || 'story',
            'data-model': node.attrs['model'] || '',
            'data-selected-scenes': node.attrs['selectedScenes'] || '',
            'data-include-story-outline': node.attrs['includeStoryOutline'] !== undefined ? node.attrs['includeStoryOutline'] : 'true'
          };
          return ['div', attrs, ['div', { class: 'beat-ai-placeholder' }, 'Beat AI Node']];
        },
        parseDOM: [{
          tag: 'div.beat-ai-node',
          getAttrs: (dom: Element) => {
            const selectedScenesStr = dom.getAttribute('data-selected-scenes') || '';
            const includeStoryOutlineStr = dom.getAttribute('data-include-story-outline') || '';
            
            return {
              id: dom.getAttribute('data-id') || '',
              prompt: dom.getAttribute('data-prompt') || '',
              generatedContent: dom.getAttribute('data-content') || '',
              isGenerating: dom.getAttribute('data-generating') === 'true',
              isEditing: dom.getAttribute('data-editing') === 'true',
              createdAt: dom.getAttribute('data-created') || '',
              updatedAt: dom.getAttribute('data-updated') || '',
              wordCount: parseInt(dom.getAttribute('data-word-count') || '400', 10),
              beatType: dom.getAttribute('data-beat-type') || 'story',
              model: dom.getAttribute('data-model') || '',
              selectedScenes: selectedScenesStr || '',
              includeStoryOutline: includeStoryOutlineStr !== '' ? (includeStoryOutlineStr === 'true') : true
            };
          }
        }]
      }
    });

    return new Schema({
      nodes: extendedNodes,
      marks: schema.spec.marks
    });
  }

  private createSimpleSchema(): Schema {
    return new Schema({
      nodes: {
        doc: schema.spec.nodes.get('doc')!,
        paragraph: schema.spec.nodes.get('paragraph')!,
        text: schema.spec.nodes.get('text')!,
        hard_break: schema.spec.nodes.get('hard_break')!
      },
      marks: schema.spec.marks
    });
  }
}