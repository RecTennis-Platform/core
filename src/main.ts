import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  //enable cors
  app.enableCors({
    origin: `http://localhost:${process.env.CLIENT_PORT || 4200}`,
  });

  const port = process.env.PORT || 8002;
  await app.listen(port);
  console.log(`Core API is running on port: ${port}`);
}
bootstrap();
