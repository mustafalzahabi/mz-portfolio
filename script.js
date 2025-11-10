// Fetch data.json and render entire page dynamically
async function loadData() {
  try {
    const res = await fetch('data.json');
    if (!res.ok) throw new Error('Failed to load data.json');
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
    main.appendChild(buildProjects(data.projects));
    main.appendChild(buildSkills(data.skills));
    main.appendChild(buildContact(data.contact));
    app.appendChild(main);
    
    // Build footer
    app.appendChild(buildFooter());
  } catch (e) {
    console.error(e);
    document.getElementById('app').innerHTML = '<p style="padding:40px;text-align:center;color:red;">Could not load portfolio data.</p>';
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
  
  container.appendChild(logo);
  container.appendChild(ul);
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
    
    const imgDiv = document.createElement('div');
    imgDiv.className = 'project-image';
    const img = document.createElement('img');
    img.src = proj.image;
    img.alt = proj.name;
    imgDiv.appendChild(img);
    
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
    
    const links = document.createElement('div');
    links.className = 'project-links';
    
    const liveLink = document.createElement('a');
    liveLink.href = proj.live_link;
    liveLink.target = '_blank';
    liveLink.textContent = 'Live Demo';
    
    const ghLink = document.createElement('a');
    ghLink.href = proj.github_link;
    ghLink.target = '_blank';
    ghLink.textContent = 'GitHub';
    
    links.appendChild(liveLink);
    links.appendChild(ghLink);
    
    content.appendChild(h3);
    content.appendChild(desc);
    content.appendChild(techDiv);
    content.appendChild(links);
    
    card.appendChild(imgDiv);
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

loadData();
