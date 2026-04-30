import { Component, OnInit, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, filter } from 'rxjs';
import { PubsubService } from 'src/app/services/pubsub.service';
import { InputDialogComponent } from '../input-dialog/input-dialog.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { AsyncPipe } from '@angular/common';
import { MatButton, MatIconButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

@Component({
    selector: 'app-index',
    templateUrl: './index.component.html',
    styleUrls: ['./index.component.scss'],
    standalone: true,
    imports: [MatButton, MatIconButton, RouterLink, MatIcon, MatTooltip, AsyncPipe]
})
export class IndexComponent implements OnInit {
  private pubsub = inject(PubsubService);
  private matDialog = inject(MatDialog);

  projectList$: Observable<string[]>

  constructor() {
    this.projectList$ = this.pubsub.projectList$
  }

  ngOnInit(): void { }

  addNewProject() {
    const ref = this.matDialog.open(InputDialogComponent)

    ref.afterClosed()
      .pipe(filter(r => !!r))
      .subscribe((result: { user_input: string }) => {
        this.pubsub.attachProject(result.user_input)
      })
  }

  async removeProject(projectId: string) {
    const confirmed = await firstValueFrom(
      this.matDialog.open(ConfirmDialogComponent, {
        data: {
          title: 'Detach project',
          message: `Remove "${projectId}" from the list? This does not delete the project from the emulator.`,
          confirmLabel: 'Detach'
        }
      }).afterClosed()
    )
    if (confirmed) {
      this.pubsub.detachProject(projectId)
    }
  }
}
