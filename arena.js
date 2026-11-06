import {
  Archer,
  Crossbowman,
  Demiurge,
  Dwarf,
  Mage,
  Warrior,
  play
} from './src/index.js';

const roster = [
  [Warrior, 'Артур', 'warrior'],
  [Archer, 'Алиса', 'archer'],
  [Mage, 'Мерлин', 'mage'],
  [Dwarf, 'Борин', 'dwarf'],
  [Crossbowman, 'Робин', 'crossbowman'],
  [Demiurge, 'Аврора', 'demiurge']
];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const narrowField = matchMedia('(max-width: 740px)');
const moveDuration = 350;
const numberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const getElement = (id) => document.getElementById(id);
const track = getElement('track');
const leftHero = getElement('left-hero');
const rightHero = getElement('right-hero');
const gridButton = getElement('grid-button');
const rosterWindow = getElement('roster-window');
const fightersButton = getElement('fighters-button');
const journal = getElement('journal');
const journalButton = getElement('journal-button');
const consoleLine = getElement('console-line');
const consoleDetail = getElement('console-detail');
const commandHint = getElement('command-hint');
const logUp = getElement('log-up');
const logDown = getElement('log-down');
const fighters = getElement('fighters');
const mapRoster = getElement('map-roster');
const mapLog = getElement('map-log');
const cardTemplate = getElement('fighter-card');
const result = getElement('result');
const log = getElement('log');
const journalBody = getElement('journal-body');
const logEmpty = getElement('log-empty');
const start = getElement('start');
const startCaption = getElement('start-caption');
const first = getElement('first');
const previous = getElement('prev');
const playback = getElement('playback');
const playbackCaption = getElement('playback-caption');
const playIcon = getElement('play-icon');
const pauseIcon = getElement('pause-icon');
const next = getElement('next');
const roundSlider = getElement('round');
const roundLabel = getElement('round-label');
const journalRound = getElement('journal-round');
const survivors = getElement('survivors');
const outcome = getElement('outcome');
const rules = getElement('rules');
const rulesButton = getElement('rules-button');
const outcomeButton = getElement('outcome-button');
const winnerPortrait = getElement('winner-portrait');
const winnerName = getElement('winner-name');
const outcomeRounds = getElement('outcome-rounds');

let frames = [];
let steps = [];
let cursor = 0;
let currentEvent = 0;
let browsingLog = false;
let winner = null;
let playbackTimer = null;
let deadline = 0;
let remaining = 0;
let animations = [];
let outcomeSeen = false;
const initialBoardEnd = 13;
let boardEnd = initialBoardEnd;
let hoveredCommand = null;
let focusedCommand = null;

function renderCommandHint() {
  const command = hoveredCommand ?? focusedCommand;
  commandHint.textContent = command?.getAttribute('aria-label') ?? command?.textContent.trim() ?? 'Снежный перевал';
}

function createPlayers() {
  const startingPositions = [1, 2, 3, 10, 11, 12];
  return roster.map(([Character, name], index) => new Character(startingPositions[index], name));
}

function capturePlayers(players) {
  return players.map((player, index) => ({
    name: player.name,
    description: player.description,
    life: player.life,
    magic: player.magic,
    attack: player.attack,
    speed: player.speed,
    position: player.position,
    weapon: player.weapon.name,
    dead: player.isDead(),
    style: roster[index][2],
    row: index % 3
  }));
}

function cueText(cue) {
  switch (cue.outcome) {
    case 'out-of-range': return 'Цель вне дальности';
    case 'blocked': return cue.pushed ? 'Блок · Отброшен' : 'Блок';
    case 'dodged': return cue.pushed ? 'Уклонение · Отброшен' : 'Уклонение';
    case 'hit': {
      const loss = `−${numberFormat.format(cue.healthLost)} здоровья`;
      const mana = cue.manaSpent > 0 ? `, −${numberFormat.format(cue.manaSpent)} маны` : '';
      const extra = cue.eliminated ? ' · Выбыл' : cue.pushed ? ' · Отброшен' : '';
      return loss + mana + extra;
    }
    default: return cue.kind === 'move' ? 'Сближение' : 'Атака';
  }
}

