import {
  Arm,
  Axe,
  Bow,
  Knife,
  LongBow,
  Staff,
  StormStaff,
  Sword
} from './weapons.js';

const combatNumber = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

export class Player {
  constructor(position, name) {
    this.life = 100;
    this.magic = 20;
    this.speed = 1;
    this.attack = 10;
    this.agility = 5;
    this.luck = 10;

    this.description = 'Игрок';
    this.weapon = new Arm();
    this.position = position;
    this.name = name;
  }

  getLuck() {
    const randomNumber = Math.random() * 100;
    return (randomNumber + this.luck) / 100;
  }

  getDamage(distance = 1) {
    if (distance <= 0 || distance > this.weapon.range) {
      return 0;
    }

    return (this.attack + this.weapon.getDamage()) * this.getLuck() / distance;
  }

  takeDamage(damage) {
    this.life = Math.max(0, this.life - Math.max(0, damage));
  }

  isDead() {
    return this.life === 0;
  }

  moveLeft(distance) {
    this.position -= Math.min(Math.abs(distance), this.speed);
  }

  moveRight(distance) {
    this.position += Math.min(Math.abs(distance), this.speed);
  }

  move(distance) {
    if (distance < 0) {
      this.moveLeft(distance);
    } else {
      this.moveRight(distance);
    }
  }

  isAttackBlocked() {
    return this.getLuck() > (100 - this.luck) / 100;
  }

  dodged() {
    return this.getLuck() > (100 - this.agility - this.speed * 3) / 100;
  }

  takeAttack(damage) {
    if (this.isAttackBlocked()) {
      this.weapon.takeDamage(damage);
      this.checkWeapon();
      return 'blocked';
    }

    if (this.dodged()) {
      return 'dodged';
    }

    this.takeDamage(damage);
    return 'hit';
  }

  checkWeapon() {
    if (this.weapon.isBroken()) {
      this.weapon = this.weapon instanceof Knife ? new Arm() : new Knife();
    }
  }

  tryAttack(enemy, log, onEvent) {
    this.checkWeapon();
    const samePosition = this.position === enemy.position;
    const distance = samePosition ? 1 : Math.abs(this.position - enemy.position);
    if (distance > this.weapon.range) {
      log?.(`${this.name} не достаёт до цели (${enemy.name}).`);
      onEvent?.({ kind: 'resolve', actor: this, target: enemy, outcome: 'out-of-range' });
      return;
    }

    onEvent?.({ kind: 'aim', actor: this, target: enemy, distance });
    const targetPosition = enemy.position;
    this.weapon.takeDamage(10 * this.getLuck());
    let damage = this.getDamage(distance);
    if (samePosition) {
      enemy.position += 1;
      damage *= 2;
      log?.(`${enemy.name} отскакивает на позицию ${enemy.position}. Удар вдвое сильнее.`);
    }

    const previousLife = enemy.life;
    const previousMagic = enemy.magic;
    const previousWeapon = enemy.weapon;
    const outcome = enemy.takeAttack(damage);

    if (outcome === 'blocked') {
      log?.(`${enemy.name} блокирует удар оружием (${previousWeapon.name}).`);
    } else if (outcome === 'dodged') {
      log?.(`${enemy.name} уклоняется от удара.`);
    } else {
      const lostLife = combatNumber.format(previousLife - enemy.life);
      const spentMana = previousMagic - enemy.magic;
      const manaDetail = spentMana > 0 ? `, мана −${combatNumber.format(spentMana)}` : '';
      log?.(`${this.name} атакует. ${enemy.name}: здоровье −${lostLife}${manaDetail}.`);
    }

    if (previousWeapon !== enemy.weapon) {
      log?.(`${enemy.name} меняет оружие на «${enemy.weapon.name}».`);
    }

    const usedWeapon = this.weapon;
    this.checkWeapon();
    if (usedWeapon !== this.weapon) {
      log?.(`${this.name} меняет оружие на «${this.weapon.name}».`);
    }

    if (enemy.isDead()) {
      log?.(`${enemy.name} выбывает из боя.`);
    }
    onEvent?.({
      kind: 'resolve', actor: this, target: enemy, outcome,
      healthLost: previousLife - enemy.life,
      manaSpent: previousMagic - enemy.magic,
      pushed: enemy.position !== targetPosition,
      eliminated: enemy.isDead()
    });
  }

