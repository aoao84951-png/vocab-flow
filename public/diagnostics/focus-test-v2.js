/* Experimental focus changes are confined to this standalone test page. */
(() => {
  const $ = id => document.getElementById(id);
  const first = $('first'), second = $('second');
  const fields = [first, second];
  const trials = [];
  let active = null, pending = false, transferred = false;
  const text = el => (el.textContent || '').slice(0, 100);
  const fieldOf = node => fields.find(el => el === node || (node instanceof Node && el.contains(node)));
  const snapshot = () => ({ first: text(first), second: text(second), focused: fieldOf(document.activeElement)?.id || null, pending });
  const log = entry => {
    if (!active) return;
    if (active.events.length >= 600) { active.truncated = true; return; }
    active.events.push({ ms: Math.round(performance.now() - active.clock), ...entry });
  };
  const restore = () => { pending = false; first.contentEditable = 'true'; };
  const end = () => {
    if (!active) return;
    log({ type: 'finish', state: snapshot() });
    active.final = snapshot(); active.ended = new Date().toISOString();
    active.check = active.final.first !== '입니다' ? '첫 칸 문구 확인 필요' : !active.firstInsert ? '둘째 칸 입력 없음' : active.firstInsert.data !== 'ㄹ' ? '첫 입력 불일치' : !active.events.some(e => e.field === 'second' && e.type === 'keydown' && e.key === 'Backspace' || e.field === 'second' && e.type === 'beforeinput' && e.inputType === 'deleteContentBackward') ? '삭제 미검증' : active.final.second !== '' ? '삭제 후 글자 남음' : '정상 조건 충족';
    const row = document.createElement('tr');
    for (const value of [trials.length, `${active.mode} / ${active.navigation || '미확인'}`, active.firstInsert?.data || '없음', active.check]) {
      const cell = document.createElement('td'); cell.textContent = String(value); row.appendChild(cell);
    }
    $('history').appendChild(row);
    $('status').textContent = `${trials.length}회 기록 완료. 결과를 선택한 뒤 다음 회차를 시작하세요.`;
    active = null; restore();
    $('start').disabled = false; $('finish').disabled = true; $('mode').disabled = false; $('keyboard').disabled = false; $('outcome').disabled = false; $('flicker').disabled = false; $('lost').disabled = false;
  };
  $('start').addEventListener('click', () => {
    restore(); transferred = false;
    first.textContent = ''; second.textContent = '';
    active = { mode: $('mode').value, keyboard: $('keyboard').value, started: new Date().toISOString(), clock: performance.now(), viewport: {width: innerWidth, height: innerHeight}, events: [], outcome: 'unknown', flicker: 'unknown', lost: 'unknown', truncated: false };
    trials.push(active);
    $('start').disabled = true; $('finish').disabled = false; $('mode').disabled = true; $('keyboard').disabled = true; $('outcome').disabled = true; $('outcome').value = 'unknown'; for (const key of ['flicker','lost']) { $(key).disabled = true; $(key).value = 'unknown'; }
    $('status').textContent = `${trials.length}회 기록 중 — 첫 칸에 입니다 → 다음 칸에 ㄹ → 백스페이스 → 완료`;
    log({type: 'start', state: snapshot()}); first.focus();
  });
  const move = (event, navigation) => {
    if (!active || document.activeElement !== first || transferred || pending) return;
    active.navigation = navigation;
    log({type:'transition-request', mode:active.mode, navigation, state:snapshot()});
    if (active.mode === 'native') return;
    event.preventDefault();
    pending = true;
    if (active.mode === 'disable-sync') first.contentEditable = 'false';
    first.blur();
    log({type:'transition-released', state:snapshot()});
    // Deliberately stay in this event task: no timer, promise or animation frame.
    try { second.focus(); transferred = true; }
    finally { restore(); }
    log({type:'transition-complete', state:snapshot()});
  };
  const types = ['keydown', 'keyup', 'beforeinput', 'input', 'compositionstart', 'compositionend', 'focusin', 'focusout', 'pointerdown', 'pointerup'];
  for (const type of types) document.addEventListener(type, event => {
    if (!active) return;
    const field = fieldOf(event.target);
    if (!field && !(pending && type === 'keydown')) return;
    const record = {type, field:field?.id || null, key:event.key ?? null, code:event.code ?? null, data:event.data ?? null, inputType:event.inputType ?? null, isComposing:event.isComposing ?? null, trusted:event.isTrusted, defaultPrevented:event.defaultPrevented, state:snapshot()};
    log(record);
    if (field === second && type === 'beforeinput' && event.inputType?.startsWith('insert') && !active.firstInsert) active.firstInsert = record;
    if (field === second && type === 'focusin') transferred = true;
    if (type === 'input') {
      const trial = active;
      queueMicrotask(() => { if (trial === active) log({type:'input:after', field:field?.id, state:snapshot()}); });
    }
  }, {capture:true, passive:true});
  first.addEventListener('keydown', event => { if(event.key === 'Tab' && !event.shiftKey) move(event, 'Tab'); });
  second.addEventListener('pointerdown', event => move(event, `pointer:${event.pointerType || 'unknown'}`));
  document.addEventListener('pointerdown', event => {
    if(pending && fieldOf(event.target) !== second) { log({type:'transition-cancelled', state:snapshot()}); restore(); }
  }, true);
  $('finish').addEventListener('click', end);
  $('outcome').addEventListener('change', () => { if(!active && trials.length) trials[trials.length-1].outcome = $('outcome').value; });
  for (const key of ['flicker', 'lost']) $(key).addEventListener('change', () => { if (!active && trials.length) trials[trials.length - 1][key] = $(key).value; });
  $('download').addEventListener('click', () => {
    end();
    const report = {version:2, experiment:'focus-transition-synchronous', exported:new Date().toISOString(), userAgent:navigator.userAgent, platform:navigator.platform, maxTouchPoints:navigator.maxTouchPoints, standalone:matchMedia('(display-mode: standalone)').matches, trials};
    const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const a = document.createElement('a'); a.href=url; a.download=`vocab-flow-focus-v2-${Date.now()}.json`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),10000);
  });
  window.addEventListener('pagehide', restore);
})();
