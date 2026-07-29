import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });

  const port = process.env.PORT ?? 5001;
  await app.listen(port);
  console.log(`api running on http://localhost:${port}/graphql`);
}

void bootstrap();
