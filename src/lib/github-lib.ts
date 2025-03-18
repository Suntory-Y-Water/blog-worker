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
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${newBranchName}`,
      sha: mainSha,
    });
    console.log(`ブランチを作成しました: ${newBranchName}`);

    // ファイルの内容をエンコード（Cloudflare Workers対応版）
    // TextEncoder/btoa を使用してBase64エンコード
    const encoder = new TextEncoder();
    const bytes = encoder.encode(mdxContent);
    const base64Content = btoa(String.fromCharCode(...new Uint8Array(bytes)));

    // ファイルをコミット
    const { data: commitData } = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: `add: blog post: ${slug}`,
      content: base64Content,
      branch: newBranchName,
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
