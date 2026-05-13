// ============================================================================
// THEME MANAGEMENT
// ============================================================================

let themeKnobPosition = 0; // 0 = dark (left), 1 = light (right), -1 = auto (thrown off)

function initDarkMode() {
  const savedMode = localStorage.getItem('theme') || 'auto';
  applyTheme(savedMode);
}

function applyTheme(mode) {
  let effectiveScheme = mode;
  
  if (mode === 'auto') {
    effectiveScheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  
  // Set both the color-scheme and a data-theme attribute so CSS can target it
  document.documentElement.style.colorScheme = effectiveScheme;
  document.documentElement.dataset.theme = effectiveScheme;
  localStorage.setItem('theme', mode);
  updateThemeToggleButton();
}

function getCurrentTheme() {
  return localStorage.getItem('theme') || 'auto';
}

function toggleDarkMode() {
  const themes = ['auto', 'light', 'dark'];
  const current = getCurrentTheme();
  const currentIndex = themes.indexOf(current);
  const nextIndex = (currentIndex + 1) % themes.length;
  applyTheme(themes[nextIndex]);
}

function updateThemeToggleButton() {
  const knob = document.getElementById('theme-knob');
  const track = document.getElementById('theme-track');
  if (!knob || !track) return;
  
  const mode = getCurrentTheme();
  // Compute actual sizes so the positions are accurate across devices
  const trackRect = track.getBoundingClientRect();
  const knobRect = knob.getBoundingClientRect();
  const trackWidth = Math.round(trackRect.width);
  const knobWidth = Math.round(knobRect.width);
  const maxTranslate = Math.round(trackWidth - knobWidth);
  
  if (mode === 'auto') {
    knob.classList.add('auto-mode');
    // Determine effective scheme and position the knob accordingly, but mark as auto
    const effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    knob.setAttribute('data-mode', effective);
    knob.setAttribute('data-auto', 'true');
    if (effective === 'light') {
      knob.style.transform = `translate(${maxTranslate}px, -50%)`;
    } else {
      knob.style.transform = `translate(0px, -50%)`;
    }
  } else if (mode === 'light') {
    knob.classList.remove('auto-mode');
    knob.setAttribute('data-mode', 'light');
    // Move to the right (sun position), centered vertically
    knob.style.transform = `translate(${maxTranslate}px, -50%)`;
  } else {
    knob.classList.remove('auto-mode');
    knob.setAttribute('data-mode', 'dark');
    // Move to the left (moon position), centered vertically
    knob.style.transform = 'translate(0px, -50%)';
  }
}

// Listen for system theme changes when in auto mode
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (getCurrentTheme() === 'auto') {
    applyTheme('auto');
  }
});

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let currentPage = 'home';
let allProjectsData = [];

// ============================================================================
// UI STATE FUNCTIONS
// ============================================================================

function showLoading() {
  document.getElementById('app').innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;min-height:100vh;flex-direction:column;">
      <div class="spinner"></div>
      <p class="loading-text">Loading portfolio...</p>
    </div>
  `;
}

function showError(message) {
  document.getElementById('app').innerHTML = `
    <nav class="navbar">
      <div class="nav-container">
        <a href="#home" class="logo">MA</a>
      </div>
    </nav>
    <div class="error-state" style="margin-top:40px;">
      <div class="error-icon">⚠️</div>
      <h2>Something went wrong</h2>
      <p>${message}</p>
      <button class="retry-btn" onclick="location.reload()">Try Again</button>
    </div>
  `;
}

function showLandingPage() {
  document.title = 'GitHub Portfolio';
  document.getElementById('app').innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;min-height:100vh;flex-direction:column;text-align:center;padding:24px;">
      <div style="font-size:56px;margin-bottom:16px;">🐙</div>
      <h1 style="font-size:32px;font-weight:700;margin-bottom:8px;">GitHub Portfolio</h1>
      <p style="color:var(--text-muted,#666);margin-bottom:28px;max-width:440px;">
        Enter a GitHub username to view their portfolio.<br>
        They need a public gist named <code>resume.json</code> following the
        <a href="https://jsonresume.org/schema/" target="_blank" rel="noopener">JSON Resume</a> schema.
      </p>
      <div style="display:flex;gap:8px;max-width:420px;width:100%;flex-wrap:wrap;justify-content:center;">
        <input
          id="username-input"
          type="text"
          placeholder="github-username"
          style="flex:1;min-width:180px;padding:12px 16px;border:2px solid var(--border-color,#ccc);border-radius:8px;font-size:16px;background:var(--surface-color,#fff);color:inherit;"
          autocomplete="off"
          spellcheck="false"
        />
        <button
          onclick="navigateToUser()"
          style="padding:12px 28px;background:var(--accent-color,#0066cc);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:16px;font-weight:600;"
        >View</button>
      </div>
    </div>
  `;
  const input = document.getElementById('username-input');
  if (input) {
    input.addEventListener('keydown', e => { if (e.key === 'Enter') navigateToUser(); });
    input.focus();
  }
}

function navigateToUser() {
  const input = document.getElementById('username-input');
  const username = input?.value.trim();
  if (username) {
    window.location.href = `?user=${encodeURIComponent(username)}`;
  }
}

// ============================================================================
// MAIN PAGE LOADING
// ============================================================================


