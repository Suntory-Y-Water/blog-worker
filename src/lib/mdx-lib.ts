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

${mdxContent}`;
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
