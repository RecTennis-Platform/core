import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  //enable cors
  app.enableCors({
    origin: `http://localhost:${process.env.CLIENT_PORT || 4200}`,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  
  const port = process.env.PORT || 8002;
  await app.listen(port);
  console.log(`Core API is running on port: ${port}`);
}
bootstrap();
