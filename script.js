// Initialize dark mode on page load (default to dark)
function initDarkMode() {
  const savedMode = localStorage.getItem('theme');
  const isDark = savedMode ? savedMode === 'dark' : true; // default to dark
  
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  
  return isDark;
}

// Toggle dark mode
function toggleDarkMode() {
  const currentScheme = document.documentElement.style.colorScheme;
  const isDark = currentScheme !== 'dark';
  
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeToggleButton();
}

function updateThemeToggleButton() {
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    const isDark = document.documentElement.style.colorScheme === 'dark';
    btn.textContent = isDark ? '☀️ Light' : '🌙 Dark';
  }
}

// Show loading state
function showLoading() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;min-height:100vh;flex-direction:column;">
      <div class="spinner"></div>
      <p class="loading-text">Loading portfolio...</p>
    </div>
  `;
}

// Show error state with retry
function showError(message) {
  const app = document.getElementById('app');
  app.innerHTML = `
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

// Fetch data.json and render entire page dynamically
async function loadData() {
  showLoading();
  
  try {
    const res = await fetch('data.json');
    if (!res.ok) throw new Error('Failed to load portfolio data');
    const data = await res.json();
    
    // Set document title and metadata
    document.title = `${data.profile.name} - ${data.profile.title}`;
    
    // Ensure meta tags exist (or create them)
    let charsetMeta = document.querySelector('meta[charset]');
    if (!charsetMeta) {
      charsetMeta = document.createElement('meta');
      charsetMeta.charset = 'UTF-8';
      document.head.appendChild(charsetMeta);
    }
    
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.name = 'viewport';
      viewportMeta.content = 'width=device-width, initial-scale=1.0';
      document.head.appendChild(viewportMeta);
    }
    
    const app = document.getElementById('app');
    app.innerHTML = '';
    
    // Build navbar
    app.appendChild(buildNavbar());
    
    // Build main container
    const main = document.createElement('main');
    main.appendChild(buildHero(data.profile));
    main.appendChild(buildAbout(data.about));
    main.appendChild(buildEducation(data.education));
    
    // Fetch GitHub repos and merge with manual projects
    const githubUsername = data.profile.github ? extractGithubUsername(data.profile.github) : 'mustafalzahabi';
    const allProjects = await fetchAndMergeProjects(data.projects, githubUsername);
    allProjectsData = allProjects; // Store globally for detail page access
    main.appendChild(buildProjects(allProjects));
    
    main.appendChild(buildSkills(data.skills));
    main.appendChild(buildContact(data.contact));
    app.appendChild(main);
    
    // Build footer
    app.appendChild(buildFooter());
    
    // Setup theme toggle after rendering
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', toggleDarkMode);
      updateThemeToggleButton();
    }
  } catch (e) {
    console.error(e);
    showError(e.message || 'Could not load portfolio data. Please check your data.json file.');
  }
}

