import { Controller, Get } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import * as sleep from 'sleep-promise';

@Controller()
export class AppController {
  constructor() {}

  @MessagePattern('hello')
  async getHello(param: string): Promise<string> {
    await sleep(5000);
    return `Hello ${param}!`;
  }
}