async function getDynamicResume() {
  // 1. Restore path if redirected from 404.html (GitHub Pages SPA routing trick).
  //    404.html encodes the intended path as "?/the/path" in the query string.
  //    We decode it and replace the URL so the rest of the logic works normally.
  if (window.location.search[1] === '/') {
    const decoded = window.location.search
      .slice(1)
      .split('&')
      .map(s => s.replace(/~and~/g, '&'))
      .join('?');
    window.history.replaceState(
      null, null,
      window.location.pathname.replace(/\/$/, '') + decoded + window.location.hash
    );
  }

  // 2. Determine the GitHub username.
  //    Priority: ?user= query param → URL path segment.
  let githubUsername = '';

  const params = new URLSearchParams(window.location.search);
  if (params.get('user')) {
    githubUsername = params.get('user').trim();
  }

  if (!githubUsername) {
    // Take the last non-empty path segment as the username.
    // On GitHub Pages (*.github.io) the path looks like /repo-name/username,
    // so we need at least 2 segments.
    // On a custom domain the path is just /username (1 segment is enough).
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const isGitHubPages = window.location.hostname.endsWith('.github.io');

    if (isGitHubPages) {
      // /repo-name/username → only accept when username segment is present
      if (pathParts.length >= 2) {
        githubUsername = pathParts[pathParts.length - 1];
      }
    } else {
      // Custom domain or localhost: /username
      if (pathParts.length >= 1) {
        githubUsername = pathParts[pathParts.length - 1];
      }
    }
  }

  if (!githubUsername) {
    // No username anywhere – show the landing page instead of an error.
    return null;
  }

  // 3. Fetch the user's gists list from the GitHub API
  const gistsResponse = await fetch(`https://api.github.com/users/${githubUsername}/gists`);
  if (gistsResponse.status === 403) {
    throw new Error("GitHub API rate limit exceeded. Please try again later.");
  }
  if (!gistsResponse.ok) {
    throw new Error(`GitHub user "${githubUsername}" not found.`);
  }
  const gists = await gistsResponse.json();

  // 4. Scan the gists for a file called 'resume.json'
  const resumeGist = gists.find(gist => gist.files && gist.files['resume.json']);
  if (!resumeGist) {
    throw new Error(`User "${githubUsername}" does not have a public gist named 'resume.json'.`);
  }

  // 5. Fetch the raw JSON from that gist file
  const rawUrl = resumeGist.files['resume.json'].raw_url;
  const resumeResponse = await fetch(rawUrl);
  if (!resumeResponse.ok) {
    throw new Error('Could not fetch resume.json from gist.');
  }
  const resumeData = await resumeResponse.json();
  return { resumeData, githubUsername };
}

async function loadData() {
  showLoading();
  try {
    const result = await getDynamicResume();

    // No username in URL → show the landing page
    if (!result) {
      showLandingPage();
      return;
    }

    const { resumeData: data, githubUsername } = result;

    // --- Customization Section ---

    // Support mz-portfolio-config under meta (JSON Resume v1.0+ compatible)
    let custom = {};
    if (data.meta && data.meta["mz-portfolio-config"]) {
      // Support both array and object for maximum compatibility
      if (Array.isArray(data.meta["mz-portfolio-config"])) {
        custom = data.meta["mz-portfolio-config"][0] || {};
      } else {
        custom = data.meta["mz-portfolio-config"];
      }
    }
    const theme = custom.theme || {};
    const text = custom.text || {};

    // 1. Apply custom accent color and derived palette if present
    if (theme.accent) {
      injectCustomAccent(theme.accent);
    }

    document.title = `${data.basics?.name || githubUsername} - ${data.basics?.label || ''}`;
    setupMetaTags();

    const app = document.getElementById('app');
    app.innerHTML = '';

    const frag = document.createDocumentFragment();
    const main = document.createElement('main');

    // Profile photo: basics.image or fallback to GitHub avatar
    let profilePhoto = data.basics?.image;
    if (!profilePhoto && githubUsername) {
      profilePhoto = `https://github.com/${githubUsername}.png`;
    }

    // Build header
    frag.appendChild(buildHeader({
      name: data.basics?.name || githubUsername,
      title: data.basics?.label || '',
      tagline: text.tagline ?? '',
      photo: profilePhoto,
      cv_link: (data.basics?.profiles || []).find(p => p.network?.toLowerCase() === 'cv')?.url || '',
      cta: text.cta ?? ''
    }, {
      email: data.basics?.email || '',
      github: (data.basics?.profiles || []).find(p => p.network?.toLowerCase() === 'github')?.url || '',
      linkedin: (data.basics?.profiles || []).find(p => p.network?.toLowerCase() === 'linkedin')?.url || '',
    }));
    frag.appendChild(buildTabSelector());

    // Create sections container
    const sections = document.createElement('div');
    sections.className = 'sections';

    // About
    sections.appendChild(buildAbout({
      bio: text.bio ?? '',
      philosophy: text.philosophy ?? '',
      cv_link: (data.basics?.profiles || []).find(p => p.network?.toLowerCase() === 'cv')?.url || '',
    }));

    // Education
    sections.appendChild(buildEducation((data.education || []).map(edu => ({
      degree: edu.studyType + (edu.area ? ' in ' + edu.area : ''),
      institution: edu.institution,
      start_date: edu.startDate,
      end_date: edu.endDate,
      location: edu.location?.city || '',
      notes: edu.score ? `GPA: ${edu.score}` : '',
    }))));

    // Projects
    sections.appendChild(buildProjects((data.projects || []).map(proj => ({
      name: proj.name,
      description: proj.description,
      technologies: proj.keywords || [],
      github_link: proj.url || '',
      live_link: proj.demo || '',
      image: proj.image || '',
    }))));

    // Skills
    sections.appendChild(buildSkills((data.skills || []).map(skill => ({
      category: skill.name,
      items: skill.keywords || [],
    }))));

    // Contact
    sections.appendChild(buildContact({
      message: text.contact_message ?? '',
      email: data.basics?.email || '',
      github: (data.basics?.profiles || []).find(p => p.network?.toLowerCase() === 'github')?.url || '',
      linkedin: (data.basics?.profiles || []).find(p => p.network?.toLowerCase() === 'linkedin')?.url || '',
    }));

    main.appendChild(buildNavbar());
    main.appendChild(sections);
    frag.appendChild(main);
    frag.appendChild(buildFooter(data.basics?.name || githubUsername));
    app.appendChild(frag);
    setupThemeToggle();
  } catch (e) {
    console.error(e);
    showError(e.message || 'Could not load JSON Resume.');
  }
}

