// Fetch data.json and render the page
async function loadData(){
  try{
    const res = await fetch('data.json');
    if(!res.ok) throw new Error('Failed to load data.json');
    const data = await res.json();
    renderHeader(data.profile);
    renderSidebar(data.profile);
    renderFeed(data.projects);
    renderRightCol(data);
  }catch(e){
    console.error(e);
    document.getElementById('feed').innerText = 'Could not load content.';
  }
}

function renderHeader(profile){
  const header = document.getElementById('header');
  header.innerHTML = `
    <div class="profile">
      <img src="${profile.image}" alt="${profile.name}" />
      <div class="profile-head">
        <h1>${profile.name}</h1>
        <p>${profile.title}</p>
      </div>
    </div>
    <nav class="nav">
      <a href="#feed" style="color:#fff;text-decoration:none;margin-right:12px">Portfolio</a>
      <a href="#contact" style="color:#fff;text-decoration:none">Contact</a>
    </nav>
  `;
}

function renderSidebar(profile){
  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = `
    <div class="card">
      <h3>About</h3>
      <p>${profile.bio}</p>
      <hr />
      <h4>Contact</h4>
      <p>Email: <a href="mailto:${profile.email}">${profile.email}</a></p>
    </div>
  `;
}

function renderFeed(projects){
  const feed = document.getElementById('feed');
  if(!projects || projects.length===0){feed.innerHTML='<p>No projects yet.</p>';return}

  // compose box
  feed.innerHTML = `
    <div class="compose card">
      <textarea id="composeText" rows="3" placeholder="Share a project or a quick note..."></textarea>
      <div class="actions">
        <div class="meta">Draft</div>
        <button id="postBtn" class="btn">Post</button>
      </div>
    </div>
  `;

  // render project cards
  feed.innerHTML += projects.map((p,idx)=>`
    <article class="card" data-idx="${idx}">
      <h2>${p.title}</h2>
      <p>${p.description}</p>
      ${p.image?`<img src="${p.image}" alt="${p.title}" />`:''}
      ${p.link?`<p><a href="${p.link}" target="_blank">View Project</a></p>`:''}
      <div class="card-actions">
        <span class="like" data-liked="false">❤ <span class="like-count">${p.likes||0}</span></span>
        <span>🔁</span>
        <span>🔗</span>
      </div>
    </article>
  `).join('');

  // wire interactions
  document.getElementById('postBtn').addEventListener('click', ()=>{
    const text = document.getElementById('composeText').value.trim();
    if(!text) return alert('Please enter something to post');
    // prepend as a new card (client-side only)
    const newCard = document.createElement('article');
    newCard.className = 'card';
    newCard.innerHTML = `
      <h2>New Post</h2>
      <p>${escapeHtml(text)}</p>
    `;
    feed.insertBefore(newCard, feed.querySelector('.card').nextSibling);
    document.getElementById('composeText').value = '';
  });

  Array.from(document.querySelectorAll('.like')).forEach(el=>{
    el.addEventListener('click', ()=>{
      const liked = el.getAttribute('data-liked') === 'true';
      const countEl = el.querySelector('.like-count');
      let count = parseInt(countEl.textContent,10) || 0;
      if(liked){ count--; el.setAttribute('data-liked','false'); el.style.color=''; }
      else{ count++; el.setAttribute('data-liked','true'); el.style.color='crimson'; }
      countEl.textContent = count;
    });
  });
}

function renderRightCol(data){
  const rc = document.getElementById('rightcol');
  rc.innerHTML = `
    <div class="card">
      <h3>Highlights</h3>
      <ul>
        ${data.projects.slice(0,5).map(p=>`<li>${p.title}</li>`).join('')}
      </ul>
    </div>
  `;
}

function escapeHtml(str){
  return str.replace(/[&<>"']/g, function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m];});
}

loadData();