function renderTrack(players, cue, movement) {
  const activePlayers = players.filter((player) => !player.dead || (cue?.eliminated && player.name === cue.target));
  const cells = [];
  const lastPositionInLane = [-Infinity, -Infinity, -Infinity];
  // The display lanes avoid overlap. Only the column is a battle position.
  const movingPlayer = activePlayers.find((player) => player.name === movement?.name);
  const movingLane = movingPlayer?.row;
  const clearance = 3;
  const fitsInLane = (position, lane) => {
    // Keep this entire horizontal path clear, including the column the fighter just left.
    const inPath = lane === movingLane &&
      position > Math.min(movement.from, movement.to) - clearance &&
      position < Math.max(movement.from, movement.to) + clearance;
    return !inPath && position - lastPositionInLane[lane] >= clearance;
  };

  const tokens = new Map();
  for (let position = 1; position <= boardEnd; position += 1) {
    const cell = document.createElement('div');
    cell.className = 'tile';
    const stack = document.createElement('div');
    stack.className = 'tokens';

    const occupants = activePlayers.filter((player) => player.position === position);
    cell.classList.toggle('occupied', occupants.length > 0);
    for (const player of occupants) {
      const availableLane = player === movingPlayer || fitsInLane(position, player.row)
        ? player.row
        : lastPositionInLane.findIndex((_, lane) => fitsInLane(position, lane));
      const lane = availableLane === -1 ? lastPositionInLane.length : availableLane;
      if (player !== movingPlayer) lastPositionInLane[lane] = position;

      const token = document.createElement('span');
      token.className = `token ${player.style}`;
      token.dataset.fighter = player.name;
      token.style.setProperty('--lane', lane);
      token.classList.toggle('faces-left', position > boardEnd / 2);
      const actor = player.name === cue?.actor;
      const target = player.name === cue?.target;
      if (actor || target) {
        token.dataset.side = actor ? 'actor' : 'target';
        const opponent = players.find((other) => other.name === (actor ? cue.target : cue.actor));
        token.classList.toggle('faces-left', position > opponent.position);
      }
      token.classList.toggle('token-out', player.dead);
      const life = numberFormat.format(player.life);
      const role = actor ? ' Ходит.' : target ? ' Цель.' : '';
      token.title = `${player.name}, ${player.description}. Позиция ${position}. Здоровье ${life}.${role}`;
      token.setAttribute('aria-label', token.title);
      token.setAttribute('role', 'img');

      const sprite = document.createElement('span');
      sprite.className = 'sprite';
      sprite.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.className = 'health-marker';
      name.textContent = life;
      name.setAttribute('aria-hidden', 'true');
      token.append(sprite, name);
      if (target && cue.kind === 'resolve') {
        token.dataset.outcome = cue.outcome;
        const mark = document.createElement('span');
        mark.className = 'impact-mark';
        mark.setAttribute('aria-hidden', 'true');
        mark.textContent = {
          blocked: 'Блок',
          dodged: 'Уклон',
          'out-of-range': 'Далеко'
        }[cue.outcome] ?? (cue.eliminated ? 'Выбыл' : `−${numberFormat.format(cue.healthLost)}`);
        token.append(mark);
      }
      stack.append(token);
      tokens.set(player.name, token);
    }

    const label = document.createElement('span');
    label.className = 'tile-number';
    label.textContent = position;
    cell.append(stack, label);
    cells.push(cell);
  }

  track.style.setProperty('--lanes', lastPositionInLane.length);
  track.style.setProperty('--positions', boardEnd);
  track.dataset.phase = cue?.kind ?? '';
  track.replaceChildren(...cells);
  return tokens;
}