// Injects a <style> tag with CSS variables for the accent and derived palette
function injectCustomAccent(accent) {
  // Helper: calculate a contrasting color (black/white) for text
  function getContrast(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
    const r = parseInt(hex.substr(0,2),16), g = parseInt(hex.substr(2,2),16), b = parseInt(hex.substr(4,2),16);
    // Luminance formula
    const luminance = (0.299*r + 0.587*g + 0.114*b)/255;
    return luminance > 0.5 ? '#222' : '#fff';
  }
  // Helper: lighten/darken a hex color
  function shade(hex, percent) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
    let r = parseInt(hex.substr(0,2),16), g = parseInt(hex.substr(2,2),16), b = parseInt(hex.substr(4,2),16);
    r = Math.min(255, Math.max(0, Math.round(r + (percent/100)*255)));
    g = Math.min(255, Math.max(0, Math.round(g + (percent/100)*255)));
    b = Math.min(255, Math.max(0, Math.round(b + (percent/100)*255)));
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  }
  // Derive palette
  const accentColor = accent;
  const hoverColor = shade(accent, -15);
  const backgroundColor = shade(accent, 80);
  const primaryColor = getContrast(accent);
  const secondaryColor = shade(accent, 60);
  const surfaceColor = shade(accent, 95);
  const borderColor = shade(accent, 70);
  const codeColor = accent;
  // Compose CSS
  const css = `:root {\n  --accent-color: ${accentColor};\n  --hover-color: ${hoverColor};\n  --background-color: ${backgroundColor};\n  --primary-color: ${primaryColor};\n  --secondary-color: ${secondaryColor};\n  --surface-color: ${surfaceColor};\n  --border-color: ${borderColor};\n  --code-color: ${codeColor};\n}`;
  // Remove any previous custom style
  let styleTag = document.getElementById('mz-custom-accent');
  if (styleTag) styleTag.remove();
  styleTag = document.createElement('style');
  styleTag.id = 'mz-custom-accent';
  styleTag.innerText = css;
  document.head.appendChild(styleTag);
}

function setupMetaTags() {
  if (!document.querySelector('meta[charset]')) {
    const meta = document.createElement('meta');
    meta.charset = 'UTF-8';
    document.head.appendChild(meta);
  }
  
  if (!document.querySelector('meta[name="viewport"]')) {
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1.0';
    document.head.appendChild(meta);
  }
}

function attachThemeSwitchHandlers(track, knob) {
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartPos = 0;
  let currentPos = 0;
  let currentY = 0;
  let escapeTrack = false; // Whether knob has escaped track bounds
  // Compute actual sizes from DOM so behavior is consistent on mobile
  function computeSizes() {
    const tRect = track.getBoundingClientRect();
    const kRect = knob.getBoundingClientRect();
    return {
      trackWidth: Math.round(tRect.width),
      trackHeight: Math.round(tRect.height),
      knobWidth: Math.round(kRect.width),
      knobHeight: Math.round(kRect.height),
      maxTranslate: Math.round(tRect.width - kRect.width),
    };
  }
  let { trackWidth, trackHeight, knobWidth, knobHeight, maxTranslate } = computeSizes();
  const midpoint = maxTranslate / 2; // 28px
  const throwThreshold = 40; // pixels beyond max to trigger auto
  const verticalThreshold = 20; // pixels up/down to trigger auto
  const escapeThreshold = 15; // pixels beyond track to unlock vertical movement
  
  function snapToPosition(endPos, endY) {
    const throwThresholdRight = maxTranslate + throwThreshold;
    const throwThresholdLeft = -throwThreshold;
    const isOffVertically = Math.abs(endY) > verticalThreshold;
    const isOffHorizontally = endPos > throwThresholdRight || endPos < throwThresholdLeft;
    
    if (isOffHorizontally || isOffVertically) {
      // Thrown off track in any direction - enable auto
      applyTheme('auto');
    } else if (endPos > midpoint) {
      // Closer to right - light mode (sun)
      applyTheme('light');
    } else {
      // Closer to left - dark mode (moon)
      applyTheme('dark');
    }
  }
  
  knob.addEventListener('pointerdown', (e) => {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    // Recompute sizes at drag start (handles orientation/zoom changes)
    ({ trackWidth, trackHeight, knobWidth, knobHeight, maxTranslate } = computeSizes());
    const transform = knob.style.transform;
    // Extract only the X translation, ignoring the Y centering
    const matchX = transform.match(/translate\(([-\d.]+)px/);
    dragStartPos = matchX ? parseFloat(matchX[1]) : 0;
    currentY = 0;
    escapeTrack = false;
    knob.classList.add('dragging');
    // Prevent scrolling while interacting and ensure we capture all pointer events
    e.preventDefault();
    if (e.pointerId && knob.setPointerCapture) {
      try { knob.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
  });
  
  document.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    currentPos = dragStartPos + deltaX;
    
    // Check if knob has escaped the track horizontally
    const hasEscapedRight = currentPos > (maxTranslate + escapeThreshold);
    const hasEscapedLeft = currentPos < -escapeThreshold;
    
    if (hasEscapedRight || hasEscapedLeft) {
      escapeTrack = true;
    }
    
    // Only apply vertical movement if knob has escaped track
    if (escapeTrack) {
      currentY = deltaY;
    } else {
      currentY = 0;
    }
    
    knob.style.transform = `translate(${currentPos}px, calc(-50% + ${currentY}px))`;
    knob.style.transition = 'none';
  });
  
  document.addEventListener('pointerup', () => {
    if (!isDragging) return;
    isDragging = false;
    knob.classList.remove('dragging');
    knob.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    snapToPosition(currentPos, currentY);
    // release pointer capture if we have it
    try { if (knob.releasePointerCapture) knob.releasePointerCapture(); } catch (e) { /* ignore */ }
  });
  
  // Click on track to switch between dark and light (only, not auto)
  track.addEventListener('click', (e) => {
    // Only toggle if clicking on the track itself, not the knob
    const rect = track.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const kRect = knob.getBoundingClientRect();
    const knobLeft = kRect.left - rect.left;
    const knobRight = knobLeft + kRect.width;

    if (clickX < knobLeft || clickX > knobRight) {
      const current = getCurrentTheme();
      if (current === 'auto') {
        applyTheme('dark');
      } else if (current === 'dark') {
        applyTheme('light');
      } else {
        applyTheme('dark');
      }
    }
  });
  
  // Keyboard support
  track.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const current = getCurrentTheme();
      if (current === 'auto') {
        applyTheme('dark');
      } else if (current === 'dark') {
        applyTheme('light');
      } else {
        applyTheme('dark');
      }
    } else if (e.key === 'ArrowRight') {
      applyTheme('light');
    } else if (e.key === 'ArrowLeft') {
      applyTheme('dark');
    }
  });
  
  // Initialize current position
  updateThemeToggleButton();
}

