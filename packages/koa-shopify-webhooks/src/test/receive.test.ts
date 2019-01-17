import {Context} from 'koa';
import {createMockContext} from '@shopify/jest-koa-mocks';
import {StatusCode} from '@shopify/network';
import {createHmac} from 'crypto';
import {WebhookHeader} from '../types';
import {receiveWebhook} from '..';

const secret = 'kitties are cute';
const rawBody = '{"foo": "bar"}';

describe('receiveWebhook', () => {
  it('handles the request when it is for the given path', async () => {
    const middleware = receiveWebhook({
      secret,
      path: '/foo/bar',
    });
    const context: Context = createMockContext({
      url: '/foo/bar',
      rawBody: '{"foo": "bar"}',
    });
    const next = jest.fn();

    await middleware(context, next);

    expect(context.status).not.toBe(StatusCode.NotFound);
    expect(next).not.toBeCalled();
  });

  it('does not handle the request when it is not for the given path', async () => {
    const middleware = receiveWebhook({
      secret,
      path: '/foo/bar',
    });
    const context: Context = createMockContext({url: '/baz'});
    const next = jest.fn();

    await middleware(context, next);

    expect(context.status).toBe(StatusCode.NotFound);
    expect(next).toBeCalled();
  });

  it('works without a path', async () => {
    const middleware = receiveWebhook({secret});
    const context: Context = createMockContext({rawBody});
    const next = jest.fn();

    await middleware(context, next);

    expect(context.status).not.toBe(StatusCode.NotFound);
    expect(next).not.toBeCalled();
  });

  describe('processing a request with a valid hmac', () => {
    it('calls onReceived and passes the context object to it', async () => {
      const onReceived = jest.fn();
      const middleware = receiveWebhook({secret, onReceived});

      const context: Context = createMockContext({
        rawBody,
        headers: headers({hmac: hmac(secret, rawBody)}),
      });

      await middleware(context, noop);

      expect(context.status).toBe(StatusCode.Accepted);
      expect(onReceived).toBeCalledWith(context);
    });

    it('adds webhook data to state', async () => {
      const onReceived = jest.fn();
      const middleware = receiveWebhook({secret, onReceived});

      const context: Context = createMockContext({
        rawBody,
        headers: headers({
          hmac: hmac(secret, rawBody),
          topic: 'foo',
          domain: 'cool-store.com',
        }),
      });

      await middleware(context, noop);

      expect(context.state.webhook).toMatchObject({
        topic: 'foo',
        domain: 'cool-store.com',
      });
    });

    it('returns the Accepted status code', async () => {
      const onReceived = jest.fn();
      const middleware = receiveWebhook({secret, onReceived});

      const context: Context = createMockContext({
        rawBody,
        headers: headers({hmac: hmac(secret, rawBody)}),
      });

      await middleware(context, noop);

      expect(context.status).toBe(StatusCode.Accepted);
      expect(onReceived).toBeCalledWith(context);
    });
  });

  describe('processing a request with an invalid hmac', () => {
    const fakeHMAC = 'not a real one';

    it('does not call onReceived', async () => {
      const onReceived = jest.fn();
      const middleware = receiveWebhook({secret, onReceived});

      const context: Context = createMockContext({
        rawBody,
        headers: headers({hmac: fakeHMAC}),
      });

      await middleware(context, noop);

      expect(onReceived).not.toBeCalled();
    });

    it('does not add webhook data to state', async () => {
      const onReceived = jest.fn();
      const middleware = receiveWebhook({secret, onReceived});

      const context: Context = createMockContext({
        rawBody,
        headers: headers({hmac: fakeHMAC}),
      });

      await middleware(context, noop);

      expect(onReceived).not.toBeCalled();
    });

    it('returns the Forbidden status code', async () => {
      const onReceived = jest.fn();
      const middleware = receiveWebhook({secret, onReceived});

      const context: Context = createMockContext({
        rawBody,
        headers: headers({hmac: fakeHMAC}),
      });

      await middleware(context, noop);

      expect(context.status).toBe(StatusCode.Forbidden);
    });
  });
});

function headers({
  hmac = 'fake',
  topic = 'products',
  domain = 'shop1.myshopify.io',
}: {hmac?: string; topic?: string; domain?: string} = {}) {
  return {
    [WebhookHeader.Hmac]: hmac,
    [WebhookHeader.Topic]: topic,
    [WebhookHeader.Domain]: domain,
  };
}

function hmac(secret: string, body: string) {
  return createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');
}

async function noop() {}