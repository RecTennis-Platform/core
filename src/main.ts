import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  //enable cors
  app.enableCors({
    origin: 'http://localhost:3000',
  });

  await app.listen(process.env.PORT || 8002);
}
bootstrap();
