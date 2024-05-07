export class ResponseDto<T = any> {
  statusCode: number;
  message: string;
  data: T;

  constructor(status_code: number, message: string, data?: T) {
    this.statusCode = status_code;
    this.message = message;
    this.data = data;
  }
}
