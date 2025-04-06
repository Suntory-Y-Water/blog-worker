import { describe, expect, it } from 'vitest';
import { convertZennToMdx, transformLinksToPreviewComponent } from '../src/lib/mdx-lib';

describe('convertZennToMdx', () => {
  it('基本的なメッセージブロックをCalloutコンポーネントに変換する', () => {
    const input = `:::message
これはテストメッセージです
:::`;
    const expected = `<Callout type="info" title="">
  これはテストメッセージです
</Callout>
`;
    expect(convertZennToMdx(input)).toBe(expected);
  });

  it('アラートタイプのメッセージブロックをwarning Calloutに変換する', () => {
    const input = `:::message alert
これは警告メッセージです
:::`;
    const expected = `<Callout type="warning" title="">
  これは警告メッセージです
</Callout>
`;
    expect(convertZennToMdx(input)).toBe(expected);
  });

  it('インフォタイプのメッセージブロックをinfo Calloutに変換する', () => {
    const input = `:::message info
これは情報メッセージです
:::`;
    const expected = `<Callout type="info" title="">
  これは情報メッセージです
</Callout>
`;
    expect(convertZennToMdx(input)).toBe(expected);
  });

  it('複数行のメッセージブロックを処理する', () => {
    const input = `:::message
1行目
2行目
3行目
:::`;
    const expected = `<Callout type="info" title="">
  1行目
  2行目
  3行目
</Callout>
`;
    expect(convertZennToMdx(input)).toBe(expected);
  });

  it('空のメッセージブロックを処理する', () => {
    const input = `:::message
:::`;
    const expected = `<Callout type="info" title="">
  
</Callout>
`;
    const result = convertZennToMdx(input);
    expect(result).toBe(expected);
  });
});

describe('transformLinksToPreviewComponent', () => {
  it('単独のURLをLinkPreviewコンポーネントに変換する', () => {
    const input = 'https://example.com';
    const expected = '<LinkPreview url="https://example.com" />';
    expect(transformLinksToPreviewComponent(input)).toBe(expected);
  });

  it('末尾に句読点があるURLを正しく変換する', () => {
    const input = 'https://example.com.';
    const expected = '<LinkPreview url="https://example.com" />';
    expect(transformLinksToPreviewComponent(input)).toBe(expected);
  });

  it('既にマークダウンリンク形式になっているURLは変換しない', () => {
    const input = '[Example](https://example.com)';
    const expected = '[Example](https://example.com)';
    expect(transformLinksToPreviewComponent(input)).toBe(expected);
  });

  it('複数行の入力を正しく処理する', () => {
    const input = `これは最初の行です
https://example.com
これは最後の行です`;
    const expected = `これは最初の行です
<LinkPreview url="https://example.com" />
これは最後の行です`;
    expect(transformLinksToPreviewComponent(input)).toBe(expected);
  });

  it('nullまたはundefinedの入力を処理する', () => {
    // @ts-ignore - 意図的にnullを渡してテスト
    expect(transformLinksToPreviewComponent(null)).toBe(null);
    // @ts-ignore - 意図的にundefinedを渡してテスト
    expect(transformLinksToPreviewComponent(undefined)).toBe(undefined);
  });

  it('文の途中にURLがある場合は変換しない', () => {
    const input =
      '例えばこのようなURLがあります。https://example.comの場合は変換しません。';
    const expected =
      '例えばこのようなURLがあります。https://example.comの場合は変換しません。';
    expect(transformLinksToPreviewComponent(input)).toBe(expected);
  });
});
