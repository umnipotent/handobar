(function () {
  const releaseApiUrl = "https://api.github.com/repos/umnipotent/handobar/releases/latest";
  const releasesUrl = "https://github.com/umnipotent/handobar/releases";

  const versionEl = document.querySelector("[data-release-version]");
  const dateEl = document.querySelector("[data-release-date]");
  const releaseLinks = document.querySelectorAll("[data-release-link]");
  const downloadLinks = document.querySelectorAll("[data-download-link]");
  const downloadLabelEls = document.querySelectorAll("[data-download-label]");

  function setReleaseState(state) {
    if (versionEl) {
      versionEl.dataset.releaseState = state;
    }
  }

  function formatReleaseDate(value) {
    if (!value) {
      return "";
    }

    return new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "medium",
      timeZone: "Asia/Seoul",
    }).format(new Date(value));
  }

  function findDmgAsset(assets) {
    if (!Array.isArray(assets)) {
      return null;
    }

    return assets.find((asset) => {
      return typeof asset?.name === "string" && asset.name.toLowerCase().endsWith(".dmg");
    });
  }

  async function loadLatestRelease() {
    try {
      const response = await fetch(releaseApiUrl, {
        headers: { Accept: "application/vnd.github+json" },
      });

      if (!response.ok) {
        throw new Error(`GitHub release request failed: ${response.status}`);
      }

      const release = await response.json();
      const version = release.tag_name || release.name || "latest";
      const releaseUrl = release.html_url || releasesUrl;
      const dmgAsset = findDmgAsset(release.assets);
      const downloadUrl = dmgAsset?.browser_download_url || releaseUrl;
      const releasedAt = formatReleaseDate(release.published_at || release.created_at);

      if (versionEl) {
        versionEl.textContent = `최신 릴리스 ${version}`;
      }

      if (dateEl && releasedAt) {
        dateEl.textContent = `${version} 릴리스가 ${releasedAt} 기준으로 제공됩니다.`;
      }

      releaseLinks.forEach((link) => {
        link.href = releaseUrl;
      });

      downloadLinks.forEach((link) => {
        link.href = downloadUrl;
      });

      downloadLabelEls.forEach((label) => {
        label.textContent = `다운로드 ${version}`;
      });

      setReleaseState("ready");
    } catch (error) {
      console.warn(error);

      if (versionEl) {
        versionEl.textContent = "최신 릴리스는 GitHub에서 확인";
      }

      if (dateEl) {
        dateEl.textContent = "릴리스 정보를 불러오지 못하면 GitHub Releases에서 직접 확인하세요.";
      }

      setReleaseState("error");
    }
  }

  loadLatestRelease();
})();