function renderHero(panel, player, side) {
  panel.hidden = player === undefined;
  panel.dataset.side = side ?? '';
  panel.setAttribute('aria-label', { actor: 'Ходит', target: 'Цель' }[side] ??
    (panel === leftHero ? 'Боец слева' : 'Боец справа'));
  if (!player) {
    panel.replaceChildren();
    return;
  }

  const portrait = document.createElement('div');
  portrait.className = `portrait ${player.style}`;
  const sprite = document.createElement('span');
  sprite.className = 'sprite';
  portrait.append(sprite);

  const title = document.createElement('p');
  title.className = 'hero-name';
  title.textContent = player.name;
  const stats = document.createElement('dl');
  for (const [label, value, fullLabel] of [
    ['Здор.', numberFormat.format(player.life), 'Здоровье'],
    ['Атака', player.attack],
    ['Скорость', player.speed],
    ['Позиция', player.position]
  ]) {
    const term = document.createElement('dt');
    term.textContent = label;
    if (fullLabel) {
      term.title = fullLabel;
    }
    const detail = document.createElement('dd');
    detail.textContent = value;
    stats.append(term, detail);
  }

  const equipment = document.createElement('p');
  equipment.className = 'hero-weapon';
  equipment.textContent = player.weapon;
  const mana = document.createElement('p');
  mana.className = 'hero-mana';
  mana.textContent = `Мана ${numberFormat.format(player.magic)}`;
  panel.replaceChildren(portrait, stats, title, equipment, mana);
}

function renderFighters(players, cue) {
  const mapSlots = [];
  const cards = players.map((player, index) => {
    const card = cardTemplate.content.firstElementChild.cloneNode(true);
    const maxLife = steps[0].players[index].life;
    card.classList.add(player.style);
    card.classList.toggle('is-out', player.dead);
    card.querySelector('h3').textContent = player.name;
    card.querySelector('.fighter-class').textContent = player.description;
    card.querySelector('.health-value').textContent = `${numberFormat.format(player.life)} / ${maxLife}`;

    const health = card.querySelector('meter');
    health.max = maxLife;
    health.value = player.life;
    health.setAttribute('aria-label', `Здоровье: ${player.name}`);
    card.querySelector('.mana').textContent = numberFormat.format(player.magic);
    card.querySelector('.weapon').textContent = player.weapon;
    card.querySelector('.position').textContent = player.dead ? '–' : player.position;
    card.querySelector('.eliminated').hidden = !player.dead;
    const mapSlot = document.createElement('div');
    mapSlot.className = `map-fighter ${player.style}`;
    mapSlot.classList.toggle('is-out', player.dead);
    if (player.name === cue?.actor || player.name === cue?.target) {
      mapSlot.dataset.side = player.name === cue.actor ? 'actor' : 'target';
    }
    const mapName = document.createElement('strong');
    mapName.textContent = player.name;
    const values = document.createElement('span');
    values.className = 'map-values';
    for (const value of [player.life, player.magic]) {
      const stat = document.createElement('span');
      stat.textContent = numberFormat.format(value);
      values.append(stat);
    }
    mapSlot.append(mapName, card.querySelector('.portrait').cloneNode(true), values);
    mapSlots.push(mapSlot);
    return card;
  });

  fighters.replaceChildren(...cards);
  mapRoster.replaceChildren(...mapSlots);
  const alive = players.filter((player) => !player.dead).sort((firstPlayer, secondPlayer) => firstPlayer.position - secondPlayer.position);
  renderHero(leftHero, cue ? players.find((player) => player.name === cue.actor) : alive[0], cue && 'actor');
  renderHero(rightHero, cue ? players.find((player) => player.name === cue.target) :
    (alive.length > 1 ? alive.at(-1) : undefined), cue && 'target');
  survivors.textContent = `${alive.length} из ${players.length} в бою`;
}