function buildNavbar() {
  const nav = document.createElement('nav');
  nav.className = 'navbar';
  
  const container = document.createElement('div');
  container.className = 'nav-container';
  
  const logo = document.createElement('a');
  logo.href = '#home';
  logo.className = 'logo';
  logo.textContent = 'MA';
  
  const ul = document.createElement('ul');
  ul.className = 'nav-links';
  const links = ['Home', 'Projects', 'Skills', 'Contact'];
  const ids = ['home', 'projects', 'skills', 'contact'];
  
  links.forEach((text, idx) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${ids[idx]}`;
    a.textContent = text;
    li.appendChild(a);
    ul.appendChild(li);
  });
  
  const themeToggle = document.createElement('button');
  themeToggle.id = 'theme-toggle';
  themeToggle.className = 'theme-toggle';
  themeToggle.textContent = document.documentElement.classList.contains('dark-mode') ? '☀️ Light' : '🌙 Dark';
  
  container.appendChild(logo);
  container.appendChild(ul);
  container.appendChild(themeToggle);
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
  
  content.appendChild(h1);
  content.appendChild(title);
  content.appendChild(tagline);
  content.appendChild(cta);
  
  const imgDiv = document.createElement('div');
  imgDiv.className = 'hero-image';
  const img = document.createElement('img');
  img.src = profile.photo;
  img.alt = profile.name;
  imgDiv.appendChild(img);
  
  section.appendChild(content);
  section.appendChild(imgDiv);
  return section;
}

function buildAbout(about) {
  const section = document.createElement('section');
  section.className = 'section';
  section.id = 'about';
  
  const title = document.createElement('h2');
  title.className = 'section-title';
  title.textContent = 'About Me';
  section.appendChild(title);
  
  const container = document.createElement('div');
  container.className = 'about-container';
  
  const bioDiv = document.createElement('div');
  bioDiv.className = 'about-text';
  const bioH3 = document.createElement('h3');
  bioH3.textContent = 'Biography';
  const bioP = document.createElement('p');
  bioP.textContent = about.bio;
  bioDiv.appendChild(bioH3);
  bioDiv.appendChild(bioP);
  
  const philDiv = document.createElement('div');
  philDiv.className = 'about-text';
  const philH3 = document.createElement('h3');
  philH3.textContent = 'Philosophy';
  const philP = document.createElement('p');
  philP.textContent = about.philosophy;
  const cvLink = document.createElement('a');
  cvLink.href = about.cv_link;
  cvLink.className = 'cv-link';
  cvLink.download = '';
  cvLink.textContent = 'Download Resume';
  philDiv.appendChild(philH3);
  philDiv.appendChild(philP);
  philDiv.appendChild(cvLink);
  
  container.appendChild(bioDiv);
  container.appendChild(philDiv);
  section.appendChild(container);
  return section;
}

function buildEducation(education) {
  const section = document.createElement('section');
  section.className = 'section';
  section.id = 'education';
  
  const title = document.createElement('h2');
  title.className = 'section-title';
  title.textContent = 'Education';
  section.appendChild(title);
  
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
    
    card.appendChild(h3);
    card.appendChild(inst);
    card.appendChild(dates);
    card.appendChild(location);
    
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
  const section = document.createElement('section');
  section.className = 'section';
  section.id = 'projects';
  
  const title = document.createElement('h2');
  title.className = 'section-title';
  title.textContent = 'Projects';
  section.appendChild(title);
  
  const grid = document.createElement('div');
  grid.className = 'projects-grid';
  
  projects.forEach(proj => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      allProjectsData = projects; // Store projects globally for detail page access
      window.location.hash = `#/project/${encodeURIComponent(proj.name)}`;
    });
    
    // Only show image if it exists
    if (proj.image) {
      const imgDiv = document.createElement('div');
      imgDiv.className = 'project-image';
      const img = document.createElement('img');
      img.src = proj.image;
      img.alt = proj.name;
      img.onerror = () => { imgDiv.style.display = 'none'; }; // Hide if image fails to load
      imgDiv.appendChild(img);
      card.appendChild(imgDiv);
    }
    
    const content = document.createElement('div');
    content.className = 'project-content';
    
    const h3 = document.createElement('h3');
    h3.textContent = proj.name;
    
    const desc = document.createElement('p');
    desc.textContent = proj.description;
    
    const techDiv = document.createElement('div');
    techDiv.className = 'project-tech';
    proj.technologies.forEach(tech => {
      const tag = document.createElement('span');
      tag.className = 'tech-tag';
      tag.textContent = tech;
      techDiv.appendChild(tag);
    });
    
    // Show stars for GitHub repos
    if (proj.isGitHubRepo && proj.stars !== undefined) {
      const starsSpan = document.createElement('span');
      starsSpan.className = 'project-stars';
      starsSpan.textContent = `⭐ ${proj.stars}`;
      starsSpan.style.marginLeft = '8px';
      starsSpan.style.fontSize = '12px';
      starsSpan.style.color = 'light-dark(#666, #aaa)';
      techDiv.appendChild(starsSpan);
    }
    
    const links = document.createElement('div');
    links.className = 'project-links';
    links.style.pointerEvents = 'auto'; // Allow links to work even on clicked card
    
    if (proj.live_link) {
      const liveLink = document.createElement('a');
      liveLink.href = proj.live_link;
      liveLink.target = '_blank';
      liveLink.textContent = 'Live Demo';
      liveLink.addEventListener('click', (e) => e.stopPropagation()); // Don't navigate detail page when clicking link
      links.appendChild(liveLink);
    }
    
    const ghLink = document.createElement('a');
    ghLink.href = proj.github_link;
    ghLink.target = '_blank';
    ghLink.textContent = 'GitHub';
    ghLink.addEventListener('click', (e) => e.stopPropagation()); // Don't navigate detail page when clicking link
    links.appendChild(ghLink);
    
    content.appendChild(h3);
    content.appendChild(desc);
    content.appendChild(techDiv);
    content.appendChild(links);
    
    card.appendChild(content);
    grid.appendChild(card);
  });
  
  section.appendChild(grid);
  return section;
}

