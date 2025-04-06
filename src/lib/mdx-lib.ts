import emojiData from 'unicode-emoji-json';

type Emoji = {
  name: string;
  slug: string;
  group: string;
  emoji_version: string;
  unicode_version: string;
  skin_tone_support: boolean;
};

/**
 * MDXファイルを生成する
 * @returns 生成されたMDXコンテンツ
 */
export async function createMdxContent(
  title: string,
  isPublic: boolean,
  date: string,
  icon: string,
  slug: string,
  tags: string[],
  description: string,
  markdown: string,
) {
  // マークダウンをMDX形式に変換
  const mdxContent = convertZennToMdx(markdown);

  // マークダウン内の単独URLをLinkPreviewコンポーネントに変換
  const transformedMdxContent = transformLinksToPreviewComponent(mdxContent);

  // コードブロックのタイトル形式を変換
  const finalMdxContent = transformCodeBlockTitles(transformedMdxContent);

  // タグのインデントを統一（2スペース）
  const tagsString = tags.map((tag) => `  - ${tag}`).join('\n');

  // 日付を「YYYY-MM-DD」形式にフォーマット
  const dateObj = new Date(date);
  const formattedDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

  const pageIcon = await getValidFluentEmojiUrl(icon);

  return `---
title: ${title}
public: ${isPublic}
date: ${formattedDate}
icon: ${pageIcon}
slug: ${slug}
tags: 
${tagsString}
description: ${description}
---

${finalMdxContent}`;
}

/**
 * Zennの:::messageブロックをMDXの<Callout>コンポーネントに変換する
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
    (_match: string, type: string | undefined, content: string | undefined) => {
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

/**
 * コードブロックのタイトル形式を変換する
 * Notionスタイル: ```typescript:index.ts
 * MDXスタイル:     ```typescript title="index.ts"
 *
 * @param markdown 変換対象のマークダウンテキスト
 * @returns 変換後のマークダウンテキスト
 */
export function transformCodeBlockTitles(markdown: string): string {
  if (!markdown) return markdown;

  // 行ごとに処理する
  const lines = markdown.split('\n');
  const resultLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // コードブロック開始行かどうか確認
    const codeBlockMatch = line.match(/^```([a-zA-Z0-9_+-]+):([^\s]+)$/);

    if (codeBlockMatch) {
      // マッチングした場合、言語とファイル名を抽出
      const language = codeBlockMatch[1];
      const filename = codeBlockMatch[2];

      // 新しい形式に変換して追加
      resultLines.push(`\`\`\`${language} title="${filename}"`);
    } else {
      // マッチしない行はそのまま追加
      resultLines.push(line);
    }
  }

  // 変換後の行を結合して返す
  return resultLines.join('\n');
}

function generateFluentEmojiUrl(emojiInfo: Emoji) {
  const { name, slug, skin_tone_support } = emojiInfo;

  // ディレクトリ名は最初の単語の先頭のみ大文字、残りは小文字
  // grinning face -> Grinning face
  const dirName = name.charAt(0).toUpperCase() + name.slice(1);

  const encodedDirName = dirName.replace(/ /g, '%20');

  if (!skin_tone_support) {
    return `https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/${encodedDirName}/Flat/${slug}_flat.svg`;
  }

  return `https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/${encodedDirName}/Default/Flat/${slug}_flat_default.svg`;
}

async function getValidFluentEmojiUrl(icon: string) {
  const emojiInfo = emojiData[icon as keyof typeof emojiData];

  if (!emojiInfo) {
    return icon;
  }

  // URLを生成
  const url = generateFluentEmojiUrl(emojiInfo);

  // URLが有効かどうかを確認
  const isValid = await checkUrlValidity(url);

  if (!isValid) {
    return icon;
  }

  return url;
}

/**
 * URLの有効性を確認する
 * @param url URL
 * @returns boolean
 */
async function checkUrlValidity(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return false;
    }
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : '不明なエラー';
    console.error(`URLの有効性チェックに失敗しました: ${url} message: ${message}`);
    return false;
  }
}
