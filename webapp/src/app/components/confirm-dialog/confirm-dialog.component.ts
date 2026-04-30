import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.scss'],
  standalone: true,
  imports: [MatButton, MatDialogTitle, MatDialogContent, MatDialogActions]
})
export class ConfirmDialogComponent {
  data: ConfirmDialogData = inject(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<ConfirmDialogComponent>);

  confirm(): void {
    this.ref.close(true);
  }

  cancel(): void {
    this.ref.close(false);
  }
}