function setupThemeToggle() {
  const track = document.getElementById('theme-track');
  const knob = document.getElementById('theme-knob');
  if (track && knob) {
    updateThemeToggleButton();
  }
}

// ============================================================================
// DOM BUILDERS
// ============================================================================

function buildNavbar() {
  const nav = document.createElement('nav');
  nav.className = 'navbar';
  
  const sections = [
    { id: 'about', label: 'About' },
    { id: 'education', label: 'Education' },
    { id: 'projects', label: 'Projects' },
    { id: 'skills', label: 'Skills' },
    { id: 'contact', label: 'Contact' }
  ];
  
  sections.forEach((section) => {
    const navItem = document.createElement('div');
    navItem.className = 'nav-item';
    navItem.setAttribute('data-section', section.id);
    
    const dot = document.createElement('div');
    dot.className = 'nav-dot';
    
    const label = document.createElement('span');
    label.className = 'nav-label';
    label.textContent = section.label;
    
    const a = document.createElement('a');
    a.href = `#${section.id}`;
    a.appendChild(dot);
    
    navItem.appendChild(a);
    navItem.appendChild(label);
    nav.appendChild(navItem);
  });
  
  // Track active section on scroll
  window.addEventListener('scroll', updateActiveNavItem);
  
  return nav;
}

function updateActiveNavItem() {
  const navItems = document.querySelectorAll('.nav-item');
  const scrollPos = window.scrollY + 200;
  
  navItems.forEach((item) => {
    const sectionId = item.getAttribute('data-section');
    const section = document.getElementById(sectionId);
    
    if (section) {
      const sectionTop = section.offsetTop;
      const sectionBottom = sectionTop + section.offsetHeight;
      
      if (scrollPos >= sectionTop && scrollPos < sectionBottom) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    }
  });
}

function buildHeader(profile, contact) {
  const header = document.createElement('header');
  header.id = 'header';
  
  // Background banner
  const banner = document.createElement('div');
  banner.className = 'profile-banner';
  
  // Theme toggle switch (top right) - draggable
  const themeSwitch = document.createElement('div');
  themeSwitch.id = 'theme-switch';
  themeSwitch.className = 'theme-switch';
  
  const track = document.createElement('div');
  track.id = 'theme-track';
  track.className = 'theme-switch-track';
  track.setAttribute('role', 'switch');
  track.setAttribute('aria-label', 'Toggle theme');
  track.setAttribute('tabindex', '0');
  
  const knob = document.createElement('div');
  knob.id = 'theme-knob';
  knob.className = 'theme-switch-knob';
  
  const moonIcon = document.createElement('img');
  moonIcon.className = 'theme-icon theme-icon-moon';
  moonIcon.src = 'dark-theme.svg';
  moonIcon.alt = 'moon';
  moonIcon.width = 30;
  moonIcon.height = 30;

  const sunIcon = document.createElement('img');
  sunIcon.className = 'theme-icon theme-icon-sun';
  sunIcon.src = 'light-theme.svg';
  sunIcon.alt = 'sun';
  sunIcon.width = 30;
  sunIcon.height = 30;
  
  knob.appendChild(moonIcon);
  knob.appendChild(sunIcon);
  track.appendChild(knob);
  themeSwitch.appendChild(track);
  banner.appendChild(themeSwitch);
  
  // Attach drag handlers
  attachThemeSwitchHandlers(track, knob);
  
  // Banner links (bottom right)
  const bannerLinks = document.createElement('div');
  bannerLinks.className = 'banner-links';
  
  if (profile.cv_link) {
    const resumeLink = document.createElement('a');
    resumeLink.href = profile.cv_link;
    resumeLink.target = '_blank';
    resumeLink.className = 'banner-link-item';
    resumeLink.textContent = '📄 Resume';
    bannerLinks.appendChild(resumeLink);
  }
  
  if (contact) {
    if (contact.email) {
      const emailLink = document.createElement('a');
      emailLink.href = `mailto:${contact.email}`;
      emailLink.className = 'banner-link-item';
      emailLink.textContent = '✉️ Email';
      bannerLinks.appendChild(emailLink);
    }
    
    if (contact.github) {
      const ghLink = document.createElement('a');
      ghLink.href = contact.github;
      ghLink.target = '_blank';
      ghLink.className = 'banner-link-item';
      ghLink.textContent = '🐙 GitHub';
      bannerLinks.appendChild(ghLink);
    }
    
    if (contact.linkedin) {
      const liLink = document.createElement('a');
      liLink.href = contact.linkedin;
      liLink.target = '_blank';
      liLink.className = 'banner-link-item';
      liLink.textContent = '💼 LinkedIn';
      bannerLinks.appendChild(liLink);
    }
  }
  
  banner.appendChild(bannerLinks);
  header.appendChild(banner);
  
  // Profile info container
  const profileInfo = document.createElement('div');
  profileInfo.className = 'profile-info';
  
  // Profile photo
  const img = document.createElement('img');
  img.src = profile.photo;
  img.alt = profile.name;
  img.className = 'profile-photo';
  profileInfo.appendChild(img);
  
  // Profile details
  const details = document.createElement('div');
  details.className = 'profile-details';
  
  const h1 = document.createElement('h1');
  h1.className = 'profile-name';
  h1.textContent = profile.name;
  
  const title = document.createElement('div');
  title.className = 'profile-title';
  title.textContent = profile.title;
  
  const tagline = document.createElement('p');
  tagline.className = 'profile-tagline';
  tagline.textContent = profile.tagline;
  
  details.append(h1, title, tagline);
  profileInfo.appendChild(details);
  header.appendChild(profileInfo);
  
  return header;
}

