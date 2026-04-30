import { Component, Input, OnInit, OnChanges, OnDestroy, AfterViewInit, SimpleChanges, ViewChild, inject } from '@angular/core';
import { EMPTY, Subject, finalize, firstValueFrom, interval, map, Observable, takeUntil } from 'rxjs';
import { PubsubService, ReceivedMessage, Subscription } from 'src/app/services/pubsub.service';
import { NotificationService } from 'src/app/services/notification.service';
import { LocalStorageService } from 'src/app/services/local-storage.service';
import { AsyncPipe, DatePipe, KeyValuePipe } from '@angular/common';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatSuffix, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatTableDataSource, MatTable, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow } from '@angular/material/table';
import { MatSort, MatSortHeader, MatSortModule } from '@angular/material/sort';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatTooltip } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { JsonHighlightPipe } from 'src/app/pipes/json-highlight.pipe';

@Component({
  selector: 'app-subscription-details',
  templateUrl: './subscription-details.component.html',
  styleUrls: ['./subscription-details.component.scss'],
  standalone: true,
  imports: [
    MatButton, MatIconButton, MatIcon, MatSuffix, MatFormField, MatLabel, MatInput,
    MatProgressBar, MatSlideToggle, MatTooltip, FormsModule,
    MatTable, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell,
    MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow,
    MatSortModule, MatSort, MatSortHeader,
    MatPaginatorModule, MatPaginator,
    AsyncPipe, DatePipe, KeyValuePipe, JsonHighlightPipe
  ]
})
export class SubscriptionDetailsComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  private pubsub = inject(PubsubService);
  private notification = inject(NotificationService);
  private ls = inject(LocalStorageService);

  @Input() subscriptionPath?: string

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  details: Observable<Subscription> = EMPTY
  dataSource = new MatTableDataSource<ReceivedMessage>([]);
  displayedColumns = ['expand', 'publishTime', 'payload', 'ack'];
  expandedMessage: ReceivedMessage | null = null;

  maxMessages = 10
  isLoading = false

  autopullEnabled = false;
  autopullInterval = 5;

  // Phase 4 — Search & Filters
  filtersOpen = false;
  searchText = '';
  filterAttrKey = '';
  filterAttrValue = '';

  // Phase 7 — Notes
  note = '';
  noteOpen = false;

  get activeFilterCount(): number {
    return [this.searchText, this.filterAttrKey, this.filterAttrValue].filter(v => v.trim().length > 0).length;
  }

  private stopAutoPull$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.details = this.pubsub.getSubscriptionDetails(this.subscriptionPath!)
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['subscriptionPath'] && !changes['subscriptionPath'].firstChange) {
      this.details = this.pubsub.getSubscriptionDetails(this.subscriptionPath!)
      this.dataSource.data = [];
      this.expandedMessage = null;
      if (this.autopullEnabled) {
        this.autopullEnabled = false;
        this.stopAutoPull$.next();
      }
      // Reset filters, then load persisted filters for the new subscription
      this.searchText = '';
      this.filterAttrKey = '';
      this.filterAttrValue = '';
      this.dataSource.filter = '';
      this.note = '';
      this.noteOpen = false;
      this.loadFiltersFromStorage();
      this.loadNote();
    }
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
    this.dataSource.filterPredicate = this.buildFilterPredicate();
    this.loadFiltersFromStorage();
    this.loadNote();
  }

  ngOnDestroy(): void {
    this.stopAutoPull$.next();
    this.stopAutoPull$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  pullMessages(): void {
    this.isLoading = true
    this.pubsub.fetchMessages(this.subscriptionPath!, this.maxMessages)
      .pipe(
        map(results => results.map(msg => {
          msg.message.data = this.decodeMessageData(msg.message.data)
          return msg
        })),
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: results => {
          this.dataSource.data = results
          this.notification.info(`Pulled ${results.length} message${results.length === 1 ? '' : 's'}.`)
        },
        error: () => this.notification.error('Failed to pull messages.')
      })
  }

  async ackMessage(ackId: string) {
    const result = await firstValueFrom(this.pubsub.ackMessage(this.subscriptionPath!, [ackId]))
    if (Object.keys(result).length === 0) {
      this.dataSource.data = this.dataSource.data.filter(msg => msg.ackId !== ackId)
      if (this.expandedMessage?.ackId === ackId) this.expandedMessage = null;
      this.notification.success('Message acknowledged.')
    }
  }

  async ackAll() {
    if (this.dataSource.data.length === 0) return
    const ackIds = this.dataSource.data.map(m => m.ackId)
    const result = await firstValueFrom(this.pubsub.ackMessage(this.subscriptionPath!, ackIds))
    if (Object.keys(result).length === 0) {
      this.dataSource.data = []
      this.expandedMessage = null;
      this.notification.success(`Acknowledged ${ackIds.length} message${ackIds.length === 1 ? '' : 's'}.`)
    }
  }

  toggleAutoPull(): void {
    if (this.autopullEnabled) {
      this.stopAutoPull$ = new Subject<void>();
      interval(this.autopullInterval * 1000)
        .pipe(takeUntil(this.stopAutoPull$), takeUntil(this.destroy$))
        .subscribe(() => this.pullMessages());
    } else {
      this.stopAutoPull$.next();
    }
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(
      () => this.notification.info('Copied!'),
      () => this.notification.error('Copy failed.')
    );
  }

  toggleExpand(row: ReceivedMessage): void {
    this.expandedMessage = this.expandedMessage === row ? null : row;
  }

  // ── Phase 4: Filters ───────────────────────────────────────────

  applyFilters(): void {
    const { searchText, filterAttrKey, filterAttrValue } = this;
    const hasFilter = searchText.trim() || filterAttrKey.trim() || filterAttrValue.trim();
    this.dataSource.filter = hasFilter
      ? JSON.stringify({ searchText: searchText.trim(), attrKey: filterAttrKey.trim(), attrValue: filterAttrValue.trim() })
      : '';
    this.paginator?.firstPage();
    this.saveFiltersToStorage();
  }

  clearFilters(): void {
    this.searchText = '';
    this.filterAttrKey = '';
    this.filterAttrValue = '';
    this.applyFilters();
  }

  private buildFilterPredicate(): (row: ReceivedMessage, filter: string) => boolean {
    return (row, filterJson) => {
      if (!filterJson) return true;
      let parsed: { searchText: string; attrKey: string; attrValue: string };
      try { parsed = JSON.parse(filterJson); } catch { return true; }

      const { searchText, attrKey, attrValue } = parsed;
      const data = (row.message.data ?? '').toLowerCase();
      const attrs = row.message.attributes ?? {};
      const attrKeys = Object.keys(attrs).map(k => k.toLowerCase());
      const attrValues = Object.values(attrs).map(v => v.toLowerCase());

      if (searchText && !data.includes(searchText.toLowerCase())) return false;
      if (attrKey && !attrKeys.some(k => k.includes(attrKey.toLowerCase()))) return false;
      if (attrValue && !attrValues.some(v => v.includes(attrValue.toLowerCase()))) return false;
      return true;
    };
  }

  private saveFiltersToStorage(): void {
    if (!this.subscriptionPath) return;
    this.ls.setFilters(this.subscriptionPath, {
      searchText: this.searchText,
      filterAttrKey: this.filterAttrKey,
      filterAttrValue: this.filterAttrValue
    });
  }

  private loadFiltersFromStorage(): void {
    if (!this.subscriptionPath) return;
    const saved = this.ls.getFilters(this.subscriptionPath);
    if (!saved) return;
    this.searchText = saved.searchText ?? '';
    this.filterAttrKey = saved.filterAttrKey ?? '';
    this.filterAttrValue = saved.filterAttrValue ?? '';
    if (this.activeFilterCount > 0) {
      this.filtersOpen = true;
      this.applyFilters();
    }
  }

  private loadNote(): void {
    this.note = this.subscriptionPath ? this.ls.getSubNote(this.subscriptionPath) : '';
  }

  saveNote(): void {
    if (this.subscriptionPath) this.ls.setSubNote(this.subscriptionPath, this.note);
  }

  private decodeMessageData(encodedInput: string): string {
    try {
      const binaryString = atob(encodedInput)
      const uint8Array = new Uint8Array([...binaryString].map(char => char.charCodeAt(0)))
      return new TextDecoder().decode(uint8Array)
    } catch {
      return encodedInput
    }
  }
}