function renderControls() {
  const { round } = steps[cursor];
  const lastRound = frames.length - 1;
  const hasBattle = lastRound > 0;
  const atEnd = hasBattle && cursor === steps.length - 1 && remaining === 0;
  const isPlaying = playbackTimer !== null;
  first.disabled = round === 0;
  previous.disabled = round === 0;
  next.disabled = round >= lastRound;
  playback.disabled = !hasBattle;
  pauseIcon.hidden = !isPlaying;
  playIcon.hidden = isPlaying;
  let playbackLabel = 'Повтор боя';
  let caption = 'Повтор';
  if (isPlaying) {
    playbackLabel = 'Пауза';
    caption = 'Пауза';
  } else if (round > 0 && !atEnd) {
    playbackLabel = 'Пуск повтора';
    caption = 'Пуск';
  }

  playback.setAttribute('aria-label', playbackLabel);
  playbackCaption.textContent = caption;
  renderCommandHint();
  roundSlider.disabled = !hasBattle;
  roundSlider.max = lastRound;
  roundSlider.value = round;
  roundLabel.textContent = hasBattle ? `${round} / ${lastRound}` : 'До боя';
  roundSlider.setAttribute('aria-valuetext', hasBattle ? `Раунд ${round} из ${lastRound}` : 'До боя');

  let status = hasBattle ? 'До первого раунда' : 'Шесть бойцов сражаются автоматически';
  if (atEnd) {
    status = winner ? `Победитель – ${winner.name}` : 'Ничья';
  } else if (round > 0) {
    status = isPlaying ? 'Бой идёт' : remaining > 0 ? 'Пауза' : 'Конец раунда';
  }

  outcomeButton.hidden = !atEnd;
  if (result.textContent !== status) {
    result.textContent = status;
  }
}

function renderConsole() {
  const { round, eventCount, cue: recordedCue } = steps[cursor];
  const cue = remaining > 0 ? recordedCue : null;
  const events = frames[round].events;
  if (cue && !browsingLog) {
    consoleLine.textContent = `${cue.actor} → ${cue.target}`;
    consoleDetail.textContent = cueText(cue);
  } else if (eventCount > 0) {
    consoleLine.textContent = `Раунд ${round} · событие ${currentEvent + 1} из ${eventCount}`;
    consoleDetail.textContent = events[currentEvent];
  } else {
    consoleLine.textContent = frames.length === 1 ? 'Бой ещё не начался' : 'Стартовые позиции';
  }
  consoleDetail.hidden = !cue && eventCount === 0;
  logUp.disabled = currentEvent === 0;
  logDown.disabled = currentEvent >= eventCount - 1;
}

function stepConsole(offset) {
  pausePlayback();
  currentEvent += offset;
  browsingLog = true;
  renderConsole();
}

function movementFor(index, cue) {
  const name = cue.kind === 'move' ? cue.actor : (cue.pushed ? cue.target : null);
  if (!name) return null;
  const positionAt = (step) => steps[step].players.find((player) => player.name === name).position;
  return { name, from: positionAt(index - 1), to: positionAt(index) };
}