function buildTabSelector() {
  const tabSelector = document.createElement('nav');
  tabSelector.className = 'tab-selector';
  
  const tabLink = document.createElement('a');
  tabLink.href = '#';
  tabLink.className = 'tab-link active';
  tabLink.textContent = 'My Profile';
  
  tabSelector.appendChild(tabLink);
  
  return tabSelector;
}

function buildAbout(about) {
  const section = createSection('About Me', 'about');
  const container = document.createElement('div');
  container.className = 'about-container';
  
  const bioDiv = createTextBlock('Biography', about.bio);
  const philDiv = createTextBlock('Philosophy', about.philosophy);
  
  const cvLink = document.createElement('a');
  cvLink.href = about.cv_link;
  cvLink.className = 'cv-link';
  cvLink.download = '';
  cvLink.textContent = 'Download Resume';
  philDiv.appendChild(cvLink);
  
  container.append(bioDiv, philDiv);
  section.appendChild(container);
  return section;
}

function buildEducation(education) {
  const section = createSection('Education', 'education');
  const list = document.createElement('div');
  list.className = 'education-list';
  
  education.forEach(edu => {
    const card = document.createElement('div');
    card.className = 'education-card';
    
    const h3 = document.createElement('h3');
    h3.textContent = edu.degree;
    
    const inst = document.createElement('div');
    inst.className = 'institution';
    inst.textContent = edu.institution;
    
    const dates = document.createElement('div');
    dates.className = 'dates';
    dates.textContent = `${edu.start_date} – ${edu.end_date}`;
    
    const location = document.createElement('div');
    location.textContent = edu.location;
    
    card.append(h3, inst, dates, location);
    
    if (edu.notes) {
      const notes = document.createElement('div');
      notes.className = 'notes';
      notes.textContent = edu.notes;
      card.appendChild(notes);
    }
    
    list.appendChild(card);
  });
  
  section.appendChild(list);
  return section;
}

function buildProjects(projects) {
  const section = createSection('Projects', 'projects');
  const grid = document.createElement('div');
  grid.className = 'projects-grid';
  
  projects.forEach(proj => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.style.cursor = 'pointer';
    card.onclick = () => {
      allProjectsData = projects;
      window.location.hash = `#/project/${encodeURIComponent(proj.name)}`;
    };
    
    if (proj.image) {
      const imgDiv = document.createElement('div');
      imgDiv.className = 'project-image';
      const img = document.createElement('img');
      img.src = proj.image;
      img.alt = proj.name;
      img.onerror = () => imgDiv.style.display = 'none';
      imgDiv.appendChild(img);
      card.appendChild(imgDiv);
    }
    
    const content = document.createElement('div');
    content.className = 'project-content';
    
    const h3 = document.createElement('h3');
    h3.textContent = proj.name;
    
    // Only create a description paragraph if project has one
    let desc = null;
    if (proj.description && proj.description.trim()) {
      desc = document.createElement('p');
      desc.textContent = proj.description;
    }
    
    const techDiv = document.createElement('div');
    techDiv.className = 'project-tech';
    
    proj.technologies.forEach(tech => {
      const tag = document.createElement('span');
      tag.className = 'tech-tag';
      tag.textContent = tech;
      // Color tech tags by language if available; otherwise use CSS default
      const color = GITHUB_LANGUAGE_COLORS[tech];
      if (color) {
        tag.style.backgroundColor = color;
        tag.style.color = getContrastTextColor(color);
      }
      techDiv.appendChild(tag);
    });
    
    const links = document.createElement('div');
    links.className = 'project-links';
    links.style.pointerEvents = 'auto';
    
    if (proj.live_link) {
      const liveLink = document.createElement('a');
      liveLink.href = proj.live_link;
      liveLink.target = '_blank';
      liveLink.textContent = 'Live Demo';
      liveLink.onclick = e => e.stopPropagation();
      links.appendChild(liveLink);
    }
    
    const ghLink = document.createElement('a');
    ghLink.href = proj.github_link;
    ghLink.target = '_blank';
    ghLink.textContent = 'GitHub';
    ghLink.onclick = e => e.stopPropagation();
    links.appendChild(ghLink);
    
  // Append description only when it exists (avoids showing empty text)
  if (desc) content.append(h3, desc, techDiv, links);
  else content.append(h3, techDiv, links);
    card.appendChild(content);
    grid.appendChild(card);
  });
  
  section.appendChild(grid);
  return section;
}

