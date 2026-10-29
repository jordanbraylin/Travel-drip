function setConciergeView(view) {
  const shell=document.querySelector('.concierge-layout');if(!shell)return;
  shell.dataset.view=view==='details'?'details':'conversation';
  document.querySelectorAll('[data-concierge-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.conciergeView===shell.dataset.view)));
}

function initializeConciergeLayout() {
  const panel=document.getElementById('aiTravelPlanner'),shell=panel?.querySelector('.ai-planner-shell');
  if(!shell||shell.classList.contains('concierge-layout'))return;
  shell.classList.add('concierge-layout');shell.dataset.view='conversation';
  const heading=panel.querySelector(':scope > .section-heading');heading.querySelector('h2').textContent='Your personal concierge';
  const intro=heading.querySelector('div > p:not(.eyebrow)');if(intro)intro.textContent='A little conversation. A trip that is yours.';
  const start=document.getElementById('aiPlannerStartButton');start.textContent='Continue planning';start.addEventListener('click',()=>{setConciergeView('conversation');document.getElementById('aiPlannerFreeformInput').focus();});
  const views=document.createElement('div');views.className='concierge-mobile-views';views.setAttribute('role','group');views.setAttribute('aria-label','Planner view');
  for(const [view,label]of [['conversation','Conversation'],['details','Trip details']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.conciergeView=view;button.setAttribute('aria-pressed',String(view==='conversation'));button.addEventListener('click',()=>setConciergeView(view));views.append(button);}heading.after(views);
  const outline=document.createElement('aside');outline.className='concierge-outline';outline.setAttribute('aria-label','Planning questions');outline.innerHTML='<h3>Your plan</h3><p id="conciergeProgress" role="status"></p><nav id="conciergeQuestions" aria-label="Trip planning questions"></nav>';shell.prepend(outline);
  const chat=panel.querySelector('.ai-planner-chat');chat.removeAttribute('aria-live');
  const header=document.createElement('header');header.className='concierge-chat-header';header.innerHTML='<span class="concierge-avatar"><i data-lucide="sparkles" aria-hidden="true"></i></span><div><h3>Travel-Drip concierge</h3><p id="conciergeStepLabel">Your trip, one idea at a time</p></div>';
  const thread=document.createElement('div');thread.id='conciergeThread';thread.className='concierge-thread';thread.setAttribute('role','log');thread.setAttribute('aria-label','Trip planning conversation');thread.setAttribute('aria-live','polite');thread.setAttribute('tabindex','0');
  thread.append(document.getElementById('aiPlannerTranscript'),chat.querySelector('.ai-planner-message.assistant'),document.getElementById('aiPlannerReplies'));
  const composer=document.createElement('footer');composer.className='concierge-composer';composer.append(chat.querySelector('.ai-planner-input-row'),document.getElementById('aiPlannerStatus'));chat.append(header,thread,composer);
  const summary=panel.querySelector('.ai-planner-summary'),draft=document.getElementById('aiGeneratedTrip');const previousSummary=summary.closest('details.simple-disclosure'),previousDraft=draft.closest('details.simple-disclosure');
  const side=document.createElement('aside');side.className='concierge-trip-details';side.setAttribute('aria-label','Your trip details');summary.querySelector('h3').textContent='Trip details';side.append(summary);
  const disclosure=document.createElement('details');disclosure.className='concierge-draft';const label=document.createElement('summary');label.textContent='Trip draft & research';disclosure.append(label,draft);side.append(disclosure);shell.append(side);previousSummary?.remove();previousDraft?.remove();
  renderConciergeConversation();window.lucide?.createIcons();
}

function renderConciergeConversation() {
  const nav=document.getElementById('conciergeQuestions');if(!nav)return;
  const labels=['Trip type','Destination','Budget','Dates','Travelers','Interests','Your stay','Transportation','Dining','Accessibility'];
  const current=Number.isInteger(state.aiPlanner.editingStep)?state.aiPlanner.editingStep:state.aiPlanner.step;
  const reviewed=aiPlannerSteps.filter(step=>Object.hasOwn(state.aiPlanner.answers,step.key)).length;
  document.getElementById('conciergeProgress').textContent=`${reviewed} of ${aiPlannerSteps.length} questions reviewed`;
  document.getElementById('conciergeStepLabel').textContent=aiPlannerSteps[current]?`${Number.isInteger(state.aiPlanner.editingStep)?'Editing':'Planning'} · ${labels[current]}`:'Your planning answers are ready';
  nav.replaceChildren();aiPlannerSteps.forEach((step,index)=>{const answered=Object.hasOwn(state.aiPlanner.answers,step.key),button=document.createElement('button');button.type='button';button.className='concierge-question-link';button.disabled=!answered&&index!==current;button.setAttribute('aria-label',`${labels[index]}: ${answered?state.aiPlanner.answers[step.key]?'answered':'skipped':index===current?'current question':'not answered'}`);if(index===current)button.setAttribute('aria-current','step');
    const number=document.createElement('span');number.className='concierge-question-number';number.textContent=String(index+1);const text=document.createElement('span');text.textContent=labels[index];const status=document.createElement('small');status.textContent=answered?state.aiPlanner.answers[step.key]?'Answered':'Skipped':index===current?'Current':'Next';button.append(number,text,status);button.addEventListener('click',()=>{setConciergeView('conversation');if(answered)editAiPlannerAnswer(index);else document.getElementById('aiPlannerFreeformInput').focus();});nav.append(button);
  });
  // Keep the current prompt visible without moving the page or the composer.
  const thread=document.getElementById('conciergeThread');if(thread)thread.scrollTop=thread.scrollHeight;
}
