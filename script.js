// ============================================================================
// THEME MANAGEMENT
// ============================================================================

function initDarkMode() {
  const savedMode = localStorage.getItem('theme');
  const isDark = savedMode ? savedMode === 'dark' : true;
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
}

function toggleDarkMode() {
  const isDark = document.documentElement.style.colorScheme === 'dark';
  const newScheme = isDark ? 'light' : 'dark';
  document.documentElement.style.colorScheme = newScheme;
  localStorage.setItem('theme', newScheme);
  updateThemeToggleButton();
}

function updateThemeToggleButton() {
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    const isDark = document.documentElement.style.colorScheme === 'dark';
    btn.textContent = isDark ? '☀️' : '🌙';
  }
}

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

// ============================================================================
// MAIN PAGE LOADING
// ============================================================================

async function loadData() {
  showLoading();
  
  try {
    const res = await fetch('data.json');
    if (!res.ok) throw new Error('Failed to load portfolio data');
    const data = await res.json();
    
    document.title = `${data.profile.name} - ${data.profile.title}`;
    setupMetaTags();
    
    const app = document.getElementById('app');
    app.innerHTML = '';
    
    const frag = document.createDocumentFragment();
    frag.appendChild(buildNavbar());
    
    const main = document.createElement('main');
    main.appendChild(buildHero(data.profile));
    main.appendChild(buildAbout(data.about));
    main.appendChild(buildEducation(data.education));
    
    const githubUsername = extractGithubUsername(data.profile.github) || 'mustafalzahabi';
    const allProjects = await fetchAndMergeProjects(data.projects || [], githubUsername);
    allProjectsData = allProjects;
    main.appendChild(buildProjects(allProjects));
    
    main.appendChild(buildSkills(data.skills));
    main.appendChild(buildContact(data.contact));
    
    frag.appendChild(main);
    frag.appendChild(buildFooter());
    
    app.appendChild(frag);
    
    setupThemeToggle();
  } catch (e) {
    console.error(e);
    showError(e.message || 'Could not load portfolio data.');
  }
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

function setupThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.onclick = toggleDarkMode;
    updateThemeToggleButton();
  }
}

// ============================================================================
// DOM BUILDERS
// ============================================================================

function buildNavbar() {
  const nav = document.createElement('nav');
  nav.className = 'navbar';
  
  const container = document.createElement('div');
  container.className = 'nav-container';
  
  const logo = document.createElement('a');
  logo.href = '#';
  logo.className = 'logo';
  logo.textContent = 'MA';
  
  const ul = document.createElement('ul');
  ul.className = 'nav-links';
  
  ['Home', 'Projects', 'Skills', 'Contact'].forEach((text, idx) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${text.toLowerCase()}`;
    a.textContent = text;
    li.appendChild(a);
    ul.appendChild(li);
  });
  
  const themeBtn = document.createElement('button');
  themeBtn.id = 'theme-toggle';
  themeBtn.className = 'theme-toggle';
  themeBtn.textContent = '🌙 Dark';
  
  container.appendChild(logo);
  container.appendChild(ul);
  container.appendChild(themeBtn);
  nav.appendChild(container);
  return nav;
}

function buildHero(profile) {
  const section = document.createElement('section');
  section.id = 'home';
  section.className = 'hero';
  
  const content = document.createElement('div');
  content.className = 'hero-content';
  
  const h1 = document.createElement('h1');
  h1.textContent = profile.name;
  
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = profile.title;
  
  const tagline = document.createElement('p');
  tagline.className = 'tagline';
  tagline.textContent = profile.tagline;
  
  const cta = document.createElement('a');
  cta.href = '#projects';
  cta.className = 'hero-cta';
  cta.textContent = profile.cta;
  
  content.append(h1, title, tagline, cta);
  
  const imgDiv = document.createElement('div');
  imgDiv.className = 'hero-image';
  const img = document.createElement('img');
  img.src = profile.photo;
  img.alt = profile.name;
  imgDiv.appendChild(img);
  
  section.append(content, imgDiv);
  return section;
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
        tag.style.color = isLightColor(color) ? '#000' : '#fff';
      }
      techDiv.appendChild(tag);
    });
    
    if (proj.isGitHubRepo && proj.stars !== undefined) {
      const stars = document.createElement('span');
      stars.className = 'project-stars';
      stars.textContent = `⭐ ${proj.stars}`;
      techDiv.appendChild(stars);
    }
    
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

function buildFooter() {
  const footer = document.createElement('footer');
  footer.className = 'footer';
  const p = document.createElement('p');
  p.textContent = `© ${new Date().getFullYear()} Mustafa Alzahabi. All rights reserved.`;
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

// GitHub language color mapping (commonly used languages)
const GITHUB_LANGUAGE_COLORS = {
  'JavaScript': '#f1e05a',
  'TypeScript': '#2b7489',
  'Python': '#3572A5',
  'Java': '#b07219',
  'C++': '#f34b7d',
  'C#': '#239120',
  'Go': '#00ADD8',
  'Rust': '#CE422B',
  'PHP': '#777BB4',
  'Ruby': '#CC342D',
  'CSS': '#563d7c',
  'HTML': '#e34c26',
  'JSON': '#c1e26f',
  'Markdown': '#083fa1',
  'SQL': '#336791',
  'Shell': '#89e051',
  'YAML': '#cb171e',
  'Dockerfile': '#384d54',
  'React': '#61dafb',
  'Vue': '#2c3e50',
  'Angular': '#dd0031'
};

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
      window.location.hash = '#';
    }
  } else {
    currentPage = 'home';
    loadData();
  }
}

function renderProjectDetail(project) {
  const app = document.getElementById('app');
  const frag = document.createDocumentFragment();
  
  frag.appendChild(buildNavbar());
  
  const main = document.createElement('main');
  
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
        tag.style.color = isLightColor(color) ? '#000' : '#fff';
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
    readmeContent.textContent = project.fullReadme;
    
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
      // Slide out in direction, swap image, slide back in
      const translateDistance = direction === 'next' ? 100 : -100;
      img.style.transform = `translateX(${translateDistance}%)`;
      img.style.opacity = '0';
      
      setTimeout(() => {
        onClick();
        img.src = images[currentIndex];
        counter.textContent = `${currentIndex + 1}/${images.length}`;
        // Reset to opposite position and slide back in
        img.style.transform = `translateX(${-translateDistance}%)`;
        img.style.opacity = '0';
        
        // Trigger reflow to restart animation
        void img.offsetWidth;
        
        img.style.transform = 'translateX(0)';
        img.style.opacity = '1';
      }, 200);
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
  return luminance > 0.5;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

initDarkMode();
loadData();
window.addEventListener('hashchange', handleRoute);
