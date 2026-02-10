/**
 * Dida365 API Response Types
 * Type definitions for all API responses
 */

export interface Project {
  id: string;
  name: string;
  color?: string;
  sortOrder?: number;
  viewMode?: string;
  kind?: string;
  ownerId?: string;
  groupId?: string;
  createdTime: string;
  modifiedTime: string;
}

export interface ProjectCreateParams {
  name: string;
  color?: string;
  sortOrder?: number;
  viewMode?: string;
  kind?: string;
}

export interface ProjectUpdateParams {
  name?: string;
  color?: string;
  sortOrder?: number;
  viewMode?: string;
  kind?: string;
}

export interface TaskItem {
  id?: string;
  title?: string;
  status?: number;
  sortOrder?: number;
  startDate?: string;
  isAllDay?: boolean;
  completedTime?: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  content?: string;
  desc?: string;
  status: number;  // 0 = active, 1 = completed
  isAllDay?: boolean;
  startDate?: string;
  dueDate?: string;
  reminders?: string[];
  repeatFlag?: string;
  priority?: number;
  sortOrder?: number;
  timeZone?: string;
  tags?: string[];
  items?: TaskItem[];
  createdTime: string;
  modifiedTime: string;
  completedTime?: string;
}

export interface TaskCreateParams {
  title: string;
  content?: string;
  desc?: string;
  isAllDay?: boolean;
  startDate?: string;
  dueDate?: string;
  reminders?: string[];
  repeatFlag?: string;
  priority?: number;
  sortOrder?: number;
  timeZone?: string;
  tags?: string[];
  items?: TaskItem[];
}

export interface TaskUpdateParams {
  title?: string;
  content?: string;
  desc?: string;
  isAllDay?: boolean;
  startDate?: string;
  dueDate?: string;
  reminders?: string[];
  repeatFlag?: string;
  priority?: number;
  sortOrder?: number;
  timeZone?: string;
  tags?: string[];
  items?: TaskItem[];
}

export interface TaskListResponse {
  tasks: Task[];
}

export interface ProjectListResponse {
  projects: Project[];
}

export interface SearchResult<T> {
  results: T[];
  total: number;
  projectsSearched: number;
  errors?: Array<{ projectId: string; error: string }>;
}

// Status constants
export enum TaskStatus {
  Active = 0,
  Completed = 1
}