function buildSkills(skills) {
  const section = document.createElement('section');
  section.className = 'section';
  section.id = 'skills';
  
  const title = document.createElement('h2');
  title.className = 'section-title';
  title.textContent = 'Skills';
  section.appendChild(title);
  
  const grid = document.createElement('div');
  grid.className = 'skills-grid';
  
  skills.forEach(skillGroup => {
    const category = document.createElement('div');
    category.className = 'skill-category';
    
    const h3 = document.createElement('h3');
    h3.textContent = skillGroup.category;
    category.appendChild(h3);
    
    const ul = document.createElement('ul');
    skillGroup.items.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      ul.appendChild(li);
    });
    category.appendChild(ul);
    
    grid.appendChild(category);
  });
  
  section.appendChild(grid);
  return section;
}

function buildContact(contact) {
  const section = document.createElement('section');
  section.className = 'section';
  section.id = 'contact';
  
  const title = document.createElement('h2');
  title.className = 'section-title';
  title.textContent = 'Get In Touch';
  section.appendChild(title);
  
  const container = document.createElement('div');
  container.className = 'contact-container';
  
  const msg = document.createElement('p');
  msg.textContent = contact.message;
  container.appendChild(msg);
  
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
  
  links.appendChild(emailLink);
  links.appendChild(ghLink);
  links.appendChild(liLink);
  container.appendChild(links);
  
  section.appendChild(container);
  return section;
}

function buildFooter() {
  const footer = document.createElement('footer');
  footer.className = 'footer';
  const year = new Date().getFullYear();
  const p = document.createElement('p');
  p.textContent = `© ${year} Mustafa Alzahabi. All rights reserved.`;
  footer.appendChild(p);
  return footer;
}

// Extract GitHub username from URL or return as-is
function extractGithubUsername(githubUrl) {
  if (typeof githubUrl !== 'string') return 'mustafalzahabi';
  const match = githubUrl.match(/github\.com\/([^\/]+)/);
  return match ? match[1] : githubUrl;
}

// Fetch GitHub repos and extract screenshots from README
async function fetchAndMergeProjects(manualProjects, githubUsername) {
  try {
    // Fetch all public repos for the user
    const reposRes = await fetch(`https://api.github.com/users/${githubUsername}/repos?type=public&sort=stars&per_page=100`);
    if (!reposRes.ok) throw new Error('Failed to fetch GitHub repos');
    
    let repos = await reposRes.json();
    
    // Filter out forks
    repos = repos.filter(repo => !repo.fork);
    
    // Fetch README and extract screenshot, images, description for each repo
    const reposWithScreenshots = await Promise.all(
      repos.map(async (repo) => {
        const readmeData = await extractScreenshotFromREADME(githubUsername, repo.name, repo.default_branch);
        return {
          name: repo.name,
          description: repo.description || 'No description',
          technologies: repo.language ? [repo.language] : [],
          image: readmeData?.firstImage || null,
          allImages: readmeData?.allImages || [],
          readmeDescription: readmeData?.description || '',
          live_link: repo.homepage || null,
          github_link: repo.html_url,
          stars: repo.stargazers_count,
          isGitHubRepo: true
        };
      })
    );
    
    // Combine: manual projects first (featured), then GitHub repos
    return [
      ...manualProjects,
      ...reposWithScreenshots
    ];
  } catch (e) {
    console.warn('Could not fetch GitHub repos, using manual projects only:', e);
    return manualProjects;
  }
}

// Extract all content from README
async function extractScreenshotFromREADME(username, repoName, defaultBranch) {
  try {
    const readmeRes = await fetch(
      `https://api.github.com/repos/${username}/${repoName}/readme`,
      { headers: { 'Accept': 'application/vnd.github.v3.raw' } }
    );
    
    if (!readmeRes.ok) return null;
    
    const readmeText = await readmeRes.text();
    
    // Extract all image URLs from Markdown: ![alt](url)
    const imageRegex = /!\[.*?\]\((.*?)\)/g;
    const imageMatches = readmeText.matchAll(imageRegex);
    const allImages = [];
    let firstImage = null;
    
    for (const match of imageMatches) {
      const imageUrl = match[1];
      
      // Only accept relative URLs (files in the repo)
      if (imageUrl.startsWith('./') || imageUrl.startsWith('/') || (!imageUrl.includes('://'))) {
        // Convert relative URL to raw GitHub URL
        const normalizedUrl = imageUrl.startsWith('./') ? imageUrl.slice(2) : imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
        const fullUrl = `https://raw.githubusercontent.com/${username}/${repoName}/${defaultBranch}/${normalizedUrl}`;
        allImages.push(fullUrl);
        if (!firstImage) firstImage = fullUrl;
      }
    }
    
    // Extract description: first paragraph or first few lines
    let description = '';
    const lines = readmeText.split('\n');
    for (const line of lines) {
      // Skip headings, images, and empty lines
      if (line.trim() && !line.trim().startsWith('#') && !line.trim().startsWith('!')) {
        description = line.trim();
        break;
      }
    }
    
    return {
      firstImage,
      allImages,
      description
    };
  } catch (e) {
    return null;
  }
}

