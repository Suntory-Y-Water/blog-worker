import type { WebhookRequestBody } from '@line/bot-sdk';
import { $getPageFullContent } from '@notion-md-converter/core';
import { NotionZennMarkdownConverter } from '@notion-md-converter/zenn';
import { Client } from '@notionhq/client';
import { createTextMessage, replyMessage } from './lib/line-lib';

import type { NotionResponse } from './lib/notion-lib';

import { createMdxContent } from './lib/mdx-lib';

import { createGithubPr } from './lib/github-lib';

export default {
  async fetch(request, env, ctx): Promise<Response> {
    try {
      // ヘルスチェック
      if (request.method === 'GET') {
        console.log('ヘルスチェック');
        return new Response('ok', { status: 200 });
      }

      // LINEのWebhookを受け取る
      const body = await request.json<WebhookRequestBody>();

      if (body.events && body.events.length > 0) {
        const event = body.events[0];

        // 認証チェック
        // 自分のユーザーIDのみを受信対象にする
        if (event.source.userId !== env.LINE_USER_ID) {
          return new Response('Unauthorized', { status: 401 });
        }

        // テキストメッセージ以外はブロック
        if (event.type !== 'message' || event.message.type !== 'text') {
          return new Response('notionのページidだけを設定してください', { status: 400 });
        }

        const text = event.message.text;

        // メッセージがnotionのページURLかチェック
        // example: https://www.notion.so/1ba779d04d0280cabcc6c62808dc1a03?pvs=4
        const notionPageUrlRegex = /^https:\/\/www\.notion\.so\/.+/;
        if (!notionPageUrlRegex.test(text)) {
          return new Response('notionのページURLを指定してください', { status: 400 });
        }

        // ページIDを取得
        const pageId = text.split('?')[0].split('/').pop();
        if (!pageId) {
          return new Response('notionのページURLを指定してください', { status: 400 });
        }

        // TODO: ページのメタデータ取得処理は@notion-md-converterにないため一旦放置

        ctx.waitUntil(
          (async () => {
            try {
              console.log('Notionページ取得処理を開始します');
              // notion clientを使用して、ページの内容を取得
              const client = new Client({
                auth: env.NOTION_API_KEY,
              });

              console.log('Notionページ取得処理を終了します');
              const page = (await client.pages.retrieve({
                page_id: pageId,
              })) as NotionResponse;

              console.log('Notionページ取得処理を終了します');
              console.log('変換処理を開始します');

              const title = page.properties.title.title[0].plain_text;
              const date = page.properties.date.last_edited_time;
              const description = page.properties.description.rich_text[0].plain_text;
              const icon = page.properties.icon.rich_text[0].plain_text;
              const tags = page.properties.tags.multi_select.map((tag) => tag.name);
              const slug = page.properties.slug.rich_text[0].plain_text;
              const isPublic = page.properties.public.checkbox;
              console.log('変換処理を終了します');

              // Notionのページ内容を取得
              const content = await $getPageFullContent(client, pageId);

              // Zenn形式に変換
              const executor = new NotionZennMarkdownConverter();
              const markdown = executor.execute(content);
              console.log('Zenn形式への変換完了');

              // MDXファイルを生成
              const mdxContent = createMdxContent(
                title,
                isPublic,
                date,
                icon,
                slug,
                tags,
                description,
                markdown,
              );
              console.log('MDXファイルの生成完了');

              // GitHubにPRを作成
              const branchName = await createGithubPr(env.GITHUB_TOKEN, mdxContent, slug);
              console.log(`GitHubへのブランチ作成完了: ${branchName}`);

              // 完了メッセージをLINEに送信
              const replyText = `Notionページの処理が完了しました！\nページID: ${pageId}\n変換後の文字数: ${markdown.length}文字`;
              const textMessage = createTextMessage(replyText);
              await replyMessage(
                textMessage,
                event.replyToken,
                env.LINE_CHANNEL_ACCESS_TOKEN,
              );
              console.log(`処理完了メッセージ: ${replyText}`);
            } catch (error) {
              const message = error instanceof Error ? error.message : 'unknown error';
              console.error(`バックグラウンド処理でエラーが発生しました : ${message}`);
            }
          })(),
        );

        return new Response('ok!', { status: 200 });
      }

      return new Response('LINE経由でテキストメッセージを送信してください', {
        status: 400,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      console.error('linebotの受信に失敗しました');
      console.error(`message: ${message}`);
      return new Response(message, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
