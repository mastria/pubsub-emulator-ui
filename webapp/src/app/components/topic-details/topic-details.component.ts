import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { DatePipe, NgClass, SlicePipe } from '@angular/common';
import { Component, inject, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormControl, Validators } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import { MatTooltip } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from 'src/app/services/notification.service';
import { PubsubService, shortName, Topic } from 'src/app/services/pubsub.service';
import { LocalStorageService } from 'src/app/services/local-storage.service';
import { InputDialogComponent } from '../input-dialog/input-dialog.component';
import { AttributeEditorComponent } from './attribute-editor/attribute-editor.component';

export interface MessageTemplate {
  name: string;
  payload: string;
  orderingKey?: string;
}

export interface PublishHistoryEntry {
  timestamp: Date;
  preview: string;
  messageIds: string[];
}

interface QueuedMessage {
  payload: string;
  orderingKey: string;
  attributes: { [key: string]: string };
}


@Component({
  selector: 'app-topic-details',
  templateUrl: './topic-details.component.html',
  styleUrls: ['./topic-details.component.scss'],
  standalone: true,
  imports: [
    MatButton, MatIconButton, MatIcon, MatFormField, MatLabel, MatInput,
    MatSelect, MatOption, MatTooltip,
    CdkTextareaAutosize, ReactiveFormsModule, FormsModule,
    DatePipe, NgClass, SlicePipe
  ]
})
export class TopicDetailsComponent implements OnInit, OnChanges {
  @Input() topic?: Topic

  private pubsub = inject(PubsubService);
  private notification = inject(NotificationService);
  private dialog = inject(MatDialog);
  private ls = inject(LocalStorageService);

  shortName = shortName;

  payloadControl = new UntypedFormControl('', Validators.required);
  orderingKey = '';
  attributes: { [key: string]: string } = {};
  attributeCount = 0;

  templates: MessageTemplate[] = [];
  selectedTemplate: MessageTemplate | null = null;

  batchQueue: QueuedMessage[] = [];
  history: PublishHistoryEntry[] = [];
  historyExpanded = false;

  note = '';
  noteOpen = false;

  ngOnInit(): void {
    this.loadAttributes();
    this.loadTemplates();
    this.loadNote();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['topic'] && !changes['topic'].firstChange) {
      this.loadAttributes();
      this.loadTemplates();
      this.loadNote();
      this.batchQueue = [];
      this.history = [];
      this.selectedTemplate = null;
      this.orderingKey = '';
      this.payloadControl.reset();
      this.noteOpen = false;
    }
  }

  private loadNote(): void {
    this.note = this.topic ? this.ls.getTopicNote(this.topic.name) : '';
  }

  saveNote(): void {
    if (this.topic) this.ls.setTopicNote(this.topic.name, this.note);
  }

  private loadAttributes(): void {
    this.attributes = {};
    this.attributeCount = 0;
    if (!this.topic) return;
    this.attributes = this.ls.getAttributes(this.topic.name);
    this.attributeCount = Object.keys(this.attributes).length;
  }

  private loadTemplates(): void {
    this.templates = [];
    if (!this.topic) return;
    this.templates = this.ls.getTemplates<MessageTemplate>(this.topic.name);
  }

  private saveTemplates(): void {
    if (!this.topic) return;
    this.ls.setTemplates(this.topic.name, this.templates);
  }

  editAttributes() {
    const dialogRef = this.dialog.open(AttributeEditorComponent, { data: { attributes: { ...this.attributes } } });
    dialogRef.afterClosed().subscribe(result => {
      if (result !== undefined) {
        this.attributes = result;
        this.attributeCount = Object.keys(this.attributes).length;
        this.ls.setAttributes(this.topic!.name, this.attributes);
      }
    });
  }

  clearAttributes() {
    this.attributes = {};
    this.attributeCount = 0;
    this.ls.clearAttributes(this.topic!.name);
  }

  applyTemplate(template: MessageTemplate | null) {
    if (!template) return;
    this.payloadControl.setValue(template.payload);
    this.orderingKey = template.orderingKey ?? '';
  }

  async saveAsTemplate() {
    const payload = this.payloadControl.value;
    if (!payload) {
      this.notification.error('Enter a message payload before saving a template.');
      return;
    }
    const result = await firstValueFrom(
      this.dialog.open(InputDialogComponent).afterClosed()
    );
    if (!result?.user_input) return;
    const name: string = result.user_input;
    const template: MessageTemplate = { name, payload, orderingKey: this.orderingKey || undefined };
    const idx = this.templates.findIndex(t => t.name === name);
    if (idx >= 0) {
      this.templates = [...this.templates];
      this.templates[idx] = template;
    } else {
      this.templates = [...this.templates, template];
    }
    this.saveTemplates();
    this.notification.success(`Template "${name}" saved.`);
  }

  deleteTemplate(template: MessageTemplate) {
    this.templates = this.templates.filter(t => t.name !== template.name);
    if (this.selectedTemplate?.name === template.name) this.selectedTemplate = null;
    this.saveTemplates();
    this.notification.info(`Template "${template.name}" deleted.`);
  }

  addToQueue() {
    const payload = this.payloadControl.value;
    if (!payload) {
      this.notification.error('Enter a message payload to add to the queue.');
      return;
    }
    this.batchQueue = [...this.batchQueue, {
      payload,
      orderingKey: this.orderingKey,
      attributes: { ...this.attributes }
    }];
    this.notification.info(`Added to queue. Total: ${this.batchQueue.length}`);
  }

  removeFromQueue(index: number) {
    this.batchQueue = this.batchQueue.filter((_, i) => i !== index);
  }

  clearQueue() {
    this.batchQueue = [];
  }

  publishNow() {
    const payload = this.payloadControl.value;
    if (!payload) return;
    this._publish([{ payload, orderingKey: this.orderingKey, attributes: { ...this.attributes } }], true);
  }

  publishQueue() {
    if (this.batchQueue.length === 0) return;
    this._publish([...this.batchQueue], false);
    this.batchQueue = [];
  }

  private _publish(messages: QueuedMessage[], resetForm: boolean) {
    const encoder = new TextEncoder();
    const pubsubMessages = messages.map(m => ({
      data: btoa(String.fromCharCode(...encoder.encode(m.payload))),
      attributes: m.attributes,
      orderingKey: m.orderingKey || undefined
    }));

    this.pubsub.publishMessages(this.topic!.name, pubsubMessages).subscribe({
      next: result => {
        this.history = [
          { timestamp: new Date(), preview: messages[0].payload.substring(0, 80), messageIds: result.messageIds },
          ...this.history
        ].slice(0, 20);
        this.historyExpanded = true;
        this.notification.success(
          `Published ${messages.length} message${messages.length > 1 ? 's' : ''}. ID: ${result.messageIds[0]}`
        );
        if (resetForm) {
          this.payloadControl.reset();
          this.orderingKey = '';
        }
      },
      error: () => this.notification.error('Failed to publish message.')
    });
  }
}
