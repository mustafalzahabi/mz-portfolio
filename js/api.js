// ============================================================================
// GITHUB INTEGRATION
// ============================================================================

export function extractGithubUsername(url) {
  if (typeof url !== "string") return null;
  const match = url.match(/github\.com\/([^\/]+)/);
  return match ? match[1] : null;
}

let githubUserCache = {};

export async function fetchGithubUserProfile(username) {
  if (githubUserCache[username]) return githubUserCache[username];
  try {
    const url = `https://api.github.com/users/${username}`;
    console.log("[fetchGithubUserProfile] fetching:", url);
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[fetchGithubUserProfile] returned ${res.status} for ${username}`);
      return null;
    }
    const user = await res.json();
    githubUserCache[username] = user;
    return user;
  } catch (e) {
    console.warn("[fetchGithubUserProfile] Could not fetch GitHub user profile:", e.message);
    return null;
  }
}

export async function fetchGithubUserAvatar(username) {
  const user = await fetchGithubUserProfile(username);
  return user?.avatar_url || null;
}

export async function fetchAndMergeProjects(manualProjects, githubUsername) {
  try {
    const url = `https://api.github.com/users/${githubUsername}/repos?type=public&sort=stars&per_page=100`;
    console.log("[fetchAndMergeProjects] fetching repos:", url);
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[fetchAndMergeProjects] GitHub API returned ${res.status} for ${githubUsername}`);
      throw new Error("GitHub API error");
    }

    let repos = await res.json();
    repos = repos.filter((repo) => !repo.fork);
    console.log(`[fetchAndMergeProjects] found ${repos.length} non-fork repos`);

    const reposWithData = await Promise.all(
      repos.map(async (repo) => {
        const readmeData = await fetchReadmeData(
          githubUsername,
          repo.name,
          repo.default_branch,
        );
        const languages = await fetchRepoLanguages(githubUsername, repo.name);

        const displayDescription =
          readmeData?.description || repo.description || "";

        return {
          name: repo.name,
          description: repo.description || "",
          technologies:
            languages.length > 0
              ? languages
              : repo.language
                ? [repo.language]
                : [],
          image: readmeData?.firstImage || null,
          allImages: readmeData?.allImages || [],
          readmeDescription: displayDescription,
          fullReadme: readmeData?.fullText || "",
          live_link: repo.home || null,
          github_link: repo.html_url,
          stars: repo.stargazers_count,
          isGitHubRepo: true,
        };
      }),
    );

    const result = [...(manualProjects || []), ...reposWithData];
    console.log(`[fetchAndMergeProjects] total ${result.length} projects (${manualProjects?.length || 0} manual + ${reposWithData.length} repos)`);
    return result;
  } catch (e) {
    console.warn("[fetchAndMergeProjects] Could not fetch GitHub repos:", e.message);
    return manualProjects || [];
  }
}

// GitHub language colors - fetched dynamically
export let GITHUB_LANGUAGE_COLORS = {};

// Fetch GitHub language colors from github/linguist languages.yml
export async function initializeLanguageColors() {
  try {
    const res = await fetch(
      "https://raw.githubusercontent.com/github/linguist/master/lib/linguist/languages.yml",
    );
    if (!res.ok) return;

    const yaml = await res.text();
    GITHUB_LANGUAGE_COLORS = {};

    const lines = yaml.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const langMatch = line.match(/^([a-zA-Z0-9\s\-\+#]+):\s*$/);
      if (langMatch) {
        const langName = langMatch[1].trim();
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          const colorMatch = lines[j].match(
            /^\s+color:\s*['"](#[0-9a-fA-F]{6})['"]/,
          );
          if (colorMatch) {
            GITHUB_LANGUAGE_COLORS[langName] = colorMatch[1];
            break;
          }
          if (
            lines[j].match(/^[a-zA-Z0-9\s\-\+#]+:\s*$/) &&
            !lines[j].startsWith(" ")
          ) {
            break;
          }
        }
      }
    }
  } catch (e) {
    console.warn("Failed to fetch GitHub language colors:", e);
  }
}

async function fetchRepoLanguages(username, repoName) {
  try {
    const url = `https://api.github.com/repos/${username}/${repoName}/languages`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const langs = await res.json();
    return Object.keys(langs).sort((a, b) => langs[b] - langs[a]);
  } catch (e) {
    return [];
  }
}

async function fetchReadmeData(username, repoName, branch) {
  try {
    const url = `https://api.github.com/repos/${username}/${repoName}/readme`;
    const res = await fetch(url, {
      headers: { Accept: "application/vnd.github.v3.raw" },
    });

    if (!res.ok) return null;

    const text = await res.text();
    const images = extractImages(text, username, repoName, branch);
    const description = extractDescription(text);
    const fullReadmeWithoutFirstPara = stripFirstParagraph(text);

    return {
      firstImage: images[0] || null,
      allImages: images,
      description,
      fullText: fullReadmeWithoutFirstPara,
    };
  } catch (e) {
    return null;
  }
}

function extractImages(readme, username, repoName, branch) {
  const images = [];
  const seen = new Set();

  // Skip badge/icon services
  const skipPatterns = [
    "shields.io",
    "img.shields.io",
    "badge",
    "badges.",
    "travis-ci",
    "circleci.com",
    "codecov.io",
    "coveralls.io",
    "david-dm.org",
    "snyk.io",
    "devops",
    "gitter.im",
    "discord",
    "chat.badge",
    "stars",
    "forks",
    "issues",
    "license",
    "npm",
    "pypi",
    "crates.io",
    ".svg?",  // often tiny badges
  ];

  function shouldSkip(url) {
    const lower = url.toLowerCase();
    return skipPatterns.some((p) => lower.includes(p));
  }

  function addImage(url, alt) {
    if (!url || seen.has(url)) return;
    if (shouldSkip(url)) return;
    seen.add(url);

    // Resolve relative URLs
    if (url.startsWith("./") || url.startsWith("/") || (!url.includes("://") && !url.startsWith("data:"))) {
      const normalized = url.startsWith("./")
        ? url.slice(2)
        : url.startsWith("/")
          ? url.slice(1)
          : url;
      images.push(
        `https://raw.githubusercontent.com/${username}/${repoName}/${branch}/${normalized}`,
      );
    } else if (url.includes("://")) {
      images.push(url);
    }
  }

  // Markdown images: ![alt](url)
  const mdRegex = /!\[(.*?)\]\((.*?)\)/g;
  let match;
  while ((match = mdRegex.exec(readme))) {
    addImage(match[2], match[1]);
  }

  // HTML images: <img src="url" ...>  or  <img src='url' ...>
  const htmlRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
  while ((match = htmlRegex.exec(readme))) {
    addImage(match[1], "");
  }

  return images;
}

function extractDescription(readme) {
  const lines = readme.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("!")) {
      return trimmed;
    }
  }
  return "";
}

function stripFirstParagraph(readme) {
  const lines = readme.split("\n");
  let foundPara = false;
  let result = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      !foundPara &&
      trimmed &&
      !trimmed.startsWith("#") &&
      !trimmed.startsWith("!")
    ) {
      foundPara = true;
      continue;
    }
    if (foundPara) {
      result.push(line);
    }
  }

  return result.join("\n").trim();
}
