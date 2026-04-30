import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, EMPTY, map, Observable, ReplaySubject } from 'rxjs';
import { NewSubscriptionRequest } from '../components/subscription-list/new-subscription-dialog/new-subscription-dialog.component';
import { LocalStorageService } from './local-storage.service';

declare global {
  interface Window {
    APP_CONFIG?: {
      autoAttachPubsubProjects?: string;
      defaultPubsubEmulatorHost?: string;
    };
  }
}

export function shortName(fullPath: string): string {
  const parts = fullPath.split('/')
  return parts[parts.length - 1]
}

@Injectable({
  providedIn: 'root'
})
export class PubsubService {
  private http = inject(HttpClient);
  private ls = inject(LocalStorageService);

  public _currentHost$ = new BehaviorSubject<string>('')

  private _projectList = new BehaviorSubject<string[]>([])
  private _currentProject = new ReplaySubject<string>()
  private _currentTopic = new ReplaySubject<Topic>()
  private _currentSubscription = new ReplaySubject<Subscription>()

  public projectList$ = this._projectList.asObservable()
  public currentProject$ = this._currentProject.asObservable()
  public topicList$: Observable<Topic[]> = EMPTY
  public currentTopic$ = this._currentTopic.asObservable()
  public currentSubscription$ = this._currentSubscription.asObservable()

  constructor() {
    // Resolve default host from runtime env var, falling back to localhost
    let defaultHost = window.APP_CONFIG?.defaultPubsubEmulatorHost ?? ''
    if (!defaultHost || defaultHost === '${DEFAULT_PUBSUB_EMULATOR_HOST}') {
      defaultHost = 'http://localhost:8681'
    } else if (!defaultHost.match(/^https?:\/\//)) {
      defaultHost = `http://${defaultHost}`
    }

    // localStorage host (user-set via UI) takes priority over env default
    const prevHost = this.ls.getHost();
    if (prevHost) {
      this._currentHost$.next(prevHost)
    } else {
      this._currentHost$.next(defaultHost)
    }

    const prevProjects = this.ls.getProjects();
    const autoAttachProjects = this._getAutoAttachProjects()
    const mergedProjects = this._mergeProjectsIdempotently(prevProjects, autoAttachProjects)

    this._projectList.next(mergedProjects)

    if (mergedProjects.length !== prevProjects.length) {
      this.ls.setProjects(mergedProjects);
    }

    this.currentProject$.subscribe(project =>
      this.topicList$ = this.listTopics(project)
    )
  }

  private _getAutoAttachProjects(): string[] {
    const raw = window.APP_CONFIG?.autoAttachPubsubProjects ?? ''
    if (!raw || raw === '${AUTO_ATTACH_PUBSUB_PROJECTS}') return []
    return raw.split(',').map(p => p.trim()).filter(p => p.length > 0)
  }

  private _mergeProjectsIdempotently(existing: string[], autoAttach: string[]): string[] {
    const merged = [...existing]
    for (const project of autoAttach) {
      if (!merged.includes(project)) merged.push(project)
    }
    return merged
  }

  setHost(hostUrl: string) {
    this._currentHost$.next(hostUrl)
    this.ls.setHost(hostUrl);
  }

  selectProject(projectId: string) {
    this._currentProject.next(projectId)
  }

  attachProject(newProject: string) {
    const newList = [...this._projectList.getValue(), newProject]
    this._projectList.next(newList)
    this.ls.setProjects(newList);
  }

  detachProject(projectId: string) {
    const newList = this._projectList.getValue().filter(p => p !== projectId)
    this._projectList.next(newList)
    this.ls.setProjects(newList);
  }

  createTopic(projectId: string, topicId: string) {
    const url = `${this._currentHost$.value}/v1/projects/${projectId}/topics/${topicId}`
    return this.http.put<Topic>(url, {})
  }

  deleteTopic(topicPath: string) {
    const url = `${this._currentHost$.value}/v1/${topicPath}`
    return this.http.delete(url)
  }

  listTopics(projectId: string) {
    return this.http.get<{ topics: Topic[] }>(`${this._currentHost$.value}/v1/projects/${projectId}/topics`)
      .pipe(map(incoming => incoming?.topics || []))
  }

  createSubscription(projectId: string, request: NewSubscriptionRequest) {
    const url = `${this._currentHost$.value}/v1/projects/${projectId}/subscriptions/${request.name}`
    return this.http.put<Subscription>(url, { topic: request.topic, pushConfig: request.pushConfig })
  }

  deleteSubscription(subscriptionPath: string) {
    const url = `${this._currentHost$.value}/v1/${subscriptionPath}`
    return this.http.delete(url)
  }

  listSubscriptions(projectId: string): Observable<Subscription[]> {
    return this.http.get<{ subscriptions?: string[] }>(`${this._currentHost$.value}/v1/projects/${projectId}/subscriptions`)
      .pipe(
        map(incoming => incoming.subscriptions),
        map(subNames => subNames ?? []),
        map(subNames => subNames.map(name => ({ name, topic: 'undefined' } as Subscription)))
      )
  }

  listSubscriptionsOnTopic(topicPath: string): Observable<Subscription[]> {
    const url = `${this._currentHost$.value}/v1/${topicPath}/subscriptions`
    return this.http.get<{ subscriptions?: string[] }>(url)
      .pipe(
        map(incoming => incoming.subscriptions),
        map(subNames => subNames ?? []),
        map(subNames => subNames.map(name => ({ name, topic: 'undefined' } as Subscription)))
      )
  }

  getSubscriptionDetails(subscriptionPath: string) {
    const url = `${this._currentHost$.value}/v1/${subscriptionPath}`
    return this.http.get<Subscription>(url)
  }

  fetchMessages(subPath: string, maxMessages: number) {
    return this.http
      .post<{ receivedMessages: ReceivedMessage[] }>(
        `${this._currentHost$.value}/v1/${subPath}:pull`,
        { returnImmediately: true, maxMessages }
      ).pipe(map(incoming => incoming.receivedMessages ?? []))
  }

  ackMessage(subscriptionPath: string, ackIds: string[]) {
    const url = `${this._currentHost$.value}/v1/${subscriptionPath}:acknowledge`
    return this.http.post(url, { ackIds })
  }

  publishMessages(topicPath: string, messages: PubsubMessage[]) {
    const url = `${this._currentHost$.value}/v1/${topicPath}:publish`
    return this.http.post<{ messageIds: string[] }>(url, { messages })
  }
}

export interface Topic {
  name: string
  labels: { [key: string]: string }
}

export interface Subscription {
  name: string
  topic: string
}

export interface ReceivedMessage {
  ackId: string
  message: PubsubMessage
  deliveryAttempt: number
}

export interface PubsubMessage {
  data: string
  attributes?: { [key: string]: string }
  messageId?: string
  publishTime?: string
  orderingKey?: string
}

export interface PushConfig {
  pushEndpoint: string
  attributes?: { [key: string]: string }
}
