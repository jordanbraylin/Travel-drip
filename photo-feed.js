let photoFeedState = { key:'', generation:0, posts:[], nextOffset:null, loading:false, ready:false, filter:'all' };

function resetPhotoFeed() {
  photoFeedState = { key:'', generation:photoFeedState.generation + 1, posts:[], nextOffset:null, loading:false, ready:false, filter:'all' };
  document.querySelector('#photoFeedList')?.replaceChildren();
  document.querySelector('#photoComposer')?.reset();
  document.querySelector('#photoReportDialog')?.close();
  document.querySelector('#photoFeedStatus')?.replaceChildren();
  const more = document.querySelector('#photoFeedMore'); if (more) more.hidden = true;
  const search = document.querySelector('#photoTagSearch'); if (search) search.value = '';
  document.querySelectorAll('[data-photo-filter]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.photoFilter === 'all')));
}

function photoFeedKey() { return `${state.session?.user?.id || ''}:${state.activeTripId || ''}`; }
function photoIcons(root = document) { window.lucide?.createIcons({ root }); }
function photoStatus(message) { const el = document.querySelector('#photoFeedStatus'); if (el) el.textContent = message; }

function initializePhotoFeed() {
  const panel = document.querySelector('#memoriesPanel');
  if (!panel || document.querySelector('#photoFeedList')) return;
  panel.replaceChildren();
  panel.innerHTML = `<div class="photo-feed-heading"><img class="photo-cover-image" src="icons/planning-coast.jpg" alt=""><div class="photo-cover-copy"><p class="eyebrow">Your people. Your adventures.</p><h2>Trip moments</h2><p>Big adventures. Little moments. All yours.</p></div><span class="photo-cover-label">A little Santorini inspiration</span><button type="button" id="photoFeedRefresh" title="Refresh posts" aria-label="Refresh posts"><i data-lucide="refresh-cw"></i></button></div>
    <div class="photo-feed-layout"><div class="photo-feed-column">
    <details class="photo-composer-toggle"><summary><i data-lucide="image-plus"></i>Share a moment<i data-lucide="chevron-down"></i></summary><form id="photoComposer" class="photo-composer"><label for="photoCaption">Caption</label><textarea id="photoCaption" maxlength="2000" rows="2" placeholder="What made today memorable?"></textarea>
    <label for="photoTags">Hashtags</label><input id="photoTags" maxlength="330" placeholder="#BeachDay #TripTogether">
    <div class="photo-compose-options"><label>Who can see this?<select id="photoVisibility"><option value="private">Only me</option><option value="members">Trip friends</option></select></label><label>Photos or videos<input id="photoFiles" type="file" accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm" multiple required></label></div>
    <div class="photo-compose-footer"><span id="photoTripName"></span><button type="submit" class="primary-button" id="photoPublish"><i data-lucide="image-plus"></i>Post moment</button></div></form></details>
    <div class="photo-feed-tabs" role="group" aria-label="Filter posts"><button type="button" data-photo-filter="all" aria-pressed="true"><i data-lucide="images"></i>Trip feed</button><button type="button" data-photo-filter="mine" aria-pressed="false"><i data-lucide="camera"></i>My posts</button></div>
    <p id="photoFeedStatus" role="status" aria-live="polite"></p><button type="button" class="primary-button" id="photoCreateTrip" data-account-empty-action="create-trip" hidden>Create a trip</button><div id="photoFeedList"></div><button type="button" id="photoFeedMore" hidden>Load more posts</button>
    </div><aside class="photo-feed-aside"><i data-lucide="users-round"></i><h3>Better together</h3><p>Share photos with friends in this trip. Like a favorite, leave a comment, or find moments by hashtag.</p><label for="photoTagSearch">Find a moment</label><input id="photoTagSearch" type="search" placeholder="Search captions or #tags"><p class="photo-privacy-note"><i data-lucide="lock-keyhole"></i>Only me posts stay private. Trip friends means active members of this trip, not everyone in your address book.</p></aside></div>
    <dialog id="photoReportDialog" aria-labelledby="photoReportTitle"><form method="dialog" id="photoReportForm"><h3 id="photoReportTitle">Report post</h3><p>Your report is private and saved for review. For urgent concerns, contact support.</p><label>Reason<select name="reason" required><option value="">Choose a reason</option><option>Harassment</option><option>Privacy concern</option><option>Inappropriate content</option><option>Spam</option><option>Other</option></select></label><p id="photoReportStatus" role="status"></p><div class="photo-dialog-actions"><button type="button" id="photoReportCancel">Cancel</button><button class="primary-button" type="submit">Submit report</button></div></form></dialog>`;
  document.querySelector('#photoComposer').addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.querySelector('#photoPublish');
    const key = photoFeedKey();
    button.disabled = true;
    try {
      await uploadMemoryFiles(document.querySelector('#photoFiles').files, 'photo-feed');
      if (key === photoFeedKey()) document.querySelector('#photoFiles').value = '';
    } finally { if (key === photoFeedKey()) button.disabled = !state.activeTripId; }
  });
  document.querySelector('#photoFeedRefresh').addEventListener('click', () => loadPhotoFeed());
  document.querySelector('#photoFeedMore').addEventListener('click', () => loadPhotoFeed({ more:true }));
  document.querySelector('#photoTagSearch').addEventListener('input', drawPhotoPosts);
  panel.querySelectorAll('[data-photo-filter]').forEach(button => button.addEventListener('click', () => {
    photoFeedState.filter = button.dataset.photoFilter;
    panel.querySelectorAll('[data-photo-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    drawPhotoPosts();
  }));
  document.querySelector('#photoReportCancel').addEventListener('click', () => document.querySelector('#photoReportDialog').close());
  document.querySelector('#photoReportForm').addEventListener('submit', submitPhotoReport);
  photoIcons(panel);
}

