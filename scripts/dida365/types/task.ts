/**
 * Task status enumeration
 */
export enum TaskStatus {
  TODO = 0,         // Not started
  IN_PROGRESS = 1,  // In progress
  COMPLETED = 2,    // Completed
  CANCELLED = 3,    // Cancelled
}

/**
 * Task priority enumeration
 * 0: No priority, 1: Low, 2: Medium, 3: High
 */
export enum TaskPriority {
  NONE = 0,
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
}

/**
 * UTC datetime format: "YYYY-MM-DDTHH:mm:ss+0000"
 * All dates should be in UTC timezone
 */
export type UTCDateTime = string;

/**
 * Reminder times before task due date
 * Format: Array of minutes or ISO duration strings
 */
export type ReminderType = string[];

/**
 * Repeat rule for tasks
 * Format: Dida365 repeat rule string
 */
export type RepeatFlag = string;

/**
 * IANA timezone identifier (e.g., "Asia/Shanghai", "America/New_York")
 */
export type TimeZone = string;

export interface DidaDateTime {
  localDateTime: string;
}

/**
 * Individual task item within a task
 */
export interface TaskItem {
  /** Unique identifier */
  id?: string;
  /** Task title */
  title?: string;
  /** Task status (0: todo, 1: in progress, 2: completed, 3: cancelled) */
  status?: TaskStatus;
  /** Sorting order */
  sortOrder?: number;
  /** Task start date in UTC format */
  startDate?: UTCDateTime;
  /** Whether task spans entire day */
  isAllDay?: boolean;
  /** Task completion timestamp in UTC format */
  completedTime?: UTCDateTime;
}

/**
 * Task draft for creating or updating tasks
 */
export interface TaskDraft {
  /** Task title (required for task creation) */
  title: string;
  /** Task description/notes */
  content?: string;
  /** Additional description or comments */
  desc?: string;
  /** Whether task spans entire day */
  isAllDay?: boolean;
  /** Task start date in UTC format (YYYY-MM-DDTHH:mm:ss+0000) */
  startDate?: UTCDateTime;
  /** Task due date in UTC format (YYYY-MM-DDTHH:mm:ss+0000) */
  dueDate?: UTCDateTime;
  /** Reminder times before due date */
  reminders?: ReminderType;
  /** Repeat rule for recurring tasks */
  repeatFlag?: RepeatFlag;
  /** Task priority (0: none, 1: low, 2: medium, 3: high) */
  priority?: TaskPriority;
  /** Sorting order */
  sortOrder?: number;
  /** Task timezone */
  timeZone?: TimeZone;
  /** Task tags/labels */
  tags?: string[];
  /** Subtasks or checklist items */
  items?: TaskItem[];
}
