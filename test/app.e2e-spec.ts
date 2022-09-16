import {Test, TestingModule} from '@nestjs/testing';
import {INestMicroservice} from '@nestjs/common';
import {AppModule} from '../src/app.module';
import {TcpOptions, Transport, ClientTCP, JsonSocket} from '@nestjs/microservices';
import {lastValueFrom} from 'rxjs';
import * as sleep from 'sleep-promise';
import {Socket} from 'net';

class MyFixedClientTCP extends ClientTCP {

    get map() {
        return this.routingMap;
    }

    public handleClose() {
        super.handleClose();
        // This is the fix - clear the routing map and call all the callbacks with an error
        const err = new Error('client proxy connection closed');
        for (const callback of this.routingMap.values()) {
            callback({err});
        }
        this.routingMap.clear();
    }
}

/**
 * Provide a way to check the routingMap size
 */
class MyClientTCP extends ClientTCP {

    get map() {
        return this.routingMap;
    }
}

/**
 * This is used to simulate a server crash, as just closing
 * the nest app, doesn't close the currently open connections.
 */
class MyJsonSocket extends JsonSocket {
    public static connections = new Map<string, Socket>();

    public static destroy() {
        for (const connection of this.connections.values()) {
            connection.destroy();
        }
        this.connections.clear();
    }

    constructor(socket: Socket) {
        super(socket);
        const key = socket.remoteAddress + ':' + socket.remotePort;
        MyJsonSocket.connections.set(key, socket);
        socket.on('close', function () {
            MyJsonSocket.connections.delete(key);
        });
    }

}

describe('AppController (e2e)', () => {
    jest.setTimeout(20000);

    let app: INestMicroservice;
    let clientProxy: MyClientTCP;

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();
        app = moduleFixture.createNestMicroservice<TcpOptions>({
            transport: Transport.TCP,
            options: {
                port: 3000,
                socketClass: MyJsonSocket,
            }
        });
        await app.listen();
        clientProxy = new MyClientTCP({
            host: '127.0.0.1',
            port: 3000,
        });
        await clientProxy.connect();
    });

    afterEach(async () => {
        await app.close();
        MyJsonSocket.destroy();
    })

    const sendMessage = async (name: string): Promise<string | Error> => {
        try {
            const result = await lastValueFrom(clientProxy.send('hello', name));
            expect(result).toEqual(`Hello ${name}!`);
            return result;
        } catch (err: unknown) {
            return err as Error;
        }
    }

    const sendMessages = (): Promise<string | Error>[] => {
        const promises: Promise<string | Error>[] = [];
        for (let i = 0; i < 100; i++) {
            promises.push(sendMessage(`${i}`));
        }
        return promises;
    }

    it('sanity', async () => {
        const messagesHandled = sendMessages();
        await Promise.all(messagesHandled);
        expect(clientProxy.map.size).toEqual(0);
    });

    it('test failed connection', async () => {
        const messagesHandled = sendMessages();
        await sleep(500);
        await app.close();
        MyJsonSocket.destroy();
        await sleep(500);
        // If we remove that check, the test just hangs until it times out
        expect(clientProxy.map.size).toEqual(0);
        const results = await Promise.all(messagesHandled);
        for (const result of results) {
            expect((result as Error).message).toEqual('client proxy connection closed');
        }
        expect(clientProxy.map.size).toEqual(0);
    });

    it('test fix', async () => {
        await clientProxy.close();
        clientProxy = new MyFixedClientTCP({
            host: '127.0.0.1',
            port: 3000,
        });
        await clientProxy.connect();
        const messagesHandled = sendMessages();
        await sleep(500);
        await app.close();
        MyJsonSocket.destroy();
        await sleep(500);
        expect(clientProxy.map.size).toEqual(0);
        const results = await Promise.all(messagesHandled);
        for (const result of results) {
            expect((result as Error).message).toEqual('client proxy connection closed');
        }
        expect(clientProxy.map.size).toEqual(0);
    });
});
