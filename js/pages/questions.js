// Registration questions (design/Questions.dc.html), for the organisation's admins: the personal questions, each
// Off, Optional or Required, and custom questions of the canvas's types.
import { requireUser } from '../auth.js';
import { getEvent, getMyRole, listQuestions, PERSONAL_QUESTIONS, QUESTION_TYPES, removeQuestion, setQuestion } from '../data.js';
import { dragScroll, esc, icon, openModal, reveal, toast } from '../ui.js';

const user = await requireUser();
const main = document.querySelector('main');
const eventId = new URLSearchParams(location.search).get('id');
const event = eventId ? await getEvent(eventId).catch(() => null) : null;
const role = event ? await getMyRole(event.orgId, user.uid).catch(() => null) : null;
const q = `?id=${encodeURIComponent(eventId)}`;

if (!event || role !== 'admin') {
  main.innerHTML = `<div class="top-row"><a class="ib" href="${event ? `manage.html${q}` : 'index.html'}" aria-label="Back">${icon('back', 20)}</a></div>
    <div class="glass empty-note">Only the organisation’s admins can change this.</div>`;
  reveal();
  await new Promise(() => {}); // nothing more to show
}

// Each type's icon and placeholder, as on the canvas; social and contact types start with a question filled in.
const LOOK = {
  text: ['text', 'Type your question'], options: ['list', 'Question with choices'], checkbox: ['checkbox', 'Statement to tick'],
  link: ['link', 'Ask for a link'], mobile: ['phone', 'Ask for a number'], instagram: ['at', 'Instagram handle'],
  telegram: ['at', 'Telegram username'], linkedin: ['link', 'LinkedIn profile'], company: ['building', 'Ask where they are from'],
  terms: ['doc', 'Paste the terms or a link'],
};
const GROUPS = [['Basic', ['text', 'options', 'checkbox', 'link', 'mobile']], ['Social profile', ['instagram', 'telegram', 'linkedin']], ['Other', ['company', 'terms']]];
const PREFILL = {
  mobile: 'What is your mobile number?', instagram: 'What is your Instagram?', telegram: 'What is your Telegram?',
  linkedin: 'What is your LinkedIn?', company: 'What is your company or school?',
};
const LEVELS = { off: 'Off', optional: 'Optional', required: 'Required' };
const PERSONAL = Object.keys(PERSONAL_QUESTIONS);

let questions = await listQuestions(eventId).catch(() => []);
const level = (id) => { const x = questions.find((qq) => qq.id === id); return x ? (x.required ? 'required' : 'optional') : 'off'; };
const custom = () => questions.filter((x) => !PERSONAL.includes(x.id));
const tile = (type, size = 30) => `<span class="q-ic" style="background:var(--qtype-${type});width:${size}px;height:${size}px">${icon(LOOK[type][0], size > 26 ? 16 : 14, 2)}</span>`;

function customRow(x) {
  const line = `${QUESTION_TYPES[x.type]}${x.options?.length ? ` · ${x.options.join(', ')}` : ''} · ${x.required ? 'Required' : 'Optional'}`;
  return `<div class="form-row is-static is-tall">${tile(x.type, 32)}
    <span class="ticket-text"><span class="row-label clamp2">${esc(x.text)}</span><span class="meta">${esc(line)}</span></span>
    <button type="button" class="remove-btn" data-remove="${esc(x.id)}" aria-label="${esc(`Remove question: ${x.text}`)}">${icon('close', 14, 2.4)}</button></div>`;
}

function render() {
  main.innerHTML = `
    <header class="mg-head"><a class="ib" href="manage.html${q}" aria-label="Back to Manage event">${icon('back', 20)}</a>
      <span class="mg-head-text"><h1>Registration questions</h1></span></header>
    <div class="stack-6"><div class="lbl">Personal information</div>
      <div class="form-card">
        <div class="form-row is-static"><span class="row-label">Name</span><span class="row-value is-soft">Full name</span></div>
        <div class="form-row is-static"><span class="row-label">Email</span><span class="row-value is-soft">Required</span></div>
        ${PERSONAL.map((id) => `<button type="button" class="form-row" data-personal="${id}" aria-label="${esc(`${PERSONAL_QUESTIONS[id]}: ${LEVELS[level(id)]}`)}">
          <span class="row-label">${PERSONAL_QUESTIONS[id]}</span><span class="row-value is-soft">${LEVELS[level(id)]}</span></button>`).join('')}
      </div><p class="help">Name and email come from the volunteer’s profile.</p></div>
    <div class="stack-6"><div class="lbl">Custom questions</div>
      ${custom().length ? `<div class="form-card">${custom().map(customRow).join('')}</div>` : ''}
      <button type="button" class="glass add-q" data-action="add">${icon('plus', 18, 2.4)}Add question</button></div>`;
}

