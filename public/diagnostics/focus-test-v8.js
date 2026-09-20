/* Page-local language switching with a constant inputmode=none. */
(() => {
  const $ = id => document.getElementById(id);
  const first = $('first'), second = $('second');
  const fields = [first, second];
  const trials = [];
  let active = null;
  const text = el => (el.value || '').slice(0, 100);
  const fieldOf = node => fields.find(el => el === node || (node instanceof Node && el.contains(node)));
  const snapshot = () => ({ first: text(first), second: text(second), focused: fieldOf(document.activeElement)?.id || null, inputModes: fields.map(el => el.inputMode), localLanguage: composer.language });
  const log = entry => {
    if (!active) return;
    if (active.events.length >= 600) { active.truncated = true; return; }
    active.events.push({ ms: Math.round(performance.now() - active.clock), ...entry });
  };
  const indicator = new window.CaretLanguageIndicator();
  const restore = () => { indicator.hide(); };
  const end = () => {
    if (!active) return;
    log({ type: 'finish', state: snapshot() });
    active.final = snapshot(); active.ended = new Date().toISOString();
    active.check = '입력 기록 완료 · 표시 여부는 관찰 결과 참고';
    const row = document.createElement('tr');
    for (const value of [trials.length, `${active.mode} / ${active.navigation || '미확인'}`, active.firstInsert?.data || '없음', active.check]) {
      const cell = document.createElement('td'); cell.textContent = String(value); row.appendChild(cell);
    }
    $('history').appendChild(row);
    $('status').textContent = `${trials.length}회 기록 완료. 결과를 선택한 뒤 다음 회차를 시작하세요.`;
    active = null; restore();
    $('start').disabled = false; $('finish').disabled = true; $('mode').disabled = false; $('keyboard').disabled = false; $('outcome').disabled = false; $('flicker').disabled = false; $('lost').disabled = false; $('visibility').disabled = false; $('language').disabled = false; $('indicator').disabled = false;
  };
  $('start').addEventListener('click', () => {
    restore();
    for (const field of fields) field.inputMode = $('mode').value;
    first.value = ''; second.value = ''; composer.reset(); $('local-language').textContent = '한글 · Caps Lock으로 전환';
    active = { mode: $('mode').value, keyboard: $('keyboard').value, started: new Date().toISOString(), clock: performance.now(), viewport: {width: innerWidth, height: innerHeight}, events: [], outcome: 'unknown', flicker: 'unknown', lost: 'unknown', visibility: 'unknown', language: 'unknown', indicator: 'unknown', truncated: false };
    trials.push(active);
    $('start').disabled = true; $('finish').disabled = false; $('mode').disabled = true; $('keyboard').disabled = true; $('outcome').disabled = true; $('outcome').value = 'unknown'; for (const key of ['flicker','lost','visibility','language','indicator']) { $(key).disabled = true; $(key).value = 'unknown'; }
    $('status').textContent = `${trials.length}회 기록 중 — 첫 칸에 입니다 → 다음 칸에 ㄹ → 백스페이스 → 한/영 전환 → 밖으로 이동 후 재진입 → 완료`;
    log({type: 'start', state: snapshot()}); first.focus();
  });
  const composer = new window.LocalKeyboard(fields, () => !!active, entry => {
    log({...entry,state:snapshot()});
    if (entry.type === 'local-language-change') {
      $('local-language').textContent = `${entry.language === 'ko' ? '한글' : 'English'} · Caps Lock으로 전환`;
      indicator.show(document.activeElement, entry.language);
      log({type:'caret-indicator-shown', language:entry.language, state:snapshot()});
    }
    if (active && entry.type === 'app-edit' && entry.field === 'second' && entry.value && !active.firstInsert) {
      active.firstInsert = {source:'page-composer', data:entry.value, state:snapshot()};
    }
  });
  const types = ['keydown', 'keyup', 'beforeinput', 'input', 'compositionstart', 'compositionend', 'focusin', 'focusout', 'pointerdown', 'pointerup'];
  for (const type of types) document.addEventListener(type, event => {
    if (!active) return;
    const field = fieldOf(event.target);
    if (!field) return;
    const record = {type, field:field?.id || null, key:event.key ?? null, code:event.code ?? null, repeat:event.repeat ?? null, shift:event.shiftKey ?? null, ctrl:event.ctrlKey ?? null, meta:event.metaKey ?? null, data:event.data ?? null, inputType:event.inputType ?? null, isComposing:event.isComposing ?? null, trusted:event.isTrusted, defaultPrevented:event.defaultPrevented, state:snapshot()};
    log(record);
    if (active.mode === 'native' && field === second && type === 'beforeinput' && event.inputType?.startsWith('insert') && !active.firstInsert) active.firstInsert = record;
    if (field === first && type === 'keydown' && event.key === 'Tab' && !event.shiftKey) active.navigation = 'Tab';
    if (field === second && type === 'pointerdown' && document.activeElement === first) active.navigation = `pointer:${event.pointerType || 'unknown'}`;
    if (type === 'input') {
      const trial = active;
      queueMicrotask(() => { if (trial === active) log({type:'input:after', field:field?.id, state:snapshot()}); });
    }
  }, {capture:true, passive:true});
  $('outside').addEventListener('click', () => { $('outside').focus(); log({type:'outside-focus', state:snapshot()}); });
  $('finish').addEventListener('click', end);
  $('outcome').addEventListener('change', () => { if(!active && trials.length) trials[trials.length-1].outcome = $('outcome').value; });
  for (const key of ['flicker', 'lost', 'visibility', 'language', 'indicator']) $(key).addEventListener('change', () => { if (!active && trials.length) trials[trials.length - 1][key] = $(key).value; });
  $('download').addEventListener('click', () => {
    end();
    const report = {version:8, experiment:'caps-keydown-without-keyup-and-caret-indicator', composer:'v8-no-keyup-latch', exported:new Date().toISOString(), userAgent:navigator.userAgent, platform:navigator.platform, maxTouchPoints:navigator.maxTouchPoints, standalone:matchMedia('(display-mode: standalone)').matches, trials};
    const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const a = document.createElement('a'); a.href=url; a.download=`vocab-flow-focus-v8-${Date.now()}.json`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),10000);
  });
  window.addEventListener('pagehide', restore);
})();