function animateTurn(tokens, cue, movement) {
  const actor = tokens.get(cue.actor);
  const target = tokens.get(cue.target);
  if (movement) {
    const columnX = (position) => track.children[position - 1].getBoundingClientRect().left;
    const shift = columnX(movement.from) - columnX(movement.to);
    animations.push(tokens.get(movement.name).animate(
      [{ translate: `${shift}px` }, { translate: '0' }],
      { duration: cue.kind === 'move' ? moveDuration : 175, easing: 'ease-in-out' }
    ));
  }
  if (cue.kind === 'aim') {
    const from = actor.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const dx = to.x + to.width / 2 - from.x - from.width / 2;
    const dy = to.y + to.height / 2 - from.y - from.height / 2;
    const length = Math.hypot(dx, dy) || 1;
    const reach = 3 / length;
    animations.push(actor.animate([
      { translate: '0' },
      { translate: `${dx * reach}px ${dy * reach}px`, offset: .68 },
      { translate: '0' }
    ], { duration: 190 }));
    if (cue.distance > 1 && !narrowField.matches) {
      const bounds = track.getBoundingClientRect();
      const shot = document.createElement('span');
      shot.className = 'battle-shot';
      shot.setAttribute('aria-hidden', 'true');
      shot.style.left = `${from.x + from.width / 2 - bounds.left + track.scrollLeft}px`;
      shot.style.top = `${from.y + from.height / 2 - bounds.top}px`;
      shot.style.rotate = `${Math.atan2(dy, dx)}rad`;
      track.append(shot);
      animations.push(shot.animate([
        { opacity: 1, translate: '0' },
        { opacity: 1, translate: `${dx * .92}px ${dy * .92}px`, offset: .9 },
        { opacity: 0, translate: `${dx}px ${dy}px` }
      ], { duration: 150, delay: 45 }));
    }
  }
  if (cue.kind === 'resolve' && cue.outcome !== 'out-of-range') {
    const effect = cue.eliminated
      ? [{ opacity: 1 }, { opacity: .36 }]
      : [{ filter: 'brightness(1.45)' }, { filter: 'brightness(1)' }];
    animations.push(target.querySelector('.sprite').animate(effect, {
      duration: cue.eliminated ? 340 : 145, easing: 'ease-out'
    }));
  }
}

function showStep(index, animate = false) {
  for (const animation of animations) animation.cancel();
  animations = [];
  cursor = index;
  const { round, eventCount, players, cue, duration } = steps[index];
  const visibleCue = animate ? cue : null;
  const movement = visibleCue ? movementFor(index, visibleCue) : null;
  remaining = animate ? duration : 0;
  currentEvent = Math.max(0, eventCount - 1);
  browsingLog = false;
  const entries = frames[round].events.slice(0, eventCount).map((message) => {
    const item = document.createElement('li');
    item.textContent = message;
    return item;
  });

  const tokens = renderTrack(players, visibleCue, movement);
  renderFighters(players, visibleCue);
  if (visibleCue && !reducedMotion.matches) {
    animateTurn(tokens, visibleCue, movement);
  }
  log.replaceChildren(...entries);
  mapLog.replaceChildren(...entries.slice(-3).map((item) => item.cloneNode(true)));
  logEmpty.hidden = entries.length > 0;
  journalBody.scrollTop = 0;
  journalRound.textContent = round === 0 ? 'До боя' : `Раунд ${round}`;

  renderConsole();
}

function pausePlayback() {
  if (playbackTimer === null) return;
  clearTimeout(playbackTimer);
  playbackTimer = null;
  remaining = Math.max(1, deadline - performance.now());
  for (const animation of animations) {
    if (animation.playState === 'running') animation.pause();
  }
  renderControls();
}

function showOutcome() {
  const winnerIndex = roster.findIndex(([, name]) => winner?.name === name);
  winnerPortrait.hidden = winnerIndex === -1;
  winnerPortrait.className = winnerIndex === -1 ? 'portrait' : `portrait ${roster[winnerIndex][2]}`;
  winnerName.textContent = winner ? `Победитель – ${winner.name}` : 'Ничья';
  outcomeRounds.textContent = `Всего раундов: ${frames.length - 1}`;
  outcomeSeen = true;
  outcome.showModal();
}

function scheduleStep() {
  deadline = performance.now() + remaining;
  playbackTimer = setTimeout(() => {
    playbackTimer = null;
    if (cursor === steps.length - 1) {
      showStep(cursor);
      renderControls();
      if (!outcomeSeen) showOutcome();
    } else {
      showStep(cursor + 1, true);
      scheduleStep();
    }
  }, remaining);
  renderControls();
}

