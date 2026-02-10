export interface OutputSuccess<T = any> {
  ok: true;
  data: T;
  warnings?: string[];
  meta?: any;
}

export interface OutputError {
  ok: false;
  error: {
    type: string;
    code: string;
    message: string;
    details?: any;
  };
}
