import { v4 as uuidv4 } from 'uuid';

/**
 * マークダウン内の画像URLをCloudflare R2に保存し、R2のURLに置き換える
 * シンプル化バージョン - Notionの画像記法に特化
 */
type ProcessImagesParams = {
  markdown: string;
  r2PublicUrl: string;
  r2Bucket: R2Bucket;
};

export async function processAndUploadImages({
  markdown,
  r2PublicUrl,
  r2Bucket,
}: ProcessImagesParams): Promise<string> {
  // 全ての画像記法をキャプチャ (Notionでは ![URL](URL) の形式)
  const imagePattern = /!\[(.*?)]\((.*?)\)/g;
  const processedUrls = new Map<string, string>();
  const uploadPromises: Promise<void>[] = [];

  // 全てのマッチを検出
  const matches = [...markdown.matchAll(imagePattern)];
  if (matches.length === 0) return markdown;

  // 処理対象のURLを収集（altテキストがURLの場合のみ処理）
  const urlsToProcess = matches
    .filter((match) => match[1].startsWith('https://')) // altテキストがURLのもののみ
    .map((match) => match[1]); // 画像URL部分

  // 重複を除外
  const uniqueUrls = [...new Set(urlsToProcess)];
  if (uniqueUrls.length === 0) return markdown;

  // 各URLに対して並列処理を準備
  for (const imageUrl of uniqueUrls) {
    uploadPromises.push(processImage(imageUrl, r2Bucket, r2PublicUrl, processedUrls));
  }

  // 全ての画像処理を並列実行
  await Promise.allSettled(uploadPromises);

  // 処理済みURLがなければ元のマークダウンを返す
  if (processedUrls.size === 0) return markdown;

  // URLの置換処理（一度の処理で全ての置換を行う）
  return replaceMarkdownUrls(markdown, processedUrls);
}

/**
 * 1つの画像を処理する
 */
async function processImage(
  s3Url: string,
  r2Bucket: R2Bucket,
  r2PublicUrl: string,
  processedUrls: Map<string, string>,
): Promise<void> {
  try {
    // 画像ファイル名の生成 (ユニーク性を保証)
    const fileName = extractFileName(s3Url);
    const safeFileName = `images/${fileName}-${uuidv4()}.png`;

    // 画像をダウンロード
    const response = await fetch(s3Url);
    if (!response.ok) {
      console.error(`画像のダウンロードに失敗: ${s3Url}, ステータス: ${response.status}`);
      return;
    }

    // 画像データを取得してアップロード
    const imageData = await response.arrayBuffer();
    await r2Bucket.put(safeFileName, imageData, {
      httpMetadata: {
        contentType: response.headers.get('content-type') || 'image/png',
      },
    });

    // マッピング情報を保存
    const publicUrl = `${r2PublicUrl}/${safeFileName}`;
    processedUrls.set(s3Url, publicUrl);
    console.log(`画像アップロード成功: ${publicUrl}`);
  } catch (error) {
    console.error(
      `画像処理エラー (${s3Url}): ${error instanceof Error ? error.message : error}`,
    );
  }
}

/**
 * URLからファイル名を抽出する
 */
function extractFileName(url: string): string {
  const defaultName = `image-${uuidv4()}`;
  try {
    const urlPath = new URL(url).pathname;
    const fileName = urlPath.split('/').pop() || defaultName;
    return fileName.split('?')[0]; // クエリパラメータを除去
  } catch {
    return defaultName;
  }
}

/**
 * マークダウン内のURL参照を置き換える
 */
function replaceMarkdownUrls(markdown: string, urlMap: Map<string, string>): string {
  let result = markdown;

  for (const [s3Url, r2Url] of urlMap.entries()) {
    // 正規表現を使わずに文字列置換で対応する
    // `![S3のURL](S3のURL)` というパターンを探して置換
    const s3Pattern = `![${s3Url}](${s3Url})`;
    const r2Pattern = `![${r2Url}](${r2Url})`;

    result = result.split(s3Pattern).join(r2Pattern);
  }

  return result;
}