function buildSkills(skills) {
  const section = createSection('Skills', 'skills');
  const grid = document.createElement('div');
  grid.className = 'skills-grid';
  
  skills.forEach(group => {
    const category = document.createElement('div');
    category.className = 'skill-category';
    
    const h3 = document.createElement('h3');
    h3.textContent = group.category;
    
    const ul = document.createElement('ul');
    group.items.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      ul.appendChild(li);
    });
    
    category.append(h3, ul);
    grid.appendChild(category);
  });
  
  section.appendChild(grid);
  return section;
}

function buildContact(contact) {
  const section = createSection('Get In Touch', 'contact');
  const container = document.createElement('div');
  container.className = 'contact-container';
  
  const msg = document.createElement('p');
  msg.textContent = contact.message;
  
  const links = document.createElement('div');
  links.className = 'contact-links';
  
  const emailLink = document.createElement('a');
  emailLink.href = `mailto:${contact.email}`;
  emailLink.textContent = 'Email';
  
  const ghLink = document.createElement('a');
  ghLink.href = contact.github;
  ghLink.target = '_blank';
  ghLink.textContent = 'GitHub';
  
  const liLink = document.createElement('a');
  liLink.href = contact.linkedin;
  liLink.target = '_blank';
  liLink.textContent = 'LinkedIn';
  
  links.append(emailLink, ghLink, liLink);
  container.append(msg, links);
  section.appendChild(container);
  return section;
}

function buildFooter(name) {
  const footer = document.createElement('footer');
  footer.className = 'footer';
  const p = document.createElement('p');
  p.textContent = `© ${new Date().getFullYear()} ${name || 'Portfolio'}. All rights reserved.`;
  footer.appendChild(p);
  return footer;
}

// ============================================================================
// HELPER DOM FUNCTIONS
// ============================================================================

function createSection(title, id) {
  const section = document.createElement('section');
  section.className = 'section';
  section.id = id;
  
  const h2 = document.createElement('h2');
  h2.className = 'section-title';
  h2.textContent = title;
  
  section.appendChild(h2);
  return section;
}

function createTextBlock(title, text) {
  const div = document.createElement('div');
  div.className = 'about-text';
  
  const h3 = document.createElement('h3');
  h3.textContent = title;
  
  const p = document.createElement('p');
  p.textContent = text;
  
  div.append(h3, p);
  return div;
}

// ============================================================================
// GITHUB INTEGRATION
// ============================================================================

function extractGithubUsername(url) {
  if (typeof url !== 'string') return null;
  const match = url.match(/github\.com\/([^\/]+)/);
  return match ? match[1] : null;
}

async function fetchGithubUserAvatar(username) {
  try {
    const url = `https://api.github.com/users/${username}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const user = await res.json();
    return user.avatar_url || null;
  } catch (e) {
    console.warn('Could not fetch GitHub user avatar:', e.message);
    return null;
  }
}

async function fetchAndMergeProjects(manualProjects, githubUsername) {
  try {
    const url = `https://api.github.com/users/${githubUsername}/repos?type=public&sort=stars&per_page=100`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('GitHub API error');
    
    let repos = await res.json();
    repos = repos.filter(repo => !repo.fork);
    
    const reposWithData = await Promise.all(
      repos.map(async (repo) => {
        const readmeData = await fetchReadmeData(githubUsername, repo.name, repo.default_branch);
        const languages = await fetchRepoLanguages(githubUsername, repo.name);
        
        // Use README description if available, fallback to repo description
        const displayDescription = readmeData?.description || repo.description || '';
        
        return {
          name: repo.name,
          description: repo.description || '',
          technologies: languages.length > 0 ? languages : (repo.language ? [repo.language] : []),
          image: readmeData?.firstImage || null,
          allImages: readmeData?.allImages || [],
          readmeDescription: displayDescription,
          fullReadme: readmeData?.fullText || '',
          live_link: repo.homepage || null,
          github_link: repo.html_url,
          stars: repo.stargazers_count,
          isGitHubRepo: true
        };
      })
    );
    
    return [...(manualProjects || []), ...reposWithData];
  } catch (e) {
    console.warn('Could not fetch GitHub repos:', e.message);
    return manualProjects || [];
  }
}

// GitHub language colors - fetched dynamically
let GITHUB_LANGUAGE_COLORS = {};

