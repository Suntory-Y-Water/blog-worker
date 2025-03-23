/**
 * マークダウン内のAmazon S3画像URLをCloudflare R2に保存し、R2のURLに置き換える
 *
 * @param markdown 処理対象のマークダウンテキスト
 * @param r2Bucket Cloudflare R2バケットのインスタンス
 * @param r2PublicUrl R2バケットの公開URL (例: https://pub-xxxxx.r2.dev)
 * @returns 画像URLが置き換えられたマークダウンテキスト
 */

type ProcessAndUploadImagesParams = {
  markdown: string;
  r2PublicUrl: string;
  r2Bucket: R2Bucket;
};
export async function processAndUploadImages({
  markdown,
  r2PublicUrl,
  r2Bucket,
}: ProcessAndUploadImagesParams): Promise<string> {
  try {
    // Amazon S3の画像URLパターンを検出する正規表現
    // ![URL](既存R2URL) の形式を検出
    const imageRegex = /!\[(https:\/\/prod-files-secure\.s3\..*?)]\((.*?)\)/g;

    // 検出した画像URLと処理後のURLのマッピングを保存するオブジェクト
    const processedUrls = new Map<string, string>();

    // 正規表現にマッチするすべての画像URLを検出
    const matches = Array.from(markdown.matchAll(imageRegex));

    // 検出した各画像URLを処理
    for (const match of matches) {
      // S3の画像URL（alt部分に含まれている）
      const s3Url = match[1];

      // すでに処理済みのURLはスキップ
      if (processedUrls.has(s3Url)) {
        continue;
      }

      // 画像ファイル名を取得 (URLのパス部分から最後のセグメントを取得)
      const fileName = s3Url.split('/').pop()?.split('?')[0] || `image-${Date.now()}.png`;
      const safeFileName = `images/${fileName}-${Date.now()}.png`;

      try {
        // 画像をダウンロード
        const response = await fetch(s3Url);
        if (!response.ok) {
          console.error(`画像のダウンロードに失敗しました: ${s3Url}`);
          continue;
        }

        // 画像のバイナリデータを取得
        const imageData = await response.arrayBuffer();

        // R2バケットに画像をアップロード
        await r2Bucket.put(safeFileName, imageData, {
          httpMetadata: {
            contentType: response.headers.get('content-type') || 'image/png',
          },
        });

        // 公開URLを生成
        const publicUrl = `${r2PublicUrl}/${safeFileName}`;

        // 処理済みURLとして記録
        processedUrls.set(s3Url, publicUrl);

        console.log(`画像を保存しました: ${publicUrl}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error';
        console.error(`画像の処理中にエラーが発生しました: ${s3Url}`);
        console.error(`message: ${message}`);
      }
    }

    // マークダウン内の画像URL参照を置き換え
    let processedMarkdown = markdown;
    for (const [s3Url, publicUrl] of processedUrls.entries()) {
      // 画像記法を新しいR2のURLに置き換え
      const pattern = new RegExp(`!\\[${escapeRegExp(s3Url)}\\]\\(.*?\\)`, 'g');
      processedMarkdown = processedMarkdown.replace(
        pattern,
        `![${publicUrl}](${publicUrl})`,
      );
    }

    return processedMarkdown;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error('画像処理中にエラーが発生しました');
    console.error(`message: ${message}`);
    return markdown; // エラー時は元のマークダウンを返す
  }
}

/**
 * 正規表現で使用される特殊文字をエスケープする
 *
 * @param string エスケープする文字列
 * @returns エスケープされた文字列
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
