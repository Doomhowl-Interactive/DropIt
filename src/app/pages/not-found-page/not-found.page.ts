import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-file-not-found-page',
  imports: [CardModule, ButtonModule],
  templateUrl: './not-found.page.html',
})
export class NotFoundPage {
  constructor() {}
}