  chooseEnemy(players) {
    let weakestEnemy = null;
    for (const player of players) {
      if (player !== this && !player.isDead() && (weakestEnemy === null || player.life < weakestEnemy.life)) {
        weakestEnemy = player;
      }
    }

    return weakestEnemy;
  }

  moveToEnemy(enemy) {
    this.move(enemy.position - this.position);
  }

  turn(players, log, onEvent) {
    const enemy = this.chooseEnemy(players);
    if (enemy === null) {
      return;
    }

    const previousPosition = this.position;
    this.moveToEnemy(enemy);
    if (previousPosition !== this.position) {
      log?.(`${this.name} перемещается на позицию ${this.position}.`);
      onEvent?.({ kind: 'move', actor: this, target: enemy });
    }

    if (onEvent) {
      this.tryAttack(enemy, log, onEvent);
    } else {
      this.tryAttack(enemy, log);
    }
  }
}

export class Warrior extends Player {
  constructor(position, name) {
    super(position, name);
    this.life = 120;
    this.maxLife = this.life;
    this.speed = 2;
    this.description = 'Воин';
    this.weapon = new Sword();
  }

  takeDamage(damage) {
    if (damage > 0 && this.life < this.maxLife / 2 && this.magic > 0 && this.getLuck() > 0.8) {
      const absorbedDamage = Math.min(this.magic, damage);
      this.magic -= absorbedDamage;
      super.takeDamage(damage - absorbedDamage);
      return;
    }

    super.takeDamage(damage);
  }
}

export class Archer extends Player {
  constructor(position, name) {
    super(position, name);
    this.life = 80;
    this.magic = 35;
    this.attack = 5;
    this.agility = 10;
    this.description = 'Лучник';
    this.weapon = new Bow();
  }

  getDamage(distance = 1) {
    if (distance <= 0 || distance > this.weapon.range) {
      return 0;
    }

    return (this.attack + this.weapon.getDamage()) * this.getLuck() * distance / this.weapon.range;
  }
}

export class Mage extends Player {
  constructor(position, name) {
    super(position, name);
    this.life = 70;
    this.magic = 100;
    this.maxMagic = this.magic;
    this.attack = 5;
    this.agility = 8;
    this.description = 'Маг';
    this.weapon = new Staff();
  }

  takeDamage(damage) {
    if (damage > 0 && this.magic > this.maxMagic / 2) {
      this.magic -= 12;
      super.takeDamage(damage / 2);
      return;
    }

    super.takeDamage(damage);
  }
}

export class Dwarf extends Warrior {
  constructor(position, name) {
    super(position, name);
    this.life = 130;
    this.maxLife = this.life;
    this.attack = 15;
    this.luck = 20;
    this.description = 'Гном';
    this.weapon = new Axe();
    this.hitsTaken = 0;
  }

  takeDamage(damage) {
    if (damage > 0) {
      this.hitsTaken += 1;
      if (this.hitsTaken % 6 === 0 && this.getLuck() > 0.5) {
        super.takeDamage(damage / 2);
        return;
      }
    }

    super.takeDamage(damage);
  }
}

export class Crossbowman extends Archer {
  constructor(position, name) {
    super(position, name);
    this.life = 85;
    this.attack = 8;
    this.agility = 20;
    this.luck = 15;
    this.description = 'Арбалетчик';
    this.weapon = new LongBow();
  }
}

export class Demiurge extends Mage {
  constructor(position, name) {
    super(position, name);
    this.life = 80;
    this.magic = 120;
    this.maxMagic = this.magic;
    this.attack = 6;
    this.luck = 12;
    this.description = 'Демиург';
    this.weapon = new StormStaff();
  }

  getDamage(distance = 1) {
    const damage = super.getDamage(distance);
    if (damage > 0 && this.magic > 0 && this.getLuck() > 0.6) {
      return damage * 1.5;
    }

    return damage;
  }
}