// Global state
let currentPage = 'home';
let allProjectsData = [];

// Initialize on page load
initDarkMode();
loadData();

// Listen for hash changes (routing)
window.addEventListener('hashchange', handleRoute);

function handleRoute() {
  const hash = window.location.hash;
  
  if (hash.startsWith('#/project/')) {
    const projectName = decodeURIComponent(hash.slice(10));
    const project = allProjectsData.find(p => p.name === projectName);
    
    if (project) {
      currentPage = 'project-detail';
      renderProjectDetail(project);
    } else {
      window.location.hash = '#/';
      currentPage = 'home';
    }
  } else {
    currentPage = 'home';
    loadData();
  }
}

function renderProjectDetail(project) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  
  // Build navbar
  app.appendChild(buildNavbar());
  
  // Build detail page
  const main = document.createElement('main');
  
  // Back button
  const backSection = document.createElement('section');
  backSection.style.padding = '40px 0 0 0';
  backSection.style.marginBottom = '20px';
  const backBtn = document.createElement('a');
  backBtn.href = '#/';
  backBtn.style.color = 'light-dark(#0066cc, #4a9eff)';
  backBtn.style.textDecoration = 'none';
  backBtn.style.fontSize = '16px';
  backBtn.style.fontWeight = '600';
  backBtn.textContent = '← Back to Projects';
  backSection.appendChild(backBtn);
  main.appendChild(backSection);
  
  // Project detail section
  const section = document.createElement('section');
  section.className = 'section';
  section.style.paddingTop = '0';
  
  // Title
  const h1 = document.createElement('h1');
  h1.style.fontSize = '36px';
  h1.style.fontWeight = '700';
  h1.style.marginBottom = '16px';
  h1.style.color = 'light-dark(#1a1a1a, #e0e0e0)';
  h1.textContent = project.name;
  
  // Links
  const linksDiv = document.createElement('div');
  linksDiv.style.display = 'flex';
  linksDiv.style.gap = '16px';
  linksDiv.style.marginBottom = '32px';
  
  if (project.live_link) {
    const liveLink = document.createElement('a');
    liveLink.href = project.live_link;
    liveLink.target = '_blank';
    liveLink.style.color = 'light-dark(#0066cc, #4a9eff)';
    liveLink.style.textDecoration = 'none';
    liveLink.style.fontWeight = '600';
    liveLink.textContent = '🔗 Live Demo';
    linksDiv.appendChild(liveLink);
  }
  
  const ghLink = document.createElement('a');
  ghLink.href = project.github_link;
  ghLink.target = '_blank';
  ghLink.style.color = 'light-dark(#0066cc, #4a9eff)';
  ghLink.style.textDecoration = 'none';
  ghLink.style.fontWeight = '600';
  ghLink.textContent = '🐙 GitHub';
  linksDiv.appendChild(ghLink);
  
  section.appendChild(h1);
  section.appendChild(linksDiv);
  
  // Slideshow (if images exist)
  if (project.allImages && project.allImages.length > 0) {
    const slideshow = buildSlideshow(project.allImages);
    section.appendChild(slideshow);
  }
  
  // Description
  if (project.readmeDescription) {
    const descDiv = document.createElement('div');
    descDiv.style.marginTop = '32px';
    const descH2 = document.createElement('h2');
    descH2.style.fontSize = '20px';
    descH2.style.fontWeight = '700';
    descH2.style.marginBottom = '16px';
    descH2.textContent = 'About';
    const descP = document.createElement('p');
    descP.style.color = 'light-dark(#666, #aaa)';
    descP.style.lineHeight = '1.8';
    descP.textContent = project.readmeDescription;
    descDiv.appendChild(descH2);
    descDiv.appendChild(descP);
    section.appendChild(descDiv);
  }
  
  // Technologies
  if (project.technologies && project.technologies.length > 0) {
    const techDiv = document.createElement('div');
    techDiv.style.marginTop = '32px';
    const techH2 = document.createElement('h2');
    techH2.style.fontSize = '20px';
    techH2.style.fontWeight = '700';
    techH2.style.marginBottom = '16px';
    techH2.textContent = 'Technologies';
    const techContainer = document.createElement('div');
    techContainer.style.display = 'flex';
    techContainer.style.flexWrap = 'wrap';
    techContainer.style.gap = '8px';
    project.technologies.forEach(tech => {
      const tag = document.createElement('span');
      tag.className = 'tech-tag';
      tag.textContent = tech;
      techContainer.appendChild(tag);
    });
    techDiv.appendChild(techH2);
    techDiv.appendChild(techContainer);
    section.appendChild(techDiv);
  }
  
  main.appendChild(section);
  app.appendChild(main);
  
  // Build footer
  app.appendChild(buildFooter());
  
  // Setup theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.removeEventListener('click', toggleDarkMode);
    themeToggle.addEventListener('click', toggleDarkMode);
    updateThemeToggleButton();
  }
}

