declare module 'html-validator' {
  interface Message {
    type: string;
    message: string;
    extract?: string;
    lastLine?: number;
    lastColumn?: number;
  }
  interface Result {
    messages?: Message[];
  }
  interface Options {
    url?: string;
    data?: string;
    format?: 'json' | 'text' | 'gnu' | string;
  }
  function validator(options: Options): Promise<Result>;
  export = validator;
}