async function reload(task, failure) {
  try {
    await task();
    questions = await listQuestions(eventId);
    render();
    return true;
  } catch (err) {
    console.warn(err);
    toast(failure);
    return false;
  }
}

function typesSheet() {
  const sheet = openModal({ title: 'Choose question type', body: GROUPS.map(([label, types]) => `<div class="lbl">${label}</div>
    <div class="form-card is-flat">${types.map((t) => `<button type="button" class="ty-row" data-type="${t}">${tile(t)}${esc(QUESTION_TYPES[t])}</button>`).join('')}</div>`).join('') });
  sheet.element.addEventListener('click', (e) => {
    const row = e.target.closest('[data-type]');
    if (!row) return;
    sheet.close();
    formSheet(row.dataset.type);
  });
}

function formSheet(type) {
  const long = type === 'terms';
  const sheet = openModal({ title: 'Add question', body: `
    <span class="q-type">${tile(type, 24)}${esc(QUESTION_TYPES[type])}</span>
    ${long ? `<textarea class="field-area" id="q-text" aria-label="Question" placeholder="${LOOK[type][1]}" maxlength="2000"></textarea>`
      : `<input class="field-flat is-strong" id="q-text" aria-label="Question" placeholder="${LOOK[type][1]}" maxlength="300" value="${esc(PREFILL[type] || '')}">`}
    ${type === 'options' ? '<input class="field-flat" id="q-opts" aria-label="Options, separated by commas" placeholder="Options, separated by commas" maxlength="500">' : ''}
    <div class="form-row is-static is-bare"><span class="row-label">Required</span>
      <button type="button" class="switch" role="switch" id="q-req" aria-checked="false" aria-label="Required"></button></div>
    <div class="sheet-btns"><button type="button" class="ghost-btn" data-action="back">Back</button>
      <button type="button" class="big-btn grow" data-action="save-q">Save question</button></div>` });
  const box = sheet.element;
  const $ = (id) => box.querySelector(`#${id}`);
  const options = () => ($('q-opts')?.value || '').split(',').map((o) => o.trim()).filter(Boolean).slice(0, 20);
  const sync = () => { box.querySelector('[data-action="save-q"]').disabled = !($('q-text').value.trim().length > 2 && (type !== 'options' || options().length)); };
  box.addEventListener('input', sync);
  sync();
  box.addEventListener('click', async (e) => {
    if (e.target.closest('#q-req')) { $('q-req').setAttribute('aria-checked', String($('q-req').getAttribute('aria-checked') !== 'true')); return; }
    if (e.target.closest('[data-action="back"]')) { sheet.close(); typesSheet(); return; }
    if (!e.target.closest('[data-action="save-q"]')) return;
    const fields = {
      type, text: $('q-text').value.trim(), ...(type === 'options' ? { options: options() } : {}),
      required: $('q-req').getAttribute('aria-checked') === 'true', order: Date.now(),
    };
    if (await reload(() => setQuestion(eventId, `q${Date.now().toString(36)}`, fields), 'Couldn’t save the question.')) sheet.close();
  });
}

main.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-personal], [data-remove], [data-action]');
  if (!t) return;
  if (t.dataset.personal) {
    const id = t.dataset.personal, next = { off: 'optional', optional: 'required', required: 'off' }[level(id)];
    await reload(() => (next === 'off' ? removeQuestion(eventId, id)
      : setQuestion(eventId, id, { type: id, required: next === 'required', order: PERSONAL.indexOf(id) })), 'Couldn’t save that.');
    main.querySelector(`[data-personal="${id}"]`)?.focus();
  } else if (t.dataset.remove) {
    await reload(() => removeQuestion(eventId, t.dataset.remove), 'Couldn’t remove the question.');
  } else if (t.dataset.action === 'add') {
    typesSheet();
  }
});

render();
dragScroll(document.scrollingElement, 'y');
reveal();
