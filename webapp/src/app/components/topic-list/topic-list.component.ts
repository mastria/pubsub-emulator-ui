import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { Topic, shortName } from 'src/app/services/pubsub.service';
import { LocalStorageService } from 'src/app/services/local-storage.service';
import { NewTopicDialogComponent } from './new-topic-dialog/new-topic-dialog.component';
import { MatList, MatListItem, MatListItemMeta, MatListItemTitle } from '@angular/material/list';
import { NgClass } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';

@Component({
    selector: 'app-topic-list',
    templateUrl: './topic-list.component.html',
    styleUrls: ['./topic-list.component.scss'],
    standalone: true,
    imports: [MatList, MatListItem, MatListItemTitle, MatListItemMeta, MatIconButton, MatIcon, MatTooltip, NgClass]
})
export class TopicListComponent implements OnInit {
  private dialog = inject(MatDialog);
  ls = inject(LocalStorageService);

  shortName = shortName;

  @Input() topics: Topic[] = []

  @Input() currentTopic?: Topic
  @Output() currentTopicChange = new EventEmitter<Topic>()
  @Output() newTopicRequest = new EventEmitter<string>()
  @Output() deleteTopicRequest = new EventEmitter<Topic>()
  @Output() refreshRequest = new EventEmitter<void>()

  ngOnInit(): void {
  }

  selectTopic(topic: Topic) {
    this.currentTopic = topic
    this.currentTopicChange.emit(topic)
  }

  async createNewTopic() {
    const ref = this.dialog.open(NewTopicDialogComponent)
    const result = await firstValueFrom<{ newTopic: string }>(ref.afterClosed())
    if (result?.newTopic) {
      this.newTopicRequest.emit(result.newTopic)
    }
  }
}
