import {NestFactory} from '@nestjs/core';
import {TcpOptions, Transport} from '@nestjs/microservices';
import {AppModule} from './app.module';

async function bootstrap() {
    const app = await NestFactory.createMicroservice<TcpOptions>(AppModule, {
        transport: Transport.TCP,
        options: {
            port: 3005,
        }
    });
    await app.listen();
}

bootstrap();
