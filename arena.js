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
const roundDelay = 1350;
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
let currentRound = 0;
let currentEvent = 0;
let winner = null;
let playbackTimer = null;
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

function renderTrack(players) {
  const activePlayers = players.filter((player) => !player.dead);
  const cells = [];
  const lastPositionInLane = [-Infinity, -Infinity, -Infinity];
  // The display lanes avoid overlap. Only the column is a battle position.
  const fitsInLane = (position, lastPosition) => position - lastPosition >= 3;

  for (let position = 1; position <= boardEnd; position += 1) {
    const cell = document.createElement('div');
    cell.className = 'tile';
    const stack = document.createElement('div');
    stack.className = 'tokens';

    const occupants = activePlayers.filter((player) => player.position === position);
    cell.classList.toggle('occupied', occupants.length > 0);
    for (const player of occupants) {
      const availableLane = fitsInLane(position, lastPositionInLane[player.row])
        ? player.row
        : lastPositionInLane.findIndex((lastPosition) => fitsInLane(position, lastPosition));
      const lane = availableLane === -1 ? lastPositionInLane.length : availableLane;
      lastPositionInLane[lane] = position;

      const token = document.createElement('span');
      token.className = `token ${player.style}`;
      token.style.setProperty('--lane', lane);
      token.classList.toggle('faces-left', position > boardEnd / 2);
      const life = numberFormat.format(player.life);
      token.title = `${player.name}, ${player.description}. Позиция ${position}. Здоровье ${life}.`;
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
      stack.append(token);
    }

    const label = document.createElement('span');
    label.className = 'tile-number';
    label.textContent = position;
    cell.append(stack, label);
    cells.push(cell);
  }

  track.style.setProperty('--lanes', lastPositionInLane.length);
  track.style.setProperty('--positions', boardEnd);
  track.replaceChildren(...cells);
}

