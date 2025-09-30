import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClicheAnalyzerComponent } from './components/cliche-analyzer/cliche-analyzer.component';
import { CharacterConsistencyAnalyzerComponent } from './components/character-consistency-analyzer/character-consistency-analyzer.component';

const routes: Routes = [
  {
    path: ':id',
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'cliche' },
      { path: 'cliche', component: ClicheAnalyzerComponent },
      { path: 'characters', component: CharacterConsistencyAnalyzerComponent }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class InspectorRoutingModule {}