function startPlayback() {
  if (remaining === 0) {
    if (cursor === steps.length - 1) showStep(0);
    showStep(cursor + 1, true);
  } else {
    browsingLog = false;
    currentEvent = Math.max(0, steps[cursor].eventCount - 1);
    renderConsole();
    for (const animation of animations) {
      if (animation.playState === 'paused') animation.play();
    }
  }
  scheduleStep();
}

function startBattle() {
  pausePlayback();
  outcomeSeen = false;
  const players = createPlayers();
  boardEnd = initialBoardEnd;
  steps = [{ round: 0, players: capturePlayers(players), eventCount: 0 }];
  frames = [{ end: 0, events: [] }];
  let messages = [];

  winner = play(players, {
    maxRounds: 1000,
    log(message) {
      messages.push(message);
    },
    onEvent(round, { actor, target, ...cue }) {
      const state = capturePlayers(players);
      boardEnd = Math.max(boardEnd, ...state.map((player) => player.position));
      const duration = cue.eliminated ? 540 : { move: moveDuration + 90, aim: 215, resolve: 335 }[cue.kind];
      steps.push({
        round, players: state, eventCount: messages.length - 1, duration,
        cue: { ...cue, actor: actor.name, target: target.name }
      });
    },
    onRound() {
      frames.push({ end: steps.length - 1, events: messages.slice(1) });
      messages = [];
    }
  });

  start.setAttribute('aria-label', 'Новый бой');
  startCaption.textContent = 'Новый бой';
  showStep(0);
  track.scrollLeft = 0;
  startPlayback();
}

function seek(round) {
  pausePlayback();
  showStep(frames[round].end);
  renderControls();
}

for (const panel of [track, journalBody]) {
  panel.addEventListener('focusin', pausePlayback);
  panel.addEventListener('pointerdown', pausePlayback);
}

reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) {
    for (const animation of animations) animation.cancel();
    animations = [];
  }
});

for (const [button, dialog] of [[rulesButton, rules], [fightersButton, rosterWindow], [journalButton, journal]]) {
  button.addEventListener('click', () => {
    pausePlayback();
    dialog.showModal();
    dialog.querySelector('.panel-body').scrollTop = 0;
  });
  dialog.addEventListener('close', () => button.focus());
}

for (const button of document.querySelectorAll('.command-bar .command')) {
  button.addEventListener('pointerenter', () => {
    hoveredCommand = button;
    renderCommandHint();
  });
  button.addEventListener('pointerleave', () => {
    hoveredCommand = null;
    renderCommandHint();
  });
  button.addEventListener('focus', () => {
    focusedCommand = button;
    renderCommandHint();
  });
  button.addEventListener('blur', () => {
    focusedCommand = null;
    renderCommandHint();
  });
}

gridButton.addEventListener('click', () => {
  const visible = track.classList.toggle('show-grid');
  gridButton.setAttribute('aria-pressed', String(visible));
});
logUp.addEventListener('click', () => stepConsole(-1));
logDown.addEventListener('click', () => stepConsole(1));
outcomeButton.addEventListener('click', showOutcome);
outcome.addEventListener('close', () => outcomeButton.focus());
start.addEventListener('click', startBattle);
first.addEventListener('click', () => {
  seek(0);
  journal.close();
});
previous.addEventListener('click', () => seek(steps[cursor].round - 1));
next.addEventListener('click', () => seek(steps[cursor].round + 1));
roundSlider.addEventListener('input', () => seek(roundSlider.valueAsNumber));
playback.addEventListener('click', () => {
  if (playbackTimer === null) {
    startPlayback();
  } else {
    pausePlayback();
  }
});

steps = [{ round: 0, players: capturePlayers(createPlayers()), eventCount: 0 }];
frames = [{ end: 0, events: [] }];
showStep(0);
renderControls();
