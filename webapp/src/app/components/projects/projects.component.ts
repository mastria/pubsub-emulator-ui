import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EMPTY, Observable, finalize, firstValueFrom } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PubsubService, Subscription, Topic } from 'src/app/services/pubsub.service';
import { NewSubscriptionRequest } from '../subscription-list/new-subscription-dialog/new-subscription-dialog.component';
import { NgClass, AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TopicListComponent } from '../topic-list/topic-list.component';
import { SubscriptionListComponent } from '../subscription-list/subscription-list.component';
import { SubscriptionDetailsComponent } from '../subscription-details/subscription-details.component';
import { TopicDetailsComponent } from '../topic-details/topic-details.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { NotificationService } from 'src/app/services/notification.service';
import { LocalStorageService } from 'src/app/services/local-storage.service';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { shortName } from 'src/app/services/pubsub.service';
import { FlowGraphComponent } from '../flow-graph/flow-graph.component';

@Component({
  selector: 'app-projects',
  templateUrl: './projects.component.html',
  styleUrls: ['./projects.component.scss'],
  standalone: true,
  imports: [TopicListComponent, SubscriptionListComponent, NgClass, SubscriptionDetailsComponent, TopicDetailsComponent, MatProgressBar, MatButtonToggleModule, FormsModule, FlowGraphComponent, AsyncPipe]
})
export class ProjectsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private pubsub = inject(PubsubService);
  private dialog = inject(MatDialog);
  private notification = inject(NotificationService);
  private ls = inject(LocalStorageService);

  topicList$: Observable<Topic[]> = EMPTY
  subscriptionList$: Observable<Subscription[]> = EMPTY

  currentProject: string = ''
  currentTopic?: Topic
  currentSubscription?: Subscription
  isLoadingTopics = false
  isLoadingSubs = false
  viewMode: 'list' | 'graph' = 'list'

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(qpm => {
      this.currentProject = qpm.get('project') ?? ''
      this.pubsub.selectProject(this.currentProject)
      this.refreshTopics()
    })
  }

  refreshTopics(): void {
    this.isLoadingTopics = true
    this.topicList$ = this.pubsub.listTopics(this.currentProject).pipe(
      tap(topics => this.detectOrphanedTopics(topics)),
      finalize(() => this.isLoadingTopics = false)
    )
  }

  private detectOrphanedTopics(topics: Topic[]): void {
    const orphans = this.ls.findOrphanedTopicPaths(topics.map(t => t.name));
    if (orphans.length === 0) return;
    const names = orphans.map(p => shortName(p)).join(', ');
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Clean up local data?',
        message: `${orphans.length} topic(s) no longer exist in the emulator but still have local data (templates, notes): ${names}. Remove this orphaned data?`,
        confirmLabel: 'Clean up'
      }
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        orphans.forEach(p => this.ls.removeAllTopicData(p));
        this.notification.info(`Cleaned up local data for ${orphans.length} removed topic(s).`);
      }
    });
  }

  loadSubsFor(topic: Topic) {
    this.currentSubscription = undefined
    this.isLoadingSubs = true
    this.subscriptionList$ = this.pubsub.listSubscriptionsOnTopic(topic.name).pipe(
      finalize(() => this.isLoadingSubs = false)
    )
  }

  async handleDeleteTopic(topic: Topic) {
    const confirmed = await firstValueFrom(
      this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: 'Delete topic',
          message: `Delete "${shortName(topic.name)}"? This cannot be undone.`,
          confirmLabel: 'Delete'
        }
      }).afterClosed()
    )
    if (!confirmed) return

    this.pubsub.deleteTopic(topic.name).subscribe({
      next: () => {
        if (this.currentTopic?.name === topic.name) {
          this.currentTopic = undefined
          this.currentSubscription = undefined
          this.subscriptionList$ = EMPTY
        }
        this.ls.removeAllTopicData(topic.name)
        this.refreshTopics()
        this.notification.success(`Topic "${shortName(topic.name)}" deleted.`)
      },
      error: () => this.notification.error('Failed to delete topic.')
    })
  }

  async handleDeleteSubscription(sub: Subscription) {
    const confirmed = await firstValueFrom(
      this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: 'Delete subscription',
          message: `Delete "${shortName(sub.name)}"? This cannot be undone.`,
          confirmLabel: 'Delete'
        }
      }).afterClosed()
    )
    if (!confirmed) return

    this.pubsub.deleteSubscription(sub.name).subscribe({
      next: () => {
        if (this.currentSubscription?.name === sub.name) {
          this.currentSubscription = undefined
        }
        this.ls.removeAllSubData(sub.name)
        this.loadSubsFor(this.currentTopic!)
        this.notification.success(`Subscription "${shortName(sub.name)}" deleted.`)
      },
      error: () => this.notification.error('Failed to delete subscription.')
    })
  }

  handleNewTopicRequest(newTopic: string) {
    this.pubsub.createTopic(this.currentProject, newTopic).subscribe({
      next: () => {
        this.refreshTopics()
        this.notification.success(`Topic "${newTopic}" created.`)
      },
      error: () => this.notification.error('Failed to create topic.')
    })
  }

  handleNewSubscription(request: NewSubscriptionRequest) {
    this.pubsub.createSubscription(this.currentProject, request).subscribe({
      next: () => {
        this.loadSubsFor(this.currentTopic!)
        this.notification.success(`Subscription "${request.name}" created.`)
      },
      error: () => this.notification.error('Failed to create subscription.')
    })
  }

  onGraphTopicSelect(topic: Topic): void {
    this.currentTopic = topic;
    this.currentSubscription = undefined;
    this.loadSubsFor(topic);
    this.viewMode = 'list';
  }

  onGraphSubSelect(event: { topic: Topic; sub: Subscription }): void {
    this.currentTopic = event.topic;
    this.currentSubscription = event.sub;
    this.loadSubsFor(event.topic);
    this.viewMode = 'list';
  }
}
