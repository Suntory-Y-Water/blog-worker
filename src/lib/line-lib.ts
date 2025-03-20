import type { TextMessage } from '@line/bot-sdk';

type SentMessage = {
  /**
   * ID of the sent message.
   */
  id: string;
  /**
   * Quote token of the message. Only included when a message object that can be specified as a quote target was sent as a push or reply message.
   */
  quoteToken?: string;
};

type LineErrorMessage = {
  /**
   * Error message.
   */
  message: string;

  /**
   * エラー詳細の配列。配列が空の場合は、レスポンスに含まれません。
   */
  details?: DetailsEntity[] | null;
};

type DetailsEntity = {
  /**
   * エラーの詳細。特定の状況ではレスポンスに含まれません。詳しくは、「エラーの詳細」を参照してください。
   */
  message: string;

  /**
   * エラーの発生箇所。リクエストのJSONのフィールド名やクエリパラメータ名が返ります。特定の状況ではレスポンスに含まれません。
   */
  property: string;
};

async function sendRequest(
  endpoint: string,
  body: object,
  accessToken: string,
): Promise<SentMessage | LineErrorMessage> {
  try {
    const LINE_API_URL = 'https://api.line.me/v2';
    const response = await fetch(LINE_API_URL + endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const data = (await response.json()) as LineErrorMessage;
      return data;
    }
    const data = (await response.json()) as SentMessage;
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    const errorMessage: LineErrorMessage = {
      message: message,
    };
    return errorMessage;
  }
}

// テキストメッセージ作成
export function createTextMessage(message: string): TextMessage {
  return {
    type: 'text',
    text: message,
  };
}

// リプライメッセージ送信
export async function replyMessage<T>(
  message: T,
  replyToken: string,
  accessToken: string,
): Promise<SentMessage | LineErrorMessage> {
  const endpoint = '/bot/message/reply';
  const body = {
    replyToken: replyToken,
    messages: [message],
  };
  return sendRequest(endpoint, body, accessToken);
}

export async function sendMessage(p: {
  message: string;
  replyToken: string;
  accessToken: string;
}) {
  const message = createTextMessage(p.message);
  return replyMessage(message, p.replyToken, p.accessToken);
}
