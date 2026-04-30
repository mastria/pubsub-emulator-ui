import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { Subscription, Topic, shortName } from 'src/app/services/pubsub.service';
import { LocalStorageService } from 'src/app/services/local-storage.service';
import { NewSubscriptionDialogComponent, NewSubscriptionRequest } from './new-subscription-dialog/new-subscription-dialog.component';
import { MatList, MatListItem, MatListItemMeta, MatListItemTitle } from '@angular/material/list';
import { NgClass } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';

@Component({
    selector: 'app-subscription-list',
    templateUrl: './subscription-list.component.html',
    styleUrls: ['./subscription-list.component.scss'],
    standalone: true,
    imports: [MatList, MatListItem, MatListItemTitle, MatListItemMeta, MatIconButton, MatIcon, MatTooltip, NgClass]
})
export class SubscriptionListComponent implements OnInit {
  private dialog = inject(MatDialog);
  ls = inject(LocalStorageService);

  shortName = shortName;

  @Input() subscriptions?: Subscription[]
  @Input() topic?: Topic

  @Input() currentSubscription?: Subscription
  @Output() currentSubscriptionChange = new EventEmitter<Subscription>()
  @Output() newSubscriptionRequest = new EventEmitter<NewSubscriptionRequest>()
  @Output() deleteSubscriptionRequest = new EventEmitter<Subscription>()

  ngOnInit(): void { }

  selectSubscription(subscription: Subscription) {
    this.currentSubscription = subscription
    this.currentSubscriptionChange.emit(subscription)
  }

  async newSubscription() {
    const ref = this.dialog.open<NewSubscriptionDialogComponent, any, NewSubscriptionRequest>(NewSubscriptionDialogComponent)
    ref.componentInstance.topic = this.topic

    const result = await firstValueFrom<NewSubscriptionRequest | undefined>(ref.afterClosed())
    if (!result) { return }

    this.newSubscriptionRequest.emit(result)
  }
}
