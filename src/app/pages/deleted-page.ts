import { Component } from '@angular/core';
import { CENTERED_BODY, usePage } from '../page';

@Component({
  selector: 'app-deleted-page',
  host: { style: 'display: contents' },
  template: `
    <div class="w-full max-w-[520px]">
      <div class="box text-center">
        <div class="title">FILE DELETED SUCESSFULL</div>

        <div class="subtitle">The file has been absolutely obliterated.</div>

        <!--        <div class="ascii">-->
        <!--            [ OK ] locating file...-->
        <!--            [ OK ] emotionally detaching...-->
        <!--            [ OK ] pressing the big red button...-->
        <!--            [ OK ] file screaming detected...-->
        <!--            [ OK ] scream ignored...-->
        <!--            [ OK ] file is now gone forever™-->

        <!--            (there is no undo)-->
        <!--        </div>-->

        <!--        <div class="text-xs font-bold uppercase mb-4">-->
        <!--            Congratulations. The electrons have been freed.-->
        <!--        </div>-->

        <div class="flex flex-col gap-2">
          <a href="/" class="button w-full">Pretend Nothing Happened</a>
        </div>
      </div>
    </div>
  `,
})
export class DeletedPage {
  constructor() {
    usePage({ title: 'File Deleted sucessfull', bodyClass: `page-deleted ${CENTERED_BODY}` });
  }
}