// Fetch GitHub language colors from github/linguist languages.yml
async function initializeLanguageColors() {
  try {
    const res = await fetch('https://raw.githubusercontent.com/github/linguist/master/lib/linguist/languages.yml');
    if (!res.ok) return;
    
    const yaml = await res.text();
    GITHUB_LANGUAGE_COLORS = {};
    
    // Parse YAML to extract language names and their color codes
    // YAML format: language_name:\n  color: '#HEXCODE'
    const lines = yaml.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match language name (key with no indentation followed by colon)
      const langMatch = line.match(/^([a-zA-Z0-9\s\-\+#]+):\s*$/);
      if (langMatch) {
        const langName = langMatch[1].trim();
        // Look for color in next few lines (usually indented with 2 spaces)
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          const colorMatch = lines[j].match(/^\s+color:\s*['"](#[0-9a-fA-F]{6})['"]/);
          if (colorMatch) {
            GITHUB_LANGUAGE_COLORS[langName] = colorMatch[1];
            break;
          }
          // Stop if we hit another language definition
          if (lines[j].match(/^[a-zA-Z0-9\s\-\+#]+:\s*$/) && !lines[j].startsWith(' ')) {
            break;
          }
        }
      }
    }
  } catch (e) {
    console.warn('Failed to fetch GitHub language colors:', e);
    // Fallback to empty colors - tags will use default CSS styling
  }
}

// Initialize colors on page load
initializeLanguageColors();

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
    const res = await fetch(url, { headers: { 'Accept': 'application/vnd.github.v3.raw' } });
    
    if (!res.ok) return null;
    
    const text = await res.text();
    const images = extractImages(text, username, repoName, branch);
    const description = extractDescription(text);
    const fullReadmeWithoutFirstPara = stripFirstParagraph(text);
    
    return {
      firstImage: images[0] || null,
      allImages: images,
      description,
      fullText: fullReadmeWithoutFirstPara
    };
  } catch (e) {
    return null;
  }
}

function extractImages(readme, username, repoName, branch) {
  const imageRegex = /!\[.*?\]\((.*?)\)/g;
  const images = [];
  let match;
  
  while ((match = imageRegex.exec(readme))) {
    const url = match[1];
    if (url.startsWith('./') || url.startsWith('/') || !url.includes('://')) {
      const normalized = url.startsWith('./') ? url.slice(2) : url.startsWith('/') ? url.slice(1) : url;
      images.push(`https://raw.githubusercontent.com/${username}/${repoName}/${branch}/${normalized}`);
    }
  }
  
  return images;
}

function extractDescription(readme) {
  const lines = readme.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('!')) {
      return trimmed;
    }
  }
  return '';
}

function stripFirstParagraph(readme) {
  const lines = readme.split('\n');
  let foundPara = false;
  let result = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!foundPara && trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('!')) {
      foundPara = true;
      continue;
    }
    if (foundPara) {
      result.push(line);
    }
  }
  
  return result.join('\n').trim();
}

// ============================================================================
// PROJECT DETAIL PAGE
// ============================================================================

function handleRoute() {
  const hash = window.location.hash;
  
  if (hash.startsWith('#/project/')) {
    const projectName = decodeURIComponent(hash.slice(10));
    const project = allProjectsData.find(p => p.name === projectName);
    
    if (project) {
      currentPage = 'project-detail';
      renderProjectDetail(project);
    } else {
      // Project not found in cache, need to reload data first
      loadDataThenRoute();
    }
  } else {
    currentPage = 'home';
    loadData();
  }
}

async function loadDataThenRoute() {
  showLoading();
  
  try {
    const result = await getDynamicResume();
    if (!result) {
      showLandingPage();
      return;
    }
    const { resumeData: data, githubUsername } = result;
    const manualProjects = (data.projects || []).map(proj => ({
      name: proj.name,
      description: proj.description,
      technologies: proj.keywords || [],
      github_link: proj.url || '',
      live_link: proj.demo || '',
      image: proj.image || '',
    }));
    allProjectsData = manualProjects;
    
    // Now try the route again
    handleRoute();
  } catch (e) {
    console.error(e);
    showError(e.message || 'Could not load portfolio data.');
  }
}

function renderProjectDetail(project) {
  const app = document.getElementById('app');
  const frag = document.createDocumentFragment();
  
  const main = document.createElement('main');
  
  main.appendChild(buildNavbar());
  
  // Back button
  const backBtn = document.createElement('a');
  backBtn.href = '#';
  backBtn.className = 'project-detail-back';
  backBtn.textContent = '← Back to Projects';
  main.appendChild(backBtn);
  
  // Title and links
  const h1 = document.createElement('h1');
  h1.className = 'project-detail-title';
  h1.textContent = project.name;
  main.appendChild(h1);
  
  const links = document.createElement('div');
  links.className = 'project-links';
  
  if (project.live_link) {
    const a = document.createElement('a');
    a.href = project.live_link;
    a.target = '_blank';
    a.textContent = '🔗 Live Demo';
    links.appendChild(a);
  }
  
  const ghLink = document.createElement('a');
  ghLink.href = project.github_link;
  ghLink.target = '_blank';
  ghLink.textContent = '🐙 GitHub';
  links.appendChild(ghLink);
  main.appendChild(links);
  
  // Flex container: slideshow left, about/tech right
  const container = document.createElement('div');
  container.className = 'project-detail-container';
  
  // Left: Slideshow (smaller)
  const leftCol = document.createElement('div');
  leftCol.className = 'project-detail-left';
  
  if (project.allImages?.length > 0) {
    leftCol.appendChild(buildSlideshow(project.allImages));
  }
  
  // Right: About + Technologies
  const rightCol = document.createElement('div');
  rightCol.className = 'project-detail-right';
  
  if (project.readmeDescription) {
    const desc = document.createElement('div');
    desc.className = 'project-detail-section';
    
    const h2 = document.createElement('h2');
    h2.textContent = 'About';
    
    const p = document.createElement('p');
    p.textContent = project.readmeDescription;
    
    desc.append(h2, p);
    rightCol.appendChild(desc);
  }
  
  if (project.technologies?.length > 0) {
    const tech = document.createElement('div');
    tech.className = 'project-detail-section';
    
    const h2 = document.createElement('h2');
    h2.textContent = 'Technologies';
    
    const tags = document.createElement('div');
    tags.className = 'project-detail-tech';
    
    project.technologies.forEach(t => {
      const tag = document.createElement('span');
      tag.className = 'tech-tag';
      tag.textContent = t;
      // Color tech tags by language if available; otherwise use CSS default
      const color = GITHUB_LANGUAGE_COLORS[t];
      if (color) {
        tag.style.backgroundColor = color;
        tag.style.color = getContrastTextColor(color);
      }
      tags.appendChild(tag);
    });
    
    tech.append(h2, tags);
    rightCol.appendChild(tech);
  }
  
  container.append(leftCol, rightCol);
  main.appendChild(container);
  
  // Full-width README section below
  if (project.fullReadme) {
    const readmeSection = document.createElement('section');
    readmeSection.className = 'project-detail-readme';
    
    const readmeTitle = document.createElement('h2');
    readmeTitle.textContent = 'README';
    
    const readmeContent = document.createElement('div');
    readmeContent.className = 'project-detail-readme-content';
    readmeContent.innerHTML = markdownToHtml(project.fullReadme);
    
    readmeSection.append(readmeTitle, readmeContent);
    main.appendChild(readmeSection);
  }
  
  frag.appendChild(main);
  frag.appendChild(buildFooter());
  
  app.innerHTML = '';
  app.appendChild(frag);
  
  setupThemeToggle();
  
  // Scroll to top of page
  window.scrollTo(0, 0);
}

