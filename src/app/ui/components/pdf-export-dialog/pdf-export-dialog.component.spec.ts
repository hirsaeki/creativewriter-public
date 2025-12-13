import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ModalController } from '@ionic/angular/standalone';

import { PDFExportDialogComponent, PDFExportDialogOptions } from './pdf-export-dialog.component';

describe('PDFExportDialogComponent', () => {
  let component: PDFExportDialogComponent;
  let fixture: ComponentFixture<PDFExportDialogComponent>;
  let modalController: jasmine.SpyObj<ModalController>;

  beforeEach(async () => {
    modalController = jasmine.createSpyObj<ModalController>('ModalController', ['dismiss']);

    await TestBed.configureTestingModule({
      imports: [PDFExportDialogComponent],
      providers: [
        { provide: ModalController, useValue: modalController }
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(PDFExportDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('default values', () => {
    it('should have includeBackground set to false by default', () => {
      expect(component.includeBackground).toBe(false);
    });

    it('should have format set to a4 by default', () => {
      expect(component.format).toBe('a4');
    });

    it('should have orientation set to portrait by default', () => {
      expect(component.orientation).toBe('portrait');
    });
  });

  describe('dismiss', () => {
    it('should dismiss modal with null and cancel role', () => {
      component.dismiss();
      expect(modalController.dismiss).toHaveBeenCalledWith(null, 'cancel');
    });
  });

  describe('confirm', () => {
    it('should dismiss modal with options and confirm role', () => {
      component.includeBackground = true;
      component.format = 'letter';
      component.orientation = 'landscape';

      component.confirm();

      const expectedOptions: PDFExportDialogOptions = {
        includeBackground: true,
        format: 'letter',
        orientation: 'landscape'
      };

      expect(modalController.dismiss).toHaveBeenCalledWith(expectedOptions, 'confirm');
    });

    it('should pass default values when unchanged', () => {
      component.confirm();

      const expectedOptions: PDFExportDialogOptions = {
        includeBackground: false,
        format: 'a4',
        orientation: 'portrait'
      };

      expect(modalController.dismiss).toHaveBeenCalledWith(expectedOptions, 'confirm');
    });
  });

  describe('option changes', () => {
    it('should allow changing includeBackground', () => {
      component.includeBackground = true;
      expect(component.includeBackground).toBe(true);
    });

    it('should allow changing format to letter', () => {
      component.format = 'letter';
      expect(component.format).toBe('letter');
    });

    it('should allow changing orientation to landscape', () => {
      component.orientation = 'landscape';
      expect(component.orientation).toBe('landscape');
    });
  });
});
