import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';
import { CENTERED_BODY, usePage } from '../page';
import { UploadZone } from '../components/upload-zone/upload-zone';

@Component({
  selector: 'app-index-page',
  templateUrl: './index-page.html',
  host: { style: 'display: contents' },
  imports: [CardModule, UploadZone],
})
export class IndexPage {
  constructor() {
    usePage({ title: 'Drop.it', bodyClass: CENTERED_BODY });
  }
}