function renderPhotoFeed(target) {
  if (target !== 'memoriesPanel') return;
  initializePhotoFeed();
  setVisibilityWithoutCssLeaks(document.querySelector('#dailyMemoryPanel'), false);
  const panel = document.querySelector('#memoriesPanel');
  panel.classList.remove('is-account-empty','is-account-live');
  panel.querySelectorAll('.account-route-empty,.account-route-live,.account-saved-records').forEach(el => { el.hidden = true; });
  const eligible = Boolean(state.session?.user && state.activeTripId && state.accountData.loaded);
  document.querySelector('#photoCreateTrip').hidden = eligible || !state.accountData.loaded;
  document.querySelectorAll('#photoComposer input,#photoComposer textarea,#photoComposer select,#photoPublish').forEach(el => { el.disabled = !eligible; });
  document.querySelector('#photoTripName').textContent = eligible ? state.accountData.activeTrip?.name || state.accountData.activeTrip?.title || 'Your trip' : 'Create or join a trip to share moments.';
  if (photoFeedState.key !== photoFeedKey()) { resetPhotoFeed(); photoFeedState.key = photoFeedKey(); }
  if (eligible && !photoFeedState.loaded && !photoFeedState.loading) loadPhotoFeed();
  if (!eligible) { document.querySelector('#photoFeedList').replaceChildren(); photoStatus('Your photos will appear here after you create or join a trip.'); }
}

async function loadPhotoFeed({ more = false } = {}) {
  if (!document.querySelector('#photoFeedList') || !state.session?.user || !state.activeTripId) return;
  if (photoFeedState.key !== photoFeedKey()) { resetPhotoFeed(); photoFeedState.key = photoFeedKey(); }
  if (photoFeedState.loading) return;
  const offset = more ? photoFeedState.nextOffset : 0;
  if (offset === null) return;
  const key = photoFeedKey(), generation = photoFeedState.generation;
  photoFeedState.loading = true; photoStatus('Loading moments...');
  document.querySelector('#photoFeedMore').disabled = true;
  try {
    const data = await apiRequest(`/api/photo-feed?tripId=${encodeURIComponent(state.activeTripId)}&offset=${offset}`);
    if (key !== photoFeedKey() || generation !== photoFeedState.generation) return;
    photoFeedState.posts = [...new Map([...(more ? photoFeedState.posts : []), ...(data.posts || [])].map(p => [p.id,p])).values()];
    photoFeedState.nextOffset = data.nextOffset ?? null; photoFeedState.ready = data.engagementReady === true; photoFeedState.loaded = true;
    drawPhotoPosts();
    photoStatus(!data.engagementReady ? 'Photos are available. Likes, comments, and reports are awaiting database setup.' : '');
  } catch (error) { if (key === photoFeedKey() && generation === photoFeedState.generation) photoStatus(error.message || 'Could not load photos. Select refresh to retry.'); }
  finally { if (key === photoFeedKey() && generation === photoFeedState.generation) { photoFeedState.loading = false; document.querySelector('#photoFeedMore').disabled = false; } }
}

function photoAction(icon, label, handler) {
  const button = document.createElement('button'); button.type = 'button'; button.title = label; button.setAttribute('aria-label',label);
  button.innerHTML = `<i data-lucide="${icon}"></i><span></span>`;
  button.addEventListener('click', handler); return button;
}

async function savePhotoAction(post, action, extra = {}) {
  const key = photoFeedKey(), generation = photoFeedState.generation;
  const result = await apiRequest('/api/photo-feed', { method:'POST', body:JSON.stringify({tripId:state.activeTripId,postId:post.id,action,...extra}) });
  if (!result.saved) throw new Error('The change was not saved. Please retry.');
  return key === photoFeedKey() && generation === photoFeedState.generation;
}

