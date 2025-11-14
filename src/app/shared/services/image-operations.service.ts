import { Injectable } from '@angular/core';
import { EditorView } from 'prosemirror-view';
import { Schema } from 'prosemirror-model';
import { ImageInsertResult } from '../../ui/components/image-upload-dialog.component';

@Injectable({
  providedIn: 'root'
})
export class ImageOperationsService {

  /**
   * Insert an image into the editor
   */
  insertImage(
    editorView: EditorView | null,
    schema: Schema,
    imageData: ImageInsertResult,
    position?: number,
    replaceSlash = false
  ): void {
    if (!editorView) return;

    try {
      const { state } = editorView;
      const pos = position ?? state.selection.from;

      // Create image node with optional imageId
      const imageNode = schema.nodes['image'].create({
        src: imageData.url,
        alt: imageData.alt,
        title: imageData.title || null,
        imageId: imageData.imageId || null
      });

      let tr;
      if (replaceSlash) {
        // Find the actual slash position by looking backwards from cursor position
        let slashPos = pos - 1;
        let foundSlash = false;

        // Look backwards up to 10 characters to find the slash
        for (let i = 1; i <= 10 && slashPos >= 0; i++) {
          const checkPos = pos - i;
          const textAtCheck = state.doc.textBetween(checkPos, checkPos + 1);

          if (textAtCheck === '/') {
            slashPos = checkPos;
            foundSlash = true;
            break;
          }
        }

        if (foundSlash) {
          // Replace the slash with the image node
          tr = state.tr.replaceRangeWith(slashPos, slashPos + 1, imageNode);
        } else {
          console.warn('No slash found, inserting at current position');
          tr = state.tr.replaceRangeWith(pos, pos, imageNode);
        }
      } else {
        // Insert at position
        tr = state.tr.replaceRangeWith(pos, pos, imageNode);
      }

      editorView.dispatch(tr);
    } catch (error) {
      console.error('Failed to insert image:', error);
    }
  }

  /**
   * Update the image ID for an existing image in the document
   */
  updateImageId(editorView: EditorView | null, imageSrc: string, imageId: string): void {
    if (!editorView) return;

    const { state, dispatch } = editorView;
    const { doc, tr } = state;

    // Find all image nodes with matching src
    let updated = false;
    doc.descendants((node, pos) => {
      if (node.type.name === 'image' && node.attrs['src'] === imageSrc) {
        // Update the image node with the new imageId
        tr.setNodeMarkup(pos, null, {
          ...node.attrs,
          imageId: imageId
        });
        updated = true;
      }
    });

    if (updated) {
      dispatch(tr);
      console.log('Updated image ID in ProseMirror document:', imageId);
    }
  }
}