function buildSlideshow(images) {
  const container = document.createElement('div');
  container.style.marginTop = '32px';
  container.style.maxWidth = '100%';
  
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.backgroundColor = 'light-dark(#f2f2f2, #2a2a2a)';
  wrapper.style.borderRadius = '12px';
  wrapper.style.overflow = 'hidden';
  wrapper.style.aspectRatio = '16 / 9';
  wrapper.style.display = 'flex';
  wrapper.style.alignItems = 'center';
  wrapper.style.justifyContent = 'center';
  
  let currentIndex = 0;
  
  const img = document.createElement('img');
  img.src = images[0];
  img.alt = 'Project screenshot';
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.objectFit = 'contain';
  img.onerror = () => { img.style.display = 'none'; };
  
  const counter = document.createElement('div');
  counter.style.position = 'absolute';
  counter.style.bottom = '16px';
  counter.style.right = '16px';
  counter.style.background = 'rgba(0,0,0,0.6)';
  counter.style.color = '#fff';
  counter.style.padding = '8px 12px';
  counter.style.borderRadius = '6px';
  counter.style.fontSize = '14px';
  counter.style.fontWeight = '600';
  counter.textContent = `${currentIndex + 1}/${images.length}`;
  
  wrapper.appendChild(img);
  wrapper.appendChild(counter);
  
  // Only show controls if more than 1 image
  if (images.length > 1) {
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '◀';
    prevBtn.style.position = 'absolute';
    prevBtn.style.left = '16px';
    prevBtn.style.top = '50%';
    prevBtn.style.transform = 'translateY(-50%)';
    prevBtn.style.background = 'rgba(0,0,0,0.6)';
    prevBtn.style.color = '#fff';
    prevBtn.style.border = 'none';
    prevBtn.style.padding = '12px 16px';
    prevBtn.style.borderRadius = '6px';
    prevBtn.style.cursor = 'pointer';
    prevBtn.style.fontSize = '18px';
    prevBtn.style.fontWeight = '700';
    prevBtn.style.transition = 'background 0.2s';
    prevBtn.addEventListener('mouseover', () => { prevBtn.style.background = 'rgba(0,0,0,0.8)'; });
    prevBtn.addEventListener('mouseout', () => { prevBtn.style.background = 'rgba(0,0,0,0.6)'; });
    prevBtn.addEventListener('click', () => {
      currentIndex = (currentIndex - 1 + images.length) % images.length;
      img.src = images[currentIndex];
      counter.textContent = `${currentIndex + 1}/${images.length}`;
    });
    
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '▶';
    nextBtn.style.position = 'absolute';
    nextBtn.style.right = '16px';
    nextBtn.style.top = '50%';
    nextBtn.style.transform = 'translateY(-50%)';
    nextBtn.style.background = 'rgba(0,0,0,0.6)';
    nextBtn.style.color = '#fff';
    nextBtn.style.border = 'none';
    nextBtn.style.padding = '12px 16px';
    nextBtn.style.borderRadius = '6px';
    nextBtn.style.cursor = 'pointer';
    nextBtn.style.fontSize = '18px';
    nextBtn.style.fontWeight = '700';
    nextBtn.style.transition = 'background 0.2s';
    nextBtn.addEventListener('mouseover', () => { nextBtn.style.background = 'rgba(0,0,0,0.8)'; });
    nextBtn.addEventListener('mouseout', () => { nextBtn.style.background = 'rgba(0,0,0,0.6)'; });
    nextBtn.addEventListener('click', () => {
      currentIndex = (currentIndex + 1) % images.length;
      img.src = images[currentIndex];
      counter.textContent = `${currentIndex + 1}/${images.length}`;
    });
    
    wrapper.appendChild(prevBtn);
    wrapper.appendChild(nextBtn);
  }
  
  container.appendChild(wrapper);
  return container;
}