function drawPhotoPosts() {
  const list = document.querySelector('#photoFeedList'); if (!list) return;
  list.replaceChildren();
  const query = document.querySelector('#photoTagSearch').value.trim().toLowerCase();
  const posts = photoFeedState.posts.filter(p => (photoFeedState.filter !== 'mine' || p.own) && `${p.caption} ${(p.tags || []).join(' ')}`.toLowerCase().includes(query));
  if (!photoFeedState.posts.length && photoFeedState.loaded) {
    const empty = document.createElement('section'); empty.className = 'photo-feed-empty';
    empty.innerHTML = '<span class="photo-empty-icon" aria-hidden="true"><i data-lucide="camera"></i></span><h3>The best moments are still ahead</h3><p>The view. The friends. That unforgettable meal.</p><button type="button" class="primary-button"><i data-lucide="image-plus"></i>Share your first moment</button>';
    empty.querySelector('button').addEventListener('click',()=> { document.querySelector('.photo-composer-toggle').open = true; document.querySelector('#photoCaption').focus(); });
    list.append(empty);
  }
  for (const post of posts) {
    const article = document.createElement('article'); article.className = 'photo-post';
    const header = document.createElement('header');
    const avatar = document.createElement('span'); avatar.className = 'photo-avatar'; avatar.textContent = (post.author || 'T').split(/\s+/).map(n=>n[0]).slice(0,2).join(''); avatar.setAttribute('aria-hidden','true');
    const identity = document.createElement('div'); const name = document.createElement('strong'); name.textContent = post.author;
    const when = document.createElement('small'); const date = new Date(post.createdAt); when.textContent = `${Number.isNaN(date.getTime()) ? '' : date.toLocaleString()} · ${post.visibility === 'members' ? 'Trip friends' : 'Only me'}`; identity.append(name,when); header.append(avatar,identity);
    const menu = document.createElement('details'); menu.className = 'photo-post-menu';
    const summary = document.createElement('summary'); summary.title = 'Post options'; summary.setAttribute('aria-label','Post options'); summary.innerHTML = '<i data-lucide="ellipsis"></i>';
    menu.append(summary);
    const report = photoAction('flag','Report post', () => { const dialog = document.querySelector('#photoReportDialog'); dialog.dataset.postId = post.id; dialog.dataset.key = photoFeedKey(); document.querySelector('#photoReportForm').reset(); document.querySelector('#photoReportStatus').textContent = ''; dialog.showModal(); });
    report.querySelector('span').textContent = 'Report post';
    report.disabled = !photoFeedState.ready; menu.append(report);
    if (post.own) menu.append(photoAction('trash-2','Remove post', async event => {
      if (!confirm('Remove this post and its likes and comments? This cannot be undone.')) return;
      event.currentTarget.disabled = true;
      try { if (await savePhotoAction(post,'remove')) { photoFeedState.posts = photoFeedState.posts.filter(p=>p.id !== post.id); drawPhotoPosts(); photoStatus('Post removed.'); } }
      catch (error) { photoStatus(error.message); event.target.closest('button')?.removeAttribute('disabled'); }
    }));
    menu.querySelector('[aria-label="Remove post"] span')?.append('Remove post');
    header.append(menu); article.append(header);
    if (post.mediaUrl) {
      const media = document.createElement(post.mediaType?.startsWith('video/') ? 'video' : 'img'); media.src = post.mediaUrl;
      if (media.tagName === 'VIDEO') { media.controls = true; media.preload = 'metadata'; } else { media.alt = post.caption || 'Trip moment'; media.loading = 'lazy'; }
      article.append(media);
    } else { const unavailable = document.createElement('p'); unavailable.textContent = 'This photo could not be loaded. Refresh to try again.'; article.append(unavailable); }
    const actions = document.createElement('div'); actions.className = 'photo-post-actions';
    const like = photoAction('heart',post.liked ? 'Unlike post' : 'Like post',async () => {
      like.disabled = true;
      try { const liked = !post.liked; if (await savePhotoAction(post,'like',{liked})) { post.liked = liked; post.likeCount += liked ? 1 : -1; drawPhotoPosts(); } }
      catch (error) { photoStatus(error.message); like.disabled = false; }
    });
    like.setAttribute('aria-pressed',String(post.liked)); like.querySelector('span').textContent = `${post.likeCount} like${post.likeCount === 1 ? '' : 's'}`; like.disabled = !photoFeedState.ready;
    const comments = document.createElement('section'); comments.className = 'photo-comments'; comments.hidden = true;
    const comment = photoAction('message-circle','Show comments', () => { comments.hidden = !comments.hidden; comment.setAttribute('aria-expanded',String(!comments.hidden)); if (!comments.hidden) loadPhotoComments(post,comments); });
    comment.querySelector('span').textContent = `${post.commentCount} comment${post.commentCount === 1 ? '' : 's'}`; comment.setAttribute('aria-expanded','false'); comment.disabled = !photoFeedState.ready;
    actions.append(like,comment); article.append(actions);
    if (post.caption) { const caption = document.createElement('p'); caption.className = 'photo-caption'; caption.textContent = post.caption; article.append(caption); }
    const tags = document.createElement('div'); tags.className = 'photo-tags';
    (post.tags || []).forEach(tag => { const b = document.createElement('button'); b.type = 'button'; b.textContent = tag; b.addEventListener('click',()=> { document.querySelector('#photoTagSearch').value = tag; drawPhotoPosts(); }); tags.append(b); });
    article.append(tags,comments); list.append(article);
  }
  if (!posts.length && photoFeedState.posts.length) { const p = document.createElement('p'); p.textContent = 'No matching moments in the loaded posts.'; list.append(p); }
  document.querySelector('#photoFeedMore').hidden = photoFeedState.nextOffset === null;
  photoIcons(list);
}

