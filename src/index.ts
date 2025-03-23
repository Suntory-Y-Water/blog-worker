import type { WebhookRequestBody } from '@line/bot-sdk';
import { $getPageFullContent } from '@notion-md-converter/core';
import { NotionZennMarkdownConverter } from '@notion-md-converter/zenn';
import { Client } from '@notionhq/client';
import { sendMessage } from './lib/line-lib';

import type { NotionResponse } from './types';

import { processAndUploadImages } from './lib/cloudflare-lib';
import { createGithubPr } from './lib/github-lib';
import { createMdxContent } from './lib/mdx-lib';

export default {
  async fetch(request, env, ctx): Promise<Response> {
    try {
      // POSTリクエストのみを受け取る
      if (request.method !== 'POST') {
        return new Response('POSTリクエストを送信してください', { status: 405 });
      }

      // LINEのWebhookを受け取る
      const body = await request.json<WebhookRequestBody>();

      if (body.events && body.events.length > 0) {
        const event = body.events[0];

        // 認証チェック
        // 自分のユーザーIDのみを受信対象にする
        if (event.source.userId !== env.LINE_USER_ID) {
          if ('replyToken' in event) {
            sendMessage({
              message: '対象外ユーザーです',
              replyToken: event.replyToken,
              accessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
            });
          }
          return new Response('対象外ユーザーです', { status: 401 });
        }
        // テキストメッセージ以外はブロック
        if (event.type !== 'message' || event.message.type !== 'text') {
          if ('replyToken' in event) {
            sendMessage({
              message: 'テキストメッセージを送信してください',
              replyToken: event.replyToken,
              accessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
            });
          }
          return new Response('テキストメッセージを送信してください', { status: 400 });
        }

        const text = event.message.text;

        // メッセージがnotionのページURLかチェック
        // example: https://www.notion.so/1ba779d04d0280cabcc6c62808dc1a03?pvs=4
        const notionPageUrlRegex = /^https:\/\/www\.notion\.so\/.+/;
        if (!notionPageUrlRegex.test(text)) {
          sendMessage({
            message: 'notionのページURLを指定してください',
            replyToken: event.replyToken,
            accessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
          });
          return new Response('notionのページURLを指定してください', { status: 400 });
        }

        // TODO: ページタイトルに英語が入っていると複数個ハイフンがはいるのでいまのままだと取得できない
        // ページIDを取得(クエリパラメータを除いた末尾32文字)
        // example: https://www.notion.so/NotoSansJP-Safari-1ba779d04d0280cabec8c883c37b0627?pvs=4
        // example: https://www.notion.so/1ba779d04d0280cabcc6c62808dc1a03?pvs=4
        const pageId = text.split('?')[0].split('/').pop()?.slice(-32);

        if (!pageId) {
          sendMessage({
            message: 'notionのページURLを指定してください',
            replyToken: event.replyToken,
            accessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
          });
          return new Response('notionのページURLを指定してください', { status: 400 });
        }

        ctx.waitUntil(
          (async () => {
            try {
              console.log('Notionページ取得処理を開始します');
              // notion clientを使用して、ページの内容を取得
              const client = new Client({
                auth: env.NOTION_API_KEY,
              });

              // TODO: あまりよくないやり方ブロックごとに型をkey stringにしたほうがいい。ライブラリ探す
              const page = (await client.pages.retrieve({
                page_id: pageId,
              })) as NotionResponse;

              console.log('Notionページ取得処理を終了します');
              console.log('メタデータ変換処理を開始します');

              const title = page.properties.title.title[0].plain_text;
              const date = page.properties.date.last_edited_time;
              const description = page.properties.description.rich_text[0].plain_text;
              const icon = page.icon.emoji;
              const tags = page.properties.tags.multi_select.map((tag) => tag.name);
              const slug = page.properties.slug.rich_text[0].plain_text;
              const isPublic = page.properties.public.checkbox;
              console.log('メタデータ変換処理を終了します');

              // Notionのページ内容を取得
              const content = await $getPageFullContent(client, pageId);

              // Zenn形式に変換
              const executor = new NotionZennMarkdownConverter();
              const markdown = executor.execute(content);
              console.log('Zenn形式への変換完了');

              // 画像を処理して R2 に保存
              const processedMarkdown = await processAndUploadImages({
                markdown,
                r2PublicUrl: env.R2_PUBLIC_URL,
                r2Bucket: env.BLOG_WORKER,
              });
              console.log('画像のR2への保存と URL 変換が完了しました');

              // MDXファイルを生成
              const mdxContent = createMdxContent(
                title,
                isPublic,
                date,
                icon,
                slug,
                tags,
                description,
                processedMarkdown,
              );
              console.log('MDXファイルの生成完了');

              // GitHubにPRを作成
              const branchName = await createGithubPr(env.GITHUB_TOKEN, mdxContent, slug);
              console.log(`GitHubへのブランチ作成完了: ${branchName}`);

              // 完了メッセージをLINEに送信
              const replyText = `GitHubのPRを作成しました！\nブランチ名 : ${branchName}\n以下のURLからPull Requestを確認して下さい。\nhttps://github.com/Suntory-Y-Water/my-portfolio/compare/main...${branchName}`;
              await sendMessage({
                message: replyText,
                replyToken: event.replyToken,
                accessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
              });
              console.log(`処理完了メッセージ: ${replyText}`);
            } catch (error) {
              const message = error instanceof Error ? error.message : 'unknown error';
              sendMessage({
                message: `バックグラウンド処理でエラーが発生しました : ${message}`,
                replyToken: event.replyToken,
                accessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
              });
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
