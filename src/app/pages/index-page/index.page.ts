import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-index-page',
  templateUrl: './index.page.html',
  imports: [CardModule],
})
export class IndexPage {
  constructor() {}
}
