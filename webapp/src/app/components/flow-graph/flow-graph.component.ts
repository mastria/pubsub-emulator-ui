import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
import { Subject, forkJoin, finalize, takeUntil } from 'rxjs';
import { MatProgressBar } from '@angular/material/progress-bar';
import { PubsubService, ReceivedMessage, Subscription, Topic, shortName } from 'src/app/services/pubsub.service';
import { NotificationService } from 'src/app/services/notification.service';

export interface GraphTopic {
  topic: Topic;
  subscriptions: Subscription[];
}

@Component({
  selector: 'app-flow-graph',
  templateUrl: './flow-graph.component.html',
  styleUrls: ['./flow-graph.component.scss'],
  standalone: true,
  imports: [MatProgressBar]
})
export class FlowGraphComponent implements OnChanges, OnDestroy {
  @Input() project = '';
  @Output() topicSelect = new EventEmitter<Topic>();
  @Output() subscriptionSelect = new EventEmitter<{ topic: Topic; sub: Subscription }>();

  private pubsub = inject(PubsubService);
  private notification = inject(NotificationService);
  private destroy$ = new Subject<void>();

  shortName = shortName;

  nodes: GraphTopic[] = [];
  isLoading = false;
  backlogMap = new Map<string, number>();
  loadingBacklogSet = new Set<string>();

  // ── Layout constants ──────────────────────────────────────────────────────
  readonly COL_W = 230;
  readonly TOPIC_W = 190;
  readonly TOPIC_H = 44;
  readonly TOPIC_Y = 30;
  readonly SUB_W = 168;
  readonly SUB_H = 36;
  readonly SUB_START_Y = 114;
  readonly SUB_SPACING = 66;
  readonly BADGE_R = 12;

  // ── Computed dimensions ───────────────────────────────────────────────────

  get svgWidth(): number {
    return Math.max(this.nodes.length * this.COL_W + 20, 300);
  }

  get svgHeight(): number {
    const maxSubs = this.nodes.reduce((m, n) => Math.max(m, n.subscriptions.length), 0);
    return this.SUB_START_Y + Math.max(maxSubs, 1) * this.SUB_SPACING + this.SUB_H + 40;
  }

  topicCenterX(i: number): number {
    return i * this.COL_W + this.COL_W / 2;
  }

  subY(j: number): number {
    return this.SUB_START_Y + j * this.SUB_SPACING;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['project'] && this.project) {
      this.loadGraph();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  loadGraph(): void {
    this.nodes = [];
    this.backlogMap = new Map();
    this.loadingBacklogSet = new Set();
    this.isLoading = true;

    this.pubsub.listTopics(this.project).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (topics) => {
        if (topics.length === 0) {
          this.isLoading = false;
          return;
        }
        forkJoin(topics.map(t => this.pubsub.listSubscriptionsOnTopic(t.name))).pipe(
          takeUntil(this.destroy$),
          finalize(() => this.isLoading = false)
        ).subscribe({
          next: (subsPerTopic) => {
            this.nodes = topics.map((topic, i) => ({ topic, subscriptions: subsPerTopic[i] }));
          },
          error: () => this.notification.error('Failed to load subscriptions for graph.')
        });
      },
      error: () => {
        this.notification.error('Failed to load topics for graph.');
        this.isLoading = false;
      }
    });
  }

  // ── Backlog on demand ─────────────────────────────────────────────────────

  fetchBacklog(sub: Subscription): void {
    if (this.loadingBacklogSet.has(sub.name)) return;
    this.loadingBacklogSet = new Set(this.loadingBacklogSet);
    this.loadingBacklogSet.add(sub.name);

    this.pubsub.fetchMessages(sub.name, 10).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (msgs: ReceivedMessage[]) => {
        this.backlogMap = new Map(this.backlogMap);
        this.backlogMap.set(sub.name, msgs.length);
        this.loadingBacklogSet = new Set(this.loadingBacklogSet);
        this.loadingBacklogSet.delete(sub.name);
      },
      error: () => {
        this.loadingBacklogSet = new Set(this.loadingBacklogSet);
        this.loadingBacklogSet.delete(sub.name);
      }
    });
  }

  // ── Click handlers ────────────────────────────────────────────────────────

  onTopicClick(topic: Topic): void {
    this.topicSelect.emit(topic);
  }

  onSubClick(topic: Topic, sub: Subscription): void {
    this.subscriptionSelect.emit({ topic, sub });
  }

  onBacklogClick(event: MouseEvent, sub: Subscription): void {
    event.stopPropagation();
    this.fetchBacklog(sub);
  }
}