function buildSlideshow(images) {
  const container = document.createElement('div');
  container.className = 'slideshow-container';
  
  const wrapper = document.createElement('div');
  wrapper.className = 'slideshow-wrapper';
  
  let currentIndex = 0;
  
  const img = document.createElement('img');
  img.className = 'slideshow-img';
  img.src = images[0];
  img.alt = 'Project screenshot';
  img.onerror = () => img.style.display = 'none';
  
  const counter = document.createElement('div');
  counter.className = 'slideshow-counter';
  counter.textContent = `${currentIndex + 1}/${images.length}`;
  
  wrapper.append(img, counter);
  
  if (images.length > 1) {
    const animateSlide = (direction, onClick) => {
      // Determine which animations to use based on direction
      const outClass = direction === 'next' ? 'slide-out-left' : 'slide-out-right';
      const inClass = direction === 'next' ? 'slide-in-right' : 'slide-in-left';
      
      // Add exit animation class
      img.classList.add(outClass);
      
      // Wait for animation to complete before swapping image
      setTimeout(() => {
        // Remove old animation classes
        img.classList.remove(outClass, inClass);
        
        // Update image and counter
        onClick();
        img.src = images[currentIndex];
        counter.textContent = `${currentIndex + 1}/${images.length}`;
        
        // Trigger reflow to allow new animation to start
        void img.offsetWidth;
        
        // Add enter animation class
        img.classList.add(inClass);
      }, 400);
    };
    
    const createBtn = (text, direction, onClick) => {
      const btn = document.createElement('button');
      btn.className = 'slideshow-btn';
      btn.textContent = text;
      btn.onmouseover = () => btn.style.background = 'rgba(0,0,0,0.7)';
      btn.onmouseout = () => btn.style.background = 'rgba(0,0,0,0.5)';
      btn.onclick = () => animateSlide(direction, onClick);
      return btn;
    };
    
    const prevBtn = createBtn('◀', 'prev', () => {
      currentIndex = (currentIndex - 1 + images.length) % images.length;
    });
    prevBtn.style.left = '16px';
    
    const nextBtn = createBtn('▶', 'next', () => {
      currentIndex = (currentIndex + 1) % images.length;
    });
    nextBtn.style.right = '16px';
    
    const buttons = document.createElement('div');
    buttons.className = 'slideshow-buttons';
    buttons.append(prevBtn, nextBtn);
    wrapper.appendChild(buttons);
  }
  
  container.appendChild(wrapper);
  return container;
}

// ============================================================================
// MARKDOWN TO HTML CONVERTER
// ============================================================================

function markdownToHtml(markdown) {
  let html = markdown;
  
  // Escape HTML characters to prevent injection
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  // Convert back markdown syntax to HTML
  // Headers: # -> <h3>, ## -> <h4>, etc.
  html = html.replace(/^### (.*?)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.*?)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.*?)$/gm, '<h2>$1</h2>');
  
  // Bold: **text** -> <strong>text</strong>
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Italic: *text* -> <em>text</em>
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Code blocks: ```code``` -> <pre><code>code</code></pre>
  html = html.replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>');
  
  // Inline code: `code` -> <code>code</code>
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');
  
  // Links: [text](url) -> <a href="url" target="_blank">text</a>
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
  
  // Unordered lists: - item -> <li>item</li> (wrapped in <ul>)
  html = html.replace(/^- (.*?)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*?<\/li>)/s, '<ul>$1</ul>');
  html = html.replace(/<\/ul>\s*<ul>/g, '');
  
  // Paragraphs: convert double newlines to <p>
  html = html.replace(/\n\n+/g, '</p><p>');
  html = '<p>' + html + '</p>';
  
  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<h[2-4]>)/g, '$1');
  html = html.replace(/(<\/h[2-4]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<pre>)/g, '$1');
  html = html.replace(/(<\/pre>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');
  
  return html;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function isLightColor(hexColor) {
  // Remove # if present
  const hex = hexColor.replace('#', '');
  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Calculate luminance using WCAG formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  // Improved threshold for better contrast
  return luminance > 0.6;
}

function getContrastTextColor(hexColor) {
  // Ensure better contrast by checking against both black and white
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Calculate relative luminance using WCAG formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return white for dark colors, black for light colors
  // Use 0.5 threshold for optimal readability
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

// ============================================================================
// INITIALIZATION
// ============================================================================

initDarkMode();

// Check if there's a hash route on page load
const hash = window.location.hash;
if (hash.startsWith('#/project/')) {
  loadDataThenRoute();
} else {
  loadData();
}

window.addEventListener('hashchange', handleRoute);