async function loadPhotoComments(post, host, offset = 0) {
  const key = photoFeedKey(), generation = photoFeedState.generation;
  if (!offset) host.textContent = 'Loading comments...';
  try {
    const result = await apiRequest(`/api/photo-feed?tripId=${encodeURIComponent(state.activeTripId)}&postId=${encodeURIComponent(post.id)}&offset=${offset}`);
    if (key !== photoFeedKey() || generation !== photoFeedState.generation || !host.isConnected) return;
    if (!offset) { host.replaceChildren(); const items = document.createElement('div'); items.className = 'photo-comment-items'; host.append(items); }
    const items = host.querySelector('.photo-comment-items');
    for (const c of result.comments || []) {
      if ([...items.children].some(el=>el.dataset.commentId === c.id)) continue;
      const line = document.createElement('p'); line.dataset.commentId = c.id; const name = document.createElement('strong'); name.textContent = `${c.author}: `; line.append(name,document.createTextNode(c.body)); items.append(line);
    }
    host.querySelector('.photo-comments-more')?.remove();
    if (result.nextOffset !== null && result.nextOffset !== undefined) { const more = document.createElement('button'); more.type = 'button'; more.className = 'photo-comments-more'; more.textContent = 'Earlier comments'; more.addEventListener('click',()=> { more.disabled = true; loadPhotoComments(post,host,result.nextOffset); }); host.append(more); }
    if (!host.querySelector('form')) {
      const form = document.createElement('form'); form.className = 'photo-comment-compose';
      const input = document.createElement('input'); input.required = true; input.maxLength = 1000; input.placeholder = 'Leave a comment'; input.setAttribute('aria-label','Write a comment');
      const send = document.createElement('button'); send.type = 'submit'; send.title = 'Post comment'; send.setAttribute('aria-label','Post comment'); send.innerHTML = '<i data-lucide="send"></i>';
      form.append(input,send); host.append(form);
      form.addEventListener('submit',async event => { event.preventDefault(); send.disabled = true; try { if (await savePhotoAction(post,'comment',{text:input.value})) { input.value = ''; post.commentCount++; const count = host.closest('.photo-post')?.querySelector('[aria-label="Show comments"] span'); if (count) count.textContent = `${post.commentCount} comment${post.commentCount === 1 ? '' : 's'}`; await loadPhotoComments(post,host); } } catch(error) { photoStatus(error.message); } finally { send.disabled = false; } });
    }
    photoIcons(host);
  } catch(error) { if (key === photoFeedKey() && generation === photoFeedState.generation) { photoStatus(error.message); if (!offset) host.textContent = 'Comments could not be loaded. Close and reopen to retry.'; else host.querySelector('.photo-comments-more')?.removeAttribute('disabled'); } }
}

async function submitPhotoReport(event) {
  event.preventDefault();
  const dialog = document.querySelector('#photoReportDialog');
  if (dialog.dataset.key !== photoFeedKey()) { dialog.close(); return; }
  const button = event.currentTarget.querySelector('[type="submit"]'); button.disabled = true;
  try {
    if (await savePhotoAction({id:dialog.dataset.postId},'report',{reason:new FormData(event.currentTarget).get('reason')})) { dialog.close(); photoStatus('Report saved for review. Thank you for letting us know.'); }
  } catch(error) { if (dialog.dataset.key === photoFeedKey()) document.querySelector('#photoReportStatus').textContent = error.message; }
  finally { button.disabled = false; }
}
