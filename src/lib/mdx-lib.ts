/**
 * MDXファイルを生成する関数
 * @param title 記事タイトル
 * @param isPublic 公開設定
 * @param date 日付
 * @param icon アイコン
 * @param slug スラッグ
 * @param tags タグ配列
 * @param description 説明
 * @param markdown マークダウンコンテンツ
 * @returns 生成されたMDXコンテンツ
 */
export function createMdxContent(
  title: string,
  isPublic: boolean,
  date: string,
  icon: string,
  slug: string,
  tags: string[],
  description: string,
  markdown: string,
): string {
  // マークダウンをMDX形式に変換
  const mdxContent = convertZennToMdx(markdown);
  // マークダウン内の単独URLをLinkPreviewコンポーネントに変換
  const transformedMdxContent = transformLinksToPreviewComponent(mdxContent);

  // フロントマターの作成
  // タグのインデントを統一（2スペース）
  const tagsString = tags.map((tag) => `  - ${tag}`).join('\n');

  // 日付を「YYYY-MM-DD」形式にフォーマット
  const dateObj = new Date(date);
  const formattedDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

  // MDXファイルの作成（インデントなし、適切な改行あり）
  return `---
title: ${title}
public: ${isPublic}
date: ${formattedDate}
icon: ${icon}
slug: ${slug}
tags: 
${tagsString}
description: ${description}
---

${transformedMdxContent}`;
}

/**
 * Zennの:::messageブロックをMDXの<Callout>コンポーネントに変換する関数
 * @param markdown Zenn形式のマークダウンテキスト
 * @returns <Callout>コンポーネントを使用したMDX形式のテキスト
 */
export function convertZennToMdx(markdown: string): string {
  // Zennの:::messageブロックを検出する正規表現
  // :::message [type] で始まり、:::で終わるブロックを検出
  const messageBlockRegex = /:::message(?:\s+([a-z]+))?\n([\s\S]*?):::/g;

  // 変換処理
  return markdown.replace(
    messageBlockRegex,
    (_, type: string | undefined, content: string | undefined) => {
      // contentがundefinedの場合は空文字列にする
      const safeContent = content || '';

      // contentの前後の空白行を削除
      const trimmedContent = safeContent.trim();

      // 複数行のコンテンツを各行にインデントを追加して整形
      const indentedContent = trimmedContent
        .split('\n')
        .map((line: string) => `  ${line}`)
        .join('\n');

      // typeの変換
      // alert -> warning
      // info -> info (default)
      // typeが指定されていない場合は "info" とする
      let calloutType = 'info';
      if (type === 'alert') {
        calloutType = 'warning';
      } else if (type) {
        calloutType = type;
      }

      // <Callout>コンポーネントを生成
      return `<Callout type="${calloutType}" title="">\n${indentedContent}\n</Callout>\n`;
    },
  );
}

/**
 * URLを検出する正規表現パターン
 * 空白、改行、または特定の句読点で区切られたURLを検出する
 */
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

/**
 * マークダウンリンク形式かどうかを判定する正規表現
 */
const MARKDOWN_LINK_REGEX = /\[.+?\]\(.+?\)/;

/**
 * URLから末尾の句読点などを除去する
 * @param url URL文字列
 * @returns クリーンアップされたURL
 */
function cleanUrl(url: string): string {
  // URLの末尾にある句読点などを除去
  return url.replace(/[.,;:!?)"'>}\]]$/, '');
}

/**
 * 文字列が単独のURLかどうかを判定する
 * （前後の空白を除いた上で、文字列全体がURLかどうか）
 * @param text 判定する文字列
 * @returns 単独のURLならtrue、そうでなければfalse
 */
function isStandaloneUrl(text: string): boolean {
  const trimmed = text.trim();
  const match = trimmed.match(URL_REGEX);

  if (!match || match.length !== 1) {
    return false;
  }

  const cleanedUrl = cleanUrl(match[0]);
  return trimmed === match[0] || trimmed === cleanedUrl;
}

/**
 * マークダウンテキスト内の単独URLを<LinkPreview />コンポーネントに変換する
 *
 * @param markdown 変換対象のマークダウンテキスト
 * @returns 変換後のマークダウンテキスト
 */
export function transformLinksToPreviewComponent(markdown: string): string {
  if (!markdown) return markdown;

  // 行ごとに処理する
  const lines = markdown.split('\n');

  // 変換後の行を格納する配列
  const transformedLines = lines.map((line) => {
    // すでにマークダウンリンク形式 [text](url) になっている場合は変換しない
    if (MARKDOWN_LINK_REGEX.test(line)) {
      return line;
    }

    // 行が単独のURLかどうかをチェック
    if (isStandaloneUrl(line)) {
      const trimmed = line.trim();
      const url = cleanUrl(trimmed);
      return `<LinkPreview url="${url}" />`;
    }

    // それ以外の場合は元の行をそのまま返す
    return line;
  });

  // 変換後の行を結合して返す
  return transformedLines.join('\n');
}
