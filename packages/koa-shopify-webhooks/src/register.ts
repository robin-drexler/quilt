import {Method, StatusCode, Header} from '@shopify/network';
import {WebhookHeader, Topic} from './types';

interface Options {
  topic: Topic;
  address: string;
  shop: string;
  accessToken: string;
}

export default async function registerWebhook({
  address,
  topic,
  accessToken,
  shop,
}: Options) {
  const response = await fetch(`https://${shop}/admin/webhooks.json`, {
    method: Method.Post,
    body: JSON.stringify({
      webhook: {
        topic,
        address,
        format: 'json',
      },
    }),
    headers: {
      [WebhookHeader.AccessToken]: accessToken,
      [Header.ContentType]: 'application/json',
    },
  });

  const result = await response.json();

  if (response.status === StatusCode.Created) {
    return {success: true, result};
  } else {
    return {success: false, result};
  }
}
