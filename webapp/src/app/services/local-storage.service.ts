import { Injectable } from '@angular/core';

/** Typed, centralized wrapper around browser localStorage. */
@Injectable({
  providedIn: 'root'
})
export class LocalStorageService {

  // ── Generic primitives ──────────────────────────────────────────────────────

  private get<T>(key: string): T | null {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  }

  private set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  private remove(key: string): void {
    localStorage.removeItem(key);
  }

  // ── Host ────────────────────────────────────────────────────────────────────

  getHost(): string | null {
    return localStorage.getItem('host');
  }

  setHost(host: string): void {
    localStorage.setItem('host', host);
  }

  // ── Projects ────────────────────────────────────────────────────────────────

  getProjects(): string[] {
    return this.get<string[]>('projects') ?? [];
  }

  setProjects(projects: string[]): void {
    this.set('projects', projects);
  }

  // ── Message templates (per topic) ───────────────────────────────────────────

  private templateKey(topicPath: string): string {
    return `message-templates:${topicPath}`;
  }

  getTemplates<T>(topicPath: string): T[] {
    return this.get<T[]>(this.templateKey(topicPath)) ?? [];
  }

  setTemplates<T>(topicPath: string, templates: T[]): void {
    this.set(this.templateKey(topicPath), templates);
  }

  // ── Message attributes (per topic) ──────────────────────────────────────────

  private attributeKey(topicPath: string): string {
    return `message-attributes:${topicPath}`;
  }

  getAttributes(topicPath: string): { [key: string]: string } {
    return this.get<{ [key: string]: string }>(this.attributeKey(topicPath)) ?? {};
  }

  setAttributes(topicPath: string, attributes: { [key: string]: string }): void {
    this.set(this.attributeKey(topicPath), attributes);
  }

  clearAttributes(topicPath: string): void {
    this.remove(this.attributeKey(topicPath));
  }

  // ── Subscription filters ────────────────────────────────────────────────────

  private filterKey(subPath: string): string {
    return `filters_${subPath}`;
  }

  getFilters(subPath: string): { searchText: string; filterAttrKey: string; filterAttrValue: string } | null {
    return this.get(this.filterKey(subPath));
  }

  setFilters(subPath: string, filters: { searchText: string; filterAttrKey: string; filterAttrValue: string }): void {
    this.set(this.filterKey(subPath), filters);
  }

  // ── Notes (per topic) ───────────────────────────────────────────────────────

  private topicNoteKey(topicPath: string): string {
    return `topic-note:${topicPath}`;
  }

  getTopicNote(topicPath: string): string {
    return localStorage.getItem(this.topicNoteKey(topicPath)) ?? '';
  }

  setTopicNote(topicPath: string, note: string): void {
    if (note.trim()) {
      localStorage.setItem(this.topicNoteKey(topicPath), note);
    } else {
      this.remove(this.topicNoteKey(topicPath));
    }
  }

  clearTopicNote(topicPath: string): void {
    this.remove(this.topicNoteKey(topicPath));
  }

  // ── Notes (per subscription) ────────────────────────────────────────────────

  private subNoteKey(subPath: string): string {
    return `subscription-note:${subPath}`;
  }

  getSubNote(subPath: string): string {
    return localStorage.getItem(this.subNoteKey(subPath)) ?? '';
  }

  setSubNote(subPath: string, note: string): void {
    if (note.trim()) {
      localStorage.setItem(this.subNoteKey(subPath), note);
    } else {
      this.remove(this.subNoteKey(subPath));
    }
  }

  clearSubNote(subPath: string): void {
    this.remove(this.subNoteKey(subPath));
  }

  // ── Orphan detection ────────────────────────────────────────────────────────

  /** Returns topic paths that have local data but are absent from livePaths. */
  findOrphanedTopicPaths(livePaths: string[]): string[] {
    const liveSet = new Set(livePaths);
    const prefixes = ['message-templates:', 'message-attributes:', 'topic-note:'];
    const orphaned = new Set<string>();

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      for (const prefix of prefixes) {
        if (key.startsWith(prefix)) {
          const path = key.slice(prefix.length);
          if (!liveSet.has(path)) orphaned.add(path);
        }
      }
    }
    return [...orphaned];
  }

  /** Returns subscription paths that have local data but are absent from livePaths. */
  findOrphanedSubPaths(livePaths: string[]): string[] {
    const liveSet = new Set(livePaths);
    const orphaned = new Set<string>();

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('filters_')) {
        const path = key.slice('filters_'.length);
        if (!liveSet.has(path)) orphaned.add(path);
      }
      if (key.startsWith('subscription-note:')) {
        const path = key.slice('subscription-note:'.length);
        if (!liveSet.has(path)) orphaned.add(path);
      }
    }
    return [...orphaned];
  }

  /** Removes all local data (templates, attributes, note) for a topic. */
  removeAllTopicData(topicPath: string): void {
    this.remove(this.templateKey(topicPath));
    this.remove(this.attributeKey(topicPath));
    this.remove(this.topicNoteKey(topicPath));
  }

  /** Removes all local data (filters, note) for a subscription. */
  removeAllSubData(subPath: string): void {
    this.remove(this.filterKey(subPath));
    this.remove(this.subNoteKey(subPath));
  }
}
