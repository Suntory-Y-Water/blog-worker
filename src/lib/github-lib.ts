import { Octokit } from '@octokit/rest';

/**
 * GitHubにファイルをコミットしてpushする関数
 * @param githubToken GitHub APIアクセストークン
 * @param mdxContent コミットするMDXコンテンツ
 * @param slug 記事のスラッグ（URLパス）
 * @returns 作成したブランチ名
 */
export async function createGithubPr(
  githubToken: string,
  mdxContent: string,
  slug: string,
): Promise<string> {
  try {
    const octokit = new Octokit({ auth: githubToken });
    const owner = 'Suntory-Y-Water';
    const repo = 'my-portfolio';
    const baseBranch = 'main';
    const newBranchName = `blog-${slug}`;
    const filePath = `src/content/blog/${slug}.mdx`;

    // mainブランチの最新のコミットSHAを取得
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`,
    });
    const mainSha = refData.object.sha;

    // 新しいブランチを作成
    try {
      await octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${newBranchName}`,
        sha: mainSha,
      });
      console.log(`ブランチを作成しました: ${newBranchName}`);
    } catch (_error) {
      // ブランチが既に存在する場合はエラーを無視
      console.log(`ブランチ ${newBranchName} は既に存在します。続行します。`);
    }

    // ファイルの内容をエンコード（Cloudflare Workers対応版）
    // TextEncoder/btoa を使用してBase64エンコード
    const encoder = new TextEncoder();
    const bytes = encoder.encode(mdxContent);
    const base64Content = btoa(String.fromCharCode(...new Uint8Array(bytes)));

    // ファイルが存在するか確認
    let sha: string | undefined;
    try {
      const { data: fileData } = await octokit.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: newBranchName,
      });

      // fileDataは単一ファイルの場合は単一のオブジェクト、ディレクトリの場合は配列
      if (!Array.isArray(fileData) && 'sha' in fileData) {
        sha = fileData.sha;
        console.log(`既存のファイルを見つけました。SHAは ${sha} です。`);
      }
    } catch (_error) {
      // ファイルが存在しない場合は通常通り続行
      console.log(`ファイルが存在しません。新規作成します: ${filePath}`);
    }

    // ファイルをコミット（既存のファイルがある場合はshaを指定して上書き）
    const { data: commitData } = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: `add: blog post: ${slug}`,
      content: base64Content,
      branch: newBranchName,
      sha: sha, // ファイルが存在する場合はshaを指定、存在しない場合はundefinedになる
    });
    console.log(`コミットが作成されました: ${commitData.commit.sha}`);
    return newBranchName;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error('GitHubへのpushに失敗しました');
    console.error(`message: ${message}`);
    throw error;
  }
}
