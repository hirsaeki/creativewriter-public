import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InspectorRoutingModule } from './inspector-routing.module';
import { SharedModule } from '../shared/shared.module';
import { ClicheAnalyzerComponent } from './components/cliche-analyzer/cliche-analyzer.component';
import { CharacterConsistencyAnalyzerComponent } from './components/character-consistency-analyzer/character-consistency-analyzer.component';

@NgModule({
  imports: [
    CommonModule,
    SharedModule,
    InspectorRoutingModule,
    ClicheAnalyzerComponent,
    CharacterConsistencyAnalyzerComponent
  ]
})
export class InspectorModule {}
