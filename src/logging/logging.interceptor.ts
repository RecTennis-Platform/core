import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
  HttpException,
} from '@nestjs/common';
import { Observable, throwError, catchError, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private logger = new Logger();
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const reqLog = {
      body: request.body,
      headers: request.headers,
      query: request.query,
      originalUrl: request.originalUrl,
    };

    const message = `${request.headers['user-agent']} ${request.ip} ${request.method} ${request.originalUrl} `;

    return next.handle().pipe(
      tap((data) => {
        this.logger.log({
          req: reqLog,
          message: message + `${response.statusCode}`,
          res: {
            statusCode: response.statusCode,
            body: data,
          },
        });
      }),
      catchError((err) => {
        const resLog =
          err instanceof HttpException
            ? err.getResponse()
            : {
                statusCode: 500,
                message: 'Internal server error',
              };
        this.logger.error({
          req: reqLog,
          res: resLog,
          message: message + `${response.statusCode}`,
        });
        return throwError(() => err);
      }),
    );
  }
}