function renderHero(panel, player) {
  panel.hidden = player === undefined;
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

function renderFighters(players) {
  const mapSlots = [];
  const cards = players.map((player, index) => {
    const card = cardTemplate.content.firstElementChild.cloneNode(true);
    const maxLife = frames[0].players[index].life;
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
    mapSlot.append(card.querySelector('.portrait').cloneNode(true), numberFormat.format(player.life));
    mapSlots.push(mapSlot);
    return card;
  });

  fighters.replaceChildren(...cards);
  mapRoster.replaceChildren(...mapSlots);
  const alive = players.filter((player) => !player.dead).sort((firstPlayer, secondPlayer) => firstPlayer.position - secondPlayer.position);
  renderHero(leftHero, alive[0]);
  renderHero(rightHero, alive.length > 1 ? alive.at(-1) : undefined);
  survivors.textContent = `${alive.length} из ${players.length} в бою`;
}

function renderControls() {
  const lastRound = frames.length - 1;
  const hasBattle = lastRound > 0;
  const isPlaying = playbackTimer !== null;
  first.disabled = currentRound === 0;
  previous.disabled = currentRound === 0;
  next.disabled = currentRound >= lastRound;
  playback.disabled = !hasBattle;
  pauseIcon.hidden = !isPlaying;
  playIcon.hidden = isPlaying;
  let playbackLabel = 'Повтор боя';
  let caption = 'Повтор';
  if (isPlaying) {
    playbackLabel = 'Пауза';
    caption = 'Пауза';
  } else if (currentRound > 0 && currentRound < lastRound) {
    playbackLabel = 'Пуск повтора';
    caption = 'Пуск';
  }

  playback.setAttribute('aria-label', playbackLabel);
  playbackCaption.textContent = caption;
  renderCommandHint();
  roundSlider.disabled = !hasBattle;
  roundSlider.max = lastRound;
  roundSlider.value = currentRound;
  roundLabel.textContent = hasBattle ? `${currentRound} / ${lastRound}` : 'До боя';
  roundSlider.setAttribute('aria-valuetext', hasBattle ? `Раунд ${currentRound} из ${lastRound}` : 'До боя');

  let status = hasBattle ? 'До первого раунда' : 'Шесть бойцов сражаются автоматически';
  if (hasBattle && currentRound === lastRound) {
    status = winner ? `Победитель – ${winner.name}` : 'Ничья';
  } else if (currentRound > 0) {
    status = isPlaying ? 'Бой идёт' : 'Пауза';
  }

  outcomeButton.hidden = !hasBattle || currentRound !== lastRound;
  if (result.textContent !== status) {
    result.textContent = status;
  }
}

function renderConsole() {
  const events = frames[currentRound].events;
  if (events.length > 0) {
    consoleLine.textContent = `Раунд ${currentRound} · событие ${currentEvent + 1} из ${events.length}`;
  } else {
    consoleLine.textContent = frames.length === 1 ? 'Бой ещё не начался' : 'Стартовые позиции';
  }
  consoleDetail.textContent = events[currentEvent] ?? '';
  consoleDetail.hidden = events.length === 0;
  logUp.disabled = currentEvent === 0;
  logDown.disabled = currentEvent >= events.length - 1;
}

function stepConsole(offset) {
  pausePlayback();
  currentEvent += offset;
  renderConsole();
}

function showFrame(round) {
  currentRound = round;
  const frame = frames[round];
  currentEvent = Math.max(0, frame.events.length - 1);
  const entries = frame.events.map((message) => {
    const item = document.createElement('li');
    item.textContent = message;
    return item;
  });

  renderTrack(frame.players);
  renderFighters(frame.players);
  log.replaceChildren(...entries);
  logEmpty.hidden = entries.length > 0;
  journalBody.scrollTop = 0;
  journalRound.textContent = round === 0 ? 'До боя' : `Раунд ${round}`;

  renderConsole();
  renderControls();
}

function pausePlayback() {
  clearInterval(playbackTimer);
  playbackTimer = null;
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

function startPlayback() {
  const lastRound = frames.length - 1;
  if (currentRound === lastRound) {
    showFrame(0);
  }

  playbackTimer = setInterval(() => {
    showFrame(currentRound + 1);
    if (currentRound === lastRound) {
      pausePlayback();
      if (!outcomeSeen) {
        showOutcome();
      }
    }
  }, roundDelay);

  renderControls();
}

function startBattle() {
  pausePlayback();
  outcomeSeen = false;
  const players = createPlayers();
  boardEnd = initialBoardEnd;
  frames = [{ players: capturePlayers(players), events: [] }];
  let events = [];

  winner = play(players, {
    maxRounds: 1000,
    log(message) {
      events.push(message);
    },
    onRound() {
      const state = capturePlayers(players);
      boardEnd = Math.max(boardEnd, ...state.map((player) => player.position));
      frames.push({ players: state, events: events.slice(1) });
      events = [];
    }
  });

  start.setAttribute('aria-label', 'Новый бой');
  startCaption.textContent = 'Новый бой';
  showFrame(1);
  track.scrollLeft = 0;
  if (frames.length > 2) {
    startPlayback();
  } else {
    showOutcome();
  }
}

function seek(round) {
  pausePlayback();
  showFrame(round);
}

for (const panel of [track, journalBody]) {
  panel.addEventListener('focusin', pausePlayback);
  panel.addEventListener('pointerdown', pausePlayback);
}

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
previous.addEventListener('click', () => seek(currentRound - 1));
next.addEventListener('click', () => seek(currentRound + 1));
roundSlider.addEventListener('input', () => seek(roundSlider.valueAsNumber));
playback.addEventListener('click', () => {
  if (playbackTimer === null) {
    startPlayback();
  } else {
    pausePlayback();
  }
});

frames = [{ players: capturePlayers(createPlayers()), events: [] }];
showFrame(0);
