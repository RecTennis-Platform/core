import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpException, ValidationPipe } from '@nestjs/common';
import { getAllConstraints } from './helper/validation-error';
import { transports, format } from 'winston';
import 'winston-daily-rotate-file';
import { Loggly } from 'winston-loggly-bulk';

import InitFirebase from './services/firebase';

// // eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Multer } from 'multer'; // cheating type, dont delete
import { WinstonModule } from 'nest-winston';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      transports: [
        new transports.Console({
          format: format.combine(
            format.cli(),
            format.splat(),
            format.timestamp(),
            format.printf((info) => {
              return `${info.timestamp} ${info.level}:${info.message}`;
            }),
          ),
        }),
        new Loggly({
          token: '916a10ca-755f-43e5-944b-a1aa693e5d4c',
          subdomain: 'localhost',
          tags: ['Winston-Loggly'],
          json: true,
        }),
      ],
    }),
  });

  //enable cors
  app.enableCors({
    origin: '*',
  });

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory(errors) {
        const messages = getAllConstraints(errors);
        return new HttpException(
          {
            message: messages.join(','),
            statusCode: 400,
            error: 'Bad Request',
          },
          400,
        );
      },
    }),
  );

  InitFirebase();

  const port = process.env.SERVER_PORT || 8002;
  await app.listen(port);
  if (process.env.ENVIRONMENT === 'LOCAL')
    console.log(`Core API is running on port: ${port}`);
}
bootstrap();
