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

${markdown}`;
}
