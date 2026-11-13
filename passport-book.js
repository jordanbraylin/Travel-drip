/* One live post per page. The temporary turning leaf is inert and never interactive. */
(() => {
  const controllers = new WeakMap();
  const interactive = 'button,a,input,textarea,select,summary,video,[contenteditable="true"]';
  function mount(list) {
    if (controllers.has(list)) return controllers.get(list);
    const book = document.createElement('section');
    book.className = 'memory-passport';
    book.setAttribute('aria-label', 'Your memory passport');
    book.innerHTML = `<div class="passport-topline"><span>TRAVEL-DRIP / MEMORY COLLECTION</span><span class="passport-edition">Made of moments</span></div>
      <div class="passport-spread"><aside class="passport-inside"><p class="passport-kicker">A life well travelled</p><h3>My memory<br> passport<span aria-hidden="true">✧</span></h3><div class="passport-emblem" aria-hidden="true">✺</div><p class="passport-inside-copy">Collect places.<br>Keep the feeling.</p><div class="passport-stamp"><span>MEMORY STAMP</span><strong class="passport-place"></strong><span class="passport-date"></span></div><p class="passport-note"></p><div class="passport-tally"></div></aside><div class="passport-paper" tabindex="0" aria-label="Passport pages. Use left and right arrow keys to turn pages."><div class="passport-page-edge" aria-hidden="true"></div></div></div>
      <nav class="passport-navigation" aria-label="Passport page navigation"><button type="button" class="passport-prev" aria-label="Previous passport page">← <span>Previous</span></button><span class="passport-page-count" role="status" aria-live="polite" aria-atomic="true"></span><button type="button" class="passport-next" aria-label="Next passport page"><span>Next page</span> →</button></nav><p class="passport-hint">Turn a page. Relive a little. <span>Swipe or use the arrow buttons.</span></p>`;
    list.before(book);
    const paper = book.querySelector('.passport-paper');
    paper.append(list);
    const previous = book.querySelector('.passport-prev'), next = book.querySelector('.passport-next');
    let entries = [], position = 0, activeId = '', turning = null, epoch = 0, gesture;
    const count = book.querySelector('.passport-page-count');
    function sync(announce = true) {
      Array.from(list.children).forEach(node => {
        if (!node.classList.contains('photo-post')) return;
        const active = node.dataset.postId === entries[position]?.id;
        node.hidden = !active;
        node.inert = !active || Boolean(turning);
        node.setAttribute('aria-label', `Memory page ${position + 1} of ${entries.length}`);
      });
      const post = entries[position];
      book.classList.toggle('passport-is-empty', !post);
      book.querySelector('.passport-place').textContent = post?.location || 'Still collecting';
      book.querySelector('.passport-date').textContent = post?.location ? savedDate(post.createdAt) : 'Your next chapter starts here';
      book.querySelector('.passport-stamp').classList.toggle('is-unstamped', !post?.location);
      book.querySelector('.passport-note').textContent = post ? (post.location ? `A moment in ${post.location}.` : 'Add a location to give this memory its own stamp.') : 'Your photos, videos and travel stories, kept together.';
      const places = new Set(entries.map(item => item.location?.trim()).filter(Boolean));
      book.querySelector('.passport-tally').textContent = `${entries.length} ${entries.length === 1 ? 'memory' : 'memories'} · ${places.size} ${places.size === 1 ? 'place' : 'places'} in this collection`;
      if (announce) count.textContent = entries.length ? `Page ${position + 1} of ${entries.length}` : 'Your first page awaits';
      previous.disabled = Boolean(turning) || position <= 0;
      next.disabled = Boolean(turning) || position >= entries.length - 1;
    }
    function stop() {
      epoch++;
      turning?.animation?.cancel();
      turning?.leaf?.remove();
      turning = null;
      paper.removeAttribute('aria-busy');
    }
    function render(posts) {
      stop();
      entries = posts;
      const found = entries.findIndex(item => item.id === activeId);
      position = found >= 0 ? found : Math.min(position, Math.max(0, entries.length - 1));
      activeId = entries[position]?.id || '';
      sync();
    }
    async function turn(target) {
      if (turning || target < 0 || target >= entries.length || target === position) return false;
      const forward = target > position;
      const old = Array.from(list.children).find(node => node.dataset.postId === entries[position]?.id);
      const incoming = Array.from(list.children).find(node => node.dataset.postId === entries[target]?.id);
      // Pause playback before a page is hidden; never clone a playing video.
      old?.querySelectorAll('video').forEach(video => video.pause());
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const original = forward ? old : incoming;
      const version = ++epoch;
      position = target; activeId = entries[position].id;
      if (!original || reduced || !Element.prototype.animate) { sync(); return true; }
      const leaf = document.createElement('div');
      leaf.className = 'passport-turning-leaf'; leaf.inert = true; leaf.setAttribute('aria-hidden', 'true');
      const front = document.createElement('div'); front.className = 'passport-leaf-front';
      const copy = original.cloneNode(true); copy.hidden = false; copy.inert = true;
      copy.removeAttribute('id');
      copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      copy.querySelectorAll('video').forEach(video => { const label = document.createElement('p'); label.className = 'passport-video-placeholder'; label.textContent = 'Video memory'; video.replaceWith(label); });
      copy.querySelectorAll('input,textarea').forEach(input => { input.value = ''; });
      front.append(copy);
      const back = document.createElement('div'); back.className = 'passport-leaf-back';
      const seal = document.createElement('span'); seal.textContent = 'TRAVEL-DRIP\nMEMORIES'; back.append(seal);
      leaf.append(front, back); paper.append(leaf);
      const frames = forward
        ? [{ transform:'rotateY(0deg)', filter:'brightness(1)' }, { transform:'rotateY(-86deg)', filter:'brightness(.85)', offset:.52 }, { transform:'rotateY(-179.8deg)', filter:'brightness(.97)' }]
        : [{ transform:'rotateY(-179.8deg)', filter:'brightness(.97)' }, { transform:'rotateY(-86deg)', filter:'brightness(.85)', offset:.48 }, { transform:'rotateY(0deg)', filter:'brightness(1)' }];
      const animation = leaf.animate(frames, { duration:680, easing:'cubic-bezier(.38,.05,.24,1)', fill:'both' });
      turning = { leaf, animation }; paper.setAttribute('aria-busy', 'true'); sync(false);
      try { await animation.finished; } catch (_error) { /* Route/reset cancels and clears the transient leaf. */ }
      if (version !== epoch) return false;
      leaf.remove(); turning = null; paper.removeAttribute('aria-busy'); sync();
      return true;
    }
    previous.addEventListener('click', () => turn(position - 1));
    next.addEventListener('click', () => turn(position + 1));
    paper.addEventListener('keydown', event => {
      if (event.target.closest(interactive) || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.key === 'ArrowRight' ? position + 1 : event.key === 'ArrowLeft' ? position - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1 : null;
      if (target !== null) { event.preventDefault(); turn(target); }
    });
    paper.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || event.target.closest(interactive)) return;
      gesture = { id:event.pointerId, x:event.clientX, y:event.clientY };
    });
    paper.addEventListener('pointerup', event => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y; gesture = null;
      if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.7) turn(position + (dx < 0 ? 1 : -1));
    });
    paper.addEventListener('pointercancel', () => { gesture = null; });
    const api = { render, turn, reset() { stop(); entries = []; activeId = ''; position = 0; gesture = null; sync(); }, get position() { return position; } };
    controllers.set(list, api); sync(); return api;
  }
  function savedDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'A travel memory' : `SAVED ${date.toLocaleDateString(undefined, { day:'2-digit', month:'short', year:'numeric' })}`;
  }
  window.TravelDripPassport = { mount, savedDate };
})();
